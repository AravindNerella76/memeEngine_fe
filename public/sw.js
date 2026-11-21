/*
 * Offline-ready app shell. It makes sure the studio's own files (page, scripts, styles, fonts) are available without
 * a connection, so reloading offline opens the app and shows its "you're offline" message instead of a browser error.
 *
 * It never handles /api, /output or /uploads: your memes, settings and sign-in always come live from the server.
 * To remove it: in the browser console run  localStorage.setItem('meme_engine_offline_shell','off')  and reload.
 *
 * It also shows notifications pushed by the server (a meme is ready, a new sign-in), even with the studio closed.
 * Registered as /sw.js?dev=1 by the development server: then it only does notifications and never caches anything,
 * so Vite's live reload is not disturbed.
 */
const DEV = new URL(self.location.href).searchParams.has('dev');
const SHELL = 'studio-shell-v1';
const ASSETS = 'studio-assets-v1';
const MAX_ASSETS = 140;

self.addEventListener('install', event => {
  event.waitUntil(DEV ? self.skipWaiting() : caches.open(SHELL).then(cache => cache.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]); // oldest first
}

self.addEventListener('fetch', event => {
  if (DEV) return; // the development server: notifications only, the network for everything
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|output|uploads)\//.test(url.pathname) || url.pathname === '/sw.js') return; // live data: never ours

  // Opening the app: the network first (always the newest version), the saved shell when there is no network.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
            const copy = res.clone();
            caches.open(SHELL).then(c => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then(hit => hit || new Response('You are offline.', { status: 503, headers: { 'content-type': 'text/plain' } })))
    );
    return;
  }

  // The sample pictures (and other plain files in /samples) keep their names when they change: show the saved copy at
  // once and refresh it quietly in the background.
  if (url.pathname.startsWith('/samples/')) {
    event.respondWith(
      caches.open(ASSETS).then(async cache => {
        const hit = await cache.match(req);
        const refresh = fetch(req)
          .then(res => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        if (hit) {
          event.waitUntil(refresh);
          return hit;
        }
        return (await refresh) || new Response('', { status: 504 });
      })
    );
    return;
  }

  // The app's own built files have fingerprinted names, so a saved copy is always the right copy: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async cache => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          cache.put(req, res.clone());
          trim(cache);
        }
        return res;
      })
    );
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Notifications pushed by the server
// ---------------------------------------------------------------------------------------------------------------------

self.addEventListener('push', event => {
  event.waitUntil(
    (async () => {
      let data = {};
      try {
        data = event.data ? event.data.json() : {};
      } catch {
        data = { title: 'Meme Engine', body: event.data ? event.data.text() : '' };
      }
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // someone is looking at the studio right now: it shows a finished meme itself (no system popup on top of it).
      // Security alerts always show: they matter most when the studio open in front of you is not the one signing in.
      const watching = windows.find(w => w.visibilityState === 'visible' && w.focused);
      if (watching && data.kind === 'meme' && !data.force) {
        watching.postMessage({ type: 'push', data });
        return;
      }
      await self.registration.showNotification(data.title || 'Meme Engine', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-96.png',
        image: data.image || undefined,
        tag: data.tag || undefined,
        renotify: Boolean(data.tag && data.kind === 'security'),
        requireInteraction: Boolean(data.requireInteraction),
        timestamp: data.sentAt || Date.now(),
        data: { url: data.url || '/' }
      });
    })()
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
  if (url.origin !== self.location.origin) return; // only places inside the studio
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find(w => new URL(w.url).origin === self.location.origin);
      if (open) {
        // move inside the running app (keeps its state) instead of reloading it
        open.postMessage({ type: 'open', url: url.pathname + url.search });
        return open.focus();
      }
      return self.clients.openWindow(url.href);
    })()
  );
});

// The browser renewed the subscription by itself: tell the server the new address (it keeps the same sign-in).
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription;
        const key = old && old.options && old.options.applicationServerKey;
        const sub = event.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
        if (sub) await fetch('/api/push/subscribe', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) });
      } catch {
        /* the app re-subscribes on its next visit */
      }
    })()
  );
});
