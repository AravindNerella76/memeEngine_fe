import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Trash2, Upload } from 'lucide-react';
import Button from './Button';
import { Kbd } from './Badge';
import { MOD_KEY } from '../app/platform';
import { cn } from './cn';
import Spinner from './Spinner';
import { ACCEPT_PICTURES, isHeicFile, isPictureFile, toBrowserImage } from '../lib/heic';

export function formatBytes(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Any picture the studio takes, iPhone photos (HEIC) included: they are converted when picked (see lib/heic.js). */
export const isImageFile = isPictureFile;
export const makeImageItem = file => ({ file, preview: URL.createObjectURL(file), name: file.name });

/** State for one picked image. Frees the browser's preview URL when the image is replaced or the page closes. */
export function useImageSlot() {
  const [item, setItem] = useState(null);
  const latest = useRef(null);
  latest.current = item;
  const set = useCallback(next => {
    const prev = latest.current;
    if (prev?.preview && prev.preview !== next?.preview) URL.revokeObjectURL(prev.preview);
    setItem(next);
  }, []);
  useEffect(
    () => () => {
      if (latest.current?.preview) URL.revokeObjectURL(latest.current.preview);
    },
    []
  );
  return [item, set];
}

/**
 * Drop zone / picked-image card. Accepts a click, a drag from the desktop, or (via the parent) a paste.
 * value: { file, preview, name } | null     onChange(next | null)     onReject(message)
 */
export default function ImageDrop({ value, onChange, onReject, title, hint, icon: Icon = Upload, thumbClass = 'h-28 w-24', showPasteHint, disabled, note, className }) {
  const [over, setOver] = useState(false);
  const [dims, setDims] = useState(null);
  const [converting, setConverting] = useState(null); // the iPhone photo being turned into a JPEG
  const depth = useRef(0);

  useEffect(() => {
    if (!value?.preview) {
      setDims(null);
      return undefined;
    }
    let live = true;
    const img = new Image();
    img.onload = () => live && setDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = value.preview;
    return () => {
      live = false;
    };
  }, [value?.preview]);

  const take = async files => {
    const file = files && files[0];
    if (!file || converting) return;
    if (!isPictureFile(file)) {
      onReject?.('That file is not an image. Use a JPG, PNG, WEBP or iPhone (HEIC) photo.');
      return;
    }
    if (!isHeicFile(file)) {
      onChange(makeImageItem(file));
      return;
    }
    setConverting(file.name || 'photo.heic');
    try {
      onChange(makeImageItem(await toBrowserImage(file)));
    } catch (e) {
      onReject?.(e.message);
    } finally {
      setConverting(null);
    }
  };

  const drag = {
    onDragEnter: e => {
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    },
    onDragOver: e => e.preventDefault(),
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: e => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      if (!disabled) take(e.dataTransfer.files);
    }
  };

  const input = (
    <input
      type="file"
      accept={ACCEPT_PICTURES}
      className="sr-only"
      disabled={disabled || Boolean(converting)}
      onChange={e => {
        take(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (!value) {
    return (
      <label
        {...drag}
        className={cn(
          'group relative flex flex-col items-center justify-center gap-3.5 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all duration-150 focus-within:ring-[3px] focus-within:ring-marker',
          over ? 'scale-[1.01] border-ink bg-marker-soft' : 'border-line-strong bg-paper/50 hover:border-ink hover:bg-marker-soft/50',
          disabled && 'pointer-events-none opacity-50',
          converting && 'pointer-events-none border-ink bg-marker-soft/60',
          className
        )}
      >
        {input}
        <span className={cn('grid h-12 w-12 place-items-center rounded-md border-2 border-ink bg-marker shadow-hard-sm transition-transform duration-200 group-hover:-rotate-3 group-hover:scale-105', over && '-rotate-6 scale-110')} aria-hidden="true">
          {converting ? <Spinner className="h-5 w-5 text-ink" /> : <Icon className="h-5 w-5 text-ink" />}
        </span>
        <span aria-live="polite">
          <span className="block text-[15px] font-semibold text-ink">{converting ? 'Converting your iPhone photo…' : over ? 'Drop it here' : title}</span>
          <span className="mt-1 block max-w-xs text-[13px] leading-snug text-muted">{converting ? `${converting} is HEIC, which most browsers cannot show. Turning it into a JPEG at full quality.` : hint}</span>
        </span>
        {showPasteHint && (
          <span className="kbd-hint inline-flex items-center gap-1.5 text-[12px] text-muted">
            <Kbd>{MOD_KEY}</Kbd>
            <Kbd>V</Kbd>
            <span>pastes a screenshot straight in</span>
          </span>
        )}
      </label>
    );
  }

  return (
    <div {...drag} className={cn('relative flex items-center gap-4 rounded-lg border border-line bg-paper/60 p-3 transition-colors', over && 'border-ink bg-marker-soft', className)}>
      <div className={cn('relative shrink-0 overflow-hidden rounded border-2 border-ink bg-ink shadow-hard-sm', thumbClass)}>
        <img src={value.preview} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-semibold text-ink" title={value.name}>
          {value.name}
        </p>
        <p className="mt-0.5 font-mono text-[12px] text-muted">
          {dims ? `${dims.w} × ${dims.h}` : '…'}
          {value.file?.size ? ` · ${formatBytes(value.file.size)}` : ''}
        </p>
        {note && <p className="mt-1 text-[12px] leading-snug text-muted">{note}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            as="label"
            variant="secondary"
            size="sm"
            disabled={disabled}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            className="focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
          >
            Replace
            {input}
          </Button>
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)} leftIcon={<Trash2 className="h-3.5 w-3.5" />}>
            Remove
          </Button>
        </div>
      </div>
      {over && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-marker/90 text-[14px] font-bold text-ink">Drop to replace</div>
      )}
    </div>
  );
}
