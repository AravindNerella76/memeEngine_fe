import React from 'react';
import { cn } from './cn';

/** Friendly full-width empty / error state: sticker icon, headline, one line of help, one action. */
export default function EmptyState({ icon: Icon, title, children, action, tone = 'marker', className }) {
  const tile = tone === 'bad' ? 'bg-bad-soft' : tone === 'ink' ? 'bg-paper-2' : 'bg-marker';
  return (
    <div className={cn('flex flex-col items-center rounded-lg border border-dashed border-line-strong bg-surface/70 px-6 py-14 text-center', className)}>
      {Icon && (
        <span className={cn('mb-5 grid h-16 w-16 -rotate-3 place-items-center rounded-lg border-2 border-ink shadow-hard', tile)} aria-hidden="true">
          <Icon className="h-7 w-7 text-ink" />
        </span>
      )}
      <h3 className="text-[20px] font-bold text-ink">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
