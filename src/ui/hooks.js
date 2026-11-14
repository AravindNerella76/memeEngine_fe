import { useEffect } from 'react';
import { BRAND } from '../brand';

/** Sets the browser tab title for the page ("Adapt · Meme Engine"). */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${BRAND.product}` : BRAND.product;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

/** "Today", "Yesterday", "3 days ago", else "12 Nov 2026". */
export function friendlyDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
