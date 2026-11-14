import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, Instagram, KeyRound, LayoutGrid, LogOut, MessageCircle, Palette, RefreshCw, SlidersHorizontal, Sparkles, Wand2, WifiOff } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import CreateMemeForm from './components/CreateMemeForm';
import ViralAdaptationForm from './components/ViralAdaptationForm';
import MemeResultView from './components/MemeResultView';
import MyMemesGallery from './components/MyMemesGallery';
import StyleGuideView from './components/StyleGuideView';
import SettingsPage from './components/settings/SettingsPage';
import { BRAND } from './brand';
import { API_BASE } from './api';
import { Button, LogoMark, cn, useBusy, useConfirm, useSystemStatus } from './ui';

const NAV_GROUPS = [
  {
    label: 'Make',
    items: [
      { path: '/', label: 'Viral Adaptation', tag: 'AI', icon: Sparkles, end: true },
      { path: '/create', label: 'Create Meme', tag: 'Manual', icon: Wand2 }
    ]
  },
  {
    label: 'Library',
    items: [
      { path: '/memes', label: 'My Memes', icon: LayoutGrid },
      { path: '/style-guide', label: 'Style Guide', icon: Palette }
    ]
  },
  { label: 'Setup', items: [{ path: '/settings', label: 'Settings', icon: SlidersHorizontal }] }
];

// Mobile bottom bar: same destinations, one flat row, short labels.
const TAB_ITEMS = [
  { path: '/', label: 'Adapt', icon: Sparkles, end: true },
  { path: '/memes', label: 'Memes', icon: LayoutGrid },
  { path: '/create', label: 'Create', icon: Wand2 },
  { path: '/style-guide', label: 'Styles', icon: Palette },
  { path: '/settings', label: 'Settings', icon: SlidersHorizontal }
];

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

  return (
    <NavLink to={to} end={end} className={className} onClick={onClick} {...rest}>
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

function EngineStatus() {
  const { phase, providersOn, visionReady, refresh } = useSystemStatus();
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
            <StatusLine tone={visionReady === false ? 'bad' : 'ok'}>{visionReady === false ? 'AI vision not set up' : 'AI vision ready'}</StatusLine>
          </>
        )}
      </ul>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="on-ink fixed inset-y-0 left-0 z-50 hidden w-[252px] flex-col bg-ink text-paper md:flex">
      <NavLink to="/" className="group flex items-center gap-3 px-5 pb-5 pt-6" aria-label={`${BRAND.product}, home`}>
        <LogoMark size="md" className="transition-transform duration-200 group-hover:-rotate-6" />
        <span className="min-w-0">
          <span className="block font-display text-[19px] font-extrabold leading-none tracking-[-0.02em] text-white">{BRAND.product}</span>
          <span className="mt-1.5 block truncate font-mono text-[11px] text-paper/65">{BRAND.handle}</span>
        </span>
      </NavLink>

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

function MobileHeader() {
  const { phase } = useSystemStatus();
  const { username, authEnabled } = useAuth();
  const signOut = useSignOut();
  const dot = phase === 'ok' ? 'bg-ok' : phase === 'down' ? 'bg-bad' : 'bg-faint animate-pulse';
  const label = phase === 'ok' ? 'Engine online' : phase === 'down' ? 'Engine offline' : 'Checking the engine';
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur-md md:hidden">
      <GuardedNavLink to="/" className="flex items-center gap-2.5" aria-label={`${BRAND.product}, home`}>
        <LogoMark size="sm" />
        <span className="font-display text-[17px] font-extrabold tracking-[-0.02em]">{BRAND.product}</span>
      </GuardedNavLink>
      <div className="flex items-center gap-1">
        <span className="mr-1 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink-3" role="status">
          <span className={cn('h-2 w-2 rounded-full', dot)} aria-hidden="true" />
          {label}
        </span>
        <a href={BRAND.whatsappUrl} target="_blank" rel="noreferrer noopener" aria-label="WhatsApp bot" className="grid h-9 w-9 place-items-center rounded text-ink-3 hover:bg-ink/[0.07]">
          <MessageCircle className="h-[18px] w-[18px]" />
        </a>
        <a href={BRAND.instagramUrl} target="_blank" rel="noreferrer noopener" aria-label={`${BRAND.handle} on Instagram`} className="grid h-9 w-9 place-items-center rounded text-ink-3 hover:bg-ink/[0.07]">
          <Instagram className="h-[18px] w-[18px]" />
        </a>
        {authEnabled && username && (
          <button type="button" onClick={signOut} aria-label={`Sign out ${username}`} title="Sign out" className="grid h-9 w-9 place-items-center rounded text-ink-3 hover:bg-ink/[0.07]">
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
        {TAB_ITEMS.map(({ path, label, icon: Icon, end }) => (
          <li key={path} className="flex-1">
            <GuardedNavLink to={path} end={end} className="group flex flex-col items-center gap-1 py-1.5 text-[11px] font-semibold">
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive ? 'bg-marker text-ink' : 'text-paper/65 group-hover:text-white')}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  <span className={isActive ? 'text-white' : 'text-paper/60'}>{label}</span>
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
      <p className="min-w-0 flex-1">
        <strong className="font-bold">Temporary login.</strong> {staticWeak ? 'Its password is easy to guess, so anyone who finds this address can sign in and publish to Instagram.' : 'It is set in the server settings.'} Replace it before you share the link.
      </p>
      <NavLink to="/settings?section=account" className="font-semibold underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
        How to change it
      </NavLink>
      <Button size="sm" variant="secondary" onClick={dismiss}>
        Dismiss
      </Button>
    </div>
  );
}

/** Shown only when the backend cannot be reached, so a blank gallery is never mistaken for "no memes". */
function OfflineBanner() {
  const { phase, refresh } = useSystemStatus();
  if (phase !== 'down') return null;
  return (
    <div role="alert" className="mb-6 flex animate-slide-in flex-wrap items-center gap-3 rounded-md border border-bad/30 bg-bad-soft px-4 py-3 text-[13px] text-bad">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-ink">
        <strong className="font-bold">Can't reach the engine</strong> at <code className="font-mono text-[12px]">{API_BASE}</code>. Start it with <code className="font-mono text-[12px]">npm start</code> in <code className="font-mono text-[12px]">memeEngine_be</code>. Retrying automatically.
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

  // a new page starts at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only z-[100] rounded bg-marker px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Sidebar />
      <MobileHeader />

      <div className="md:pl-[252px]">
        <main id="main" className="mx-auto w-full max-w-[1240px] px-4 pb-32 pt-6 sm:px-6 md:pb-16 md:pt-10 lg:px-10">
          <OfflineBanner />
          <StaticLoginBanner />
          <div key={location.pathname} className="page-enter">
            <Routes>
              {/* Primary workflow: reference screenshot + reaction image + punchline */}
              <Route path="/" element={<ViralAdaptationForm onGenerated={meme => navigate(`/meme/${meme.memeId || meme.id}`, { state: { meme, from: 'viral' } })} />} />
              <Route path="/viral" element={<Navigate to="/" replace />} />

              {/* Gallery of saved memes */}
              <Route path="/memes" element={<MyMemesGallery onSelectMeme={meme => navigate(`/meme/${meme.memeId || meme.id}`, { state: { meme, from: 'history' } })} />} />
              <Route path="/history" element={<Navigate to="/memes" replace />} />

              {/* Manual creation from your own images and texts */}
              <Route path="/create" element={<CreateMemeForm onGenerated={meme => navigate(`/meme/${meme.memeId || meme.id}`, { state: { meme, from: 'create' } })} />} />

              {/* Style guide: five house-style reference layouts */}
              <Route path="/style-guide" element={<StyleGuideView />} />
              <Route path="/styles" element={<Navigate to="/style-guide" replace />} />
              <Route path="/reference" element={<Navigate to="/style-guide" replace />} />

              {/* Settings: typography, effects, canvas, images, discovery, advanced */}
              <Route path="/settings" element={<SettingsPage />} />

              {/* Result view for an individual meme (supports deep links and page refreshes) */}
              <Route path="/meme/:id" element={<MemeResultView />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
