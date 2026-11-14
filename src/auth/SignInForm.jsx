import React, { useEffect, useRef, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useAuth } from './AuthProvider';
import PasswordInput from './PasswordInput';
import { Alert, Button, Field, Input } from '../ui';

const LAST_USER_KEY = 'meme_engine_last_username';
const readLastUser = () => {
  try {
    return localStorage.getItem(LAST_USER_KEY) || '';
  } catch {
    return '';
  }
};
const rememberUser = name => {
  try {
    localStorage.setItem(LAST_USER_KEY, name);
  } catch {
    /* storage unavailable: nothing is lost but a convenience */
  }
};

const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * The sign-in form, used on the sign-in page and in the "session ended" dialog.
 * Wrong password: the field clears and shakes, focus returns to it. Locked out: a live countdown.
 */
export default function SignInForm({ autoFocusUser = true }) {
  const { login } = useAuth();
  const [username, setUsername] = useState(readLastUser);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { code, message }
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [shake, setShake] = useState(0);
  const userRef = useRef(null);
  const passRef = useRef(null);

  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = remaining > 0;

  useEffect(() => {
    if (!locked) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [locked]);

  // the lock ended: clear the warning
  useEffect(() => {
    if (lockedUntil && !locked) {
      setLockedUntil(0);
      setError(null);
    }
  }, [lockedUntil, locked]);

  const submit = async e => {
    e.preventDefault();
    if (busy || locked) return;
    if (!username.trim()) {
      setError({ code: 'missing', message: 'Enter your username.' });
      userRef.current?.focus();
      return;
    }
    if (!password) {
      setError({ code: 'missing', message: 'Enter your password.' });
      passRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const r = await login(username.trim(), password);
    if (r.ok) {
      rememberUser(username.trim().toLowerCase());
      return; // this screen is replaced by the studio; nothing more to update
    }
    setBusy(false);
    setPassword('');
    setShake(k => k + 1);
    if (r.code === 'too_many_attempts' && r.retryAfterSeconds) {
      setNow(Date.now());
      setLockedUntil(Date.now() + r.retryAfterSeconds * 1000);
    }
    setError(r);
    passRef.current?.focus();
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div key={shake} className={shake ? 'animate-shake space-y-5' : 'space-y-5'}>
        <Field label="Username or e-mail">
          {({ id }) => (
            <Input
              id={id}
              ref={userRef}
              name="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={autoFocusUser && !username}
              disabled={busy}
              invalid={error?.code === 'missing' && !username.trim()}
            />
          )}
        </Field>
        <Field label="Password">
          {({ id }) => (
            <PasswordInput
              id={id}
              ref={passRef}
              name="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
              autoFocus={autoFocusUser && Boolean(username)}
              invalid={error?.code === 'invalid_credentials' || (error?.code === 'missing' && Boolean(username.trim()) && !password)}
            />
          )}
        </Field>
      </div>

      <div aria-live="polite">
        {error && error.code === 'too_many_attempts' && locked && (
          <Alert tone="warn" title="Too many wrong attempts">
            Sign-in is paused to protect the account. You can try again in <strong className="tabular font-mono">{clock(remaining)}</strong>.
          </Alert>
        )}
        {error && error.code !== 'too_many_attempts' && (
          <Alert tone="bad" compact>
            {error.message}
          </Alert>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={locked} leftIcon={<LogIn className="h-[18px] w-[18px]" />}>
        {busy ? 'Signing in…' : locked ? `Try again in ${clock(remaining)}` : 'Sign in'}
      </Button>
    </form>
  );
}
