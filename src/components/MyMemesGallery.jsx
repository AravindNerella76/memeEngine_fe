import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, GitBranch, ImageOff, Info, Instagram, LayoutGrid, Plus, RefreshCw, Search, Trash2, WifiOff, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import GenerationDetailsModal from './GenerationDetailsModal';
import { API_BASE, apiFetch } from '../api';
import { Badge, Button, Chips, EmptyState, PageHeader, Select, Skeleton, cn, friendlyDate, useConfirm, useDocumentTitle, useToast } from '../ui';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'facts_collage', label: 'Facts' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'trending_news', label: 'News' },
  { value: 'movie_update', label: 'Movie' },
  { value: 'custom', label: 'Custom' }
];

const humanize = s => (s ? String(s).replace(/_/g, ' ') : 'meme');

/** Thumbnail that fades in once loaded, so the grid never pops. */
function Thumb({ src, alt }) {
  const [state, setState] = useState('loading');
  return (
    <>
      {state === 'error' ? (
        <div className="grid h-full w-full place-items-center text-paper/50">
          <ImageOff className="h-7 w-7" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className={cn('h-full w-full object-contain transition-[opacity,transform] duration-500 group-hover:scale-[1.03]', state === 'ready' ? 'opacity-100' : 'opacity-0')}
        />
      )}
    </>
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

  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false); // true after the first successful load
  const [error, setError] = useState(null);

  // Filters & search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  const [deletingId, setDeletingId] = useState(null);
  const [detailsId, setDetailsId] = useState(null);
  const requestId = useRef(0);

  const fetchMemes = useCallback(async () => {
    const mine = ++requestId.current; // an older, slower response must never overwrite a newer one
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('sort', sortOrder);

      const res = await apiFetch(`${API_BASE}/api/memes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch memes from database');
      const data = await res.json();
      if (mine !== requestId.current) return;
      setMemes(data);
      setLoaded(true);
    } catch (err) {
      if (mine !== requestId.current) return;
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      if (mine === requestId.current) setLoading(false);
    }
  }, [search, typeFilter, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(fetchMemes, 250);
    return () => clearTimeout(timer);
  }, [fetchMemes]);

  const handleDelete = async m => {
    const memeId = m.memeId || m.id;
    const title = m.content?.headline || m.content?.topic || 'this meme';
    const versions = m.versions?.length || 1;
    const ok = await confirm({
      title: 'Delete this meme?',
      body: `“${title}” and ${versions === 1 ? 'its only version' : `all ${versions} of its versions`} will be removed for good. This can't be undone.`,
      confirmLabel: 'Delete meme',
      tone: 'danger',
      preview: (
        <div className="mx-auto aspect-[4/5] w-28 overflow-hidden rounded border-2 border-ink bg-ink shadow-hard-sm">
          <img src={`${API_BASE}${m.outputUrls?.png || m.outputUrls?.jpeg}`} alt="" className="h-full w-full object-contain" />
        </div>
      )
    });
    if (!ok) return;

    try {
      setDeletingId(memeId);
      const res = await apiFetch(`${API_BASE}/api/memes/${memeId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete meme');
      setMemes(prev => prev.filter(x => (x.memeId || x.id) !== memeId));
      toast.success('Meme deleted.');
    } catch (err) {
      toast.error(`Could not delete the meme: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = search.trim() || typeFilter !== 'all';
  const offline = error && /fetch|network|load failed/i.test(error);

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title={
          <>
            My memes
            {loaded && (
              <span className="tabular ml-3 inline-block -translate-y-1.5 rounded-full border-2 border-ink bg-marker px-3 py-0.5 align-middle font-mono text-[15px] font-semibold shadow-hard-sm">
                {memes.length}
              </span>
            )}
          </>
        }
        description="Everything you have made, with every version. Open a meme to review it, change it, or publish it to Instagram."
        actions={
          <>
            <Button variant="secondary" onClick={fetchMemes} disabled={loading} leftIcon={<RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />}>
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

      {error && !loaded ? (
        <EmptyState
          tone="bad"
          icon={offline ? WifiOff : ImageOff}
          title={offline ? "Can't reach the engine" : 'The gallery could not load'}
          action={
            <Button variant="dark" onClick={fetchMemes} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Try again
            </Button>
          }
        >
          {offline ? 'Is the backend running? Start it with npm start in memeEngine_be.' : error}
        </EmptyState>
      ) : !loaded && loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="Loading your memes">
          {Array.from({ length: 8 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : memes.length === 0 ? (
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
        <div className={cn('stagger grid gap-5 transition-opacity duration-200 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4', loading && 'opacity-60')} aria-busy={loading}>
          {memes.map((m, idx) => {
            const memeId = m.memeId || m.id;
            const versionCount = m.versions?.length || 1;
            const title = m.content?.headline || m.content?.topic || 'Telugu meme';
            const published = m.instagramPublish?.status === 'published';
            return (
              <article
                key={memeId}
                style={{ '--i': Math.min(idx, 10) }}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-ink hover:shadow-hard',
                  deletingId === memeId && 'pointer-events-none opacity-50'
                )}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-ink">
                  <button type="button" onClick={() => onSelectMeme(m)} aria-label={`Open ${title}`} className="block h-full w-full">
                    <Thumb src={`${API_BASE}${m.outputUrls?.png || m.outputUrls?.jpeg}`} alt={m.content?.topic || title} />
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
                    <Button variant="danger" size="icon-sm" className="pointer-events-auto" onClick={() => handleDelete(m)} disabled={deletingId === memeId} title="Delete meme" aria-label="Delete meme">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <button type="button" onClick={() => onSelectMeme(m)} className="flex flex-1 flex-col gap-1.5 p-4 text-left">
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
      )}

      {detailsId && <GenerationDetailsModal memeId={detailsId} onClose={() => setDetailsId(null)} />}
    </div>
  );
}
