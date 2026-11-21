import { useEffect, useRef } from 'react';
import { useAdaptation } from './AdaptationProvider';

/**
 * The browser tab tells you how the meme is doing while you are on another tab: a progress ring in the tab icon and
 * "62% · Making your meme" in its title. When it finishes out of sight: a tick (or a red !) until you look.
 */

// how much of the work each stage is (finding and checking pictures is most of the wait)
const WEIGHT = { analysis: 0.2, identity: 0.15, discovery: 0.5, render: 0.15 };
const RESOLVED = new Set(['found', 'yours', 'failed']);

/** 0-100 from the engine's real report (never a timer). Stays between 2 and 99 while it runs. */
export function progressOf(view) {
  if (!view?.stages?.length) return 2;
  let p = 0;
  for (const s of view.stages) {
    const w = WEIGHT[s.id] || 0;
    if (s.state === 'done' || s.state === 'skipped') p += w;
    else if (s.state === 'active') {
      if (s.id === 'discovery' && view.slots?.length) p += w * (view.slots.filter(x => RESOLVED.has(x.state)).length / view.slots.length) * 0.95;
      else p += w * 0.3;
    }
  }
  return Math.max(2, Math.min(99, Math.round(p * 100)));
}

const PREFIX = /^(\d{1,2}% · |✓ Meme ready · |⚠ Meme failed · )/;
const base = () => document.title.replace(PREFIX, '');

function iconFor(kind, pct = 0) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const box = (x, y, fill) => {
    g.beginPath();
    g.roundRect(x, y, 52, 52, 13);
    g.fillStyle = fill;
    g.fill();
  };
  box(8, 8, '#0E0E0C'); // the sticker's hard shadow
  box(4, 4, kind === 'failed' ? '#BD2424' : '#FFE500');
  g.lineWidth = 3.5;
  g.strokeStyle = '#0E0E0C';
  g.beginPath();
  g.roundRect(4, 4, 52, 52, 13);
  g.stroke();
  g.lineCap = 'round';
  if (kind === 'progress') {
    g.lineWidth = 9;
    g.strokeStyle = 'rgba(14,14,12,0.2)';
    g.beginPath();
    g.arc(30, 30, 15, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#0E0E0C';
    g.beginPath();
    g.arc(30, 30, 15, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct) / 100);
    g.stroke();
  } else if (kind === 'done') {
    g.lineWidth = 8;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(18, 31);
    g.lineTo(27, 40);
    g.lineTo(43, 21);
    g.stroke();
  } else {
    g.fillStyle = '#FFFFFF';
    g.fillRect(26.5, 15, 7, 21);
    g.beginPath();
    g.arc(30, 44, 4.2, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL('image/png');
}

export default function TabProgress() {
  const { phase, view } = useAdaptation();
  const original = useRef(null);
  const holding = useRef(null); // 'done' | 'failed': shown until the tab is looked at

  const link = () => document.querySelector('link[rel="icon"]');
  const set = (kind, pct, prefix) => {
    const l = link();
    if (l) {
      if (!original.current) original.current = { href: l.getAttribute('href'), type: l.getAttribute('type') };
      l.setAttribute('type', 'image/png');
      l.setAttribute('href', iconFor(kind, pct));
    }
    document.title = prefix + base();
  };
  const restore = () => {
    const l = link();
    if (l && original.current) {
      l.setAttribute('href', original.current.href);
      if (original.current.type) l.setAttribute('type', original.current.type);
    }
    original.current = null;
    holding.current = null;
    document.title = base();
  };

  useEffect(() => {
    if (phase === 'running' || phase === 'starting') {
      holding.current = null;
      const pct = phase === 'starting' ? 2 : progressOf(view);
      set('progress', pct, `${pct}% · `);
      return;
    }
    if ((phase === 'done' || phase === 'failed') && original.current && document.visibilityState === 'hidden') {
      holding.current = phase;
      set(phase, 100, phase === 'done' ? '✓ Meme ready · ' : '⚠ Meme failed · ');
      return;
    }
    if (!holding.current && original.current) restore();
  }, [phase, view]); // eslint-disable-line react-hooks/exhaustive-deps

  // pages set their own titles while a meme runs: keep the percentage in front of whatever they set
  useEffect(() => {
    const t = setInterval(() => {
      if (!original.current) return;
      if (!PREFIX.test(document.title)) {
        const kind = holding.current;
        document.title = (kind === 'done' ? '✓ Meme ready · ' : kind === 'failed' ? '⚠ Meme failed · ' : `${progressOf(view)}% · `) + document.title;
      }
    }, 1000);
    return () => clearInterval(t);
  }, [view]);

  // you looked: the tick has done its job
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && holding.current) setTimeout(() => holding.current && restore(), 2500);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (original.current) restore();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
