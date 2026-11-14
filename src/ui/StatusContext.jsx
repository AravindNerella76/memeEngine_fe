import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, apiFetch } from '../api';

const StatusContext = createContext({ phase: 'loading', data: null, providersOn: 0, visionReady: null, refresh: () => {} });

/**
 * Real engine status, read from the backend (GET /api/system/status): reachable or not, how many image
 * sources are on, whether the AI vision tool is configured. Polls gently, and faster while offline,
 * so the sidebar never shows a stale "online".
 */
export function StatusProvider({ children }) {
  const [state, setState] = useState({ phase: 'loading', data: null, checkedAt: null });
  const alive = useRef(true);
  const inflight = useRef(null);

  const check = useCallback(async () => {
    inflight.current?.abort();
    const c = new AbortController();
    inflight.current = c;
    const timeout = setTimeout(() => c.abort(), 7000);
    try {
      const res = await apiFetch(`${API_BASE}/api/system/status`, { signal: c.signal });
      // signed out: the engine is fine, the app asks the owner to sign in again (see AuthProvider)
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (alive.current) setState({ phase: 'ok', data, checkedAt: Date.now() });
    } catch (e) {
      // aborted because a newer check started: ignore; aborted by the timeout or a real failure: offline
      if (!alive.current || (e.name === 'AbortError' && inflight.current !== c)) return;
      setState(s => ({ phase: 'down', data: s.data, checkedAt: Date.now() }));
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    check();
    return () => {
      alive.current = false;
      inflight.current?.abort();
    };
  }, [check]);

  useEffect(() => {
    const id = setInterval(check, state.phase === 'down' ? 6000 : 45000);
    return () => clearInterval(id);
  }, [state.phase, check]);

  useEffect(() => {
    const wake = () => document.visibilityState !== 'hidden' && check();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', check);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', check);
    };
  }, [check]);

  const value = useMemo(() => {
    const providers = state.data?.providers || [];
    return {
      phase: state.phase,
      data: state.data,
      checkedAt: state.checkedAt,
      providersOn: providers.filter(p => p.enabled).length,
      visionReady: state.data?.visionCli ? Boolean(state.data.visionCli.configured) : null,
      refresh: check
    };
  }, [state, check]);

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export const useSystemStatus = () => useContext(StatusContext);
