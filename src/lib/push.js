import { API_BASE, apiFetch } from '../api';

/**
 * Notifications on this device, even with the studio closed (Web Push).
 *
 * The browser subscribes with the server's public key and hands the server a private address for this device; the
 * server signs and encrypts each message, and the browser's push service delivers it to the service worker (sw.js),
 * which shows it. Nothing here is needed for the studio to work: every call fails soft.
 */

const DEVICE_KEY = 'meme_engine_push_device';
export const KINDS = [
  { id: 'meme', title: 'Meme ready (or failed)', text: 'When a meme you started finishes, even if you closed the tab.' },
  { id: 'security', title: 'New sign-ins', text: 'Every new sign-in to the studio, and sign-in paused after wrong passwords.' }
];

const store = {
  get: () => {
    try {
      return localStorage.getItem(DEVICE_KEY);
    } catch {
      return null;
    }
  },
  set: v => {
    try {
      if (v) localStorage.setItem(DEVICE_KEY, v);
      else localStorage.removeItem(DEVICE_KEY);
    } catch {
      /* only remembers which device row is this one */
    }
  }
};

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/**
 * Can this device get notifications? reason:
 *   unsupported  the browser cannot
 *   ios-install  iPhone/iPad: only from the studio added to the Home Screen
 *   insecure     needs https (or localhost)
 */
export function pushSupport() {
  if (typeof window === 'undefined') return { supported: false, reason: 'unsupported' };
  if (!window.isSecureContext) return { supported: false, reason: 'insecure' };
  if (isIOS() && !isStandalone()) return { supported: false, reason: 'ios-install' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return { supported: false, reason: 'unsupported' };
  return { supported: true, reason: null };
}

export const permission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

/** The service worker that shows notifications. The production build registers it at start; the dev server on demand. */
async function registration() {
  if (import.meta.env.PROD) {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (!existing) await navigator.serviceWorker.register('/sw.js');
  } else {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (!existing || !String(existing.active?.scriptURL || existing.installing?.scriptURL || '').includes('dev=1')) await navigator.serviceWorker.register('/sw.js?dev=1');
  }
  return navigator.serviceWorker.ready;
}

const b64ToBytes = b64 => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};
const bytesToB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function json(method, path, body) {
  const res = await apiFetch(`${API_BASE}${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || `The server answered ${res.status}.`);
    e.code = data.code;
    e.status = res.status;
    throw e;
  }
  return data;
}

async function serverKey() {
  return (await json('GET', '/api/push/key')).publicKey;
}

/** This device's subscription and its row on the server, if notifications are on here. */
export async function currentDevice() {
  if (!pushSupport().supported || permission() !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg && (await reg.pushManager.getSubscription());
    return sub ? { subscription: sub, id: store.get() } : null;
  } catch {
    return null;
  }
}

/** Turns notifications on here. Asks for permission (call it from a click). Returns { id, kinds }. */
export async function enablePush(kinds) {
  const support = pushSupport();
  if (!support.supported) throw Object.assign(new Error('This browser cannot show notifications.'), { code: support.reason });
  const answer = await Notification.requestPermission();
  if (answer !== 'granted') throw Object.assign(new Error(answer === 'denied' ? 'Notifications are blocked for this site.' : 'Notifications were not allowed.'), { code: answer === 'denied' ? 'denied' : 'dismissed' });
  const reg = await registration();
  const key = await serverKey();
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey && bytesToB64(sub.options.applicationServerKey) !== key) {
    await sub.unsubscribe(); // made with an older server key: it cannot be used any more
    sub = null;
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  const out = await json('POST', '/api/push/subscribe', { subscription: sub.toJSON(), ...(kinds ? { kinds } : {}) });
  store.set(out.id);
  return out;
}

/** Turns notifications off here (the browser forgets the subscription; the server forgets the device). */
export async function disablePush() {
  const id = store.get();
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) await sub.unsubscribe();
  } catch {
    /* already gone */
  }
  if (id) await json('DELETE', `/api/push/devices/${encodeURIComponent(id)}`).catch(() => {});
  store.set(null);
}

/**
 * On every load while signed in: make sure the server knows this device under the current sign-in (a new sign-in on
 * this device would otherwise stay silent) and that the subscription still matches the server's key. Silent.
 */
export async function syncPush() {
  try {
    if (!pushSupport().supported || permission() !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg && (await reg.pushManager.getSubscription());
    if (!sub) return;
    const key = await serverKey();
    if (sub.options?.applicationServerKey && bytesToB64(sub.options.applicationServerKey) !== key) {
      await sub.unsubscribe();
      const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
      store.set((await json('POST', '/api/push/subscribe', { subscription: fresh.toJSON() })).id);
      return;
    }
    store.set((await json('POST', '/api/push/subscribe', { subscription: sub.toJSON() })).id);
  } catch {
    /* notifications are a courtesy */
  }
}

export const listDevices = () => json('GET', '/api/push/devices').then(d => d.devices || []);
export const setDeviceKinds = (id, kinds) => json('PUT', `/api/push/devices/${encodeURIComponent(id)}`, { kinds });
export const removeDevice = id => json('DELETE', `/api/push/devices/${encodeURIComponent(id)}`);
export const testDevice = id => json('POST', `/api/push/devices/${encodeURIComponent(id)}/test`);
export const thisDeviceId = () => store.get();
