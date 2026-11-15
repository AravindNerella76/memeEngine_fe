import React from 'react';
import { Skeleton } from '../ui';

/**
 * Shown only while a page's code is still arriving (usually never: pages are prefetched while the app is
 * idle). Shaped like a real page (title, line of text, two columns) so nothing jumps when the page appears.
 */
export default function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page" role="status">
      <Skeleton className="mb-4 h-3.5 w-28" />
      <Skeleton className="mb-3 h-10 w-72 max-w-full" />
      <Skeleton className="mb-8 h-4 w-full max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
        <Skeleton className="h-72 !rounded-lg" />
        <Skeleton className="hidden h-72 !rounded-lg lg:block" />
      </div>
    </div>
  );
}
