import React, { useEffect, useRef, useState } from 'react';
import { ACCEPT_PICTURES, isHeicFile, toBrowserImages } from '../lib/heic';
import { Link } from 'react-router-dom';
import { markReactionUsed } from '../lib/reactionLibrary';
import ReactionPicker from './reactions/ReactionPicker';
import ReactionFraming from './reactions/ReactionFraming';
import { framingToSend } from '../lib/reactionFraming';
import { ArrowLeft, ArrowRight, Check, Eye, Film, GripVertical, Plus, Sparkles, Trash2, Upload, Wand2, X } from 'lucide-react';
import { SAMPLE_TEMPLATES } from './SampleTemplates';
import { API_BASE, apiFetch } from '../api';
import { cachedJSON } from '../lib/queryCache';
import { ColorField, NumberField, Segmented, SelectField } from './settings/controls';
import LivePreview from './create/LivePreview';
import { KeyCaps, press, useShortcuts } from '../app/shortcuts';
import { useManualPreview } from './create/useManualPreview';
import { clearDraft, loadDraft, saveDraft } from './create/draft';
import { Alert, Badge, Button, Card, Dialog, Field, ImageDrop, Input, PageHeader, Textarea, cn, isImageFile, makeImageItem, useDocumentTitle, useImageSlot, useAvailability, useToast } from '../ui';

/** Shown in the preview until the person types theirs (never sent for a real meme). */
const PLACEHOLDER_PUNCHLINE = 'Your punchline appears here';

const MEME_TYPES = [
  { id: 'facts_collage', title: 'Facts / Collage', desc: 'Grid arrangement with individual cell labels' },
  { id: 'comparison', title: 'Comparison', desc: 'Side-by-side columns or stacked rows' },
  { id: 'trending_news', title: 'Trending News', desc: 'Hero image + statement overlay' },
  { id: 'movie_update', title: 'Movie Review / Censor', desc: 'Seamless poster collage + review bullet points' },
  { id: 'custom', title: 'Custom Meme', desc: 'Dynamic split based on materials' }
];

/** Tiny sketch of each layout, so the choice is visual. */
function LayoutGlyph({ type }) {
  const bar = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} rx="1.5" fill="rgb(var(--marker))" stroke="currentColor" strokeWidth="1.6" />;
  const box = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />;
  return (
    <svg viewBox="0 0 40 50" className="h-[52px] w-10 shrink-0" aria-hidden="true">
      {type === 'facts_collage' && (
        <>
          {bar(3, 3, 34, 6)}
          {box(3, 12, 16, 12)}
          {box(21, 12, 16, 12)}
          {box(3, 26, 16, 12)}
          {box(21, 26, 16, 12)}
          {bar(3, 41, 34, 6)}
        </>
      )}
      {type === 'comparison' && (
        <>
          {bar(3, 3, 34, 6)}
          {box(3, 12, 10, 26)}
          {box(15, 12, 10, 26)}
          {box(27, 12, 10, 26)}
          {bar(3, 41, 34, 6)}
        </>
      )}
      {type === 'trending_news' && (
        <>
          {box(3, 3, 16, 22)}
          {box(21, 3, 16, 22)}
          {bar(3, 27, 34, 10)}
          {bar(3, 41, 34, 6)}
        </>
      )}
      {type === 'movie_update' && (
        <>
          {bar(3, 3, 34, 6)}
          {box(3, 12, 16, 14)}
          {box(21, 12, 16, 14)}
          <path d="M5 30h30M5 34h24M5 38h28" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          {bar(3, 41, 34, 6)}
        </>
      )}
      {type === 'custom' && (
        <>
          <rect x="3" y="3" width="34" height="44" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="3 3" />
          <path d="M20 15l2.4 6.2 6.2 2.4-6.2 2.4L20 32l-2.4-6-6.2-2.4 6.2-2.4z" fill="rgb(var(--marker))" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function Step({ n, title, hint, children, done }) {
  return (
    <Card as="section">
      <div className="mb-5 flex items-start gap-4">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded border-2 border-ink font-display text-[18px] font-extrabold', done ? 'bg-marker shadow-hard-sm' : 'bg-surface')} aria-hidden="true">
          {done ? <Check className="h-5 w-5" strokeWidth={3} /> : n}
        </span>
        <div>
          <h2 className="text-[18px] font-bold leading-snug">{title}</h2>
          {hint && <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function CreateMemeForm({ onGenerated }) {
  useDocumentTitle('Create Meme');
  const toast = useToast();
  const net = useAvailability(); // building a meme by hand needs the engine, not the internet

  // Meme Information
  const [topic, setTopic] = useState('');
  const [headline, setHeadline] = useState('');
  const [statement, setStatement] = useState('');
  const [bulletPoints, setBulletPoints] = useState([]);
  const [reactionContext, setReactionContext] = useState('');
  const [punchline, setPunchline] = useState('');

  // Assets
  const [subjectFiles, setSubjectFiles] = useState([]); // [{ id, file, preview, label }]
  const [reactionFile, setReactionFile] = useImageSlot(); // { file, preview, name }
  const [framing, setFraming] = useState(null); // how the reaction picture is framed; null = not decided
  const [needsChoice, setNeedsChoice] = useState(false); // a stacked reaction picture: the owner has not yet said which frame
  useEffect(() => setFraming(null), [reactionFile?.file]);
  const [dropOver, setDropOver] = useState(false);

  // Meme Type
  const [memeType, setMemeType] = useState('facts_collage');

  // Design Specifications
  const [fontFamily, setFontFamily] = useState('Arial Black');
  const [teluguFontFamily, setTeluguFontFamily] = useState('Ramabhadra');
  const [primaryTextColor, setPrimaryTextColor] = useState('#FFE500');
  const [secondaryTextColor, setSecondaryTextColor] = useState('#FFFFFF');
  const [outlineColor, setOutlineColor] = useState('#000000');
  const [outlineThickness, setOutlineThickness] = useState(7);
  const [fontSizeScale, setFontSizeScale] = useState(1.0);
  const [shadowBlur, setShadowBlur] = useState(8);
  const [canvasPreset, setCanvasPreset] = useState('portrait_4_5');
  const [subjectFit, setSubjectFit] = useState('cover'); // 'cover' | 'contain'

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false); // the preview as a sheet (phones; large screens show it beside the form)
  const [dragFrom, setDragFrom] = useState(null); // index of the subject tile being dragged
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // An unfinished meme comes back after a refresh: the words only (pictures cannot be kept by the browser)
  const [draftRestored, setDraftRestored] = useState(false);
  const draftReady = useRef(false);
  useEffect(() => {
    const d = loadDraft();
    if (d) {
      setTopic(d.topic);
      setHeadline(d.headline);
      setStatement(d.statement);
      setBulletPoints(d.bulletPoints);
      setReactionContext(d.reactionContext);
      setPunchline(d.punchline);
      if (MEME_TYPES.some(t => t.id === d.memeType)) setMemeType(d.memeType);
      setDraftRestored(true);
    }
    draftReady.current = true;
  }, []);
  useEffect(() => {
    if (!draftReady.current) return undefined;
    const t = setTimeout(() => saveDraft({ topic, headline, statement, bulletPoints, reactionContext, punchline, memeType }), 500);
    return () => clearTimeout(t);
  }, [topic, headline, statement, bulletPoints, reactionContext, punchline, memeType]);
  const startFresh = () => {
    clearDraft();
    setTopic('');
    setHeadline('');
    setStatement('');
    setBulletPoints([]);
    setReactionContext('');
    setPunchline('');
    setDraftRestored(false);
  };

  // Installed fonts and the saved Settings (the design fields below start from them)
  const [fonts, setFonts] = useState({
    english: ['Arial Black', 'Anton', 'Impact', 'Intrepid ExtraBold', 'Intrepid'],
    telugu: ['Ramabhadra', 'Mandali', 'Noto Sans Telugu', 'Anek Telugu']
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    cachedJSON('/api/settings', { ttl: 60_000 })
      .then(j => {
        if (!alive || !j?.settings) return;
        const s = j.settings;
        const heading = s.typography.roles.heading;
        const punch = s.typography.roles.punchline;
        const fx = s.effects.roles.punchline;
        if (j.fonts) setFonts(j.fonts);
        setFontFamily(heading.englishFont);
        setTeluguFontFamily(punch.teluguFont);
        setPrimaryTextColor(fx.highlight.color);
        setSecondaryTextColor(fx.fill.color);
        setOutlineColor(fx.stroke.color);
        setOutlineThickness(fx.stroke.enabled ? fx.stroke.width : 0);
        setShadowBlur(fx.shadow.blur);
        setFontSizeScale(s.typography.fontSizeScale);
        setCanvasPreset(s.canvas.aspect);
        if (s.imageProcessing?.subjectFit) setSubjectFit(s.imageProcessing.subjectFit);
        setSettingsLoaded(true);
      })
      .catch(() => {
        /* older backend: keep the built-in defaults */
      });
    return () => {
      alive = false;
    };
  }, []);

  // free the browser's preview URLs when the page closes
  const subjectsRef = useRef([]);
  subjectsRef.current = subjectFiles;
  useEffect(() => () => subjectsRef.current.forEach(s => URL.revokeObjectURL(s.preview)), []);

  // Quick demo template loader
  const handleLoadTemplate = async template => {
    setTopic(template.topic || '');
    setHeadline(template.headline || '');
    setStatement(template.statement || '');
    setBulletPoints(template.bulletPoints || []);
    setReactionContext(template.reactionContext || '');
    setPunchline(template.punchline || '');
    setMemeType(template.memeType);

    // Fetch sample assets and convert to File objects
    try {
      setLoading(true);
      setError(null);
      const newSubjectFiles = [];

      for (let i = 0; i < template.sampleAssets.subjects.length; i++) {
        const assetName = template.sampleAssets.subjects[i];
        const fileRes = await fetch(`/samples/${template.id === 'facts_collage' ? 'phase2-facts-collage.png' : 'phase1-reference-standard.png'}`);
        const blob = await fileRes.blob();
        const file = new File([blob], assetName, { type: 'image/jpeg' });
        newSubjectFiles.push({
          id: String(Date.now() + i),
          file,
          preview: URL.createObjectURL(blob),
          label: template.labels[i] || ''
        });
      }
      subjectFiles.forEach(s => URL.revokeObjectURL(s.preview));
      setSubjectFiles(newSubjectFiles);

      // Reaction
      const rxRes = await fetch(`/samples/phase1-reference-standard.png`);
      const rxBlob = await rxRes.blob();
      setReactionFile({
        file: new File([rxBlob], template.sampleAssets.reaction, { type: 'image/jpeg' }),
        preview: URL.createObjectURL(rxBlob),
        name: template.sampleAssets.reaction
      });
      toast.success(`Loaded the “${template.name}” sample.`);
    } catch (err) {
      console.warn('Template asset notice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Multiple subject images (picked or dropped)
  const addSubjects = async fileList => {
    const files = Array.from(fileList || []);
    const pictures = files.filter(isImageFile);
    if (files.length && pictures.length < files.length) toast.error('Some files were skipped because they are not images.');
    if (!pictures.length) return;
    // iPhone photos (HEIC) become JPEGs first: browsers other than Safari cannot show them
    const heic = pictures.filter(isHeicFile).length;
    if (heic) toast.info(`Converting ${heic === 1 ? 'an iPhone photo' : `${heic} iPhone photos`}…`);
    const { files: images, failed } = await toBrowserImages(pictures);
    if (failed.length) toast.error(failed.length === 1 ? `"${failed[0].name}": ${failed[0].reason}` : `${failed.length} iPhone photos could not be converted: ${failed[0].reason}`);
    if (!images.length) return;

    const newItems = images.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      label: ''
    }));
    setSubjectFiles(prev => [...prev, ...newItems]);
  };

  // Reorder subject image
  const moveSubject = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= subjectFiles.length) return;
    const updated = [...subjectFiles];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSubjectFiles(updated);
  };

  // Drag a tile by its grip to a new place (the arrows do the same for keyboard and touch)
  const dropSubject = to => {
    if (dragFrom !== null && to !== null && dragFrom !== to) {
      setSubjectFiles(prev => {
        const next = [...prev];
        const [moved] = next.splice(dragFrom, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    setDragFrom(null);
    setDragOverIndex(null);
  };

  // Remove subject image
  const removeSubject = index => {
    URL.revokeObjectURL(subjectFiles[index]?.preview);
    setSubjectFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Update subject label
  const updateSubjectLabel = (index, label) => {
    setSubjectFiles(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], label };
      return copy;
    });
  };

  // Bullet points
  const addBulletPoint = () => setBulletPoints(prev => [...prev, '']);
  const updateBulletPoint = (index, text) => {
    setBulletPoints(prev => {
      const copy = [...prev];
      copy[index] = text;
      return copy;
    });
  };
  const removeBulletPoint = index => setBulletPoints(prev => prev.filter((_, i) => i !== index));

  // What the engine is asked for: the same body for the real meme and for the preview
  const buildPayload = punchlineText => ({
    content: {
      topic,
      headline: headline.trim() || undefined,
      statement: statement.trim() || undefined,
      bulletPoints: bulletPoints.filter(b => b.trim().length > 0),
      reactionContext: reactionContext.trim() || undefined,
      punchline: punchlineText,
      itemLabels: subjectFiles.map(s => s.label.trim())
    },
    layout: {
      memeType,
      arrangement: 'auto'
    },
    design: {
      fontFamily,
      teluguFontFamily,
      primaryTextColor,
      secondaryTextColor,
      outlineColor,
      outlineThickness: Number(outlineThickness),
      fontSizeScale: Number(fontSizeScale),
      shadowBlur: Number(shadowBlur),
      canvasPreset,
      subjectFit,
      reactionFraming: framingToSend(framing) || undefined
    },
    subjectLabels: subjectFiles.map(s => s.label.trim())
  });

  // The live preview: drawn by the engine exactly as the meme will be, a moment after you stop changing things
  const previewReason = subjectFiles.length === 0 ? 'Add a subject image and your meme appears here, redrawn as you type.' : null;
  const preview = useManualPreview({
    enabled: !previewReason,
    subjectFiles,
    reactionFile,
    payload: buildPayload(punchline.trim() || PLACEHOLDER_PUNCHLINE)
  });

  // Several pictures at once from the clipboard (Ctrl+V) become subject images
  useEffect(() => {
    const onPaste = e => {
      const files = [...(e.clipboardData?.files || [])].filter(isImageFile);
      if (!files.length) return; // text pasted into a field is none of our business
      e.preventDefault();
      addSubjects(files);
      toast.success(files.length === 1 ? 'Pasted as a subject image.' : `Pasted ${files.length} subject images.`);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  // Submit & generate meme
  const handleGenerate = async () => {
    setError(null);

    // Validation
    if (!topic.trim() && !headline.trim() && !statement.trim()) {
      setError('Add a topic, a headline or a statement first.');
      return;
    }
    if (!punchline.trim()) {
      setError('Type your punchline first (Telugu or English).');
      return;
    }
    if (subjectFiles.length === 0) {
      setError('Add at least one subject image.');
      return;
    }
    if (!reactionFile) {
      setError('Add your reaction image.');
      return;
    }
    if (needsChoice) {
      setError('Your reaction picture has more than one frame. Choose which frame to use (under the reaction image) and try again.');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      // Append subject images
      subjectFiles.forEach(item => {
        formData.append('subjectImages', item.file);
      });

      // Append reaction image
      if (reactionFile && reactionFile.file) {
        formData.append('reactionImage', reactionFile.file);
        if (reactionFile.libraryId) markReactionUsed(reactionFile.libraryId);
      }

      formData.append('payload', JSON.stringify(buildPayload(punchline.trim())));

      const res = await apiFetch(`${API_BASE}/api/memes/upload-and-generate`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error (${res.status})`);
      }

      const memeRecord = await res.json();
      clearDraft(); // it is a meme now, not a draft
      onGenerated(memeRecord);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate meme. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const errorRef = useRef(null);
  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  useShortcuts([
    { keys: 'mod+enter', label: 'Generate meme', inFields: true, when: !loading, run: () => void press('create-generate') },
    // only where the preview is not already beside the form
    { keys: 'p', label: 'Show the preview', hidden: true, run: () => press('create-preview') }
  ]);

  const textDone = Boolean((topic || headline || statement) && punchline);

  return (
    <div className="pb-4">
      <PageHeader
        eyebrow="Studio · manual"
        title="Create a meme"
        description="Build a meme yourself from your own pictures and words. Would you rather the engine find the pictures? Use Viral Adaptation."
        actions={
          <Button as={Link} to="/" variant="secondary" rightIcon={<ArrowRight className="h-4 w-4" />}>
            Viral Adaptation
          </Button>
        }
      />

      {/* Samples */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-lg border border-dashed border-line-strong bg-surface/60 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Try a sample layout
        </span>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEMPLATES.map(tmpl => (
            <button
              key={tmpl.id}
              type="button"
              disabled={loading}
              onClick={() => handleLoadTemplate(tmpl)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold transition-all hover:border-ink hover:bg-marker-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {tmpl.name}
              <span className="text-[11px] font-normal text-muted">{tmpl.badge}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div ref={errorRef} className="mb-6">
          <Alert tone="bad" className="animate-slide-in">
            {error}
          </Alert>
        </div>
      )}

      {draftRestored && (
        <Alert
          tone="info"
          compact
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" onClick={startFresh}>
              Start fresh
            </Button>
          }
        >
          <strong className="font-bold">Your unfinished words are back.</strong> Pictures can&rsquo;t be kept by the browser, so add them again.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-5">
        {/* 1. Text */}
        <Step n={1} title="Words" hint="What the meme says. A topic, headline or statement is needed, plus a punchline." done={textDone}>
          <div className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Subject / topic" hint="Required unless you give a headline or statement.">
                {({ id }) => <Input id={id} value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Lord Vishnu facts / net worth comparison" />}
              </Field>
              <Field label="Top headline banner" optional hint="Shown in the yellow header bar.">
                {({ id }) => <Input id={id} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. OG CENSOR REPORT" className="font-semibold" />}
              </Field>
            </div>

            <Field label="Statement / news quote" optional hint="For Trending News memes.">
              {({ id }) => (
                <Textarea id={id} rows={2} value={statement} onChange={e => setStatement(e.target.value)} placeholder="e.g. CHIRANJEEVI GAVE UP REMUNERATION FOR BHOLA SHANKAR… - PRODUCER ANIL SUNKARA" />
              )}
            </Field>

            {/* Dynamic bullet points */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold">
                  Review bullet points <span className="ml-1 font-normal text-muted">optional · for movie updates</span>
                </span>
                <Button variant="ghost" size="sm" onClick={addBulletPoint} leftIcon={<Plus className="h-3.5 w-3.5" />}>
                  Add point
                </Button>
              </div>
              <div className="space-y-2">
                {bulletPoints.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-5 text-right font-mono text-[12px] font-semibold text-muted">{idx + 1}</span>
                    <Input value={pt} onChange={e => updateBulletPoint(idx, e.target.value)} placeholder={`Point ${idx + 1} (e.g. DECENT 1ST HALF)`} aria-label={`Bullet point ${idx + 1}`} className="!py-2" />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeBulletPoint(idx)} aria-label={`Remove point ${idx + 1}`}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Reaction tag" optional hint="A short caption on the reaction panel.">
                {({ id }) => <Input id={id} value={reactionContext} onChange={e => setReactionContext(e.target.value)} placeholder="e.g. * BOSS AND AKHIL or * THEATRE AUDIENCE" />}
              </Field>
              <Field
                label="Punchline"
                hint="Telugu or English. Used exactly as typed."
                right={<span className="tabular font-mono text-[12px] text-muted" aria-live="off">{punchline.length} chars</span>}
              >
                {({ id }) => (
                  <Textarea
                    id={id}
                    rows={2}
                    value={punchline}
                    onChange={e => setPunchline(e.target.value)}
                    placeholder="e.g. చిన్న పాజిటివ్ టాక్ వచ్చినా 500 CR కొట్టే దాకా ఆగదు!"
                    className="telugu-input font-semibold"
                  />
                )}
              </Field>
            </div>
          </div>
        </Step>

        {/* 2. Subject images */}
        <Step
          n={2}
          title={`Subject images${subjectFiles.length ? ` (${subjectFiles.length})` : ''}`}
          hint="Usually 3:4 or 2:3 portraits. Re-order them, and add a caption for each tile. Faces are kept in view when cropping, and nothing is stretched."
          done={subjectFiles.length > 0}
        >
          <label
            onDragEnter={e => {
              e.preventDefault();
              setDropOver(true);
            }}
            onDragOver={e => e.preventDefault()}
            onDragLeave={() => setDropOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDropOver(false);
              addSubjects(e.dataTransfer.files);
            }}
            className={cn(
              'group flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-all focus-within:ring-[3px] focus-within:ring-marker',
              dropOver ? 'scale-[1.01] border-ink bg-marker-soft' : 'border-line-strong bg-paper/50 hover:border-ink hover:bg-marker-soft/50'
            )}
          >
            <input
              type="file"
              multiple
              accept={ACCEPT_PICTURES}
              className="sr-only"
              onChange={e => {
                addSubjects(e.target.files);
                e.target.value = '';
              }}
            />
            <span className="grid h-12 w-12 place-items-center rounded-md border-2 border-ink bg-marker shadow-hard-sm transition-transform group-hover:-rotate-3" aria-hidden="true">
              <Upload className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{dropOver ? 'Drop them here' : subjectFiles.length ? 'Add more pictures' : 'Drop pictures here, or browse'}</span>
              <span className="mt-0.5 block text-[13px] text-muted">Select 1 to 4 or more photos: characters, movie scenes, collage items.</span>
            </span>
          </label>

          {subjectFiles.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-3">
              <div>
                <span className="text-[13px] font-semibold text-ink">Subject Framing & Fit:</span>
                <span className="ml-2 text-[12px] text-muted">
                  {subjectFit === 'contain'
                    ? 'Fit whole image (perfect for tweets, news screenshots & quotes — nothing cut off)'
                    : 'Fill & crop (standard for full-bleed photos and character portraits)'}
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-line-strong bg-paper p-0.5 text-[12px] font-medium shadow-xs">
                <button
                  type="button"
                  onClick={() => setSubjectFit('cover')}
                  className={cn(
                    'rounded-md px-3 py-1 transition-all',
                    subjectFit === 'cover' ? 'bg-ink font-semibold text-paper shadow-sm' : 'text-muted hover:text-ink'
                  )}
                >
                  Fill & Crop
                </button>
                <button
                  type="button"
                  onClick={() => setSubjectFit('contain')}
                  className={cn(
                    'rounded-md px-3 py-1 transition-all',
                    subjectFit === 'contain' ? 'bg-ink font-semibold text-paper shadow-sm' : 'text-muted hover:text-ink'
                  )}
                >
                  Fit Whole Image (No Crop)
                </button>
              </div>
            </div>
          )}

          {subjectFiles.length > 0 && (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {subjectFiles.map((item, idx) => (
                <li
                  key={item.id}
                  onDragOver={e => {
                    if (dragFrom === null) return;
                    e.preventDefault();
                    setDragOverIndex(idx);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    dropSubject(idx);
                  }}
                  className={cn(
                    'flex animate-pop flex-col overflow-hidden rounded-lg border bg-surface transition-[opacity,box-shadow,border-color]',
                    dragFrom === idx ? 'border-line-strong opacity-50' : 'border-line-strong',
                    dragFrom !== null && dragOverIndex === idx && dragFrom !== idx && 'border-ink shadow-hard-sm'
                  )}
                >
                  <div className="relative aspect-square bg-ink">
                    <img
                      src={item.preview}
                      alt={`Subject ${idx + 1}`}
                      className={cn('h-full w-full', subjectFit === 'contain' ? 'object-contain p-1.5' : 'object-cover')}
                    />
                    <Badge tone="ink" mono size="sm" className="absolute left-2 top-2">
                      Slot {idx + 1}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeSubject(idx)}
                      aria-label={`Remove subject ${idx + 1}`}
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded bg-surface/95 text-bad shadow transition-colors hover:bg-bad hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2.5 p-3">
                    <Input
                      value={item.label}
                      onChange={e => updateSubjectLabel(idx, e.target.value)}
                      placeholder="Caption (e.g. 7 GATES OF VAIKUNTAM)"
                      aria-label={`Caption for subject ${idx + 1}`}
                      className="!py-2 !text-[13px]"
                    />
                    <div className="flex items-center justify-between border-t border-line pt-2">
                      <span className="flex items-center gap-1 font-mono text-[11.5px] text-muted">
                        {subjectFiles.length > 1 && (
                          <span
                            draggable
                            onDragStart={e => {
                              setDragFrom(idx);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', String(idx));
                              const tile = e.currentTarget.closest('li');
                              if (tile) e.dataTransfer.setDragImage(tile, 24, 24);
                            }}
                            onDragEnd={() => {
                              setDragFrom(null);
                              setDragOverIndex(null);
                            }}
                            title="Drag to change the order"
                            aria-hidden="true"
                            className="-ml-1 grid h-7 w-6 cursor-grab place-items-center rounded text-muted hover:bg-ink/[0.07] hover:text-ink active:cursor-grabbing"
                          >
                            <GripVertical className="h-4 w-4" />
                          </span>
                        )}
                        Order {idx + 1}
                      </span>
                      <span className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" disabled={idx === 0} onClick={() => moveSubject(idx, -1)} aria-label="Move earlier">
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" disabled={idx === subjectFiles.length - 1} onClick={() => moveSubject(idx, 1)} aria-label="Move later">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Step>

        {/* 3. Reaction image */}
        <Step n={3} title="Reaction scene" hint="Usually a 16:9 cinematic scene. The height is set automatically and the actors' eyelines stay in view." done={Boolean(reactionFile)}>
          <ImageDrop
            value={reactionFile}
            onChange={setReactionFile}
            onReject={m => toast.error(m)}
            icon={Film}
            title="Drop your reaction image here, or browse"
            hint="A Telugu reaction face: e.g. Rao Ramesh, Suriya, Sunil, Srikanth, Brahmanandam."
            thumbClass="h-[72px] w-32"
            note="Goes in the bottom punchline section."
          />
          {reactionFile?.file && <ReactionFraming file={reactionFile.file} framing={framing} onFraming={setFraming} onNeedsChoice={setNeedsChoice} />}
          <ReactionPicker disabled={loading} onPick={({ file, image }) => setReactionFile({ ...makeImageItem(file), libraryId: image.imageId })} />
        </Step>

        {/* 4. Meme type */}
        <Step n={4} title="Meme type" hint="Decides how the pictures are arranged." done>
          <div role="radiogroup" aria-label="Meme type" className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
            {MEME_TYPES.map(type => {
              const active = memeType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMemeType(type.id)}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all duration-150',
                    active ? 'border-ink bg-marker-soft shadow-hard-sm' : 'border-line-strong bg-surface hover:border-ink'
                  )}
                >
                  <LayoutGlyph type={type.id} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold leading-tight">{type.title}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted">{type.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        {/* 5. Design */}
        <Step
          n={5}
          title="Style"
          hint={
            <>
              {settingsLoaded ? 'Starts from your ' : 'Defaults come from '}
              <Link to="/settings" className="font-semibold text-ink underline decoration-marker decoration-2 underline-offset-2 hover:decoration-ink">
                Settings
              </Link>
              . A change here applies to every text element of this meme only.
            </>
          }
          done
        >
          <div className="space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField label="English font" value={fontFamily} onChange={setFontFamily} options={fonts.english.map(f => ({ value: f, label: f }))} />
              <SelectField label="Telugu font" value={teluguFontFamily} onChange={setTeluguFontFamily} options={fonts.telugu.map(f => ({ value: f, label: f }))} />
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <ColorField label="Highlight colour" value={primaryTextColor} onChange={setPrimaryTextColor} />
              <ColorField label="Text colour" value={secondaryTextColor} onChange={setSecondaryTextColor} />
              <ColorField label="Outline colour" value={outlineColor} onChange={setOutlineColor} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField label="Outline thickness" value={outlineThickness} onChange={setOutlineThickness} spec={{ min: 0, max: 24, step: 1, unit: 'px' }} />
              <NumberField label="Font size scale" value={fontSizeScale} onChange={setFontSizeScale} spec={{ min: 0.6, max: 1.6, step: 0.05 }} format={v => `${v}×`} />
            </div>
            <Segmented
              label="Canvas size"
              value={canvasPreset}
              onChange={setCanvasPreset}
              options={[
                { value: 'portrait_4_5', label: '4:5', hint: '1080 × 1350' },
                { value: 'square_1_1', label: '1:1', hint: '1080 × 1080' },
                { value: 'story_9_16', label: '9:16', hint: '1080 × 1920' }
              ]}
            />
          </div>
        </Step>
      </div>

      {/* Large screens: the meme beside the form, following you down it */}
      <aside className="hidden lg:sticky lg:top-8 lg:block" aria-label="Preview">
        <LivePreview preview={preview} reason={previewReason} placeholderPunchline={!punchline.trim()} />
      </aside>
      </div>

      {/* Generate bar */}
      <div className="sticky bottom-[84px] z-30 mt-6 flex items-center justify-between gap-3 rounded-lg border-2 border-ink bg-surface p-3 shadow-hard sm:p-3.5 md:bottom-6">
        {/* the count is for roomy screens; on a phone the two buttons need the whole bar. An offline notice always shows. */}
        <p className={cn('min-w-0 text-[13px]', net.ok ? 'hidden text-muted sm:block' : 'font-semibold text-bad')}>
          {net.ok ? (
            <>
              <strong className="tabular font-mono text-ink">{subjectFiles.length}</strong> subject {subjectFiles.length === 1 ? 'image' : 'images'} + <strong className="tabular font-mono text-ink">{reactionFile ? 1 : 0}</strong> reaction image
            </>
          ) : (
            net.reason
          )}
        </p>
        <div className={cn('flex min-w-0 items-center gap-2', net.ok ? 'w-full sm:w-auto' : 'shrink-0')}>
          <Button variant="secondary" size="lg" className="shrink-0 lg:hidden" onClick={() => setPreviewOpen(true)} leftIcon={<Eye className="h-[18px] w-[18px]" />} aria-label="Show the preview" data-key-action="create-preview">
            Preview
          </Button>
          <Button variant="primary" size="lg" className="min-w-0 flex-1 sm:flex-none" loading={loading} disabled={!net.ok} onClick={handleGenerate} leftIcon={<Wand2 className="h-[18px] w-[18px]" />} data-key-action="create-generate" aria-keyshortcuts="Control+Enter Meta+Enter">
            {loading ? 'Making the meme…' : 'Generate meme'}
            {!loading && <KeyCaps keys="mod+enter" tone="marker" className="ml-1 hidden opacity-80 sm:inline-flex" />}
          </Button>
        </div>
      </div>

      {/* Phones: the same preview as a sheet */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} title="Preview" description="Your meme, drawn the way it will be made." size="md" bodyClassName="!p-0">
        <LivePreview preview={preview} reason={previewReason} placeholderPunchline={!punchline.trim()} className="!rounded-none !border-0 !shadow-none" />
      </Dialog>
    </div>
  );
}
