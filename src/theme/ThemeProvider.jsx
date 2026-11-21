import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../ui';

/**
 * Night studio. Modes:
 *   auto    dark from 19:00 to 06:30 on this device's clock (the default)
 *   system  follows the device's own light/dark setting
 *   light / dark
 * The choice is per device (a phone and a laptop can differ). index.html applies the same rule before the first paint,
 * so keep NIGHT and the rule there alike.
 */

const KEY = 'meme_engine_theme';
const TONIGHT_KEY = 'meme_engine_theme_tonight'; // "keep it light tonight": until the next morning
export const NIGHT = { from: 19, to: 6.5 };
export const MODES = ['auto', 'system', 'light', 'dark'];
const BAR = { light: '#F7F4EB', dark: '#151412' };

const read = (k, fallback = null) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* the choice lasts until the page closes */
  }
};

export const isNight = (d = new Date()) => {
  const h = d.getHours() + d.getMinutes() / 60;
  return h >= NIGHT.from || h < NIGHT.to;
};

/** The next 06:30 after `d`: when "keep it light tonight" ends. */
const nextMorning = (d = new Date()) => {
  const m = new Date(d);
  m.setHours(6, 30, 0, 0);
  if (m <= d) m.setDate(m.getDate() + 1);
  return m;
};

function resolve(mode, systemDark, now) {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  const tonight = Number(read(TONIGHT_KEY) || 0);
  if (tonight && tonight > now.getTime()) return 'light';
  return isNight(now) ? 'dark' : 'light';
}

/** Puts the theme on the page. `animate`: colours fade instead of snapping (an automatic switch while you work). */
function apply(theme, animate) {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;
  if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('theme-fade');
    setTimeout(() => root.classList.remove('theme-fade'), 900);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[theme]);
}

const ThemeContext = createContext(null);
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

const systemQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export function ThemeProvider({ children }) {
  const toast = useToast();
  const [mode, setModeState] = useState(() => (MODES.includes(read(KEY)) ? read(KEY) : 'auto'));
  const [systemDark, setSystemDark] = useState(() => systemQuery().matches);
  const [now, setNow] = useState(() => new Date());
  const [tonightTick, setTonightTick] = useState(0);
  const theme = useMemo(() => resolve(mode, systemDark, now), [mode, systemDark, now, tonightTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const previous = useRef(theme);
  const byHand = useRef(false);

  // the clock decides in auto mode: look once a minute (and when the tab comes back after a while away)
  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    const q = systemQuery();
    const on = e => setSystemDark(e.matches);
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);

  // another tab changed it: follow
  useEffect(() => {
    const on = e => {
      if (e.key === KEY) setModeState(MODES.includes(e.newValue) ? e.newValue : 'auto');
      if (e.key === TONIGHT_KEY) setTonightTick(n => n + 1);
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const keepLightTonight = useCallback(() => {
    byHand.current = true;
    write(TONIGHT_KEY, String(nextMorning().getTime()));
    setTonightTick(n => n + 1);
  }, []);

  useEffect(() => {
    const automatic = !byHand.current;
    byHand.current = false;
    apply(theme, automatic && previous.current !== theme);
    // evening came while you were working: say what happened, once, with a way to keep it light
    if (automatic && previous.current === 'light' && theme === 'dark' && mode === 'auto') {
      toast.push({ kind: 'info', title: 'Night studio is on', text: 'It’s evening, so the studio dimmed itself.', action: { label: 'Keep it light tonight', onClick: keepLightTonight }, duration: 12_000 });
    }
    previous.current = theme;
  }, [theme, mode, toast, keepLightTonight]);

  const setMode = useCallback(m => {
    if (!MODES.includes(m)) return;
    byHand.current = true;
    write(KEY, m);
    write(TONIGHT_KEY, null);
    setModeState(m);
    setTonightTick(n => n + 1);
  }, []);

  /** The quick switch (sidebar, Ctrl+K): the opposite of what you see now, kept until you choose otherwise. */
  const toggle = useCallback(() => setMode(theme === 'dark' ? 'light' : 'dark'), [setMode, theme]);

  const value = useMemo(() => ({ mode, theme, setMode, toggle, keepLightTonight, systemDark }), [mode, theme, setMode, toggle, keepLightTonight, systemDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
