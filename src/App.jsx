import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Image as ImageIcon,
  History,
  Wand2,
  CheckCircle2,
  Download,
  Eye,
  Sliders,
  Type,
  Maximize2,
  FileText
} from 'lucide-react';
import CreateMemeForm from './components/CreateMemeForm';
import ViralAdaptationForm from './components/ViralAdaptationForm';
import MemeResultView from './components/MemeResultView';
import MyMemesGallery from './components/MyMemesGallery';

const REFERENCE_FORMATS = [
  {
    id: 'facts_collage',
    name: '1. Facts / Information Collage',
    badge: '4 Grid Cells + Telugu Punchline',
    image: '/output/phase2-facts-collage.png',
    desc: 'Top header bar + 2x2 grid of 4 subject images with individual subcaptions + bottom reaction panel with Telugu punchline (Ramabhadra font).',
    specs: {
      type: 'facts_collage',
      arrangement: 'grid_2x2',
      subjects: 4,
      font: 'Arial Black + Ramabhadra',
      header: '7 ALWAYS BEEN A SPECIAL NUMBER FOR LORD VISHNU',
      punchline: 'నంబర్ 7 తో ఇంకో స్పెషల్ ఉంది అది ఏంటో కామెంట్ చేయండి!'
    }
  },
  {
    id: 'comparison',
    name: '2. Comparison Meme (3 Columns)',
    badge: '3 Equal Vertical Columns',
    image: '/output/phase2-comparison-columns.png',
    desc: 'Top header bar + 3 side-by-side vertical columns (931 Crores / 30 Crores / 15 Lakhs) with dual-color badges + reaction scene with punchline.',
    specs: {
      type: 'comparison',
      arrangement: 'columns_3',
      subjects: 3,
      font: 'Arial Black + Ramabhadra',
      header: 'NET WORTH OF CHIEF MINISTERS OF INDIA',
      punchline: 'మీ అంత పూరెస్ట్ చీఫ్ మినిస్టర్ ని చూడలేదు మేడం!'
    }
  },
  {
    id: 'trending_news',
    name: '3. Trending News Meme',
    badge: 'Side-by-Side News + Quote',
    image: '/output/phase2-trending-news.png',
    desc: '2 side-by-side hero images + full quote/statement overlay across subjects with yellow attribution + reaction scene with tag and punchline.',
    specs: {
      type: 'trending_news',
      arrangement: 'side_by_side',
      subjects: 2,
      font: 'Arial Black + Ramabhadra',
      statement: 'CHIRANJEEVI GAVE UP REMUNERATION FOR BHOLA SHANKAR AND AKHIL FOR AGENT... - PRODUCER ANIL SUNKARA',
      punchline: 'ఎక్కేసారు అయ్యా ఒక మెట్టు ఎక్కేసారు'
    }
  },
  {
    id: 'movie_update',
    name: '4. Movie / Celebrity Update',
    badge: 'Review Points Overlay',
    image: '/output/phase2-movie-update.png',
    desc: 'Header banner + 2 poster panels + 4 alternating yellow/white review bullet points + reaction scene with audience tag and punchline.',
    specs: {
      type: 'movie_update',
      arrangement: 'side_by_side',
      subjects: 2,
      font: 'Arial Black + Ramabhadra',
      header: 'OG CENSOR REPORT',
      punchline: 'చిన్న పాజిటివ్ టాక్ వచ్చినా 500 CR కొట్టే దాకా ఆగదు!'
    }
  },
  {
    id: 'stacked_comparison',
    name: '5. Stacked Rows Comparison',
    badge: 'Horizontal Stacked Rows',
    image: '/output/phase2-stacked-comparison.png',
    desc: '2 horizontal stacked rows for crowd size comparison (Thalapathy at 50 / NTR at 19) + bottom reaction panel with multi-line Telugu punchline.',
    specs: {
      type: 'comparison',
      arrangement: 'stacked_rows',
      subjects: 2,
      font: 'Arial Black + Ramabhadra',
      punchline: 'మీరు ఒప్పుకున్నా ఒప్పుకోకపోయినా 19 ఇయర్స్ కే ఈ రేంజ్ ఫ్యాన్స్ ఇండియా లో ఏ హీరో కి లేరు'
    }
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('create');
  const [currentMeme, setCurrentMeme] = useState(null);
  const [selectedReference, setSelectedReference] = useState(REFERENCE_FORMATS[0]);
  const [showJson, setShowJson] = useState(false);

  const handleGenerated = (meme) => {
    setCurrentMeme(meme);
    setActiveTab('create');
  };

  const handleSelectFromGallery = (meme) => {
    setCurrentMeme(meme);
    setActiveTab('create');
  };

  const handleRegenerate = async (instructions) => {
    if (!currentMeme) return;
    try {
      // Send regeneration request with adjusted instructions
      const updatedDesign = {
        ...currentMeme.design,
        customInstructions: instructions
      };

      const res = await fetch('http://localhost:3000/api/memes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: currentMeme.content,
          assets: currentMeme.assets,
          design: updatedDesign,
          layout: currentMeme.layout
        })
      });

      if (!res.ok) throw new Error('Regeneration failed');
      const newMeme = await res.json();
      setCurrentMeme(newMeme);
    } catch (err) {
      alert('Regeneration error: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-yellow-300 via-amber-200 to-white bg-clip-text text-transparent">
                Telugu Meme Engine
              </h1>
              <p className="text-xs text-slate-400 font-mono">@kanyaraasi_memes • Automated Studio</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('create');
                setCurrentMeme(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              Create Meme
            </button>

            <button
              onClick={() => {
                setActiveTab('viral');
                setCurrentMeme(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'viral'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Viral Adaptation
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <History className="w-4 h-4" />
              My Memes
            </button>

            <button
              onClick={() => setActiveTab('reference')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'reference'
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Reference Standards
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* TAB 1: CREATE MEME / RESULT VIEW */}
        {activeTab === 'create' && (
          <div>
            {currentMeme ? (
              <MemeResultView
                meme={currentMeme}
                onNewMeme={() => setCurrentMeme(null)}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <CreateMemeForm onGenerated={handleGenerated} />
            )}
          </div>
        )}

        {/* TAB 2: VIRAL MEME ADAPTATION */}
        {activeTab === 'viral' && (
          <div>
            {currentMeme ? (
              <MemeResultView
                meme={currentMeme}
                onNewMeme={() => setCurrentMeme(null)}
                onRegenerate={handleRegenerate}
              />
            ) : (
              <ViralAdaptationForm onGenerated={handleGenerated} />
            )}
          </div>
        )}

        {/* TAB 3: MY MEMES GALLERY */}
        {activeTab === 'history' && (
          <MyMemesGallery onSelectMeme={handleSelectFromGallery} />
        )}

        {/* TAB 4: REFERENCE STANDARDS */}
        {activeTab === 'reference' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">
                    Visual Benchmark
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Five Visual Reference Standards (@kanyaraasi_memes)
                  </h2>
                </div>
                <div className="text-xs text-slate-400 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  Target Resolution: 1080 × 1350 (4:5)
                </div>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                Every layout is verified against the 5 real sample memes. The engine dynamically calculates positions and crops while preserving Telugu Unicode typography and contrast.
              </p>
            </div>

            {/* Reference Selector Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {REFERENCE_FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedReference(f)}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    selectedReference.id === f.id
                      ? 'bg-slate-800 border-amber-400/80 shadow-lg shadow-amber-400/10 ring-1 ring-amber-400/50'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold text-white mb-1 truncate">{f.name}</p>
                  <span className="inline-block text-[10px] font-semibold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded">
                    {f.badge}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">{selectedReference.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedReference.desc}</p>
                  </div>
                  <a
                    href={selectedReference.image}
                    download={`${selectedReference.id}.png`}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-sm transition-all"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </a>
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-800 bg-black flex items-center justify-center p-2">
                  <img
                    src={selectedReference.image}
                    alt={selectedReference.name}
                    className="w-full max-h-[720px] object-contain rounded-lg"
                  />
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Separated Architectural Breakdown
                  </h4>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-amber-400 font-mono font-semibold block mb-1">1. CONTENT</span>
                      <p className="text-slate-300">
                        <strong className="text-slate-400">Headline/Topic:</strong> {selectedReference.specs.header || selectedReference.specs.statement?.slice(0, 45) + '...'}
                      </p>
                      <p className="text-slate-300 mt-1">
                        <strong className="text-slate-400">Telugu Punchline:</strong> {selectedReference.specs.punchline}
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-amber-400 font-mono font-semibold block mb-1">2. ASSET MAPPING</span>
                      <p className="text-slate-300">
                        <strong className="text-slate-400">Subjects:</strong> {selectedReference.specs.subjects} images with explicit section roles
                      </p>
                      <p className="text-slate-300 mt-1">
                        <strong className="text-slate-400">Reaction Image:</strong> 1 dedicated movie reaction scene
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-amber-400 font-mono font-semibold block mb-1">3. DESIGN SPECIFICATIONS</span>
                      <p className="text-slate-300">
                        <strong className="text-slate-400">Fonts:</strong> {selectedReference.specs.font}
                      </p>
                      <p className="text-slate-300 mt-1">
                        <strong className="text-slate-400">Colors:</strong> #FFE500 (Yellow), #FFFFFF, Black stroke (7-8px)
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <span className="text-amber-400 font-mono font-semibold block mb-1">4. DYNAMIC LAYOUT</span>
                      <p className="text-slate-300">
                        <strong className="text-slate-400">Arrangement:</strong> {selectedReference.specs.arrangement}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowJson(!showJson)}
                    className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {showJson ? 'Hide API Payload' : 'View API Payload'}
                  </button>

                  {showJson && (
                    <pre className="mt-3 p-3 bg-black/80 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-60">
                      {JSON.stringify(selectedReference.specs, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
