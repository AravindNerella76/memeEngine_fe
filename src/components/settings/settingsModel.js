import { API_BASE, apiFetch } from '../../api';
import { cachedJSON, invalidate } from '../../lib/queryCache';

/** Settings API (the backend validates everything again; these helpers only shape requests). */
async function request(method, url, body, signal) {
  const res = await apiFetch(`${API_BASE}${url}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || `Server error (${res.status})`);
    err.status = res.status;
    err.errors = Array.isArray(data.errors) ? data.errors : [];
    throw err;
  }
  return data;
}

export const settingsApi = {
  // Shares the request the route registry may already have started while this page's code downloaded. A copy is handed
  // out because the page edits what it receives and the cache must keep the server's version.
  load: () => cachedJSON('/api/settings', { ttl: 5_000 }).then(data => structuredClone(data)),
  save: patch => request('PUT', '/api/settings', patch).then(r => (invalidate(`${API_BASE}/api/settings`), r)),
  reset: section => request('POST', '/api/settings/reset', { section }).then(r => (invalidate(`${API_BASE}/api/settings`), r)),
  preview: (body, signal) => request('POST', '/api/settings/preview', body, signal)
};

export const whatsappApi = {
  /** live=true also asks Meta whether the token works and when it expires. */
  status: live => request('GET', `/api/whatsapp/status${live ? '?check=1' : ''}`),
  save: body => request('PUT', '/api/whatsapp/credentials', body),
  /** Removes one saved value (accessToken, phoneNumberId, verifyToken, appSecret, allowedPhone); the server setting applies again. */
  clear: field => request('DELETE', `/api/whatsapp/credentials${field ? `?field=${encodeURIComponent(field)}` : ''}`)
};

export const instagramApi = {
  getAuthUrl: () => request('GET', '/api/instagram/auth/url'),
  getAccount: () => request('GET', '/api/instagram/account'),
  disconnect: () => request('DELETE', '/api/instagram/account'),
  publish: (payload) => request('POST', '/api/instagram/publish', payload),
  getPublishStatus: (memeId) => request('GET', `/api/instagram/status/${memeId}`)
};

// ---- paths --------------------------------------------------------------------------------------

export function getAt(obj, path) {
  return path.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Immutable set: returns a copy of `obj` with `value` at `path`. */
export function setAt(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const base = obj && typeof obj === 'object' ? obj : {};
  return { ...base, [k]: setAt(base[k], rest, value) };
}

/** The leaves of `next` that differ from `prev` (what a save or preview sends). */
export function diff(next, prev) {
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (isObj(next) && isObj(prev)) {
    const out = {};
    for (const k of Object.keys(next)) {
      if (k === 'version' || k === 'updatedAt') continue;
      const d = diff(next[k], prev[k]);
      if (d !== undefined) out[k] = d;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return JSON.stringify(next) === JSON.stringify(prev) ? undefined : next;
}

/** Schema node for a settings path (role names map onto the per-role spec). */
export function specAt(schema, path) {
  return getAt(schema, path);
}

// ---- validation (same limits as the backend schema) ------------------------------------------------

const HEX = /^#[0-9a-f]{6}$/i;

function walkLeaves(spec, value, path, out) {
  if (!spec || typeof spec !== 'object') return;
  if (typeof spec.kind === 'string') {
    out.push({ spec, value, path });
    return;
  }
  for (const k of Object.keys(spec)) walkLeaves(spec[k], value?.[k], [...path, k], out);
}

/** Map of "a.b.c" path -> message for every invalid value in `settings`. */
export function validate(settings, schema, fonts) {
  const errors = {};
  if (!settings || !schema) return errors;
  const leaves = [];
  for (const section of ['typography', 'effects', 'canvas', 'imageProcessing', 'discovery', 'advanced']) {
    walkLeaves(schema[section], settings[section], [section], leaves);
  }
  for (const { spec, value, path } of leaves) {
    const key = path.join('.');
    if (value === undefined) continue;
    if (spec.kind === 'number') {
      if (value === null && spec.nullable) continue;
      if (typeof value !== 'number' || !Number.isFinite(value)) errors[key] = 'Enter a number';
      else if (value < spec.min || value > spec.max) errors[key] = `Allowed: ${spec.min} to ${spec.max}${spec.unit ? ` ${spec.unit}` : ''}`;
    } else if (spec.kind === 'color') {
      if (typeof value !== 'string' || !HEX.test(value)) errors[key] = 'Use a colour like #FFE500';
    } else if (spec.kind === 'font') {
      const list = spec.script === 'english' ? fonts?.english : fonts?.telugu;
      if (list && !list.includes(value)) errors[key] = 'Not an installed font';
    } else if (spec.kind === 'enum') {
      if (!spec.values.includes(value)) errors[key] = `Choose one of ${spec.values.join(', ')}`;
    }
  }
  for (const role of Object.keys(settings.typography?.roles || {})) {
    const t = settings.typography.roles[role];
    const p = `typography.roles.${role}`;
    if (!errors[`${p}.minSize`] && t.minSize > t.size) errors[`${p}.minSize`] = `Must not be larger than the size (${t.size} px)`;
    if (!errors[`${p}.maxSize`] && t.maxSize < t.size) errors[`${p}.maxSize`] = `Must not be smaller than the size (${t.size} px)`;
  }
  const c = settings.canvas || {};
  if (c.headerRatio != null && c.headerRatio > c.maxHeaderRatio) errors['canvas.headerRatio'] = 'Larger than the maximum header height';
  if (c.punchlineRatio > c.punchlineMaxGrowRatio) errors['canvas.punchlineRatio'] = 'Larger than the maximum punchline area';
  return errors;
}

/** Turns server error strings ("typography.roles.punchline.size must be ...") into a path map. */
export function serverErrorsByPath(list) {
  const out = {};
  for (const msg of list || []) {
    const m = String(msg).match(/^"?([a-zA-Z]+(?:\.[a-zA-Z0-9]+)+)"?\s*(.*)$/);
    if (m) out[m[1]] = m[2] || msg;
    else out._general = out._general ? `${out._general}; ${msg}` : msg;
  }
  return out;
}

// ---- display helpers --------------------------------------------------------------------------

export const pct = v => `${Math.round(v * 1000) / 10}%`;

export const SECTION_INFO = {
  typography: { title: 'Typography & Fonts', short: 'Typography', description: 'Fonts and sizes for each kind of text. Text is fitted automatically: it starts at the size and shrinks towards the minimum when it would not fit.' },
  effects: { title: 'Text Effects & Colours', short: 'Effects', description: 'Fill, highlight, outline and shadow for each kind of text.' },
  canvas: { title: 'Canvas & Layout', short: 'Canvas', description: 'Canvas size and spacing. The arrangement of the images still comes automatically from each reference; nothing is positioned by hand.' },
  imageProcessing: { title: 'Image Processing', short: 'Images', description: 'How pictures are fitted, cropped, checked and saved. Pictures are never stretched.' },
  discovery: { title: 'Image Discovery', short: 'Discovery', description: 'Where subject pictures are searched and how strictly they are checked. API keys and monthly limits stay in the backend .env file.' },
  instagram: { title: 'Instagram Integration', short: 'Instagram', description: 'Connect @kanyaraasi_memes via Meta Unified Login to publish memes directly from the studio.' },
  whatsapp: { title: 'WhatsApp Bot', short: 'WhatsApp', description: 'Every setting the WhatsApp bot needs: access token, phone number ID, webhook verify token, app secret and the allowed phone. Change any of them here, for example a new token when the old one expires; no redeploy needed.' },
  advanced: { title: 'Advanced & Performance', short: 'Advanced', description: 'Timeouts, retries, limits and diagnostics of the generation pipeline.' },
  notifications: { title: 'Notifications', short: 'Notifications', description: 'Get told on your phone or computer when a meme is ready or someone signs in, even with the studio closed.' },
  appearance: { title: 'Appearance', short: 'Appearance', description: 'Night studio: a dark studio for the evening, by itself or whenever you like.' },
  account: { title: 'Account & Security', short: 'Account', description: 'Your sign-in: change the password and see which devices are signed in.' },
};

/** What the yellow highlight colours, per role (mirrors the renderer's rules). */
export const HIGHLIGHT_RULE = {
  heading: 'The first line of the heading.',
  labels: 'The first line in comparison memes, and lines with numbers (e.g. "931 CRORES").',
  supporting: 'The first line, attribution lines starting with "-", and every other bullet point.',
  punchline: 'The first line of the punchline.',
  caption: 'The whole caption.'
};

/** Preview sample that shows a role best. */
export const ROLE_SAMPLE = { heading: 'comparison', labels: 'comparison', supporting: 'news', punchline: 'comparison', caption: 'news' };

/** The rights labels every selected image carries (exact backend wording, discovery/rights.ts). */
export const RIGHTS_LABELS = [
  { id: 'open_license', text: 'Openly licensed' },
  { id: 'open_license_restricted', text: 'Open licence that does not cover this use' },
  { id: 'copyrighted_unconfirmed', text: 'Copyrighted: reuse permission not confirmed' }
];
