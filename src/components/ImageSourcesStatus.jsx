import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle, ExternalLink, Lock, WifiOff } from 'lucide-react';
import { API_BASE, apiFetch } from '../api';
import { providerName } from './ImageRights';
import { Alert, Badge, cn } from '../ui';

/** Key that switches on each paid source (set in memeEngine_be/.env). */
const KEY_HINT = {
  'google-vision-web': 'GOOGLE_CLOUD_VISION_API_KEY',
  'brave-images': 'BRAVE_SEARCH_API_KEY'
};

const ALWAYS_SHOW = new Set(['wikimedia-commons', 'wikipedia', 'openverse', 'google-vision-web', 'brave-images']);
const STORAGE_KEY = 'meme_engine_selected_providers';

export default function ImageSourcesStatus({ onSelectionChange }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let alive = true;
    apiFetch(`${API_BASE}/api/system/status`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(j => {
        if (!alive) return;
        setStatus(j);
        const serverEnabled = (j.providers || []).filter(p => p.enabled).map(p => p.id);

        let initial = serverEnabled;
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              const validSaved = parsed.filter(id => serverEnabled.includes(id));
              if (validSaved.length > 0) {
                initial = validSaved;
              }
            }
          }
        } catch {
          // ignore localStorage parsing errors
        }

        const newSet = new Set(initial);
        setSelected(newSet);
        if (onSelectionChange) {
          onSelectionChange(Array.from(newSet));
        }
      })
      .catch(e => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const persistSelection = newSet => {
    setSelected(newSet);
    const arr = Array.from(newSet);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
    if (onSelectionChange) {
      onSelectionChange(arr);
    }
  };

  const handleToggle = provider => {
    setNotice(null);
    if (!provider.enabled) {
      if (provider.turnedOffInSettings) {
        setNotice(`${providerName(provider.id)} is switched off in Settings > Image Discovery.`);
      } else if (provider.keyConfigured && provider.disabledReason) {
        setNotice(`${providerName(provider.id)} is disabled by Google: ${provider.disabledReason}.`);
      } else {
        setNotice(`${providerName(provider.id)} is not configured on the server. Add ${KEY_HINT[provider.id] || 'key'} to memeEngine_be/.env and restart the backend.`);
      }
      return;
    }

    const next = new Set(selected);
    if (next.has(provider.id)) {
      if (next.size <= 1) {
        setNotice('At least one image search source must remain enabled.');
        return;
      }
      next.delete(provider.id);
    } else {
      next.add(provider.id);
    }
    persistSelection(next);
  };

  const handleSelectAll = () => {
    if (!status?.providers) return;
    const allEnabled = status.providers.filter(p => p.enabled).map(p => p.id);
    setNotice(null);
    persistSelection(new Set(allEnabled));
  };

  const handleVisionOnly = () => {
    if (!status?.providers) return;
    const vision = status.providers.find(p => p.id === 'google-vision-web' && p.enabled);
    if (vision) {
      setNotice(null);
      persistSelection(new Set(['google-vision-web']));
    }
  };

  if (error) {
    return (
      <Alert tone="neutral" icon={WifiOff} compact>
        Could not read the image sources from the backend ({error}). The AI will use every source that is on.
      </Alert>
    );
  }
  if (!status) {
    return <p className="text-[13px] text-muted" role="status">Reading image sources…</p>;
  }

  const outdated = !status.rightsPolicy;
  const usage = new Map((status.paidProviderUsage || []).map(u => [u.provider, u]));
  const providers = (status.providers || []).filter(p => p.enabled || ALWAYS_SHOW.has(p.id));

  // Categorize providers that are not enabled
  const missingKeyProviders = providers.filter(p => !p.enabled && !p.turnedOffInSettings && !p.keyConfigured && KEY_HINT[p.id]);
  const rejectedProviders = providers.filter(p => !p.enabled && !p.turnedOffInSettings && p.keyConfigured && p.disabledReason);
  const paidOn = providers.some(p => p.enabled && KEY_HINT[p.id]);
  const hasVision = providers.some(p => p.id === 'google-vision-web' && p.enabled);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] text-muted">
          Tap a source to switch it on or off for this meme. <span className="tabular font-mono font-semibold text-ink">{selected.size}</span> on.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSelectAll} className="inline-flex min-h-8 items-center text-[13px] font-semibold underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
            All on
          </button>
          {hasVision && (
            <button type="button" onClick={handleVisionOnly} className="inline-flex min-h-8 items-center text-[13px] font-semibold underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
              Vision only
            </button>
          )}
          {status.rightsPolicy && (
            <Badge tone={status.rightsPolicy === 'open_license_only' ? 'ok' : 'neutral'} size="sm">
              {status.rightsPolicy === 'open_license_only' ? 'Openly licensed only' : 'Any image · sources recorded'}
            </Badge>
          )}
        </div>
      </div>

      {outdated ? (
        <Alert tone="warn" compact>
          The backend is running an older build. Restart it (npm run build && npm start in memeEngine_be) to get the rights labels and the new image sources.
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {providers.map(p => {
              const u = usage.get(p.id);
              const isServerEnabled = p.enabled;
              const isSelected = isServerEnabled && selected.has(p.id);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleToggle(p)}
                  aria-pressed={isSelected}
                  title={
                    isServerEnabled
                      ? isSelected
                        ? `${providerName(p.id)} is on (click to turn off)`
                        : `${providerName(p.id)} is off (click to turn on)`
                      : p.turnedOffInSettings
                      ? `${providerName(p.id)} is switched off in Settings > Image Discovery`
                      : p.keyConfigured && p.disabledReason
                      ? `${providerName(p.id)}: ${p.disabledReason}`
                      : KEY_HINT[p.id]
                      ? `Add ${KEY_HINT[p.id]} to memeEngine_be/.env and restart the backend`
                      : 'Unavailable on server'
                  }
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-all',
                    isSelected && 'border-ink bg-marker-soft text-ink shadow-hard-sm',
                    !isSelected && isServerEnabled && 'border-line-strong bg-surface text-ink-3 hover:border-ink hover:text-ink',
                    !isServerEnabled && 'border-dashed border-line-strong bg-paper-2/60 text-faint'
                  )}
                >
                  {isSelected ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : isServerEnabled ? <Circle className="h-4 w-4 text-faint" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>{providerName(p.id)}</span>
                  {isSelected && u && typeof u.used === 'number' && (
                    <span className="tabular font-mono text-[11px] font-medium text-muted" title="Used this month / monthly limit">
                      {u.used}/{u.limit}
                    </span>
                  )}
                  {!isSelected && <span className="text-[11px] font-medium">{p.turnedOffInSettings ? 'off in Settings' : isServerEnabled ? 'off' : 'unavailable'}</span>}
                </button>
              );
            })}
          </div>

          {notice && <Alert tone="warn" compact>{notice}</Alert>}

          {rejectedProviders.map(p => (
            <Alert key={p.id} tone="warn" title={`${providerName(p.id)}: API key found, but Google returned 403 Forbidden`}>
              <p>
                Google Cloud needs a <strong>billing account</strong> on your project, even though the first 1,000 requests a month are free.
              </p>
              <a
                href="https://console.developers.google.com/billing/enable?project=1087502754651"
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1.5 inline-flex items-center gap-1 font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink"
              >
                Enable billing for project #1087502754651 <ExternalLink className="h-3 w-3" />
              </a>
            </Alert>
          ))}

          {missingKeyProviders.length > 0 && (
            <p className="text-[12.5px] text-muted">To switch on: add {missingKeyProviders.map(p => KEY_HINT[p.id]).join(' and ')} to memeEngine_be/.env and restart the backend.</p>
          )}
          {(paidOn || missingKeyProviders.length > 0) && <p className="text-[12.5px] text-muted">Paid sources stop at their free monthly allowance unless you raise the limit.</p>}
        </>
      )}
    </div>
  );
}
