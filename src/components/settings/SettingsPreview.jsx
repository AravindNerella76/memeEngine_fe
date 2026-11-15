import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, RefreshCw } from 'lucide-react';
import { settingsApi } from './settingsModel';
import { Alert, Card, Spinner, cn } from '../../ui';

const FIT_LABEL = {
  headline: 'Heading',
  statement: 'Supporting text',
  bullets: 'Bullet points',
  reactionContext: 'Caption',
  punchline: 'Punchline'
};

const SAMPLE_SHORT = { comparison: 'Comparison', news: 'News', review: 'Review', long: 'Long punchline' };

/**
 * Live preview rendered by the backend's meme renderer (Skia) from the unsaved settings. Requests
 * are debounced and the previous one is cancelled; nothing is stored on the server.
 */
export default function SettingsPreview({ patch, blocked, sample, onSampleChange, samples }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [problem, setProblem] = useState(null);
  const [ownText, setOwnText] = useState({ heading: '', punchline: '' });
  const [showText, setShowText] = useState(false);
  const [nonce, setNonce] = useState(0);
  const ctrl = useRef(null);

  const body = JSON.stringify({ settings: patch || undefined, sample, text: { heading: ownText.heading || undefined, punchline: ownText.punchline || undefined } });

  useEffect(() => {
    if (blocked) return undefined;
    const t = setTimeout(async () => {
      if (ctrl.current) ctrl.current.abort();
      const c = new AbortController();
      ctrl.current = c;
      setLoading(true);
      try {
        const r = await settingsApi.preview(JSON.parse(body), c.signal);
        if (c.signal.aborted) return;
        setResult(r);
        setProblem(null);
      } catch (e) {
        if (e.name === 'AbortError' || c.signal.aborted) return;
        if (e.status === 429) {
          // busy: try again shortly with the same settings
          setTimeout(() => setNonce(n => n + 1), 600);
          return;
        }
        setProblem({ kind: e.status === 422 ? 'fit' : 'error', message: e.message, errors: e.errors });
      } finally {
        if (ctrl.current === c) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [body, blocked, nonce]);

  useEffect(() => () => ctrl.current && ctrl.current.abort(), []);

  const fit = result?.textFit || {};
  const fitRows = Object.entries(fit)
    .filter(([k]) => !k.startsWith('label'))
    .map(([k, v]) => [FIT_LABEL[k] || k, v]);
  const labelFits = Object.entries(fit).filter(([k]) => k.startsWith('label'));
  if (labelFits.length) fitRows.splice(1, 0, ['Subject labels', labelFits[0][1]]);

  return (
    <Card tone="stage" pad="none" className="space-y-3.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-white">
          <Eye className="h-4 w-4 text-marker" aria-hidden="true" /> Live preview
        </h3>
        <button
          type="button"
          onClick={() => setNonce(n => n + 1)}
          className="grid h-8 w-8 place-items-center rounded text-paper/70 transition-colors hover:bg-white/10 hover:text-white"
          title="Render again"
          aria-label="Render the preview again"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div role="tablist" aria-label="Preview sample" className="flex flex-wrap gap-1.5">
        {Object.keys(samples || SAMPLE_SHORT).map(k => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={sample === k}
            title={samples?.[k]}
            onClick={() => onSampleChange(k)}
            className={cn(
              'h-8 rounded-full px-3 text-[12px] font-semibold transition-colors',
              sample === k ? 'bg-marker text-ink' : 'bg-white/10 text-paper/80 hover:bg-white/20 hover:text-white'
            )}
          >
            {SAMPLE_SHORT[k] || k}
          </button>
        ))}
      </div>

      <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden rounded border border-white/15 bg-black">
        {result?.image ? (
          <img src={result.image} alt="Preview of a sample meme with these settings" className={cn('h-auto w-full transition-opacity', loading ? 'opacity-60' : 'opacity-100')} />
        ) : (
          !problem && (
            <div className="flex items-center gap-2 p-8 text-center text-[13px] text-paper/60" role="status">
              <Spinner className="h-3.5 w-3.5" /> Rendering the preview…
            </div>
          )
        )}
        {loading && result?.image && (
          <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-medium text-paper/85">
            <Spinner className="h-3 w-3" /> Rendering
          </div>
        )}
        {blocked && (
          <div className="absolute inset-x-2 bottom-2 rounded bg-ink/90 px-3 py-2 text-[12px] font-medium text-coral">Fix the highlighted values to update the preview.</div>
        )}
      </div>

      {problem && (
        <Alert tone={problem.kind === 'fit' ? 'warn' : 'bad'} compact>
          <p className="font-semibold">{problem.kind === 'fit' ? 'With these settings the sample text does not fit:' : 'The preview could not be rendered:'}</p>
          <p>{problem.message}</p>
          {problem.errors?.length > 0 && (
            <ul className="ml-4 mt-1 list-disc space-y-0.5">
              {problem.errors.slice(0, 6).map(e => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}

      {result && (
        <div className="space-y-2">
          <p className="font-mono text-[11px] leading-relaxed text-paper/50">
            Drawn by the meme renderer (Skia) · {result.width} × {result.height}
            {result.outputWidth !== result.width && ` · saved memes: ${result.outputWidth} × ${result.outputHeight}`} · {result.renderMs} ms · not saved
          </p>
          {fitRows.length > 0 && (
            <dl className="text-[12px]">
              {fitRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-white/10 py-1">
                  <dt className="text-paper/55">{k}</dt>
                  <dd className="font-mono text-paper">
                    {v.size}px · {v.lines} line{v.lines === 1 ? '' : 's'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <div className="border-t border-white/10 pt-3">
        <button type="button" onClick={() => setShowText(v => !v)} className="flex min-h-9 w-full items-center justify-between text-[13px] font-semibold text-paper/80 hover:text-white" aria-expanded={showText}>
          Try your own text
          <ChevronDown className={cn('h-4 w-4 transition-transform', showText && 'rotate-180')} />
        </button>
        {showText && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              value={ownText.heading}
              maxLength={200}
              onChange={e => setOwnText(t => ({ ...t, heading: e.target.value }))}
              placeholder="Heading (English or Telugu)"
              className="field !py-2 !text-[13px]"
              aria-label="Preview heading text"
            />
            <textarea
              value={ownText.punchline}
              maxLength={600}
              rows={2}
              onChange={e => setOwnText(t => ({ ...t, punchline: e.target.value }))}
              placeholder="Punchline (e.g. a long Telugu line to test fitting)"
              className="field resize-y !py-2 !text-[13px]"
              aria-label="Preview punchline text"
            />
            <p className="text-[11.5px] text-paper/50">Only used for this preview; nothing is saved.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
