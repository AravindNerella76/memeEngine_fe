import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import Button from './Button';
import { cn } from './cn';

// ---- scroll lock shared by every open dialog -------------------------------------------------------
let lockCount = 0;
export function lockScroll() {
  if (lockCount++ === 0) {
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
  }
  return () => {
    if (--lockCount === 0) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  };
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' };

/**
 * Accessible modal: focus moves in and is trapped, Esc and a click on the backdrop close it, the page
 * behind does not scroll, and focus returns to what opened it. On phones it slides up as a sheet.
 * Put `data-autofocus` on the element that should receive focus first.
 */
export function Dialog({ open, onClose, title, description, size = 'md', tone = 'plain', children, footer, hideClose, className, bodyClassName, icon: Icon }) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const unlock = lockScroll();
    const panel = panelRef.current;
    (panel.querySelector('[data-autofocus]') || panel).focus({ preventScroll: true });

    const onKey = e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
      if (!nodes.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      unlock();
      if (previous && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="on-ink fixed inset-0 z-[80] overflow-y-auto bg-ink/70 backdrop-blur-[3px] animate-fade-in"
      onMouseDown={e => e.target === e.currentTarget && onCloseRef.current?.()}
    >
      <div className="flex min-h-full items-end justify-center sm:items-center sm:p-6" onMouseDown={e => e.target === e.currentTarget && onCloseRef.current?.()}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          tabIndex={-1}
          className={cn(
            'flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-xl bg-surface text-ink outline-none animate-pop sm:max-h-[calc(100dvh-3rem)] sm:rounded-lg',
            tone === 'sticker' ? 'border-2 border-ink shadow-hard-lg' : 'border border-ink/20 shadow-lift',
            SIZES[size],
            className
          )}
        >
          {(title || !hideClose) && (
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                {Icon && (
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded border-2 border-ink bg-marker text-ink shadow-hard-sm" aria-hidden="true">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                )}
                <div className="min-w-0">
                  {title && (
                    <h2 id={titleId} className="text-[19px] font-bold leading-tight text-ink">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p id={descId} className="mt-1 text-[13px] leading-relaxed text-muted">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {!hideClose && (
                <Button variant="ghost" size="icon-sm" onClick={() => onCloseRef.current?.()} aria-label="Close" title="Close (Esc)" className="-mr-1.5 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          <div className={cn('thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6', bodyClassName)}>{children}</div>
          {footer && <div className="shrink-0 border-t border-line bg-paper/70 px-5 py-3.5 sm:px-6">{footer}</div>}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- promise-based confirm (replaces window.confirm) ------------------------------------------------
const ConfirmContext = createContext(null);

/**
 * const confirm = useConfirm();
 * if (await confirm({ title, body, confirmLabel, tone: 'danger', preview })) { ... }
 */
export function useConfirm() {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return fn;
}

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const confirm = useCallback(opts => new Promise(resolve => setState({ opts, resolve })), []);
  const settle = result => {
    state?.resolve(result);
    setState(null);
  };
  const o = state?.opts || {};
  const danger = o.tone === 'danger';
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(state)}
        onClose={() => settle(false)}
        size="sm"
        tone="sticker"
        title={o.title}
        icon={danger ? AlertTriangle : undefined}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => settle(false)} data-autofocus>
              {o.cancelLabel || 'Cancel'}
            </Button>
            <Button variant={danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {o.confirmLabel || 'Confirm'}
            </Button>
          </div>
        }
      >
        {o.preview && <div className="mb-4">{o.preview}</div>}
        {o.body && <p className="text-[14px] leading-relaxed text-ink-3">{o.body}</p>}
      </Dialog>
    </ConfirmContext.Provider>
  );
}
