/** The shortcut key people expect on this computer: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl';

/** True while the person is typing in a field, where single-key shortcuts must stay out of the way. */
export const isTypingTarget = el => Boolean(el && el.closest && el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
