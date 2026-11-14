import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from '../api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Calls an /api/auth endpoint. Returns { res, data }; throws only when the server cannot be reached. */
export async function authRequest(method, path, body) {
  const res = await apiFetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// browser-side leftovers that should not outlive a sign-out on a shared computer
const PRIVATE_SESSION_KEYS = ['meme_engine_settings_draft', 'meme_engine_settings_section'];

/**
 * Who is signed in. status:
 *   loading  checking the session
 *   authed   signed in (or the server has login switched off: username is null)
 *   anon     signed out
 *   setup    no owner account exists yet (created from the command line)
 *   offline  the server cannot be reached
 * `staticLogin` / `staticWeak`: the server uses a fixed login from its settings (and it is easy to guess).
 * `expired` is true when a signed-in session ended while the app was open: the studio stays on screen
 * (nothing is lost) and a sign-in dialog appears on top.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', username: null, authEnabled: true, expired: false, staticLogin: false, staticWeak: false });

  const refresh = useCallback(async () => {
    try {
      const { res, data } = await authRequest('GET', '/api/auth/me');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (data.authenticated) setState({ status: 'authed', username: data.username || null, authEnabled: data.authEnabled !== false, expired: false, staticLogin: Boolean(data.staticCredentials), staticWeak: Boolean(data.staticWeak) });
      else setState({ status: data.setupRequired ? 'setup' : 'anon', username: null, authEnabled: true, expired: false, staticLogin: false, staticWeak: false });
    } catch {
      // keep the studio usable if we were already in it; otherwise show "cannot reach the server"
      setState(s => (s.status === 'authed' ? s : { status: 'offline', username: null, authEnabled: true, expired: false, staticLogin: false, staticWeak: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // any API call that comes back 401 means the session ended (see apiFetch)
  useEffect(() => {
    const onExpired = () => setState(s => (s.status === 'authed' && s.authEnabled ? { ...s, status: 'anon', expired: true } : s));
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    let out;
    try {
      out = await authRequest('POST', '/api/auth/login', { username, password });
    } catch {
      return { ok: false, code: 'network', message: 'Could not reach the server. Check that it is running, then try again.' };
    }
    const { res, data } = out;
    if (res.ok) {
      setState({ status: 'authed', username: data.username, authEnabled: true, expired: false, staticLogin: Boolean(data.staticCredentials), staticWeak: Boolean(data.staticWeak) });
      return { ok: true };
    }
    return { ok: false, code: data.code || `http_${res.status}`, message: data.message || 'Could not sign in.', retryAfterSeconds: data.retryAfterSeconds };
  }, []);

  const logout = useCallback(async () => {
    try {
      await authRequest('POST', '/api/auth/logout');
    } catch {
      /* the cookie is cleared by the server when reachable; the screen locks either way */
    }
    try {
      PRIVATE_SESSION_KEYS.forEach(k => sessionStorage.removeItem(k));
    } catch {
      /* storage unavailable */
    }
    setState({ status: 'anon', username: null, authEnabled: true, expired: false, staticLogin: false, staticWeak: false });
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
