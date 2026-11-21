import React, { useState } from 'react';
import { Check, Copy, Download, FileText } from 'lucide-react';
import { Badge, Button, Card, CardHeader, PageHeader, cn, useDocumentTitle } from '../ui';

export const REFERENCE_FORMATS = [
  {
    id: 'facts_collage',
    name: '1. Facts / Information Collage',
    short: 'Facts collage',
    badge: '4 Grid Cells + Telugu Punchline',
    image: '/samples/phase2-facts-collage.png',
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
    short: 'Comparison',
    badge: '3 Equal Vertical Columns',
    image: '/samples/phase2-comparison-columns.png',
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
    short: 'Trending news',
    badge: 'Side-by-Side News + Quote',
    image: '/samples/phase2-trending-news.png',
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
    short: 'Movie update',
    badge: 'Review Points Overlay',
    image: '/samples/phase2-movie-update.png',
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
    short: 'Stacked rows',
    badge: 'Horizontal Stacked Rows',
    image: '/samples/phase2-stacked-comparison.png',
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

function SpecBlock({ n, title, children }) {
  return (
    <div className="rounded-md border border-line bg-paper/60 p-4">
      <p className="mb-2 flex items-center gap-2 font-mono text-micro uppercase text-muted">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] font-semibold text-paper">{n}</span>
        {title}
      </p>
      <div className="space-y-1.5 text-[13.5px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

const Key = ({ children }) => <span className="font-medium text-muted">{children} </span>;

export default function StyleGuideView() {
  useDocumentTitle('Style Guide');
  const [selectedReference, setSelectedReference] = useState(REFERENCE_FORMATS[0]);
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const json = JSON.stringify(selectedReference.specs, null, 2);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Style guide"
        description="The five @kanyaraasi_memes layouts the engine is built and checked against: fonts, colours, outlines, and where each image and text block goes."
        actions={
          <Badge tone="outline" mono>
            Canvas 1080 × 1350 · 4:5
          </Badge>
        }
      />

      {/* Layout selector: the layouts themselves, not their names */}
      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="House-style layouts">
        {REFERENCE_FORMATS.map(f => {
          const active = selectedReference.id === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelectedReference(f)}
              className={cn(
                'group overflow-hidden rounded-lg border-2 bg-surface text-left transition-all duration-200',
                active ? 'border-ink shadow-hard' : 'border-line hover:-translate-y-0.5 hover:border-ink'
              )}
            >
              <span className="relative block aspect-[4/5] overflow-hidden bg-ink">
                <img src={f.image} alt="" loading="lazy" className={cn('h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]', !active && 'opacity-90')} />
                {active && (
                  <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-marker">
                    <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="block p-3">
                <span className="block text-[14px] font-bold leading-tight">{f.short}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted">{f.badge}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card tone="stage" pad="md" className="!p-4 sm:!p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap">
            <div className="min-w-0">
              <h2 className="text-[19px] font-bold text-white">{selectedReference.name}</h2>
              <p className="mt-1 max-w-prose text-[13px] leading-relaxed text-paper/65">{selectedReference.desc}</p>
            </div>
            <Button as="a" variant="marker-on-ink" size="sm" href={selectedReference.image} download={`${selectedReference.id}.png`} leftIcon={<Download className="h-4 w-4" />} className="shrink-0">
              PNG
            </Button>
          </div>
          <div className="flex justify-center">
            <img key={selectedReference.id} src={selectedReference.image} alt={selectedReference.name} className="block max-h-[78vh] w-auto max-w-full animate-pop rounded-sm border-2 border-ink bg-ink shadow-hard-marker" />
          </div>
        </Card>

        <Card pad="md">
          <CardHeader icon={Check} title="How this layout is built" />
          <div className="space-y-3">
            <SpecBlock n={1} title="Content">
              <p>
                <Key>Headline / topic</Key>
                {selectedReference.specs.header || `${selectedReference.specs.statement?.slice(0, 45)}…`}
              </p>
              <p className="telugu-text">
                <Key>Telugu punchline</Key>
                {selectedReference.specs.punchline}
              </p>
            </SpecBlock>
            <SpecBlock n={2} title="Asset mapping">
              <p>
                <Key>Subjects</Key>
                {selectedReference.specs.subjects} images with explicit section roles
              </p>
              <p>
                <Key>Reaction image</Key>1 dedicated movie reaction scene
              </p>
            </SpecBlock>
            <SpecBlock n={3} title="Design">
              <p>
                <Key>Fonts</Key>
                {selectedReference.specs.font}
              </p>
              <p className="flex flex-wrap items-center gap-x-2">
                <Key>Colours</Key>
                <span className="inline-flex items-center gap-1.5 font-mono text-[12px]">
                  <span className="h-4 w-4 rounded border border-ink/40 bg-[#FFE500]" aria-hidden="true" /> #FFE500
                  <span className="h-4 w-4 rounded border border-ink/40 bg-white" aria-hidden="true" /> #FFFFFF
                  <span className="h-4 w-4 rounded border border-ink/40 bg-black" aria-hidden="true" /> black 7–8px stroke
                </span>
              </p>
            </SpecBlock>
            <SpecBlock n={4} title="Dynamic layout">
              <p>
                <Key>Arrangement</Key>
                <span className="font-mono text-[12.5px]">{selectedReference.specs.arrangement}</span>
              </p>
            </SpecBlock>
          </div>

          <Button variant="secondary" className="mt-4 w-full" onClick={() => setShowJson(v => !v)} aria-expanded={showJson} leftIcon={<FileText className="h-4 w-4" />}>
            {showJson ? 'Hide layout spec' : 'Show layout spec (JSON)'}
          </Button>

          {showJson && (
            <div className="relative mt-3 animate-fade-in">
              <pre className="thin-scrollbar max-h-64 overflow-auto rounded-md border-2 border-ink on-ink bg-ink p-4 font-mono text-[12px] leading-relaxed text-marker">{json}</pre>
              <Button variant="on-ink" size="sm" onClick={copy} className="absolute right-2.5 top-2.5" leftIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
