import React from 'react';
import { cn } from './cn';

/** Top of every page: eyebrow (where you are), big title, one calm sentence, page-level actions. */
export default function PageHeader({ eyebrow, title, description, actions, aside, className }) {
  return (
    <header className={cn('mb-7 flex flex-col gap-5 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <p className="mb-3 inline-flex items-center gap-2 font-mono text-micro uppercase text-muted">
            <span className="h-2 w-2 rounded-full bg-marker ring-[1.5px] ring-ink" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h1 className="text-[32px] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink sm:text-[42px]">{title}</h1>
        {description && <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {(actions || aside) && <div className="flex flex-wrap items-center gap-2.5">{actions || aside}</div>}
    </header>
  );
}
