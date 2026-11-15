/*
 * Offline-ready app shell. It makes sure the studio's own files (page, scripts, styles, fonts) are available without
 * a connection, so reloading offline opens the app and shows its "you're offline" message instead of a browser error.
 *
 * It never handles /api, /output or /uploads: your memes, settings and sign-in always come live from the server.
 * To remove it: in the browser console run  localStorage.setItem('meme_engine_offline_shell','off')  and reload.
 */
const SHELL = 'studio-shell-v1';
const ASSETS = 'studio-assets-v1';
const MAX_ASSETS = 140;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.add('/')).then(() => self.skipWaiting()));
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
