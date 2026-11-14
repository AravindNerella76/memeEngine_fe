import React, { useCallback, useEffect, useState } from 'react';
import { Check, Circle, KeyRound, LogOut, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import { authRequest, useAuth } from '../../auth/AuthProvider';
import PasswordInput from '../../auth/PasswordInput';
import { Alert, Badge, Button, Card, CardHeader, Field, Skeleton, cn, useConfirm, useToast } from '../../ui';

const MIN_LENGTH = 12;

/** "Edge on Windows" from a User-Agent string: enough to recognise your own devices. */
function describeDevice(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const phone = /Android|iPhone|iPad|Mobile/.test(ua);
  return { label: os ? `${browser} on ${os}` : browser, phone };
}

const when = d => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function Rule({ ok, children }) {
  return (
    <li className={cn('flex items-center gap-2 text-[13px]', ok ? 'font-semibold text-ink' : 'text-muted')}>
      {ok ? <Check className="h-3.5 w-3.5 text-ok" strokeWidth={3} aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 text-faint" aria-hidden="true" />}
      {children}
      <span className="sr-only">{ok ? '(done)' : '(not yet)'}</span>
    </li>
  );
}

function ChangePassword({ onChanged }) {
  const { username } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const longEnough = next.length >= MIN_LENGTH;
  const notName = !username || username.length < 3 || !next.toLowerCase().includes(username.toLowerCase());
  const matches = Boolean(next) && next === again;
  const differs = Boolean(next) && next !== current;
  const ready = Boolean(current) && longEnough && notName && matches && differs;

  const submit = async e => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErrors({});
    try {
      const { res, data } = await authRequest('POST', '/api/auth/change-password', { currentPassword: current, newPassword: next });
      if (res.ok) {
        setCurrent('');
        setNext('');
        setAgain('');
        toast.success(data.otherSessionsEnded ? `Password changed. ${data.otherSessionsEnded} other sign-in${data.otherSessionsEnded === 1 ? ' was' : 's were'} ended.` : 'Password changed.');
        onChanged?.();
      } else if (data.code === 'wrong_current_password') setErrors({ current: data.message });
      else if (data.code === 'weak_password' || data.code === 'same_password') setErrors({ next: data.message });
      else setErrors({ form: data.message || 'The password could not be changed.' });
    } catch {
      setErrors({ form: 'Could not reach the server. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card pad="md">
      <CardHeader icon={KeyRound} title="Change password" description="Signs you out everywhere else. This device stays signed in." />
      <form onSubmit={submit} className="space-y-5" noValidate>
        {/* helps password managers connect the fields to this account */}
        <input type="text" name="username" value={username || ''} autoComplete="username" readOnly hidden aria-hidden="true" tabIndex={-1} />
        <Field label="Current password" error={errors.current}>
          {({ id, invalid }) => <PasswordInput id={id} value={current} onChange={e => setCurrent(e.target.value)} invalid={invalid} disabled={busy} />}
        </Field>
        <Field label="New password" error={errors.next}>
          {({ id, invalid }) => <PasswordInput id={id} value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" invalid={invalid} disabled={busy} />}
        </Field>
        <Field label="Repeat the new password">
          {({ id }) => <PasswordInput id={id} value={again} onChange={e => setAgain(e.target.value)} autoComplete="new-password" invalid={Boolean(again) && !matches} disabled={busy} />}
        </Field>

        <ul className="space-y-1.5 rounded-md border border-line bg-paper/60 px-4 py-3" aria-label="Password checks">
          <Rule ok={longEnough}>At least {MIN_LENGTH} characters. A few random words works well.</Rule>
          <Rule ok={notName}>Does not contain your username</Rule>
          <Rule ok={differs}>Different from the current password</Rule>
          <Rule ok={matches}>Both new passwords match</Rule>
        </ul>

        {errors.form && <Alert tone="bad" compact>{errors.form}</Alert>}
        <Button type="submit" variant="dark" loading={busy} disabled={!ready}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

function Sessions({ reloadKey }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [ending, setEnding] = useState(false);

  const load = useCallback(async () => {
    try {
      const { res, data } = await authRequest('GET', '/api/auth/sessions');
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      setRows(data.sessions || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const endOthers = async () => {
    const ok = await confirm({
      title: 'Sign out everywhere else?',
      body: 'Every other phone, tablet or computer that is signed in will have to sign in again. This device stays signed in.',
      confirmLabel: 'Sign them out',
      tone: 'danger'
    });
    if (!ok) return;
    setEnding(true);
    try {
      const { res, data } = await authRequest('POST', '/api/auth/logout-others');
      if (!res.ok) throw new Error(data.message || 'Failed');
      toast.success(data.ended ? `${data.ended} other sign-in${data.ended === 1 ? '' : 's'} ended.` : 'No other sign-ins were active.');
      await load();
    } catch (e) {
      toast.error(`Could not end the other sign-ins: ${e.message}`);
    } finally {
      setEnding(false);
    }
  };

  const others = rows ? rows.filter(r => !r.current).length : 0;

  return (
    <Card pad="md">
      <CardHeader
        icon={ShieldCheck}
        title="Where you are signed in"
        description="Sessions end by themselves after a week without use. Recognise them all? Good. If not, end them and change the password."
        actions={
          <Button variant="danger-soft" size="sm" onClick={endOthers} loading={ending} disabled={!others} leftIcon={<LogOut className="h-3.5 w-3.5" />}>
            Sign out others
          </Button>
        }
      />
      {error && <Alert tone="bad" compact>{error}</Alert>}
      {!rows && !error && (
        <div className="space-y-2.5" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}
      {rows && (
        <ul className="space-y-2.5">
          {rows.map((s, i) => {
            const d = describeDevice(s.userAgent);
            const Icon = d.phone ? Smartphone : Monitor;
            return (
              <li key={i} className={cn('flex items-center gap-3.5 rounded-md border p-3.5', s.current ? 'border-ink bg-marker-soft' : 'border-line bg-paper/60')}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded border border-ink/15 bg-surface" aria-hidden="true">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                    {d.label}
                    {s.current && <Badge tone="ink" size="sm">This device</Badge>}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-muted">
                    Last active {when(s.lastSeenAt)} · signed in {when(s.signedInAt)}
                    {s.ip ? <span className="font-mono"> · {s.ip}</span> : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function AccountSection() {
  const { username, authEnabled } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  if (!authEnabled) {
    return (
      <Alert tone="warn" title="Login is switched off on this server">
        The server was started with <code className="font-mono text-[12px]">AUTH_ENABLED=false</code>, so there is no account to manage. Remove that line from <code className="font-mono text-[12px]">memeEngine_be/.env</code> and restart to turn sign-in back on.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card pad="md" className="flex flex-wrap items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border-2 border-ink bg-marker font-display text-[24px] font-extrabold uppercase shadow-hard-sm" aria-hidden="true">
          {(username || '?').charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-mono uppercase tracking-wider text-muted">Signed in as</p>
          <p className="truncate text-[20px] font-extrabold leading-tight tracking-[-0.01em]">{username}</p>
          <p className="mt-0.5 text-[13px] text-muted">The owner of this studio. There is one account; it is created from the command line.</p>
        </div>
      </Card>
      <ChangePassword onChanged={() => setReloadKey(k => k + 1)} />
      <Sessions reloadKey={reloadKey} />
      <p className="px-1 text-[12.5px] leading-relaxed text-muted">
        Forgot the password? On the server computer, in <code className="font-mono text-[12px]">memeEngine_be</code>, run <code className="font-mono text-[12px]">npm run auth:reset-password</code>. It also signs out every device.
      </p>
    </div>
  );
}
