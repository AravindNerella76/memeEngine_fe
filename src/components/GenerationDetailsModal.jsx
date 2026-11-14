import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, ExternalLink, Image as ImageIcon, Info, Search, ShieldCheck } from 'lucide-react';
import { API_BASE as API, apiFetch } from '../api';
import { MATCH_LABEL, providerName, RightsBadge } from './ImageRights';
import { Alert, Dialog, Skeleton } from '../ui';

const pct = v => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '-');
const secs = ms => (typeof ms === 'number' ? `${(ms / 1000).toFixed(1)}s` : '-');

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 text-[12.5px] last:border-b-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="break-words text-right font-medium text-ink">{children}</span>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <div className="rounded-md border border-line bg-paper/60 p-3.5">
      <p className="mb-1.5 flex items-center gap-1.5 font-mono text-micro uppercase text-muted">
        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />} {title}
      </p>
      {children}
    </div>
  );
}

function SlotCard({ memeId, slot, identity, index }) {
  const [open, setOpen] = useState(false);
  const sel = slot.selected;
  const rights = sel?.rights;
  return (
    <div className="space-y-3 rounded-md border border-line bg-surface p-3.5">
      <div className="flex gap-3.5">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded border-2 border-ink bg-ink">
          <img src={`${API}/api/memes/${memeId}/assets/subject-${index}`} alt={slot.subject} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 space-y-1 text-[12.5px] leading-snug text-muted">
          <p className="text-[15px] font-bold text-ink">
            Slot {index + 1}: {slot.subject}
          </p>
          {identity && (
            <p>
              Identity: <span className="font-semibold text-ink">{identity.method}</span> ({pct(identity.confidence)})
              {identity.nameAsWritten ? ` · written as "${identity.nameAsWritten}"` : ' · no name written in the reference'}
            </p>
          )}
          <p>
            Wanted: {String(slot.desiredImageType || '').replace(/_/g, ' ')}
            {slot.context?.movieTitle ? ` from "${slot.context.movieTitle}"` : ''}
            {slot.context?.eventName ? ` at "${slot.context.eventName}"` : ''}
          </p>
          {sel && (
            <p className="truncate" title={sel.title || ''}>
              Chosen: <span className="font-semibold text-ink">{sel.title || `an image found by ${providerName(sel.provider)} (title not stored)`}</span>
            </p>
          )}
          {sel && <RightsBadge rights={rights} license={sel.license} />}
        </div>
      </div>

      {sel && (
        <div className="grid gap-x-6 sm:grid-cols-2">
          <Row label="Source">
            {sel.pageUrl ? (
              <a href={sel.pageUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
                {providerName(sel.provider)} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span title={rights?.storageNote || ''}>
                {providerName(sel.provider)}
                {rights && rights.sourceStored === false ? ' (link not stored: provider terms)' : ''}
              </span>
            )}
          </Row>
          <Row label="Licence">{rights?.classification === 'copyrighted_unconfirmed' ? 'none given (web image)' : sel.license || 'unknown'}</Row>
          <Row label="Credit">
            {rights?.attributionRequired ? `required${sel.attribution ? `: ${sel.attribution}` : ''}` : sel.attribution || '-'}
            {rights?.shareAlike ? ' · edits share-alike' : ''}
          </Row>
          <Row label="Reference match">{MATCH_LABEL[sel.referenceMatch?.level] || MATCH_LABEL.unknown}</Row>
          <Row label="Size">
            <span className="font-mono">
              {sel.width}x{sel.height}
            </span>
          </Row>
          <Row label="Identity evidence">{sel.identityEvidence}</Row>
          <Row label="Score">
            <span className="font-mono">{sel.finalScore}/100</span>
          </Row>
          <Row label="Scores">
            <span className="font-mono text-[12px]">
              id {sel.scores?.identity} · ctx {sel.scores?.context} · type {sel.scores?.type} · res {sel.scores?.resolution}
            </span>
          </Row>
          <Row label="Visual check">{sel.visual ? `${sel.visual.verdict} (${pct(sel.visual.confidence)})` : 'not run'}</Row>
        </div>
      )}
      {sel?.visual?.reason && <p className="rounded border-l-[3px] border-ink bg-marker-soft px-3 py-2 text-[12.5px] italic text-ink-3">“{sel.visual.reason}”</p>}
      {rights && (
        <p className="text-[12px] text-muted">
          Rights basis: {rights.basis}
          {rights.restriction ? ` (${rights.restriction})` : ''}.{rights.storageNote ? ` ${rights.storageNote}.` : ''}
        </p>
      )}
      {sel?.referenceMatch?.evidence?.length > 0 && sel.referenceMatch.level !== 'unknown' && (
        <p className="text-[12px] text-muted">Reference match evidence: {sel.referenceMatch.evidence.join(' · ')}</p>
      )}
      {identity?.warnings?.length > 0 && <p className="text-[12.5px] font-medium text-warn">{identity.warnings.join(' ')}</p>}

      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-3 hover:text-ink">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Search details ({slot.candidatesConsidered} candidates, {slot.visualChecks} visual checks, {slot.alternates?.length || 0} verified alternates)
      </button>
      {open && (
        <div className="space-y-2 text-[12.5px]">
          <p className="text-muted">
            <Search className="mr-1 inline h-3 w-3" />
            Queries: <span className="text-ink">{(slot.queries || []).map(q => q.query).join(' · ')}</span>
          </p>
          {slot.droppedSearchTerms?.length > 0 && <p className="text-muted">Dropped (not supported by the reference): {slot.droppedSearchTerms.join(' · ')}</p>}
          <p className="text-muted">Providers: {(slot.providersUsed || []).join(', ')}</p>
          {slot.rightsPolicy && <p className="text-muted">Rights policy: {slot.rightsPolicy === 'open_license_only' ? 'openly licensed images only' : 'copyrighted images allowed (each is labelled)'}</p>}
          {slot.notes?.length > 0 && <p className="text-muted">{slot.notes.join(' ')}</p>}
          {slot.rejected?.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-ink-3">Why other images were not used:</p>
              <ul className="space-y-1">
                {slot.rejected.slice(0, 6).map((r, i) => (
                  <li key={i} className="text-muted">
                    <span className="text-ink">{r.stored === false ? 'web result (not stored)' : (r.title || '').slice(0, 60)}</span> ({providerName(r.provider)}): {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GenerationDetailsModal({ memeId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    apiFetch(`${API}/api/memes/${memeId}/report`)
      .then(r => (r.ok ? r.json() : r.json().then(j => Promise.reject(new Error(j.message || 'Could not load details')))))
      .then(j => alive && setData(j))
      .catch(e => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [memeId]);

  const report = data?.report;
  const analysis = report?.referenceAnalysis;

  return (
    <Dialog open onClose={onClose} size="xl" icon={Info} title="Generation details" description="How the engine read the reference and why it chose each picture.">
      {error && <Alert tone="bad">{error}</Alert>}
      {!data && !error && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading details">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-44" />
        </div>
      )}
      {data && !report && <Alert tone="neutral">This meme was created manually, so there is no AI generation report.</Alert>}

      {report && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel title="Timing" icon={Clock}>
              <Row label="Total">{secs(report.durationMs)}</Row>
              <Row label="Analysis">{secs(report.stageTimings?.analysisMs)}</Row>
              <Row label="Image discovery">{secs(report.stageTimings?.discoveryMs)}</Row>
              <Row label="Rendering">{secs(report.stageTimings?.renderMs)}</Row>
            </Panel>
            <Panel title="Reference understanding">
              <Row label="Format">{analysis?.memeFormat}</Row>
              <Row label="Images per row">{(analysis?.grid?.columnsPerRow || []).join(' / ')}</Row>
              <Row label="Header">{analysis?.header?.text || 'none'}</Row>
              <Row label="Reaction panel">{analysis?.reactionPanel?.present ? 'replaced by yours' : 'none (yours added)'}</Row>
            </Panel>
            <Panel title="Checks" icon={ShieldCheck}>
              <Row label="Image code verified">{analysis?.imageCodeVerified ? 'yes' : 'no'}</Row>
              <Row label="Visual verification">{report.models?.verifyMode}</Row>
              <Row label="Text aimed at the AI">{report.security?.suspectedPromptInjection ? 'found and ignored' : 'none'}</Row>
              <Row label="AI calls">{report.visionCalls?.length || 0}</Row>
              {report.rights && (
                <Row label="Image rights">
                  {(() => {
                    const sel = report.rights.selected || [];
                    const open = sel.filter(s => s.classification === 'open_license').length;
                    return `${open} open licence · ${sel.length - open} web image${sel.length - open === 1 ? '' : 's'}`;
                  })()}
                </Row>
              )}
            </Panel>
          </div>

          {data.hasReferenceImage && (
            <div className="flex items-center gap-4 rounded-md border border-line bg-paper/60 p-3">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded border-2 border-ink bg-ink">
                <img src={`${API}/api/memes/${memeId}/assets/reference`} alt="Reference" className="h-full w-full object-cover" />
              </div>
              <p className="text-[13px] leading-relaxed text-muted">Reference screenshot (kept private). Its reaction image and punchline were ignored; yours were used exactly as given.</p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              <ImageIcon className="h-4 w-4" aria-hidden="true" /> Subject images
            </h3>
            {(report.slots || []).map((slot, i) => (
              <SlotCard key={slot.slotId || i} memeId={memeId} slot={slot} identity={(report.identities || [])[i]} index={i} />
            ))}
          </div>

          {report.warnings?.length > 0 && (
            <Alert tone="warn" title="Notes">
              {report.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}
