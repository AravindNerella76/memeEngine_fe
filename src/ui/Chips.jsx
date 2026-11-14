import React from 'react';
import { cn } from './cn';

/**
 * A row of mutually exclusive choices shown as pills (filters, fonts, tabs).
 *  - tone "ink": selected pill is black (filters)   - tone "marker": selected pill is yellow (choices)
 *  - mode "radio" (default) or "tab"
 * options: [{ value, label, icon, count, style, title }]
 */
export default function Chips({ value, onChange, options, label, tone = 'ink', size = 'md', mode = 'radio', scroll, className }) {
  const selected = tone === 'marker' ? 'border-ink bg-marker text-ink shadow-hard-sm' : 'border-ink bg-ink text-paper';
  return (
    <div
      role={mode === 'tab' ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={cn('flex gap-2', scroll ? 'no-scrollbar -mx-1 overflow-x-auto px-1 pb-1' : 'flex-wrap', className)}
    >
      {options.map(o => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={String(o.value)}
            type="button"
            role={mode === 'tab' ? 'tab' : 'radio'}
            aria-checked={mode === 'tab' ? undefined : active}
            aria-selected={mode === 'tab' ? active : undefined}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-all duration-150',
              size === 'sm' ? 'h-8 px-3 text-[12px]' : 'h-9 px-4 text-[13px]',
              active ? selected : 'border-line-strong bg-surface text-ink-3 hover:border-ink hover:text-ink'
            )}
            style={o.style}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {o.label}
            {typeof o.count === 'number' && (
              <span className={cn('tabular rounded-full px-1.5 font-mono text-[11px]', active ? 'bg-white/15' : 'bg-paper-2 text-muted')}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
