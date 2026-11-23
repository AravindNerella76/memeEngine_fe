import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Copy, Database, HeartPulse, Instagram, KeyRound, Loader2, MessageCircle, MinusCircle, RefreshCw, Server, Sparkles, Bell, TriangleAlert, XCircle } from 'lucide-react';
import { API_BASE, apiFetch } from '../../api';
import { Alert, Button, Card, PageHeader, Skeleton, cn, useDocumentTitle } from '../../ui';
import { feedback, press, useShortcuts } from '../../app/shortcuts';

/**
 * One screen that answers "is everything working?": every connection the studio depends on, in plain words, with what
 * to do about each problem. Opens with the quick checks, then asks Meta in the background (a few seconds).
 */

const GROUP_ICON = { server: Server, signin: KeyRound, whatsapp: MessageCircle, instagram: Instagram, engine: Sparkles, notifications: Bell };
const STATUS = {
  ok: { icon: CheckCircle2, color: 'text-ok', label: 'Working' },
  warn: { icon: TriangleAlert, color: 'text-warn', label: 'Look at this' },
  bad: { icon: XCircle, color: 'text-bad', label: 'Broken' },
  off: { icon: MinusCircle, color: 'text-faint', label: 'Not set up' }
};

const since = iso => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 90) return `${s} seconds ago`;
  return `${Math.round(s / 60)} minutes ago`;
};

function useTick(ms) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN(n => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

/** The headline: one sticker that says how things are, in a sentence. */
function Verdict({ report, checking, onCheck }) {
  useTick(15_000);
  const { overall, counts } = report;
  const problems = counts.bad + counts.warn;
  const title = overall === 'bad' ? `${counts.bad} thing${counts.bad === 1 ? '' : 's'} need${counts.bad === 1 ? 's' : ''} you` : overall === 'warn' ? `Working. ${counts.warn} thing${counts.warn === 1 ? '' : 's'} to look at` : 'Everything works';
  const sub =
    overall === 'ok'
      ? `${counts.ok} checks passed${counts.off ? `, ${counts.off} not set up yet` : ''}. Nothing to do.`
      : `${counts.ok} checks passed${problems ? `, ${problems} below need${problems === 1 ? 's' : ''} attention` : ''}${counts.off ? `, ${counts.off} not set up` : ''}.`;
  const Icon = overall === 'bad' ? XCircle : overall === 'warn' ? TriangleAlert : Check;
  return (
    <Card tone="sticker" pad="lg" className={cn('relative overflow-hidden', overall === 'ok' && 'bg-marker')}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          className={cn(
            'grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-ink shadow-hard-sm',
            overall === 'ok' ? 'bg-surface text-ink' : overall === 'warn' ? 'bg-marker text-ink' : 'bg-bad text-white'
          )}
          aria-hidden="true"
        >
          <Icon className="h-8 w-8" strokeWidth={overall === 'ok' ? 3.2 : 2.4} />
        </span>
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <h2 className="text-[26px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[30px]">{title}</h2>
          <p className={cn('mt-1 text-[14px]', overall === 'ok' ? 'text-ink/75' : 'text-muted')}>{sub}</p>
          <p className={cn('mt-2 font-mono text-[11.5px] uppercase tracking-wider', overall === 'ok' ? 'text-ink/60' : 'text-faint')}>
            {checking ? 'Asking Meta and the services…' : `Checked ${since(report.checkedAt)}${report.live ? '' : ' · quick check'}`}
          </p>
        </div>
        <Button variant={overall === 'ok' ? 'dark' : 'primary'} onClick={onCheck} loading={checking} leftIcon={<RefreshCw className="h-4 w-4" />} className="shrink-0" data-key-action="health-check" aria-keyshortcuts="R" title="Check again (R)">
          {checking ? 'Checking…' : 'Check again'}
        </Button>
      </div>
    </Card>
  );
}

function CheckRow({ check, pendingLive }) {
  const S = STATUS[check.status] || STATUS.off;
  const Icon = S.icon;
  const loud = check.status === 'bad' || check.status === 'warn';
  return (
    <li id={`check-${check.id}`} className={cn('scroll-mt-24 rounded-md px-3.5 py-3', loud ? (check.status === 'bad' ? 'bg-bad-soft' : 'bg-warn-soft') : '')}>
      <div className="flex items-start gap-3">
        {pendingLive ? <Loader2 className="mt-0.5 h-[18px] w-[18px] shrink-0 animate-spin text-faint" aria-label="Checking" /> : <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', S.color)} aria-label={S.label} />}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug">
            <span className="font-bold">{check.title}</span>
            <span className="text-ink-3"> · {check.summary}</span>
          </p>
          {check.detail && <p className="mt-1 text-[13px] leading-relaxed text-muted">{check.detail}</p>}
          {check.fix && (loud || check.status === 'off') && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-[13px] leading-relaxed text-ink-3">
                <span className="font-semibold text-ink">Fix: </span>
                {check.fix.text}
              </p>
              {check.fix.to && (
                <Button as={Link} to={check.fix.to} variant={check.status === 'bad' ? 'dark' : 'secondary'} size="sm" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  {check.fix.label || 'Open'}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function asText(report) {
  const lines = [`Meme Engine health · ${new Date(report.checkedAt).toLocaleString()} · ${report.overall.toUpperCase()}`];
  for (const g of report.groups) {
    lines.push('', g.title);
    for (const c of g.checks) lines.push(`  [${c.status}] ${c.title}: ${c.summary}${c.detail ? ` (${c.detail})` : ''}`);
  }
  return lines.join('\n');
}

export default function HealthPage() {
  useDocumentTitle('Health');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async live => {
    const mine = ++seq.current;
    if (live) setChecking(true);
    try {
      const res = await apiFetch(`${API_BASE}/api/system/health${live ? '?live=1' : ''}`);
      const data = await res.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!res.ok) throw new Error(data.message || `The server answered ${res.status}.`);
      setReport(data);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(e.message === 'Failed to fetch' ? 'The server cannot be reached, so nothing else can be checked.' : e.message);
    } finally {
      if (mine === seq.current) setChecking(false);
    }
  }, []);

  // the quick report at once, then the thorough one (asks Meta) right behind it
  useEffect(() => {
    load(false).then(() => load(true));
  }, [load]);

  const problems = useMemo(() => (report ? report.groups.flatMap(g => g.checks.filter(c => c.status === 'bad' || c.status === 'warn').map(c => ({ ...c, group: g.title }))) : []), [report]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  useShortcuts([
    { keys: 'r', label: 'Check everything again', when: !checking, run: () => void press('health-check') },
    {
      keys: 'c',
      label: 'Copy the report',
      when: Boolean(report),
      run: () => {
        feedback(document.querySelector('[data-key-action="health-copy"]'), 'press');
        copy();
      }
    }
  ]);

  return (
    <div className="page-enter mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Setup"
        title="Health"
        description="Every connection the studio depends on, checked in plain words, with what to do when something is off."
        actions={
          report && (
            <Button variant="ghost" size="sm" onClick={copy} data-key-action="health-copy" aria-keyshortcuts="C" title="Copy report (C)" leftIcon={copied ? <Check className="h-3.5 w-3.5 text-ok" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}>
              {copied ? 'Copied' : 'Copy report'}
            </Button>
          )
        }
      />

      {error && !report && (
        <Alert tone="bad" icon={Database} title="Could not run the checks" action={<Button size="sm" variant="dark" onClick={() => load(true)}>Try again</Button>}>
          {error}
        </Alert>
      )}

      {!report && !error && (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-36" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      )}

      {report && (
        <div className="space-y-5">
          <Verdict report={report} checking={checking} onCheck={() => load(true)} />
          {error && <Alert tone="warn" compact>{error} Showing the last results.</Alert>}

          {problems.length > 0 && (
            <nav aria-label="Things that need attention" className="flex flex-wrap gap-2">
              {problems.map(p => (
                <a
                  key={p.id}
                  href={`#check-${p.id}`}
                  onClick={e => {
                    e.preventDefault();
                    document.getElementById(`check-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors', p.status === 'bad' ? 'border-bad/30 bg-bad-soft text-bad hover:border-bad' : 'border-warn/30 bg-warn-soft text-warn hover:border-warn')}
                >
                  {p.status === 'bad' ? <XCircle className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                  {p.group}: {p.title}
                </a>
              ))}
            </nav>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {report.groups.map(g => {
              const Icon = GROUP_ICON[g.id] || HeartPulse;
              const worst = g.checks.some(c => c.status === 'bad') ? 'bad' : g.checks.some(c => c.status === 'warn') ? 'warn' : g.checks.every(c => c.status === 'off') ? 'off' : 'ok';
              return (
                <Card key={g.id} pad="sm" className={cn(worst === 'bad' && 'border-bad/40')}>
                  <div className="mb-2 flex items-center gap-2.5 px-1.5 pt-0.5">
                    <span className="grid h-8 w-8 place-items-center rounded border border-ink/15 bg-marker-soft" aria-hidden="true">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h2 className="flex-1 text-[16px] font-bold tracking-[-0.01em]">{g.title}</h2>
                    <span className={cn('font-mono text-[10.5px] uppercase tracking-wider', STATUS[worst].color)}>{STATUS[worst].label}</span>
                  </div>
                  <ul className="space-y-1">
                    {g.checks.map(c => (
                      <CheckRow key={c.id} check={c} pendingLive={checking && !report.live && c.id === 'whatsapp-token'} />
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
