import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../ui';

/** Password field with a show/hide toggle and a Caps Lock warning. Works with password managers. */
const PasswordInput = forwardRef(function PasswordInput({ className, invalid, autoComplete = 'current-password', onKeyUp, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <div>
      <div className="relative">
        <input
          ref={ref}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          className={cn('field !pr-12', className)}
          onKeyUp={e => {
            setCaps(e.getModifierState?.('CapsLock') || false);
            onKeyUp?.(e);
          }}
          onBlur={() => setCaps(false)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {caps && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-warn" role="status">
          <span className="grid h-4 min-w-4 place-items-center rounded-sm bg-warn-soft px-1 font-mono text-[10px]">⇪</span> Caps Lock is on
        </p>
      )}
    </div>
  );
});

export default PasswordInput;
