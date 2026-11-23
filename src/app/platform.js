/** Apple keyboards: ⌘ instead of Ctrl, ⌥ instead of Alt. */
export const IS_APPLE = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');

/** The shortcut key people expect on this computer: ⌘ on Apple devices, Ctrl elsewhere. */
export const MOD_KEY = IS_APPLE ? '⌘' : 'Ctrl';

/** True while the person is typing in a field, where single-key shortcuts must stay out of the way. */
export const isTypingTarget = el => Boolean(el && el.closest && el.closest('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]):not([type=file]), textarea, select, [contenteditable=""], [contenteditable="true"]'));
