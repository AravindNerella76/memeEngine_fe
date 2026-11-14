import React from 'react';
import { cn } from './cn';

const SIZES = {
  sm: 'h-8 w-8 rounded-[9px] text-[15px]',
  md: 'h-10 w-10 rounded-[11px] text-[19px]',
  lg: 'h-14 w-14 rounded-[15px] text-[28px]'
};

/**
 * The brand mark: Telugu "మీ" (mee, as in meme) on a yellow sticker with the same black outline and
 * hard shadow the memes themselves use.
 */
export function LogoMark({ size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'telugu-text inline-grid shrink-0 place-items-center border-2 border-ink bg-marker pt-px font-black leading-none text-ink shadow-[2.5px_2.5px_0_0_rgb(var(--ink))]',
        SIZES[size],
        className
      )}
    >
      మీ
    </span>
  );
}
