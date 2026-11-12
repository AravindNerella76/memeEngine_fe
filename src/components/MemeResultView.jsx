import React, { useState } from 'react';
import {
  Download,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Wand2,
  Sliders,
  ArrowLeft,
  History,
  GitBranch,
  AlertCircle,
  Eye,
  Maximize2,
  Layers,
  Ratio,
  X
} from 'lucide-react';

export default function MemeResultView({ meme, onNewMeme, onMemeUpdated }) {
  const [instructions, setInstructions] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [activeVersionNumber, setActiveVersionNumber] = useState(meme.currentVersion || 1);
  const [restoring, setRestoring] = useState(false);
  const [showCropComparison, setShowCropComparison] = useState(false);

  if (!meme) return null;

  const versions = meme.versions || [];
  const activeVersion = versions.find(v => v.versionNumber === activeVersionNumber) || {
    outputUrls: meme.outputUrls,
    design: meme.design,
    layout: meme.layout,
    instruction: 'Current Version'
  };

  const handleRegenerate = async () => {
    if (!instructions.trim()) {
      setError('Please provide an instruction (e.g. "Make headline 20% bigger" or "Change text colour to yellow")');
      return;
    }

    try {
      setRegenerating(true);
      setError(null);
      const res = await fetch(`http://localhost:3000/api/memes/${meme.memeId || meme.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: instructions.trim() })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Regeneration failed');
      }

      const updatedMeme = await res.json();
      setInstructions('');
      setActiveVersionNumber(updatedMeme.currentVersion);
      if (onMemeUpdated) onMemeUpdated(updatedMeme);
    } catch (err) {
      console.error('Regen error:', err);
      setError(err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleRestoreVersion = async (vNum) => {
    try {
      setRestoring(true);
      setError(null);
      const res = await fetch(`http://localhost:3000/api/memes/${meme.memeId || meme.id}/restore/${vNum}`, {
        method: 'POST'
      });
      if (!res.ok) {
        throw new Error('Failed to restore version');
      }
      const restored = await res.json();
      setActiveVersionNumber(restored.currentVersion);
      if (onMemeUpdated) onMemeUpdated(restored);
    } catch (err) {
      setError(err.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onNewMeme}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-all bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Create Meme
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            MongoDB Synced • Version {activeVersionNumber} of {versions.length || 1}
          </span>
          <span className="text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg">
            {activeVersion.design?.width || 1080} × {activeVersion.design?.height || 1350}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-3 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Version History Timeline Pills */}
      {versions.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Version Timeline ({versions.length} Revisions)
            </h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {versions.map((v) => (
              <button
                key={v.versionNumber}
                type="button"
                onClick={() => setActiveVersionNumber(v.versionNumber)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                  activeVersionNumber === v.versionNumber
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-400/20 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                <GitBranch className="w-3 h-3" />
                <span>v{v.versionNumber}</span>
                <span className="text-[10px] opacity-75 truncate max-w-[140px]">
                  {v.instruction}
                </span>
              </button>
            ))}
          </div>

          {activeVersionNumber !== meme.currentVersion && (
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-amber-300">
                Viewing historical snapshot of Version {activeVersionNumber}
              </span>
              <button
                onClick={() => handleRestoreVersion(activeVersionNumber)}
                disabled={restoring}
                className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg text-xs"
              >
                {restoring ? 'Restoring...' : `Restore v${activeVersionNumber} as Active`}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Meme Image Preview */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
          <div className="rounded-xl overflow-hidden border border-slate-800 bg-black w-full flex items-center justify-center">
            <img
              src={`http://localhost:3000${activeVersion.outputUrls?.png || activeVersion.outputUrls?.jpeg}`}
              alt="Generated Meme Result"
              className="w-full max-h-[720px] object-contain rounded-lg shadow-2xl"
            />
          </div>

          {/* Download Action Buttons */}
          <div className="flex items-center gap-3 w-full mt-4">
            <a
              href={`http://localhost:3000/api/memes/${meme.memeId || meme.id}/download/png?version=${activeVersionNumber}`}
              download={`kanyaraasi_${(meme.memeId || meme.id).substring(0, 8)}_v${activeVersionNumber}.png`}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-amber-400/10 transition-all"
            >
              <Download className="w-4 h-4" />
              Download PNG (v{activeVersionNumber})
            </a>

            <a
              href={`http://localhost:3000/api/memes/${meme.memeId || meme.id}/download/jpeg?version=${activeVersionNumber}`}
              download={`kanyaraasi_${(meme.memeId || meme.id).substring(0, 8)}_v${activeVersionNumber}.jpeg`}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all"
            >
              <Download className="w-4 h-4" />
              Download JPEG (v{activeVersionNumber})
            </a>
          </div>

          {/* Aspect Ratio & Intelligent Framing Details */}
          <div className="w-full mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Ratio className="w-3.5 h-3.5 text-amber-400" />
                Aspect Ratio & Intelligent Framing
              </span>
              <button
                type="button"
                onClick={() => setShowCropComparison(true)}
                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1 rounded-lg transition-all"
              >
                <Eye className="w-3 h-3" />
                View Crop Comparison
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Subject Assets</div>
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 3:4 / 2:3 Portrait
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">Rule of thirds face anchor (28%)</div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-0.5">Reaction Asset</div>
                <div className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 16:9 Landscape
                </div>
                <div className="text-slate-400 text-[10px] mt-0.5">Cinematic widescreen anchor (36%)</div>
              </div>
            </div>

            <div className="mt-2 text-center text-[10px] text-slate-400 flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Equal X/Y scaling guaranteed • Zero pixel stretch or distortion</span>
            </div>
          </div>
        </div>

        {/* Right Column: Regeneration & Specs */}
        <div className="lg:col-span-5 space-y-4">
          {/* Natural Language Regeneration Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              Natural Language Regeneration
            </h4>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Describe what should change. The engine mutates the parameter, preserves all other settings, and creates a new version automatically.
            </p>

            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder='e.g. "Make the headline 20% bigger", "Change headline colour to white", "Increase the reaction image height", "Use Anton font"'
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl p-3 text-xs text-white outline-none resize-none mb-3 placeholder-slate-500"
            />

            {/* Quick Instruction Helpers */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[
                'Make headline 20% bigger',
                'Change headline colour to white',
                'Change text colour to yellow',
                'Increase reaction image height',
                'Make outline thicker',
                'Use Intrepid font',
                'Use Anton font'
              ].map((pill, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInstructions(pill)}
                  className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-400 hover:text-amber-300 rounded-md border border-slate-800 transition-all"
                >
                  {pill}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={regenerating}
              onClick={handleRegenerate}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {regenerating ? 'Regenerating New Version...' : 'Regenerate as Version ' + ((meme.currentVersion || 1) + 1)}
            </button>
          </div>

          {/* Active Version Parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
              Active Version {activeVersionNumber} Parameters
            </h4>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Meme Type</span>
                <span className="text-white font-semibold font-mono uppercase">{activeVersion.layout?.memeType}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Font Size Scale</span>
                <span className="text-amber-300 font-mono font-bold">{activeVersion.design?.fontSizeScale}x</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">English Font</span>
                <span className="text-white font-mono">{activeVersion.design?.fontFamily}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Telugu Font</span>
                <span className="text-white font-mono">{activeVersion.design?.teluguFontFamily}</span>
              </div>

              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Colors</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: activeVersion.design?.primaryTextColor }} />
                  <span className="text-white font-mono">{activeVersion.design?.primaryTextColor}</span>
                  <span className="text-slate-500">/</span>
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: activeVersion.design?.secondaryTextColor }} />
                  <span className="text-white font-mono">{activeVersion.design?.secondaryTextColor}</span>
                </div>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-slate-400">Black Outline</span>
                <span className="text-white font-mono">{activeVersion.design?.outlineThickness}px</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onNewMeme}
              className="mt-4 w-full py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700"
            >
              Start New Meme
            </button>
          </div>
        </div>
      </div>

      {/* Before / After Cropping Comparison Modal */}
      {showCropComparison && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Ratio className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Intelligent Cropping & Zero-Distortion Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCropComparison(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Comparison showing the raw source input assets (Left: 3:4 portrait, 2:3 portrait, and 16:9 widescreen reaction) versus the final dynamically composed meme (Right).
                The engine dynamically computes section bounds, preserves natural aspect ratios, anchors portraits at the face eyeline (28-32%), anchors reactions at cinematic eyeline (36%), and enforces equal X and Y scaling for 0% distortion.
              </p>

              <div className="rounded-xl overflow-hidden border border-slate-800 bg-black">
                <img
                  src="/output/aspect-crop-comparison.png"
                  alt="Aspect Ratio Crop Comparison"
                  className="w-full object-contain"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="font-bold text-sky-400 block mb-1">1. Subject 1 (3:4 Portrait)</span>
                  <span className="text-slate-400 text-[11px]">AR = 0.75. Matches vertical Instagram slot. Zero crop on top face circle.</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="font-bold text-emerald-400 block mb-1">2. Subject 2 (2:3 Portrait)</span>
                  <span className="text-slate-400 text-[11px]">AR = 0.67. Anchored to upper 28% eyeline. Waist trimmed, face & circular markers 100% intact.</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <span className="font-bold text-amber-400 block mb-1">3. Reaction (16:9 Landscape)</span>
                  <span className="text-slate-400 text-[11px]">AR = 1.78. Dynamic cinematic height. Actor eyes perfectly centered at 36% rule.</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCropComparison(false)}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
