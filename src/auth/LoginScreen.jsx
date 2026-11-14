import React, { useState } from 'react';
import { Check, Copy, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { useAuth } from './AuthProvider';
import SignInForm from './SignInForm';
import { BRAND } from '../brand';
import { API_BASE } from '../api';
import { Alert, Button, LogoMark, useDocumentTitle } from '../ui';

const COLLAGE = [
  { src: '/samples/phase2-facts-collage.png', style: { left: 0, top: 46, '--r': '-6deg', animationDelay: '0s', zIndex: 1 } },
  { src: '/samples/phase2-comparison-columns.png', style: { left: 150, top: 0, '--r': '3deg', animationDelay: '-2.2s', zIndex: 2 } },
  { src: '/samples/phase2-movie-update.png', style: { left: 300, top: 84, '--r': '-2deg', animationDelay: '-4.4s', zIndex: 3 } }
];

/** Splash while the app asks the server whether you are signed in (a blink on a local server). */
export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center" role="status" aria-label="Opening the studio">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size="lg" className="animate-pulse" />
        <p className="font-mono text-micro uppercase text-muted">Opening the studio</p>
      </div>
    </div>
  );
}

function CopyCommand({ command }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: the command is selectable text */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border-2 border-ink bg-ink px-4 py-3">
      <code className="select-all font-mono text-[13px] text-marker">{command}</code>
      <Button variant="on-ink" size="sm" onClick={copy} leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

/** The page you see when signed out: a private studio, a form, and nothing else to click. */
export default function LoginScreen() {
  useDocumentTitle('Sign in');
  const { status, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  const recheck = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---- left: the brand, with the memes doing the talking ---- */}
      <aside className="stage-dots on-ink relative hidden flex-col justify-between overflow-hidden px-12 py-12 text-paper lg:flex" aria-hidden="true">
        <div className="flex items-center gap-3">
          <LogoMark size="md" />
          <span className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-white">{BRAND.product}</span>
        </div>

        <div>
          <h2 className="max-w-md text-[52px] font-extrabold leading-[1.02] tracking-[-0.035em] text-white">
            Your memes, made <span className="inline-block -rotate-1 rounded-sm bg-marker px-2.5 text-ink shadow-[3px_3px_0_0_rgb(255_255_255/0.2)]">right.</span>
          </h2>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-paper/70">The studio behind {BRAND.handle}. Adapt viral formats, verify every picture, post to Instagram.</p>
        </div>

        <div className="relative mx-auto mb-2 h-[400px] w-full max-w-[540px]">
          {COLLAGE.map(c => (
            <div key={c.src} className="absolute w-[230px] animate-float overflow-hidden rounded-sm border-2 border-ink bg-ink shadow-hard-marker" style={c.style}>
              <img src={c.src} alt="" className="aspect-[4/5] w-full object-cover object-top" draggable="false" />
            </div>
          ))}
        </div>
      </aside>

      {/* ---- right: the form ---- */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="page-enter w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <LogoMark size="md" />
            <span className="font-display text-[20px] font-extrabold tracking-[-0.02em]">{BRAND.product}</span>
          </div>

          <p className="mb-3 inline-flex items-center gap-2 font-mono text-micro uppercase text-muted">
            <span className="h-2 w-2 rounded-full bg-marker ring-[1.5px] ring-ink" aria-hidden="true" /> Private studio
          </p>
          <h1 className="text-[36px] font-extrabold leading-[1.05] tracking-[-0.03em]">{status === 'setup' ? 'One-time setup' : status === 'offline' ? 'Server not reachable' : 'Welcome back'}</h1>
          <p className="mb-8 mt-3 text-[15px] leading-relaxed text-muted">
            {status === 'setup' ? 'Create the owner account once, then sign in here.' : status === 'offline' ? 'The studio cannot reach its server.' : `Sign in to manage ${BRAND.handle}.`}
          </p>

          {status === 'offline' && (
            <div className="space-y-4">
              <Alert tone="bad" icon={WifiOff} title="Can't reach the server">
                Is the backend running? Start it with <code className="font-mono text-[12px]">npm start</code> in <code className="font-mono text-[12px]">memeEngine_be</code>
                {API_BASE ? ` (looking at ${API_BASE})` : ''}.
              </Alert>
              <Button variant="dark" className="w-full" onClick={recheck} loading={checking} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Try again
              </Button>
            </div>
          )}

          {status === 'setup' && (
            <div className="space-y-4">
              <Alert tone="info" title="No owner account yet">
                There is no sign-up page on purpose: the owner is created on the computer that runs the server. In the <code className="font-mono text-[12px]">memeEngine_be</code> folder run:
              </Alert>
              <CopyCommand command="npm run auth:create-owner" />
              <p className="text-[13px] leading-relaxed text-muted">It asks for a username and a password (typed hidden). Then come back and press the button.</p>
              <Button variant="dark" className="w-full" onClick={recheck} loading={checking} leftIcon={<RefreshCw className="h-4 w-4" />}>
                I created it, check again
              </Button>
            </div>
          )}

          {status === 'anon' && <SignInForm />}

          <p className="mt-8 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>This studio is private to the page owner. Too many wrong passwords pause sign-in for a while.</span>
          </p>
        </div>
      </main>
    </div>
  );
}
