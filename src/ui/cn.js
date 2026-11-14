import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge our custom tokens so `text-micro` is not mistaken for a colour
// and our sticker shadows replace each other instead of piling up.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro'] }],
      shadow: [{ shadow: ['hard', 'hard-sm', 'hard-lg', 'hard-marker', 'soft', 'lift', 'ring'] }]
    }
  }
});

/** Join class names, resolving Tailwind conflicts (the last one wins). */
export const cn = (...inputs) => twMerge(clsx(inputs));
