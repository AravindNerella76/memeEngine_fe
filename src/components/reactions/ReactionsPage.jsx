import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderUp, ImagePlus, Search, Smile, Trash2, WifiOff, X } from 'lucide-react';
import { Badge, Button, Chips, Dialog, EmptyState, Field, Input, PageHeader, Skeleton, cn, useAvailability, useConfirm, useDocumentTitle, useToast } from '../../ui';
import { bulkReactions, folderLabel, listReactionFolders, listReactions, refreshReactions } from '../../lib/reactionLibrary';
import ReactionTile from './ReactionTile';
import AddPicturesDialog from './AddPicturesDialog';
import { focusedGridItem, moveInGrid } from '../../lib/gridNav';
import { feedback, focusField, press, useShortcuts } from '../../app/shortcuts';
import ReactionDetailDialog from './ReactionDetailDialog';

const PAGE = 48;

/** Move the chosen pictures to a folder (existing or new). */
function MoveDialog({ open, count, folders, onClose, onMove }) {
  const listId = useId();
  const [folder, setFolder] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setFolder('');
      setBusy(false);
    }
  }, [open]);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Move ${count} picture${count === 1 ? '' : 's'}`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!folder.trim() || busy}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onMove(folder);
              setBusy(false);
            }}
          >
            Move
          </Button>
        </div>
      }
    >
      <Field label="To folder" hint="Pick one you have, or type a new name.">
        {({ id }) => (
          <>
            <Input id={id} list={listId} value={folder} onChange={e => setFolder(e.target.value)} maxLength={40} autoComplete="off" data-autofocus />
            <datalist id={listId}>
              {folders.map(f => (
                <option key={f.category} value={f.category} />
              ))}
            </datalist>
          </>
        )}
      </Field>
    </Dialog>
  );
}

/**
 * The reaction library: your reaction pictures, filed by situation / emotion / subject. Browse a folder, search by
 * tag, add pictures or whole folders, tidy up, and send one straight into a new meme.
 */
export default function ReactionsPage() {
  useDocumentTitle('Reactions');
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const net = useAvailability();

  const [folders, setFolders] = useState({ categories: [], total: 0, loaded: false });
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState({ items: [], total: 0, loaded: false });
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [adding, setAdding] = useState(null); // null, 'files' or 'folders': which way the Add dialog opens
  const [moving, setMoving] = useState(false);
  const [detail, setDetail] = useState(null);
  const seq = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const reloadFolders = useCallback(async (fresh = false) => {
    try {
      const f = await listReactionFolders({ ttl: fresh ? 0 : 10_000 });
      setFolders({ ...f, loaded: true });
      // a folder that no longer exists (everything moved out) falls back to All
      setFolder(cur => (cur === 'all' || f.categories.some(c => c.category === cur) ? cur : 'all'));
    } catch {
      setFolders(f => ({ ...f, loaded: true }));
    }
  }, []);

  const load = useCallback(
    async (fresh = false) => {
      const my = ++seq.current;
      setError(null);
      try {
        const r = await listReactions({ category: folder, search: query, limit: PAGE, skip: 0 }, { ttl: fresh ? 0 : 10_000 });
        if (my !== seq.current) return;
        setList({ items: r.items, total: r.total, loaded: true });
      } catch (err) {
        if (my !== seq.current) return;
        setError(err.message);
        setList(l => ({ ...l, loaded: true }));
      }
    },
    [folder, query]
  );

  useEffect(() => {
    reloadFolders();
  }, [reloadFolders]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => setPicked(new Set()), [folder, query]);

  // when the connection comes back, refresh by itself
  useEffect(() => {
    const again = () => {
      reloadFolders(true);
      load(true);
    };
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [load, reloadFolders]);

  const hasMore = list.items.length < list.total;
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const r = await listReactions({ category: folder, search: query, limit: PAGE, skip: list.items.length }, { ttl: 0 });
      setList(l => {
        const seen = new Set(l.items.map(i => i.imageId));
        return { items: [...l.items, ...r.items.filter(i => !seen.has(i.imageId))], total: r.total, loaded: true };
      });
    } catch (err) {
      toast.error(`Could not load more: ${err.message}`);
    } finally {
      setLoadingMore(false);
    }
  };

  const sentinel = useRef(null);
  useEffect(() => {
    if (!hasMore || !sentinel.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(e => e[0].isIntersecting && loadMore(), { rootMargin: '700px 0px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, list.items.length, folder, query]);

  const everything = () => {
    refreshReactions();
    reloadFolders(true);
    load(true);
  };

  const folderOptions = useMemo(
    () => [{ value: 'all', label: 'All', count: folders.total }, ...folders.categories.map(c => ({ value: c.category, label: folderLabel(c.category), count: c.count }))],
    [folders]
  );

  const toggle = id => setPicked(p => (p.has(id) ? new Set([...p].filter(x => x !== id)) : new Set([...p, id])));
  const ids = [...picked];

  const removePicked = async () => {
    const yes = await confirm({
      title: `Remove ${ids.length} picture${ids.length === 1 ? '' : 's'}?`,
      body: 'They are removed from the library. Memes you already made with them are not affected.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep them',
      tone: 'danger'
    });
    if (!yes) return;
    try {
      await bulkReactions('delete', ids);
      toast.success(`Removed ${ids.length}.`);
      setPicked(new Set());
      everything();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const movePicked = async to => {
    try {
      const r = await bulkReactions('move', ids, to);
      toast.success(`Moved ${r.changed} to “${to.trim().toLowerCase()}”.`);
      setMoving(false);
      setPicked(new Set());
      everything();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const useInMeme = image => {
    setDetail(null);
    navigate('/', { state: { reactionId: image.imageId } });
  };

  const empty = list.loaded && folders.loaded && folders.total === 0 && !query;
  const showSkeleton = !list.loaded && !error;
  const selecting = picked.size > 0;

  // Keyboard: the same moves as My Memes; X ticks the picture in focus, Esc lets go of the selection
  const gridRef = useRef(null);
  const searchRef = useRef(null);
  const hasTiles = list.items.length > 0;
  const move = dir => e => (/^Arrow/.test(e.key) && !focusedGridItem(gridRef.current) ? false : void moveInGrid(gridRef.current, dir, { instant: e.repeat }));
  useShortcuts([
    { keys: '/', label: 'Search reactions', run: () => void focusField(searchRef.current) },
    { keys: ['j', 'right'], label: 'Next picture', repeat: true, when: hasTiles, run: move('next') },
    { keys: ['k', 'left'], label: 'Previous picture', repeat: true, when: hasTiles, run: move('prev') },
    { keys: 'down', label: 'Picture below', repeat: true, when: hasTiles, run: move('down') },
    { keys: 'up', label: 'Picture above', repeat: true, when: hasTiles, run: move('up') },
    { keys: 'enter', label: 'Open the picture in focus', when: hasTiles, run: () => false }, // the tile's own button does it
    {
      keys: 'x',
      label: 'Select the picture in focus',
      when: hasTiles,
      run: () => {
        const box = focusedGridItem(gridRef.current)?.querySelector('[role="checkbox"]');
        if (!box) return false;
        feedback(box, 'press');
        box.click();
      }
    },
    { keys: 'escape', label: 'Clear the selection', when: selecting, run: () => setPicked(new Set()) },
    { keys: 'a', label: 'Add pictures', when: net.ok, run: () => void press('reactions-add') }
  ]);

  return (
    <div className={cn(selecting && 'pb-24')}>
      <PageHeader
        eyebrow="Library"
        title={
          <>
            Your <span className="marker-underline px-1">reactions</span>
            {folders.loaded && folders.total > 0 && (
              <Badge tone="marker" mono className="ml-3 -translate-y-1.5 -rotate-2 align-middle shadow-hard-sm">
                {folders.total}
              </Badge>
            )}
          </>
        }
        description="The pictures you use again and again, filed by situation and emotion. Pick one in a tap while you make a meme."
        actions={
          <>
            <Button variant="secondary" onClick={() => setAdding('folders')} leftIcon={<FolderUp className="h-4 w-4" />} disabled={!net.ok} title={net.ok ? undefined : net.reason}>
              Import folders
            </Button>
            <Button variant="primary" onClick={() => setAdding('files')} leftIcon={<ImagePlus className="h-4 w-4" />} disabled={!net.ok} title={net.ok ? 'Add pictures (A)' : net.reason} data-key-action="reactions-add" aria-keyshortcuts="A">
              Add pictures
            </Button>
          </>
        }
      />

      {empty ? (
        <EmptyState
          icon={Smile}
          title="Your reaction library is empty"
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="primary" onClick={() => setAdding('folders')} leftIcon={<FolderUp className="h-4 w-4" />} disabled={!net.ok}>
                Import my folders
              </Button>
            </div>
          }
        >
          Import the folders you already keep your reaction pictures in (Shocking, Sad, Praise…). Each folder stays a folder here, and from then on a reaction is one tap away in every meme.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 space-y-4">
            <label className="relative block">
              <span className="sr-only">Search reactions</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by folder, name or tag (e.g. brahmanandam)" className="!pl-10" type="search" autoComplete="off" aria-keyshortcuts="/" />
            </label>
            {folders.loaded ? <Chips value={folder} onChange={setFolder} options={folderOptions} label="Folders" scroll /> : <Skeleton className="h-9 w-2/3" />}
          </div>

          {error && (
            <p className="mb-4 flex items-center gap-2 rounded-md border border-line bg-surface px-3.5 py-2 text-[13px] text-muted" role="status">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" /> Could not load the library just now.
              <button type="button" onClick={() => load(true)} className="ml-auto font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2">
                Retry
              </button>
            </p>
          )}

          {showSkeleton ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3.5">
              {Array.from({ length: 12 }, (_, i) => (
                <Skeleton key={i} className="aspect-[4/3] !rounded-md" />
              ))}
            </div>
          ) : list.items.length === 0 ? (
            <EmptyState icon={Search} tone="ink" title="Nothing here" action={query || folder !== 'all' ? <Button variant="secondary" onClick={() => (setSearch(''), setFolder('all'))}>Show everything</Button> : undefined}>
              {query ? `No picture matches “${query}”.` : 'This folder is empty.'}
            </EmptyState>
          ) : (
            <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3.5">
              {list.items.map((m, i) => (
                <ReactionTile data-grid-item key={m.imageId} image={m} priority={i < 8} showFolder={folder === 'all'} selected={picked.has(m.imageId)} selecting={selecting} onSelect={() => toggle(m.imageId)} onClick={() => (selecting ? toggle(m.imageId) : setDetail(m))} />
              ))}
            </div>
          )}

          <div ref={sentinel} className="mt-8 flex flex-col items-center gap-3 pb-2" aria-live="polite">
            {list.loaded && list.total > 0 && (
              <p className="tabular font-mono text-[12px] text-muted">
                {list.items.length} of {list.total}
              </p>
            )}
            {hasMore && (
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                Load more
              </Button>
            )}
          </div>
        </>
      )}

      {selecting && (
        <div className="safe-bottom fixed inset-x-3 bottom-[84px] z-30 mx-auto flex max-w-xl flex-wrap items-center gap-2.5 rounded-lg border-2 border-ink bg-surface p-2.5 shadow-hard md:bottom-6 md:left-[calc(252px+1.5rem)] md:right-6 md:mx-0 md:max-w-none" role="region" aria-label="Selected pictures">
          <span className="px-2 text-[14px] font-bold">{picked.size} selected</span>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => setMoving(true)} disabled={!net.ok}>
            Move to folder…
          </Button>
          <Button variant="danger-soft" size="sm" onClick={removePicked} leftIcon={<Trash2 className="h-3.5 w-3.5" />} disabled={!net.ok}>
            Remove
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setPicked(new Set())} aria-label="Clear selection" title="Clear selection (Esc)" aria-keyshortcuts="Escape">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AddPicturesDialog open={Boolean(adding)} startMode={adding || 'files'} onClose={() => setAdding(null)} folders={folders.categories} defaultFolder={folder} onDone={everything} />
      <MoveDialog open={moving} count={picked.size} folders={folders.categories} onClose={() => setMoving(false)} onMove={movePicked} />
      {detail && (
        <ReactionDetailDialog
          image={detail}
          folders={folders.categories}
          onClose={() => setDetail(null)}
          onUse={useInMeme}
          onChanged={next => {
            setDetail(next);
            if (!next) setDetail(null);
            everything();
          }}
        />
      )}
    </div>
  );
}
