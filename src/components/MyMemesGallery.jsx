import React, { useState, useEffect } from 'react';
import {
  Download,
  History,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  Calendar,
  Image as ImageIcon,
  Trash2,
  GitBranch,
  Layers
} from 'lucide-react';

export default function MyMemesGallery({ onSelectMeme }) {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  // Delete modal state
  const [deletingId, setDeletingId] = useState(null);

  const fetchMemes = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (typeFilter !== 'all') params.append('type', typeFilter);
      params.append('sort', sortOrder);

      const res = await fetch(`http://localhost:3000/api/memes?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch memes from database');
      const data = await res.json();
      setMemes(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMemes();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, typeFilter, sortOrder]);

  const handleDelete = async (memeId) => {
    if (!window.confirm('Are you sure you want to delete this meme? Generated outputs across all versions will be safely removed.')) {
      return;
    }

    try {
      setDeletingId(memeId);
      const res = await fetch(`http://localhost:3000/api/memes/${memeId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete meme');
      setMemes(prev => prev.filter(m => (m.memeId || m.id) !== memeId));
    } catch (err) {
      alert('Delete error: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              My Memes Studio ({memes.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              MongoDB Persisted Records • Multi-Version History • Search & Filters
            </p>
          </div>

          <button
            onClick={fetchMemes}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Search, Filter, Sort Row */}
        <div className="grid sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topic, headline, or Telugu punchline..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-9 pr-4 py-2 text-xs text-white outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="all">All Meme Types</option>
              <option value="facts_collage">Facts / Collage</option>
              <option value="comparison">Comparison</option>
              <option value="trending_news">Trending News</option>
              <option value="movie_update">Movie Update</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Querying MongoDB database...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center text-rose-400 text-sm">
          {error}
        </div>
      ) : memes.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <ImageIcon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white mb-1">No memes matched your criteria</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try adjusting your search query or clear the filter to see all saved records.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {memes.map((m) => {
            const memeId = m.memeId || m.id;
            const versionCount = m.versions?.length || 1;
            return (
              <div
                key={memeId}
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:border-slate-700 transition-all group"
              >
                {/* Preview Thumbnail */}
                <div
                  onClick={() => onSelectMeme(m)}
                  className="relative aspect-[4/5] bg-black flex items-center justify-center cursor-pointer overflow-hidden"
                >
                  <img
                    src={`http://localhost:3000${m.outputUrls?.png || m.outputUrls?.jpeg}`}
                    alt={m.content?.topic}
                    className="w-full h-full object-contain group-hover:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="bg-slate-950/90 text-amber-300 border border-slate-800 text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase">
                      {m.layout?.memeType?.replace('_', ' ')}
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <GitBranch className="w-2.5 h-2.5" />
                      v{m.currentVersion || 1}
                    </span>
                  </div>

                  {versionCount > 1 && (
                    <span className="absolute bottom-3 right-3 bg-slate-950/90 text-slate-300 border border-slate-800 text-[10px] px-2 py-0.5 rounded">
                      {versionCount} revisions
                    </span>
                  )}
                </div>

                {/* Card Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm line-clamp-1 mb-1">
                      {m.content?.headline || m.content?.topic || 'Telugu Meme'}
                    </h4>
                    <p className="text-xs text-amber-300/90 font-medium line-clamp-2 mb-2 font-mono">
                      {m.content?.punchline}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`http://localhost:3000/api/memes/${memeId}/download/png`}
                        download={`meme_${memeId.substring(0, 8)}.png`}
                        className="p-1.5 bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-300 rounded-lg transition-all"
                        title="Download PNG"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleDelete(memeId)}
                        disabled={deletingId === memeId}
                        className="p-1.5 bg-slate-800 hover:bg-rose-500 text-slate-400 hover:text-white rounded-lg transition-all"
                        title="Delete Meme"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onSelectMeme(m)}
                        className="px-2.5 py-1 bg-amber-400/10 hover:bg-amber-400 hover:text-slate-950 text-amber-300 rounded-lg text-xs font-semibold border border-amber-400/20 transition-all flex items-center gap-1"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
