import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, ExternalLink, Globe, Instagram, Key, Layers, LogOut, Radio, RefreshCw, ShieldCheck } from 'lucide-react';
import { instagramApi } from './settingsModel';
import { Alert, Badge, Button, Card, Disclosure, Skeleton, useConfirm } from '../../ui';

const Code = ({ children }) => <code className="rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>;

export default function InstagramSection() {
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const initialStatusRef = useRef(searchParams.get('status'));
  const initialMessageRef = useRef(searchParams.get('message'));
  const initialUsernameRef = useRef(searchParams.get('username'));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState(() => {
    if (initialStatusRef.current === 'error') {
      return initialMessageRef.current || 'Instagram authorization was cancelled or denied.';
    }
    return null;
  });
  const [successMsg, setSuccessMsg] = useState(null);

  // Clean the URL query params so they don't persist on subsequent page refreshes
  useEffect(() => {
    if (initialStatusRef.current || initialMessageRef.current || initialUsernameRef.current) {
      window.history.replaceState({}, '', window.location.pathname + '?section=instagram');
    }
  }, []);

  const loadStatus = useCallback(async (isRedirectCheck = false) => {
    setLoading(true);
    try {
      const res = await instagramApi.getAccount();
      setData(res);

      if (isRedirectCheck && initialStatusRef.current === 'connected') {
        if (res?.connected && res?.account) {
          setSuccessMsg(`Successfully connected Instagram account @${res.account.username}!`);
          setError(null);
        } else {
          setError('Meta OAuth redirected back, but the Instagram account could not be found or saved in the database. Please try connecting again.');
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load Instagram connection status from backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus(Boolean(initialStatusRef.current));
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { url } = await instagramApi.getAuthUrl();
      if (!url) throw new Error('Backend failed to generate authorization URL.');
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Failed to initiate Meta OAuth.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Disconnect @kanyaraasi_memes?',
      body: 'You will need to reconnect before publishing memes to Instagram. Memes you already published stay on Instagram.',
      confirmLabel: 'Disconnect',
      tone: 'danger'
    });
    if (!ok) return;
    setDisconnecting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await instagramApi.disconnect();
      setSuccessMsg('Instagram account has been disconnected.');
      await loadStatus(false);
    } catch (err) {
      setError(err.message || 'Failed to disconnect account.');
    } finally {
      setDisconnecting(false);
    }
  };

  const isConnected = data?.connected && data?.account;
  const account = data?.account;

  return (
    <div className="space-y-5">
      {/* Feedback alerts */}
      {successMsg && (
        <Alert tone="ok" title="Done" action={<Button variant="ghost" size="sm" onClick={() => setSuccessMsg(null)}>Dismiss</Button>}>
          {successMsg}
        </Alert>
      )}
      {error && (
        <Alert tone="bad" title="Connection notice" action={<Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
          {error}
        </Alert>
      )}

      {data?.missingSecret && (
        <Alert tone="warn" icon={Key} title="Meta app secret required">
          <p>To finish the OAuth token exchange, add your Meta App Secret to <Code>memeEngine_be/.env</Code>:</p>
          <p className="mt-2">
            <Code>META_APP_SECRET=&lt;your_meta_app_secret_here&gt;</Code>
          </p>
          <p className="mt-2 text-[12px]">
            Found in Meta Developer Dashboard → <strong>Mythri Restaurant (1157226127472052)</strong> → App Settings → Basic → App Secret.
          </p>
        </Alert>
      )}

      {loading && !data ? (
        <Card pad="lg" aria-busy="true" aria-label="Checking Instagram connection">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 !rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
            </div>
          </div>
        </Card>
      ) : isConnected ? (
        <Card pad="lg" tone="sticker">
          <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className="relative">
                {account.profilePictureUrl ? (
                  <img src={account.profilePictureUrl} alt="" className="h-16 w-16 rounded-lg border-2 border-ink object-cover shadow-hard-sm" />
                ) : (
                  <span className="grid h-16 w-16 place-items-center rounded-lg border-2 border-ink bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white shadow-hard-sm">
                    <Instagram className="h-8 w-8" />
                  </span>
                )}
                <span className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-marker">
                  <CheckCircle2 className="h-3.5 w-3.5 text-ink" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-[20px] font-extrabold tracking-tight">@{account.username}</h4>
                  <Badge tone="ok" dot size="sm">
                    Connected
                  </Badge>
                </div>
                <p className="mt-0.5 font-mono text-[12px] text-muted">
                  ID {account.instagramUserId}
                  {account.facebookPageName && ` · linked to ${account.facebookPageName}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="secondary" onClick={handleConnect} loading={connecting} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Reconnect
              </Button>
              <Button variant="danger-soft" onClick={handleDisconnect} loading={disconnecting} leftIcon={<LogOut className="h-4 w-4" />}>
                Disconnect
              </Button>
            </div>
          </div>

          {/* Account details & token status */}
          <div className="grid grid-cols-1 gap-3.5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-md border border-line bg-paper/60 p-4">
              <p className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Token validity
              </p>
              <p className="text-[15px] font-bold">{account.daysUntilExpiration !== undefined ? `${account.daysUntilExpiration} days remaining` : 'Active'}</p>
              <p className="mt-0.5 text-[12px] text-muted">{account.tokenExpiresAt ? `Valid until ${new Date(account.tokenExpiresAt).toLocaleDateString()}` : 'Long-lived 60-day token'}</p>
            </div>

            <div className="rounded-md border border-line bg-paper/60 p-4">
              <p className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-muted">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Token security
              </p>
              <p className="text-[15px] font-bold">AES-256-GCM encrypted</p>
              <p className="mt-0.5 text-[12px] text-muted">Encrypted at rest · never sent to the browser</p>
            </div>

            <div className="rounded-md border border-line bg-paper/60 p-4 sm:col-span-2 lg:col-span-1">
              <p className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-muted">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" /> Permissions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(account.scopes?.length ? account.scopes : ['instagram_basic', 'instagram_content_publish']).map(s => (
                  <Badge key={s} tone="neutral" mono size="sm">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card pad="lg">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-5">
              <span className="grid h-16 w-16 shrink-0 -rotate-3 place-items-center rounded-lg border-2 border-ink bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white shadow-hard">
                <Instagram className="h-8 w-8" />
              </span>
              <div>
                <h4 className="text-[20px] font-extrabold tracking-tight">Connect @kanyaraasi_memes</h4>
                <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">
                  Connect your Instagram Professional or Creator account with Meta Unified Login. Once connected, memes made in the studio can be reviewed and published, with captions, straight to your feed.
                </p>
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={handleConnect} loading={connecting} leftIcon={<Instagram className="h-[18px] w-[18px]" />} className="w-full shrink-0 md:w-auto">
              {connecting ? 'Redirecting to Meta…' : 'Connect Instagram'}
            </Button>
          </div>

          {/* How the connection is secured */}
          <div className="mt-7 grid grid-cols-1 gap-4 border-t border-line pt-6 md:grid-cols-3">
            <div className="flex items-start gap-3 text-[13px]">
              <Radio className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Unified Login</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                  Uses Login Configuration ID <Code>1684279023426778</Code> in Meta App <Code>1157226127472052</Code>.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-[13px]">
              <Globe className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Public tunnel endpoint</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                  Callback routed through the ngrok domain <Code>jailer-effective-wiring.ngrok-free.dev</Code>.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-[13px]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">CSRF and at-rest encryption</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">State parameters are verified on every exchange; access tokens are encrypted with AES-256-GCM in MongoDB.</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Meta developer dashboard checklist: needed once, so it stays folded */}
      <Card pad="none" tone="muted" className="px-5 sm:px-6">
        <Disclosure icon={ExternalLink} title="Meta developer dashboard checklist" summary="Settings that must be saved in the Meta app (Mythri Restaurant)">
          <ul className="list-inside list-disc space-y-2.5 text-[13px] leading-relaxed text-ink-3">
            <li>
              <strong className="text-ink">Valid OAuth redirect URI:</strong> <Code>https://jailer-effective-wiring.ngrok-free.dev/api/instagram/auth/callback</Code>
            </li>
            <li>
              <strong className="text-ink">App domains:</strong> <Code>jailer-effective-wiring.ngrok-free.dev</Code>
            </li>
            <li>
              <strong className="text-ink">Permissions in Login Configuration 1684279023426778:</strong> <Code>instagram_basic</Code>, <Code>instagram_content_publish</Code>, <Code>pages_show_list</Code>.
            </li>
            <li>
              <strong className="text-ink">Professional account:</strong> <Code>@kanyaraasi_memes</Code> must be a Professional (Creator or Business) account connected to your Facebook Page in Meta Business Suite.
            </li>
          </ul>
        </Disclosure>
      </Card>
    </div>
  );
}
