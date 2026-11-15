import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// "instant" on purpose: the page's CSS scrolls smoothly, and a slow glide to the top (or to the old spot) every time a
// page opens would feel like lag, and would be restarted by each retry below.
const jump = top => window.scrollTo({ top, left: 0, behavior: 'instant' });

const STORE = 'meme_engine_scroll';
const MAX_ENTRIES = 60;

// Positions survive a reload too (history entry keys do), so refreshing a long gallery keeps your place.
function readStore() {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(STORE) || '[]'));
  } catch {
    return new Map();
  }
}
function writeStore(map) {
  try {
    while (map.size > MAX_ENTRIES) map.delete(map.keys().next().value);
    sessionStorage.setItem(STORE, JSON.stringify([...map]));
  } catch {
    /* storage unavailable: positions are then kept for this visit only */
  }
}

/**
 * A new page starts at the top; pressing Back (or the browser's back button) returns to where you were,
 * e.g. the same spot in a long gallery. Positions are remembered per history entry, in memory.
 */
export default function useScrollRestoration() {
  const location = useLocation();
  const navType = useNavigationType();
  const positions = useRef(null);
  if (positions.current === null) positions.current = readStore();
  const keyRef = useRef(location.key);
  keyRef.current = location.key;
  // The entry whose scroll position is "real". While one page is swapped for another the document changes height and the
  // browser fires scroll events that belong to nobody; recording them would overwrite the position we want to come back to.
  const settled = useRef(location.key);

  // We do the restoring ourselves: the browser's own attempt fights ours while a page is still filling in.
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  // remember where this entry is scrolled to
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (keyRef.current !== settled.current) return;
        positions.current.delete(keyRef.current); // re-inserted last: the oldest entries are the ones forgotten
        positions.current.set(keyRef.current, window.scrollY);
        writeStore(positions.current);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const y = navType === 'POP' ? positions.current.get(location.key) : undefined;
    if (!y) {
      jump(0);
      settled.current = location.key;
      return undefined;
    }
    // the page may still be filling in: keep trying for a moment until it is tall enough to scroll there
    let tries = 0;
    let timer;
    const tick = () => {
      jump(y);
      if (Math.abs(window.scrollY - y) > 2 && tries++ < 24) timer = setTimeout(tick, 50);
      else settled.current = location.key;
    };
    tick();
    return () => clearTimeout(timer);
  }, [location.key, navType]);
}
