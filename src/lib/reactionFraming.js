import { API_BASE, apiFetch } from '../api';

/**
 * Framing of the reaction picture in its panel: asking the backend what is in the picture (a stack of frames, where the
 * faces are). The rules that turn that into draw rectangles are in ./reactionPlan.js.
 */
export { FRAME_GAP, SOFT_ABOVE, choiceOf, cropWindow, dragFocus, drawPlan, framingToSend, planReactionPanel } from './reactionPlan';

const SEND_WIDTH = 640;

/** A copy of the picture small enough to send quickly: the backend only needs its look, not its pixels. */
async function smallCopy(file) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;
  const scale = Math.min(1, SEND_WIDTH / width);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(width * scale));
  c.height = Math.max(1, Math.round(height * scale));
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', 0.82));
  return { bitmap, blob, width, height };
}

const analyses = new WeakMap(); // File -> Promise

/**
 * Asks the backend about a reaction picture. Resolves with
 * { width, height, stacked, frames: [{x,y,width,height}], autoFocus, panel, anchorY, fit, bitmap }
 * with frames in the picture's own pixels. The same File is only analysed once.
 */
export function analyzeReaction(file) {
  if (analyses.has(file)) return analyses.get(file);
  const job = (async () => {
    const { bitmap, blob, width, height } = await smallCopy(file);
    const fd = new FormData();
    fd.set('image', blob, 'reaction.jpg');
    const res = await apiFetch(`${API_BASE}/api/reactions/analyze`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Could not read the picture (${res.status}).`);
    return {
      width,
      height,
      stacked: data.stacked,
      frames: data.frames.map(f => ({ x: 0, y: f.top * height, width, height: (f.bottom - f.top) * height })),
      autoFocus: data.autoFocus,
      panel: data.panel,
      anchorY: data.anchorY,
      fit: data.fit,
      bitmap
    };
  })();
  analyses.set(file, job);
  job.catch(() => analyses.delete(file)); // a failed look is tried again next time
  return job;
}
