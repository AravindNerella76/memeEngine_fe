import { API_BASE, apiFetch } from '../api';

/**
 * A small in-memory cache for GET requests, so the same data is never fetched twice at once and going back to a
 * screen shows it instantly. Not a database: it lives until the tab closes and is dropped when something changes.
 */
const store = new Map(); // url -> { data, at }
const MAX_ENTRIES = 80; // searches create many distinct addresses: keep the newest, forget the oldest
const inflight = new Map(); // url -> Promise

export class HttpError extends Error {
  constructor(status, message) {
    super(message || `Request failed (${status})`);
    this.status = status;
  }
}

/** What is cached for `url` right now (any age), or undefined. */
export const peek = url => store.get(url)?.data;

/** Age in ms of what is cached for `url`, or Infinity. */
export const ageOf = url => (store.has(url) ? Date.now() - store.get(url).at : Infinity);

/** Forget cached responses whose address starts with `prefix` (call after saving something that changes them). */
export function invalidate(prefix) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/**
 * GET a JSON endpoint of the backend (path like "/api/settings"). Returns the cached copy while it is younger
 * than `ttl`; identical requests in flight share one network call.
 */
export function cachedJSON(path, { ttl = 30_000, force = false } = {}) {
  const url = `${API_BASE}${path}`;
  const hit = store.get(url);
  if (!force && hit && Date.now() - hit.at < ttl) return Promise.resolve(hit.data);
  if (inflight.has(url)) return inflight.get(url);
  const p = apiFetch(url)
    .then(async res => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new HttpError(res.status, body.message);
      }
      const data = await res.json();
      store.delete(url);
      store.set(url, { data, at: Date.now() });
      while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
      return data;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/** Start fetching something the person is likely to open next (hover, focus). Errors are ignored. */
export const warm = (path, opts) => void cachedJSON(path, opts).catch(() => {});
