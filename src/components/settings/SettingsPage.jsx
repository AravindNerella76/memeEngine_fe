import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, Check, Gauge, Globe, Image, Instagram, KeyRound, LayoutTemplate, MessageCircle, MoonStar, Palette, RotateCcw, Save, Type, Undo2, WifiOff } from 'lucide-react';
import { diff, ROLE_SAMPLE, SECTION_INFO, serverErrorsByPath, settingsApi, setAt, validate } from './settingsModel';
import SettingsPreview from './SettingsPreview';
import { AdvancedSection, CanvasSection, DiscoverySection, EffectsSection, ImageSection, TypographySection } from './sections';
import InstagramSection from './InstagramSection';
import WhatsAppSection from './WhatsAppSection';
import AccountSection from './AccountSection';
import NotificationsSection from './NotificationsSection';
import AppearanceSection from './AppearanceSection';
import { Alert, Badge, Button, EmptyState, PageHeader, Skeleton, cn, useAvailability, useConfirm, useDocumentTitle, useToast } from '../../ui';

/**
 * THE list of settings sections, in menu order. To add one:
 *   1. its titles go in SECTION_INFO (settingsModel.js; the Ctrl+K palette reads them from there too),
 *   2. its form is a component taking the section props,
 *   3. one line here. `preview: true` shows the live sample meme beside it.
 */
/** Sections that save themselves (no shared Save bar, no "Defaults for this section"). */
const SELF_MANAGED = new Set(['instagram', 'whatsapp', 'notifications', 'appearance', 'account']);

const SECTIONS = [
  { id: 'typography', icon: Type, preview: true, Body: TypographySection },
  { id: 'effects', icon: Palette, preview: true, Body: EffectsSection },
  { id: 'canvas', icon: LayoutTemplate, preview: true, Body: CanvasSection },
  { id: 'imageProcessing', icon: Image, preview: true, Body: ImageSection },
  { id: 'discovery', icon: Globe, preview: false, Body: DiscoverySection },
  { id: 'instagram', icon: Instagram, preview: false, Body: InstagramSection },
  { id: 'whatsapp', icon: MessageCircle, preview: false, Body: WhatsAppSection },
  { id: 'advanced', icon: Gauge, preview: false, Body: AdvancedSection },
  { id: 'notifications', icon: Bell, preview: false, Body: NotificationsSection },
  { id: 'appearance', icon: MoonStar, preview: false, Body: AppearanceSection },
  { id: 'account', icon: KeyRound, preview: false, Body: AccountSection }
];

const DRAFT_KEY = 'meme_engine_settings_draft';
const SECTION_KEY = 'meme_engine_settings_section';
const clone = v => JSON.parse(JSON.stringify(v));

function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the page still works */
  }
}

/** Which top-level sections a patch touches. */
const touched = patch => Object.keys(patch || {}).filter(k => SECTION_INFO[k]);

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const net = useAvailability(); // saving needs the engine; unsaved changes stay on this screen until it answers
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [section, setSection] = useState(() => {
    const fromUrl = searchParams.get('section');
    if (fromUrl && SECTION_INFO[fromUrl]) return fromUrl;
    const s = readStorage(SECTION_KEY);
    return SECTION_INFO[s] ? s : 'typography';
  });

  useEffect(() => {
    const fromUrl = searchParams.get('section');
    if (fromUrl && SECTION_INFO[fromUrl]) {
      setSection(fromUrl);
    }
  }, [searchParams]);
  const [role, setRoleState] = useState('punchline');
  const [sample, setSample] = useState('comparison');
  const [saving, setSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [restoredDraft, setRestoredDraft] = useState(false);

  const showToast = useCallback((kind, text) => toast[kind](text), [toast]);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await settingsApi.load();
      setMeta(r);
      setSaved(r.settings);
      // unsaved changes from earlier in this browser tab (only if the saved settings did not change meanwhile)
      let next = r.settings;
      try {
        const stored = JSON.parse(readStorage(DRAFT_KEY) || 'null');
        if (stored && stored.base === (r.settings.updatedAt || null) && stored.draft) {
          next = stored.draft;
          setRestoredDraft(true);
        }
      } catch {
        /* ignore a damaged draft */
      }
      setDraft(next);
    } catch (e) {
      setLoadError(e.message || 'Could not load the settings');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => writeStorage(SECTION_KEY, section), [section]);

  const patch = useMemo(() => (draft && saved ? diff(draft, saved) : undefined), [draft, saved]);
  const dirty = Boolean(patch);
  const clientErrors = useMemo(() => (draft && meta ? validate(draft, meta.schema, meta.fonts) : {}), [draft, meta]);
  const errors = useMemo(() => ({ ...serverErrors, ...clientErrors }), [serverErrors, clientErrors]);
  const errorCount = Object.keys(clientErrors).length;

  // keep unsaved changes for this tab; warn before closing it
  useEffect(() => {
    if (!saved) return;
    writeStorage(DRAFT_KEY, dirty ? JSON.stringify({ base: saved.updatedAt || null, draft }) : null);
  }, [dirty, draft, saved]);
  useEffect(() => {
    if (!dirty) return undefined;
    const h = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = useCallback((path, value) => {
    setDraft(d => setAt(d, path, value));
    const key = path.join('.');
    setServerErrors(se => {
      if (!Object.keys(se).some(k => k === key || k.startsWith(`${key}.`))) return se;
      const n = { ...se };
      for (const k of Object.keys(n)) if (k === key || k.startsWith(`${key}.`)) delete n[k];
      return n;
    });
  }, []);

  const setRole = r => {
    setRoleState(r);
    setSample(ROLE_SAMPLE[r] || 'comparison');
  };

  const save = async () => {
    if (!patch) return;
    if (errorCount) {
      showToast('error', `Fix ${errorCount} highlighted value${errorCount === 1 ? '' : 's'} before saving.`);
      return;
    }
    setSaving(true);
    try {
      const r = await settingsApi.save(patch);
      setSaved(r.settings);
      setDraft(r.settings);
      setMeta(m => ({ ...m, settings: r.settings, effective: r.effective, providers: r.providers }));
      setServerErrors({});
      setRestoredDraft(false);
      showToast('success', 'Settings saved. New memes use them; existing memes keep their own style.');
    } catch (e) {
      if (e.errors?.length) setServerErrors(serverErrorsByPath(e.errors));
      showToast('error', e.errors?.length ? `Not saved: ${e.errors.slice(0, 2).join('; ')}` : `Not saved: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(saved);
    setServerErrors({});
    setRestoredDraft(false);
    showToast('info', 'Unsaved changes discarded.');
  };

  const resetSection = id => {
    setDraft(d => ({ ...d, [id]: clone(meta.defaults[id]) }));
    showToast('info', `${SECTION_INFO[id].title}: defaults loaded. Review the preview, then Save.`);
  };
  const resetAll = async () => {
    const ok = await confirm({
      title: 'Load the defaults for every section?',
      body: 'Nothing changes until you press Save. You can still discard the loaded defaults afterwards.',
      confirmLabel: 'Load defaults'
    });
    if (!ok) return;
    setDraft(d => ({ ...clone(meta.defaults), version: d.version, updatedAt: d.updatedAt }));
    showToast('info', 'Defaults loaded for every section. Review, then Save.');
  };

  if (loadError) {
    return (
      <EmptyState
        tone="bad"
        icon={WifiOff}
        title="Settings could not be loaded"
        className="mx-auto max-w-xl"
        action={
          <Button variant="dark" onClick={load}>
            Try again
          </Button>
        }
      >
        {loadError}. Check that the backend is running. An older backend build has no Settings API; rebuild and restart it (npm run build && npm start in memeEngine_be).
      </EmptyState>
    );
  }
  if (!draft || !meta) {
    return (
      <div aria-busy="true" aria-label="Loading settings">
        {/* the title is known before the data arrives: show it at once so the page never looks empty */}
        <PageHeader
          eyebrow="Setup"
          title="Settings"
          description="The house style and pipeline for every new meme. Each meme keeps a copy of the style it was made with, so changes here never alter existing memes or their versions."
        />
        <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
          <Skeleton className="hidden h-80 xl:block" />
          <div className="space-y-4">
            <Skeleton className="h-36" />
            <Skeleton className="h-72" />
          </div>
        </div>
      </div>
    );
  }

  const info = SECTION_INFO[section];
  const current = SECTIONS.find(s => s.id === section);
  const sectionProps = { draft, defaults: meta.defaults, schema: meta.schema, fonts: meta.fonts, errors, set, role, setRole, meta: { ...meta, savedSettings: saved } };
  const changedSections = new Set(touched(patch));
  const sectionErrors = id => Object.keys(clientErrors).some(k => k.startsWith(`${id}.`));
  const SectionBody = current.Body;

  return (
    <div className="pb-32">
      <PageHeader
        eyebrow="Setup"
        title="Settings"
        description="The house style and pipeline for every new meme. Each meme keeps a copy of the style it was made with, so changes here never alter existing memes or their versions."
        actions={
          <>
            {dirty ? (
              <Badge tone="warn" dot role="status">
                Unsaved changes
              </Badge>
            ) : (
              <Badge tone="ok" icon={Check} role="status">
                {saved.updatedAt ? `Saved ${new Date(saved.updatedAt).toLocaleString()}` : 'Using the default house style'}
              </Badge>
            )}
            <Button variant="secondary" size="sm" onClick={resetAll} leftIcon={<RotateCcw className="h-3.5 w-3.5" />}>
              Defaults for all
            </Button>
          </>
        }
      />

      {restoredDraft && dirty && (
        <Alert tone="info" className="mb-5">
          Your unsaved changes from earlier were restored. Save them or discard them below.
        </Alert>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        {/* Section navigation: sidebar on wide screens, scrollable tabs otherwise */}
        <nav aria-label="Settings sections" className="min-w-0 xl:sticky xl:top-8">
          <ul className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 xl:mx-0 xl:flex-col xl:gap-1 xl:overflow-visible xl:px-0 xl:pb-0">
            {SECTIONS.map(({ id, icon: Icon }) => {
              const active = id === section;
              return (
                <li key={id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSection(id)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-11 w-full items-center gap-2.5 rounded px-3.5 text-left text-[14px] font-semibold transition-colors',
                      active ? 'bg-ink text-paper shadow-hard-sm' : 'border border-line bg-surface text-ink-3 hover:border-ink hover:text-ink xl:border-transparent xl:bg-transparent xl:hover:bg-ink/[0.06]'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">
                      <span className="xl:hidden">{SECTION_INFO[id].short}</span>
                      <span className="hidden xl:inline">{SECTION_INFO[id].title}</span>
                    </span>
                    {sectionErrors(id) ? (
                      <span className="ml-auto h-2 w-2 rounded-full bg-bad" title="Has invalid values" aria-label="has invalid values" />
                    ) : changedSections.has(id) ? (
                      <span className={cn('ml-auto h-2 w-2 rounded-full ring-[1.5px]', active ? 'bg-marker ring-marker' : 'bg-marker ring-ink')} title="Unsaved changes" aria-label="unsaved changes" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{info.title}</h2>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted">{info.description}</p>
            </div>
            {!SELF_MANAGED.has(section) && (
              <Button variant="secondary" size="sm" onClick={() => resetSection(section)} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} className="shrink-0">
                Defaults for this section
              </Button>
            )}
          </div>

          <div className={current.preview ? 'grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]' : ''}>
            <div className="min-w-0">
              <SectionBody {...sectionProps} />
            </div>
            {current.preview && (
              <div className="lg:sticky lg:top-8">
                <SettingsPreview patch={patch} blocked={errorCount > 0} sample={sample} onSampleChange={setSample} samples={meta.previewSamples} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save bar: appears only when there is something to save */}
      {dirty && (
        <div
          className="on-ink fixed bottom-[84px] left-3 right-3 z-40 mx-auto flex max-w-2xl animate-slide-in flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-ink px-4 py-3 text-paper shadow-lift md:bottom-6 md:left-[calc(50%+126px)] md:right-auto md:w-[min(640px,calc(100vw-300px))] md:-translate-x-1/2"
          role="region"
          aria-label="Unsaved changes"
        >
          <div className="min-w-[160px] flex-1 text-[13px]">
            <p className="flex items-center gap-2 font-bold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-marker" aria-hidden="true" /> Unsaved changes
            </p>
            <p className="truncate text-paper/60">{[...changedSections].map(s => SECTION_INFO[s].short).join(', ')}</p>
            {errorCount > 0 && (
              <p className="font-semibold text-coral">
                {errorCount} value{errorCount === 1 ? '' : 's'} to fix
              </p>
            )}
            {!net.ok && <p className="font-semibold text-coral">{net.reason} Your changes are kept here until you can save.</p>}
          </div>
          <Button variant="on-ink" size="sm" onClick={discard} disabled={saving} leftIcon={<Undo2 className="h-3.5 w-3.5" />}>
            Discard
          </Button>
          <Button variant="marker-on-ink" size="sm" onClick={save} loading={saving} disabled={errorCount > 0 || !net.ok} leftIcon={<Save className="h-3.5 w-3.5" />}>
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
