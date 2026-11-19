import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Clock,
  Film,
  Hand,
  Loader2,
  WifiOff,
  X,
  History,
  Image as ImageIcon,
  ImagePlus,
  Lock,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Type,
  Wand2
} from 'lucide-react';
import { cachedJSON } from '../lib/queryCache';
import { MOD_KEY } from '../app/platform';
import { markReactionUsed, reactionAsFile } from '../lib/reactionLibrary';
import ReactionPicker from './reactions/ReactionPicker';
import ReactionFraming from './reactions/ReactionFraming';
import { framingToSend } from '../lib/reactionFraming';
import { STAGES, currentStageTitle, useAdaptation } from '../adapt/AdaptationProvider';
import ImageSourcesStatus from './ImageSourcesStatus';
import ViralImageChoices from './imageChoice/ViralImageChoices';
import PunchlinePreview from './PunchlinePreview';
import {
  Badge,
  Button,
  Card,
  Chips,
  Disclosure,
  Elapsed,
  ElapsedTitle,
  Field,
  Greeting,
  ImageDrop,
  Input,
  PageHeader,
  Textarea,
  cn,
  isImageFile,
  makeImageItem,
  useAvailability,
  useDocumentTitle,
  useImageSlot,
  useToast
} from '../ui';

const VIRAL_SAMPLES = [
  {
    id: 'sample_movie',
    name: 'OG Movie Review',
    kind: 'Side-by-side',
    refFile: '/samples/phase2-movie-update.png',
    rxFile: '/samples/phase1-reference-standard.png',
    refName: 'OG Censor Viral Post',
    punchline: 'ఇది నా సొంత పంచ్‌లైన్! ఏ మార్పు లేకుండా రావాలి!',
    reactionContext: '* థియేటర్ ఆడియన్స్ రెస్పాన్స్'
  },
  {
    id: 'sample_stacked',
    name: 'Crowd Comparison',
    kind: 'Stacked rows',
    refFile: '/samples/phase2-stacked-comparison.png',
    rxFile: '/samples/phase2-stacked-comparison.png',
    refName: 'Vijay vs NTR Crowd Comparison',
    punchline: 'ఇది వేరే లెవెల్ క్రౌడ్ బ్రదర్! ఎవరూ మ్యాచ్ చేయలేరు!',
    reactionContext: '* ఫ్యాన్స్ రెస్పాన్స్'
  },
  {
    id: 'sample_facts',
    name: 'Facts Collage',
    kind: '2 × 2 grid',
    refFile: '/samples/phase2-facts-collage.png',
    rxFile: '/samples/phase2-facts-collage.png',
    refName: 'Lord Vishnu 7 Facts Viral',
    punchline: 'నంబర్ 7 తో ఇంకో స్పెషల్ ఉంది అది ఏంటో కామెంట్ చేయండి!',
    reactionContext: '* డివోటీస్ రియాక్షన్'
  }
];

// Only fonts that are installed on the server can be rendered.
const AVAILABLE_FONTS = ['Arial Black', 'Anton', 'Impact', 'Intrepid ExtraBold'];

/** One numbered step of the form. Turns yellow with a tick once its input is in. */
function Step({ n, title, hint, done, id, children, aside }) {
  return (
    <Card as="section" id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="flex items-start gap-4">
        <span
          className={cn(
            'grid h-10 w-10 shrink-0 place-items-center rounded border-2 border-ink font-display text-[18px] font-extrabold transition-colors duration-300',
            done ? 'bg-marker shadow-hard-sm' : 'bg-surface'
          )}
          aria-hidden="true"
        >
          {done ? <Check className="h-5 w-5" strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 id={`${id}-title`} className="text-[18px] font-bold leading-snug">
              {title}
            </h2>
            {aside}
          </div>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted">{hint}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

/** Ring that fills as the three inputs come in. */
function ReadyRing({ done, total }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="5" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={done === total ? 'rgb(var(--ink))' : 'rgb(var(--marker-deep))'}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * done) / total}
        className="transition-[stroke-dashoffset] duration-500 ease-out"
      />
    </svg>
  );
}

// Shown one at a time, while the meme is being made. Each is true of this app; keep them short and useful.
const WAIT_TIPS = [
  'Your punchline is never rewritten. It goes onto the meme exactly as you typed it.',
  'Every picture is checked against the reference before it is used, so a wrong face is rejected, not guessed.',
  'You can leave this page. The meme keeps being made and lands in My Memes.',
  `Press ${MOD_KEY} K from anywhere to jump to a page, a recent meme or a setting.`,
  'Each meme keeps its own copy of the style, so changing Settings never alters an old meme.',
  'Paste a screenshot with ' + MOD_KEY + ' V anywhere on this page to fill the next empty slot.'
];

/** One tip at a time, changing every few seconds. Own state: the form above never re-renders for it. */
function WaitTip() {
  const [i, setI] = useState(() => Math.floor(Math.random() * WAIT_TIPS.length));
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % WAIT_TIPS.length), 9000);
    return () => clearInterval(t);
  }, []);
  return (
    <p key={i} className="mt-4 animate-fade-in text-[13px] leading-snug text-paper/80">
      <span className="mr-2 font-mono text-micro uppercase text-marker">Tip</span>
      {WAIT_TIPS[i]}
    </p>
  );
}

const SLOT_LOOK = {
  waiting: { label: 'waiting', icon: null },
  searching: { label: 'searching', icon: Loader2 },
  found: { label: 'found', icon: Check },
  yours: { label: 'your picture', icon: Hand },
  failed: { label: 'not found', icon: X }
};

/** One picture of the meme and where the engine is with it. */
function SlotRow({ slot }) {
  const look = SLOT_LOOK[slot.state] || SLOT_LOOK.waiting;
  const Icon = look.icon;
  return (
    <li className="flex items-start gap-2.5 py-1 text-[12.5px] leading-snug">
      <span
        className={cn(
          'mt-px grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full',
          (slot.state === 'found' || slot.state === 'yours') && 'bg-marker text-ink',
          slot.state === 'searching' && 'text-marker',
          slot.state === 'failed' && 'bg-bad text-white',
          slot.state === 'waiting' && 'border border-white/20'
        )}
        aria-hidden="true"
      >
        {Icon && <Icon className={cn('h-3 w-3', slot.state === 'searching' && 'animate-spin')} strokeWidth={slot.state === 'searching' ? 2.4 : 3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('font-semibold', slot.state === 'waiting' ? 'text-paper/45' : 'text-white')}>{slot.subject}</span>
        <span className="sr-only"> {look.label}</span>
        {slot.note && slot.state !== 'waiting' && <span className="block text-paper/60">{slot.note}</span>}
      </span>
    </li>
  );
}

/** The engine's own words as it works, newest last: the part of the wait that has character. */
function LiveFeed({ log }) {
  if (!log?.length) return null;
  const lines = log.slice(-4);
  return (
    <ul className="mt-4 space-y-1 rounded-md bg-black/30 px-3 py-2.5 font-mono text-[11.5px] leading-snug text-paper/75" aria-label="What the engine just did">
      {lines.map((l, i) => {
        const s = Math.floor(l.atMs / 1000);
        return (
          <li key={`${l.atMs}-${i}`} className={cn('flex gap-2.5', i === lines.length - 1 && 'text-white')}>
            <span className="tabular shrink-0 text-marker/80">
              {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
            </span>
            <span className="min-w-0 break-words">{l.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Live progress while the engine works (usually 2–4 minutes). Every line comes from the engine itself: a stage is
 * active only while the engine is inside it, and each picture shows its own search.
 */
function Progress({ view, startedAt, reconnecting }) {
  // before the engine has answered (the inputs are still going up) the first stage shows as the current one
  const stages = view?.stages || STAGES.map((s, i) => ({ id: s.id, state: i === 0 ? 'active' : 'pending', note: i === 0 ? 'Sending your inputs to the engine' : undefined }));
  return (
    <Card tone="stage" pad="none" className="overflow-hidden animate-pop" role="status" aria-live="polite">
      <div className="working-bar h-2 animate-stripes" aria-hidden="true" />
      <div className="p-5 sm:p-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-micro uppercase text-paper/55">Working</p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight text-white">Making your meme</h2>
          </div>
          <div className="text-right" role="timer" aria-live="off">
            <p className="tabular font-mono text-[30px] font-semibold leading-none text-marker">
              <Elapsed since={startedAt} />
            </p>
            <p className="mt-1 text-[12px] text-paper/55">usually 2–4 min</p>
          </div>
        </div>

        {reconnecting && (
          <p className="mt-4 flex items-start gap-2 rounded-md bg-white/[0.07] px-3 py-2 text-[12.5px] leading-snug text-paper/85" role="alert">
            <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marker" aria-hidden="true" />
            Lost touch with the engine for a moment. Your meme keeps being made; this reconnects by itself.
          </p>
        )}

        <ol className="mt-5 space-y-1">
          {STAGES.map((p, i) => {
            const st = stages.find(x => x.id === p.id) || { state: 'pending' };
            const state = st.state === 'skipped' ? 'skipped' : st.state === 'done' ? 'done' : st.state === 'active' ? 'active' : 'todo';
            const showSlots = p.id === 'discovery' && view?.slots?.length > 0 && (st.state === 'active' || st.state === 'done');
            return (
              <li key={p.id} className={cn('rounded-md p-3 transition-colors', state === 'active' && 'bg-white/[0.07]')}>
                <div className="flex gap-3.5">
                  <span
                    className={cn(
                      'mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors',
                      state === 'done' && 'bg-marker text-ink',
                      state === 'skipped' && 'border border-marker/60 text-marker',
                      state === 'active' && 'animate-pulse-ring bg-marker text-ink',
                      state === 'todo' && 'border border-white/20 text-paper/40'
                    )}
                    aria-hidden="true"
                  >
                    {state === 'done' || state === 'skipped' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[14px] font-semibold', state === 'todo' ? 'text-paper/45' : 'text-white')}>{p.title}</span>
                    <span className={cn('block text-[12.5px] leading-snug', state === 'todo' ? 'text-paper/30' : 'text-paper/65')}>{st.note && state !== 'todo' ? st.note : p.text}</span>
                  </span>
                  <span className="sr-only">{state === 'done' ? 'done' : state === 'skipped' ? 'not needed' : state === 'active' ? 'in progress' : 'waiting'}</span>
                </div>
                {showSlots && (
                  <ul className="ml-[38px] mt-2 border-l border-white/15 pl-3.5" aria-label="Pictures">
                    {view.slots.map(s => (
                      <SlotRow key={s.slotId} slot={s} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <LiveFeed log={view?.log} />

        <div className="mt-5 border-t border-white/10 pt-4">
          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-paper/60">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            You can leave this page or close the tab. The engine keeps going, and the meme opens here, or is waiting in My Memes, when it is ready.
          </p>
          <div aria-hidden="true">
            <WaitTip />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ViralAdaptationForm() {
  const toast = useToast();
  const net = useAvailability({ internet: true }); // generating uses the AI and the internet

  // The three core inputs
  const [referenceFile, setReferenceFile] = useImageSlot(); // { file, preview, name }
  const [reactionFile, setReactionFile] = useImageSlot(); // { file, preview, name, libraryId? }
  const [framing, setFraming] = useState(null); // how the reaction picture is framed; null = not decided
  const [needsChoice, setNeedsChoice] = useState(false); // a stacked reaction picture: the owner has not yet said which frame
  const [panelPreview, setPanelPreview] = useState(null); // the framed reaction panel, for the live punchline preview
  useEffect(() => setFraming(null), [reactionFile?.file]);

  // "Use in a meme" on the Reactions page lands here with the picture's id: put it in the reaction slot
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const id = location.state?.reactionId;
    if (!id) return undefined;
    let live = true;
    navigate(location.pathname, { replace: true, state: null }); // so a reload or Back does not repeat it
    reactionAsFile({ imageId: id, category: 'reaction' })
      .then(file => live && setReactionFile({ ...makeImageItem(file), libraryId: id }))
      .catch(err => toast.error(err.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [punchline, setPunchline] = useState('');

  // Optional context & preferences
  const [reactionContext, setReactionContext] = useState('');
  // '' = use the fonts saved in Settings; a name = override the English font for this meme only
  const [fontFamily, setFontFamily] = useState('');
  const [settingsFont, setSettingsFont] = useState(null);
  const [fontChoices, setFontChoices] = useState(AVAILABLE_FONTS);
  const [punchStyle, setPunchStyle] = useState(null);
  useEffect(() => {
    let alive = true;
    cachedJSON('/api/settings', { ttl: 60_000 })
      .catch(() => null)
      .then(j => {
        if (!alive || !j?.settings) return;
        const s = j.settings;
        setSettingsFont(s.typography.roles.heading.englishFont);
        if (Array.isArray(j.fonts?.english) && j.fonts.english.length) setFontChoices(j.fonts.english);
        // the saved punchline style drives the live preview
        const ty = s.typography?.roles?.punchline;
        const fx = s.effects?.roles?.punchline;
        if (ty && fx) {
          setPunchStyle({
            english: ty.englishFont,
            telugu: ty.teluguFont,
            size: ty.size * (s.typography.fontSizeScale || 1),
            weight: ty.weight,
            position: ty.position,
            lineHeight: ty.lineHeight,
            fill: fx.fill.color,
            highlight: fx.highlight.enabled ? fx.highlight.color : fx.fill.color,
            stroke: fx.stroke.enabled ? fx.stroke.color : null,
            strokeWidth: fx.stroke.width
          });
        }
      })
      .catch(() => {
        /* older backend without Settings */
      });
    return () => {
      alive = false;
    };
  }, []);
  const [selectedProviders, setSelectedProviders] = useState([]);
  // optional: { draftId, overrides } from "Choose your own pictures" (the analysis is then reused)
  const [imageChoices, setImageChoices] = useState(null);

  // The meme being made lives in the app-wide AdaptationProvider: it keeps running (and keeps being followed) when
  // this page is left, refreshed or closed. This page only shows it.
  const adapt = useAdaptation();
  const loading = adapt.running;
  const [sampleLoading, setSampleLoading] = useState(false);
  // a request the engine refused (bad input, busy); a meme that failed while being made comes from the provider
  const [refused, setRefused] = useState(null); // { message, details }
  const [picturesOpen, setPicturesOpen] = useState(false);
  const errorRef = useRef(null);
  const failure = refused || (adapt.error ? { message: adapt.error.message, details: adapt.error.details } : null);
  const error = failure?.message || null;
  const errorDetails = failure?.details || null;
  const setError = message => setRefused(message ? { message } : null);
  const dismissError = () => {
    setRefused(null);
    if (adapt.error) adapt.clear();
  };

  // The running clock (a meme takes 2-4 minutes) lives in <Elapsed>, so this big form does not re-render every second.
  useDocumentTitle(loading ? 'Making your meme' : 'Viral Adaptation');

  // Errors appear at the top of the form; bring them into view.
  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  // Opened again while a meme is being made but this page has no inputs (a refresh, or another device started it)
  const resumed = loading && !referenceFile && !reactionFile;

  const inputsReady = [
    { key: 'reference', label: 'Reference screenshot', ok: Boolean(referenceFile), target: 'step-reference' },
    { key: 'reaction', label: needsChoice ? 'Choose which frame to use' : 'Your reaction image', ok: Boolean(reactionFile) && !needsChoice, target: 'step-reaction' },
    { key: 'punchline', label: 'Your punchline', ok: Boolean(punchline.trim()), target: 'step-punchline' }
  ];
  const readyCount = inputsReady.filter(i => i.ok).length;
  const allReady = readyCount === inputsReady.length;
  const missing = inputsReady.filter(i => !i.ok).map(i => i.label.toLowerCase());

  const goTo = id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = el.querySelector('textarea, input:not([type=hidden])');
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 350);
  };

  // Paste a screenshot (Ctrl+V) into the first empty image slot
  const slots = useRef({});
  slots.current = { referenceFile, reactionFile, loading };
  useEffect(() => {
    const onPaste = e => {
      const { referenceFile: ref, reactionFile: rx, loading: busy } = slots.current;
      if (busy) return;
      let file = [...(e.clipboardData?.files || [])].find(isImageFile);
      if (!file) file = [...(e.clipboardData?.items || [])].find(i => i.kind === 'file' && /^image\//.test(i.type))?.getAsFile();
      if (!file) return;
      e.preventDefault();
      const item = { ...makeImageItem(file), name: file.name && file.name !== 'image.png' ? file.name : 'Pasted screenshot.png' };
      if (!ref) {
        setReferenceFile(item);
        toast.success('Pasted as the reference screenshot.');
      } else if (!rx) {
        setReactionFile(item);
        toast.success('Pasted as your reaction image.');
      } else {
        URL.revokeObjectURL(item.preview);
        toast.info('Both images are already set. Remove one first, or use Replace.');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [setReferenceFile, setReactionFile, toast]);

  // Quick sample loader
  const handleLoadSample = async sample => {
    try {
      setError(null);
      setSampleLoading(true);

      const refRes = await fetch(sample.refFile);
      if (!refRes.ok) throw new Error(`sample image missing (${sample.refFile})`);
      const refBlob = await refRes.blob();
      const refFileObj = new File([refBlob], `${sample.id}_ref.jpg`, { type: 'image/jpeg' });
      setReferenceFile({ file: refFileObj, preview: URL.createObjectURL(refBlob), name: sample.refName });

      const rxRes = await fetch(sample.rxFile);
      if (!rxRes.ok) throw new Error(`sample image missing (${sample.rxFile})`);
      const rxBlob = await rxRes.blob();
      const rxFileObj = new File([rxBlob], `${sample.id}_rx.jpg`, { type: 'image/jpeg' });
      setReactionFile({ file: rxFileObj, preview: URL.createObjectURL(rxBlob), name: 'My Reaction Scene' });

      setPunchline(sample.punchline);
      setReactionContext(sample.reactionContext || '');
      toast.success(`Loaded the “${sample.name}” sample.`);
    } catch (err) {
      console.error('Failed to load viral sample:', err);
      setError('Could not load sample files: ' + err.message);
    } finally {
      setSampleLoading(false);
    }
  };

  // Submit: the engine accepts the three inputs and starts working in the background; the AdaptationProvider follows it
  const handleSubmit = async e => {
    e.preventDefault();
    if (loading) return;
    if (!referenceFile?.file) {
      setError('Add the viral reference screenshot first.');
      return;
    }
    if (!reactionFile?.file) {
      setError('Add your reaction image first.');
      return;
    }
    if (!punchline.trim()) {
      setError('Type your punchline first.');
      return;
    }

    setRefused(null);
    if (adapt.error) adapt.clear();

    const formData = new FormData();
    if (imageChoices?.draftId) {
      // the reference was analysed (and kept) when the pictures were chosen: no second upload or analysis
      formData.append('draftId', imageChoices.draftId);
      if (imageChoices.overrides.length) formData.append('slotOverrides', JSON.stringify(imageChoices.overrides));
    } else {
      formData.append('referenceImage', referenceFile.file);
    }
    formData.append('reactionImage', reactionFile.file);
    if (reactionFile.libraryId) markReactionUsed(reactionFile.libraryId); // the quick-pick row learns which ones you use
    const framingChoice = framingToSend(framing);
    if (framingChoice) formData.append('reactionFraming', JSON.stringify(framingChoice));
    formData.append('punchline', punchline.trim());
    if (reactionContext.trim()) {
      formData.append('reactionContext', reactionContext.trim());
    }
    if (fontFamily) formData.append('fontFamily', fontFamily);
    if (selectedProviders && selectedProviders.length > 0) {
      formData.append('selectedProviders', JSON.stringify(selectedProviders));
    }

    try {
      await adapt.start(formData);
    } catch (err) {
      console.error('Viral adaptation error:', err);
      const message =
        err instanceof TypeError && /fetch|network|load failed/i.test(err.message)
          ? 'Could not reach the engine. Is the backend running (npm start in the be folder)?'
          : err.message || 'The engine did not accept the request.';
      setRefused({ message, details: err.details });
    }
  };

  const customPictures = imageChoices?.overrides?.length || 0;
  const fineTuneCount = (fontFamily ? 1 : 0) + (reactionContext.trim() ? 1 : 0);
  const inputRejected = useCallback(message => toast.error(message), [toast]);

  return (
    <div className="pb-6">
      {loading && adapt.startedAt && <ElapsedTitle since={adapt.startedAt} prefix="Making meme" />}
      <PageHeader
        eyebrow={
          <>
            <Greeting /> · Studio · AI adaptation
          </>
        }
        title={
          <>
            Adapt a <span className="marker-underline px-1">viral</span> meme
          </>
        }
        description="Drop in the reference, your reaction shot and your punchline. The engine reads the layout, finds pictures it has verified, and sets the type. Your words stay exactly as typed."
        actions={
          <Badge tone="marker" icon={Lock} className="-rotate-2 py-0 shadow-hard-sm">
            Punchline is never edited
          </Badge>
        }
      />

      {/* Samples: fill all three inputs to try the flow */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg border border-dashed border-line-strong bg-surface/60 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> No files handy? Try a sample
        </span>
        <div className="flex flex-wrap gap-2">
          {VIRAL_SAMPLES.map(s => (
            <button
              key={s.id}
              type="button"
              disabled={loading || sampleLoading}
              onClick={() => handleLoadSample(s)}
              className="group inline-flex items-center gap-2.5 rounded-full border border-line-strong bg-surface py-1 pl-1 pr-3.5 text-left text-[13px] font-semibold transition-all hover:border-ink hover:bg-marker-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              <img src={s.refFile} alt="" className="h-7 w-6 rounded-[5px] border border-ink/20 object-cover" />
              <span className="leading-tight">
                {s.name}
                <span className="block text-[11px] font-normal text-muted">{s.kind}</span>
              </span>
            </button>
          ))}
        </div>
        {sampleLoading && <span className="text-[12px] text-muted" role="status">Loading sample…</span>}
      </div>

      {/* Errors appear next to the thing that caused them */}
      {error && (
        <div ref={errorRef} role="alert" className="mb-6 flex animate-slide-in items-start gap-3.5 rounded-lg border-2 border-bad bg-bad-soft p-4 shadow-[3px_3px_0_0_rgb(var(--bad))]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-bad" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[15px] font-bold text-ink">The meme could not be made</p>
            <p className="break-words text-[13.5px] leading-relaxed text-ink-3">{error}</p>
            {errorDetails?.stage === 'identity' && (
              <ul className="list-disc space-y-0.5 pl-4 pt-1 text-[12.5px] text-ink-3">
                {(errorDetails.slots || [])
                  .filter(s => s.status !== 'resolved')
                  .map(s => (
                    <li key={s.slot}>
                      Slot {s.slot}: {(s.reasons || []).join(' ')} {s.candidates?.length ? `Could be: ${s.candidates.map(c => c.name).join(', ')}.` : ''}
                    </li>
                  ))}
              </ul>
            )}
            {errorDetails?.stage === 'discovery' && (
              <ul className="list-disc space-y-0.5 pl-4 pt-1 text-[12.5px] text-ink-3">
                {(errorDetails.slots || []).map(s => (
                  <li key={s.slotId}>
                    {s.subject}: {s.selected ? (s.selected.title ? `found "${s.selected.title}"` : `found an image (${s.selected.provider})`) : `not found (searched ${(s.providers || []).join(', ')})`}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 pt-2.5">
              {/* only when a picture was the problem: choosing your own is the way out */}
              {(errorDetails?.stage === 'identity' || errorDetails?.stage === 'discovery') && (
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<ImagePlus className="h-4 w-4" />}
                  onClick={() => {
                    setPicturesOpen(true);
                    setTimeout(() => {
                      document.getElementById('choose-pictures-section')?.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                  }}
                >
                  Choose the pictures yourself
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={dismissError}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {resumed && (
        <Card tone="muted" className="mb-6">
          <p className="text-[15px] font-bold">Your meme is being made</p>
          <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted">
            It was started earlier, so its three inputs are already with the engine. Progress is on the right. This page opens the meme by itself when it is ready.
          </p>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px] lg:items-start xl:grid-cols-[minmax(0,1fr)_380px]" noValidate>
        {/* ---------------- inputs (locked while the engine works) ---------------- */}
        <fieldset disabled={loading} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <legend className="sr-only">Meme inputs</legend>

          <Step
            n={1}
            id="step-reference"
            done={Boolean(referenceFile)}
            title="The viral reference"
            hint="A screenshot of a viral meme from another page. It is used only as a structure guide: layout, how many pictures, where the text sits."
            aside={referenceFile && <Badge tone="ok" dot size="sm">Ready</Badge>}
          >
            <ImageDrop
              value={referenceFile}
              onChange={setReferenceFile}
              onReject={inputRejected}
              icon={ImageIcon}
              title="Drop the viral screenshot here, or browse"
              hint="JPG, PNG or WEBP, straight from Instagram or your phone."
              thumbClass="h-32 w-[104px]"
              showPasteHint
              note="Read by the AI for layout only."
            />
          </Step>

          <Step
            n={2}
            id="step-reaction"
            done={Boolean(reactionFile)}
            title="Your reaction image"
            hint="The picture for the bottom reaction panel. It is used as it is: never swapped, never altered."
            aside={reactionFile && <Badge tone="ok" dot size="sm">Ready</Badge>}
          >
            <ImageDrop
              value={reactionFile}
              onChange={setReactionFile}
              onReject={inputRejected}
              icon={Film}
              title="Drop your reaction scene here, or browse"
              hint="Usually a 16:9 movie moment with a clear face."
              thumbClass="h-[72px] w-32"
              note="Goes in the bottom reaction section."
            />
            {reactionFile?.file && <ReactionFraming file={reactionFile.file} framing={framing} onFraming={setFraming} onPanel={setPanelPreview} onNeedsChoice={setNeedsChoice} />}
            <ReactionPicker disabled={loading} onPick={({ file, image }) => setReactionFile({ ...makeImageItem(file), libraryId: image.imageId })} />
          </Step>

          <Step
            n={3}
            id="step-punchline"
            done={Boolean(punchline.trim())}
            title="Your punchline"
            hint="Telugu or English. It is placed over the reaction image with the outline and colours from your Settings, and never rewritten."
            aside={
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted">
                <Lock className="h-3 w-3" aria-hidden="true" /> Used exactly as typed
              </span>
            }
          >
            <div className="space-y-4">
              <Field
                label="Punchline text"
                right={<span className="tabular font-mono text-[12px] text-muted" aria-live="off">{punchline.length} chars</span>}
              >
                {({ id }) => (
                  <Textarea
                    id={id}
                    value={punchline}
                    onChange={e => setPunchline(e.target.value)}
                    placeholder="ఉదాహరణ: ఇది నా సొంత పంచ్‌లైన్! ఏ మార్పు లేకుండా రావాలి!"
                    rows={3}
                    className="telugu-input"
                  />
                )}
              </Field>
              <PunchlinePreview image={panelPreview?.url || reactionFile?.preview} aspect={panelPreview?.aspect} text={punchline} style={punchStyle} englishFont={fontFamily || undefined} />
            </div>
          </Step>

          {/* Optional controls, tucked away until needed */}
          <p className="px-1 pt-1 font-mono text-micro uppercase text-muted">Fine-tune · all optional</p>
          <Card pad="none" className="!mt-2 px-5 sm:px-6">
            <Disclosure
              id="choose-pictures-section"
              open={picturesOpen}
              onOpenChange={setPicturesOpen}
              icon={ImagePlus}
              title="Choose your own pictures"
              summary={customPictures ? `${customPictures} picture${customPictures === 1 ? '' : 's'} chosen by you` : 'The AI picks and verifies every image by default'}
              badge={customPictures ? <Badge tone="marker" size="sm">{customPictures}</Badge> : null}
            >
              <ViralImageChoices referenceFile={referenceFile} disabled={loading} onChange={setImageChoices} />
            </Disclosure>
            <Disclosure
              icon={Search}
              title="Image search sources"
              summary={selectedProviders.length ? `${selectedProviders.length} source${selectedProviders.length === 1 ? '' : 's'} on for this meme` : 'Where pictures are searched for'}
            >
              <ImageSourcesStatus onSelectionChange={setSelectedProviders} />
            </Disclosure>
            <Disclosure
              icon={Type}
              title="Type and caption tag"
              summary={fontFamily ? `English font: ${fontFamily}` : settingsFont ? `Using Settings: ${settingsFont}` : 'Uses your Settings'}
              badge={fineTuneCount ? <Badge tone="marker" size="sm">{fineTuneCount}</Badge> : null}
            >
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[13px] font-semibold">English font for this meme</p>
                  <Chips
                    tone="marker"
                    label="English font"
                    value={fontFamily}
                    onChange={setFontFamily}
                    options={[
                      { value: '', label: `From Settings${settingsFont ? ` (${settingsFont})` : ''}` },
                      ...fontChoices.map(f => ({ value: f, label: f, style: { fontFamily: `"${f}", "Arial Black", sans-serif` } }))
                    ]}
                  />
                </div>
                <Field label="Reaction tag" optional hint="A short caption on the reaction panel. The reference's own tag is never copied.">
                  {({ id }) => (
                    <Input
                      id={id}
                      value={reactionContext}
                      onChange={e => setReactionContext(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                      placeholder="e.g. * థియేటర్ ఆడియన్స్ రెస్పాన్స్"
                      className="telugu-input !text-[15px] !leading-normal"
                    />
                  )}
                </Field>
              </div>
            </Disclosure>
          </Card>
        </fieldset>

        {/* ---------------- launch panel ---------------- */}
        <aside className="space-y-4 lg:sticky lg:top-8" aria-label="Generate">
          {loading ? (
            <Progress view={adapt.view} startedAt={adapt.startedAt} reconnecting={adapt.reconnecting} />
          ) : (
            <Card tone="sticker" pad="md">
              <div className="flex items-center gap-3.5">
                <ReadyRing done={readyCount} total={inputsReady.length} />
                <div>
                  <h2 className="text-[18px] font-bold leading-tight">{allReady ? 'Ready when you are' : 'Almost there'}</h2>
                  <p className="text-[13px] text-muted">
                    <span className="tabular font-mono font-semibold text-ink">{readyCount}</span> of {inputsReady.length} inputs in
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-1" aria-label="Required inputs">
                {inputsReady.map(i => (
                  <li key={i.key}>
                    <button
                      type="button"
                      onClick={() => goTo(i.target)}
                      className="group flex w-full items-center gap-3 rounded px-2 py-1.5 text-left text-[14px] transition-colors hover:bg-paper"
                    >
                      <span
                        className={cn(
                          'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors',
                          i.ok ? 'border-ink bg-marker' : 'border-line-strong bg-surface'
                        )}
                        aria-hidden="true"
                      >
                        {i.ok && <Check className="h-3 w-3" strokeWidth={3.5} />}
                      </span>
                      <span className={cn('flex-1 font-semibold', i.ok ? 'text-ink' : 'text-muted')}>{i.label}</span>
                      <span className="sr-only">{i.ok ? 'done' : 'missing'}</span>
                      {!i.ok && <span className="text-[12px] font-semibold text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">Add</span>}
                    </button>
                  </li>
                ))}
              </ul>

              <Button type="submit" variant="primary" size="lg" disabled={!allReady || !net.ok} leftIcon={<Wand2 className="h-[18px] w-[18px]" />} className="mt-5 w-full">
                Adapt and generate
              </Button>
              <p className="mt-3 text-center text-[12.5px] leading-snug text-muted">
                {!net.ok ? net.reason : allReady ? 'Takes about 2–4 minutes. You can leave while it works.' : `Still needed: ${missing.join(', ')}.`}
              </p>
            </Card>
          )}

          <Card tone="muted" pad="sm" className="!p-4">
            <ul className="space-y-3 text-[13px] leading-snug text-ink-3">
              <li className="flex gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                <span><strong className="text-ink">Your words stay yours.</strong> No AI-written or edited punchlines.</span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                <span><strong className="text-ink">Pictures are checked.</strong> Identity, source and a visual match against the reference.</span>
              </li>
              <li className="flex gap-3">
                <History className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                <span><strong className="text-ink">Nothing is lost.</strong> Every change is a new version you can go back to.</span>
              </li>
            </ul>
          </Card>
        </aside>

        {/* phones: a sticky bar keeps the main action in reach */}
        <div className="safe-bottom fixed inset-x-3 bottom-[84px] z-30 flex items-center gap-3 rounded-lg border-2 border-ink bg-surface p-2.5 shadow-hard lg:hidden">
          {loading ? (
            <>
              <span className="working-bar h-8 w-2 shrink-0 animate-stripes rounded-full" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-[13px] leading-tight">
                <span className="block font-bold">Making your meme</span>
                <span className="block truncate text-muted">{currentStageTitle(adapt.view)}</span>
              </span>
              <span className="tabular font-mono text-[15px] font-semibold">
                <Elapsed since={adapt.startedAt} />
              </span>
            </>
          ) : (
            <>
              <ReadyRing done={readyCount} total={inputsReady.length} />
              <span className="min-w-0 flex-1 text-[13px] leading-tight">
                <span className="block font-bold">{allReady ? 'Ready to generate' : `${readyCount} of ${inputsReady.length} inputs in`}</span>
                {!allReady && <span className="block truncate text-muted">Needs {missing[0]}</span>}
              </span>
              <Button type="submit" variant="primary" size="sm" disabled={!allReady || !net.ok} leftIcon={<Wand2 className="h-4 w-4" />}>
                Generate
              </Button>
            </>
          )}
        </div>
        <div className="h-16 lg:hidden" aria-hidden="true" />
      </form>
    </div>
  );
}
