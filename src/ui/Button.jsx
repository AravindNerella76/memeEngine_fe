import React, { forwardRef } from 'react';
import { cn } from './cn';
import Spinner from './Spinner';

const BASE =
  'relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none ' +
  'transition-[transform,box-shadow,background-color,color,border-color,opacity] duration-150 ' +
  'disabled:opacity-45 disabled:cursor-not-allowed aria-disabled:opacity-45 aria-disabled:pointer-events-none';

// The yellow "sticker" button presses down into its own shadow.
const STICKER =
  'border-2 border-ink shadow-hard enabled:hover:-translate-x-0.5 enabled:hover:-translate-y-0.5 ' +
  'enabled:hover:shadow-[5px_5px_0_0_rgb(var(--ink))] enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] ' +
  'enabled:active:shadow-none disabled:shadow-none';

const VARIANTS = {
  primary: `bg-marker text-ink ${STICKER}`,
  dark: 'bg-ink text-paper border-2 border-ink enabled:hover:bg-ink-3 enabled:active:translate-y-px',
  secondary:
    'bg-surface text-ink border border-line-strong shadow-sm enabled:hover:border-ink enabled:hover:bg-paper enabled:active:translate-y-px',
  ghost: 'text-ink border border-transparent enabled:hover:bg-ink/[0.07] enabled:active:bg-ink/[0.12]',
  danger: 'bg-bad text-white border border-bad enabled:hover:brightness-95 enabled:active:translate-y-px',
  'danger-soft': 'bg-bad-soft text-bad border border-bad/25 enabled:hover:bg-bad enabled:hover:text-white',
  'on-ink': 'bg-white/10 text-white border border-white/15 enabled:hover:bg-white/20',
  'marker-on-ink':
    'bg-marker text-ink border-2 border-marker enabled:hover:bg-white enabled:hover:border-white enabled:active:translate-y-px',
  link: 'text-ink underline decoration-marker decoration-[3px] underline-offset-[3px] enabled:hover:decoration-ink p-0 h-auto rounded-sm'
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
