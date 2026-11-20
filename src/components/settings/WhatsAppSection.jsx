import React, { useCallback, useEffect, useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Eye, EyeOff, ExternalLink, KeyRound, MessageCircle, RefreshCw, ShieldCheck, Shuffle, Undo2, X } from 'lucide-react';
import { whatsappApi } from './settingsModel';
import { Alert, Badge, Button, Card, Disclosure, Input, Label, Skeleton, cn, useConfirm, useSystemStatus, useToast } from '../../ui';

const Code = ({ children }) => <code className="rounded border border-line bg-paper-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">{children}</code>;

/** "in 5 hours", "2 days ago". */
function relative(date) {
  const ms = new Date(date).getTime() - Date.now();
  const mins = Math.round(Math.abs(ms) / 60000);
  const text = mins < 60 ? `${Math.max(1, mins)} min` : mins < 60 * 48 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
  return ms >= 0 ? `in ${text}` : `${text} ago`;
}

const when = d => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** A strong random verify token (letters and digits), made in the browser. */
function randomToken(length = 28) {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

/**
 * Every setting the bot needs. `secret` fields are stored encrypted and never come back to the browser,
 * so their box starts empty (empty = keep what is saved). The others show their current value.
 */
const FIELDS = [
  {
    group: 'Connection',
    items: [
      { id: 'accessToken', label: 'Access token', secret: true, mono: true, placeholder: 'Paste the access token (starts with EAA…)', hint: 'The whole token from Meta (WhatsApp > API Setup). Meta checks it before it is saved.' },
      { id: 'phoneNumberId', label: 'Phone number ID', mono: true, placeholder: 'e.g. 1081083728429962', inputMode: 'numeric', hint: 'Under WhatsApp > API Setup. Change it only when you move to a different WhatsApp number.' }
    ]
  },
  {
    group: 'Webhook security',
    items: [
      { id: 'verifyToken', label: 'Webhook verify token', secret: true, mono: true, generate: true, placeholder: 'A word you choose, or press Generate', hint: 'Enter the same value in Meta (WhatsApp > Configuration) when you save the callback URL. Meta uses it once to confirm the address is yours.' },
      { id: 'appSecret', label: 'App secret', secret: true, mono: true, placeholder: 'Paste the app secret', hint: 'Meta: App settings > Basic > App secret. Messages are accepted only when they are signed with it.' }
    ]
  },
  {
    group: 'Who can use the bot',
    items: [
      {
        id: 'allowedPhone',
        kind: 'phones',
        label: 'Allowed phone numbers',
        mono: true,
        placeholder: 'e.g. 919876543210',
        inputMode: 'tel',
        hint: 'Only these numbers can talk to the bot, and they can also sign in to this studio by sending the code shown on the sign-in page. Digits with the country code; spaces and + are ignored. Add one at a time (press Enter), or paste several separated by commas. Up to 10.'
      }
    ]
  }
];

const EMPTY = { accessToken: '', phoneNumberId: '', verifyToken: '', appSecret: '', allowedPhone: '' };

function SourceBadge({ field }) {
  if (!field) return null;
  if (field.source === 'app') return <Badge tone="ok" size="sm" dot>Saved here{field.hint ? ` · ${field.hint}` : ''}</Badge>;
  if (field.source === 'server') return <Badge tone="neutral" size="sm">Server setting{field.hint ? ` · ${field.hint}` : ''}</Badge>;
  return <Badge tone="warn" size="sm">Not set</Badge>;
}

const PHONE_MIN = 8;
const PHONE_MAX = 15;
const PHONE_LIMIT = 10;

/**
 * Several phone numbers as chips. The value is the same comma-separated string the server stores
 * ("919347708120,918885550123"), so saving, comparing and "use server value" work as for any other box.
 * Enter or a comma adds the typed number; pasting a list adds them all; Backspace on an empty box removes the last.
 */
function PhoneListInput({ id, value, onChange, disabled }) {
  const numbers = String(value || '').split(',').map(s => s.trim()).filter(Boolean);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState(null);

  /** Adds every valid number in `text`; anything that is not a full number stays in the box with a message. */
  const commit = text => {
    const pieces = String(text).split(/[,;\n\r]+/).map(s => s.trim()).filter(Boolean);
    if (!pieces.length) {
      setDraft('');
      setProblem(null);
      return;
    }
    const next = [...numbers];
    const bad = [];
    for (const p of pieces) {
      const digits = p.replace(/\D/g, '');
      if (!digits) continue;
      if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) bad.push(p);
      else if (!next.includes(digits)) next.push(digits);
    }
    if (next.length > PHONE_LIMIT) {
      setProblem(`At most ${PHONE_LIMIT} numbers.`);
      return;
    }
    if (next.length !== numbers.length) onChange(next.join(','));
    if (bad.length) {
      setDraft(bad.join(', '));
      setProblem(`${bad.join(', ')} ${bad.length === 1 ? "isn't a full number" : "aren't full numbers"}: use ${PHONE_MIN}-${PHONE_MAX} digits with the country code.`);
    } else {
      setDraft('');
      setProblem(null);
    }
  };

  const remove = n => {
    onChange(numbers.filter(x => x !== n).join(','));
    setProblem(null);
  };

  return (
    <div className="sm:max-w-xl">
      <div
        className={cn(
          'field flex flex-wrap items-center gap-2 !p-2',
          'focus-within:border-ink focus-within:shadow-[0_0_0_3px_rgb(var(--marker)/0.6)]',
          problem && 'border-bad',
          disabled && 'pointer-events-none opacity-60'
        )}
      >
        {numbers.map(n => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full border border-ink bg-marker-soft py-0.5 pl-3 pr-1 font-mono text-[13px] font-medium">
            +{n}
            <button
              type="button"
              onClick={() => remove(n)}
              disabled={disabled}
              aria-label={`Remove +${n}`}
              className="grid h-6 w-6 place-items-center rounded-full text-ink-3 transition-colors hover:bg-ink hover:text-paper"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          inputMode="tel"
          autoComplete="off"
          spellCheck={false}
          placeholder={numbers.length ? 'Add another number' : 'e.g. 919876543210'}
          aria-invalid={problem ? true : undefined}
          aria-describedby={`${id}-help`}
          className="min-w-[11rem] flex-1 bg-transparent px-1.5 py-1 font-mono text-[13px] text-ink outline-none placeholder:text-faint"
          onChange={e => {
            const v = e.target.value;
            if (/[,;\n]$/.test(v)) commit(v);
            else {
              setDraft(v);
              if (problem) setProblem(null);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && draft.trim()) {
              e.preventDefault(); // Enter adds the number; it must not submit the whole form
              commit(draft);
            } else if (e.key === 'Backspace' && !draft && numbers.length) {
              remove(numbers[numbers.length - 1]);
            }
          }}
          onPaste={e => {
            const text = e.clipboardData?.getData('text');
            if (text && /[,;\n]/.test(text)) {
              e.preventDefault();
              commit(`${draft},${text}`);
            }
          }}
          onBlur={() => draft.trim() && commit(draft)}
        />
      </div>
      <p id={`${id}-help`} className={cn('mt-1.5 text-[12px]', problem ? 'font-medium text-bad' : numbers.length ? 'text-muted' : 'text-warn')} role={problem ? 'alert' : undefined}>
        {problem || (numbers.length ? `${numbers.length} of ${PHONE_LIMIT} numbers` : 'No numbers yet: the bot ignores everyone until you add one.')}
      </p>
    </div>
  );
}

function SettingField({ def, status, value, onChange, disabled, onUseServer, onCopy }) {
  const [shown, setShown] = useState(false);
  const id = `wa-${def.id}`;
  return (
    <div>
      <Label
        htmlFor={id}
        hint={def.hint}
        right={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <SourceBadge field={status} />
            {status?.source === 'app' && (
              <button type="button" onClick={() => onUseServer(def)} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] font-semibold text-muted hover:bg-ink/[0.07] hover:text-ink" title="Delete the value saved here and use the server setting again">
                <Undo2 className="h-3 w-3" aria-hidden="true" /> Use server value
              </button>
            )}
          </div>
        }
      >
        {def.label}
      </Label>
      {def.kind === 'phones' ? (
        <PhoneListInput id={id} value={value} onChange={v => onChange(def.id, v)} disabled={disabled} />
      ) : (
      <div className="relative">
        <input
          id={id}
          type={def.secret && !shown ? 'password' : 'text'}
          value={value}
          onChange={e => onChange(def.id, e.target.value)}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode={def.inputMode}
          placeholder={def.placeholder}
          className={cn('field', def.mono && 'font-mono text-[13px]', def.secret ? (def.generate ? '!pr-[5.5rem]' : '!pr-12') : '', !def.secret && 'sm:max-w-md')}
        />
        {def.secret && (
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
            {def.generate && value && (
              <button type="button" onClick={() => onCopy(value)} aria-label="Copy value" className="grid h-8 w-8 place-items-center rounded text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink">
                <Copy className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={() => setShown(s => !s)} aria-label={shown ? `Hide ${def.label}` : `Show ${def.label}`} aria-pressed={shown} className="grid h-8 w-8 place-items-center rounded text-muted transition-colors hover:bg-ink/[0.07] hover:text-ink">
              {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
      )}
      {def.generate && (
        <div className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onChange(def.id, randomToken());
              setShown(true);
            }}
            disabled={disabled}
            leftIcon={<Shuffle className="h-3.5 w-3.5" />}
          >
            Generate a random one
          </Button>
          <span className="ml-2.5 text-[12px] text-muted">Copy it into Meta, then press Save.</span>
        </div>
      )}
    </div>
  );
}

function Fact({ icon: Icon, label, children, tone }) {
  return (
    <div className="rounded-md border border-line bg-paper/60 p-4">
      <p className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </p>
      <div className={cn('text-[15px] font-bold', tone === 'bad' && 'text-bad', tone === 'warn' && 'text-warn')}>{children}</div>
    </div>
  );
}

const LABEL = { accessToken: 'access token', phoneNumberId: 'phone number ID', verifyToken: 'verify token', appSecret: 'app secret', allowedPhone: 'allowed phone numbers' };

export default function WhatsAppSection() {
  const toast = useToast();
  const confirm = useConfirm();
  const { refresh: refreshEngineStatus } = useSystemStatus();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState({});

  /** Non-secret boxes start with the current value; secret boxes start empty. */
  const resetForm = useCallback(s => {
    setValues({ ...EMPTY, phoneNumberId: s?.fields?.phoneNumberId?.value || '', allowedPhone: s?.fields?.allowedPhone?.value || '' });
    setTouched({});
  }, []);

  const load = useCallback(
    async (live = true, keepForm = false) => {
      live ? setChecking(true) : setLoading(true);
      try {
        const s = await whatsappApi.status(live);
        setStatus(s);
        setError(null);
        if (!keepForm) resetForm(s);
        if (live) refreshEngineStatus();
      } catch (err) {
        setError(err.message || 'Could not load the WhatsApp status.');
      } finally {
        setLoading(false);
        setChecking(false);
      }
    },
    [refreshEngineStatus, resetForm]
  );

  useEffect(() => {
    load(true);
  }, [load]);

  const change = (id, v) => {
    setValues(x => ({ ...x, [id]: v }));
    setTouched(t => ({ ...t, [id]: true }));
  };

  /** What would be sent: secrets that were typed, and non-secret values that differ from what is in use. */
  const pending = () => {
    const body = {};
    for (const { items } of FIELDS) {
      for (const f of items) {
        const v = values[f.id].trim();
        if (f.secret) {
          if (v) body[f.id] = v;
        } else if (touched[f.id] && v !== (status?.fields?.[f.id]?.value || '')) {
          body[f.id] = v;
        }
      }
    }
    return body;
  };
  const body = pending();
  const changes = Object.keys(body);

  const save = async e => {
    e?.preventDefault();
    if (!changes.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const s = await whatsappApi.save(body);
      setStatus(s);
      resetForm(s);
      toast.success(body.accessToken ? 'Saved. The new token works.' : `Saved: ${changes.map(c => LABEL[c]).join(', ')}.`);
      refreshEngineStatus();
    } catch (err) {
      setSaveError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const useServer = async def => {
    const ok = await confirm({
      title: `Use the server's ${LABEL[def.id]}?`,
      body: `The ${LABEL[def.id]} saved here is deleted. WhatsApp then uses the value from the server settings (.env)${status?.fields?.[def.id]?.source === 'app' ? ', if there is one; if not, the bot cannot work until you save a new one' : ''}.`,
      confirmLabel: 'Delete saved value',
      tone: 'danger'
    });
    if (!ok) return;
    try {
      const s = await whatsappApi.clear(def.id);
      setStatus(s);
      resetForm(s);
      toast.success(`Saved ${LABEL[def.id]} removed.`);
      refreshEngineStatus();
    } catch (err) {
      setError(err.message || 'Could not remove it.');
    }
  };

  const copy = async text => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied.');
    } catch {
      toast.error('Could not copy. Select it and copy by hand.');
    }
  };

  if (loading && !status) {
    return (
      <Card pad="lg" aria-busy="true" aria-label="Checking WhatsApp">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 !rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3.5 w-64" />
          </div>
        </div>
      </Card>
    );
  }

  const s = status;
  const live = s?.live;
  const problem = s && (s.expired || s.lastFailure || (live && !live.ok && !live.unreachable));
  const state = !s ? null : !s.configured ? 'missing' : problem ? 'expired' : s.missing?.length ? 'incomplete' : live?.ok ? 'ok' : 'unchecked';
  const badge = { ok: ['ok', 'Connected'], expired: ['bad', 'Token not working'], missing: ['warn', 'Not set up'], incomplete: ['warn', 'Setup incomplete'], unchecked: ['neutral', 'Not checked'] }[state] || ['neutral', '…'];
  const soon = s?.expiresAt && new Date(s.expiresAt).getTime() - Date.now() < 24 * 3600 * 1000 && !s.expired;
  const missing = (s?.missing || []).filter(m => m !== 'accessToken' && m !== 'phoneNumberId').map(m => LABEL[m]);

  return (
    <div className="space-y-5">
      {error && (
        <Alert tone="bad" title="Could not complete that" action={<Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>}>
          {error}
        </Alert>
      )}
      {s?.unreadable?.length > 0 && (
        <Alert tone="warn" icon={KeyRound} title="Some saved values cannot be read">
          The server's encryption key (<Code>INSTAGRAM_TOKEN_ENCRYPTION_KEY</Code>) changed since they were saved. Enter these again below: {s.unreadable.map(f => LABEL[f]).join(', ')}.
        </Alert>
      )}
      {s?.lastFailure && (
        <Alert tone="bad" title="WhatsApp rejected the access token">
          <p>{s.lastFailure.message}</p>
          <p className="mt-1 text-[12px] text-muted">Seen {when(s.lastFailure.at)}. While this lasts the bot cannot reply. Paste a new token below.</p>
        </Alert>
      )}
      {s && !s.lastFailure && s.expired && (
        <Alert tone="bad" title="The access token has expired">
          Temporary tokens from the Meta dashboard last about 24 hours. Generate a new one and paste it below.
        </Alert>
      )}
      {s && !s.configured && !s.unreadable?.length && (
        <Alert tone="warn" title="The bot is not set up yet">
          Fill in the access token and phone number ID below to turn it on.
        </Alert>
      )}
      {s?.configured && missing.length > 0 && (
        <Alert tone="warn" title="Still to fill in">
          The bot cannot work properly without: {missing.join(', ')}.
        </Alert>
      )}

      <Card pad="lg" tone={state === 'ok' ? 'sticker' : 'default'}>
        <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <span className="relative grid h-16 w-16 shrink-0 -rotate-3 place-items-center rounded-lg border-2 border-ink bg-marker shadow-hard-sm">
              <MessageCircle className="h-8 w-8 text-ink" />
              {state === 'ok' && (
                <span className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-surface">
                  <CheckCircle2 className="h-3.5 w-3.5 text-ok" />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[20px] font-extrabold tracking-tight">{live?.ok && live.displayPhoneNumber ? live.displayPhoneNumber : 'WhatsApp bot'}</h4>
                <Badge tone={badge[0]} dot size="sm">
                  {badge[1]}
                </Badge>
              </div>
              <p className="mt-0.5 font-mono text-[12px] text-muted">
                {live?.ok && live.verifiedName ? `${live.verifiedName} · ` : ''}Phone number ID {s?.phoneNumberId || 'not set'}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => load(true, true)} loading={checking} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Check now
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3.5 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Fact icon={KeyRound} label="Access token" tone={s?.tokenSource === 'none' ? 'warn' : undefined}>
            {s?.tokenSource === 'none' ? 'None' : s?.tokenHint || 'Set'}
            <p className="mt-0.5 text-[12px] font-normal text-muted">{s?.tokenSource === 'app' ? `Saved here${s.savedAt ? ` · ${when(s.savedAt)}` : ''}` : s?.tokenSource === 'server' ? 'From the server settings (.env)' : 'Nothing saved'}</p>
          </Fact>
          <Fact icon={Clock} label="Token validity" tone={s?.expired ? 'bad' : soon ? 'warn' : undefined}>
            {s?.expired ? (s.expiresAt ? `Expired ${relative(s.expiresAt)}` : 'Expired') : s?.expiresAt ? `Expires ${relative(s.expiresAt)}` : s?.neverExpires ? 'Does not expire' : 'Expiry unknown'}
            <p className="mt-0.5 text-[12px] font-normal text-muted">{s?.expiresAt ? when(s.expiresAt) : live?.ok ? 'Meta reports no expiry date' : 'Press "Check now" to ask Meta'}</p>
          </Fact>
          <Fact icon={ShieldCheck} label="Secrets">
            AES-256-GCM encrypted
            <p className="mt-0.5 text-[12px] font-normal text-muted">Encrypted at rest · never sent to the browser</p>
          </Fact>
        </div>
        {live && !live.ok && (
          <p className="mt-4 text-[12.5px] text-muted">
            Meta says: <span className="text-ink">{live.message}</span>
          </p>
        )}
      </Card>

      <Card pad="lg">
        <h4 className="text-[17px] font-bold">WhatsApp settings</h4>
        <p className="mb-6 mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">
          Everything the bot needs, kept here instead of in server files. A value saved here is used instead of the same setting in <Code>.env</Code>. A box you leave empty is not changed. When the token or phone number ID changes, Meta is asked first, and a combination that does not work is <strong className="text-ink">not saved</strong>.
        </p>
        <form onSubmit={save} className="space-y-8">
          {FIELDS.map(({ group, items }) => (
            <fieldset key={group} className="space-y-5">
              <legend className="mb-1 font-mono text-micro uppercase text-muted">{group}</legend>
              {items.map(def => (
                <SettingField key={def.id} def={def} status={s?.fields?.[def.id]} value={values[def.id]} onChange={change} disabled={saving} onUseServer={useServer} onCopy={copy} />
              ))}
            </fieldset>
          ))}

          {saveError && (
            <Alert tone="bad" title="Not saved" action={<Button variant="ghost" size="sm" onClick={() => setSaveError(null)}>Dismiss</Button>}>
              {saveError}
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" loading={saving} disabled={!changes.length} leftIcon={<Check className="h-4 w-4" strokeWidth={2.6} />}>
              {saving ? 'Saving…' : changes.length ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Save'}
            </Button>
            {changes.length > 0 && !saving && (
              <Button variant="ghost" onClick={() => resetForm(s)}>
                Discard
              </Button>
            )}
            {changes.length > 0 && <p className="text-[12.5px] text-muted">{changes.map(c => LABEL[c]).join(', ')}</p>}
          </div>
        </form>
      </Card>

      {s && (
        <Card pad="lg" tone="muted">
          <h4 className="mb-1 text-[15px] font-bold">Webhook address for Meta</h4>
          <p className="text-[13px] leading-relaxed text-muted">In Meta: WhatsApp &gt; Configuration &gt; Callback URL. It must be a public https address of this server, with the verify token from above.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Code>{s.webhookUrl}</Code>
            <Button variant="ghost" size="icon-sm" onClick={() => copy(s.webhookUrl)} aria-label="Copy webhook URL">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            If this shows a local or tunnel address, set <Code>PUBLIC_BASE_URL</Code> on the server to its public address.
            {!s.encryptionKeyConfigured && (
              <>
                {' '}
                <strong className="text-warn">Before you deploy:</strong> set <Code>INSTAGRAM_TOKEN_ENCRYPTION_KEY</Code> (64 hex characters) so saved secrets use your own key, not the built-in one.
              </>
            )}
          </p>
        </Card>
      )}

      <Card pad="none" tone="muted" className="px-5 sm:px-6">
        <Disclosure icon={ExternalLink} title="Where do I find each value?" summary="All of them are in the Meta for Developers dashboard">
          <ol className="list-inside list-decimal space-y-2.5 text-[13px] leading-relaxed text-ink-3">
            <li>
              Open{' '}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer noopener" className="font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2">
                Meta for Developers
              </a>{' '}
              and choose your app.
            </li>
            <li>
              <strong>Access token</strong> and <strong>Phone number ID</strong>: <strong>WhatsApp &gt; API Setup</strong>. Press <strong>Generate</strong> under Temporary access token (about 24 hours). For a token that does not expire, create a system user in <strong>Business Settings &gt; Users &gt; System users</strong> with the <Code>whatsapp_business_messaging</Code> and <Code>whatsapp_business_management</Code> permissions.
            </li>
            <li>
              <strong>App secret</strong>: <strong>App settings &gt; Basic &gt; App secret</strong> (press Show).
            </li>
            <li>
              <strong>Verify token</strong>: you choose it. Press Generate above, save it here, then paste the same value in <strong>WhatsApp &gt; Configuration</strong> together with the callback URL.
            </li>
            <li>
              <strong>Allowed phone numbers</strong>: the WhatsApp numbers that may use the bot (yours, and anyone you want to give access), each with the country code. Each person has their own conversation. These numbers can also <strong>sign in to the studio</strong>: the sign-in page shows a code, they send it to the bot, and the page opens (the bot replies with the device and a <em>That wasn't me</em> button). On a Meta <em>test</em> number, Meta only delivers to numbers in its recipient list (<strong>WhatsApp &gt; API Setup</strong>, up to 5), so add each one there too.
            </li>
          </ol>
        </Disclosure>
      </Card>
    </div>
  );
}
