import React, { forwardRef, useId } from 'react';
import { cn } from './cn';

/** Label with optional hint and "optional" marker. */
export function Label({ children, htmlFor, optional, hint, className, right }) {
  return (
    <div className={cn('mb-1.5 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
          {children}
          {optional && <span className="ml-1.5 font-normal text-muted">optional</span>}
        </label>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn('field', className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...rest }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn('field resize-y leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn('field', className)} {...rest}>
      {children}
    </select>
  );
});

/** Label + control + error as one unit. `children` may be a function receiving { id, invalid }. */
export function Field({ label, hint, error, optional, right, children, className }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <Label htmlFor={id} optional={optional} hint={hint} right={right}>
          {label}
        </Label>
      )}
      {typeof children === 'function' ? children({ id, invalid: Boolean(error) }) : children}
      {error && (
        <p className="mt-1.5 text-[12px] font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
