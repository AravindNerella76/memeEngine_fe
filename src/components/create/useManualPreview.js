import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, apiFetch } from '../../api';

/**
 * A real preview of the meme being built by hand: the engine lays it out and renders it exactly as it will be, in
 * memory (nothing is saved, nothing appears in My Memes). It redraws a moment after the person stops changing things.
 */

const SETTLE_MS = 700; // wait for the person to pause before asking
const MAX_SIDE = 1100; // pictures are sent smaller for the preview: the layout and the text are identical, the upload is a fraction

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const FIELD_NAMES = { headline: 'The headline', statement: 'The statement', punchline: 'The punchline', topic: 'The topic', reactionContext: 'The reaction tag' };

/** The engine's own wording for a rejected field ("content.headline is too long (max 300 characters)"), in plain words. */
export function friendlyEngineMessage(message) {
  return String(message || '')
    .replace(/content\.(\w+)/g, (_, field) => FIELD_NAMES[field] || field)
    .replace(/ is too long \(max (\d+) characters\)/g, ' is too long (up to $1 characters)')
    .replace(/ is required/g, ' is needed');
}
const downsized = new WeakMap(); // File -> Promise<File> (each picture is shrunk once, however often the preview redraws)

/** The same picture at preview size (same proportions), or the original when it is already small or cannot be read. */
export function downscaleForPreview(file) {
  if (downsized.has(file)) return downsized.get(file);
  const work = (async () => {
    try {
      if (file.size < 350 * 1024 || typeof createImageBitmap !== 'function') return file;
      const bitmap = await createImageBitmap(file); // honours the photo's own rotation
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      if (scale >= 1) {
        bitmap.close?.();
        return file;
      }
      const w = Math.round(bitmap.width * scale);
      const h = Math.round(bitmap.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
      bitmap.close?.();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      return blob ? new File([blob], `${file.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' }) : file;
    } catch {
      return file;
    }
  })();
  downsized.set(file, work);
  return work;
}

/**
 * @param enabled      false while there is nothing to draw yet (the hook then stays idle)
 * @param subjectFiles [{ id, file }] in slot order
 * @param reactionFile { file } or null
 * @param payload      the JSON body of the form (content, layout, design, subjectLabels)
 * @returns { status: 'idle'|'waiting'|'loading'|'ready'|'error', image, size, error, redraw }
 *          `image` keeps the last good picture while a new one is drawn, so the preview never blanks.
 */
export function useManualPreview({ enabled, subjectFiles, reactionFile, payload }) {
  const [state, setState] = useState({ status: 'idle', image: null, size: null, error: null });
  const [nonce, setNonce] = useState(0);
  const control = useRef(null);

  const key = useMemo(
    () =>
      JSON.stringify({
        payload,
        subjects: subjectFiles.map(s => s.id),
        reaction: reactionFile?.file ? `${reactionFile.file.name}:${reactionFile.file.size}:${reactionFile.file.lastModified}` : null,
        nonce
      }),
    [payload, subjectFiles, reactionFile, nonce]
  );

  useEffect(() => {
    if (!enabled) {
      control.current?.abort();
      setState(s => (s.status === 'idle' ? s : { ...s, status: 'idle', error: null }));
      return undefined;
    }
    setState(s => ({ ...s, status: s.status === 'loading' ? 'loading' : 'waiting', error: null }));
    const timer = setTimeout(async () => {
      control.current?.abort(); // a newer picture is wanted: the older request is no longer interesting
      const ctl = new AbortController();
      control.current = ctl;
      setState(s => ({ ...s, status: 'loading', error: null }));
      try {
        const form = new FormData();
        for (const s of subjectFiles) form.append('subjectImages', await downscaleForPreview(s.file));
        if (reactionFile?.file) form.append('reactionImage', await downscaleForPreview(reactionFile.file));
        form.append('payload', JSON.stringify(payload));
        const ask = () => apiFetch(`${API_BASE}/api/memes/upload-and-preview`, { method: 'POST', body: form, signal: ctl.signal });
        let res = await ask();
        if (res.status === 429) {
          // the engine is drawing a couple already: one polite retry
          await sleep(1200);
          if (ctl.signal.aborted) return;
          res = await ask();
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || `The preview could not be drawn (status ${res.status}).`);
        }
        const out = await res.json();
        if (ctl.signal.aborted) return;
        setState({ status: 'ready', image: out.image, size: { w: out.width, h: out.height }, error: null });
      } catch (err) {
        if (ctl.signal.aborted || err?.name === 'AbortError') return;
        const offline = err instanceof TypeError;
        setState(s => ({ ...s, status: 'error', error: offline ? 'Could not reach the engine to draw the preview.' : friendlyEngineMessage(err.message) }));
      }
    }, SETTLE_MS);
    return () => clearTimeout(timer);
    // `key` captures every input; the objects themselves change identity on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);

  useEffect(() => () => control.current?.abort(), []);

  const redraw = useCallback(() => setNonce(n => n + 1), []);
  return { ...state, redraw };
}
