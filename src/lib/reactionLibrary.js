import { API_BASE, apiFetch } from '../api';
import { cachedJSON, invalidate } from './queryCache';

/**
 * The reaction library: the owner's own pictures, filed by situation / emotion / subject (backend: /api/reactions).
 * Everything the Reactions page and the picker inside the meme forms need lives here.
 */

const PATH = '/api/reactions';
const IMAGE_EXT = /\.(jpe?g|jfif|jpe|png|webp|heic|heif)$/i; // HEIC (iPhone) is converted by the server on import
/** The server takes at most 12 files per request; smaller batches keep the progress bar moving. */
const BATCH = 8;

export const reactionThumbUrl = id => `${API_BASE}${PATH}/${id}/thumb`;
export const reactionFileUrl = id => `${API_BASE}${PATH}/${id}/file`;

/** Paths of the form "/api/reactions?category=sad&limit=48". Empty values are left out. */
export function reactionListPath({ category, search, sort, limit = 48, skip = 0 } = {}) {
  const p = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (category && category !== 'all') p.set('category', category);
  if (search) p.set('search', search);
  if (sort) p.set('sort', sort);
  return `${PATH}?${p}`;
}

/** A page of pictures. `ttl` 0 forces a fresh answer (after something changed). */
export const listReactions = (opts, { ttl = 10_000 } = {}) => cachedJSON(reactionListPath(opts), { ttl });
/** The folders and their counts. */
export const listReactionFolders = ({ ttl = 10_000 } = {}) => cachedJSON(`${PATH}/categories`, { ttl });
/** Forget what was cached: call after adding, editing or deleting. */
export const refreshReactions = () => invalidate(`${API_BASE}${PATH}`);

async function send(method, path, body) {
  const res = await apiFetch(`${API_BASE}${path}`, {
    method,
    headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
    throw new Error(msg || `The server said no (${res.status}).`);
  }
  return data;
}

export const updateReaction = (id, patch) => send('PATCH', `${PATH}/${id}`, patch).finally(refreshReactions);
export const bulkReactions = (action, ids, category) => send('POST', `${PATH}/bulk`, { action, ids, category }).finally(refreshReactions);
/** Counts a use (the quick-pick row sorts by it). Never blocks or fails the meme. */
export const markReactionUsed = id => void send('POST', `${PATH}/${id}/used`).then(refreshReactions, () => {});

/** A library picture as a File, so a form treats it exactly like one the person dropped in. */
export async function reactionAsFile(image) {
  const res = await apiFetch(reactionFileUrl(image.imageId));
  if (!res.ok) throw new Error('That picture could not be loaded. It may have been removed from the library.');
  const blob = await res.blob();
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${image.category.replace(/\W+/g, '_') || 'reaction'}.${ext}`, { type: blob.type || 'image/jpeg' });
}

/** Only real picture files (the server checks the content again). */
export const isPictureFile = file => IMAGE_EXT.test(file.name) || /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type);

/**
 * Groups files picked with a folder chooser by the folder they sit in: "reactions/shocking/a.jpg" files into the folder
 * "shocking". Files with no folder go under `fallback`. Returns [{ category, files }] biggest first.
 */
export function groupByFolder(files, fallback = 'unsorted') {
  const groups = new Map();
  for (const f of files) {
    if (!isPictureFile(f)) continue;
    const parts = String(f.webkitRelativePath || '').split('/').filter(Boolean);
    const folder = parts.length >= 2 ? parts[parts.length - 2] : fallback;
    const key = folder.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40) || fallback;
    (groups.get(key) || groups.set(key, []).get(key)).push(f);
  }
  return [...groups].map(([category, list]) => ({ category, files: list })).sort((a, b) => b.files.length - a.files.length || a.category.localeCompare(b.category));
}

/**
 * Uploads pictures into one folder in small batches. onProgress({ done, total }) after each batch.
 * Resolves with { added, duplicates: [{name, category}], failed: [{name, reason}] }; a batch that fails as a
 * whole (network) marks its files failed and the rest carry on.
 */
export async function uploadReactions(files, category, { tags, onProgress, signal } = {}) {
  const out = { added: 0, duplicates: [], failed: [] };
  for (let i = 0; i < files.length; i += BATCH) {
    if (signal?.aborted) break;
    const batch = files.slice(i, i + BATCH);
    const fd = new FormData();
    fd.set('category', category);
    if (tags) fd.set('tags', tags);
    for (const f of batch) fd.append('images', f, f.name);
    try {
      const r = await send('POST', PATH, fd);
      out.added += r.added;
      out.duplicates.push(...r.duplicates);
      out.failed.push(...r.failed);
    } catch (err) {
      out.failed.push(...batch.map(f => ({ name: f.name, reason: err.message })));
    }
    onProgress?.({ done: Math.min(files.length, i + BATCH), total: files.length });
  }
  refreshReactions();
  return out;
}

/** "sad funny" -> "Sad funny": how a folder name is shown. */
export const folderLabel = category => (category ? category.charAt(0).toUpperCase() + category.slice(1) : '');
