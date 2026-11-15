import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from './Toast';
import { useSystemStatus } from './StatusContext';

const OnlineContext = createContext({ online: true });

/**
 * Is this browser online? (The browser's own idea of it: it knows quickly when the network drops.)
 * Shows a short "Back online" note when the connection returns, so a recovery is never silent.
 */
export function OnlineProvider({ children }) {
  const toast = useToast();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  const wasOffline = useRef(false);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      if (wasOffline.current) {
        wasOffline.current = false;
        toast.success('Back online.');
      }
    };
    const goOffline = () => {
      wasOffline.current = true;
      setOnline(false);
    };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [toast]);

  const value = useMemo(() => ({ online }), [online]);
  return <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>;
}

export const useOnline = () => useContext(OnlineContext).online;

/**
 * Can an action work right now? `internet: true` for things that reach outside (AI, picture search, Instagram).
 * Returns { ok, reason }: show `reason` next to the disabled button instead of letting the action fail after a wait.
 */
export function useAvailability({ internet = false } = {}) {
  const online = useOnline();
  const { phase } = useSystemStatus();
  if (phase === 'down') return { ok: false, reason: online ? "The studio's engine can't be reached right now." : "You're offline." };
  if (internet && !online) return { ok: false, reason: "You're offline. This needs the internet." };
  return { ok: true, reason: null };
}
