import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImageIcon, Search, Upload, X } from 'lucide-react';
import { API_BASE, apiFetch } from '../../api';
import { Alert, Button, Chips, Input, Spinner, cn } from '../../ui';

const ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.jfif,.png,.webp';

async function post(url, body, isForm = false) {
  const res = await apiFetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

export function discardStaged(tokens) {
  for (const t of tokens || []) apiFetch(`${API_BASE}/api/staged-images/${t}`, { method: 'DELETE' }).catch(() => undefined);
}

const kb = n => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** One pending choice, shown before it is applied. The AI has not checked a picture the user chose. */
export function StagedCard({ item, onRemove, compact }) {
  return (
    <div className="flex items-start gap-3 rounded-md border-2 border-ink bg-marker-soft p-2.5">
      <img src={item.thumbnail} alt="Chosen picture preview" className={cn('shrink-0 rounded border border-ink/30 bg-ink object-cover', compact ? 'h-14 w-14' : 'h-20 w-20')} />
      <div className="min-w-0 flex-1 space-y-0.5 text-[12px] leading-snug text-ink-3">
        <p className="truncate text-[13px] font-semibold text-ink" title={item.originalName}>
          {item.originalName}
        </p>
        <p className="font-mono">
          {item.width} × {item.height}px · {kb(item.bytes)}
        </p>
        <p className="font-semibold text-ink">
          {item.sourceType === 'user_upload' ? 'Your upload' : item.sourceType === 'online_search' ? `Online search${item.provider ? ` · ${item.provider}` : ''}` : 'Earlier discovered candidate'}
          {item.sourceType !== 'ai_discovery' && <span className="font-normal text-muted"> · chosen by you, not checked by the AI</span>}
        </p>
        {item.warnings?.map(w => (
          <p key={w} className="flex items-start gap-1 text-warn">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
          </p>
        ))}
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} className="grid h-7 w-7 shrink-0 place-items-center rounded text-ink-3 hover:bg-ink/10 hover:text-ink" aria-label="Remove this choice">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Pick a picture for one image slot: upload your own, find one online, or (after generation) choose
 * a candidate found earlier. Every choice is validated and previewed by the server; nothing changes
 * until the caller applies it.
 */
export default function ImagePicker({ defaultQuery = '', memeId, slot, onPick, onClose }) {
  const [tab, setTab] = useState('upload');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [results, setResults] = useState([]);
  const [query, setQuery] = useState(defaultQuery);
  const [staged, setStaged] = useState(null);
  const fileRef = useRef(null);
  const open = useRef(new Set());

  useEffect(() => {
    // pictures that were staged but not picked are forgotten when the picker closes
    const set = open.current;
    return () => discardStaged([...set]);
  }, []);

  const track = items => items.forEach(i => open.current.add(i.token));
  const choose = item => {
    open.current.delete(item.token);
    onPick(item);
  };

  const upload = async file => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setStaged(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const item = await post('/api/staged-images/upload', fd, true);
      track([item]);
      setStaged(item);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const search = async () => {
    setBusy(true);
    setError(null);
    setResults([]);
    setNotes([]);
    try {
      const r = await post('/api/staged-images/search', { query });
      track(r.results);
      setResults(r.results);
      setNotes(r.notes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadDiscovered = async () => {
    setBusy(true);
    setError(null);
    setResults([]);
    setNotes([]);
    try {
      const r = await post(`/api/memes/${memeId}/slots/${slot}/candidates`);
      track(r.candidates);
      setResults(r.candidates);
      setNotes(r.notes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const selectTab = id => {
    setTab(id);
    setError(null);
    setResults([]);
    setNotes([]);
    if (id === 'found') loadDiscovered();
  };

  const TABS = [
    { value: 'upload', label: 'Upload', icon: Upload },
    { value: 'search', label: 'Find online', icon: Search },
    ...(memeId ? [{ value: 'found', label: 'Found earlier', icon: ImageIcon }] : [])
  ];

  const grid = (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {results.map(r => (
        <button
          key={r.token}
          type="button"
          onClick={() => choose(r)}
          className="group overflow-hidden rounded-md border border-line-strong bg-surface text-left transition-all hover:-translate-y-0.5 hover:border-ink hover:shadow-hard-sm focus-visible:border-ink"
        >
          <img src={r.thumbnail} alt={r.originalName} className="h-28 w-full bg-ink object-cover" />
          <span className="block p-2 text-[11px] leading-tight text-muted">
            <span className="block truncate text-[12px] font-semibold text-ink">{r.originalName}</span>
            <span className="font-mono">
              {r.width}×{r.height}px
            </span>
            {r.provider ? ` · ${r.provider}` : ''}
            {r.rightsLabel && <span className="mt-0.5 block truncate">{r.rightsLabel}</span>}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in space-y-3.5 rounded-md border border-line-strong bg-paper/70 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Chips mode="tab" size="sm" tone="marker" label="How to choose the picture" value={tab} onChange={selectTab} options={TABS} />
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close picker">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {tab === 'upload' && (
        <div className="space-y-2.5">
          <label className="group block cursor-pointer rounded-md border-2 border-dashed border-line-strong bg-surface px-4 py-5 text-center text-[13px] text-muted transition-colors focus-within:ring-[3px] focus-within:ring-marker hover:border-ink hover:bg-marker-soft/50">
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={e => upload(e.target.files?.[0])} disabled={busy} />
            <Upload className="mx-auto mb-1.5 h-5 w-5 text-ink" aria-hidden="true" />
            <span className="font-semibold text-ink">Choose a JPEG, PNG or WebP image</span>
          </label>
          {staged && (
            <div className="space-y-2.5">
              <StagedCard item={staged} />
              <div className="flex gap-2">
                <Button variant="primary" size="sm" className="flex-1" onClick={() => choose(staged)} leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                  Use this image
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setStaged(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'search' && (
        <form
          onSubmit={e => {
            e.preventDefault();
            search();
          }}
          className="space-y-2"
        >
          <div className="flex gap-2">
            <Input
              type="text"
              value={query}
              maxLength={200}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Chiranjeevi Bhola Shankar still"
              className="min-w-0 flex-1 !py-2 !text-[13px]"
              aria-label="What to search for"
            />
            <Button type="submit" variant="dark" size="sm" disabled={busy || query.trim().length < 2} className="h-[42px]">
              Search
            </Button>
          </div>
          <p className="text-[12px] text-muted">Uses your enabled image sources. A picture you pick here is your own choice: it is not identity-checked by the AI.</p>
        </form>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-[13px] text-muted" role="status">
          <Spinner className="h-3.5 w-3.5" /> {tab === 'upload' ? 'Checking the image…' : 'Looking for pictures and downloading previews…'}
        </p>
      )}
      {error && (
        <Alert tone="bad" compact>
          {error}
        </Alert>
      )}
      {tab !== 'upload' && !busy && results.length > 0 && grid}
      {tab !== 'upload' &&
        !busy &&
        notes.map(n => (
          <p key={n} className="text-[12px] text-muted">
            {n}
          </p>
        ))}
    </div>
  );
}
