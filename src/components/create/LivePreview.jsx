import React from 'react';
import { AlertCircle, ImageIcon, Loader2, RefreshCw } from 'lucide-react';
import { Card, cn } from '../../ui';

/**
 * The meme as it will be made, drawn by the engine while you work. It keeps showing the last picture while a new one is
 * drawn (dimmed, with a quiet "Updating"), and says plainly what is missing or what the engine objected to.
 */
export default function LivePreview({ preview, reason, placeholderPunchline, className }) {
  const { status, image, size, error, redraw } = preview;
  const busy = status === 'waiting' || status === 'loading';
  const ratio = size ? `${size.w} / ${size.h}` : '4 / 5';

  return (
    <Card tone="stage" pad="none" className={cn('overflow-hidden', className)} aria-label="Live preview">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-micro uppercase text-paper/55">Live preview</p>
          <p className="truncate text-[13px] font-semibold text-white">
            {reason ? 'Waiting for your pictures' : status === 'error' ? 'Could not draw it' : busy ? 'Updating…' : 'Exactly as it will be made'}
          </p>
        </div>
        <button
          type="button"
          onClick={redraw}
          disabled={Boolean(reason) || status === 'loading'}
          aria-label="Draw the preview again"
          title="Draw it again"
          className="grid h-9 w-9 shrink-0 place-items-center rounded text-paper/75 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <RefreshCw className={cn('h-4 w-4', status === 'loading' && 'animate-spin')} />
        </button>
      </div>

      <div className="p-4">
        {reason && !image ? (
          <div className="grid place-items-center rounded-md border border-dashed border-white/20 px-6 text-center" style={{ aspectRatio: ratio }}>
            <div>
              <ImageIcon className="mx-auto h-7 w-7 text-paper/50" aria-hidden="true" />
              <p className="mt-3 text-[13.5px] leading-snug text-paper/80">{reason}</p>
            </div>
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-sm border-2 border-ink bg-ink" style={{ aspectRatio: ratio }}>
            {image && <img src={image} alt="Preview of your meme" className={cn('h-full w-full object-contain transition-opacity duration-200', (busy || status === 'error') && 'opacity-40')} />}
            {!image && !error && (
              <div className="grid h-full place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-marker" aria-label="Drawing the preview" />
              </div>
            )}
            {busy && image && (
              <span role="status" className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 on-ink rounded-full bg-ink/85 px-2.5 py-1 text-[11.5px] font-semibold text-marker">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Updating
              </span>
            )}
          </div>
        )}

        {status === 'error' && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-md bg-white/[0.08] px-3 py-2.5 text-[12.5px] leading-snug text-paper">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marker" aria-hidden="true" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}
        {!reason && placeholderPunchline && (
          <p className="mt-3 text-[12px] leading-snug text-paper/60">The punchline shown is a placeholder until you type yours.</p>
        )}
      </div>
    </Card>
  );
}
