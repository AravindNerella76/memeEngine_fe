import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

/**
 * Collapsible row. The content stays mounted while closed (so state inside it, such as an analysed
 * reference, is kept) and is made inert so it cannot be tabbed into.
 */
export default function Disclosure({ title, summary, icon: Icon, badge, defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cn('border-b border-line last:border-b-0', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="group flex w-full items-center gap-3 py-3.5 text-left"
      >
        {Icon && (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded border border-line bg-paper text-ink-3 transition-colors group-hover:border-ink group-hover:bg-marker-soft"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">{title}</span>
          {summary && <span className="block truncate text-[12px] text-muted">{summary}</span>}
        </span>
        {badge}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180 text-ink')} aria-hidden="true" />
      </button>
      <div
        id={id}
        className={cn('grid transition-[grid-template-rows] duration-300 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        inert={open ? undefined : ''}
      >
        <div className="overflow-hidden">
          <div className={cn('pb-5 pt-1 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}>{children}</div>
        </div>
      </div>
    </div>
  );
}
