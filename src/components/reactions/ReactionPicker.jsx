import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Smile } from 'lucide-react';
import { Button, Chips, Dialog, Input, Skeleton, cn, useToast } from '../../ui';
import { folderLabel, listReactionFolders, listReactions, reactionAsFile } from '../../lib/reactionLibrary';
import ReactionTile from './ReactionTile';

/** The whole library in a dialog: search, folder chips, tap a picture to use it. */
function BrowseDialog({ open, onClose, onChoose, pickingId }) {
  const [folders, setFolders] = useState([]);
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [list, setList] = useState({ items: [], total: 0, loaded: false });
  const [more, setMore] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return;
    setFolder('all');
    setSearch('');
    setQuery('');
    listReactionFolders().then(f => setFolders(f.categories), () => {});
  }, [open]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const my = ++seq.current;
    setList(l => ({ ...l, loaded: false }));
    listReactions({ category: folder, search: query, limit: 48 })
      .then(r => my === seq.current && setList({ items: r.items, total: r.total, loaded: true }))
      .catch(() => my === seq.current && setList({ items: [], total: 0, loaded: true }));
  }, [open, folder, query]);

  const loadMore = async () => {
    setMore(true);
    try {
      const r = await listReactions({ category: folder, search: query, limit: 48, skip: list.items.length }, { ttl: 0 });
      setList(l => ({ items: [...l.items, ...r.items.filter(i => !l.items.some(x => x.imageId === i.imageId))], total: r.total, loaded: true }));
    } finally {
      setMore(false);
    }
  };

  const options = useMemo(() => [{ value: 'all', label: 'All' }, ...folders.map(c => ({ value: c.category, label: folderLabel(c.category), count: c.count }))], [folders]);

  return (
    <Dialog open={open} onClose={onClose} title="Choose a reaction" description="Tap a picture to use it as the reaction image." size="xl" icon={Smile}>
      <div className="space-y-4">
        <label className="relative block">
          <span className="sr-only">Search reactions</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by folder, name or tag" className="!pl-10" type="search" autoComplete="off" data-autofocus />
        </label>
        <Chips value={folder} onChange={setFolder} options={options} label="Folders" scroll size="sm" />
        {!list.loaded ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] !rounded-md" />
            ))}
          </div>
        ) : list.items.length === 0 ? (
          <p className="py-10 text-center text-[14px] text-muted">{query ? `Nothing matches “${query}”.` : 'This folder is empty.'}</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
            {list.items.map((m, i) => (
              <ReactionTile key={m.imageId} image={m} priority={i < 8} showFolder={folder === 'all'} busy={pickingId === m.imageId} onClick={() => onChoose(m)} />
            ))}
          </div>
        )}
        {list.loaded && list.items.length < list.total && (
          <div className="flex justify-center pt-1">
            <Button variant="secondary" onClick={loadMore} loading={more}>
              Load more ({list.total - list.items.length} left)
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/**
 * "From your library": under a reaction slot, a row of the pictures you used last (or added last) that a tap puts in the
 * slot, and a button for the whole library. onPick({ file, image }) receives a File like one dropped in by hand.
 */
export default function ReactionPicker({ onPick, disabled, className }) {
  const toast = useToast();
  const [state, setState] = useState({ loaded: false, total: 0, items: [], recent: false });
  const [browsing, setBrowsing] = useState(false);
  const [pickingId, setPickingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [folders, used] = await Promise.all([listReactionFolders(), listReactions({ sort: 'recent', limit: 10 })]);
      const items = used.items.length ? used.items : (await listReactions({ limit: 10 })).items;
      setState({ loaded: true, total: folders.total, items, recent: used.items.length > 0 });
    } catch {
      setState(s => ({ ...s, loaded: true }));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const choose = async image => {
    if (pickingId) return;
    setPickingId(image.imageId);
    try {
      const file = await reactionAsFile(image);
      onPick({ file, image });
      setBrowsing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPickingId(null);
    }
  };

  if (state.loaded && state.total === 0) {
    return (
      <p className={cn('mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted', className)}>
        <Smile className="h-4 w-4 shrink-0" aria-hidden="true" />
        Keep your reaction pictures in one place and pick one in a tap.
        <Link to="/reactions" className="inline-flex min-h-8 items-center gap-1 font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
          Set up your library <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </p>
    );
  }

  return (
    <div className={cn('mt-4 rounded-md border border-line bg-paper p-3', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 font-mono text-micro uppercase text-muted">
          <Smile className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> <span className="truncate">{state.recent ? 'Your recent reactions' : 'From your library'}</span>
        </p>
        <Button variant="secondary" size="sm" className="shrink-0" onClick={() => setBrowsing(true)} disabled={disabled || !state.total}>
          Browse all{state.total ? ` ${state.total}` : ''}
        </Button>
      </div>
      {!state.loaded ? (
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[84px] w-28 shrink-0 !rounded-md" />
          ))}
        </div>
      ) : (
        <ul className="no-scrollbar -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1" aria-label="Recent reactions">
          {state.items.map(m => (
            <li key={m.imageId} className="w-28 shrink-0">
              <ReactionTile image={m} busy={disabled || pickingId === m.imageId} onClick={() => choose(m)} />
            </li>
          ))}
        </ul>
      )}
      <BrowseDialog open={browsing} onClose={() => setBrowsing(false)} onChoose={choose} pickingId={pickingId} />
    </div>
  );
}
