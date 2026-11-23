/**
 * Moves keyboard focus through a grid of cards (anything marked data-grid-item inside `root`) the way the eye reads
 * it: left/right go to the neighbour, up/down go to the card straight above or below in the next row, whatever the
 * number of columns at this screen width. The card's own button gets real focus, so Enter opens it and screen
 * readers follow along. With nothing focused yet, it starts at the first card you can actually see.
 *
 *   dir: 'next' | 'prev' | 'up' | 'down' | 'first' | 'last'
 */
export function moveInGrid(root, dir, { instant = false } = {}) {
  if (!root) return false;
  const items = [...root.querySelectorAll('[data-grid-item]')].filter(el => el.getClientRects().length > 0);
  if (!items.length) return false;
  const current = document.activeElement?.closest?.('[data-grid-item]');
  const at = items.indexOf(current);
  let next;

  if (dir === 'first') next = items[0];
  else if (dir === 'last') next = items[items.length - 1];
  else if (at < 0) {
    // start where the person is looking, not at the top of a long-scrolled page
    next = items.find(el => el.getBoundingClientRect().bottom > 72) || items[0];
  } else if (dir === 'next') next = items[Math.min(at + 1, items.length - 1)];
  else if (dir === 'prev') next = items[Math.max(at - 1, 0)];
  else {
    const r = current.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const down = dir === 'down';
    const rows = items.map(el => ({ el, r: el.getBoundingClientRect() })).filter(x => (down ? x.r.top > r.top + 4 : x.r.top < r.top - 4));
    if (!rows.length) next = current;
    else {
      const rowTop = down ? Math.min(...rows.map(x => x.r.top)) : Math.max(...rows.map(x => x.r.top));
      next = rows
        .filter(x => Math.abs(x.r.top - rowTop) < 4)
        .sort((a, b) => Math.abs(a.r.left + a.r.width / 2 - cx) - Math.abs(b.r.left + b.r.width / 2 - cx))[0].el;
    }
  }

  const target = next.querySelector('[data-grid-focus]') || next.querySelector('button, a[href]') || next;
  target.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'nearest', behavior: instant ? 'instant' : 'smooth' });
  return true;
}

/** The grid item that holds keyboard focus right now (or null). */
export const focusedGridItem = root => {
  const el = document.activeElement?.closest?.('[data-grid-item]');
  return el && root?.contains(el) ? el : null;
};
