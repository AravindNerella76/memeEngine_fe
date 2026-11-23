import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FolderUp, ImagePlus, TriangleAlert } from 'lucide-react';
import { Alert, Button, Chips, Dialog, Field, Input, cn, formatBytes, useAvailability } from '../../ui';
import { folderLabel, groupByFolder, isPictureFile, uploadReactions } from '../../lib/reactionLibrary';

const MODES = [
  { value: 'files', label: 'Pictures', icon: ImagePlus },
  { value: 'folders', label: 'Folders from this computer', icon: FolderUp }
];

/**
 * Adds pictures to the library, two ways:
 *  - "Pictures": choose or drop files, say which folder they go in;
 *  - "Folders": choose a whole folder (e.g. the one with Shocking, Sad, Praise inside) and every sub-folder becomes a
 *    folder of the library, named after it.
 * Pictures already in the library (same content) are skipped, and one broken file never stops the rest.
 */
export default function AddPicturesDialog({ open, onClose, folders, defaultFolder, startMode = 'files', onDone }) {
  const net = useAvailability();
  const listId = useId();
  const fileInput = useRef(null);
  const dirInput = useRef(null);
  const [mode, setMode] = useState('files');
  const [files, setFiles] = useState([]);
  const [folder, setFolder] = useState('');
  const [tags, setTags] = useState('');
  const [groups, setGroups] = useState([]); // [{ category, files, on }]
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null); // { done, total }
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef(null);

  useEffect(() => {
    if (!open) return;
    setMode(startMode);
    setFiles([]);
    setGroups([]);
    setTags('');
    setFolder(defaultFolder && defaultFolder !== 'all' ? defaultFolder : '');
    setProgress(null);
    setResult(null);
    setBusy(false);
  }, [open, defaultFolder, startMode]);

  const known = useMemo(() => new Set((folders || []).map(f => f.category)), [folders]);
  const pickFiles = list => setFiles(prev => [...prev, ...[...list].filter(isPictureFile).filter(f => !prev.some(p => p.name === f.name && p.size === f.size))]);
  const pickFolder = list => setGroups(groupByFolder([...list]).map(g => ({ ...g, on: true })));

  const folderOk = folder.trim().length > 0;
  const chosen = groups.filter(g => g.on);
  const total = mode === 'files' ? files.length : chosen.reduce((n, g) => n + g.files.length, 0);
  const canGo = !busy && total > 0 && net.ok && (mode === 'folders' || folderOk);

  const run = async () => {
    setBusy(true);
    setResult(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const jobs = mode === 'files' ? [{ category: folder.trim(), files }] : chosen;
    const all = jobs.reduce((n, j) => n + j.files.length, 0);
    let before = 0;
    const sum = { added: 0, duplicates: [], failed: [] };
    for (const job of jobs) {
      const r = await uploadReactions(job.files, job.category, {
        tags: mode === 'files' ? tags : undefined,
        signal: ctrl.signal,
        onProgress: ({ done }) => setProgress({ done: before + done, total: all })
      });
      before += job.files.length;
      sum.added += r.added;
      sum.duplicates.push(...r.duplicates);
      sum.failed.push(...r.failed);
    }
    setBusy(false);
    setProgress(null);
    setResult(sum);
    onDone?.(sum);
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Add reaction pictures"
      description="They are saved in your studio's database, so they are there on every device and after every update."
      icon={ImagePlus}
      size="lg"
      hideClose={busy}
      footer={
        result ? (
          <div className="flex justify-end">
            <Button variant="dark" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted" aria-live="polite">
              {busy && progress ? `Adding ${progress.done} of ${progress.total}…` : total ? `${total} picture${total === 1 ? '' : 's'} ready` : 'Nothing chosen yet'}
            </p>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={run} disabled={!canGo} loading={busy} data-autofocus>
                Add {total || ''} {total === 1 ? 'picture' : 'pictures'}
              </Button>
            </div>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4" role="status">
          <div className="flex items-start gap-3 rounded-md border border-ok/30 bg-ok-soft p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok" aria-hidden="true" />
            <div className="text-[14px]">
              <p className="font-bold text-ink">
                {result.added} added
                {result.duplicates.length > 0 && <span className="font-medium text-muted"> · {result.duplicates.length} already in your library</span>}
                {result.failed.length > 0 && <span className="font-medium text-bad"> · {result.failed.length} could not be added</span>}
              </p>
              {result.duplicates.length > 0 && <p className="mt-1 text-muted">A picture is never stored twice, even under a different file name.</p>}
            </div>
          </div>
          {result.failed.length > 0 && (
            <Alert tone="bad" icon={TriangleAlert} title="These were not added">
              <ul className="mt-1 max-h-40 list-disc space-y-0.5 overflow-auto pl-5">
                {result.failed.slice(0, 20).map((f, i) => (
                  <li key={i}>{f.reason}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Chips value={mode} onChange={v => !busy && setMode(v)} options={MODES} label="How to add" tone="marker" size="sm" />

          {mode === 'files' ? (
            <>
              <div
                onDragEnter={e => (e.preventDefault(), setOver(true))}
                onDragOver={e => e.preventDefault()}
                onDragLeave={() => setOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setOver(false);
                  pickFiles(e.dataTransfer.files);
                }}
                className={cn('rounded-lg border-2 border-dashed p-6 text-center transition-colors', over ? 'border-ink bg-marker-soft' : 'border-line-strong bg-paper')}
              >
                <ImagePlus className="mx-auto h-7 w-7 text-ink-3" aria-hidden="true" />
                <p className="mt-2 text-[14px] font-semibold">Drop pictures here</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => fileInput.current?.click()} disabled={busy}>
                  Choose pictures
                </Button>
                <input ref={fileInput} type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jfif,.heic,.heif" className="sr-only" tabIndex={-1} onChange={e => (pickFiles(e.target.files), (e.target.value = ''))} />
                {files.length > 0 && (
                  <p className="mt-3 text-[13px] text-muted">
                    <strong className="text-ink">{files.length}</strong> chosen · {formatBytes(files.reduce((n, f) => n + f.size, 0))}{' '}
                    <button type="button" className="font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2" onClick={() => setFiles([])} disabled={busy}>
                      Clear
                    </button>
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Folder" hint="Pick one you have, or type a new name.">
                  {({ id }) => (
                    <>
                      <Input id={id} list={listId} value={folder} onChange={e => setFolder(e.target.value)} placeholder="e.g. shocking, sad funny, brahmi laughing" maxLength={40} autoComplete="off" />
                      <datalist id={listId}>
                        {(folders || []).map(f => (
                          <option key={f.category} value={f.category} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <Field label="Tags" optional hint="Who or what is in them, separated by commas.">
                  {({ id }) => <Input id={id} value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. brahmanandam, theatre" autoComplete="off" />}
                </Field>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border-2 border-dashed border-line-strong bg-paper p-6 text-center">
                <FolderUp className="mx-auto h-7 w-7 text-ink-3" aria-hidden="true" />
                <p className="mt-2 text-[14px] font-semibold">Choose the folder that holds your reaction folders</p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">For example a folder with Shocking, Sad and Praise inside. Each of those becomes a folder here, named the same.</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => dirInput.current?.click()} disabled={busy}>
                  Choose folder
                </Button>
                <input
                  ref={dirInput}
                  type="file"
                  // eslint-disable-next-line react/no-unknown-property
                  webkitdirectory=""
                  directory=""
                  multiple
                  className="sr-only"
                  tabIndex={-1}
                  onChange={e => (pickFolder(e.target.files), (e.target.value = ''))}
                />
              </div>
              {groups.length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-ink">{chosen.length} of {groups.length} folders will be added</p>
                  <ul className="thin-scrollbar max-h-64 divide-y divide-line overflow-auto rounded-md border border-line">
                    {groups.map(g => (
                      <li key={g.category}>
                        <label className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 text-[14px] hover:bg-paper">
                          <input type="checkbox" checked={g.on} disabled={busy} onChange={() => setGroups(gs => gs.map(x => (x.category === g.category ? { ...x, on: !x.on } : x)))} className="h-4 w-4 accent-[rgb(var(--ink))]" />
                          <span className="min-w-0 flex-1 truncate font-semibold">{folderLabel(g.category)}</span>
                          {known.has(g.category) && <span className="shrink-0 text-[12px] text-muted">joins the folder you have</span>}
                          <span className="tabular shrink-0 font-mono text-[12px] text-muted">{g.files.length}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {groups.length === 0 && <p className="text-[13px] text-muted">Only JPEG, PNG and WebP pictures are picked up; anything else in the folder is ignored.</p>}
            </>
          )}
          {!net.ok && (
            <Alert tone="warn" title="Not connected">
              {net.reason}
            </Alert>
          )}
        </div>
      )}
    </Dialog>
  );
}
