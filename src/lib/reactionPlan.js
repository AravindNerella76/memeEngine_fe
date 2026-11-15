/**
 * The pure rules of reaction framing: turn what is in a picture (frames, faces) and the owner's choices into draw
 * rectangles. No browser or network here, so it can be tested on its own. These are the same rules as
 * services/reaction-framing.ts in the backend (which the real render uses); the studio repeats them so that dragging
 * the picture in the live preview is instant.
 */

/** Gap between frames shown side by side, in panel pixels at the 1080 px canvas. */
export const FRAME_GAP = 6;
/** Above this enlargement a picture looks soft. */
export const SOFT_ABOVE = 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v, fallback = 0.5) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : fallback);

/** The window of `frame` that fills `aspect` (w / h), as large as possible, centred on `focus`, kept inside the frame. */
export function cropWindow(frame, aspect, focus) {
  const frameAspect = frame.width / frame.height;
  const width = frameAspect > aspect ? frame.height * aspect : frame.width;
  const height = frameAspect > aspect ? frame.height : frame.width / aspect;
  return {
    x: clamp(frame.x + focus.x * frame.width - width / 2, frame.x, frame.x + frame.width - width),
    y: clamp(frame.y + focus.y * frame.height - height / 2, frame.y, frame.y + frame.height - height),
    width,
    height
  };
}

/**
 * Draw rectangles for the panel. `framing` is the owner's choice, or null for automatic:
 *   { split?: boolean, frame?: number, fit?: 'whole', focus?: [{x,y}] }
 * Returns { parts: [{ src, dest, frame, focus }], kind, split, background?, enlargement } where kind is
 * 'split' (frames side by side) | 'frame' (one chosen frame) | 'whole' (everything, on a softened copy) | 'single'.
 */
export function planReactionPanel(a, framing, panel, anchorY = 0.36) {
  const aspect = panel.width / panel.height;
  const fullPanel = { x: 0, y: 0, width: panel.width, height: panel.height };
  const whole = { x: 0, y: 0, width: a.width, height: a.height };

  if (framing?.fit === 'whole') {
    const scale = Math.min(panel.width / a.width, panel.height / a.height);
    const w = a.width * scale;
    const h = a.height * scale;
    const dest = { x: (panel.width - w) / 2, y: (panel.height - h) / 2, width: w, height: h };
    return {
      parts: [{ src: whole, dest, frame: whole, focus: { x: 0.5, y: 0.5 } }],
      kind: 'whole',
      split: false,
      background: { src: cropWindow(whole, aspect, { x: 0.5, y: 0.5 }), dest: fullPanel },
      enlargement: scale
    };
  }

  const chosen = framing?.frame;
  if (a.stacked && typeof chosen === 'number' && Number.isInteger(chosen) && chosen >= 0 && chosen < a.frames.length) {
    const frame = a.frames[chosen];
    const focus = framing?.focus?.[0] ? { x: clamp01(framing.focus[0].x), y: clamp01(framing.focus[0].y) } : a.autoFocus[chosen] || { x: 0.5, y: 0.5 };
    const src = cropWindow(frame, aspect, focus);
    return { parts: [{ src, dest: fullPanel, frame, focus }], kind: 'frame', split: false, enlargement: panel.width / src.width };
  }

  const split = a.stacked && framing?.split !== false;
  const parts = [];
  if (split) {
    const n = a.frames.length;
    const gap = Math.round((FRAME_GAP * panel.width) / 1080);
    const colW = (panel.width - gap * (n - 1)) / n;
    a.frames.forEach((frame, i) => {
      const f = framing?.focus?.[i] ? { x: clamp01(framing.focus[i].x), y: clamp01(framing.focus[i].y) } : a.autoFocus[i] || { x: 0.5, y: 0.5 };
      const dest = { x: Math.round(i * (colW + gap)), y: 0, width: Math.round(colW), height: panel.height };
      parts.push({ src: cropWindow(frame, dest.width / dest.height, f), dest, frame, focus: f });
    });
  } else {
    const point = framing?.focus?.[0];
    let src;
    let focus;
    if (point) {
      focus = { x: clamp01(point.x), y: clamp01(point.y) };
      src = cropWindow(whole, aspect, focus);
    } else {
      const imgAspect = a.width / a.height;
      if (imgAspect > aspect) {
        const w = a.height * aspect;
        src = { x: (a.width - w) * 0.5, y: 0, width: w, height: a.height };
      } else {
        const h = a.width / aspect;
        src = { x: 0, y: (a.height - h) * anchorY, width: a.width, height: h };
      }
      src = { x: Math.max(0, src.x), y: Math.max(0, src.y), width: src.width, height: src.height };
      focus = { x: clamp((src.x + src.width / 2) / a.width, 0, 1), y: clamp((src.y + src.height / 2) / a.height, 0, 1) };
    }
    parts.push({ src, dest: fullPanel, frame: whole, focus });
  }
  return { parts, kind: split ? 'split' : 'single', split, enlargement: Math.max(...parts.map(p => p.dest.width / p.src.width)) };
}

/** A softened copy of part of a picture: shrunk to almost nothing and enlarged again, so it reads as colour and light. */
function softCopy(source, src, width, height) {
  const step = (w, s, sx, sy, sw, sh) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = Math.max(1, Math.round((w * sh) / sw));
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(s, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c;
  };
  const tiny = step(40, source, src.x, src.y, src.width, src.height);
  const mid = step(160, tiny, 0, 0, tiny.width, tiny.height);
  return { mid, width, height };
}

/** Draws a plan onto a canvas context, scaled so the panel is `width` pixels wide. */
export function drawPlan(ctx, source, plan, panel, width) {
  const k = width / panel.width;
  ctx.fillStyle = '#0a0a09';
  ctx.fillRect(0, 0, width, panel.height * k);
  if (plan.background) {
    const bg = plan.background;
    const { mid } = softCopy(source, bg.src, bg.dest.width * k, bg.dest.height * k);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mid, 0, 0, mid.width, mid.height, bg.dest.x * k, bg.dest.y * k, bg.dest.width * k, bg.dest.height * k);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(bg.dest.x * k, bg.dest.y * k, bg.dest.width * k, bg.dest.height * k);
  }
  for (const p of plan.parts) ctx.drawImage(source, p.src.x, p.src.y, p.src.width, p.src.height, p.dest.x * k, p.dest.y * k, p.dest.width * k, p.dest.height * k);
}

/**
 * The focus values after the owner drags one part: the picture moves with the pointer, so the window over the source
 * moves the other way. `dx`/`dy` are in screen pixels, `partWidthPx` is that part's on-screen width.
 */
export function dragFocus(part, start, dx, dy, partWidthPx) {
  const k = part.src.width / partWidthPx; // source pixels per screen pixel
  const win = {
    x: clamp(start.src.x - dx * k, part.frame.x, part.frame.x + part.frame.width - part.src.width),
    y: clamp(start.src.y - dy * k, part.frame.y, part.frame.y + part.frame.height - part.src.height)
  };
  return {
    x: clamp((win.x + part.src.width / 2 - part.frame.x) / part.frame.width, 0, 1),
    y: clamp((win.y + part.src.height / 2 - part.frame.y) / part.frame.height, 0, 1)
  };
}

const round3 = v => Math.round(v * 1000) / 1000;

/** The choice as it is sent with a meme, or null when there is nothing to send. */
export function framingToSend(framing) {
  if (!framing) return null;
  const out = {};
  if (typeof framing.split === 'boolean') out.split = framing.split;
  if (Number.isInteger(framing.frame)) out.frame = framing.frame;
  if (framing.fit === 'whole') out.fit = 'whole';
  if (framing.focus?.length) out.focus = framing.focus.map(f => ({ x: round3(f.x), y: round3(f.y) }));
  return Object.keys(out).length ? out : null;
}

/**
 * Which of the choices offered for a stacked picture is in force: 'split' | 'frame0' | 'frame1' | 'frame2' | 'whole' |
 * 'single' (used as one scene), or null while the owner has not decided.
 */
export function choiceOf(framing) {
  if (!framing) return null;
  if (framing.fit === 'whole') return 'whole';
  if (Number.isInteger(framing.frame)) return `frame${framing.frame}`;
  if (framing.split === false) return 'single';
  if (framing.split === true) return 'split';
  return null;
}
