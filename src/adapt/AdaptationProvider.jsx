import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE, apiFetch } from '../api';
import { useToast } from '../ui';

/**
 * The meme being made, kept for the whole app (not for one page). The engine runs it in the background and reports
 * what it is really doing; this follows that report, so the person can leave the page, refresh or close the tab and
 * come back to the same progress, and the finished meme reaches them wherever they are.
 */

/** What each stage means to the person. The engine reports which stage is active and a note about it. */
export const STAGES = [
  { id: 'analysis', title: 'Reading the reference', short: 'Reading the reference', text: 'Layout, picture slots, subjects and their context' },
  { id: 'identity', title: 'Working out who is who', short: 'Working out who is who', text: 'Names are checked against the reference; nothing is guessed' },
  { id: 'discovery', title: 'Finding and verifying pictures', short: 'Finding pictures', text: 'Searching the internet, ranking, then an AI check of every candidate' },
  { id: 'render', title: 'Setting the type', short: 'Setting the type', text: 'Your style, your reaction image and your exact punchline' }
];

/** The stage the engine is in right now, in a few words, for compact places (the pill, the phone's bar). */
export function currentStageTitle(view) {
  const active = view?.stages?.find(s => s.state === 'active');
  return (STAGES.find(s => s.id === active?.id) || STAGES[0]).short;
}

const JOB_KEY = 'meme_engine_adapt_job';
const DELIVERED_KEY = 'meme_engine_adapt_delivered';

const store = {
  read(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // storage blocked: the engine's own "active job" answer still finds a running meme
    }
  },
  write(key, value) {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch {
      /* nothing to do */
    }
  }
};

const IDLE = { phase: 'idle' };

const fromView = (view, prev) => ({
  phase: view.status === 'running' ? 'running' : view.status, // 'running' | 'done' | 'failed'
  id: view.id,
  view,
  // the engine reports how long it has been running; the clock is anchored once so it never jumps
  startedAt: prev?.id === view.id && prev.startedAt ? prev.startedAt : Date.now() - view.elapsedMs,
  error: view.status === 'failed' ? view.error : null,
  reconnecting: false
});

/** Same words on screen: skip the re-render (the clock is separate and does not need new snapshots). */
const sameView = (a, b) =>
  a && b && a.status === b.status && JSON.stringify([a.stages, a.slots, a.log]) === JSON.stringify([b.stages, b.slots, b.log]);

async function fetchJob(path, signal) {
  const res = await apiFetch(`${API_BASE}/api/memes/adapt-viral/jobs/${path}`, { signal });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, body: await res.json() };
}

/** A browser notification, only when the tab is out of sight and the person has allowed them. */
function notifyWhenAway(title, body, onClick) {
  try {
    if (document.visibilityState !== 'hidden' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(title, { body, tag: 'meme-engine-job' });
    n.onclick = () => {
      window.focus();
      n.close();
      onClick?.();
    };
  } catch {
    /* notifications are a courtesy */
  }
}

const AdaptationContext = createContext(null);

export const useAdaptation = () => {
  const ctx = useContext(AdaptationContext);
  if (!ctx) throw new Error('useAdaptation must be used inside <AdaptationProvider>');
  return ctx;
};

export function AdaptationProvider({ children }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [s, setS] = useState(IDLE);
  const where = useRef(location.pathname);
  where.current = location.pathname;
  const sRef = useRef(s);
  sRef.current = s;
  const prevPhase = useRef('idle');

  // 1. On load: pick up the meme that was being made (this browser's, or one started elsewhere)
  useEffect(() => {
    const ctl = new AbortController();
    (async () => {
      try {
        const stored = store.read(JOB_KEY);
        if (stored) {
          const r = await fetchJob(encodeURIComponent(stored), ctl.signal);
          if (r.ok) {
            setS(prev => (prev.phase === 'idle' ? fromView(r.body) : prev));
            return;
          }
          if (r.status !== 404) return; // the engine is having trouble: keep the id, the next load tries again
          store.write(JOB_KEY, null); // the engine restarted and no longer knows it: the meme (if finished) is in My Memes
        }
        const a = await fetchJob('active', ctl.signal);
        if (a.ok && a.body?.job) {
          store.write(JOB_KEY, a.body.job.id);
          setS(prev => (prev.phase === 'idle' ? fromView(a.body.job) : prev));
        }
      } catch {
        /* offline or signed out: nothing to resume yet */
      }
    })();
    return () => ctl.abort();
  }, []);

  // 2. While it runs: follow the engine's report
  useEffect(() => {
    if (s.phase !== 'running') return undefined;
    let stop = false;
    let timer = 0;
    let fails = 0;
    const ctl = new AbortController();
    const tick = async () => {
      try {
        const r = await fetchJob(encodeURIComponent(s.id), ctl.signal);
        if (stop) return;
        if (r.ok) {
          fails = 0;
          setS(prev => {
            if (prev.id !== r.body.id) return prev;
            const same = sameView(prev.view, r.body) && !prev.reconnecting;
            return same ? prev : fromView(r.body, prev);
          });
          if (r.body.status !== 'running') return;
        } else if (r.status === 404) {
          store.write(JOB_KEY, null);
          setS({ phase: 'lost', id: s.id });
          return;
        } else {
          fails++;
        }
      } catch {
        if (stop) return;
        fails++;
      }
      if (fails >= 2) setS(prev => (prev.phase === 'running' && !prev.reconnecting ? { ...prev, reconnecting: true } : prev));
      timer = setTimeout(tick, document.visibilityState === 'hidden' ? 4000 : fails ? 3000 : 1000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
      ctl.abort();
    };
  }, [s.phase, s.id]);

  // 3. Hand over the finished meme: straight to it when the person is watching, otherwise a toast to open it from
  useEffect(() => {
    const was = prevPhase.current;
    prevPhase.current = s.phase;
    if (s.phase === 'done') {
      const meme = s.view.result;
      store.write(JOB_KEY, null);
      // another tab already handed this one over
      if (store.read(DELIVERED_KEY) === s.id) {
        setS(IDLE);
        return;
      }
      store.write(DELIVERED_KEY, s.id);
      const open = () => navigate(`/meme/${meme.memeId || meme.id}`, { state: { meme, from: 'viral' } });
      const watching = where.current === '/' && document.visibilityState !== 'hidden';
      if (watching) {
        open();
      } else {
        toast.push({ kind: 'success', title: 'Your meme is ready', text: 'It is saved in My Memes.', action: { label: 'Open it', onClick: open } });
        notifyWhenAway('Your meme is ready', 'Open Meme Engine to see it.', open);
      }
      setS(IDLE);
    } else if (s.phase === 'failed' && was === 'running') {
      // seen failing live (not merely found failed after a reload)
      const back = () => navigate('/');
      if (where.current !== '/') toast.push({ kind: 'error', title: 'The meme could not be made', text: s.error?.message, action: { label: 'See why', onClick: back } });
      notifyWhenAway('The meme could not be made', s.error?.message || 'Open Meme Engine to see why.', back);
    } else if (s.phase === 'lost') {
      toast.error('The engine was restarted, so its progress was lost. If the meme finished, it is in My Memes.', { title: 'Lost track of your meme' });
      setS(IDLE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.phase, s.id]);

  /** Sends the three inputs to the engine. Resolves once the engine has accepted them; throws with the engine's reason otherwise. */
  const start = useCallback(async formData => {
    if (sRef.current.phase === 'running' || sRef.current.phase === 'starting') throw new Error('A meme is already being made.');
    setS({ phase: 'starting', startedAt: Date.now() });
    try {
      const res = await apiFetch(`${API_BASE}/api/memes/adapt-viral/jobs`, { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(
          res.status === 404 && /Cannot POST/i.test(body.message || '')
            ? 'The engine is an older version without live progress. Rebuild and restart it (npm run build, then npm start in the be folder).'
            : body.message || `The engine refused the request (status ${res.status}).`
        );
        err.details = body.details;
        err.status = res.status;
        throw err;
      }
      const view = await res.json();
      store.write(JOB_KEY, view.id);
      setS(fromView(view));
      try {
        // asked on the Generate click (a gesture), once: the browser remembers the answer
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      } catch {
        /* optional */
      }
    } catch (e) {
      setS(IDLE);
      throw e;
    }
  }, []);

  const clear = useCallback(() => {
    store.write(JOB_KEY, null);
    setS(IDLE);
  }, []);

  const value = useMemo(
    () => ({
      phase: s.phase,
      running: s.phase === 'running' || s.phase === 'starting',
      view: s.view || null,
      startedAt: s.startedAt || null,
      error: s.phase === 'failed' ? s.error : null,
      reconnecting: Boolean(s.reconnecting),
      start,
      clear
    }),
    [s, start, clear]
  );

  return <AdaptationContext.Provider value={value}>{children}</AdaptationContext.Provider>;
}
