import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, HelpCircle, Move, RotateCcw, TriangleAlert } from 'lucide-react';
import { Alert, Badge, Button, Skeleton, cn } from '../../ui';
import { SOFT_ABOVE, analyzeReaction, choiceOf, dragFocus, drawPlan, planReactionPanel } from '../../lib/reactionFraming';

const NUDGE = 0.03;
const clamp01 = v => Math.min(1, Math.max(0, v));
const ordinal = i => ['first', 'second', 'third'][i] || `${i + 1}th`;

/** The choices offered for a stack: both frames, each frame alone, everything. */
function optionsFor(data) {
  return [
    { key: 'split', title: 'Both frames', hint: 'side by side', framing: { split: true } },
    ...data.frames.map((_, i) => ({ key: `frame${i}`, title: `${ordinal(i)[0].toUpperCase()}${ordinal(i).slice(1)} frame`, hint: 'only this one', framing: { frame: i } })),
    { key: 'whole', title: 'Whole picture', hint: 'nothing cropped', framing: { fit: 'whole' } }
  ];
}

/** A small drawing of what an option would look like in the panel. */
function OptionCard({ data, option, selected, onPick }) {
  const ref = useRef(null);
  const plan = useMemo(() => planReactionPanel(data, option.framing, data.panel, data.anchorY), [data, option]);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = 300;
    c.width = w;
    c.height = Math.round((data.panel.height * w) / data.panel.width);
    drawPlan(c.getContext('2d'), data.bitmap, plan, data.panel, w);
  }, [data, plan]);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onPick(option)}
      className={cn(
        'group relative flex flex-col gap-1.5 rounded-md border-2 bg-surface p-1.5 text-left transition-all duration-150',
        selected ? 'border-ink shadow-hard-sm ring-2 ring-marker' : 'border-line-strong hover:-translate-y-0.5 hover:border-ink'
      )}
    >
      <canvas ref={ref} className="block w-full rounded bg-ink" style={{ aspectRatio: `${data.panel.width} / ${data.panel.height}` }} aria-hidden="true" />
      <span className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-tight">{option.title}</span>
          <span className="block truncate text-[11.5px] text-muted">{option.hint}</span>
        </span>
        {selected && (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-marker text-ink" aria-hidden="true">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
    </button>
  );
}

/**
 * What shows of the reaction picture in the meme's reaction panel, drawn as the render will draw it (same rules as the
 * backend). A picture made of stacked frames (speaker above, listener below) is never decided silently: the owner is
 * asked, with a small picture of each choice (both frames side by side, either frame alone, the whole picture), and
 * `onNeedsChoice(true)` holds the Generate button until one is picked. Whatever is chosen can be moved by dragging.
 *
 * `framing` is the choice ({ split?, frame?, fit?, focus? }) or null. `onPanel({ url, aspect })` hands the framed panel
 * to the live punchline preview.
 */
export default function ReactionFraming({ file, framing, onFraming, onPanel, onNeedsChoice }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const panelUrl = useRef(null);
  const [cssWidth, setCssWidth] = useState(520);

  // look at the picture (once per file)
  useEffect(() => {
    let live = true;
    setState({ status: 'loading', data: null, error: null });
    setActive(0);
    analyzeReaction(file).then(
      data => live && setState({ status: 'ready', data, error: null }),
      err => live && setState({ status: 'error', data: null, error: err.message })
    );
    return () => {
      live = false;
    };
  }, [file]);

  const data = state.data;
  const wholeSettings = data?.fit === 'contain';
  const plan = useMemo(() => (data && !wholeSettings ? planReactionPanel(data, framing, data.panel, data.anchorY) : null), [data, framing, wholeSettings]);
  const choice = choiceOf(framing);
  const needsChoice = Boolean(data?.stacked && !wholeSettings && !choice);

  // tell the form whether the owner still has to decide (it keeps Generate closed until they do)
  useEffect(() => {
    onNeedsChoice?.(needsChoice);
  }, [needsChoice, onNeedsChoice]);
  useEffect(() => () => onNeedsChoice?.(false), [onNeedsChoice]);

  // keep the drawing sharp at the size it is shown
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setCssWidth(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [state.status, wholeSettings]);

  const pxWidth = Math.round(cssWidth * Math.min(2, window.devicePixelRatio || 1));
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !plan) return;
    c.width = pxWidth;
    c.height = Math.round((data.panel.height * pxWidth) / data.panel.width);
    drawPlan(c.getContext('2d'), data.bitmap, plan, data.panel, pxWidth);
  }, [plan, data, pxWidth]);

  // hand the framed panel to the punchline preview once the owner stops moving it
  const sendPanel = useCallback(() => {
    const c = canvasRef.current;
    if (!c || !plan || !onPanel) return;
    c.toBlob(
      blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        if (panelUrl.current) URL.revokeObjectURL(panelUrl.current);
        panelUrl.current = url;
        onPanel({ url, aspect: data.panel.width / data.panel.height });
      },
      'image/jpeg',
      0.85
    );
  }, [plan, data, onPanel]);
  useEffect(() => {
    if (!plan) return undefined;
    const t = setTimeout(sendPanel, drag.current ? 400 : 120);
    return () => clearTimeout(t);
  }, [plan, sendPanel]);
  useEffect(
    () => () => {
      if (panelUrl.current) URL.revokeObjectURL(panelUrl.current);
      onPanel?.(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => {
    if (state.status !== 'ready' || wholeSettings) onPanel?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, wholeSettings]);

  const movable = plan && plan.kind !== 'whole';
  const focusesOf = p => p.parts.map(x => x.focus);

  const partAt = clientX => {
    const rect = canvasRef.current.getBoundingClientRect();
    const k = rect.width / data.panel.width;
    const x = (clientX - rect.left) / k;
    let best = 0;
    plan.parts.forEach((p, i) => {
      if (x >= p.dest.x) best = i;
    });
    return { index: best, k };
  };
  const onPointerDown = e => {
    if (!movable || e.button > 0) return;
    const { index, k } = partAt(e.clientX);
    const part = plan.parts[index];
    drag.current = { index, startX: e.clientX, startY: e.clientY, start: { src: part.src }, part, widthPx: part.dest.width * k, focuses: focusesOf(plan) };
    setActive(index);
    setDragging(true);
    canvasRef.current.setPointerCapture(e.pointerId);
  };
  const onPointerMove = e => {
    const d = drag.current;
    if (!d) return;
    const f = dragFocus(d.part, d.start, e.clientX - d.startX, e.clientY - d.startY, d.widthPx);
    const all = [...d.focuses];
    all[d.index] = f;
    onFraming({ ...(framing || {}), focus: all });
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const onKeyDown = e => {
    if (!movable) return;
    const step = e.shiftKey ? NUDGE * 3 : NUDGE;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const i = Math.min(active, plan.parts.length - 1);
    const all = focusesOf(plan);
    all[i] = { x: clamp01(all[i].x + d[0]), y: clamp01(all[i].y + d[1]) };
    onFraming({ ...(framing || {}), focus: all });
  };

  const pick = option => {
    onFraming(option.framing); // a new choice starts from its own automatic position
    setActive(0);
  };
  const resetPosition = () => {
    const { focus, ...rest } = framing || {};
    onFraming(Object.keys(rest).length ? rest : null);
  };

  if (state.status === 'loading') return <Skeleton className="mt-4 h-40 w-full !rounded-md" />;
  if (state.status === 'error') {
    return <p className="mt-3 text-[12.5px] text-muted">Could not check how the picture will be framed ({state.error}). It will still be made, framed automatically.</p>;
  }
  if (wholeSettings) {
    return (
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        Your Settings show reaction pictures whole (Images → Reaction fit), so there is nothing to frame. Switch it to “cover” in Settings to choose what shows.
      </p>
    );
  }

  const stacked = data.stacked;
  const options = stacked ? optionsFor(data) : [];
  const soft = plan.enlargement > SOFT_ABOVE;
  const k = 100 / data.panel.width;
  const current = options.find(o => o.key === choice);
  const hint =
    plan.kind === 'whole'
      ? 'The whole picture is shown, nothing is cropped.'
      : `Drag to move what shows${plan.kind === 'split' ? ' in each frame' : ''}.`;

  return (
    <div className={cn('mt-4 rounded-md border p-3', needsChoice ? 'border-ink bg-marker-soft' : 'border-line bg-paper')} aria-label="Reaction framing">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex items-center gap-2 font-mono text-micro uppercase text-muted">
          <Move className="h-3.5 w-3.5" aria-hidden="true" /> Framing
        </p>
        {needsChoice && (
          <Badge tone="ink" icon={HelpCircle} size="sm">
            Your choice needed
          </Badge>
        )}
        {framing?.focus && (
          <Button variant="ghost" size="sm" onClick={resetPosition} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
            Reset position
          </Button>
        )}
      </div>

      {stacked && (
        <div className="mb-3">
          <p className="mb-2 text-[14px] font-bold leading-snug" id="frame-question">
            {needsChoice ? `This picture has ${data.frames.length} frames. Which do you want in the meme?` : current ? `Using: ${current.title.toLowerCase()}, ${current.hint}` : 'Using this picture as one scene'}
          </p>
          <div role="radiogroup" aria-labelledby="frame-question" className="grid grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] gap-2">
            {options.map(o => (
              <OptionCard key={o.key} data={data} option={o} selected={choice === o.key} onPick={pick} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => pick({ framing: { split: false } })}
            className={cn('mt-2 inline-flex min-h-8 items-center text-[12.5px] font-semibold underline decoration-2 underline-offset-2', choice === 'single' ? 'text-ink decoration-marker' : 'text-muted decoration-line-strong hover:text-ink')}
          >
            {choice === 'single' ? 'Using it as one picture (cropped)' : 'Not really a stack? Use it as one picture'}
          </button>
        </div>
      )}

      <div ref={wrapRef} className="relative mx-auto max-w-[560px] overflow-hidden rounded border-2 border-ink bg-ink-2 shadow-hard-sm">
        <canvas
          ref={canvasRef}
          role={movable ? 'application' : 'img'}
          tabIndex={movable ? 0 : -1}
          aria-label={movable ? `Reaction panel preview. Drag, or use the arrow keys, to move what shows${plan.kind === 'split' ? ' of the selected frame' : ''}.` : 'Reaction panel preview'}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn('block w-full touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-marker', movable ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default')}
          style={{ aspectRatio: `${data.panel.width} / ${data.panel.height}` }}
        />
        {plan.kind === 'split' &&
          plan.parts.map((p, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn('pointer-events-none absolute inset-y-0 border-2 transition-colors', i === active ? 'border-marker' : 'border-transparent')}
              style={{ left: `${p.dest.x * k}%`, width: `${p.dest.width * k}%` }}
            />
          ))}
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-paper/85 backdrop-blur">
          {needsChoice ? 'Suggested' : framing?.focus ? 'Your framing' : 'As chosen'}
        </span>
      </div>
      <p className="mt-2 text-center text-[12px] text-muted">{needsChoice ? 'This is only a suggestion. Pick one of the choices above.' : hint}</p>

      {soft && (
        <Alert tone="warn" icon={TriangleAlert} className="mt-3" title="This picture is small">
          It is {data.width} px wide and is shown {plan.enlargement.toFixed(1)}× larger, so it will look soft in the meme. A bigger copy of the same picture will look sharper.
        </Alert>
      )}
    </div>
  );
}
