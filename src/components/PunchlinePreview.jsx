import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../ui';

const CANVAS_W = 1080; // the meme is laid out 1080 px wide; the preview scales from that

let measureCtx = null;
const ctx2d = () => {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
};

/** Greedy word wrap, like the renderer: explicit line breaks stay, long lines wrap at maxWidth. */
function wrap(text, font, maxWidth) {
  const ctx = ctx2d();
  ctx.font = font;
  const out = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    let line = words[0];
    for (let i = 1; i < words.length; i += 1) {
      const next = `${line} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) line = next;
      else {
        out.push(line);
        line = words[i];
      }
    }
    out.push(line);
  }
  return out;
}

export const DEFAULT_PUNCH_STYLE = {
  english: 'Intrepid ExtraBold',
  telugu: 'Ramabhadra',
  size: 64,
  weight: 'bold',
  position: 'bottom',
  lineHeight: 0.94,
  letterSpacing: 2,
  fill: '#FFFFFF',
  highlight: '#FAE944',
  stroke: '#000000',
  strokeWidth: 5,
  shadowBlur: 3,
  shadowX: 3,
  shadowY: 3,
  shade: 1,
  setupScale: 0.82
};

/**
 * Approximate look of the punchline over the reaction image, using the saved Settings (font, size,
 * colours, outline). The first wrapped line takes the highlight colour, as the renderer does. The
 * real meme is drawn by the server; this only shows what to expect while typing.
 */
export default function PunchlinePreview({ image, text, style: given, englishFont, className, aspect }) {
  const style = { ...DEFAULT_PUNCH_STYLE, ...(given || {}) };
  const english = englishFont || style.english;
  const weight = style.weight === 'normal' ? 400 : 700;
  const [tick, setTick] = useState(0);

  // make sure the web fonts are loaded, then measure again
  useEffect(() => {
    if (!document.fonts?.load) return undefined;
    let live = true;
    Promise.allSettled([document.fonts.load(`${weight} 40px "${english}"`), document.fonts.load(`${weight} 40px "${style.telugu}"`, text || 'అ')]).then(
      () => live && setTick(t => t + 1)
    );
    return () => {
      live = false;
    };
  }, [english, style.telugu, weight, text]);

  const family = `"${english}", "${style.telugu}", "Anek Telugu Variable", "Anek Telugu", "Noto Sans Telugu Variable", "Noto Sans Telugu", "Arial Black", sans-serif`;
  const lines = useMemo(
    () => (text && text.trim() ? wrap(text, `${weight} ${style.size}px ${family}`, CANVAS_W * 0.9) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, family, style.size, weight, tick]
  );

  // nothing to show yet: a quiet placeholder instead of a big empty black box
  if (!image && lines.length === 0) {
    return (
      <div className={cn('grid aspect-[21/7] place-items-center rounded border border-dashed border-line-strong bg-paper-2/50 px-4 text-center text-[13px] text-muted', className)}>
        Live preview: add your reaction image and start typing
      </div>
    );
  }

  const cq = n => `${(n / CANVAS_W) * 100}cqw`;
  const place = style.position === 'top' ? 'top-[6%]' : style.position === 'middle' ? 'top-1/2 -translate-y-1/2' : 'bottom-[6%]';

  return (
    <div className={cn('relative overflow-hidden rounded border-2 border-ink bg-ink-2 shadow-hard-sm', !aspect && 'aspect-video', className)} style={{ containerType: 'inline-size', ...(aspect ? { aspectRatio: aspect } : {}) }}>
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="stage-dots absolute inset-0 grid place-items-center">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[12px] font-medium text-paper/80">Add your reaction image to preview on it</span>
        </div>
      )}
      {/* the shade the renderer draws behind the punchline (Settings › Effects), or the old light vignette without one */}
      {style.shade > 0 ? (
        // like the renderer: the picture stays untouched behind the words, then fades to black at the bottom edge
        <div className="absolute inset-x-0 bottom-0 h-[16%]" style={{ background: `linear-gradient(to top, rgb(0 0 0 / ${style.shade}) 0%, rgb(0 0 0 / ${style.shade * 0.92}) 15%, rgb(0 0 0 / ${style.shade * 0.55}) 50%, transparent 100%)` }} aria-hidden="true" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" aria-hidden="true" />
      )}
      {lines.length > 0 ? (
        <div
          className={cn('absolute inset-x-0 px-[5%] text-center', place)}
          style={{
            fontFamily: family,
            fontWeight: weight,
            fontSize: cq(style.size),
            lineHeight: style.lineHeight,
            letterSpacing: style.letterSpacing ? cq(style.letterSpacing) : undefined,
            WebkitTextStroke: style.stroke ? `${cq(style.strokeWidth)} ${style.stroke}` : undefined,
            paintOrder: 'stroke fill',
            textShadow: `${cq(style.shadowX || 0)} ${cq(style.shadowY || 0)} ${cq(style.shadowBlur ?? 13)} rgb(0 0 0 / 0.9)`
          }}
          aria-hidden="true"
        >
          {lines.map((l, i) => (
            <div
              key={i}
              style={{
                color: i === 0 ? style.highlight : style.fill,
                fontSize: lines.length === 2 && i === 0 ? `${style.setupScale || 0.74}em` : '1em'
              }}
            >
              {l}
            </div>
          ))}
        </div>
      ) : (
        image && (
          <p className="absolute inset-x-0 bottom-[8%] px-4 text-center text-[13px] font-medium text-white/80 drop-shadow">Your punchline appears here as you type</p>
        )
      )}
      <span className="absolute right-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-paper/80 backdrop-blur">Approximate</span>
    </div>
  );
}
