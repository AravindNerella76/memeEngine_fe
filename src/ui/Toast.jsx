import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { cn } from './cn';

const ToastContext = createContext(null);
let nextId = 0;

/** const toast = useToast(); toast.success('Saved'); toast.error('Could not save', { title: 'Settings' }) */
export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const KINDS = {
  success: { icon: Check, chip: 'bg-marker text-ink' },
  error: { icon: AlertTriangle, chip: 'bg-bad text-white' },
  info: { icon: Info, chip: 'bg-white/15 text-white' }
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback(id => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems(list => list.filter(t => t.id !== id));
  }, []);

  const push = useCallback(
    ({ kind = 'info', title, text, duration, action }) => {
      const id = ++nextId;
      const ms = duration ?? (kind === 'error' ? 8000 : action ? 15000 : 4200);
      setItems(list => [...list.slice(-3), { id, kind, title, text, action }]);
      if (ms > 0) timers.current.set(id, setTimeout(() => dismiss(id), ms));
      return id;
    },
    [dismiss]
  );

  // stable object: safe to use inside effect dependency lists
  const api = useMemo(
    () => ({
      push,
      dismiss,
      success: (text, o) => push({ kind: 'success', text, ...o }),
      error: (text, o) => push({ kind: 'error', text, ...o }),
      info: (text, o) => push({ kind: 'info', text, ...o })
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="on-ink pointer-events-none fixed inset-x-3 top-3 z-[90] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[380px]" aria-live="polite">
        {items.map(t => {
          const K = KINDS[t.kind] || KINDS.info;
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex animate-slide-in items-start gap-3 rounded-md border border-white/10 bg-ink p-3 pr-2 text-paper shadow-lift"
            >
              <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', K.chip)} aria-hidden="true">
                <K.icon className="h-3.5 w-3.5" strokeWidth={2.6} />
              </span>
              <div className="min-w-0 flex-1 py-0.5">
                {t.title && <p className="text-[13px] font-bold leading-snug">{t.title}</p>}
                {t.text && <p className={cn('text-[13px] leading-snug', t.title ? 'text-paper/75' : 'font-medium')}>{t.text}</p>}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                    className="mt-2 inline-flex h-7 items-center rounded-full bg-marker px-3 text-[12px] font-bold text-ink hover:bg-white"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="grid h-7 w-7 shrink-0 place-items-center rounded text-paper/60 hover:bg-white/10 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
