import React, { useEffect, useId, useState } from 'react';
import { Trash2, Wand2 } from 'lucide-react';
import { Button, Dialog, Field, Input, formatBytes, useAvailability, useConfirm, useToast } from '../../ui';
import { bulkReactions, folderLabel, reactionFileUrl, updateReaction } from '../../lib/reactionLibrary';

/** One picture, larger, with its folder, name and tags to edit, and the ways to use or remove it. */
export default function ReactionDetailDialog({ image, folders, onClose, onChanged, onUse }) {
  const net = useAvailability();
  const toast = useToast();
  const confirm = useConfirm();
  const listId = useId();
  const [folder, setFolder] = useState('');
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!image) return;
    setFolder(image.category);
    setName(image.name || '');
    setTags((image.tags || []).join(', '));
    setBusy(false);
  }, [image]);

  if (!image) return null;
  const dirty = folder.trim().toLowerCase() !== image.category || name.trim() !== (image.name || '') || tags.trim() !== (image.tags || []).join(', ');

  const save = async () => {
    setBusy(true);
    try {
      const next = await updateReaction(image.imageId, { category: folder, name, tags });
      toast.success('Saved.');
      onChanged(next);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const yes = await confirm({
      title: 'Remove this picture?',
      body: 'It is removed from the library. Memes you already made with it are not affected.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep it',
      tone: 'danger'
    });
    if (!yes) return;
    setBusy(true);
    try {
      await bulkReactions('delete', [image.imageId]);
      toast.success('Removed from the library.');
      onChanged(null);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={image.name || `${folderLabel(image.category)} picture`}
      description={`${image.width} × ${image.height} · ${formatBytes(image.bytes)}${image.usedCount ? ` · used ${image.usedCount} time${image.usedCount === 1 ? '' : 's'}` : ''}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="danger-soft" onClick={remove} disabled={busy || !net.ok} leftIcon={<Trash2 className="h-4 w-4" />}>
            Remove
          </Button>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" onClick={save} disabled={!dirty || busy || !net.ok} loading={busy}>
              Save changes
            </Button>
            <Button variant="primary" onClick={() => onUse(image)} leftIcon={<Wand2 className="h-4 w-4" />} data-autofocus>
              Use in a meme
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid place-items-center overflow-hidden rounded-md border border-line-strong bg-ink">
          <img src={reactionFileUrl(image.imageId)} alt={image.name || `${image.category} reaction`} className="max-h-[52dvh] w-full object-contain" />
        </div>
        <div className="space-y-4">
          <Field label="Folder">
            {({ id }) => (
              <>
                <Input id={id} list={listId} value={folder} onChange={e => setFolder(e.target.value)} maxLength={40} autoComplete="off" />
                <datalist id={listId}>
                  {(folders || []).map(f => (
                    <option key={f.category} value={f.category} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Name" optional hint="Only if you want to find it by name.">
            {({ id }) => <Input id={id} value={name} onChange={e => setName(e.target.value)} maxLength={80} placeholder="e.g. Brahmi, mouth open" autoComplete="off" />}
          </Field>
          <Field label="Tags" optional hint="Who or what is in it, separated by commas. Search looks at these.">
            {({ id }) => <Input id={id} value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. brahmanandam, theatre" autoComplete="off" />}
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
