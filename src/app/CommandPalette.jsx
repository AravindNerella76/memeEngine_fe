import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { Kbd, cn } from '../ui';
import { lockScroll } from '../ui/Dialog';
import { buildResults } from './commands';
import { KeyCaps } from './shortcuts';

/**
 * Ctrl/⌘+K: jump to any page, open a recent meme, change a setting section or run an action without the mouse.
 * What it can do comes from app/commands.js (pages and settings sections are read from their own registries).
 * Loaded the first time it is opened (or while the app is idle), so it adds nothing to the first visit.
 */
export default function CommandPalette({ open, onClose, ctx }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const groups = useMemo(() => (open ? buildResults(query, ctx) : []), [open, query, ctx]);
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // a fresh start each time it opens; focus goes back to where it was when it closes
  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    setActive(0);
    const previous = document.activeElement;
    const unlock = lockScroll();
    inputRef.current?.focus();
    return () => {
      unlock();
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => setActive(0), [query]);

  // keep the highlighted row in view while moving with the arrow keys
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, groups]);

  if (!open) return null;

  const run = item => {
    if (!item) return;
    onClose();
    // let the palette finish closing (and give focus back) before the action moves the page
    setTimeout(() => item.run(ctx), 0);
  };

  const onKeyDown = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => (flat.length ? (a + 1) % flat.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => (flat.length ? (a - 1 + flat.length) % flat.length : 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(Math.max(0, flat.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(flat[active]);
    } else if (e.key === 'Tab') {
      e.preventDefault(); // focus stays in the field; the arrow keys are the way around
    }
  };

  let index = -1;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-scrim/70 px-3 pt-[12dvh] backdrop-blur-[3px] animate-fade-in sm:px-6" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Search and jump" data-palette className="flex max-h-[min(30rem,76dvh)] w-full max-w-xl flex-col overflow-hidden rounded-lg border-2 border-ink bg-surface text-ink shadow-hard-lg animate-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Jump to a page, a meme or a setting…"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] font-medium text-ink !outline-none placeholder:text-faint"
          />
          <Kbd>Esc</Kbd>
        </div>

        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {flat.length === 0 && <p className="px-3 py-8 text-center text-[14px] text-muted">Nothing matches. Try fewer words.</p>}
          {groups.map(group => (
            <div key={group.group} role="group" aria-label={group.group} className="mb-1 last:mb-0">
              <p className="px-3 pb-1 pt-2 font-mono text-micro uppercase text-muted" aria-hidden="true">
                {group.group}
              </p>
              {group.items.map(item => {
                index += 1;
                const i = index;
                const Icon = item.icon;
                const on = i === active;
                return (
                  <div
                    key={item.id}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={() => run(item)}
                    className={cn('flex h-11 cursor-pointer items-center gap-3 rounded px-3 text-[14px] font-semibold transition-colors', on ? 'bg-marker text-ink' : 'text-ink-3')}
                  >
                    {Icon && <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={on ? 2.4 : 2} aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.hint && <span className={cn('shrink-0 font-mono text-[11px] font-medium', on ? 'text-ink/70' : 'text-muted', item.keys && 'hidden min-[480px]:inline')}>{item.hint}</span>}
                    {/* its own shortcut, so the palette quietly teaches the faster way next time */}
                    {item.keys && <KeyCaps keys={item.keys} tone={on ? 'marker' : 'paper'} className="shrink-0 text-ink/60" />}
                    {on && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink/70" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-4 border-t border-line bg-paper px-4 py-2.5 text-[12px] text-muted sm:flex" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <KeyCaps keys="mod+k" /> from anywhere
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
