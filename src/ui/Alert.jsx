import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from './cn';

const TONES = {
  info: { box: 'border-info/25 bg-info-soft', icon: Info, color: 'text-info' },
  warn: { box: 'border-warn/30 bg-warn-soft', icon: AlertTriangle, color: 'text-warn' },
  bad: { box: 'border-bad/30 bg-bad-soft', icon: AlertCircle, color: 'text-bad' },
  ok: { box: 'border-ok/25 bg-ok-soft', icon: CheckCircle2, color: 'text-ok' },
  neutral: { box: 'border-line bg-paper-2/70', icon: Info, color: 'text-ink-3' }
};

/** Inline message: info / warn / bad / ok. Errors announce themselves to screen readers. */
export default function Alert({ tone = 'info', icon, title, children, action, className, compact }) {
  const T = TONES[tone];
  const Icon = icon || T.icon;
  return (
    <div role={tone === 'bad' ? 'alert' : undefined} className={cn('flex items-start gap-3 rounded-md border', compact ? 'px-3 py-2' : 'px-3.5 py-3', T.box, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', T.color)} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && 'text-ink-3')}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
