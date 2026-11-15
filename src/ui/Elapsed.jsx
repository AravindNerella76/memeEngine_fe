import { useEffect, useState } from 'react';
import { useDocumentTitle } from './hooks';

/** "m:ss" since `since` (a timestamp in ms), ticking once a second. */
export function useElapsed(since) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  const s = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The running time as text. It owns its clock, so only these few characters re-render each second, not the screen
 * that shows them (a big form re-rendering every second is what makes typing elsewhere feel sticky).
 */
export function Elapsed({ since }) {
  return useElapsed(since);
}

/** Keeps the browser tab title in step with the clock ("Making meme 1:07 · Meme Engine"). Renders nothing. */
export function ElapsedTitle({ since, prefix = 'Working' }) {
  const text = useElapsed(since);
  useDocumentTitle(`${prefix} ${text}`);
  return null;
}
