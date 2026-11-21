import React from 'react';
import { Check, Clock, Monitor, Moon, Sun } from 'lucide-react';
import { isNight, NIGHT, useTheme } from '../../theme/ThemeProvider';
import { Card, CardHeader, cn } from '../../ui';

const fmt = h => {
  const d = new Date();
  d.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

const OPTIONS = [
  { id: 'auto', icon: Clock, title: 'Night studio, by itself', text: `Dark from ${fmt(NIGHT.from)} to ${fmt(NIGHT.to)}, light during the day.` },
  { id: 'system', icon: Monitor, title: 'Match this device', text: 'Follows your phone’s or computer’s own light/dark setting.' },
  { id: 'light', icon: Sun, title: 'Always light', text: 'Warm paper, all day and night.' },
  { id: 'dark', icon: Moon, title: 'Always dark', text: 'Night studio all the time.' }
];

/** A tiny studio in light or dark: the sidebar, a card, a yellow sticker. Drawn with the real colours. */
function MiniStudio({ dark, split }) {
  const pane = d => (
    <div data-theme={d ? 'dark' : 'light'} className="theme-scope flex h-full w-full bg-paper">
      <div className="on-ink flex w-[26%] flex-col gap-1 bg-ink p-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] border border-ink bg-marker" />
        <span className="mt-1 h-1 w-[80%] rounded bg-white/25" />
        <span className="h-1.5 w-full rounded-[2px] bg-marker" />
        <span className="h-1 w-[70%] rounded bg-white/25" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="h-1.5 w-[60%] rounded bg-ink" />
        <div className="flex-1 rounded-[4px] border border-line bg-surface p-1.5">
          <span className="block h-1 w-[80%] rounded bg-ink/40" />
          <span className="mt-1 block h-1 w-[55%] rounded bg-ink/25" />
          <span className="mt-2 inline-block h-2.5 w-8 rounded-[3px] border border-ink bg-marker shadow-hard-sm" />
        </div>
      </div>
    </div>
  );
  return (
    <div className="relative h-[84px] w-full overflow-hidden rounded-md border border-line-strong" aria-hidden="true">
      {split ? (
        <div className="flex h-full">
          <div className="w-1/2 overflow-hidden">{pane(false)}</div>
          <div className="w-1/2 overflow-hidden">{pane(true)}</div>
        </div>
      ) : (
        pane(dark)
      )}
    </div>
  );
}

export default function AppearanceSection() {
  const { mode, theme, setMode, keepLightTonight } = useTheme();
  const night = isNight();
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          icon={theme === 'dark' ? Moon : Sun}
          title="Night studio"
          description={`Right now: ${theme === 'dark' ? 'dark' : 'light'}${mode === 'auto' ? (night && theme === 'light' ? ' (kept light tonight)' : night ? ' (it’s evening)' : ' (it’s daytime)') : ''}. This choice is for this device only.`}
        />
        <div role="radiogroup" aria-label="Appearance" className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map(o => {
            const active = mode === o.id;
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(o.id)}
                className={cn('group rounded-lg border-2 p-3 text-left transition-[border-color,box-shadow,transform] duration-150', active ? 'border-ink bg-surface shadow-hard' : 'border-line bg-paper/60 hover:-translate-y-px hover:border-line-strong')}
              >
                <MiniStudio dark={o.id === 'dark'} split={o.id === 'auto' || o.id === 'system'} />
                <span className="mt-3 flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-[14px] font-bold">{o.title}</span>
                  <span className={cn('grid h-5 w-5 place-items-center rounded-full border-2 border-ink transition-colors', active ? 'bg-marker' : 'bg-surface')} aria-hidden="true">
                    {active && <Check className="h-3 w-3 text-ink" strokeWidth={3.6} />}
                  </span>
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{o.text}</span>
              </button>
            );
          })}
        </div>
        {mode === 'auto' && night && theme === 'dark' && (
          <p className="mt-4 text-[13px] text-muted">
            Want daylight just for now?{' '}
            <button type="button" onClick={keepLightTonight} className="font-semibold text-ink underline decoration-marker decoration-[3px] underline-offset-[3px] hover:decoration-ink">
              Keep it light tonight
            </button>{' '}
            (back to automatic in the morning).
          </p>
        )}
      </Card>
      <p className="px-1 text-[12.5px] leading-relaxed text-muted">Your memes always look the same: Night studio only changes the studio around them. Tip: press Ctrl K and type “night” to switch from anywhere.</p>
    </div>
  );
}
