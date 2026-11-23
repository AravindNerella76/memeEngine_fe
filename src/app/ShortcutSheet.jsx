import React from 'react';
import { Keyboard } from 'lucide-react';
import { Dialog, cn } from '../ui';
import { Cap, KeyCaps } from './shortcuts';
import { describeKeys } from './keys';

/**
 * The "?" cheat sheet. Built from what is registered right now, so it always tells the truth: the keys of the page
 * you are on first, then the ones that work everywhere. Keys that do nothing at the moment are shown dimmed.
 * Downloaded the first time it is opened.
 */
export default function ShortcutSheet({ open, groups, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      name="shortcuts"
      size="lg"
      tone="sticker"
      icon={Keyboard}
      title="Keyboard shortcuts"
      description="Single keys work whenever you are not typing. Press ? anywhere to bring this back."
      footer={
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Cap>Esc</Cap> steps out of a text field, so single keys work again
          </span>
          <span className="inline-flex items-center gap-1.5 sm:ml-auto">
            <Cap>?</Cap> or <Cap>Esc</Cap> closes this
          </span>
        </p>
      }
    >
      <div className="gap-x-8 sm:columns-2">
        {groups.map((g, gi) => (
          <section key={g.title} className={cn('mb-6 break-inside-avoid last:mb-0', gi === 0 && g.page && 'sm:[column-span:all]')}>
            <h3 className="mb-2 flex items-center gap-2 font-mono text-micro uppercase text-muted">
              {g.page && <span className="h-2 w-2 rounded-full bg-marker ring-[1.5px] ring-ink" aria-hidden="true" />}
              {g.title}
            </h3>
            <ul className={cn('divide-y divide-line rounded-md border border-line', gi === 0 && g.page && 'sm:grid sm:grid-cols-2 sm:divide-y-0 sm:[&>li:nth-child(n+3)]:border-t sm:[&>li:nth-child(even)]:border-l')}>
              {g.items.map(item => (
                <li
                  key={`${item.label}-${String(item.keys)}`}
                  className={cn('flex min-h-11 items-center justify-between gap-3 border-line px-3 py-2', item.off && 'opacity-45')}
                  title={item.off ? 'Not available right now' : undefined}
                >
                  <span className="min-w-0 text-[13.5px] font-semibold leading-snug text-ink-3">
                    {item.label}
                    <span className="sr-only">: {describeKeys(item.keys)}</span>
                  </span>
                  <KeyCaps keys={item.keys} touch className="shrink-0 justify-end" />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
