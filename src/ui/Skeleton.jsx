import React from 'react';
import { cn } from './cn';

/** Loading placeholder with a soft shimmer. Size it with className. */
export default function Skeleton({ className }) {
  return (
    <div className={cn('relative overflow-hidden rounded bg-paper-2', className)} aria-hidden="true">
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}
