import React, { useState } from 'react';
import { Check, ImageOff } from 'lucide-react';
import { cn } from '../../ui';
import { folderLabel, reactionThumbUrl } from '../../lib/reactionLibrary';

/**
 * One picture of the reaction library: a small copy that fades in, the whole picture visible on a dark mat.
 * Clicking it runs onClick (open / pick). With `onSelect` a round checkbox appears for choosing several at once.
 */
export default function ReactionTile({ image, onClick, selected, onSelect, selecting, busy, showFolder, className, priority, ...rest }) {
  const [state, setState] = useState('loading');
  const label = image.name || `${folderLabel(image.category)} picture`;
  return (
    <div className={cn('group relative', className)} {...rest}>
      <button
        type="button"
        data-grid-focus
        onClick={onClick}
        disabled={busy}
        aria-label={label}
        title={[label, image.tags?.length ? image.tags.join(', ') : ''].filter(Boolean).join(' · ')}
        className={cn(
          'relative block aspect-[4/3] w-full overflow-hidden rounded-md border bg-ink transition-all duration-150',
          selected ? 'border-ink shadow-hard-sm ring-2 ring-marker' : 'border-line-strong hover:-translate-y-0.5 hover:border-ink hover:shadow-hard-sm',
          busy && 'opacity-60'
        )}
      >
        {state === 'error' ? (
          <span className="grid h-full w-full place-items-center text-paper/50">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
          </span>
        ) : (
          <img
            src={reactionThumbUrl(image.imageId)}
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setState('ready')}
            onError={() => setState('error')}
            className={cn('h-full w-full object-contain transition-opacity duration-300', state === 'ready' ? 'opacity-100' : 'opacity-0')}
            draggable="false"
          />
        )}
        {showFolder && <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-paper/85">{image.category}</span>}
        {image.usedCount > 0 && <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-marker px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink">×{image.usedCount}</span>}
      </button>
      {onSelect && (
        <button
          type="button"
          role="checkbox"
          aria-checked={Boolean(selected)}
          aria-label={`Select ${label}`}
          onClick={e => {
            e.stopPropagation();
            onSelect();
          }}
          className={cn(
            'absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-ink transition-opacity duration-150 focus-visible:opacity-100 [@media(pointer:coarse)]:h-8 [@media(pointer:coarse)]:w-8',
            selected ? 'bg-marker text-ink opacity-100' : 'bg-surface/90 text-transparent hover:text-ink',
            !selected && !selecting && 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100'
          )}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
