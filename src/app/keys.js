import { IS_APPLE } from './platform';

/**
 * The little language shortcuts are written in. Pure (no React, no DOM), so it is easy to test.
 *
 *   "mod+enter"   Ctrl+Enter, or ⌘+Enter on a Mac        "shift+n"  Shift and N
 *   "g m"         G, then M (a sequence)                  "?"        whatever the keyboard needs to type a ?
 *   ["j", "down"] either of the two
 *
 * Names: mod, ctrl, alt, shift; enter, esc, up, down, left, right, space, del, backspace, tab, home, end,
 * pageup, pagedown; or any single character.
 */

const ALIASES = {
  esc: 'escape',
  return: 'enter',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  space: ' ',
  spacebar: ' ',
  del: 'delete',
  plus: '+'
};

/** "mod+shift+s" -> { mod, ctrl, alt, shift, key } */
export function parseChord(text) {
  const parts = String(text).toLowerCase().split('+');
  // "mod++" / "+" : a trailing empty part means the key itself is "+"
  const raw = parts.length > 1 && parts[parts.length - 1] === '' ? '+' : parts.pop();
  const chord = { mod: false, ctrl: false, alt: false, shift: false, key: ALIASES[raw] || raw };
  for (const p of parts) {
    if (p === 'mod' || p === 'cmd' || p === 'meta') chord.mod = true;
    else if (p === 'ctrl' || p === 'control') chord.ctrl = true;
    else if (p === 'alt' || p === 'option') chord.alt = true;
    else if (p === 'shift') chord.shift = true;
  }
  return chord;
}

/** "g m" -> [chord, chord]. A lone space means the space bar: write it as "space". */
export const parseSequence = text => String(text).trim().split(/\s+/).map(parseChord);

/** One shortcut can be written as a string or as alternatives. */
export const alternatives = keys => (Array.isArray(keys) ? keys : [keys]).filter(Boolean);

/** A letter, digit or named key: Shift must match exactly. A symbol (? / [ ,): Shift is part of how it is typed. */
const shiftMatters = key => key.length > 1 || /[a-z0-9]/.test(key);

/** The key of a keyboard event, the way chords name it. */
export function eventKey(e) {
  let key = String(e.key || '').toLowerCase();
  // with ⌥/Ctrl/⌘ held, some layouts report a different character (⌥+S is "ß" on a Mac): use the physical key
  if ((e.altKey || e.ctrlKey || e.metaKey) && e.code) {
    if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3).toLowerCase();
    else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
  }
  return key;
}

export function chordMatches(chord, e) {
  if (eventKey(e) !== chord.key) return false;
  const ctrl = Boolean(e.ctrlKey);
  const meta = Boolean(e.metaKey);
  if (chord.mod) {
    if (!(ctrl || meta)) return false;
  } else if (chord.ctrl) {
    if (!ctrl || meta) return false;
  } else if (ctrl || meta) return false;
  if (Boolean(e.altKey) !== chord.alt) return false;
  if (shiftMatters(chord.key) && Boolean(e.shiftKey) !== chord.shift) return false;
  return true;
}

// ---- how keys are shown ------------------------------------------------------------------------------
const KEY_LABELS = {
  enter: '↵',
  escape: 'Esc',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  ' ': 'Space',
  delete: 'Del',
  backspace: '⌫',
  tab: 'Tab',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn'
};
const KEY_WORDS = { enter: 'Enter', arrowup: 'Up', arrowdown: 'Down', arrowleft: 'Left', arrowright: 'Right', delete: 'Delete', backspace: 'Backspace' };

/** Key caps for one chord: ["Ctrl", "↵"]. */
export function chordCaps(chord, apple = IS_APPLE) {
  const caps = [];
  if (chord.ctrl) caps.push(apple ? '⌃' : 'Ctrl');
  if (chord.mod) caps.push(apple ? '⌘' : 'Ctrl');
  if (chord.alt) caps.push(apple ? '⌥' : 'Alt');
  if (chord.shift && shiftMatters(chord.key)) caps.push(apple ? '⇧' : 'Shift');
  caps.push(KEY_LABELS[chord.key] || chord.key.toUpperCase());
  return caps;
}

/** Caps for every step of every alternative: [[["G"], ["M"]], ...]. */
export const keyCaps = (keys, apple = IS_APPLE) => alternatives(keys).map(seq => parseSequence(seq).map(c => chordCaps(c, apple)));

/** Words for a tooltip or a screen reader: "Ctrl Enter", "G then M", "J or Down". */
export function describeKeys(keys, apple = IS_APPLE) {
  return alternatives(keys)
    .map(seq =>
      parseSequence(seq)
        .map(c => chordCaps(c, apple).map((cap, i, all) => (i === all.length - 1 ? KEY_WORDS[c.key] || cap : cap)).join(' '))
        .join(' then ')
    )
    .join(' or ');
}

/** The aria-keyshortcuts value (only single chords can be expressed there). */
export function ariaKeys(keys, apple = IS_APPLE) {
  const names = { enter: 'Enter', escape: 'Escape', arrowup: 'ArrowUp', arrowdown: 'ArrowDown', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', ' ': 'Space', delete: 'Delete', backspace: 'Backspace' };
  return alternatives(keys)
    .map(parseSequence)
    .filter(seq => seq.length === 1)
    .map(([c]) => [c.mod && (apple ? 'Meta' : 'Control'), c.ctrl && 'Control', c.alt && 'Alt', c.shift && shiftMatters(c.key) && 'Shift', names[c.key] || c.key.toUpperCase()].filter(Boolean).join('+'))
    .join(' ') || undefined;
}
