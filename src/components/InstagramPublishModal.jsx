import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, Hash, Instagram, Sparkles, Upload } from 'lucide-react';
import { instagramApi } from './settings/settingsModel';
import { API_BASE } from '../api';
import { Alert, Badge, Button, Dialog, Spinner, Textarea, cn } from '../ui';

const DEFAULT_HASHTAGS = [
  '#telugumemes',
  '#kanyaraasi_memes',
  '#telugucinema',
  '#tollywood',
  '#memes',
  '#telugujokes',
  '#trending',
  '#funnymemes',
  '#hyderabad',
  '#andhrapradesh'
];

export default function InstagramPublishModal({ isOpen, onClose, meme, versionNumber, onPublished }) {
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);

  // Caption state
  const [caption, setCaption] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState(['#telugumemes', '#kanyaraasi_memes', '#telugucinema', '#memes', '#trending']);
  const [customHashtag, setCustomHashtag] = useState('');

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState('');
  const [error, setError] = useState(null);
  const [publishResult, setPublishResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load connected Instagram account info
  useEffect(() => {
    if (!isOpen) return;

    setPublishResult(null);
    setError(null);
    setLoadingAccount(true);

    instagramApi
      .getAccount()
      .then(res => {
        if (res.connected && res.account) {
          setAccount(res.account);
        } else {
          setAccount(null);
        }
      })
      .catch(err => {
        setError(err.message || 'Could not verify Instagram connection.');
      })
      .finally(() => setLoadingAccount(false));
  }, [isOpen]);

  // Prepopulate caption from meme topic and punchline
  useEffect(() => {
    if (!meme) return;
    const punchline = meme.content?.punchline || '';
    const headline = meme.content?.headline || '';
    const topic = meme.content?.topic || '';

    const lines = [];
    if (punchline) lines.push(punchline);
    if (headline && headline !== punchline) lines.push(`\n${headline}`);
    if (topic && topic !== headline && topic !== punchline) lines.push(`\n📌 ${topic}`);
    lines.push('\nFollow @kanyaraasi_memes for more Telugu memes & comedy! 🎯');

    setCaption(lines.join('\n'));
  }, [meme]);

  if (!isOpen || !meme) return null;

  // Active version details
  const targetVerNum = versionNumber || meme.currentVersion || 1;
  const versions = meme.versions || [];
  const activeVer = versions.find(v => v.versionNumber === targetVerNum) || {
    outputUrls: meme.outputUrls,
    design: meme.design
  };

  const imageUrl = activeVer.outputUrls?.jpeg || activeVer.outputUrls?.png || meme.outputUrls?.jpeg || meme.outputUrls?.png;
  const fullImageUrl = `${API_BASE}${imageUrl}`;

  // Full composite caption including hashtags
  const fullCaption = `${caption.trim()}\n\n${selectedHashtags.join(' ')}`.trim();
  const charCount = fullCaption.length;
  const hashtagCount = (fullCaption.match(/#[a-zA-Z0-9_]+/g) || []).length;

  const toggleHashtag = tag => {
    if (selectedHashtags.includes(tag)) {
      setSelectedHashtags(selectedHashtags.filter(t => t !== tag));
    } else {
      if (hashtagCount >= 30) return;
      setSelectedHashtags([...selectedHashtags, tag]);
    }
  };

  const addCustomHashtag = e => {
    e.preventDefault();
    let tag = customHashtag.trim();
    if (!tag) return;
    if (!tag.startsWith('#')) tag = `#${tag}`;
    if (!selectedHashtags.includes(tag) && hashtagCount < 30) {
      setSelectedHashtags([...selectedHashtags, tag]);
    }
    setCustomHashtag('');
  };

  const handleCopyCaption = async () => {
    try {
      await navigator.clipboard.writeText(fullCaption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePublish = async () => {
    if (!account) {
      setError('Please connect your Instagram account in Settings first.');
      return;
    }
    if (charCount > 2200) {
      setError('Caption exceeds Instagram 2,200 character limit.');
      return;
    }
    if (hashtagCount > 30) {
      setError('Instagram allows at most 30 hashtags per post.');
      return;
    }

    setPublishing(true);
    setError(null);
    setPublishProgress('Uploading and creating the Instagram media container…');

    try {
      const res = await instagramApi.publish({
        memeId: meme.memeId || meme.id,
        versionNumber: targetVerNum,
        caption: fullCaption
      });

      setPublishResult(res);
      setPublishProgress('');
      if (onPublished) onPublished(res);
    } catch (err) {
      setError(err.message || 'Failed to publish to Instagram. Check backend logs.');
      setPublishProgress('');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = !publishing && account && charCount <= 2200 && hashtagCount <= 30;

  return (
    <Dialog
      open
      onClose={publishing ? () => {} : onClose}
      size="xl"
      icon={Instagram}
      title={
        <span className="flex items-center gap-2.5">
          Publish to Instagram
          <Badge tone="ink" mono size="sm">
            v{targetVerNum}
          </Badge>
        </span>
      }
      description="Post this version straight to the feed."
      footer={
        publishResult ? (
          <div className="flex justify-end">
            <Button variant="dark" onClick={onClose} data-autofocus>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={handleCopyCaption} leftIcon={copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}>
              {copied ? 'Copied' : 'Copy caption'}
            </Button>
            <Button variant="primary" className="flex-1" onClick={handlePublish} loading={publishing} disabled={!canPublish} leftIcon={<Upload className="h-4 w-4" />}>
              {publishing ? 'Publishing…' : 'Publish now'}
            </Button>
          </div>
        )
      }
    >
      {publishResult ? (
        <div className="space-y-6 py-6 text-center">
          <span className="mx-auto grid h-16 w-16 -rotate-3 place-items-center rounded-lg border-2 border-ink bg-marker shadow-hard">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h3 className="text-[24px] font-extrabold">It's live</h3>
            <p className="text-[14px] text-muted">
              Your meme is now on <strong className="text-ink">@{publishResult.username}</strong>.
            </p>
          </div>

          {publishResult.permalink && (
            <Button as="a" variant="dark" href={publishResult.permalink} target="_blank" rel="noreferrer noopener" leftIcon={<Instagram className="h-4 w-4" />} rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
              View post on Instagram
            </Button>
          )}

          <dl className="mx-auto max-w-sm space-y-1 rounded-md border border-line bg-paper/60 p-4 text-left text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Post ID</dt>
              <dd className="font-mono text-[12px]">{publishResult.mediaId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Published</dt>
              <dd className="font-medium">{new Date(publishResult.publishedAt).toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Version</dt>
              <dd className="font-mono text-[12px]">v{publishResult.versionNumber}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left: image + target account */}
          <div className="space-y-4 lg:col-span-5">
            <div className="stage-dots relative flex aspect-[4/5] items-center justify-center rounded-lg border-2 border-ink p-3">
              <img src={fullImageUrl} alt="Meme to publish" className="max-h-full max-w-full rounded-sm border-2 border-ink bg-ink object-contain shadow-hard-marker" />
              <span className="absolute bottom-2 right-2 rounded-full bg-ink/80 px-2 py-0.5 font-mono text-[10px] text-paper/80">4:5 · feed</span>
            </div>

            <div className="flex items-center gap-3 rounded-md border border-line bg-paper/60 p-3.5">
              {loadingAccount ? (
                <span className="flex items-center gap-2 text-[13px] text-muted" role="status">
                  <Spinner /> Checking the account…
                </span>
              ) : account ? (
                <>
                  {account.profilePictureUrl ? (
                    <img src={account.profilePictureUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border-2 border-ink object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white">
                      <Instagram className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-bold">
                      @{account.username} <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
                    </p>
                    <p className="font-mono text-[11px] text-muted">Connected · ready to publish</p>
                  </div>
                </>
              ) : (
                <span className="flex items-center gap-2 text-[13px] font-medium text-bad">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Not connected. Connect it in Settings → Instagram.
                </span>
              )}
            </div>
          </div>

          {/* Right: caption, hashtags */}
          <div className="space-y-5 lg:col-span-7">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="ig-caption" className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Caption
                </label>
                <span className={cn('tabular font-mono text-[12px]', charCount > 2200 ? 'font-bold text-bad' : charCount > 2000 ? 'font-semibold text-warn' : 'text-muted')}>
                  {charCount.toLocaleString()} / 2,200
                </span>
              </div>
              <Textarea
                id="ig-caption"
                rows={7}
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Write a caption for your meme…"
                className="telugu-input !text-[15px] !leading-relaxed"
                invalid={charCount > 2200}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Hash className="h-3.5 w-3.5" aria-hidden="true" /> Hashtags
                </span>
                <span className={cn('tabular font-mono text-[12px]', hashtagCount > 25 ? 'font-semibold text-warn' : 'text-muted')}>{hashtagCount} / 30</span>
              </div>

              <div className="thin-scrollbar flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pb-1">
                {Array.from(new Set([...DEFAULT_HASHTAGS, ...selectedHashtags])).map(tag => {
                  const active = selectedHashtags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleHashtag(tag)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-full border px-3 py-1 font-mono text-[12px] font-medium transition-all',
                        active ? 'border-ink bg-marker-soft text-ink shadow-hard-sm' : 'border-line-strong bg-surface text-muted hover:border-ink hover:text-ink'
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <form onSubmit={addCustomHashtag} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={customHashtag}
                  onChange={e => setCustomHashtag(e.target.value)}
                  placeholder="Add your own hashtag"
                  aria-label="Add a custom hashtag"
                  className="field !py-2 font-mono !text-[13px]"
                />
                <Button type="submit" variant="secondary" disabled={!customHashtag.trim() || hashtagCount >= 30}>
                  Add
                </Button>
              </form>
            </div>

            {error && <Alert tone="bad">{error}</Alert>}
            {publishing && (
              <Alert tone="info" icon={Upload}>
                <span role="status">{publishProgress || 'Publishing to Instagram…'}</span>
              </Alert>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}
