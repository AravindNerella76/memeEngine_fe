import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { markReactionUsed } from '../lib/reactionLibrary';
import ReactionPicker from './reactions/ReactionPicker';
import { ArrowLeft, ArrowRight, Check, Film, Plus, Sparkles, Trash2, Upload, Wand2, X } from 'lucide-react';
import { SAMPLE_TEMPLATES } from './SampleTemplates';
import { API_BASE, apiFetch } from '../api';
import { cachedJSON } from '../lib/queryCache';
import { ColorField, NumberField, Segmented, SelectField } from './settings/controls';
import { Alert, Badge, Button, Card, Field, ImageDrop, Input, PageHeader, Textarea, cn, isImageFile, makeImageItem, useDocumentTitle, useImageSlot, useAvailability, useToast } from '../ui';

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

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Installed fonts and the saved Settings (the design fields below start from them)
  const [fonts, setFonts] = useState({
    english: ['Arial Black', 'Anton', 'Impact', 'Intrepid ExtraBold', 'Intrepid'],
    telugu: ['Ramabhadra', 'Mandali', 'Noto Sans Telugu']
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
  const addSubjects = fileList => {
    const files = Array.from(fileList || []);
    const images = files.filter(isImageFile);
    if (files.length && images.length < files.length) toast.error('Some files were skipped because they are not images.');
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

  // Submit & generate meme
  const handleGenerate = async () => {
    setError(null);

    // Validation
    if (!topic && !headline && !statement) {
      setError('Please provide at least a topic, headline, or statement');
      return;
    }
    if (!punchline) {
      setError('Please enter a Telugu punchline (or English text) for the reaction section');
      return;
    }
    if (subjectFiles.length === 0) {
      setError('Please upload at least 1 subject image');
      return;
    }
    if (!reactionFile) {
      setError('Please upload a reaction / punchline movie image');
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

      const payload = {
        content: {
          topic,
          headline: headline.trim() || undefined,
          statement: statement.trim() || undefined,
          bulletPoints: bulletPoints.filter(b => b.trim().length > 0),
          reactionContext: reactionContext.trim() || undefined,
          punchline: punchline.trim(),
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
          canvasPreset
        },
        subjectLabels: subjectFiles.map(s => s.label.trim())
      };

      formData.append('payload', JSON.stringify(payload));

      const res = await apiFetch(`${API_BASE}/api/memes/upload-and-generate`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error (${res.status})`);
      }

      const memeRecord = await res.json();
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

      <div className="space-y-5">
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
              <Field label="Punchline" hint="Telugu or English. Used exactly as typed.">
                {({ id }) => <Input id={id} value={punchline} onChange={e => setPunchline(e.target.value)} placeholder="e.g. చిన్న పాజిటివ్ టాక్ వచ్చినా 500 CR కొట్టే దాకా ఆగదు!" className="telugu-input font-semibold" />}
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
              accept="image/*"
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
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {subjectFiles.map((item, idx) => (
                <li key={item.id} className="flex animate-pop flex-col overflow-hidden rounded-lg border border-line-strong bg-surface">
                  <div className="relative aspect-square bg-ink">
                    <img src={item.preview} alt={`Subject ${idx + 1}`} className="h-full w-full object-cover" />
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
                      <span className="font-mono text-[11.5px] text-muted">Order {idx + 1}</span>
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

      {/* Generate bar */}
      <div className="sticky bottom-[84px] z-30 mt-6 flex items-center justify-between gap-4 rounded-lg border-2 border-ink bg-surface p-3.5 shadow-hard md:bottom-6">
        <p className={cn('text-[13px]', net.ok ? 'text-muted' : 'font-semibold text-bad')}>
          {net.ok ? (
            <>
              <strong className="tabular font-mono text-ink">{subjectFiles.length}</strong> subject {subjectFiles.length === 1 ? 'image' : 'images'} + <strong className="tabular font-mono text-ink">{reactionFile ? 1 : 0}</strong> reaction image
            </>
          ) : (
            net.reason
          )}
        </p>
        <Button variant="primary" size="lg" loading={loading} disabled={!net.ok} onClick={handleGenerate} leftIcon={<Wand2 className="h-[18px] w-[18px]" />}>
          {loading ? 'Making the meme…' : 'Generate meme'}
        </Button>
      </div>
    </div>
  );
}
