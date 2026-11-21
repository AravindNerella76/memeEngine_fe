import React, { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, BellRing, Check, Monitor, Send, Share, Smartphone, Trash2 } from 'lucide-react';
import { disablePush, enablePush, KINDS, listDevices, permission, pushSupport, removeDevice, setDeviceKinds, syncPush, testDevice, thisDeviceId } from '../../lib/push';
import { Alert, Badge, Button, Card, CardHeader, Skeleton, cn, useConfirm, useToast } from '../../ui';

const when = d => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'never');
const isPhone = label => /Android|iPhone|iPad/.test(label);

function KindToggle({ kind, on, busy, onChange }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors', on ? 'border-ink bg-marker-soft' : 'border-line bg-paper/60 hover:border-line-strong')}>
      <input type="checkbox" className="peer sr-only" checked={on} disabled={busy} onChange={e => onChange(e.target.checked)} />
      <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2 border-ink transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-marker', on ? 'bg-marker text-ink' : 'bg-surface')} aria-hidden="true">
        {on && <Check className="h-3.5 w-3.5" strokeWidth={3.4} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{kind.title}</span>
        <span className="block text-[12.5px] leading-relaxed text-muted">{kind.text}</span>
      </span>
    </label>
  );
}

/** This browser: on/off, what it is told about, a test. */
function ThisDevice({ devices, onChanged }) {
  const toast = useToast();
  const support = pushSupport();
  const [perm, setPerm] = useState(permission());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const myId = thisDeviceId();
  const mine = devices?.find(d => d.id === myId) || null;
  const on = perm === 'granted' && Boolean(mine);

  const turnOn = async () => {
    setBusy(true);
    setError(null);
    try {
      await enablePush();
      setPerm(permission());
      toast.success('Notifications are on for this device.');
      onChanged();
    } catch (e) {
      setPerm(permission());
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setBusy(false);
    toast.info('Notifications are off for this device.');
    onChanged();
  };
  const test = async () => {
    setBusy(true);
    try {
      const r = await testDevice(mine.id);
      if (r.sent) toast.success('Sent. It should appear in a moment (switch to another tab to see it as a system notification).');
      else toast.error('The push service did not accept it. Turn notifications off and on again.');
    } catch (e) {
      toast.error(e.message);
      onChanged();
    } finally {
      setBusy(false);
    }
  };
  const setKind = async (id, value) => {
    const kinds = value ? [...new Set([...mine.kinds, id])] : mine.kinds.filter(k => k !== id);
    setBusy(true);
    try {
      await setDeviceKinds(mine.id, kinds);
      onChanged();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={on ? BellRing : Bell} title="This device" description={on ? 'Notifications arrive here even when the studio is closed.' : 'Get told when a meme is ready, or when someone signs in, even with the studio closed.'} />

      {!support.supported && support.reason === 'ios-install' && (
        <Alert tone="info" icon={Share} title="On iPhone: add the studio to your Home Screen first">
          Apple only allows notifications for web apps opened from the Home Screen. In Safari tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>, open the studio from there, and come back to this page.
        </Alert>
      )}
      {!support.supported && support.reason === 'insecure' && <Alert tone="warn" title="Needs a secure address">Browsers only allow notifications on https (or on localhost). Open the studio at its https address.</Alert>}
      {!support.supported && support.reason === 'unsupported' && <Alert tone="neutral" title="This browser cannot show notifications">Try Chrome, Edge, Firefox or Safari.</Alert>}

      {support.supported && perm === 'denied' && (
        <Alert tone="warn" icon={BellOff} title="Notifications are blocked for this site">
          Your browser was told not to allow them. Click the icon left of the address (a lock or sliders), set <strong>Notifications</strong> to <strong>Allow</strong>, then reload this page.
        </Alert>
      )}

      {support.supported && perm !== 'denied' && !on && (
        <div className="space-y-3">
          <Button variant="primary" size="lg" onClick={turnOn} loading={busy} leftIcon={<Bell className="h-[18px] w-[18px]" />}>
            Turn on notifications here
          </Button>
          <p className="text-[12.5px] text-muted">Your browser asks once. You can turn them off here at any time.</p>
          {error && error.code !== 'dismissed' && <Alert tone="bad" compact>{error.message}</Alert>}
          {error?.code === 'dismissed' && <p className="text-[12.5px] text-muted">Nothing changed. Press the button again when you want them.</p>}
        </div>
      )}

      {on && (
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {KINDS.map(k => (
              <KindToggle key={k.id} kind={k} on={mine.kinds.includes(k.id)} busy={busy} onChange={v => setKind(k.id, v)} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button variant="dark" onClick={test} loading={busy} leftIcon={<Send className="h-4 w-4" />}>
              Send a test
            </Button>
            <Button variant="ghost" onClick={turnOff} disabled={busy} leftIcon={<BellOff className="h-4 w-4" />}>
              Turn off here
            </Button>
          </div>
          {mine.kinds.length === 0 && <p className="text-[12.5px] text-warn">Nothing is chosen, so this device gets nothing.</p>}
        </div>
      )}
    </Card>
  );
}

/** Every device that gets notifications. */
function OtherDevices({ devices, onChanged }) {
  const confirm = useConfirm();
  const myId = thisDeviceId();
  const others = (devices || []).filter(d => d.id !== myId);
  if (!devices) return <Skeleton className="h-28" />;
  if (!others.length) return null;
  const remove = async d => {
    if (!(await confirm({ title: `Stop notifications on ${d.device}?`, body: 'That device stops getting them now. It can turn them on again from its own Settings.', confirmLabel: 'Stop them', tone: 'danger' }))) return;
    await removeDevice(d.id).catch(() => {});
    onChanged();
  };
  return (
    <Card>
      <CardHeader title="Other devices" description="Devices that are signed out get nothing until they sign in again." />
      <ul className="space-y-2.5">
        {others.map(d => {
          const Icon = isPhone(d.device) ? Smartphone : Monitor;
          return (
            <li key={d.id} className="flex items-center gap-3.5 rounded-md border border-line bg-paper/60 p-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded border border-ink/15 bg-surface" aria-hidden="true">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold">
                  {d.device}
                  {!d.signedIn && <Badge tone="outline" size="sm">Signed out</Badge>}
                  {d.failures > 0 && <Badge tone="warn" size="sm">Failing</Badge>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  {d.kinds.length ? d.kinds.map(k => KINDS.find(x => x.id === k)?.title.split(' (')[0]).join(' · ') : 'Nothing chosen'} · last delivered {when(d.lastSuccessAt)}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(d)} aria-label={`Stop notifications on ${d.device}`} title="Stop notifications on this device">
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function NotificationsSection() {
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      setDevices(await listDevices());
      setError(null);
    } catch (e) {
      setError(e.code === 'push_unavailable' ? e.message : 'Could not load the devices.');
      setDevices([]);
    }
  }, []);
  useEffect(() => {
    syncPush().finally(load);
  }, [load]);

  return (
    <div className="space-y-5">
      {error && <Alert tone="warn">{error}</Alert>}
      <ThisDevice devices={devices} onChanged={load} />
      <OtherDevices devices={devices} onChanged={load} />
      <p className="px-1 text-[12.5px] leading-relaxed text-muted">
        Notifications are end-to-end encrypted by your browser’s push service, say only what happened (never your passwords), and stop by themselves on a device that signs out.
      </p>
    </div>
  );
}
