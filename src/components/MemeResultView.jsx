import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle2, Download, ExternalLink, GitBranch, HelpCircle, ImageOff, Info, Instagram, RotateCcw, ShieldCheck, Wand2 } from 'lucide-react';
import GenerationDetailsModal from './GenerationDetailsModal';
import InstagramPublishModal from './InstagramPublishModal';
import { API_BASE, apiFetch } from '../api';
import { MATCH_LABEL, providerName, RightsBadge, rightsSummary, sourceTypeText } from './ImageRights';
import ReplaceImagesPanel from './imageChoice/ReplaceImagesPanel';
import { Alert, Badge, Button, Card, CardHeader, DataRow, Disclosure, EmptyState, Kbd, Skeleton, Textarea, cn, friendlyDate, useDocumentTitle } from '../ui';

/** One subject image: rights label, provider, source link (when its terms allow storing it), credit. */
function SourceRow({ asset, index }) {
  const r = asset.rights;
  const credit = r?.attributionRequired ? asset.attribution || r.attribution : null;
  return (
    <li className="space-y-1.5 rounded-md border border-line bg-paper/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink" title={asset.label || ''}>
          Image {index + 1}
          {asset.label ? <span className="font-normal text-muted"> · {asset.label}</span> : null}
        </span>
        <RightsBadge rights={r} license={asset.license} compact />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted">
        <span className={asset.selectedBy === 'user' ? 'font-semibold text-ink' : ''}>{sourceTypeText(asset)}</span>
        {(asset.provider || r?.provider) && <span>{providerName(asset.provider || r?.provider)}</span>}
        {asset.sourcePage ? (
          <a href={asset.sourcePage} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-0.5 font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
            source <ExternalLink className="h-3 w-3" />
          </a>
        ) : r && r.sourceStored === false ? (
          <span title={r.storageNote || ''}>link not stored (provider terms)</span>
        ) : null}
        {r?.attributionRequired && <span>credit{credit ? `: ${credit}` : ' required'}</span>}
        {r?.shareAlike && <span>edits share-alike</span>}
        {asset.referenceMatch && asset.referenceMatch !== 'unknown' && <span>{MATCH_LABEL[asset.referenceMatch] || asset.referenceMatch}</span>}
      </div>
    </li>
  );
}

const ARRANGEMENT_LABEL = {
  side_by_side: 'Side by side',
  columns_3: '3 columns',
  stacked_rows: 'Stacked rows',
  grid_2x2: '2 × 2 grid',
  single: 'Single image',
  custom_grid: 'Custom grid (from the reference)'
};

const humanize = s => (s ? String(s).replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()) : '-');

const SUGGESTIONS = [
  'Make the headline 20% bigger',
  'Make the Telugu text more readable',
  'Increase the reaction image height',
  'Use a different image for subject 2',
  'Make the comparison images equally sized',
  'Change headline colour to white',
  'Use Anton font'
];

function LoadingView() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" aria-busy="true" aria-label="Loading meme">
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="aspect-[4/5] w-full !rounded-lg" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-56 w-full !rounded-lg" />
        <Skeleton className="h-40 w-full !rounded-lg" />
      </div>
    </div>
  );
}

export default function MemeResultView({ meme: propMeme, onNewMeme, onMemeUpdated, backLabel: propBackLabel }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [meme, setMeme] = useState(propMeme || location.state?.meme || null);
  const [loading, setLoading] = useState(!propMeme && !location.state?.meme && Boolean(id));
  const [fetchError, setFetchError] = useState(null);

  const [instructions, setInstructions] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [activeVersionNumber, setActiveVersionNumber] = useState(propMeme?.currentVersion || location.state?.meme?.currentVersion || 1);
  const [restoring, setRestoring] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showInstagramModal, setShowInstagramModal] = useState(false);
  const [clarification, setClarification] = useState(null);

  useDocumentTitle(meme ? meme.content?.headline || meme.content?.topic || 'Meme' : 'Meme');

  useEffect(() => {
    if (!meme && id) {
      setLoading(true);
      setFetchError(null);
      apiFetch(`${API_BASE}/api/memes/${id}`)
        .then(r => (r.ok ? r.json() : Promise.reject(new Error(`Failed to load meme ${id} (status ${r.status})`))))
        .then(data => {
          setMeme(data);
          setActiveVersionNumber(data.currentVersion || 1);
        })
        .catch(err => setFetchError(err.message))
        .finally(() => setLoading(false));
    }
  }, [id, meme]);

  if (loading) return <LoadingView />;

  if (fetchError || !meme) {
    return (
      <EmptyState
        tone="bad"
        icon={ImageOff}
        title="That meme isn't here"
        className="mx-auto max-w-xl"
        action={
          <Button variant="dark" onClick={() => navigate('/memes')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to My Memes
          </Button>
        }
      >
        {fetchError || 'Could not find the requested meme. It may have been deleted.'}
      </EmptyState>
    );
  }

  const fromTab = location.state?.from;
  const backLabel = propBackLabel || (fromTab === 'history' ? 'My Memes' : fromTab === 'create' ? 'Create another' : 'Back to Viral Adaptation');

  const handleBack = () => {
    if (onNewMeme) {
      onNewMeme();
    } else if (fromTab === 'history') {
      navigate('/memes');
    } else if (fromTab === 'create') {
      navigate('/create');
    } else {
      navigate('/');
    }
  };

  const memeId = meme.memeId || meme.id;
  const versions = meme.versions || [];
  const activeVersion = versions.find(v => v.versionNumber === activeVersionNumber) || {
    outputUrls: meme.outputUrls,
    design: meme.design,
    layout: meme.layout,
    instruction: 'Current Version'
  };
  // Subject images of the version on screen (each version keeps a snapshot of its assets).
  const subjectImages = (activeVersion.assets?.subjectImages || meme.assets?.subjectImages || []).filter(Boolean);
  const showSources = subjectImages.some(a => a.rights || a.sourcePage || a.sourceUrl || a.license || a.sourceType);
  // Output format chosen in Settings when this version was made (older memes: PNG first)
  const primaryFormat = activeVersion.design?.style?.image?.primaryFormat === 'jpeg' ? 'jpeg' : 'png';
  const downloadFormats = primaryFormat === 'jpeg' ? ['jpeg', 'png'] : ['png', 'jpeg'];
  const rightsCounts = rightsSummary(subjectImages);
  const width = activeVersion.design?.width || 1080;
  const height = activeVersion.design?.height || 1350;

  const isPublishedOnInstagram = Boolean(activeVersion.instagramPublish?.status === 'published' || meme.instagramPublish?.status === 'published');
  const publishedRecord = activeVersion.instagramPublish || meme.instagramPublish;
  const viewingOld = activeVersionNumber !== meme.currentVersion;

  const handleRegenerate = async () => {
    if (!instructions.trim()) {
      setError('Please provide an instruction (e.g. "Make headline 20% bigger" or "Change text colour to yellow")');
      return;
    }

    try {
      setRegenerating(true);
      setError(null);
      setClarification(null);
      const res = await apiFetch(`${API_BASE}/api/memes/${memeId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instructions.trim() })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.clarification) {
          setClarification(errData.question || errData.message);
          return;
        }
        throw new Error(errData.message || 'Regeneration failed');
      }

      const updatedMeme = await res.json();
      setMeme(updatedMeme);
      setInstructions('');
      setActiveVersionNumber(updatedMeme.currentVersion);
      if (onMemeUpdated) onMemeUpdated(updatedMeme);
    } catch (err) {
      console.error('Regen error:', err);
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRestoreVersion = async vNum => {
    try {
      setRestoring(true);
      setError(null);
      const res = await apiFetch(`${API_BASE}/api/memes/${memeId}/restore/${vNum}`, { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to restore version');
      }
      const restored = await res.json();
      setMeme(restored);
      setActiveVersionNumber(restored.currentVersion);
      if (onMemeUpdated) onMemeUpdated(restored);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const imageSrc = `${API_BASE}${activeVersion.outputUrls?.[primaryFormat] || activeVersion.outputUrls?.png || activeVersion.outputUrls?.jpeg}`;

  return (
    <div>
      {/* Top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={handleBack} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          {backLabel}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {meme.pipeline === 'viral_adaptation_v2' && (
            <Button variant="secondary" size="sm" onClick={() => setShowDetails(true)} leftIcon={<Info className="h-4 w-4" />}>
              Generation details
            </Button>
          )}
          <Badge tone="ok" icon={CheckCircle2}>
            Saved · v{activeVersionNumber} of {versions.length || 1}
          </Badge>
          <Badge tone="outline" mono>
            {width} × {height}
          </Badge>
        </div>
      </div>

      <div className="mb-6">
        <p className="mb-2 inline-flex items-center gap-2 font-mono text-micro uppercase text-muted">
          <span className="h-2 w-2 rounded-full bg-marker ring-[1.5px] ring-ink" aria-hidden="true" />
          {humanize(activeVersion.layout?.memeType)} · {friendlyDate(meme.createdAt)}
        </p>
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[36px]">{meme.content?.headline || meme.content?.topic || 'Your meme'}</h1>
        {meme.content?.punchline && <p className="telugu-text mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{meme.content.punchline}</p>}
      </div>

      {clarification && (
        <Alert tone="warn" icon={HelpCircle} className="mb-5" title="Which change do you mean?">
          {clarification} Please rephrase the instruction more precisely.
        </Alert>
      )}
      {error && (
        <Alert tone="bad" className="mb-5 animate-slide-in">
          {error}
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* ---------------- left: the meme ---------------- */}
        <div className="min-w-0 space-y-4">
          <Card tone="stage" pad="md" className="!p-4 sm:!p-6">
            <div className="flex items-center justify-center">
              <img
                key={imageSrc}
                src={imageSrc}
                alt="Generated meme"
                className="block max-h-[78vh] w-auto max-w-full animate-pop rounded-sm border-2 border-ink bg-ink shadow-hard-marker"
              />
            </div>

            {/* Version filmstrip */}
            {versions.length > 1 && (
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-2.5 flex items-center gap-2 font-mono text-micro uppercase text-paper/55">
                  <GitBranch className="h-3 w-3" aria-hidden="true" /> {versions.length} versions
                </p>
                <ul className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2" role="list">
                  {versions.map(v => {
                    const active = activeVersionNumber === v.versionNumber;
                    return (
                      <li key={v.versionNumber} className="shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveVersionNumber(v.versionNumber)}
                          aria-current={active ? 'true' : undefined}
                          title={v.instruction}
                          className="group block w-[78px] text-left"
                        >
                          <span
                            className={cn(
                              'relative block aspect-[4/5] overflow-hidden rounded border-2 bg-ink-2 transition-all',
                              active ? 'border-marker shadow-[3px_3px_0_0_rgb(var(--marker))]' : 'border-white/20 opacity-70 group-hover:border-white/60 group-hover:opacity-100'
                            )}
                          >
                            <img src={`${API_BASE}${v.outputUrls?.jpeg || v.outputUrls?.png}`} alt={`Version ${v.versionNumber}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                          </span>
                          <span className={cn('mt-1.5 block font-mono text-[11px] font-semibold', active ? 'text-marker' : 'text-paper/65')}>v{v.versionNumber}</span>
                          <span className="block truncate text-[10.5px] text-paper/45">{v.instruction}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Card>

          {viewingOld && (
            <Alert
              tone="warn"
              action={
                <Button size="sm" variant="dark" onClick={() => handleRestoreVersion(activeVersionNumber)} loading={restoring}>
                  Restore v{activeVersionNumber}
                </Button>
              }
            >
              You are looking at the saved snapshot of <strong>version {activeVersionNumber}</strong>. Restore it to make it the active one.
            </Alert>
          )}

          {/* Publish + download */}
          <Card pad="md" className="space-y-3">
            <Button variant="primary" size="lg" className="w-full" onClick={() => setShowInstagramModal(true)} leftIcon={<Instagram className="h-[18px] w-[18px]" />}>
              Publish to Instagram
            </Button>

            {isPublishedOnInstagram && (
              <Alert
                tone="ok"
                compact
                action={
                  publishedRecord?.permalink && (
                    <a href={publishedRecord.permalink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
                      View post <ExternalLink className="h-3 w-3" />
                    </a>
                  )
                }
              >
                <strong>Published to the feed</strong>
                {publishedRecord?.publishedAt && <span className="text-muted"> · {new Date(publishedRecord.publishedAt).toLocaleDateString()}</span>}
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              {downloadFormats.map((fmt, i) => (
                <Button
                  key={fmt}
                  as="a"
                  variant={i === 0 ? 'dark' : 'secondary'}
                  href={`${API_BASE}/api/memes/${memeId}/download/${fmt}?version=${activeVersionNumber}`}
                  download={`kanyaraasi_${memeId.substring(0, 8)}_v${activeVersionNumber}.${fmt}`}
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  {fmt.toUpperCase()}
                  <span className="font-mono text-[12px] font-medium opacity-70">v{activeVersionNumber}</span>
                </Button>
              ))}
            </div>
          </Card>

          {/* Layout facts of the version on screen (real data from this meme) */}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Meme type', humanize(activeVersion.layout?.memeType)],
              ['Arrangement', ARRANGEMENT_LABEL[activeVersion.layout?.arrangement] || humanize(activeVersion.layout?.arrangement)],
              ['Images', `${subjectImages.length} + your reaction`],
              ['Size', `${width} × ${height}`]
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-line bg-surface p-3">
                <dt className="font-mono text-micro uppercase text-muted">{k}</dt>
                <dd className="mt-1 text-[14px] font-bold leading-snug text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ---------------- right: change it ---------------- */}
        <div className="min-w-0 space-y-4">
          <Card pad="md">
            <CardHeader icon={RotateCcw} title="Change it in plain words" description="Say what to change. Only that changes; everything else stays, and the result is saved as a new version." />

            <Textarea
              rows={3}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !regenerating) handleRegenerate();
              }}
              disabled={regenerating}
              placeholder='e.g. "Make the headline 20% bigger" or "Use Anton font"'
              aria-label="What should change"
              className="mb-3 resize-none"
            />

            <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Suggestions">
              {SUGGESTIONS.map(pill => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setInstructions(pill)}
                  disabled={regenerating}
                  className="rounded-full border border-line-strong bg-surface px-3 py-1 text-[12.5px] font-medium text-ink-3 transition-colors hover:border-ink hover:bg-marker-soft hover:text-ink disabled:opacity-50"
                >
                  {pill}
                </button>
              ))}
            </div>

            <Button variant="dark" size="lg" className="w-full" loading={regenerating} onClick={handleRegenerate} leftIcon={<Wand2 className="h-[18px] w-[18px]" />}>
              {regenerating ? 'Making a new version…' : `Make version ${(meme.currentVersion || 1) + 1}`}
            </Button>
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12px] text-muted">
              <Kbd>Ctrl</Kbd>
              <Kbd>Enter</Kbd> to apply
            </p>
          </Card>

          {/* Replace individual images (no manual editor) */}
          <ReplaceImagesPanel
            key={`${memeId}-${meme.currentVersion}`}
            meme={meme}
            isCurrent={activeVersionNumber === (meme.currentVersion || 1)}
            onApplied={updated => {
              setMeme(updated);
              setActiveVersionNumber(updated.currentVersion);
              if (onMemeUpdated) onMemeUpdated(updated);
            }}
          />

          {/* Where each subject image came from, and its rights label */}
          {showSources && (
            <Card pad="md">
              <CardHeader
                icon={ShieldCheck}
                title="Image sources and rights"
                actions={
                  meme.pipeline === 'viral_adaptation_v2' && (
                    <Button variant="link" onClick={() => setShowDetails(true)} className="text-[13px]">
                      Full details
                    </Button>
                  )
                }
              />
              <ul className="space-y-2">
                {subjectImages.map((a, i) => (
                  <SourceRow key={a.id || i} asset={a} index={i} />
                ))}
              </ul>
              {rightsCounts.open > 0 && <p className="mt-3 text-[12.5px] leading-relaxed text-muted">Open-licence images ask for a credit line (shown above) in your post caption.</p>}
            </Card>
          )}

          {/* Style used by this version */}
          <Card pad="none" className="px-5 sm:px-6">
            <Disclosure
              title={`Style used in version ${activeVersionNumber}`}
              summary={`${activeVersion.design?.fontFamily || 'Default font'} · ${activeVersion.design?.fontSizeScale ?? 1}× text`}
            >
              <dl>
                {activeVersion.appliedChanges?.length > 0 && (
                  <div className="border-b border-line py-2">
                    <dt className="text-[13px] text-muted">Changes in this version</dt>
                    <dd className="mt-1.5 space-y-1">
                      {activeVersion.appliedChanges.map((c, i) => (
                        <p key={i} className="flex items-start gap-1.5 text-[13px] font-semibold text-ink">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={3} aria-hidden="true" /> {c}
                        </p>
                      ))}
                    </dd>
                  </div>
                )}
                <DataRow label="Meme type" mono>
                  {activeVersion.layout?.memeType}
                </DataRow>
                <DataRow label="Font size scale" mono>
                  {activeVersion.design?.fontSizeScale}×
                </DataRow>
                <DataRow label="English font" mono>
                  {activeVersion.design?.fontFamily}
                </DataRow>
                <DataRow label="Telugu font" mono>
                  {activeVersion.design?.teluguFontFamily}
                </DataRow>
                <DataRow label="Colours">
                  <span className="inline-flex items-center gap-2 font-mono text-[12px] font-medium">
                    <span className="h-4 w-4 rounded border border-ink/30" style={{ backgroundColor: activeVersion.design?.primaryTextColor }} aria-hidden="true" />
                    {activeVersion.design?.primaryTextColor}
                    <span className="text-faint">/</span>
                    <span className="h-4 w-4 rounded border border-ink/30" style={{ backgroundColor: activeVersion.design?.secondaryTextColor }} aria-hidden="true" />
                    {activeVersion.design?.secondaryTextColor}
                  </span>
                </DataRow>
                <DataRow label="Black outline" mono>
                  {activeVersion.design?.outlineThickness}px
                </DataRow>
              </dl>
            </Disclosure>
          </Card>
        </div>
      </div>

      {showDetails && <GenerationDetailsModal memeId={memeId} onClose={() => setShowDetails(false)} />}

      {/* Instagram direct publishing */}
      <InstagramPublishModal
        isOpen={showInstagramModal}
        onClose={() => setShowInstagramModal(false)}
        meme={meme}
        versionNumber={activeVersionNumber}
        onPublished={res => {
          const updatedMeme = {
            ...meme,
            instagramPublish: {
              status: 'published',
              instagramMediaId: res.mediaId,
              permalink: res.permalink,
              publishedAt: res.publishedAt,
              versionNumber: res.versionNumber,
              caption: res.caption
            }
          };
          setMeme(updatedMeme);
          if (onMemeUpdated) onMemeUpdated(updatedMeme);
        }}
      />
    </div>
  );
}
