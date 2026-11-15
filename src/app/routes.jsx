import { lazy } from 'react';
import { LayoutGrid, LayoutTemplate, Palette, SlidersHorizontal, Sparkles, Wand2 } from 'lucide-react';
// The landing page ships with the app (see `eagerPage`); every other page is downloaded when first needed.
import ViralAdaptationForm from '../components/ViralAdaptationForm';
import { memeListPath } from '../lib/memeList';
import { warm } from '../lib/queryCache';

/**
 * THE place pages are defined. Add a feature by adding one entry to PAGES: the sidebar, the phone tab bar,
 * the router, idle prefetching and the Ctrl+K palette all read from here.
 *
 *   id        stable name
 *   path      URL
 *   label     sidebar / palette name        short  label under the phone tab icon (only when `mobile`)
 *   group     sidebar section               tag    small chip next to the label ("AI", "Manual")
 *   icon      lucide icon                   keywords  extra words the palette matches
 *   mobile    show in the phone tab bar     end    match only the exact path (home)
 *   component lazy page (code is downloaded when first needed, and prefetched while idle). The landing page
 *             is the one exception, see eagerPage.
 *   props     (navigate) => props for the page, for pages that hand a meme to the result screen
 *   prefetch  () => starts the requests the page will make as soon as it opens (use `warm`, from lib/queryCache); runs
 *             together with the page's code, on hover/focus of its link and on a first visit to its address
 */
const pages = new Set();

/** One retry after a short pause: a dropped packet or a server restart should not break opening a page. */
const loadWithRetry = async factory => {
  try {
    return await factory();
  } catch {
    await new Promise(resolve => setTimeout(resolve, 900));
    return factory();
  }
};

const lazyPage = factory => {
  // React remembers a failed lazy load for good, so the lazy part is swapped for a fresh one by reset() (the error
  // card's "Try again" does that); the stable wrapper keeps the router's element type the same.
  let Inner = lazy(() => loadWithRetry(factory));
  const Component = props => <Inner {...props} />;
  Component.preload = factory; // calling it starts the download; React reuses it when the page renders
  Component.reset = () => {
    Inner = lazy(() => loadWithRetry(factory));
  };
  pages.add(Component);
  return Component;
};

/** Forget failed page downloads so the next render tries the network again. */
export const resetFailedPages = () => pages.forEach(page => page.reset());

/**
 * A page bundled with the app instead of downloaded on demand. Use it ONLY for the page most visits open first:
 * it removes the "loading page" flash and one round trip there, at the price of being sent to everyone who
 * opens any other page first. Keep it to one.
 */
const eagerPage = Component => {
  Component.preload = () => Promise.resolve();
  return Component;
};

/** Opens a meme's result page, remembering which screen it came from (for the Back button). */
export const openMeme = (navigate, from) => meme => navigate(`/meme/${meme.memeId || meme.id}`, { state: { meme, from } });

export const PAGES = [
  {
    id: 'adapt',
    path: '/',
    end: true,
    label: 'Viral Adaptation',
    short: 'Adapt',
    tag: 'AI',
    icon: Sparkles,
    group: 'Make',
    mobile: true,
    keywords: 'meme viral adapt reference screenshot punchline generate',
    component: eagerPage(ViralAdaptationForm),
    props: navigate => ({ onGenerated: openMeme(navigate, 'viral') }),
    prefetch: () => warm('/api/settings', { ttl: 60_000 })
  },
  {
    id: 'create',
    path: '/create',
    label: 'Create Meme',
    short: 'Create',
    tag: 'Manual',
    icon: Wand2,
    group: 'Make',
    mobile: true,
    keywords: 'manual own images build',
    component: lazyPage(() => import('../components/CreateMemeForm')),
    props: navigate => ({ onGenerated: openMeme(navigate, 'create') }),
    prefetch: () => warm('/api/settings', { ttl: 60_000 })
  },
  {
    id: 'memes',
    path: '/memes',
    label: 'My Memes',
    short: 'Memes',
    icon: LayoutGrid,
    group: 'Library',
    mobile: true,
    keywords: 'gallery history saved versions',
    component: lazyPage(() => import('../components/MyMemesGallery')),
    props: navigate => ({ onSelectMeme: openMeme(navigate, 'history') }),
    prefetch: () => warm(memeListPath(), { ttl: 4_000 })
  },
  {
    id: 'layouts',
    path: '/layouts',
    label: 'Layouts',
    short: 'Layouts',
    icon: LayoutTemplate,
    group: 'Library',
    mobile: true,
    keywords: 'formats templates learned',
    component: lazyPage(() => import('../components/LayoutsPage'))
  },
  {
    id: 'styles',
    path: '/style-guide',
    label: 'Style Guide',
    short: 'Styles',
    icon: Palette,
    group: 'Library',
    mobile: true,
    keywords: 'house style five layouts reference',
    component: lazyPage(() => import('../components/StyleGuideView'))
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    short: 'Settings',
    icon: SlidersHorizontal,
    group: 'Setup',
    mobile: true,
    keywords: 'typography fonts colours canvas images discovery instagram whatsapp account password security',
    component: lazyPage(() => import('../components/settings/SettingsPage')),
    prefetch: () => warm('/api/settings', { ttl: 5_000 })
  }
];

/** Pages without a menu entry (opened from elsewhere). */
export const HIDDEN_PAGES = [{ id: 'meme', path: '/meme/:id', component: lazyPage(() => import('../components/MemeResultView')) }];

/** Old addresses that still work. */
export const REDIRECTS = [
  ['/viral', '/'],
  ['/history', '/memes'],
  ['/styles', '/style-guide'],
  ['/reference', '/style-guide']
];

/** Sidebar sections, in order of first appearance. */
export const NAV_GROUPS = PAGES.reduce((groups, page) => {
  let g = groups.find(x => x.label === page.group);
  if (!g) groups.push((g = { label: page.group, items: [] }));
  g.items.push(page);
  return groups;
}, []);

export const TAB_ITEMS = PAGES.filter(p => p.mobile);

const ALL = [...PAGES, ...HIDDEN_PAGES];
const loaded = new Set();

/** Starts downloading a page's code and asking for its data (once each). Safe to call from hover, focus and idle time. */
export function preloadPage(page) {
  if (!page?.component?.preload) return;
  if (!loaded.has(page.id)) {
    loaded.add(page.id);
    page.component.preload().catch(() => loaded.delete(page.id)); // try again next time if the network hiccuped
  }
  page.prefetch?.(); // every time: the request cache decides whether a recent answer is still good
}

/** The page for a path (used to warm up the right code when a link is pointed at). */
export function pageForPath(pathname) {
  return ALL.find(p => (p.path === '/' ? pathname === '/' : pathname === p.path || pathname.startsWith(`${p.path}/`)));
}

/**
 * After the page has loaded and the browser is idle, fetch the other pages one at a time so clicking them is
 * instant. Skipped on data-saver and slower connections, and while the tab is in the background, so it can
 * never compete with what the person is waiting for.
 */
export function prefetchAllWhenIdle() {
  const c = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (c && (c.saveData || /^(slow-2g|2g|3g)$/.test(c.effectiveType || ''))) return () => {};
  let cancelled = false;
  let timer = 0;
  const queue = PAGES.concat(HIDDEN_PAGES).filter(p => !loaded.has(p.id));
  const next = () => {
    if (cancelled || !queue.length) return;
    if (document.visibilityState === 'hidden') {
      timer = setTimeout(next, 3000);
      return;
    }
    preloadPage(queue.shift());
    timer = setTimeout(next, 400); // one at a time, spaced out
  };
  const start = () => {
    if (cancelled) return;
    if ('requestIdleCallback' in window) window.requestIdleCallback(next, { timeout: 3000 });
    else timer = setTimeout(next, 1500);
  };
  if (document.readyState === 'complete') timer = setTimeout(start, 1500);
  else window.addEventListener('load', () => (timer = setTimeout(start, 1500)), { once: true });
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
