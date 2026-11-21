import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, Instagram, KeyRound, LogOut, MessageCircle, Moon, RefreshCw, Search, Sun, WifiOff } from 'lucide-react';
import { useTheme } from './theme/ThemeProvider';
import { useAuth } from './auth/AuthProvider';
import ErrorBoundary from './app/ErrorBoundary';
import PageSkeleton from './app/PageSkeleton';
import useScrollRestoration from './app/useScrollRestoration';
import { HIDDEN_PAGES, NAV_GROUPS, PAGES, REDIRECTS, TAB_ITEMS, pageForPath, preloadPage, prefetchAllWhenIdle } from './app/routes';
import { MOD_KEY, isTypingTarget } from './app/platform';
import { BRAND } from './brand';
import { API_BASE } from './api';
import { Button, Elapsed, LogoMark, cn, useBusy, useConfirm, useOnline, useSystemStatus } from './ui';
import { currentStageTitle, useAdaptation } from './adapt/AdaptationProvider';

// The Ctrl+K palette is downloaded the first time it is opened (or while the app is idle), never with the first screen.
const loadPalette = () => import('./app/CommandPalette');
const CommandPalette = lazy(loadPalette);

/** NavLink that asks before leaving while a meme is being generated. */
function GuardedNavLink({ to, end, className, children, ...rest }) {
  const { busy } = useBusy();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();

  const onClick = async e => {
    if (!busy || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (location.pathname === to) return;
    e.preventDefault();
    const leave = await confirm({
      title: 'Leave while your meme is being made?',
      body: 'It keeps running on the server and will be saved in My Memes when it finishes. You will get a notification here, but this page will stop showing progress.',
      confirmLabel: 'Leave anyway',
      cancelLabel: 'Stay here'
    });
    if (leave) navigate(to);
  };
  // start downloading the page as soon as the pointer or keyboard reaches its link, so the click feels instant
  const warm = () => preloadPage(pageForPath(to));

  return (
    <NavLink to={to} end={end} className={className} onClick={onClick} onPointerEnter={warm} onFocus={warm} {...rest}>
      {children}
    </NavLink>
  );
}

/** Sign out, asking first when a meme is still being made (signing out ends this page's progress view). */
function useSignOut() {
  const { logout } = useAuth();
  const { busy } = useBusy();
  const confirm = useConfirm();
  return async () => {
    if (busy) {
      const ok = await confirm({
        title: 'Sign out while a meme is being made?',
        body: 'It keeps running on the server and will be saved in My Memes, but this page stops showing its progress.',
        confirmLabel: 'Sign out',
        cancelLabel: 'Stay signed in'
      });
      if (!ok) return;
    }
    await logout();
  };
}

/** Who is signed in, and the way out. Hidden when the server has login switched off. */
function AccountRow() {
  const { username, authEnabled } = useAuth();
  const signOut = useSignOut();
  if (!authEnabled || !username) return null;
  return (
    <div className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.05] py-2 pl-2.5 pr-1.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink bg-marker font-display text-[14px] font-extrabold uppercase text-ink" aria-hidden="true">
        {username.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold leading-tight text-white" title={username}>
          {username}
        </span>
        <span className="block font-mono text-[11px] text-paper/65">Owner</span>
      </span>
      <button
        type="button"
        onClick={signOut}
        title="Sign out"
        aria-label={`Sign out ${username}`}
        className="grid h-9 w-9 shrink-0 place-items-center rounded text-paper/75 transition-colors hover:bg-white/[0.1] hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

/** One line of the engine status: a dot and a sentence. */
function StatusLine({ tone, children }) {
  const dot = { ok: 'bg-live', bad: 'bg-coral', idle: 'bg-paper/30', warn: 'bg-marker' }[tone];
  return (
    <li className="flex items-center gap-2.5 text-[13px] text-paper/80">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', dot, tone === 'idle' && 'animate-pulse')} aria-hidden="true" />
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}

/** The WhatsApp token is the one thing that expires by itself: say so before the bot goes quiet. */
function whatsappNotice(wa) {
  if (!wa) return null;
  if (wa.problem === 'expired') return { tone: 'bad', text: 'WhatsApp token expired' };
  if (wa.problem === 'rejected') return { tone: 'bad', text: 'WhatsApp rejected the token' };
  if (wa.problem === 'unreadable') return { tone: 'bad', text: 'WhatsApp token unreadable' };
  if (wa.problem === 'missing') return { tone: 'warn', text: 'WhatsApp token not set' };
  if (wa.problem === 'incomplete') return { tone: 'warn', text: 'WhatsApp setup incomplete' };
  if (wa.expiresAt) {
    const left = new Date(wa.expiresAt).getTime() - Date.now();
    if (left > 0 && left < 24 * 3600 * 1000) return { tone: 'warn', text: `WhatsApp token ends in ${Math.max(1, Math.round(left / 3600000))} h` };
  }
  return null;
}

function EngineStatus() {
  const { phase, providersOn, visionReady, refresh, data } = useSystemStatus();
  const wa = whatsappNotice(data?.whatsapp);
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.05] p-3.5" role="status" aria-live="polite">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="font-mono text-micro uppercase text-paper/65">Engine</p>
        {phase === 'down' && (
          <button type="button" onClick={refresh} className="inline-flex items-center gap-1 text-[12px] font-semibold text-marker hover:text-white">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        )}
      </div>
      <ul className="space-y-2">
        {phase === 'loading' && <StatusLine tone="idle">Checking the engine…</StatusLine>}
        {phase === 'down' && <StatusLine tone="bad">Offline: backend not reachable</StatusLine>}
        {phase === 'ok' && <StatusLine tone="ok">Engine online</StatusLine>}
        {phase !== 'loading' && phase !== 'down' && (
          <>
            <StatusLine tone={providersOn > 0 ? 'ok' : 'bad'}>
              {providersOn} image source{providersOn === 1 ? '' : 's'} on
            </StatusLine>
            <StatusLine tone={visionReady === false ? 'bad' : 'ok'}>{visionReady === false ? (data?.visionCli?.keyIgnored ? 'Gemini API key looks wrong' : data?.visionCli?.backend === 'gemini-api' ? 'Gemini API key missing' : 'AI vision not set up') : data?.visionCli?.backend === 'gemini-api' ? 'AI vision ready · Gemini API' : 'AI vision ready'}</StatusLine>
            {wa && (
              <StatusLine tone={wa.tone}>
                <NavLink to="/settings?section=whatsapp" className="font-semibold underline decoration-marker decoration-2 underline-offset-2 hover:text-white">
                  {wa.text}
                </NavLink>
              </StatusLine>
            )}
          </>
        )}
      </ul>
      <NavLink to="/health" className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[12px] font-semibold text-paper/65 transition-colors hover:text-marker">
        Full health check
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </NavLink>
    </div>
  );
}

/**
 * A meme is being made and you are on another page: say so, with the stage and the clock, and one tap back to it.
 * Not shown on the page that already shows the progress.
 */
function JobPill({ variant }) {
  const job = useAdaptation();
  const { pathname } = useLocation();
  if (!job.running || pathname === '/') return null;
  const dark = variant === 'dark';
  return (
    <NavLink
      to="/"
      aria-label="A meme is being made. Open its progress"
      className={cn(
        'group flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors',
        dark ? 'border-marker/40 bg-marker/10 text-paper hover:bg-marker/20' : 'border-2 border-ink bg-marker text-ink shadow-hard-sm'
      )}
    >
      <span className={cn('h-8 w-1.5 shrink-0 rounded-full', dark ? 'working-bar animate-stripes' : 'animate-pulse bg-ink')} aria-hidden="true" />
      <span className="min-w-0 flex-1 text-[13px] leading-tight">
        <span className="block font-bold">Making your meme</span>
        <span className={cn('block truncate text-[12px]', dark ? 'text-paper/70' : 'text-ink/70')}>{currentStageTitle(job.view)}</span>
      </span>
      <span className={cn('tabular font-mono text-[14px] font-semibold', dark && 'text-marker')}>
        <Elapsed since={job.startedAt} />
      </span>
    </NavLink>
  );
}

/** The quick Night studio switch: shows what you will get (a moon in daylight, a sun at night). */
function ThemeSwitch({ className }) {
  const { theme, toggle, mode } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to the light studio' : 'Switch on Night studio';
  return (
    <button type="button" onClick={toggle} aria-label={label} title={`${label}${mode === 'auto' ? ' (now automatic: dark from 7 pm)' : ''}`} className={className}>
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

function Sidebar({ onOpenPalette }) {
  return (
    <aside className="on-ink fixed inset-y-0 left-0 z-50 hidden w-[252px] flex-col bg-ink text-paper md:flex">
      <NavLink to="/" className="group flex items-center gap-3 px-5 pb-5 pt-6" aria-label={`${BRAND.product}, home`}>
        <LogoMark size="md" className="transition-transform duration-200 group-hover:-rotate-6" />
        <span className="min-w-0">
          <span className="block font-display text-[19px] font-extrabold leading-none tracking-[-0.02em] text-white">{BRAND.product}</span>
          <span className="mt-1.5 block truncate font-mono text-[11px] text-paper/65">{BRAND.handle}</span>
        </span>
      </NavLink>

      <div className="flex gap-2 px-3 pb-1">
        <button
          type="button"
          onClick={onOpenPalette}
          onPointerEnter={loadPalette}
          onFocus={loadPalette}
          aria-label={`Search and jump (${MOD_KEY} K)`}
          className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded border border-white/10 bg-white/[0.05] px-3 text-left text-[13px] text-paper/65 transition-colors hover:bg-white/[0.1] hover:text-white"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Jump to…</span>
          <kbd className="rounded border border-white/15 px-1.5 font-mono text-[11px] leading-5 text-paper/60">{MOD_KEY} K</kbd>
        </button>
        <ThemeSwitch className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.05] text-paper/65 transition-colors hover:bg-white/[0.1] hover:text-marker" />
      </div>

      <nav aria-label="Main" className="thin-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label} className="mt-5 first:mt-2">
            <p className="mb-1.5 px-3 font-mono text-micro uppercase text-paper/60">{group.label}</p>
            <ul className="space-y-1">
              {group.items.map(({ path, label, tag, icon: Icon, end }) => (
                <li key={path}>
                  <GuardedNavLink
                    to={path}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'group flex h-10 items-center gap-3 rounded px-3 text-[14px] font-semibold transition-colors',
                        isActive ? 'bg-marker text-ink shadow-[2px_2px_0_0_rgb(255_255_255/0.22)]' : 'text-paper/70 hover:bg-white/[0.08] hover:text-white'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                        <span className="flex-1 truncate">{label}</span>
                        {tag && (
                          <span className={cn('rounded px-1.5 py-px font-mono text-[10px] font-medium uppercase tracking-wider', isActive ? 'bg-ink/10 text-ink' : 'bg-white/10 text-paper/60')}>
                            {tag}
                          </span>
                        )}
                      </>
                    )}
                  </GuardedNavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-white/10 p-3">
        <JobPill variant="dark" />
        <EngineStatus />
        <div className="space-y-1">
          <a
            href={BRAND.whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex items-center gap-3 rounded px-2.5 py-2 text-[13px] text-paper/75 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-white/10 text-paper"><MessageCircle className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">WhatsApp bot</span>
              <span className="block truncate font-mono text-[11px] text-paper/65">{BRAND.whatsappDisplay}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </a>
          <a
            href={BRAND.instagramUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="group flex items-center gap-3 rounded px-2.5 py-2 text-[13px] text-paper/75 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-gradient-to-tr from-amber-400 via-rose-500 to-purple-600 text-white"><Instagram className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold leading-tight">Instagram</span>
              <span className="block truncate font-mono text-[11px] text-paper/65">{BRAND.handle}</span>
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
          </a>
        </div>
        <AccountRow />
      </div>
    </aside>
  );
}

function MobileHeader({ onOpenPalette }) {
  const { phase } = useSystemStatus();
  const { username, authEnabled } = useAuth();
  const signOut = useSignOut();
  const dot = phase === 'ok' ? 'bg-ok' : phase === 'down' ? 'bg-bad' : 'bg-faint animate-pulse';
  const label = phase === 'ok' ? 'Engine online' : phase === 'down' ? 'Engine offline' : 'Checking the engine';
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur-md md:hidden">
      <GuardedNavLink to="/" className="flex min-w-0 shrink items-center gap-2.5" aria-label={`${BRAND.product}, home`}>
        <LogoMark size="sm" />
        <span className="whitespace-nowrap font-display text-[17px] font-extrabold tracking-[-0.02em]">{BRAND.product}</span>
      </GuardedNavLink>
      <div className="flex shrink-0 items-center gap-1">
        {/* on the narrowest phones the status is just its coloured dot (the words stay for screen readers) */}
        <span className="mr-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-3" role="status" title={label}>
          <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
          <span className="sr-only min-[420px]:not-sr-only">{label}</span>
        </span>
        <button type="button" onClick={onOpenPalette} aria-label="Search and jump" title="Search, open WhatsApp or Instagram, and more" className="grid h-10 w-10 shrink-0 place-items-center rounded text-ink-3 hover:bg-ink/[0.07]">
          <Search className="h-[18px] w-[18px]" />
        </button>
        <ThemeSwitch className="grid h-10 w-10 shrink-0 place-items-center rounded text-ink-3 hover:bg-ink/[0.07]" />
        {authEnabled && username && (
          <button type="button" onClick={signOut} aria-label={`Sign out ${username}`} title="Sign out" className="grid h-10 w-10 shrink-0 place-items-center rounded text-ink-3 hover:bg-ink/[0.07]">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav aria-label="Main" className="on-ink safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink px-2 pt-1.5 md:hidden">
      <ul className="mx-auto flex max-w-md justify-around">
        {TAB_ITEMS.map(({ path, short, icon: Icon, end }) => (
          <li key={path} className="flex-1">
            <GuardedNavLink to={path} end={end} className="group flex flex-col items-center gap-1 py-1.5 text-[11px] font-semibold">
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive ? 'bg-marker text-ink' : 'text-paper/65 group-hover:text-white')}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  <span className={isActive ? 'text-white' : 'text-paper/60'}>{short}</span>
                </>
              )}
            </GuardedNavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Reminder while the server uses a fixed, guessable login. Dismiss it for this visit; it returns at the next sign-in. */
function StaticLoginBanner() {
  const { staticLogin, staticWeak } = useAuth();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem('meme_engine_static_login_notice') === '1';
    } catch {
      return false;
    }
  });
  if (!staticLogin || hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      sessionStorage.setItem('meme_engine_static_login_notice', '1');
    } catch {
      /* storage unavailable: it just comes back on reload */
    }
  };
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-ink">
      <KeyRound className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
      <p className="min-w-0 flex-[1_1_16rem]">
        <strong className="font-bold">Temporary login.</strong> {staticWeak ? 'Its password is easy to guess, so anyone who finds this address can sign in and publish to Instagram.' : 'It is set in the server settings.'} Replace it before you share the link.
      </p>
      <NavLink to="/settings?section=account" className="inline-flex min-h-9 items-center font-semibold underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
        How to change it
      </NavLink>
      <Button size="sm" variant="secondary" onClick={dismiss}>
        Dismiss
      </Button>
    </div>
  );
}

/**
 * One honest message about connectivity, never two at once:
 *  - no internet but the server answers (a local studio): it still works, only the outside-world actions pause;
 *  - no internet and no server (a hosted studio): nothing can load, but what is on screen is kept;
 *  - internet fine but the server is down: say how to start it.
 */
function ConnectionBanner() {
  const online = useOnline();
  const { phase, refresh } = useSystemStatus();
  const down = phase === 'down';
  if (online && !down) return null;

  if (!online && !down) {
    return (
      <div role="status" className="mb-6 flex animate-slide-in flex-wrap items-center gap-3 rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-[13px]">
        <WifiOff className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
        <p className="min-w-0 flex-[1_1_16rem] text-ink">
          <strong className="font-bold">No internet connection.</strong> The studio itself still works, but making memes, finding pictures and publishing need the internet. They pick up again by themselves when it returns.
        </p>
      </div>
    );
  }

  if (!online) {
    return (
      <div role="alert" className="mb-6 flex animate-slide-in flex-wrap items-center gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-[13px]">
        <WifiOff className="h-4 w-4 shrink-0 text-bad" aria-hidden="true" />
        <p className="min-w-0 flex-[1_1_16rem] text-ink">
          <strong className="font-bold">You're offline.</strong> The studio can't reach its server. Whatever is on this screen is kept, and it reconnects by itself as soon as the internet is back.
        </p>
        <Button size="sm" variant="secondary" onClick={refresh} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Try now
        </Button>
      </div>
    );
  }

  return (
    <div role="alert" className="mb-6 flex animate-slide-in flex-wrap items-center gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-[13px] text-bad">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-[1_1_16rem] text-ink">
        <strong className="font-bold">Can't reach the engine</strong>
        {API_BASE ? <> at <code className="font-mono text-[12px]">{API_BASE}</code></> : null}. Start it with <code className="font-mono text-[12px]">npm start</code> in <code className="font-mono text-[12px]">memeEngine_be</code>. Retrying automatically.
      </p>
      <Button size="sm" variant="secondary" onClick={refresh} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
        Retry now
      </Button>
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const signOut = useSignOut();
  const { username, authEnabled } = useAuth();
  const { refresh: refreshStatus } = useSystemStatus();
  const { theme, toggle: toggleTheme } = useTheme();

  // Ctrl/⌘+K from anywhere; "/" too when not typing in a field
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteWanted, setPaletteWanted] = useState(false);
  const openPalette = () => {
    setPaletteWanted(true);
    setPaletteOpen(true);
  };
  useEffect(() => {
    const onKey = e => {
      if (e.altKey || e.defaultPrevented) return;
      const combo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !isTypingTarget(e.target);
      if (!combo && !slash) return;
      // another dialog (a confirmation, the sign-in prompt) is open: leave it alone
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-palette])')) return;
      e.preventDefault();
      setPaletteWanted(true);
      setPaletteOpen(o => (combo ? !o : true));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // fetch the palette's code once everything else is quiet (not on data-saver or slow connections)
  useEffect(() => {
    const c = navigator.connection;
    if (c && (c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || ''))) return undefined;
    const t = setTimeout(() => loadPalette().catch(() => {}), 6000);
    return () => clearTimeout(t);
  }, []);

  // a new page starts at the top; Back returns to where you were
  useScrollRestoration();
  // while the app is idle, fetch the other pages so every click is instant
  useEffect(() => prefetchAllWhenIdle(), []);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-[100] rounded bg-marker px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Sidebar onOpenPalette={openPalette} />
      <MobileHeader onOpenPalette={openPalette} />

      <div className="md:pl-[252px]">
        <main id="main" className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-6 sm:px-6 md:pb-16 md:pt-10 lg:px-10">
          <div className="mb-5 empty:hidden md:hidden">
            <JobPill />
          </div>
          <ConnectionBanner />
          <StaticLoginBanner />
          <ErrorBoundary resetKey={location.pathname}>
            {/* the Suspense boundary sits ABOVE the keyed page: while the next page's code arrives the current page stays on screen */}
            <Suspense fallback={<PageSkeleton />}>
              <div key={location.pathname} className="page-enter">
                <Routes>
                  {PAGES.map(page => (
                    <Route key={page.id} path={page.path} element={<page.component {...(page.props ? page.props(navigate) : {})} />} />
                  ))}
                  {HIDDEN_PAGES.map(page => (
                    <Route key={page.id} path={page.path} element={<page.component />} />
                  ))}
                  {REDIRECTS.map(([from, to]) => (
                    <Route key={from} path={from} element={<Navigate to={to} replace />} />
                  ))}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <BottomNav />

      {paletteWanted && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} ctx={{ navigate, signOut, refreshStatus, user: { username, authEnabled }, theme, toggleTheme }} />
        </Suspense>
      )}
    </div>
  );
}
