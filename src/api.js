/**
 * Backend base URL. Empty (the default) means "same address as this page": in development the Vite proxy
 * forwards /api and /output to the backend, and when hosted a reverse proxy does the same. That keeps the
 * sign-in cookie first-party. Set VITE_API_BASE only to point the UI at a backend on another address.
 */
export const API_BASE = String(import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

const AUTH_PATH = /\/api\/auth\//;

/**
 * fetch() for the backend: sends the session cookie and, when the server says "sign in" (401) on any
 * call other than the sign-in calls themselves, tells the app so it can ask the owner to sign in again
 * without losing what is on screen.
 */
export async function apiFetch(input, init = {}) {
  const res = await fetch(input, { credentials: 'include', ...init });
  if (res.status === 401 && !AUTH_PATH.test(String(input))) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
  return res;
}
