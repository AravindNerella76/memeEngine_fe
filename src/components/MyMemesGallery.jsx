import React, { Suspense, lazy, startTransition, useCallback, useEffect, useRef, useState } from 'react';
import { Download, GitBranch, ImageOff, Info, Instagram, LayoutGrid, Plus, RefreshCw, Search, Trash2, WifiOff, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { API_BASE, apiFetch } from '../api';
import { HttpError, cachedJSON, invalidate, warm } from '../lib/queryCache';
import { memeListPath } from '../lib/memeList';
import { Badge, Button, Chips, EmptyState, PageHeader, Select, Skeleton, cn, friendlyDate, useConfirm, useDocumentTitle, useToast } from '../ui';

// only needed when someone opens a meme's details: not part of the gallery's own download
const GenerationDetailsModal = lazy(() => import('./GenerationDetailsModal'));

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'facts_collage', label: 'Facts' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'trending_news', label: 'News' },
  { value: 'movie_update', label: 'Movie' },
  { value: 'custom', label: 'Custom' }
];

const humanize = s => (s ? String(s).replace(/_/g, ' ') : 'meme');
const idOf = m => m.memeId || m.id;

// What the grid last showed for each combination of search / type / sort. Coming back to the gallery (Back button,
// the sidebar) shows it at once and refreshes quietly, instead of an empty page and a spinner.
const listCache = new Map();
const rememberList = (key, value) => {
  listCache.delete(key);
  listCache.set(key, value);
  while (listCache.size > 8) listCache.delete(listCache.keys().next().value);
};

/**
 * One page of memes. Uses the lightweight paged endpoint; an older backend without it still works (the whole
 * list is fetched once and shown in full, with full-size images).
 */
async function fetchPage({ search, type, sort, skip, force }) {
  // Goes through the shared request cache: the route registry may already have asked for the first page while this code
  // was downloading (that answer is reused, or joined if still in flight), and `force` (a refresh button) skips it.
  const ttl = force ? 0 : 4_000;
  try {
    return { ...(await cachedJSON(memeListPath({ search, type, sort, skip }), { ttl })), thumbs: true };
  } catch (err) {
    if (!(err instanceof HttpError) || (err.status !== 400 && err.status !== 404)) throw new Error('Failed to fetch memes from database');
  }
  // an older backend without the paged list: fetch everything once and show it in full
  const legacy = new URLSearchParams({ sort });
  if (search) legacy.set('search', search);
  if (type !== 'all') legacy.set('type', type);
  try {
    const items = await cachedJSON(`/api/memes?${legacy}`, { ttl });
    return { items, total: items.length, hasMore: false, thumbs: false };
  } catch {
    throw new Error('Failed to fetch memes from database');
  }
}

/** Thumbnail that fades in once loaded, so the grid never pops. Falls back to the full image if the thumbnail fails. */
function Thumb({ src, srcSet, sizes, fallback, alt, priority }) {
  const [state, setState] = useState('loading');
  const [useFallback, setUseFallback] = useState(false);
  return state === 'error' ? (
    <div className="grid h-full w-full place-items-center text-paper/50">
      <ImageOff className="h-7 w-7" aria-hidden="true" />
    </div>
  ) : (
    <img
      src={useFallback ? fallback : src}
      srcSet={useFallback ? undefined : srcSet}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : 'low'} // the first row first; the rest queue behind it instead of sharing the connection equally
      decoding="async"
      onLoad={() => setState('ready')}
      onError={() => (fallback && !useFallback ? setUseFallback(true) : setState('error'))}
      className={cn('h-full w-full object-contain transition-[opacity,transform] duration-500 group-hover:scale-[1.03]', state === 'ready' ? 'opacity-100' : 'opacity-0')}
    />
  );
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <Skeleton className="aspect-[4/5] w-full !rounded-none" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export default function MyMemesGallery({ onSelectMeme }) {
  useDocumentTitle('My Memes');
  const toast = useToast();
  const confirm = useConfirm();
  const [params] = useSearchParams();

  // Filters & search (a search can arrive in the address, e.g. from the Ctrl+K palette)
  const [search, setSearch] = useState(() => params.get('q') || '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');
  const [debounced, setDebounced] = useState(search.trim());
  useEffect(() => {
    const q = params.get('q');
    if (q !== null) setSearch(q);
  }, [params]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const key = `${sortOrder}|${typeFilter}|${debounced.toLowerCase()}`;
  const [list, setList] = useState(() => listCache.get(key) || { items: [], total: 0, thumbs: true, loaded: false });
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const ctrl = useRef(null);
  const listRef = useRef(list);
  listRef.current = list;

  // (re)load the first page whenever the filters change; show what we already know straight away
  const load = useCallback(
    async ({ quiet } = {}) => {
      // refresh buttons ask for fresh data; the automatic loads (opening, filters, reconnecting) may use a very recent answer
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setRefreshing(true);
      setError(null);
      try {
        const fresh = await fetchPage({ search: debounced, type: typeFilter, sort: sortOrder, skip: 0, force: !quiet });
        if (c.signal.aborted) return;
        // a transition: drawing a full page of cards is slotted between frames, so typing, scrolling and clicks never wait for it
        startTransition(() =>
          setList(prev => {
            // same first page as before: keep everything already loaded (and the scroll position) as it is
            const same = prev.loaded && fresh.items.length > 0 && fresh.items.every((m, i) => prev.items[i] && idOf(prev.items[i]) === idOf(m) && prev.items[i].currentVersion === m.currentVersion);
            return { items: same ? prev.items : fresh.items, total: fresh.total, thumbs: fresh.thumbs, loaded: true };
          })
        );
      } catch (err) {
        if (c.signal.aborted || err.name === 'AbortError') return;
        console.error('Fetch error:', err);
        if (!quiet || !listRef.current.loaded) setError(err.message);
      } finally {
        if (ctrl.current === c) setRefreshing(false);
      }
    },
    [debounced, typeFilter, sortOrder]
  );

  useEffect(() => {
    setList(listCache.get(key) || { items: [], total: 0, thumbs: true, loaded: false });
    load({ quiet: true });
    return () => ctrl.current?.abort();
  }, [key, load]);

  useEffect(() => {
    if (list.loaded) rememberList(key, list);
  }, [key, list]);

  // when the connection comes back, refresh by itself (and clear a "could not load" state)
  useEffect(() => {
    const refresh = () => load({ quiet: true });
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [load]);

  const hasMore = list.loaded && list.items.length < list.total;

  const loadMore = useCallback(async () => {
    const cur = listRef.current;
    if (loadingMore || cur.items.length >= cur.total) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage({ search: debounced, type: typeFilter, sort: sortOrder, skip: cur.items.length });
      startTransition(() =>
        setList(prev => {
          const seen = new Set(prev.items.map(idOf));
          return { ...prev, items: [...prev.items, ...page.items.filter(m => !seen.has(idOf(m)))], total: page.total };
        })
      );
    } catch (err) {
      toast.error(`Could not load more memes: ${err.message}`);
    } finally {
      setLoadingMore(false);
    }
  }, [debounced, typeFilter, sortOrder, loadingMore, toast]);

  // keep loading as the person nears the end of the grid
  const sentinel = useRef(null);
  useEffect(() => {
    if (!hasMore || !sentinel.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(entries => entries[0].isIntersecting && loadMore(), { rootMargin: '900px 0px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [hasMore, list.items.length, loadMore]);

  const thumbUrl = (m, w) => `${API_BASE}/api/memes/${idOf(m)}/thumb?v=${m.currentVersion || 1}&w=${w}`;
  const fullUrl = m => `${API_BASE}${m.outputUrls?.jpeg || m.outputUrls?.png}`;

  const handleDelete = async (m, index) => {
    const memeId = idOf(m);
    const title = m.content?.headline || m.content?.topic || 'this meme';
    const versions = m.versionCount || m.versions?.length || 1;
    const ok = await confirm({
      title: 'Delete this meme?',
      body: `“${title}” and ${versions === 1 ? 'its only version' : `all ${versions} of its versions`} will be removed for good. This can't be undone.`,
      confirmLabel: 'Delete meme',
      tone: 'danger',
      preview: (
        <div className="mx-auto aspect-[4/5] w-28 overflow-hidden rounded border-2 border-ink bg-ink shadow-hard-sm">
          <img src={list.thumbs ? thumbUrl(m, 240) : fullUrl(m)} alt="" className="h-full w-full object-contain" />
        </div>
      )
    });
    if (!ok) return;

    // optimistic: it disappears at once; if the server refuses it comes back where it was
    setDeletingId(memeId);
    setList(prev => ({ ...prev, items: prev.items.filter(x => idOf(x) !== memeId), total: Math.max(0, prev.total - 1) }));
    try {
      const res = await apiFetch(`${API_BASE}/api/memes/${memeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete meme');
      invalidate(`${API_BASE}/api/memes`); // cached lists and details still mention it
      toast.success('Meme deleted.');
    } catch (err) {
      setList(prev => {
        const items = [...prev.items];
        items.splice(Math.min(index, items.length), 0, m);
        return { ...prev, items, total: prev.total + 1 };
      });
      toast.error(`Could not delete the meme: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = Boolean(debounced) || typeFilter !== 'all';
  const offline = error && /fetch|network|load failed/i.test(error);
  const showSkeleton = !list.loaded && !error;

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title={
          <>
            My memes
            {list.loaded && (
              <span className="tabular ml-3 inline-block -translate-y-1.5 rounded-full border-2 border-ink bg-marker px-3 py-0.5 align-middle font-mono text-[15px] font-semibold shadow-hard-sm">
                {list.total}
              </span>
            )}
          </>
        }
        description="Everything you have made, with every version. Open a meme to review it, change it, or publish it to Instagram."
        actions={
          <>
            <Button variant="secondary" onClick={() => load()} disabled={refreshing} leftIcon={<RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />}>
              Refresh
            </Button>
            <Button as={Link} to="/" variant="primary" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.6} />}>
              New meme
            </Button>
          </>
        }
      />

      {/* Search, filter, sort */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search topic, headline or Telugu punchline"
              aria-label="Search memes"
              className="field !pl-10 !pr-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-muted hover:bg-ink/10 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={sortOrder} onChange={e => setSortOrder(e.target.value)} aria-label="Sort order" className="sm:w-48">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </Select>
        </div>
        <Chips scroll label="Filter by meme type" value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} />
      </div>

      {error && !list.loaded ? (
        <EmptyState
          tone="bad"
          icon={offline ? WifiOff : ImageOff}
          title={offline ? "Can't reach the engine" : 'The gallery could not load'}
          action={
            <Button variant="dark" onClick={() => load()} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Try again
            </Button>
          }
        >
          {offline ? 'Is the backend running? Start it with npm start in memeEngine_be.' : error}
        </EmptyState>
      ) : showSkeleton ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="Loading your memes">
          {Array.from({ length: 8 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : list.items.length === 0 ? (
        <EmptyState
          icon={filtered ? Search : LayoutGrid}
          title={filtered ? 'No memes match' : 'Nothing on the wall yet'}
          action={
            filtered ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('all');
                }}
              >
                Clear search and filters
              </Button>
            ) : (
              <Button as={Link} to="/" variant="primary" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.6} />}>
                Make your first meme
              </Button>
            )
          }
        >
          {filtered ? 'Try another word, or set the filter back to All.' : 'Memes you make in Viral Adaptation, over WhatsApp or in Create Meme land here, with every version.'}
        </EmptyState>
      ) : (
        <>
          {error && (
            <p className="mb-4 flex items-center gap-2 rounded-md border border-line bg-surface px-3.5 py-2 text-[13px] text-muted" role="status">
              <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" /> Could not refresh just now, so this is what was loaded before.
              <button type="button" onClick={() => load()} className="ml-auto font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2">
                Retry
              </button>
            </p>
          )}
          <div className={cn('grid gap-5 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4', refreshing && !loadingMore && 'opacity-80')}>
            {list.items.map((m, idx) => {
              const memeId = idOf(m);
              const versionCount = m.versionCount || m.versions?.length || 1;
              const title = m.content?.headline || m.content?.topic || 'Telugu meme';
              const published = m.instagramPublish?.status === 'published';
              const open = () => onSelectMeme(m);
              const prefetch = () => warm(`/api/memes/${memeId}`);
              return (
                <article
                  key={memeId}
                  style={idx < 24 ? { '--i': Math.min(idx, 10) } : undefined}
                  className={cn(
                    // content-visibility: cards far off screen cost nothing to lay out or paint, however long the library grows
                    'group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft transition-all duration-200 [contain-intrinsic-size:auto_440px] [content-visibility:auto] hover:-translate-y-1 hover:border-ink hover:shadow-hard',
                    idx < 24 && 'animate-fade-up',
                    deletingId === memeId && 'pointer-events-none opacity-50'
                  )}
                  onPointerEnter={prefetch}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-ink">
                    <button type="button" onClick={open} onFocus={prefetch} aria-label={`Open ${title}`} className="block h-full w-full">
                      <Thumb
                        src={list.thumbs ? thumbUrl(m, 480) : fullUrl(m)}
                        srcSet={list.thumbs ? `${thumbUrl(m, 360)} 360w, ${thumbUrl(m, 480)} 480w, ${thumbUrl(m, 720)} 720w` : undefined}
                        sizes="(min-width: 1536px) 22vw, (min-width: 1024px) 28vw, (min-width: 640px) 44vw, 92vw"
                        fallback={fullUrl(m)}
                        alt={m.content?.topic || title}
                        priority={idx < 4}
                      />
                    </button>

                    <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                      <Badge tone="outline" size="sm" className="border-ink/80 bg-surface capitalize text-ink">
                        {humanize(m.layout?.memeType)}
                      </Badge>
                      <Badge tone="ink" size="sm" mono icon={GitBranch}>
                        v{m.currentVersion || 1}
                      </Badge>
                    </div>
                    {published && (
                      <span className="pointer-events-none absolute right-3 top-3 inline-flex h-6 items-center gap-1 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 px-2 text-[11px] font-bold text-white shadow" title="Published to Instagram">
                        <Instagram className="h-3 w-3" aria-hidden="true" /> Live
                      </span>
                    )}

                    {/* quick actions: appear on hover or keyboard focus, always visible on touch screens */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-ink/70 via-ink/25 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <Button
                        as="a"
                        variant="secondary"
                        size="icon-sm"
                        className="pointer-events-auto"
                        href={`${API_BASE}/api/memes/${memeId}/download/png`}
                        download={`meme_${memeId.substring(0, 8)}.png`}
                        title="Download PNG"
                        aria-label="Download PNG"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {m.pipeline === 'viral_adaptation_v2' && (
                        <Button variant="secondary" size="icon-sm" className="pointer-events-auto" onClick={() => setDetailsId(memeId)} title="Generation details: why these images were chosen" aria-label="Generation details">
                          <Info className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="danger" size="icon-sm" className="pointer-events-auto" onClick={() => handleDelete(m, idx)} disabled={deletingId === memeId} title="Delete meme" aria-label="Delete meme">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <button type="button" onClick={open} onFocus={prefetch} className="flex flex-1 flex-col gap-1.5 p-4 text-left">
                    <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-ink">{title}</h3>
                    {m.content?.punchline && <p className="telugu-text line-clamp-2 text-[13px] leading-relaxed text-muted">{m.content.punchline}</p>}
                    <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-[12px] text-muted">
                      <span>{friendlyDate(m.createdAt)}</span>
                      {versionCount > 1 && <span className="font-semibold text-ink-3">{versionCount} versions</span>}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>

          {/* more load on their own as you scroll; this button is the same thing for keyboards and for patience */}
          <div ref={sentinel} className="mt-8 flex flex-col items-center gap-3 pb-2" aria-live="polite">
            <p className="tabular font-mono text-[12px] text-muted">
              {list.items.length} of {list.total}
            </p>
            {hasMore && (
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            )}
          </div>
        </>
      )}

      {detailsId && (
        <Suspense fallback={null}>
          <GenerationDetailsModal memeId={detailsId} onClose={() => setDetailsId(null)} />
        </Suspense>
      )}
    </div>
  );
}
