import React, { useState } from 'react';
import {
  Wand2,
  Upload,
  Trash2,
  MoveLeft,
  MoveRight,
  Plus,
  X,
  Type,
  Palette,
  Sliders,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { SAMPLE_TEMPLATES } from './SampleTemplates';

export default function CreateMemeForm({ onGenerated }) {
  // Meme Information
  const [topic, setTopic] = useState('');
  const [headline, setHeadline] = useState('');
  const [statement, setStatement] = useState('');
  const [bulletPoints, setBulletPoints] = useState([]);
  const [reactionContext, setReactionContext] = useState('');
  const [punchline, setPunchline] = useState('');

  // Assets
  const [subjectFiles, setSubjectFiles] = useState([]); // [{ id, file, preview, label }]
  const [reactionFile, setReactionFile] = useState(null); // { file, preview }

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

  // Quick Demo Template Loader
  const handleLoadTemplate = async (template) => {
    setTopic(template.topic || '');
    setHeadline(template.headline || '');
    setStatement(template.statement || '');
    setBulletPoints(template.bulletPoints || []);
    setReactionContext(template.reactionContext || '');
    setPunchline(template.punchline || '');
    setMemeType(template.memeType);

    // Fetch sample assets from backend and convert to File objects
    try {
      setLoading(true);
      setError(null);
      const newSubjectFiles = [];

      for (let i = 0; i < template.sampleAssets.subjects.length; i++) {
        const assetName = template.sampleAssets.subjects[i];
        const res = await fetch(`/output/${template.id === 'facts_collage' ? 'phase2-facts-collage.png' : 'phase1-reference-standard.png'}`);
        // We can fetch from test-assets or public assets
        const fileRes = await fetch(`/output/${template.id === 'facts_collage' ? 'phase2-facts-collage.png' : 'phase1-reference-standard.png'}`);
        const blob = await fileRes.blob();
        const file = new File([blob], assetName, { type: 'image/jpeg' });
        newSubjectFiles.push({
          id: String(Date.now() + i),
          file,
          preview: URL.createObjectURL(blob),
          label: template.labels[i] || ''
        });
      }
      setSubjectFiles(newSubjectFiles);

      // Reaction
      const rxRes = await fetch(`/output/phase1-reference-standard.png`);
      const rxBlob = await rxRes.blob();
      setReactionFile({
        file: new File([rxBlob], template.sampleAssets.reaction, { type: 'image/jpeg' }),
        preview: URL.createObjectURL(rxBlob)
      });
    } catch (err) {
      console.warn('Template asset notice:', err);
    } finally {
      setLoading(false);
    }
  };

  // Multiple Subject Images Upload
  const handleSubjectUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newItems = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      label: ''
    }));

    setSubjectFiles(prev => [...prev, ...newItems]);
    e.target.value = null;
  };

  // Reorder Subject Image
  const moveSubject = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= subjectFiles.length) return;
    const updated = [...subjectFiles];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSubjectFiles(updated);
  };

  // Remove Subject Image
  const removeSubject = (index) => {
    setSubjectFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Update Subject Label
  const updateSubjectLabel = (index, label) => {
    setSubjectFiles(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], label };
      return copy;
    });
  };

  // Reaction Image Upload
  const handleReactionUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReactionFile({
      file,
      preview: URL.createObjectURL(file)
    });
    e.target.value = null;
  };

  // Add Bullet Point
  const addBulletPoint = () => {
    setBulletPoints(prev => [...prev, '']);
  };

  const updateBulletPoint = (index, text) => {
    setBulletPoints(prev => {
      const copy = [...prev];
      copy[index] = text;
      return copy;
    });
  };

  const removeBulletPoint = (index) => {
    setBulletPoints(prev => prev.filter((_, i) => i !== index));
  };

  // Submit & Generate Meme
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

      // Append Subject Images
      subjectFiles.forEach((item) => {
        formData.append('subjectImages', item.file);
      });

      // Append Reaction Image
      if (reactionFile && reactionFile.file) {
        formData.append('reactionImage', reactionFile.file);
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

      const res = await fetch('http://localhost:3000/api/memes/upload-and-generate', {
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Quick Demo Template Chips */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Quick Presets (1-Click Test All 5 Samples)
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleLoadTemplate(tmpl)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <span>{tmpl.name}</span>
              <span className="text-[10px] opacity-70">({tmpl.badge})</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Meme Information */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Type className="w-5 h-5 text-amber-400" />
          1. Meme Information & Texts
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Subject / Topic <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Lord Vishnu Facts / Net Worth Comparison"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Top Headline Banner (Optional)
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. OG CENSOR REPORT"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white outline-none font-semibold"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Statement / News Quote (For Trending News memes)
          </label>
          <textarea
            rows={2}
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="e.g. CHIRANJEEVI GAVE UP REMUNERATION FOR BHOLA SHANKAR... - PRODUCER ANIL SUNKARA"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
          />
        </div>

        {/* Dynamic Bullet Points */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-400">
              Review Bullet Points (For Movie Updates)
            </label>
            <button
              type="button"
              onClick={addBulletPoint}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Point
            </button>
          </div>
          {bulletPoints.map((pt, idx) => (
            <div key={idx} className="flex items-center gap-2 mb-2">
              <span className="text-xs text-amber-400 font-mono w-4">{idx + 1}.</span>
              <input
                type="text"
                value={pt}
                onChange={(e) => updateBulletPoint(idx, e.target.value)}
                placeholder={`Point ${idx + 1} (e.g. DECENT 1ST HALF)`}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-1.5 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => removeBulletPoint(idx)}
                className="text-slate-500 hover:text-rose-400 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-amber-300 mb-1">
              Reaction Context Tag (Optional)
            </label>
            <input
              type="text"
              value={reactionContext}
              onChange={(e) => setReactionContext(e.target.value)}
              placeholder="e.g. * BOSS AND AKHIL or * THEATRE AUDIENCE"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-amber-300 mb-1">
              Telugu Punchline <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={punchline}
              onChange={(e) => setPunchline(e.target.value)}
              placeholder="e.g. చిన్న పాజిటివ్ టాక్ వచ్చినా 500 CR కొట్టే దాకా ఆగదు!"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white outline-none font-semibold"
            />
          </div>
        </div>
      </section>

      {/* 2. Subject Images Dropzone */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-400" />
              2. Subject Images ({subjectFiles.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Typically 3:4 or 2:3 portrait photos. Re-order and set captions. The engine uses intelligent face anchoring (upper 28%) with 0% distortion.
            </p>
          </div>

          <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl cursor-pointer border border-slate-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Upload Images
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleSubjectUpload}
              className="hidden"
            />
          </label>
        </div>

        {subjectFiles.length === 0 ? (
          <div className="border-2 border-dashed border-slate-800 rounded-2xl p-8 text-center bg-slate-950/40">
            <Upload className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300 mb-1">No subject images uploaded yet</p>
            <p className="text-xs text-slate-500">
              Select 1 to 4+ photos (characters, movie scenes, politicians, or collage items)
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {subjectFiles.map((item, idx) => (
              <div
                key={item.id}
                className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="relative aspect-square bg-black flex items-center justify-center overflow-hidden">
                  <img
                    src={item.preview}
                    alt={`Subject ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-2 left-2 bg-slate-900/90 text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded font-bold border border-slate-700">
                    Slot {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubject(idx)}
                    className="absolute top-2 right-2 p-1.5 bg-rose-500/80 hover:bg-rose-500 text-white rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateSubjectLabel(idx, e.target.value)}
                    placeholder="Tile Caption / Stat (e.g. 7 GATES OF VAIKUNTAM)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-800/80">
                    <span className="text-[11px] font-mono">Order: {idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSubject(idx, -1)}
                        className="p-1 hover:text-white disabled:opacity-30"
                      >
                        <MoveLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === subjectFiles.length - 1}
                        onClick={() => moveSubject(idx, 1)}
                        className="p-1 hover:text-white disabled:opacity-30"
                      >
                        <MoveRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Reaction Image */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            3. Reaction / Punchline Movie Scene
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Typically 16:9 cinematic widescreen movie scenes. The engine dynamically sets height and anchors actor eyelines (upper 36%).
          </p>
        </div>

        {reactionFile ? (
          <div className="flex items-center gap-4 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-black flex-shrink-0">
              <img
                src={reactionFile.preview}
                alt="Reaction Preview"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-white mb-1">
                {reactionFile.file?.name || 'Reaction Scene Loaded'}
              </p>
              <p className="text-[11px] text-emerald-400 mb-2">Ready for bottom punchline section</p>
              <label className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer">
                Replace Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleReactionUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <label className="border-2 border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/40 hover:border-slate-700 transition-all">
            <Upload className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-semibold text-slate-300">Upload Reaction Image</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Telugu reaction image (e.g. Rao Ramesh, Suriya, Sunil, Srikanth, Brahmanandam)
            </p>
            <input
              type="file"
              accept="image/*"
              onChange={handleReactionUpload}
              className="hidden"
            />
          </label>
        )}
      </section>

      {/* 4. Meme Type */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          4. Meme Type & Layout Rules
        </h3>

        <div className="grid md:grid-cols-5 gap-3">
          {[
            { id: 'facts_collage', title: 'Facts / Collage', desc: 'Grid arrangement with individual cell labels' },
            { id: 'comparison', title: 'Comparison', desc: 'Side-by-side columns or stacked rows' },
            { id: 'trending_news', title: 'Trending News', desc: 'Hero image + statement overlay' },
            { id: 'movie_update', title: 'Movie Review / Censor', desc: 'Seamless poster collage + review bullet points' },
            { id: 'custom', title: 'Custom Meme', desc: 'Dynamic split based on materials' }
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setMemeType(type.id)}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                memeType === type.id
                  ? 'bg-slate-800 border-amber-400 ring-1 ring-amber-400/50 shadow-lg shadow-amber-400/10'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <p className="text-xs font-bold text-white mb-1">{type.title}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{type.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* 5. Design Specifications */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-400" />
          5. Design Specifications
        </h3>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">English Font</label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            >
              <option value="Arial Black">Arial Black (Bold Meme)</option>
              <option value="Intrepid ExtraBold">Intrepid ExtraBold (Classic Meme)</option>
              <option value="Anton">Anton (Clean Impact)</option>
              <option value="Impact">Impact (Classic)</option>
              <option value="Montserrat">Montserrat (Modern)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Telugu Font</label>
            <select
              value={teluguFontFamily}
              onChange={(e) => setTeluguFontFamily(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-400"
            >
              <option value="Ramabhadra">Ramabhadra (Bold Display)</option>
              <option value="Mandali">Mandali (Rounded Clean)</option>
              <option value="Noto Sans Telugu">Noto Sans Telugu</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Primary Color (Highlights)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primaryTextColor}
                onChange={(e) => setPrimaryTextColor(e.target.value)}
                className="w-8 h-8 rounded border border-slate-800 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={primaryTextColor}
                onChange={(e) => setPrimaryTextColor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Secondary Color (Text)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondaryTextColor}
                onChange={(e) => setSecondaryTextColor(e.target.value)}
                className="w-8 h-8 rounded border border-slate-800 cursor-pointer bg-transparent"
              />
              <input
                type="text"
                value={secondaryTextColor}
                onChange={(e) => setSecondaryTextColor(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1 font-semibold">
              <span>Outline Thickness</span>
              <span className="text-amber-300 font-mono">{outlineThickness}px</span>
            </div>
            <input
              type="range"
              min="4"
              max="12"
              value={outlineThickness}
              onChange={(e) => setOutlineThickness(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1 font-semibold">
              <span>Font Size Scale</span>
              <span className="text-amber-300 font-mono">{fontSizeScale}x</span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={fontSizeScale}
              onChange={(e) => setFontSizeScale(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Canvas Size</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCanvasPreset('portrait_4_5')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                  canvasPreset === 'portrait_4_5'
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                1080 × 1350 (4:5)
              </button>
              <button
                type="button"
                onClick={() => setCanvasPreset('square_1_1')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                  canvasPreset === 'square_1_1'
                    ? 'bg-amber-400 text-slate-950 border-amber-400'
                    : 'bg-slate-950 text-slate-400 border-slate-800'
                }`}
              >
                1080 × 1080 (1:1)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Generate Button Bar */}
      <div className="sticky bottom-6 z-40 bg-slate-900/95 backdrop-blur border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-2xl">
        <div className="text-xs text-slate-400">
          <span className="text-white font-semibold">{subjectFiles.length} Subject Images</span> +{' '}
          <span className="text-white font-semibold">{reactionFile ? '1' : '0'} Reaction Image</span>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGenerate}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg shadow-amber-400/20 transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Generating Automated Meme...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4" />
              <span>Generate Meme</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

