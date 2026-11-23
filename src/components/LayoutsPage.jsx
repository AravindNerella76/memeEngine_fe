import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPT_PICTURES, isHeicFile, toBrowserImages } from '../lib/heic';
import { AlertCircle, Check, ImageOff, LayoutTemplate, Pencil, Plus, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { API_BASE, apiFetch } from '../api';
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Skeleton, Spinner, cn, formatBytes, friendlyDate, useConfirm, useDocumentTitle, useToast } from '../ui';
import { press, useShortcuts } from '../app/shortcuts';

const OK_TYPES = /^image\/(jpeg|png|webp)$/;
const SOURCE_LABEL = { viral_auto: 'Learned from a viral meme', whatsapp: 'Added on WhatsApp', api: 'Added here' };

/** Tiny wireframe of a layout: header bar, rows of image slots, reaction panel. */
function Wireframe({ rows = [], header, reaction, className }) {
  return (
    <div className={cn('flex h-16 w-12 shrink-0 flex-col gap-[3px] rounded-[3px] border-2 border-ink bg-surface p-[3px]', className)} aria-hidden="true">
      {header && <div className="h-1.5 shrink-0 rounded-[1px] bg-ink" />}
      <div className="flex min-h-0 flex-1 flex-col gap-[3px]">
        {rows.map((n, i) => (
          <div key={i} className="flex min-h-0 flex-1 gap-[3px]">
            {Array.from({ length: n }, (_, j) => (
              <div key={j} className="flex-1 rounded-[1px] border border-ink/70 bg-marker" />
            ))}
          </div>
        ))}
      </div>
      {reaction && <div className="h-3 shrink-0 rounded-[1px] bg-ink/30" />}
    </div>
  );
}

async function readError(res) {
  const body = await res.json().catch(() => ({}));
  const m = body?.message;
  return (Array.isArray(m) ? m.join(' ') : m) || `Server error (${res.status})`;
}

/** Drop zone for several example memes at once. */
function DropZone({ onFiles, disabled }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const input = useRef(null);
  const take = list => onFiles(Array.from(list || []));
  return (
    <div
      onDragEnter={e => {
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDrop={e => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        if (!disabled) take(e.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-7 text-center transition-colors',
        over ? 'border-ink bg-marker-soft' : 'border-line-strong bg-paper/60',
        disabled && 'pointer-events-none opacity-60'
      )}
    >
      <span className="mb-4 grid h-12 w-12 -rotate-3 place-items-center rounded-lg border-2 border-ink bg-marker shadow-hard-sm" aria-hidden="true">
        <Upload className="h-5 w-5 text-ink" />
      </span>
      <p className="text-[15px] font-bold text-ink">Drop example memes here</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted">One image per layout. JPG, PNG or WebP. Drop as many as you like; they are learned one after another.</p>
      <Button className="mt-5" variant="secondary" onClick={() => input.current?.click()} leftIcon={<Plus className="h-4 w-4" strokeWidth={2.6} />}>
        Choose images
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT_PICTURES}
        className="sr-only"
        aria-label="Choose example memes"
        onChange={e => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

const STATUS = {
  ready: { tone: 'neutral', text: 'Ready' },
  working: { tone: 'info', text: 'Analysing…' },
  saved: { tone: 'ok', text: 'Learned' },
  known: { tone: 'warn', text: 'Already saved' },
  failed: { tone: 'bad', text: 'Failed' }
};

/** Examples waiting to be learned (or already processed), with an optional name for each. */
function Queue({ items, setItems, running, onStart, onClear }) {
  const waiting = items.filter(i => i.status === 'ready').length;
  const setName = (id, name) => setItems(list => list.map(i => (i.id === id ? { ...i, name } : i)));
  const remove = id => setItems(list => list.filter(i => i.id !== id));
  return (
    <div className="mt-5">
      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {items.map(i => {
          const s = STATUS[i.status];
          return (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 sm:flex-nowrap">
              <img src={i.preview} alt="" className="h-14 w-11 shrink-0 rounded border border-line bg-ink object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink" title={i.file.name}>
                  {i.file.name} <span className="ml-1 font-mono text-[11px] font-normal text-muted">{formatBytes(i.file.size)}</span>
                </p>
                {i.status === 'ready' ? (
                  <Input value={i.name} onChange={e => setName(i.id, e.target.value)} placeholder="Name (optional)" maxLength={60} aria-label={`Name for ${i.file.name}`} className="mt-1.5 !h-9 !text-[13px]" disabled={running} />
                ) : (
                  i.message && <p className={cn('mt-0.5 text-[12px] leading-snug', i.status === 'failed' ? 'text-bad' : 'text-muted')}>{i.message}</p>
                )}
              </div>
              <Badge tone={s.tone} size="sm" icon={i.status === 'saved' ? Check : i.status === 'failed' ? AlertCircle : undefined}>
                {i.status === 'working' && <Spinner className="h-3 w-3" />}
                {s.text}
              </Badge>
              {i.status !== 'working' && (
                <button type="button" onClick={() => remove(i.id)} aria-label={`Remove ${i.file.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted hover:bg-ink/10 hover:text-ink" disabled={running && i.status === 'ready'}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onStart} loading={running} disabled={!waiting} leftIcon={<LayoutTemplate className="h-4 w-4" />}>
          {running ? 'Learning…' : `Learn ${waiting} layout${waiting === 1 ? '' : 's'}`}
        </Button>
        <Button variant="ghost" onClick={onClear} disabled={running}>
          Clear list
        </Button>
        {running && <p className="text-[12.5px] text-muted">About 30–60 seconds per image. Keep this page open until it finishes.</p>}
      </div>
    </div>
  );
}

function LayoutCard({ layout, index, busy, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(layout.name || '');
  const inputRef = useRef(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    const clean = name.trim();
    if (!clean) return;
    if (clean === layout.name) return setEditing(false);
    if (await onRename(layout, clean)) setEditing(false);
  };

  return (
    <article className={cn('group flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft transition-all duration-200 hover:border-ink hover:shadow-hard', busy && 'pointer-events-none opacity-50')}>
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-ink">
        {layout.thumbnailUrl ? (
          <img src={`${API_BASE}${layout.thumbnailUrl}`} alt={`Example of ${layout.displayName}`} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-paper/70">
            <ImageOff className="h-7 w-7" aria-hidden="true" />
            <span className="text-[12px]">No preview</span>
          </div>
        )}
        {!layout.name && (
          <Badge tone="marker" size="sm" className="absolute left-3 top-3">
            Unnamed
          </Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Wireframe rows={layout.rows} header={layout.hasHeader} reaction={layout.hasReactionPanel} />
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  save();
                }}
                className="flex items-center gap-1.5"
              >
                <Input ref={inputRef} value={name} onChange={e => setName(e.target.value)} maxLength={60} aria-label="Layout name" className="!h-9 !text-[14px]" onKeyDown={e => e.key === 'Escape' && setEditing(false)} />
                <button type="submit" aria-label="Save name" className="grid h-9 w-9 shrink-0 place-items-center rounded bg-marker text-ink hover:brightness-95">
                  <Check className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <h3 className="flex items-start gap-1.5 text-[16px] font-bold leading-snug text-ink">
                <span className="min-w-0 break-words">{layout.name || `Unnamed layout ${index + 1}`}</span>
                <button type="button" onClick={() => { setName(layout.name || ''); setEditing(true); }} aria-label={layout.name ? 'Rename layout' : 'Name this layout'} className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted hover:bg-ink/10 hover:text-ink">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </h3>
            )}
            <p className="mt-1 text-[13px] leading-snug text-muted">{layout.description}</p>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <p className="min-w-0 truncate text-[12px] text-muted" title={SOURCE_LABEL[layout.source] || ''}>
            {SOURCE_LABEL[layout.source] || 'Saved'} · {friendlyDate(layout.createdAt)} · used {layout.usageCount}×
          </p>
          <Button variant="ghost" size="icon-sm" onClick={() => onDelete(layout)} aria-label={`Delete ${layout.displayName}`} className="shrink-0 text-muted hover:!bg-bad-soft hover:!text-bad">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function LayoutsPage() {
  useDocumentTitle('Layouts');
  const toast = useToast();
  const confirm = useConfirm();

  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const alive = useRef(true);
  const abort = useRef(null);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const fetchLayouts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/formats`);
      if (!res.ok) throw new Error(await readError(res));
      const body = await res.json();
      if (!alive.current) return;
      setLayouts(body.formats || []);
      setLoaded(true);
      setError(null);
    } catch (err) {
      if (alive.current) setError(err.message || 'Could not load layouts');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    fetchLayouts();
    return () => {
      alive.current = false;
      abort.current?.abort();
      queueRef.current.forEach(i => URL.revokeObjectURL(i.preview));
    };
  }, [fetchLayouts]);

  const addFiles = async picked => {
    const rejected = [];
    const next = [];
    // iPhone photos (HEIC) become JPEGs first: browsers other than Safari cannot show them
    const heic = picked.filter(isHeicFile);
    if (heic.length) toast.info(`Converting ${heic.length === 1 ? 'an iPhone photo' : `${heic.length} iPhone photos`}…`);
    const { files: converted, failed } = await toBrowserImages(heic);
    for (const f of failed) rejected.push(f.name);
    const files = [...picked.filter(f => !isHeicFile(f)), ...converted];
    for (const file of files) {
      if (!OK_TYPES.test(file.type)) rejected.push(file.name);
      else next.push({ id: `${Date.now()}-${Math.random()}`, file, preview: URL.createObjectURL(file), name: '', status: 'ready', message: '' });
    }
    if (rejected.length) toast.error(`${rejected.length === 1 ? `"${rejected[0]}" is` : `${rejected.length} files are`} not a JPG, PNG or WebP image and ${rejected.length === 1 ? 'was' : 'were'} skipped.`);
    if (next.length) setQueue(q => [...q, ...next]);
  };

  const patch = (id, change) => setQueue(q => q.map(i => (i.id === id ? { ...i, ...change } : i)));

  const learnAll = async () => {
    if (running) return;
    setRunning(true);
    abort.current = new AbortController();
    let learned = 0;
    try {
      // one at a time: the server analyses one example at a time
      for (const item of queueRef.current.filter(i => i.status === 'ready')) {
        if (!alive.current) break;
        patch(item.id, { status: 'working', message: '' });
        try {
          const fd = new FormData();
          fd.append('image', item.file);
          if (item.name.trim()) fd.append('name', item.name.trim());
          const res = await apiFetch(`${API_BASE}/api/formats`, { method: 'POST', body: fd, signal: abort.current.signal });
          if (!res.ok) throw new Error(await readError(res));
          const body = await res.json();
          if (body.created) {
            learned += 1;
            patch(item.id, { status: 'saved', message: `${body.layout.description}` });
          } else {
            patch(item.id, { status: 'known', message: `Same structure as “${body.layout.displayName}”, so nothing new was added.` });
          }
          fetchLayouts();
        } catch (err) {
          if (err.name === 'AbortError') break;
          patch(item.id, { status: 'failed', message: err.message || 'Could not learn this layout' });
        }
      }
    } finally {
      if (alive.current) {
        setRunning(false);
        if (learned) toast.success(`${learned} new layout${learned === 1 ? '' : 's'} learned.`);
      }
    }
  };

  const clearQueue = () => {
    queue.forEach(i => URL.revokeObjectURL(i.preview));
    setQueue([]);
  };

  const rename = async (layout, name) => {
    try {
      const res = await apiFetch(`${API_BASE}/api/formats/${layout.formatId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) throw new Error(await readError(res));
      const updated = await res.json();
      setLayouts(list => list.map(l => (l.formatId === layout.formatId ? { ...l, name: updated.name, displayName: updated.displayName, status: updated.status } : l)));
      toast.success('Layout renamed.');
      return true;
    } catch (err) {
      toast.error(`Could not rename: ${err.message}`);
      return false;
    }
  };

  const remove = async layout => {
    const ok = await confirm({
      title: 'Delete this layout?',
      body: `“${layout.displayName}” will be removed from your layouts. Memes you already made are not affected.`,
      confirmLabel: 'Delete layout',
      tone: 'danger'
    });
    if (!ok) return;
    setBusyId(layout.formatId);
    try {
      const res = await apiFetch(`${API_BASE}/api/formats/${layout.formatId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));
      setLayouts(list => list.filter(l => l.formatId !== layout.formatId));
      toast.success('Layout deleted.');
    } catch (err) {
      toast.error(`Could not delete: ${err.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const unnamed = layouts.filter(l => !l.name).length;

  useShortcuts([{ keys: 'r', label: 'Refresh', when: !loading, run: () => void press('layouts-refresh') }]);

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title={
          <>
            Layouts
            {loaded && (
              <span className="tabular ml-3 inline-block -translate-y-1.5 rounded-full border-2 border-ink bg-marker px-3 py-0.5 align-middle font-mono text-[15px] font-semibold shadow-hard-sm">{layouts.length}</span>
            )}
          </>
        }
        description="The meme structures the engine knows: where the images go, the header and the reaction panel. Only the structure is saved; fonts and colours always come from Settings."
        actions={
          <Button variant="secondary" onClick={fetchLayouts} disabled={loading} leftIcon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />} data-key-action="layouts-refresh" aria-keyshortcuts="R" title="Refresh (R)">
            Refresh
          </Button>
        }
      />

      <Card className="mb-8">
        <h2 className="text-[17px] font-bold text-ink">Teach it a new layout</h2>
        <p className="mb-4 mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Add example memes from your collection. Each one is analysed once and its structure saved; an example with a structure you already have is not saved twice. New layouts also appear here on their own whenever you adapt a viral meme, and you can use them on WhatsApp (send <strong className="text-ink">Manual</strong>).
        </p>
        <DropZone onFiles={addFiles} disabled={running} />
        {queue.length > 0 && <Queue items={queue} setItems={setQueue} running={running} onStart={learnAll} onClear={clearQueue} />}
      </Card>

      {unnamed > 0 && loaded && (
        <Alert tone="info" className="mb-5" compact>
          {unnamed} layout{unnamed === 1 ? ' was' : 's were'} learned automatically and {unnamed === 1 ? 'has' : 'have'} no name yet. Click the pencil on a card to name {unnamed === 1 ? 'it' : 'them'}.
        </Alert>
      )}

      {error && !loaded ? (
        <EmptyState
          tone="bad"
          icon={ImageOff}
          title="Layouts could not load"
          action={
            <Button variant="dark" onClick={fetchLayouts} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Try again
            </Button>
          }
        >
          {error}
        </EmptyState>
      ) : !loaded && loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading layouts">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
              <Skeleton className="aspect-[4/3] w-full !rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : layouts.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="No layouts yet">
          Drop an example meme above, or adapt a viral meme and its layout is saved here automatically.
        </EmptyState>
      ) : (
        <div className={cn('stagger grid gap-5 sm:grid-cols-2 lg:grid-cols-3', loading && 'opacity-70')} aria-busy={loading}>
          {layouts.map((l, i) => (
            <LayoutCard key={l.formatId} layout={l} index={i} busy={busyId === l.formatId} onRename={rename} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
