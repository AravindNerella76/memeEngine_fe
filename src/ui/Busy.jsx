import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const BusyContext = createContext({ busy: null, setBusy: () => {} });

/** Tracks long-running work (a meme being generated) so navigation and tab close can ask first. */
export function BusyProvider({ children }) {
  const [busy, setBusy] = useState(null);
  const value = useMemo(() => ({ busy, setBusy }), [busy]);
  return <BusyContext.Provider value={value}>{children}</BusyContext.Provider>;
}

export const useBusy = () => useContext(BusyContext);

/** While `active`, the app is "busy": closing the tab warns, and in-app navigation asks for confirmation. */
export function useBusyGuard(active, message) {
  const { setBusy } = useBusy();
  useEffect(() => {
    if (!active) return undefined;
    setBusy({ message });
    const onBeforeUnload = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      setBusy(null);
    };
  }, [active, message, setBusy]);
}
