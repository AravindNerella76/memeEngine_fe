import React, { Fragment, Suspense, createContext, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '../ui/cn';
import { alternatives, chordMatches, keyCaps, parseSequence } from './keys';
import { isTypingTarget } from './platform';
import { pageForPath } from './routes';

/**
 * Keyboard shortcuts for the whole studio: ONE keydown listener, fed by registrations.
 *
 *   useShortcuts([
 *     { keys: 'mod+enter', label: 'Generate', run: () => press('generate'), when: ready, inFields: true },
 *     { keys: ['j', 'down'], label: 'Next meme', run: next, repeat: true },
 *   ]);
 *
 *   keys      see app/keys.js ("mod+s", "g m", "?", or a list of alternatives)
 *   label     what the cheat sheet (?) says           group     heading in the cheat sheet (default: the page's name)
 *   run(e)    return false to let the key through     when      false = not right now (shown dimmed, does nothing)
 *   inFields  also while typing in a field (use only with Ctrl/⌘ combos or Esc)
 *   repeat    also while the key is held down          dialogs   names of dialogs it still works over (Dialog `name`)
 *   hidden    works, but is not listed
 *
 * Rules that keep it out of the way: nothing fires while a dialog is open (unless it names that dialog), single keys
 * never fire while typing, and nothing fires while a Telugu/Indic input method is still composing a letter.
 * The newest registration wins, so a page can give "/" its own meaning (search this page) over the global one.
 */

const ShortcutContext = createContext(null);
const loadSheet = () => import('./ShortcutSheet');
const ShortcutSheet = lazy(loadSheet);

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS']);
const LEADER_MS = 1600;

/** The dialog on top, by name: a Dialog's `name`, "palette" for Ctrl+K, else "dialog". */
function topDialog() {
  const all = document.querySelectorAll('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
  const top = all[all.length - 1];
  if (!top) return null;
  if (top.hasAttribute('data-palette')) return 'palette';
  return top.getAttribute('data-dialog') || 'dialog';
}

export function ShortcutProvider({ children }) {
  const regs = useRef([]); // newest first
  const leaderRef = useRef(null);
  const [leader, setLeader] = useState(null); // { first, caps, options: [{ caps, label }] } while waiting for the second key
  const [sheet, setSheet] = useState(null); // snapshot of the groups while the cheat sheet is open
  const [sheetWanted, setSheetWanted] = useState(false);
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const register = useCallback(reg => {
    regs.current = [reg, ...regs.current];
    return () => {
      regs.current = regs.current.filter(r => r !== reg);
    };
  }, []);

  /** Every shortcut, page ones before global ones, newest registration first. */
  const collect = useCallback(() => {
    const rank = r => (r.scope === 'global' ? 1 : 0);
    return [...regs.current]
      .sort((a, b) => rank(a) - rank(b))
      .flatMap(r => (r.get() || []).filter(Boolean).map(s => ({ ...s, group: s.group || r.group || 'This page', scope: r.scope })));
  }, []);

  const clearLeader = useCallback(() => {
    if (!leaderRef.current) return;
    clearTimeout(leaderRef.current.timer);
    leaderRef.current = null;
    setLeader(null);
  }, []);

  const openSheet = useCallback(() => {
    const page = pageForPath(pathRef.current);
    const groups = [];
    const claimed = new Set(); // a key a page has taken over ("/" searching My Memes) is not listed again under its global meaning
    for (const s of collect()) {
      const keys = alternatives(s.keys).filter(k => !claimed.has(k));
      keys.forEach(k => claimed.add(k));
      if (s.hidden || !keys.length) continue;
      const title = s.group === 'This page' ? page?.label || 'This page' : s.group;
      let g = groups.find(x => x.title === title);
      if (!g) groups.push((g = { title, page: s.scope !== 'global', items: [] }));
      // two keys for the same thing make one row: "Ctrl K or /"
      const same = g.items.find(i => i.label === s.label);
      if (same) same.keys = [...same.keys, ...keys];
      else g.items.push({ keys, label: s.label, off: s.when === false });
    }
    // what this page adds comes first, then the keys that work everywhere
    groups.sort((a, b) => Number(b.page) - Number(a.page));
    setSheetWanted(true);
    setSheet(groups.filter(g => g.items.length));
  }, [collect]);
  const closeSheet = useCallback(() => setSheet(null), []);
  const sheetOpenRef = useRef(false);
  sheetOpenRef.current = Boolean(sheet);
  const toggleSheet = useCallback(() => (sheetOpenRef.current ? closeSheet() : openSheet()), [closeSheet, openSheet]);

  useEffect(() => {
    const onKey = e => {
      if (e.defaultPrevented || e.isComposing || e.keyCode === 229 || MODIFIERS.has(e.key)) return;
      const dialog = topDialog();
      const typing = isTypingTarget(e.target);
      const list = collect();
      const usable = s => s.when !== false && (!dialog || (s.dialogs || []).includes(dialog)) && (!typing || s.inFields) && (!e.repeat || s.repeat);
      const fire = s => {
        if (s.run(e) === false) return false;
        e.preventDefault();
        return true;
      };

      // the second key of a sequence ("g" then "m")
      const pending = leaderRef.current;
      if (pending) {
        clearLeader();
        if (e.key === 'Escape') {
          e.preventDefault();
          return;
        }
        for (const s of list) {
          if (!usable(s)) continue;
          for (const alt of alternatives(s.keys)) {
            const seq = parseSequence(alt);
            if (seq.length === 2 && alt.trim().split(/\s+/)[0] === pending.first && chordMatches(seq[1], e) && fire(s)) return;
          }
        }
        // not a second key we know: treat it as a fresh key press
      }

      for (const s of list) {
        for (const alt of alternatives(s.keys)) {
          const seq = parseSequence(alt);
          if (!chordMatches(seq[0], e) || !usable(s)) continue;
          if (seq.length === 1) {
            if (fire(s)) return;
            continue;
          }
          // the first key of a sequence: wait a moment for the second, and show what it can be
          const first = alt.trim().split(/\s+/)[0];
          const options = list
            .filter(o => usable(o) && !o.hidden)
            .flatMap(o => alternatives(o.keys).filter(a => parseSequence(a).length === 2 && a.trim().split(/\s+/)[0] === first).map(a => ({ caps: keyCaps(a.trim().split(/\s+/)[1])[0][0], label: o.short || o.label, id: o.id })));
          e.preventDefault();
          clearTimeout(leaderRef.current?.timer);
          leaderRef.current = { first, timer: setTimeout(clearLeader, LEADER_MS) };
          setLeader({ first, caps: keyCaps(first)[0][0], options, at: Date.now() });
          return;
        }
      }
    };
    const cancel = () => clearLeader();
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', cancel);
    window.addEventListener('pointerdown', cancel, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pointerdown', cancel, true);
      clearLeader();
    };
  }, [collect, clearLeader]);

  // a page change ends a half-typed sequence
  useEffect(() => clearLeader(), [pathname, clearLeader]);

  const value = useMemo(() => ({ register, leader, openSheet, closeSheet, toggleSheet, preloadSheet: loadSheet }), [register, leader, openSheet, closeSheet, toggleSheet]);

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      {leader && <LeaderHint leader={leader} />}
      {sheetWanted && (
        <Suspense fallback={null}>
          <ShortcutSheet open={Boolean(sheet)} groups={sheet || []} onClose={closeSheet} />
        </Suspense>
      )}
    </ShortcutContext.Provider>
  );
}

/** Register shortcuts while the calling component is on screen. `list` may change every render. */
export function useShortcuts(list, { group, scope = 'page' } = {}) {
  const ctx = useContext(ShortcutContext);
  const ref = useRef(list);
  ref.current = list;
  const register = ctx?.register;
  useEffect(() => (register ? register({ group, scope, get: () => ref.current }) : undefined), [register, group, scope]);
}

/** { leader, openSheet, toggleSheet, ... } — for UI that reacts to shortcuts (the sidebar's key caps). */
export const useShortcutState = () => useContext(ShortcutContext) || { leader: null, openSheet() {}, closeSheet() {}, toggleSheet() {}, preloadSheet() {} };

// ---- pressing a real button ------------------------------------------------------------------------------
const visible = el => el.getClientRects().length > 0 && !el.closest('[inert]');

/** Gives a button the feel of being pressed (or a small "no" shake when it cannot be used right now). */
export function feedback(el, kind) {
  if (!el) return;
  clearTimeout(el.__kbdTimer);
  el.removeAttribute('data-kbd');
  void el.offsetWidth; // restart the animation when pressed twice quickly
  el.setAttribute('data-kbd', kind);
  el.__kbdTimer = setTimeout(() => el.removeAttribute('data-kbd'), kind === 'press' ? 140 : 420);
}

/**
 * Clicks the visible element marked data-key-action={name}, exactly as a mouse would: confirmations, disabled and
 * loading states all behave the same. Returns true when it clicked.
 */
export function press(name) {
  const el = [...document.querySelectorAll(`[data-key-action="${name}"]`)].find(visible);
  if (!el) return false;
  const blocked = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-busy') === 'true';
  feedback(el, blocked ? 'nope' : 'press');
  if (!blocked) el.click();
  return !blocked;
}

/** Focuses a field (and puts the caret at the end of what is already typed). */
export function focusField(el) {
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.focus({ preventScroll: true });
  if (typeof el.setSelectionRange === 'function' && /^(text|search|)$/.test(el.type || '')) {
    const n = el.value?.length || 0;
    try {
      el.setSelectionRange(n, n);
    } catch {
      /* some input types do not support a caret */
    }
  }
  return true;
}

// ---- showing keys --------------------------------------------------------------------------------------
const CAP_TONES = {
  paper: 'border-line-strong bg-surface text-ink-3 shadow-[0_1px_0_rgb(var(--line-strong))]',
  ink: 'border-white/20 bg-white/[0.06] text-paper/75',
  marker: 'border-ink/40 bg-marker text-ink shadow-[0_1px_0_rgb(var(--ink)/0.4)]',
  bold: 'border-ink bg-surface text-ink shadow-[0_2px_0_rgb(var(--ink))]'
};

export function Cap({ children, tone = 'paper', className }) {
  return <kbd className={cn('inline-flex h-5 min-w-[20px] items-center justify-center rounded border px-1.5 font-mono text-[11px] font-medium leading-none', CAP_TONES[tone], className)}>{children}</kbd>;
}

/**
 * Key caps for a shortcut: "Ctrl ↵", "G then M", "J or ↓". Hidden on touch screens, where there is no keyboard to press.
 */
export function KeyCaps({ keys, tone = 'paper', className, capClassName, touch = false }) {
  const all = keyCaps(keys);
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', !touch && 'kbd-hint', className)} aria-hidden="true">
      {all.map((seq, a) => (
        <Fragment key={a}>
          {a > 0 && <span className="px-0.5 text-[11px] opacity-60">or</span>}
          {seq.map((chord, s) => (
            <Fragment key={s}>
              {s > 0 && <span className="px-0.5 text-[11px] opacity-60">then</span>}
              {chord.map((cap, c) => (
                <Cap key={c} tone={tone} className={capClassName}>
                  {cap}
                </Cap>
              ))}
            </Fragment>
          ))}
        </Fragment>
      ))}
    </span>
  );
}

/**
 * While "G" waits for its second key: a small sticker listing where it can take you, with a bar that runs out
 * when the wait does. Nothing to read for screen readers (the same pages are in the sidebar).
 */
function LeaderHint({ leader }) {
  return (
    <div className="kbd-hint pointer-events-none fixed inset-x-0 bottom-6 z-[95] flex justify-center px-4 md:pl-[252px]" aria-hidden="true">
      <div className="relative w-full max-w-[34rem] overflow-hidden rounded-lg border-2 border-ink bg-surface text-ink shadow-hard animate-pop">
        <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
          <Cap tone="marker" className="!h-7 !min-w-[28px] !text-[14px] font-bold">
            {leader.caps.join(' ')}
          </Cap>
          <span className="text-[13px] font-semibold text-ink-3">then a letter</span>
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-muted">
            <Cap>Esc</Cap> cancel
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-4 py-3 sm:grid-cols-4">
          {leader.options.map(o => (
            <li key={`${o.caps.join('')}-${o.label}`} className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
              <Cap tone="bold">{o.caps.join(' ')}</Cap>
              <span className="truncate">{o.label}</span>
            </li>
          ))}
        </ul>
        <span key={leader.at} className="leader-timer absolute inset-x-0 bottom-0 h-[3px] origin-left bg-marker" style={{ animationDuration: `${LEADER_MS}ms` }} />
      </div>
    </div>
  );
}
