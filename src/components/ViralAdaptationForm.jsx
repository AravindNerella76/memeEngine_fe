import React, { useState } from 'react';
import {
  Wand2,
  Upload,
  Trash2,
  Sparkles,
  AlertCircle,
  FileImage,
  Layers,
  CheckCircle2,
  Loader2,
  Type,
  Eye,
  Info
} from 'lucide-react';

const VIRAL_SAMPLES = [
  {
    id: 'sample_movie',
    name: 'OG Movie Review (Side-by-Side)',
    refFile: '/output/phase2-movie-update.png',
    rxFile: '/output/phase1-reference-standard.png',
    refName: 'OG Censor Viral Post',
    punchline: 'ఇది నా సొంత పంచ్‌లైన్! ఏ మార్పు లేకుండా రావాలి!',
    reactionContext: '* థియేటర్ ఆడియన్స్ రెస్పాన్స్'
  },
  {
    id: 'sample_stacked',
    name: 'Crowd Comparison (Stacked Rows)',
    refFile: '/output/phase2-stacked-comparison.png',
    rxFile: '/output/phase2-stacked-comparison.png',
    refName: 'Vijay vs NTR Crowd Comparison',
    punchline: 'ఇది వేరే లెవెల్ క్రౌడ్ బ్రదర్! ఎవరూ మ్యాచ్ చేయలేరు!',
    reactionContext: '* ఫ్యాన్స్ రెస్పాన్స్'
  },
  {
    id: 'sample_facts',
    name: 'Facts Collage (2x2 Grid)',
    refFile: '/output/phase2-facts-collage.png',
    rxFile: '/output/phase2-facts-collage.png',
    refName: 'Lord Vishnu 7 Facts Viral',
    punchline: 'నంబర్ 7 తో ఇంకో స్పెషల్ ఉంది అది ఏంటో కామెంట్ చేయండి!',
    reactionContext: '* డివోటీస్ రియాక్షన్'
  }
];

const AVAILABLE_FONTS = [
  'Arial Black',
  'Anton',
  'Montserrat',
  'Oswald',
  'Bebas Neue',
  'Impact',
  'Intrepid'
];

export default function ViralAdaptationForm({ onGenerated }) {
  // Exactly 3 Core Inputs
  const [referenceFile, setReferenceFile] = useState(null); // { file, preview, name }
  const [reactionFile, setReactionFile] = useState(null);   // { file, preview, name }
  const [punchline, setPunchline] = useState('');

  // Optional Context & Preferences
  const [reactionContext, setReactionContext] = useState('');
  const [fontFamily, setFontFamily] = useState('Arial Black');

  // Loading & Progress States
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState(null);

  // Quick Sample Loader
  const handleLoadSample = async (sample) => {
    try {
      setError(null);
      setLoading(true);
      setProgressStep(1);

      // Load reference image as File
      const refRes = await fetch(sample.refFile);
      const refBlob = await refRes.blob();
      const refFileObj = new File([refBlob], `${sample.id}_ref.jpg`, { type: 'image/jpeg' });
      setReferenceFile({
        file: refFileObj,
        preview: URL.createObjectURL(refBlob),
        name: sample.refName
      });

      // Load reaction image as File
      const rxRes = await fetch(sample.rxFile);
      const rxBlob = await rxRes.blob();
      const rxFileObj = new File([rxBlob], `${sample.id}_rx.jpg`, { type: 'image/jpeg' });
      setReactionFile({
        file: rxFileObj,
        preview: URL.createObjectURL(rxBlob),
        name: 'My Reaction Scene'
      });

      // Set Punchline & Context
      setPunchline(sample.punchline);
      setReactionContext(sample.reactionContext || '');
    } catch (err) {
      console.error('Failed to load viral sample:', err);
      setError('Could not load sample files: ' + err.message);
    } finally {
      setLoading(false);
      setProgressStep(0);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e, target) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      const preview = URL.createObjectURL(file);
      if (target === 'reference') {
        setReferenceFile({ file, preview, name: file.name });
      } else if (target === 'reaction') {
        setReactionFile({ file, preview, name: file.name });
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!referenceFile?.file) {
      setError('Please provide Input 1: Viral Meme Reference Screenshot.');
      return;
    }
    if (!reactionFile?.file) {
      setError('Please provide Input 2: Meme Reacting Image.');
      return;
    }
    if (!punchline.trim()) {
      setError('Please provide Input 3: Reacting Image Text (Punchline).');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setProgressStep(1); // Uploading & AI Vision Analyzing

      const formData = new FormData();
      formData.append('referenceImage', referenceFile.file);
      formData.append('reactionImage', reactionFile.file);
      formData.append('punchline', punchline.trim());
      if (reactionContext.trim()) {
        formData.append('reactionContext', reactionContext.trim());
      }
      formData.append('fontFamily', fontFamily);

      // Simulated step progression for UX during AI vision processing (~15-20s)
      const timer1 = setTimeout(() => setProgressStep(2), 6000); // Subject Matching
      const timer2 = setTimeout(() => setProgressStep(3), 14000); // Canvas Engine Rendering

      const res = await fetch('http://localhost:3000/api/memes/adapt-viral', {
        method: 'POST',
        body: formData
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Adaptation failed with status ${res.status}`);
      }

      const generatedMeme = await res.json();
      setProgressStep(4);
      onGenerated(generatedMeme);
    } catch (err) {
      console.error('Viral adaptation error:', err);
      setError(err.message || 'Failed to adapt viral meme. Please check backend connection.');
    } finally {
      setLoading(false);
      setProgressStep(0);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Viral Meme Adaptation
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Provide only 3 inputs. The system understands the reference layout, searches the internet for verified high-resolution subject images, and renders your reaction meme automatically.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-full text-xs font-semibold">
              AI Vision Layout Detection
            </span>
            <span className="px-3 py-1 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-full text-xs font-semibold">
              Internet Image Discovery
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
              Deterministic Skia Canvas
            </span>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Quick Test Presets (1-Click Sample Loaders)
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Populates all 3 inputs for testing</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIRAL_SAMPLES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={loading}
              onClick={() => handleLoadSample(s)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Adaptation Issue</p>
            <p className="text-xs text-rose-200/90 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* INPUT 1: VIRAL MEME REFERENCE */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-base font-bold text-white">
                  Viral Meme Reference Screenshot
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 pl-8">
                Upload a screenshot of a viral meme from another Instagram page. Used purely as a visual structure reference (layout archetype, subject count, text placement).
              </p>
            </div>
            {referenceFile && (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                Reference Ready
              </span>
            )}
          </div>

          <div className="pl-8">
            {referenceFile ? (
              <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="w-24 h-28 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-slate-800">
                  <img
                    src={referenceFile.preview}
                    alt="Reference Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-semibold text-white truncate max-w-md">
                    {referenceFile.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Visual template for AI vision analysis
                  </p>
                  <div className="pt-2">
                    <label className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer">
                      Replace Reference Screenshot
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            setReferenceFile({
                              file,
                              preview: URL.createObjectURL(file),
                              name: file.name
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReferenceFile(null)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-all"
                  title="Remove reference"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label
                onDrop={(e) => handleDrop(e, 'reference')}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-800 hover:border-amber-400/60 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-slate-950 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-amber-400/20 text-slate-400 group-hover:text-amber-400 flex items-center justify-center transition-all">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-amber-300">
                    Drag and drop viral meme screenshot here, or browse
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supports JPG, PNG, WEBP from Instagram or screenshots
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];
                      setReferenceFile({
                        file,
                        preview: URL.createObjectURL(file),
                        name: file.name
                      });
                    }
                  }}
                />
              </label>
            )}
          </div>
        </section>

        {/* INPUT 2: MEME REACTING IMAGE */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-base font-bold text-white">
                  Meme Reacting Image
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 pl-8">
                Upload the image that must appear in the bottom reaction section. Used directly without modification or replacement.
              </p>
            </div>
            {reactionFile && (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                Reaction Image Ready
              </span>
            )}
          </div>

          <div className="pl-8">
            {reactionFile ? (
              <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl p-3">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-slate-800">
                  <img
                    src={reactionFile.preview}
                    alt="Reaction Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-xs font-semibold text-white truncate max-w-md">
                    {reactionFile.name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Typically 16:9 cinematic widescreen movie reaction scene
                  </p>
                  <div className="pt-2">
                    <label className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer">
                      Replace Reaction Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            const file = e.target.files[0];
                            setReactionFile({
                              file,
                              preview: URL.createObjectURL(file),
                              name: file.name
                            });
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReactionFile(null)}
                  className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-all"
                  title="Remove reaction image"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label
                onDrop={(e) => handleDrop(e, 'reaction')}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-800 hover:border-amber-400/60 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-950/40 hover:bg-slate-950 transition-all text-center group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-800 group-hover:bg-amber-400/20 text-slate-400 group-hover:text-amber-400 flex items-center justify-center transition-all">
                  <FileImage className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white group-hover:text-amber-300">
                    Drag and drop your movie reaction scene here, or browse
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Will be placed in the bottom reaction section
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      const file = e.target.files[0];
                      setReactionFile({
                        file,
                        preview: URL.createObjectURL(file),
                        name: file.name
                      });
                    }
                  }}
                />
              </label>
            )}
          </div>
        </section>

        {/* INPUT 3: REACTING IMAGE TEXT (PUNCHLINE) */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-base font-bold text-white">
                  Reacting Image Text (Telugu Punchline)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1 pl-8">
                Exact text to be rendered across the reaction scene in Ramabhadra Telugu font with thick black outline. Preserved verbatim — AI will never modify it.
              </p>
            </div>
            {punchline.trim() && (
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                Text Ready
              </span>
            )}
          </div>

          <div className="pl-8 space-y-4">
            <div>
              <textarea
                value={punchline}
                onChange={(e) => setPunchline(e.target.value)}
                placeholder="ఉదాహరణ: ఇది నా సొంత పంచ్‌లైన్! ఏ మార్పు లేకుండా రావాలి!"
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-400 leading-relaxed font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                <span className="flex items-center gap-1 text-amber-400/80">
                  <Info className="w-3.5 h-3.5" />
                  Rendered with 8px black text outline, drop shadow, and yellow/white contrast.
                </span>
                <span>{punchline.length} characters</span>
              </div>
            </div>

            {/* Optional Reaction Context / Tag */}
            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Optional Reaction Context / Tag
              </label>
              <input
                type="text"
                value={reactionContext}
                onChange={(e) => setReactionContext(e.target.value)}
                placeholder="e.g. * థియేటర్ ఆడియన్స్ రెస్పాన్స్ (Leave blank to use reference tag)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
              />
            </div>

            {/* Optional Typography Family */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-amber-400" />
                English Headline / Header Font
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_FONTS.map((font) => (
                  <button
                    key={font}
                    type="button"
                    onClick={() => setFontFamily(font)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      fontFamily === font
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {font}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Progress Display while processing */}
        {loading && (
          <div className="bg-slate-900 border border-amber-400/40 rounded-2xl p-6 space-y-4 shadow-xl shadow-amber-400/5">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
              <h4 className="text-sm font-bold text-white">
                Adapting Viral Meme...
              </h4>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <div className={`p-3 rounded-xl border transition-all ${
                progressStep >= 1
                  ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <span className="font-bold block mb-1">Step 1: AI Vision Analysis</span>
                <span>Extracting layout archetype, subjects, and text overlays</span>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                progressStep >= 2
                  ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <span className="font-bold block mb-1">Step 2: Internet Image Discovery</span>
                <span>Searching the web & verifying high-resolution subject photos</span>
              </div>

              <div className={`p-3 rounded-xl border transition-all ${
                progressStep >= 3
                  ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <span className="font-bold block mb-1">Step 3: Canvas Rendering</span>
                <span>Composing 1080×1350 canvas with Ramabhadra Telugu typography</span>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="submit"
            disabled={loading || !referenceFile || !reactionFile || !punchline.trim()}
            className="px-8 py-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all transform active:scale-95"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adapting Meme...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Adapt & Generate Meme
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

