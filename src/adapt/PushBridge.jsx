import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncPush } from '../lib/push';

/**
 * Notifications <-> the running studio. On load: make sure the server knows this device under the current sign-in.
 * A tap on a notification while the studio is open: move inside the app (no reload, nothing on screen is lost).
 */
export default function PushBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    syncPush();
    if (!('serviceWorker' in navigator)) return undefined;
    const onMessage = e => {
      const msg = e.data || {};
      if (msg.type === 'open' && typeof msg.url === 'string' && msg.url.startsWith('/')) navigate(msg.url);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [navigate]);
  return null;
}
