import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ScanSearch, X } from 'lucide-react';
import { API_BASE, apiFetch } from '../../api';
import ImagePicker, { discardStaged, StagedCard } from './ImagePicker';
import { Alert, Button, Badge } from '../../ui';

/**
 * Optional step of Viral Adaptation: analyse the reference once, then keep the AI's pick for each
 * image slot or choose your own (upload or online search). The three required inputs are unchanged.
 * Reports { draftId, overrides: [{ slot, token }] } to the form, or null when nothing was chosen.
 */
export default function ViralImageChoices({ referenceFile, disabled, onChange }) {
  const [draft, setDraft] = useState(null); // { draftId, slots, warnings }
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState({}); // slot -> staged item
  const [picking, setPicking] = useState(null);
  const pickedRef = useRef({});
  pickedRef.current = picked;

  // a different reference file invalidates the analysis and the choices made for it
  useEffect(() => {
    discardStaged(Object.values(pickedRef.current).map(p => p.token));
    setDraft(null);
    setPicked({});
    setPicking(null);
    setError(null);
  }, [referenceFile?.file]);

  useEffect(() => {
    onChange(draft ? { draftId: draft.draftId, overrides: Object.entries(picked).map(([slot, p]) => ({ slot: Number(slot), token: p.token })) } : null);
  }, [draft, picked]);

  const analyse = async () => {
    if (!referenceFile?.file) return;
    setAnalysing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('referenceImage', referenceFile.file);
      const res = await apiFetch(`${API_BASE}/api/memes/viral-analyze`, { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `Analysis failed (${res.status})`);
      setDraft(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalysing(false);
    }
  };

  const clear = () => {
    discardStaged(Object.values(picked).map(p => p.token));
    setDraft(null);
    setPicked({});
    setPicking(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-md text-[13px] leading-relaxed text-muted">
          The AI picks every image by default. Analyse the reference once to replace individual slots with your own pictures.
          {!referenceFile && <span className="mt-1 block font-semibold text-ink">Add the reference screenshot first.</span>}
        </p>
        {!draft ? (
          <Button variant="dark" size="sm" onClick={analyse} loading={analysing} disabled={!referenceFile?.file || disabled} leftIcon={<ScanSearch className="h-4 w-4" />}>
            {analysing ? 'Analysing… about a minute' : 'Analyse reference'}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={clear} disabled={disabled} leftIcon={<X className="h-4 w-4" />}>
            Back to AI picks for all
          </Button>
        )}
      </div>

      {error && (
        <Alert tone="bad" compact>
          {error}
        </Alert>
      )}

      {draft && (
        <>
          <Alert tone="ok" compact icon={CheckCircle2}>
            Reference analysed: {draft.slots.length} image slot{draft.slots.length === 1 ? '' : 's'}. It will not be analysed again when you generate.
          </Alert>
          <ul className="space-y-2.5">
            {draft.slots.map(s => {
              const p = picked[s.slot];
              return (
                <li key={s.slot} className="space-y-2.5 rounded-md border border-line bg-paper/60 p-3">
                  <div className="flex items-center gap-3">
                    {s.referenceCrop && <img src={s.referenceCrop} alt={`Slot ${s.slot} in the reference`} className="h-16 w-16 shrink-0 rounded border-2 border-ink bg-ink object-cover" />}
                    <div className="min-w-0 flex-1 text-[12px] leading-snug text-muted">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                        <Badge tone="ink" size="sm" mono>
                          {s.slot}
                        </Badge>
                        <span className="min-w-0 truncate">{s.subject || `Image ${s.slot}`}</span>
                      </p>
                      <p className="mt-0.5">
                        {s.label ? `Label: ${s.label} · ` : ''}wanted: {String(s.imageType || '').replace(/_/g, ' ')}
                      </p>
                      <p className={p ? 'font-semibold text-ink' : s.identity === 'resolved' ? '' : 'font-semibold text-warn'}>
                        {p ? 'Your picture is used for this slot' : s.identity === 'resolved' ? 'AI will choose and verify the picture' : 'The AI could not identify this subject: choose your own picture'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
                      {p && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={disabled}
                          onClick={() => {
                            discardStaged([p.token]);
                            setPicked(({ [s.slot]: _drop, ...rest }) => rest);
                          }}
                        >
                          Keep AI pick
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setPicking(picking === s.slot ? null : s.slot)}>
                        {p ? 'Change' : 'Use my own'}
                      </Button>
                    </div>
                  </div>
                  {p && <StagedCard item={p} compact />}
                  {picking === s.slot && (
                    <ImagePicker
                      defaultQuery={s.subject || s.label || ''}
                      onClose={() => setPicking(null)}
                      onPick={item => {
                        if (p) discardStaged([p.token]);
                        setPicked(prev => ({ ...prev, [s.slot]: item }));
                        setPicking(null);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-[12px] text-muted">After the meme is made, "Replace image" on the result page also offers the verified candidates the AI found.</p>
        </>
      )}
    </div>
  );
}
