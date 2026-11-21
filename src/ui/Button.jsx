import React, { forwardRef } from 'react';
import { cn } from './cn';
import Spinner from './Spinner';

const BASE =
  'relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none ' +
  'transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-150 ' +
  'disabled:opacity-45 disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:pointer-events-none';

// The yellow "sticker" button presses down into its own shadow.
// `can:` (tailwind.config.js) = not disabled. Unlike `enabled:` it also matches a Button rendered as a link (as="a" / Link),
// so links get the same hover and press feedback as buttons.
const STICKER =
  'border-2 border-ink shadow-hard can:hover:-translate-x-0.5 can:hover:-translate-y-0.5 ' +
  'can:hover:shadow-[5px_5px_0_0_rgb(var(--shadow))] can:active:translate-x-[3px] can:active:translate-y-[3px] ' +
  'can:active:shadow-none disabled:shadow-none';

const VARIANTS = {
  primary: `bg-marker text-ink ${STICKER}`,
  dark: 'bg-ink text-paper border-2 border-ink can:hover:bg-ink-3 can:active:translate-y-px',
  secondary:
    'bg-surface text-ink border border-line-strong shadow-sm can:hover:border-ink can:hover:bg-paper can:active:translate-y-px',
  ghost: 'text-ink border border-transparent can:hover:bg-ink/[0.07] can:active:bg-ink/[0.12]',
  danger: 'bg-bad text-white border border-bad can:hover:brightness-95 can:active:translate-y-px',
  'danger-soft': 'bg-bad-soft text-bad border border-bad/25 can:hover:bg-bad can:hover:text-white',
  'on-ink': 'bg-white/10 text-white border border-white/15 can:hover:bg-white/20',
  'marker-on-ink':
    'bg-marker text-ink border-2 border-marker can:hover:bg-white can:hover:border-white can:active:translate-y-px',
  link: 'text-ink underline decoration-marker decoration-[3px] underline-offset-[3px] can:hover:decoration-ink p-0 h-auto rounded-sm'
};

const SIZES = {
  sm: 'h-9 px-3.5 text-[13px] rounded',
  md: 'h-11 px-5 text-[14px] rounded-md',
  lg: 'h-[52px] px-7 text-[15px] rounded-md tracking-[-0.005em]',
  'icon-sm': 'h-8 w-8 rounded',
  icon: 'h-10 w-10 rounded'
};

/**
 * One button for the whole app.
 *  - variant: primary (yellow sticker, the one main action per screen) | dark | secondary | ghost |
 *             danger | danger-soft | on-ink | marker-on-ink | link
 *  - as: render as another element/component (e.g. "a")
 *  - loading: shows a spinner and blocks clicks
 */
const Button = forwardRef(function Button(
  { as: Comp = 'button', variant = 'secondary', size = 'md', loading = false, leftIcon, rightIcon, className, children, disabled, type, ...rest },
  ref
) {
  const isButton = Comp === 'button';
  const blocked = disabled || loading;
  return (
    <Comp
      ref={ref}
      type={isButton ? type || 'button' : type}
      disabled={isButton ? blocked : undefined}
      aria-disabled={!isButton && blocked ? true : undefined}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], variant === 'link' ? '' : SIZES[size], className)}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </Comp>
  );
});

export default Button;
