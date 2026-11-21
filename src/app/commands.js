import { FileText, HeartPulse, Instagram, LogOut, MessageCircle, Moon, RefreshCw, Search, Settings2, Sun } from 'lucide-react';
import { BRAND } from '../brand';
import { memeListPath } from '../lib/memeList';
import { peek } from '../lib/queryCache';
import { SECTION_INFO } from '../components/settings/settingsModel';
import { PAGES, openMeme } from './routes';

/**
 * Everything the Ctrl+K palette can do. Pages and settings sections are read from their own registries, so a new
 * page or section shows up here by itself. To add something else, add one object to ACTIONS:
 *
 *   id        stable name
 *   label     what is shown                hint     small grey text on the right
 *   icon      lucide icon                  keywords extra words that find it
 *   when      (ctx) => boolean, optional   hide it when it does not apply (e.g. only when signed in)
 *   run       (ctx) => void                ctx = { navigate, signOut, refreshStatus, user, theme, toggleTheme }
 */
export const ACTIONS = [
  {
    id: 'night-studio',
    label: 'Switch on Night studio',
    hint: 'dark',
    icon: Moon,
    keywords: 'night dark mode theme appearance evening black',
    when: ctx => ctx.theme !== 'dark' && Boolean(ctx.toggleTheme),
    run: ctx => ctx.toggleTheme()
  },
  {
    id: 'day-studio',
    label: 'Turn off Night studio',
    hint: 'back to light',
    icon: Sun,
    keywords: 'night dark light mode theme appearance day white',
    when: ctx => ctx.theme === 'dark' && Boolean(ctx.toggleTheme),
    run: ctx => ctx.toggleTheme()
  },
  {
    id: 'health-check',
    label: 'Run a health check',
    hint: 'is everything working?',
    icon: HeartPulse,
    keywords: 'status broken doctor diagnose problem not working',
    run: ctx => ctx.navigate('/health')
  },
  {
    id: 'sign-out',
    label: 'Sign out',
    icon: LogOut,
    keywords: 'log out logout exit leave',
    when: ctx => ctx.user?.authEnabled && ctx.user?.username,
    run: ctx => ctx.signOut()
  },
  {
    id: 'whatsapp',
    label: 'Open the WhatsApp bot',
    hint: BRAND.whatsappDisplay,
    icon: MessageCircle,
    keywords: 'chat message bot',
    run: () => window.open(BRAND.whatsappUrl, '_blank', 'noopener,noreferrer')
  },
  {
    id: 'instagram',
    label: 'Open the Instagram profile',
    hint: BRAND.handle,
    icon: Instagram,
    keywords: 'ig profile page',
    run: () => window.open(BRAND.instagramUrl, '_blank', 'noopener,noreferrer')
  },
  {
    id: 'engine-status',
    label: 'Check the engine again',
    hint: 'refresh status',
    icon: RefreshCw,
    keywords: 'status health backend server retry reconnect',
    run: ctx => ctx.refreshStatus()
  }
];

const norm = s => String(s || '').toLowerCase();

/**
 * Every word typed must appear somewhere in the item's text; the earlier and the closer to a word start, the higher it ranks.
 * Returns -1 when it does not match.
 */
export function scoreOf(query, text) {
  const q = norm(query).trim();
  if (!q) return 0;
  const hay = norm(text);
  let score = 0;
  for (const word of q.split(/\s+/)) {
    const at = hay.indexOf(word);
    if (at < 0) return -1;
    score += at === 0 ? 30 : hay[at - 1] === ' ' ? 20 : 5;
    score -= Math.min(at, 20) / 10;
  }
  return score;
}

/** The title shown for a meme (kept in step with the gallery). */
const titleOf = m => m.content?.headline || m.content?.topic || 'Telugu meme';

/**
 * The list to show for what has been typed: { group, items: [{ id, label, hint, icon, run }] }[]. Pure, so it is easy to test.
 */
export function buildResults(query, ctx) {
  const q = query.trim();
  const groups = [];
  const add = (group, entries) => {
    const scored = entries
      .map((e, i) => ({ e, i, s: scoreOf(q, `${e.label} ${e.hint || ''} ${e.keywords || ''}`) }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.i - b.i);
    if (scored.length) groups.push({ group, items: scored.map(x => x.e), best: scored[0].s });
  };

  add(
    'Go to',
    PAGES.map(p => ({ id: `page:${p.id}`, label: p.label, hint: p.tag || p.group, icon: p.icon, keywords: p.keywords, run: c => c.navigate(p.path) }))
  );

  // memes already loaded in this tab: instant, no request (the gallery's first page is cached)
  const loaded = peek(memeListPath())?.items || [];
  const memeScored = loaded
    .map(m => ({ m, s: scoreOf(q, `${titleOf(m)} ${m.content?.topic || ''} ${m.content?.punchline || ''} ${m.layout?.memeType || ''}`) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, q ? 5 : 4);
  const memeBest = memeScored[0]?.s ?? 0;
  const memes = memeScored.map(({ m }) => ({
      id: `meme:${m.memeId || m.id}`,
      label: titleOf(m),
      hint: q ? 'meme' : 'recent',
      icon: FileText,
      run: c => openMeme(c.navigate, 'history')(m)
    }));
  if (memes.length) groups.push({ group: q ? 'Memes' : 'Recent memes', items: memes, best: memeBest });

  add(
    'Settings',
    Object.entries(SECTION_INFO).map(([id, info]) => ({
      id: `settings:${id}`,
      label: info.title,
      hint: 'settings',
      icon: Settings2,
      keywords: `${info.short} ${info.description}`,
      run: c => c.navigate(`/settings?section=${id}`)
    }))
  );

  add(
    'Actions',
    ACTIONS.filter(a => !a.when || a.when(ctx)).map(a => ({ ...a, run: c => a.run(c) }))
  );

  // with something typed, the group holding the best match comes first (the order above is the order for an empty box)
  if (q) groups.sort((a, b) => b.best - a.best);

  // a search is always available, and is what Enter does when nothing else matches
  if (q) {
    groups.push({
      group: 'Search',
      items: [{ id: 'search-memes', label: `Search My Memes for “${q}”`, hint: 'all memes', icon: Search, run: c => c.navigate(`/memes?q=${encodeURIComponent(q)}`) }]
    });
  }

  return groups;
}

