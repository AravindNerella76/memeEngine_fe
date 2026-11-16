import React, { useState } from 'react';
import { ExternalLink, Eye, ImageIcon, ImagePlus, Replace, X } from 'lucide-react';
import { API_BASE, apiFetch } from '../../api';
import ImagePicker, { discardStaged, StagedCard } from './ImagePicker';
import { sourceTypeText } from '../ImageRights';
import { Alert, Badge, Button, Card, CardHeader } from '../../ui';

function SubjectThumb({ memeId, index, version, asset }) {
  const [failed, setFailed] = useState(false);
  const slot = index + 1;
  const primarySrc = `${API_BASE}/api/memes/${memeId}/assets/subject-${index}?v=${version}-${asset.id || index}`;

  if (failed) {
    if (asset?.sourceUrl && failed !== 'all') {
      return (
        <img
          src={asset.sourceUrl}
          alt={`Image ${slot}`}
          onError={() => setFailed('all')}
          className="h-16 w-16 shrink-0 rounded border-2 border-ink bg-ink object-cover"
        />
      );
    }
    return (
      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded border-2 border-ink bg-paper-2 text-ink shadow-sm">
        <ImageIcon className="h-6 w-6 text-muted" />
        <span className="mt-0.5 text-[10px] font-mono font-bold text-ink">#{slot}</span>
      </div>
    );
  }

  return (
    <img
      src={primarySrc}
      alt={`Image ${slot}`}
      onError={() => setFailed(true)}
      className="h-16 w-16 shrink-0 rounded border-2 border-ink bg-ink object-cover"
    />
  );
}

/**
 * Replace Image: swap individual subject images of a generated meme. Layout, text, styling, punchline
 * and reaction image stay as they are. Choices are previewed first; Apply creates a new version.
 */
export default function ReplaceImagesPanel({ meme, isCurrent, onApplied }) {
  const memeId = meme.memeId || meme.id;
  const subjects = (meme.assets?.subjectImages || []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [pickingSlot, setPickingSlot] = useState(null);
  const [pending, setPending] = useState({}); // slot -> staged item
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null); // 'preview' | 'apply'
  const [error, setError] = useState(null);

  const changes = Object.entries(pending).map(([slot, item]) => ({ slot: Number(slot), token: item.token }));
  const nextVersion = (meme.currentVersion || 1) + 1;

  const reset = () => {
    discardStaged(Object.values(pending).map(p => p.token));
    setPending({});
    setPreview(null);
    setPickingSlot(null);
    setError(null);
  };

  const call = async (path, body) => {
    const res = await apiFetch(`${API_BASE}/api/memes/${memeId}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  };

  const doPreview = async () => {
    setBusy('preview');
    setError(null);
    try {
      setPreview(await call('image-replace/preview', { changes, baseVersion: meme.currentVersion }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const apply = async () => {
    setBusy('apply');
    setError(null);
    try {
      const updated = await call('image-replace', { changes, baseVersion: meme.currentVersion });
      setPending({});
      setPreview(null);
      setPickingSlot(null);
      onApplied(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (!subjects.length) return null;

  return (
    <Card pad="md">
      <CardHeader
        icon={Replace}
        className={!open ? 'mb-0' : undefined}
        title="Replace an image"
        description={!open && isCurrent ? "Don't like one of the pictures? Swap just that one. The layout, text and everything else stay the same." : undefined}
        actions={
          !open ? (
            <Button variant="dark" size="sm" onClick={() => setOpen(true)} disabled={!isCurrent}>
              Choose image
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Close
            </Button>
          )
        }
      />
      {!isCurrent && <p className="text-[12.5px] text-muted">You are looking at an older version. Restore it first to change its images.</p>}

      {open && (
        <div className="space-y-3.5">
          <ul className="space-y-2.5">
            {subjects.map((a, i) => {
              const slot = i + 1;
              const p = pending[slot];
              return (
                <li key={a.id || i} className="space-y-2.5 rounded-md border border-line bg-paper/60 p-3">
                  <div className="flex items-center gap-3">
                    <SubjectThumb memeId={memeId} index={i} version={meme.currentVersion || 1} asset={a} />
                    <div className="min-w-0 flex-1 text-[12px] leading-snug text-muted">
                      <p className="flex items-center gap-2 truncate text-[14px] font-semibold text-ink">
                        <Badge tone="ink" size="sm" mono>
                          {slot}
                        </Badge>
                        <span className="truncate">{a.label || `Image ${slot}`}</span>
                      </p>
                      <p className="mt-0.5">
                        {sourceTypeText(a) === 'Source not recorded' && (a.path?.includes('whatsapp') || meme.pipeline === 'manual')
                          ? 'Uploaded photo'
                          : sourceTypeText(a)}
                        {a.provider ? ` · ${a.provider}` : ''}
                        {a.sourcePage && (
                          <a href={a.sourcePage} target="_blank" rel="noreferrer noopener" className="ml-1.5 inline-flex items-center gap-0.5 font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
                            source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => setPickingSlot(pickingSlot === slot ? null : slot)} disabled={Boolean(busy)} leftIcon={<ImagePlus className="h-3.5 w-3.5" />}>
                      {p ? 'Change' : 'Replace'}
                    </Button>
                  </div>
                  {p && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-micro uppercase text-ink">New picture for image {slot}</p>
                      <StagedCard
                        item={p}
                        compact
                        onRemove={() => {
                          discardStaged([p.token]);
                          setPending(({ [slot]: _drop, ...rest }) => rest);
                          setPreview(null);
                        }}
                      />
                    </div>
                  )}
                  {pickingSlot === slot && (
                    <ImagePicker
                      memeId={memeId}
                      slot={slot}
                      defaultQuery={a.label || ''}
                      onClose={() => setPickingSlot(null)}
                      onPick={item => {
                        if (p) discardStaged([p.token]);
                        setPending(prev => ({ ...prev, [slot]: item }));
                        setPreview(null);
                        setPickingSlot(null);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {error && (
            <Alert tone="bad" compact>
              {error}
            </Alert>
          )}

          {preview && (
            <div className="space-y-1.5">
              <p className="font-mono text-micro uppercase text-muted">Preview · not saved yet</p>
              <img src={preview.image} alt="Preview of the meme with the new pictures" className="w-full rounded border-2 border-ink shadow-hard-sm" />
            </div>
          )}

          {changes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" onClick={doPreview} loading={busy === 'preview'} disabled={Boolean(busy)} leftIcon={<Eye className="h-4 w-4" />}>
                Preview
              </Button>
              <Button variant="dark" className="flex-1" onClick={apply} loading={busy === 'apply'} disabled={Boolean(busy)} leftIcon={<Replace className="h-4 w-4" />}>
                Apply as version {nextVersion}
              </Button>
              <Button variant="ghost" onClick={reset} disabled={Boolean(busy)} leftIcon={<X className="h-4 w-4" />}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
