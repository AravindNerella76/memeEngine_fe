import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, KeyRound, MessageCircle, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { API_BASE, apiFetch } from '../api';
import { authRequest, useAuth } from './AuthProvider';
import QrCode from './QrCode';
import { Alert, Button, cn } from '../ui';

/**
 * Sign in by sending a code from WhatsApp.
 *
 * The page asks the server for a code, shows it (with a QR code on a computer, a one-tap button on a phone), and keeps
 * one request open to the server. The moment an allowed number sends the code to the bot, that request answers and the
 * studio opens. Codes last five minutes; a page that is being looked at gets a fresh one by itself when one runs out.
 */

const AUTO_RENEWALS = 5; // ~25 minutes of codes renewing by themselves, then a button (nobody is looking)
const SLOW_AFTER_MS = 45_000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clock = ms => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const isTouch = () => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

function cancelCode(token) {
  if (!token) return;
  try {
    fetch(`${API_BASE}/api/auth/whatsapp/cancel`, { method: 'POST', credentials: 'include', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => {});
  } catch {
    /* best effort: an unused code runs out by itself */
  }
}

function useNow(active, every = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}

/** Six digit tiles, split 3 + 3 like the code is read out. Each new code drops in. */
function CodeTiles({ code, compact, dim }) {
  const digits = String(code || '').padEnd(6, ' ').split('');
  const tile = cn(
    'grid place-items-center rounded-sm border-2 border-ink bg-surface font-mono font-bold tabular text-ink shadow-hard-sm',
    compact ? 'h-12 w-9 text-[24px]' : 'h-14 w-10 text-[27px] min-[400px]:h-[58px] min-[400px]:w-[46px] min-[400px]:text-[30px] sm:w-[50px]'
  );
  return (
    <div className={cn('flex items-center justify-center transition-opacity', compact ? 'gap-1.5' : 'gap-2', dim && 'opacity-35')} aria-hidden="true">
      {digits.map((d, i) => (
        <React.Fragment key={`${code}-${i}`}>
          {i === 3 && <span className={cn('shrink-0', compact ? 'w-1.5' : 'w-3')} />}
          <span className={cn(tile, code ? 'animate-pop' : 'animate-pulse bg-paper-2 text-transparent')} style={code ? { animationDelay: `${i * 45}ms` } : undefined}>
            {d.trim() || ' '}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function Step({ n, children }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="on-ink mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[11px] font-bold text-marker dark:ring-1 dark:ring-white/25" aria-hidden="true">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

function CopyButton({ text, label, done = 'Copied', className }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is on screen to type */
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={copy} className={cn('h-8 px-2.5', className)} leftIcon={copied ? <Check className="h-3.5 w-3.5 text-ok" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />} aria-label={copied ? done : label}>
      <span aria-live="polite">{copied ? done : 'Copy'}</span>
    </Button>
  );
}

export default function WhatsAppSignIn({ compact = false, onUsePassword }) {
  const { completeSignIn, refresh } = useAuth();
  const [phase, setPhase] = useState('starting'); // starting | waiting | approved | expired | cancelled | error
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState(null); // { code, message }
  const [rejectedFrom, setRejectedFrom] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [cancelledBy, setCancelledBy] = useState(null);
  const [approvedTail, setApprovedTail] = useState('');
  const [touch] = useState(isTouch);

  const tokenRef = useRef(null); // the code this page holds (also passed as "replaces" so renewing is never rate-limited)
  const mountedRef = useRef(false);
  const startedRef = useRef(false);
  const doneRef = useRef(false); // signed in: never cancel or renew again
  const renewalsRef = useRef(0);
  const kickRef = useRef(null);
  const busyRef = useRef(false);

  const start = useCallback(async ({ byHand = false } = {}) => {
    if (busyRef.current || doneRef.current) return;
    busyRef.current = true;
    if (byHand) renewalsRef.current = 0;
    setPhase('starting');
    setError(null);
    setRejectedFrom(null);
    setCancelledBy(null);
    setReconnecting(false);
    let out;
    try {
      out = await authRequest('POST', '/api/auth/whatsapp/start', tokenRef.current ? { replaces: tokenRef.current } : {});
    } catch {
      out = null;
    }
    busyRef.current = false;
    if (!mountedRef.current) {
      if (out?.res.ok) cancelCode(out.data.token);
      return;
    }
    if (!out) {
      setError({ code: 'network', message: 'Could not reach the server. Check your connection, then try again.' });
      setPhase('error');
      return;
    }
    const { res, data } = out;
    if (!res.ok) {
      if (data.code === 'setup_required' || data.code === 'auth_disabled') {
        refresh();
        return;
      }
      setError({ code: data.code || `http_${res.status}`, message: data.message || 'Could not get a sign-in code.' });
      setPhase('error');
      return;
    }
    // the server's clock decides when a code runs out; count down against it, not against this device's clock
    const skew = Date.parse(data.serverNow) - Date.now();
    tokenRef.current = data.token;
    setChallenge({ ...data, expiresAtLocal: Date.parse(data.expiresAt) - (Number.isFinite(skew) ? skew : 0), startedAt: Date.now() });
    setPhase('waiting');
  }, [refresh]);

  // first code (once, even under React's development double-mount); the code is cancelled when the panel goes away
  useEffect(() => {
    mountedRef.current = true;
    if (!startedRef.current) {
      startedRef.current = true;
      start();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [start]);
  useEffect(
    () => () => {
      // switched to the password, or the dialog closed: this code must not sign anyone in any more
      if (!doneRef.current && tokenRef.current) cancelCode(tokenRef.current);
    },
    []
  );

  const approved = useCallback(
    async data => {
      doneRef.current = true;
      tokenRef.current = null;
      setApprovedTail(data.phoneTail || '');
      setPhase('approved');
      await sleep(850); // long enough to see the tick; the studio is already signed in
      const r = await completeSignIn(data);
      if (!r.ok && mountedRef.current) {
        doneRef.current = false;
        setError(r);
        setPhase('error');
      }
    },
    [completeSignIn]
  );

  // one request held open at a time while the code waits; any answer is acted on at once
  useEffect(() => {
    if (phase !== 'waiting' || !challenge) return undefined;
    const token = challenge.token;
    let stopped = false;
    let ac = null;
    let backoff = 800;
    kickRef.current = () => ac?.abort();
    (async () => {
      while (!stopped) {
        ac = new AbortController();
        try {
          const res = await apiFetch(`${API_BASE}/api/auth/whatsapp/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: ac.signal });
          const data = await res.json().catch(() => ({}));
          if (stopped) return;
          if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
          setReconnecting(false);
          backoff = 800;
          if (data.status === 'pending') {
            setRejectedFrom(data.rejectedFrom || null);
            continue;
          }
          if (data.status === 'approved') return void approved(data);
          if (data.status === 'cancelled') {
            tokenRef.current = null;
            setCancelledBy(data.by || 'browser');
            setPhase('cancelled');
            return;
          }
          if (data.status === 'used') {
            tokenRef.current = null;
            // signed in after all (another tab of this browser collected it)? Then the studio simply opens.
            const me = await authRequest('GET', '/api/auth/me').catch(() => null);
            if (me?.data?.authenticated) return void refresh();
            // never quietly swap the code: the person just sent this one and WhatsApp told them it worked
            if (mountedRef.current && !stopped) {
              setError({ code: 'used', message: 'WhatsApp approved this code, but the sign-in did not reach this page in time. Nothing is wrong with your number: get a new code and send it again.' });
              setPhase('error');
            }
            return;
          }
          setPhase('expired'); // keep the token: renewing it does not count as a new code
          return;
        } catch {
          if (stopped) return;
          if (ac.signal.aborted) continue; // woken on purpose (the tab came back): ask again straight away
          setReconnecting(true);
          await sleep(backoff);
          backoff = Math.min(backoff * 2, 8000);
        }
      }
    })();
    return () => {
      stopped = true;
      ac?.abort();
      kickRef.current = null;
    };
  }, [phase, challenge, approved, refresh, start]);

  // back from WhatsApp (phones pause background pages): ask at once instead of waiting out a stale request
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (phase === 'waiting') kickRef.current?.();
      else if (phase === 'expired' && renewalsRef.current < AUTO_RENEWALS) {
        renewalsRef.current += 1;
        start();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [phase, start]);

  // a code ran out while someone is looking: the next one appears by itself
  useEffect(() => {
    if (phase === 'expired' && document.visibilityState === 'visible' && renewalsRef.current < AUTO_RENEWALS) {
      renewalsRef.current += 1;
      start();
    }
  }, [phase, start]);

  const now = useNow(phase === 'waiting');
  const left = challenge ? challenge.expiresAtLocal - now : 0;
  const total = (challenge?.ttlSeconds || 300) * 1000;
  const slow = phase === 'waiting' && challenge && now - challenge.startedAt > SLOW_AFTER_MS && !rejectedFrom;
  const bot = challenge?.bot;

  // ---- approved ------------------------------------------------------------------------------
  if (phase === 'approved') {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="assertive">
        <span className="grid h-[72px] w-[72px] animate-pop place-items-center rounded-full border-2 border-ink bg-marker shadow-hard">
          <Check className="h-9 w-9 text-ink" strokeWidth={3.2} aria-hidden="true" />
        </span>
        <p className="mt-5 font-display text-[22px] font-extrabold tracking-[-0.02em]">Approved on WhatsApp</p>
        <p className="mt-1.5 text-[14px] text-muted">
          {approvedTail ? (
            <>
              From the number ending <span className="font-mono font-semibold text-ink">{approvedTail}</span>.{' '}
            </>
          ) : null}
          Opening the studio…
        </p>
      </div>
    );
  }

  // ---- errors --------------------------------------------------------------------------------
  if (phase === 'error') {
    const unavailable = error?.code === 'whatsapp_unavailable';
    return (
      <div className="space-y-4">
        <Alert tone={unavailable ? 'info' : error?.code === 'too_many_codes' ? 'warn' : 'bad'} icon={error?.code === 'network' ? WifiOff : undefined} title={unavailable ? 'WhatsApp sign-in is not ready' : error?.code === 'session_not_kept' ? 'Signed in, but not kept' : error?.code === 'too_many_codes' ? 'Too many codes' : error?.code === 'used' ? 'That code reached WhatsApp, not this page' : 'Could not get a code'}>
          {error?.message}
        </Alert>
        <div className="flex gap-2.5">
          {onUsePassword && (
            <Button variant="dark" className="flex-1" onClick={onUsePassword} leftIcon={<KeyRound className="h-4 w-4" />}>
              Use password
            </Button>
          )}
          {error?.code !== 'session_not_kept' && (
            <Button variant={error?.code === 'used' ? 'primary' : 'secondary'} className={onUsePassword ? '' : 'w-full'} onClick={() => start({ byHand: true })} leftIcon={<RefreshCw className="h-4 w-4" />}>
              {error?.code === 'used' ? 'New code' : 'Try again'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- the code ------------------------------------------------------------------------------
  const ended = phase === 'expired' || phase === 'cancelled';
  const urgent = phase === 'waiting' && left < 60_000;
  return (
    <div className="space-y-5">
      <div className={cn('relative rounded-lg border-2 border-ink bg-paper-2/60', compact ? 'px-3 pb-4 pt-3.5' : 'px-4 pb-5 pt-4')}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="font-mono text-micro uppercase text-muted">Your sign-in code</p>
          {challenge && !ended && <CopyButton text={challenge.message} label={`Copy “${challenge.message}”`} done="Copied" className="-my-1 -mr-1.5" />}
        </div>

        <CodeTiles code={phase === 'starting' ? '' : challenge?.code} compact={compact} dim={ended} />
        {challenge && phase !== 'starting' && <p className="sr-only">Your code is {challenge.code.split('').join(' ')}</p>}

        {/* time left: a bar that drains, and words for screen readers */}
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className={cn('h-full rounded-full transition-[width] duration-1000 ease-linear', urgent ? 'bg-warn' : 'bg-ink')}
              style={{ width: phase === 'waiting' ? `${Math.max(0, Math.min(100, (left / total) * 100))}%` : ended ? '0%' : '100%' }}
            />
          </div>
          <p className={cn('mt-1.5 flex justify-between font-mono text-[11.5px] tabular', urgent ? 'font-semibold text-warn' : 'text-muted')}>
            <span>{phase === 'starting' ? 'Getting a code…' : phase === 'waiting' ? (urgent ? 'Running out' : 'Works once') : phase === 'cancelled' ? 'Cancelled' : 'Expired'}</span>
            <span>{phase === 'waiting' ? `${clock(left)} left` : ''}</span>
          </p>
        </div>
      </div>

      {phase === 'cancelled' && (
        <Alert tone="bad" icon={ShieldAlert} title={cancelledBy === 'whatsapp' ? 'Cancelled from WhatsApp' : cancelledBy === 'everywhere' ? 'Signed out everywhere' : 'This code was replaced'}>
          {cancelledBy === 'whatsapp'
            ? 'Someone tapped “That wasn’t me” on WhatsApp, so this sign-in was refused.'
            : cancelledBy === 'everywhere'
              ? 'Every sign-in and waiting code was ended from WhatsApp.'
              : 'A newer code was opened for this page, maybe in another tab.'}{' '}
          Get a new code if this was you.
        </Alert>
      )}

      {phase === 'expired' && (
        <Alert tone="neutral" title="That code expired">
          Codes last {Math.round(total / 60000)} minutes. Get a new one and send it within that time.
        </Alert>
      )}

      {ended && (
        <Button variant="primary" size="lg" className="w-full" onClick={() => start({ byHand: true })} leftIcon={<RefreshCw className="h-[18px] w-[18px]" />}>
          New code
        </Button>
      )}

      {!ended && (
        <>
          {rejectedFrom && (
            <Alert tone="warn" title="That number is not allowed">
              The code arrived from a number ending <span className="font-mono font-semibold">{rejectedFrom}</span>, which may not sign in. Send it from one of the allowed WhatsApp numbers (Settings › WhatsApp).
            </Alert>
          )}

          {touch ? (
            <>
              <Button as="a" href={challenge?.link || undefined} target="_blank" rel="noopener noreferrer" variant="primary" size="lg" className={cn('w-full', !challenge && 'pointer-events-none opacity-60')} aria-disabled={!challenge || undefined} leftIcon={<MessageCircle className="h-[18px] w-[18px]" />}>
                Send code on WhatsApp
              </Button>
              <ol className="space-y-2 text-[13.5px] leading-snug text-ink-3">
                <Step n={1}>WhatsApp opens with the code already typed.</Step>
                <Step n={2}>Send it from your allowed number.</Step>
                <Step n={3}>Come back here: the studio opens by itself.</Step>
              </ol>
            </>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className={cn('shrink-0 rounded-md border-2 border-ink bg-white p-1 shadow-hard-sm', !challenge && 'animate-pulse')}>
                  {challenge ? <QrCode value={challenge.link} size={compact ? 104 : 124} label={`QR code: opens WhatsApp with “${challenge.message}” ready to send`} /> : <div style={{ width: compact ? 104 : 124, height: compact ? 104 : 124 }} />}
                </div>
                <ol className="min-w-0 space-y-2 text-[13.5px] leading-snug text-ink-3">
                  <Step n={1}>Scan with your phone's camera.</Step>
                  <Step n={2}>
                    WhatsApp opens with <span className="whitespace-nowrap font-mono text-[12.5px] font-semibold text-ink">{challenge?.message || 'Login ······'}</span> typed. Send it.
                  </Step>
                  <Step n={3}>This page opens the studio by itself.</Step>
                </ol>
              </div>
              <Button as="a" href={challenge?.link || undefined} target="_blank" rel="noopener noreferrer" variant="secondary" className={cn('w-full', !challenge && 'pointer-events-none opacity-60')} aria-disabled={!challenge || undefined} leftIcon={<MessageCircle className="h-4 w-4" />}>
                Open WhatsApp on this computer
              </Button>
            </>
          )}

          {bot && (
            <p className="flex flex-wrap items-center gap-x-1.5 text-[12.5px] leading-relaxed text-muted">
              Or type the code yourself to
              {bot.name ? <strong className="font-semibold text-ink">{bot.name}</strong> : null}
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <span className="font-mono text-ink">{bot.display}</span>
                <CopyButton text={bot.display} label="Copy the bot's number" done="Copied" className="-my-1" />
              </span>
            </p>
          )}

          <div className="flex items-start gap-2.5 text-[13px]" aria-live="polite">
            {reconnecting ? (
              <>
                <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
                <span className="text-ink-3">Lost the server for a moment. Reconnecting…</span>
              </>
            ) : phase === 'waiting' ? (
              <>
                <span className="relative mt-[5px] h-2 w-2 shrink-0 animate-pulse-ring rounded-full bg-marker ring-[1.5px] ring-ink" aria-hidden="true" />
                <span className="font-semibold">Waiting for your WhatsApp message…</span>
              </>
            ) : (
              <span className="text-muted">Getting a fresh code…</span>
            )}
          </div>

          {slow && (
            <p className="animate-fade-in text-[12.5px] leading-relaxed text-muted">
              Sent it already? The bot answers on WhatsApp within a few seconds. No answer means its link to this server is down
              {onUsePassword ? (
                <>
                  {': '}
                  <Button variant="link" className="text-[12.5px]" onClick={onUsePassword}>
                    sign in with your password
                  </Button>{' '}
                  for now.
                </>
              ) : (
                '.'
              )}
            </p>
          )}

          {phase === 'waiting' && (
            <div className="flex justify-end">
              <Button variant="link" className="text-[12.5px] text-muted" onClick={() => start({ byHand: true })}>
                Get a different code
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
