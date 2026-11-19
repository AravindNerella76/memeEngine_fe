/**
 * The words of an unfinished manual meme, kept in this browser so a refresh, a closed tab or a stray click on another page
 * does not lose them. Pictures cannot be kept this way (the browser does not hold on to files), so only the words are saved.
 */
const KEY = 'meme_engine_manual_draft_v1';

const FIELDS = ['topic', 'headline', 'statement', 'reactionContext', 'punchline', 'memeType'];

export const isEmptyDraft = d => !d || (FIELDS.filter(f => f !== 'memeType').every(f => !String(d[f] || '').trim()) && !(d.bulletPoints || []).some(b => String(b).trim()));

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return null;
    const out = { bulletPoints: Array.isArray(d.bulletPoints) ? d.bulletPoints.filter(b => typeof b === 'string').slice(0, 12) : [] };
    for (const f of FIELDS) out[f] = typeof d[f] === 'string' ? d[f] : '';
    return isEmptyDraft(out) ? null : out;
  } catch {
    return null; // storage blocked or damaged: the form simply starts empty
  }
}

export function saveDraft(draft) {
  try {
    if (isEmptyDraft(draft)) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* storage unavailable: nothing is saved, nothing breaks */
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
