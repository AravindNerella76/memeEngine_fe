import React, { useEffect, useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../ui';

/** Label, description, "changed from default" marker and error for one setting. */
export function Field({ label, description, error, isDefault, onResetDefault, htmlFor, right, children }) {
  return (
    <div className="space-y-2">
      <div className="flex min-h-[28px] items-start justify-between gap-3">
        <div className="min-w-0 pt-1">
          <label htmlFor={htmlFor} className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            {label}
            {isDefault === false && (
              <span className="h-2 w-2 rounded-full bg-marker ring-[1.5px] ring-ink" title="Changed from the default" aria-label="changed from the default" />
            )}
          </label>
          {description && <p className="mt-0.5 text-[12px] leading-snug text-muted">{description}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          {isDefault === false && onResetDefault && (
            <button
              type="button"
              onClick={onResetDefault}
              className="grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-marker-soft hover:text-ink"
              title="Use the default value"
              aria-label={`Use the default value for ${label}`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      {children}
      {error && (
        <p className="text-[12px] font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const decimals = step => {
  const s = String(step);
  return s.includes('.') ? s.split('.')[1].length : 0;
};

/** Slider plus number input (limits from the backend schema). */
export function NumberField({ label, description, value, onChange, spec, error, defaultValue, format, disabled }) {
  const id = useId();
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);
  if (!spec) return null;
  const commit = raw => {
    setText(raw);
    if (raw.trim() === '') return;
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(Math.round(n * 10 ** decimals(spec.step)) / 10 ** decimals(spec.step));
  };
  const shown = format ? format(value) : `${value}${spec.unit ? ` ${spec.unit}` : ''}`;
  const pct = Math.max(0, Math.min(100, (((value ?? spec.min) - spec.min) / (spec.max - spec.min || 1)) * 100));
  return (
    <Field
      label={label}
      description={description}
      error={error}
      htmlFor={id}
      isDefault={defaultValue === undefined ? undefined : value === defaultValue}
      onResetDefault={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
      right={<span className="tabular font-mono text-[12px] font-semibold text-ink">{value == null ? '' : shown}</span>}
    >
      <div className="flex items-center gap-3.5">
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value ?? spec.min}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          className="range flex-1"
          style={{ '--pct': `${pct}%` }}
          aria-label={`${label} slider`}
        />
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={text}
          disabled={disabled}
          onChange={e => commit(e.target.value)}
          aria-invalid={error ? true : undefined}
          className="field tabular w-[84px] !px-2.5 !py-1.5 text-center font-mono !text-[13px]"
        />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-faint">
        <span>{format ? format(spec.min) : spec.min}</span>
        {defaultValue !== undefined && <span>default {format ? format(defaultValue) : defaultValue}</span>}
        <span>{format ? format(spec.max) : spec.max}</span>
      </div>
    </Field>
  );
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour picker plus hex input. */
export function ColorField({ label, description, value, onChange, error, defaultValue, disabled }) {
  const id = useId();
  const [text, setText] = useState(value || '');
  useEffect(() => setText(value || ''), [value]);
  const localError = text && !HEX.test(text) ? 'Use a colour like #FFE500' : null;
  return (
    <Field
      label={label}
      description={description}
      error={error || localError}
      htmlFor={id}
      isDefault={defaultValue === undefined ? undefined : String(value).toUpperCase() === String(defaultValue).toUpperCase()}
      onResetDefault={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
    >
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX.test(value || '') ? value : '#000000'}
          disabled={disabled}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="color-swatch shrink-0"
          aria-label={`${label} colour picker`}
        />
        <input
          id={id}
          type="text"
          value={text}
          disabled={disabled}
          maxLength={7}
          spellCheck={false}
          onChange={e => {
            let v = e.target.value.trim();
            if (v && !v.startsWith('#')) v = `#${v}`;
            setText(v);
            if (HEX.test(v)) onChange(v.toUpperCase());
          }}
          aria-invalid={error || localError ? true : undefined}
          className="field min-w-0 max-w-[8rem] flex-1 font-mono uppercase !text-[13px]"
        />
      </div>
    </Field>
  );
}

/** On/off switch. */
export function Toggle({ label, description, checked, onChange, defaultValue, disabled, error }) {
  const id = useId();
  return (
    <Field
      label={label}
      description={description}
      error={error}
      htmlFor={id}
      isDefault={defaultValue === undefined ? undefined : checked === defaultValue}
      onResetDefault={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
      right={<Switch id={id} checked={checked} onChange={onChange} disabled={disabled} label={label} />}
    />
  );
}

/** The switch itself (also used for the image-source list). */
export function Switch({ id, checked, onChange, disabled, label }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-[26px] w-[46px] shrink-0 items-center rounded-full border-2 border-ink transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-ink' : 'bg-paper-2'
      )}
    >
      <span
        className={cn(
          'inline-block h-[18px] w-[18px] rounded-full border-2 border-ink transition-transform duration-200',
          checked ? 'translate-x-[21px] bg-marker' : 'translate-x-[2px] bg-surface'
        )}
      />
    </button>
  );
}

/** One choice among a few options (radio group). */
export function Segmented({ label, description, value, options, onChange, defaultValue, error, columns }) {
  return (
    <Field
      label={label}
      description={description}
      error={error}
      isDefault={defaultValue === undefined ? undefined : value === defaultValue}
      onResetDefault={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
    >
      <div role="radiogroup" aria-label={label} className={cn('grid gap-2', columns || (options.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'))}>
        {options.map(o => {
          const active = o.value === value;
          const Icon = o.icon;
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'rounded border px-3 py-2.5 text-left text-[13px] font-semibold transition-all duration-150',
                active ? 'border-ink bg-marker shadow-hard-sm' : 'border-line-strong bg-surface text-ink-3 hover:border-ink hover:text-ink'
              )}
            >
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                {o.label}
              </span>
              {o.hint && <span className={cn('mt-0.5 block text-[11.5px] font-normal leading-snug', active ? 'text-ink/70' : 'text-muted')}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

/** Native select. */
export function SelectField({ label, description, value, options, onChange, defaultValue, error }) {
  const id = useId();
  return (
    <Field
      label={label}
      description={description}
      error={error}
      htmlFor={id}
      isDefault={defaultValue === undefined ? undefined : value === defaultValue}
      onResetDefault={defaultValue === undefined ? undefined : () => onChange(defaultValue)}
    >
      <select id={id} value={value} onChange={e => onChange(e.target.value)} aria-invalid={error ? true : undefined} className="field">
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Titled group of settings. */
export function Group({ title, description, children, actions }) {
  return (
    <section className="space-y-5 rounded-lg border border-line bg-surface p-5 shadow-soft sm:p-6">
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[16px] font-bold text-ink">{title}</h3>}
            {description && <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
