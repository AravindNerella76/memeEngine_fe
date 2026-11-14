import React from 'react';
import { cn } from './cn';

const TONES = {
  neutral: 'bg-paper-2 text-ink-3 border-line',
  outline: 'bg-transparent text-ink-3 border-line-strong',
  marker: 'bg-marker text-ink border-ink',
  ink: 'bg-ink text-paper border-ink',
  ok: 'bg-ok-soft text-ok border-ok/25',
  warn: 'bg-warn-soft text-warn border-warn/30',
  bad: 'bg-bad-soft text-bad border-bad/25',
  info: 'bg-info-soft text-info border-info/25',
  'on-ink': 'bg-white/10 text-paper border-white/15'
};

const DOTS = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  marker: 'bg-ink',
  neutral: 'bg-faint',
  ink: 'bg-marker',
  outline: 'bg-faint',
  'on-ink': 'bg-marker'
};

/** Small status / meta label. */
export default function Badge({ tone = 'neutral', icon: Icon, dot, mono, size = 'md', className, children, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-[12px]',
        mono && 'font-mono font-medium',
        TONES[tone],
        className
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} aria-hidden="true" />}
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Keyboard key cap, for hints like "Ctrl V". */
export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-line-strong bg-surface px-1.5 font-mono text-[11px] font-medium text-ink-3 shadow-[0_1px_0_rgb(var(--line-strong))]',
        className
      )}
    >
      {children}
    </kbd>
  );
}
