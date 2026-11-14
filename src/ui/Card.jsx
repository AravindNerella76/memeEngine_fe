import React from 'react';
import { cn } from './cn';

const TONES = {
  default: 'bg-surface border border-line shadow-soft',
  flat: 'bg-surface border border-line',
  muted: 'bg-paper-2/70 border border-line',
  sticker: 'bg-surface border-2 border-ink shadow-hard',
  stage: 'stage-dots on-ink text-paper border-2 border-ink',
  ghost: ''
};
const PADS = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

/** Surface container. `stage` is the dark frame that presents memes. */
export function Card({ as: Comp = 'section', tone = 'default', pad = 'md', className, children, ...rest }) {
  return (
    <Comp className={cn('rounded-lg', TONES[tone], PADS[pad], className)} {...rest}>
      {children}
    </Comp>
  );
}

/** Title block for a card: optional icon tile, eyebrow, title, description and right-aligned actions. */
export function CardHeader({ icon: Icon, eyebrow, title, description, actions, className, as: Title = 'h3' }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-3', className)}>
      <div className="flex min-w-[15rem] flex-1 items-start gap-3">
        {Icon && (
          <span
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded border border-ink/15 bg-marker-soft text-ink"
            aria-hidden="true"
          >
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="mb-0.5 font-mono text-micro uppercase text-muted">{eyebrow}</p>}
          <Title className="text-[17px] font-bold leading-snug text-ink">{title}</Title>
          {description && <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Label + value row used for parameter lists. */
export function DataRow({ label, children, className, mono }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px] last:border-b-0', className)}>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={cn('min-w-0 break-words text-right font-semibold text-ink', mono && 'font-mono text-[12px] font-medium')}>{children}</dd>
    </div>
  );
}
