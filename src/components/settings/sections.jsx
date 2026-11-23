import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Copy, FoldVertical, Info, Lock, ShieldCheck } from 'lucide-react';
import { ColorField, Group, NumberField, Segmented, SelectField, Switch, Toggle } from './controls';
import { getAt, HIGHLIGHT_RULE, pct, RIGHTS_LABELS, specAt } from './settingsModel';
import { RIGHTS_STYLE } from '../ImageRights';
import { Alert, Button, Chips, cn } from '../../ui';

const ROLE_ORDER = ['heading', 'labels', 'supporting', 'punchline', 'caption'];
const times = v => `${v}×`;
const two = v => (typeof v === 'number' ? v.toFixed(2) : v);
const fromTop = v => `${Math.round(v * 100)}% from top`;

/** Helper: props for a control bound to a settings path. */
function binder({ draft, defaults, schema, errors, set }) {
  return path => ({
    value: getAt(draft, path),
    defaultValue: getAt(defaults, path),
    spec: specAt(schema, path),
    error: errors[path.join('.')],
    onChange: v => set(path, v)
  });
}

const NOTE_TONE = { slate: 'neutral', amber: 'warn', emerald: 'ok' };

function Note({ children, icon: Icon = Info, tone = 'slate' }) {
  return (
    <Alert tone={NOTE_TONE[tone] || 'neutral'} icon={Icon} compact>
      {children}
    </Alert>
  );
}

/** "In use now" note when the .env value is stricter than the saved setting. */
function InUse({ saved, effective, format = v => v }) {
  if (effective === undefined || saved === undefined || effective === saved) return null;
  return <p className="-mt-2 text-[12px] font-medium text-info">In use now: {format(effective)} (the .env value is stricter and wins).</p>;
}

export function RoleTabs({ role, setRole, roles }) {
  return (
    <Chips
      mode="tab"
      tone="ink"
      label="Text role"
      value={role}
      onChange={setRole}
      options={ROLE_ORDER.map(r => ({ value: r, label: roles?.[r]?.label || r }))}
    />
  );
}

// ------------------------------------------------------------------------------------------------

export function TypographySection(props) {
  const { role, setRole, meta, fonts } = props;
  const bind = binder(props);
  const r = ['typography', 'roles', role];
  const info = meta.roles?.[role];
  return (
    <div className="space-y-4">
      <Group title="All text" description="Scales every text role together (each meme can still be adjusted when you regenerate it).">
        <NumberField label="Overall text scale" {...bind(['typography', 'fontSizeScale'])} format={times} />
      </Group>
      <RoleTabs role={role} setRole={setRole} roles={meta.roles} />
      <Group title={info?.label} description={info ? `Applies to ${info.appliesTo}.` : undefined}>
        <div className="grid-fit gap-5">
          <SelectField label="English font" {...bind([...r, 'englishFont'])} options={fonts.english.map(f => ({ value: f, label: f }))} />
          <SelectField label="Telugu font" {...bind([...r, 'teluguFont'])} options={fonts.telugu.map(f => ({ value: f, label: f }))} />
        </div>
        <Segmented label="Weight" {...bind([...r, 'weight'])} options={[{ value: 'bold', label: 'Bold' }, { value: 'normal', label: 'Regular' }]} columns="grid-cols-2" />
        <NumberField label="Size" description="Starting size on a 1080 px wide meme." {...bind([...r, 'size'])} />
        <div className="grid-fit gap-5">
          <NumberField label="Minimum size" description="Fitting never goes below this; longer text gets more room or an error instead." {...bind([...r, 'minSize'])} />
          <NumberField label="Maximum size" description="Upper limit after the text scales are applied." {...bind([...r, 'maxSize'])} />
        </div>
        <div className="grid-fit gap-5">
          <NumberField label="Line height" {...bind([...r, 'lineHeight'])} format={times} />
          <NumberField label="Letter spacing" {...bind([...r, 'letterSpacing'])} />
        </div>
        <Segmented
          label="Alignment"
          {...bind([...r, 'align'])}
          options={[
            { value: 'left', label: 'Left', icon: AlignLeft },
            { value: 'center', label: 'Centre', icon: AlignCenter },
            { value: 'right', label: 'Right', icon: AlignRight }
          ]}
        />
        <Segmented
          label="Position in its area"
          description="Where the lines sit inside the text's area (the area itself comes from the automatic layout)."
          {...bind([...r, 'position'])}
          options={[
            { value: 'top', label: 'Top', icon: ArrowUpToLine },
            { value: 'middle', label: 'Middle', icon: FoldVertical },
            { value: 'bottom', label: 'Bottom', icon: ArrowDownToLine }
          ]}
        />
        <ColorField label="Text colour" description="Same setting as the fill colour under Text Effects & Colours." {...bind(['effects', 'roles', role, 'fill', 'color'])} />
      </Group>
      <Note>Telugu text is shaped by the renderer with the Telugu font you choose (conjuncts and vowel signs stay intact); English and numbers use the English font. Only fonts installed on the server are offered.</Note>
    </div>
  );
}

export function EffectsSection(props) {
  const { role, setRole, meta, draft, set } = props;
  const bind = binder(props);
  const e = ['effects', 'roles', role];
  const fx = getAt(draft, e);
  const copyToAll = () => {
    for (const other of ROLE_ORDER) if (other !== role) set(['effects', 'roles', other], JSON.parse(JSON.stringify(fx)));
  };
  return (
    <div className="space-y-4">
      <RoleTabs role={role} setRole={setRole} roles={meta.roles} />
      <Group
        title={`Fill · ${meta.roles?.[role]?.label || role}`}
        actions={
          <Button variant="secondary" size="sm" onClick={copyToAll} leftIcon={<Copy className="h-3.5 w-3.5" />} title="Copy fill, highlight, outline and shadow of this role to every other role">
            Use for all roles
          </Button>
        }
      >
        <div className="grid-fit gap-5">
          <ColorField label="Fill colour" description="Colour of normal lines." {...bind([...e, 'fill', 'color'])} />
          <NumberField label="Text opacity" {...bind([...e, 'fill', 'opacity'])} format={pct} />
        </div>
      </Group>
      <Group title="Highlight" description={`Colours: ${HIGHLIGHT_RULE[role]}`}>
        <Toggle label="Highlight on" checked={fx.highlight.enabled} defaultValue={getAt(props.defaults, [...e, 'highlight', 'enabled'])} onChange={v => set([...e, 'highlight', 'enabled'], v)} />
        <ColorField label="Highlight colour" {...bind([...e, 'highlight', 'color'])} disabled={!fx.highlight.enabled} />
        {(role === 'heading' || role === 'supporting') && (
          <Segmented
            label="Which lines"
            {...bind([...e, 'highlight', 'pattern'])}
            options={[
              { value: 'first', label: 'First line', hint: 'Yellow, white, white' },
              { value: 'alternate', label: 'Every other line', hint: 'Yellow, white, yellow' }
            ]}
            columns="grid-cols-2"
          />
        )}
      </Group>
      <Group title="Outline (stroke)">
        <Toggle label="Outline on" checked={fx.stroke.enabled} defaultValue={getAt(props.defaults, [...e, 'stroke', 'enabled'])} onChange={v => set([...e, 'stroke', 'enabled'], v)} />
        <div className="grid-fit gap-5">
          <NumberField label="Width" {...bind([...e, 'stroke', 'width'])} disabled={!fx.stroke.enabled} />
          <NumberField label="Opacity" {...bind([...e, 'stroke', 'opacity'])} format={pct} disabled={!fx.stroke.enabled} />
        </div>
        <ColorField label="Outline colour" {...bind([...e, 'stroke', 'color'])} disabled={!fx.stroke.enabled} />
      </Group>
      <Group title="Shadow">
        <Toggle label="Shadow on" checked={fx.shadow.enabled} defaultValue={getAt(props.defaults, [...e, 'shadow', 'enabled'])} onChange={v => set([...e, 'shadow', 'enabled'], v)} />
        <div className="grid-fit gap-5">
          <ColorField label="Shadow colour" {...bind([...e, 'shadow', 'color'])} disabled={!fx.shadow.enabled} />
          <NumberField label="Opacity" {...bind([...e, 'shadow', 'opacity'])} format={pct} disabled={!fx.shadow.enabled} />
          <NumberField label="Blur" {...bind([...e, 'shadow', 'blur'])} disabled={!fx.shadow.enabled} />
          <div className="hidden sm:block" />
          <NumberField label="Offset X" {...bind([...e, 'shadow', 'offsetX'])} disabled={!fx.shadow.enabled} />
          <NumberField label="Offset Y" {...bind([...e, 'shadow', 'offsetY'])} disabled={!fx.shadow.enabled} />
        </div>
      </Group>
      {(role === 'supporting' || role === 'punchline') && fx.shade && (
        <Group
          title={role === 'punchline' ? 'Fade at the bottom' : 'Shade behind the text'}
          description={
            role === 'punchline'
              ? 'The picture fades to black at its bottom edge, starting low behind the last line of the punchline. Darkness is how black the very bottom gets.'
              : 'A soft dark fade behind the words, from above them to the bottom of the picture. Keeps them readable on bright pictures without a hard box.'
          }
        >
          <Toggle label="Shade on" checked={fx.shade.enabled} defaultValue={getAt(props.defaults, [...e, 'shade', 'enabled'])} onChange={v => set([...e, 'shade', 'enabled'], v)} />
          <NumberField label="Darkness" {...bind([...e, 'shade', 'opacity'])} format={pct} disabled={!fx.shade.enabled} />
        </Group>
      )}
    </div>
  );
}

export function CanvasSection(props) {
  const { draft, set, meta } = props;
  const bind = binder(props);
  const c = draft.canvas;
  const size = meta.canvasSizes?.[c.aspect] || { width: 1080, height: 1350 };
  const autoHeader = c.headerRatio === null;
  return (
    <div className="space-y-4">
      <Group title="Canvas">
        <Segmented
          label="Aspect ratio"
          {...bind(['canvas', 'aspect'])}
          options={[
            { value: 'portrait_4_5', label: '4:5 Portrait', hint: '1080 × 1350 · default' },
            { value: 'square_1_1', label: '1:1 Square', hint: '1080 × 1080' },
            { value: 'story_9_16', label: '9:16 Story', hint: '1080 × 1920' }
          ]}
        />
        <Segmented
          label="Output resolution"
          description="The layout is always computed at 1080 px wide; a higher resolution draws the same meme sharper."
          {...bind(['canvas', 'outputScale'])}
          options={[1, 1.5, 2].map(s => ({ value: s, label: `${s}×`, hint: `${Math.round(size.width * s)} × ${Math.round(size.height * s)}` }))}
        />
        <div className="grid-fit gap-5">
          <ColorField label="Background colour" description="Shows through image gaps and around fitted pictures." {...bind(['canvas', 'background'])} />
          <ColorField label="Header background" {...bind(['canvas', 'headerBackground'])} />
        </div>
      </Group>
      <Group title="Header and punchline regions" description="The reference decides whether there is a header and how big the reaction image is; these values are the defaults and limits around that.">
        <Toggle
          label="Automatic header height"
          description="On: the reference (or 8.2% of a 4:5 canvas) decides."
          checked={autoHeader}
          defaultValue={getAt(props.defaults, ['canvas', 'headerRatio']) === null}
          onChange={v => set(['canvas', 'headerRatio'], v ? null : Math.min(0.082, c.maxHeaderRatio))}
        />
        {!autoHeader && <NumberField label="Header height" {...bind(['canvas', 'headerRatio'])} format={pct} />}
        <NumberField label="Maximum header height" description="A long heading may enlarge the header up to this share of the canvas." {...bind(['canvas', 'maxHeaderRatio'])} format={pct} />
        <div className="grid-fit gap-5">
          <NumberField label="Punchline area" description="Share of the reaction image reserved for the punchline." {...bind(['canvas', 'punchlineRatio'])} format={pct} />
          <NumberField label="Maximum punchline area" description="A long punchline may grow its area up to this share." {...bind(['canvas', 'punchlineMaxGrowRatio'])} format={pct} />
          <NumberField label="Setup line size" description="In a two-line punchline, the yellow first line's size compared with the white second line." {...bind(['canvas', 'punchlineSetupScale'])} format={pct} />
        </div>
      </Group>
      <Group title="Spacing">
        <NumberField label="Safe margin" description="Minimum distance of any text from the left and right edges (0 = the layout's own insets)." {...bind(['canvas', 'safeMargin'])} />
        <div className="grid-fit gap-5">
          <NumberField label="Space between images" {...bind(['canvas', 'imageGap'])} />
          <NumberField label="Space between sections" description="Between header, subject images and reaction image." {...bind(['canvas', 'sectionGap'])} />
          <NumberField label="Image corner radius" {...bind(['canvas', 'cornerRadius'])} />
          <NumberField label="Minimum image size" description="Smallest image area the automatic layout may create; smaller grids are evened out." {...bind(['canvas', 'minSlotSize'])} />
        </div>
      </Group>
      {draft.canvas.watermark && (
        <Group title="Your logo on every meme" description="The C/O Kanyaraasi logo, stamped on each meme when it is finished (on the studio and on WhatsApp). Memes made earlier keep the look they were made with.">
          <Toggle
            label="Logo on"
            checked={draft.canvas.watermark.enabled}
            defaultValue={bind(['canvas', 'watermark', 'enabled']).defaultValue}
            onChange={v => set(['canvas', 'watermark', 'enabled'], v)}
          />
          <Segmented
            label="Where"
            {...bind(['canvas', 'watermark', 'position'])}
            options={[
              { value: 'auto', label: 'Automatic', hint: 'Centre, above the text' },
              { value: 'top-left', label: 'Top left' },
              { value: 'top-right', label: 'Top right' },
              { value: 'bottom-left', label: 'Bottom left' },
              { value: 'bottom-right', label: 'Bottom right' }
            ]}
            columns="grid-cols-2 sm:grid-cols-3"
          />
          <div className="grid-fit gap-5">
            <NumberField label="Size" description="Width of the logo compared with the meme." {...bind(['canvas', 'watermark', 'size'])} format={pct} />
            <NumberField label="Opacity" {...bind(['canvas', 'watermark', 'opacity'])} format={pct} />
          </div>
        </Group>
      )}
      <Note icon={Lock}>The arrangement of images (columns, grids, stacked rows) is always taken from the reference automatically. There is no manual positioning.</Note>
    </div>
  );
}

export function ImageSection(props) {
  const { meta } = props;
  const bind = binder(props);
  const fit = [
    { value: 'cover', label: 'Fill the area', hint: 'Crops the edges' },
    { value: 'contain', label: 'Whole picture', hint: 'Background shows around it' }
  ];
  const saved = meta.savedSettings?.imageProcessing || {};
  const eff = meta.effective || {};
  return (
    <div className="space-y-4">
      <Group title="Fitting" description="Pictures keep their proportions in both modes; they are never stretched.">
        <Segmented label="Subject pictures" {...bind(['imageProcessing', 'subjectFit'])} options={fit} columns="grid-cols-2" />
        <Segmented label="Reaction image" {...bind(['imageProcessing', 'reactionFit'])} options={fit} columns="grid-cols-2" />
      </Group>
      <Group title="Crop position" description="Which part of a picture stays visible when it is cropped (0% keeps the top).">
        <NumberField label="Portrait subject pictures" {...bind(['imageProcessing', 'portraitAnchorY'])} format={fromTop} />
        <NumberField label="Landscape subject pictures" {...bind(['imageProcessing', 'landscapeAnchorY'])} format={fromTop} />
        <NumberField label="Reaction image" {...bind(['imageProcessing', 'reactionAnchorY'])} format={fromTop} />
        <Toggle
          label="Keep faces in view"
          description="Centre the crop on the subject found during visual verification, when known."
          checked={bind(['imageProcessing', 'useFocalPoint']).value}
          defaultValue={bind(['imageProcessing', 'useFocalPoint']).defaultValue}
          onChange={bind(['imageProcessing', 'useFocalPoint']).onChange}
        />
        <Toggle
          label="Trim black and white bars"
          description="Cut away movie letterbox bars and screenshot borders before a picture is placed, so they never show as bands between the panels."
          checked={bind(['imageProcessing', 'trimBorders']).value}
          defaultValue={bind(['imageProcessing', 'trimBorders']).defaultValue}
          onChange={bind(['imageProcessing', 'trimBorders']).onChange}
        />
      </Group>
      <Group title="Saved files" description="Every meme is saved as PNG and JPEG.">
        <Segmented
          label="Main format"
          description="Shown first and offered first for download."
          {...bind(['imageProcessing', 'primaryFormat'])}
          options={[
            { value: 'png', label: 'PNG', hint: 'Lossless' },
            { value: 'jpeg', label: 'JPEG', hint: 'Smaller file' }
          ]}
          columns="grid-cols-2"
        />
        <NumberField label="JPEG quality" {...bind(['imageProcessing', 'jpegQuality'])} />
      </Group>
      <Group title="Checks on internet pictures" description="These can only make the checks stricter than the built-in limits.">
        <div className="grid-fit gap-5">
          <NumberField label="Minimum resolution" description="Smallest width or height accepted." {...bind(['imageProcessing', 'minImageSide'])} />
          <NumberField label="Maximum enlargement" description="How much a picture may be scaled up to fill its area." {...bind(['imageProcessing', 'maxUpscale'])} format={times} />
        </div>
        <InUse saved={saved.minImageSide} effective={eff.minImageSide} format={v => `${v} px`} />
        <NumberField label="Duplicate sensitivity" description="Higher treats more similar pictures as the same picture (never used twice)." {...bind(['imageProcessing', 'duplicateSensitivity'])} />
        <Segmented
          label="Watermarks and overlaid text"
          {...bind(['imageProcessing', 'watermarkPolicy'])}
          options={[
            { value: 'prefer_clean', label: 'Prefer clean pictures', hint: 'Use a marked one only if nothing clean is verified' },
            { value: 'reject', label: 'Reject them', hint: 'Posters excepted' }
          ]}
          columns="grid-cols-1 sm:grid-cols-2"
        />
        <Note icon={ShieldCheck}>Downloads always go through the safe downloader and are verified as real JPEG, PNG or WebP images within the size limits.</Note>
      </Group>
    </div>
  );
}

const PROVIDERS = [
  { key: 'wikimediaCommons', id: 'wikimedia-commons', name: 'Wikimedia Commons', kind: 'Free' },
  { key: 'wikipedia', id: 'wikipedia', name: 'Wikipedia', kind: 'Free' },
  { key: 'openverse', id: 'openverse', name: 'Openverse', kind: 'Free' },
  { key: 'googleVision', id: 'google-vision-web', name: 'Reverse image search (Google Cloud Vision)', kind: 'Paid, key in .env' },
  { key: 'brave', id: 'brave-images', name: 'Brave Image Search', kind: 'Paid, key in .env' }
];

function providerStatus(p, on, savedOn) {
  if (!on) return { text: 'Off', tone: 'text-muted bg-paper-2 border-line' };
  if (p?.enabled) return { text: 'Available', tone: 'text-ok bg-ok-soft border-ok/25' };
  if (!savedOn && p?.turnedOffInSettings) return { text: 'On after saving', tone: 'text-info bg-info-soft border-info/25' };
  if (p && p.keyConfigured === false) return { text: 'No API key in .env', tone: 'text-muted bg-paper-2 border-line' };
  if (p?.disabledReason) return { text: `Paused: ${p.disabledReason}`, tone: 'text-warn bg-warn-soft border-warn/30' };
  return { text: 'Not enabled in .env', tone: 'text-muted bg-paper-2 border-line' };
}

export function DiscoverySection(props) {
  const { draft, set, meta } = props;
  const bind = binder(props);
  const eff = meta.effective || {};
  const saved = meta.savedSettings?.discovery || {};
  const usage = new Map((meta.usage || []).map(u => [u.provider, u]));
  return (
    <div className="space-y-4">
      <Group
        title="Search sources"
        description="Switching a source off here takes effect for the next generation. A paid source also needs its key in memeEngine_be/.env; switching it on here cannot bypass a missing key or a monthly limit."
      >
        <ul className="divide-y divide-line">
          {PROVIDERS.map(pr => {
            const p = (meta.providers || []).find(x => x.id === pr.id);
            const on = draft.discovery.providers[pr.key];
            const st = providerStatus(p, on, saved.providers?.[pr.key]);
            const u = usage.get(pr.id);
            const share = u && typeof u.used === 'number' && u.limit > 0 ? Math.min(1, u.used / u.limit) : null;
            return (
              <li key={pr.key} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">{pr.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-muted">{pr.kind}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', st.tone)}>{st.text}</span>
                    {share !== null && (
                      <span className="tabular flex items-center gap-2 font-mono text-[11px] text-muted" title="Usage this calendar month against the monthly limit set in .env">
                        <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-paper-2">
                          <span className={cn('block h-full', share > 0.9 ? 'bg-bad' : 'bg-ink')} style={{ width: `${Math.round(share * 100)}%` }} />
                        </span>
                        {u.used}/{u.limit} this month
                      </span>
                    )}
                  </div>
                </div>
                <Switch checked={on} onChange={v => set(['discovery', 'providers', pr.key], v)} label={`${pr.name} allowed`} />
              </li>
            );
          })}
        </ul>
        <div className="grid-fit-sm gap-2.5">
          {[
            ['Brave requests per month', eff.caps?.braveMonthlyRequests],
            ['Brave requests per image slot', eff.caps?.braveQueriesPerSlot],
            ['Reverse image searches per month', eff.caps?.googleVisionMonthlyUnits]
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-line bg-paper/60 px-3.5 py-2.5">
              <p className="flex items-center gap-1.5 text-[12px] text-muted">
                <Lock className="h-3 w-3" aria-hidden="true" /> {k}
              </p>
              <p className="tabular mt-0.5 font-mono text-[15px] font-semibold text-ink">{v ?? '—'}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted">Monthly limits are set only in memeEngine_be/.env (BRAVE_MONTHLY_REQUEST_LIMIT, GOOGLE_VISION_MONTHLY_UNIT_LIMIT). API keys are never sent to this page.</p>
      </Group>
      <Group title="Image rights">
        <Segmented
          label="Which pictures may be used"
          {...bind(['discovery', 'rightsPolicy'])}
          options={[
            { value: 'allow_copyrighted', label: 'Any relevant picture', hint: 'Film stills, news and celebrity photos included' },
            { value: 'open_license_only', label: 'Openly licensed only', hint: 'Public domain and Creative Commons' }
          ]}
          columns="grid-cols-1 sm:grid-cols-2"
        />
        <div className="space-y-2">
          <p className="text-[12.5px] text-muted">Every chosen picture keeps its source and one of these labels:</p>
          <div className="flex flex-wrap gap-1.5">
            {RIGHTS_LABELS.map(l => (
              <span key={l.id} className={cn('rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', RIGHTS_STYLE[l.id])}>
                {l.text}
              </span>
            ))}
          </div>
        </div>
      </Group>
      <Group title="Search effort">
        <div className="grid-fit gap-5">
          <NumberField label="Pictures checked per slot" description="Downloaded and verified per image slot before giving up." {...bind(['discovery', 'maxCandidatesChecked'])} />
          <NumberField label="Search rounds per slot" description="Precise, then identity, then broad searches." {...bind(['discovery', 'maxRounds'])} />
        </div>
        <InUse saved={saved.maxRounds} effective={eff.maxRounds} />
      </Group>
      <Group title="Verification thresholds" description="Can be raised, never lowered below the built-in minimums. Identity rules, relevance scoring and visual verification always run.">
        <NumberField label="Identity confidence" description="Minimum confidence when the AI identifies an unnamed person." {...bind(['discovery', 'identityMinConfidence'])} format={two} />
        <InUse saved={saved.identityMinConfidence} effective={eff.identityMinConfidence} format={two} />
        <NumberField label="Visual verification confidence" description="Minimum confidence of the visual check that a picture shows the right subject." {...bind(['discovery', 'visualMinConfidence'])} format={two} />
        <InUse saved={saved.visualMinConfidence} effective={eff.visualMinConfidence} format={two} />
        {eff.visualVerification === 'off' && <Note tone="amber">Visual verification is switched off in .env (VISION_VERIFY_CANDIDATES=off); only metadata ranking is used.</Note>}
      </Group>
    </div>
  );
}

export function AdvancedSection(props) {
  const { meta } = props;
  const bind = binder(props);
  const eff = meta.effective || {};
  const saved = meta.savedSettings?.advanced || {};
  return (
    <div className="space-y-4">
      <Group title="Timeouts and retries">
        <NumberField label="AI analysis timeout" description="Longest a single vision-model run may take." {...bind(['advanced', 'analysisTimeoutSec'])} />
        <NumberField label="Download timeout" description="Longest a single picture download may take." {...bind(['advanced', 'downloadTimeoutSec'])} />
        <NumberField label="Retries" description="Attempts per AI task after a timeout or unreadable answer." {...bind(['advanced', 'retryCount'])} />
      </Group>
      <Group title="Limits">
        <NumberField label="Generations at the same time" description="Viral adaptations allowed to run at once (each uses the AI and the network)." {...bind(['advanced', 'maxConcurrentGenerations'])} />
        <NumberField label="Maximum image file size" description="Largest upload accepted. The server's hard limit is 20 MB." {...bind(['advanced', 'maxUploadMB'])} />
        <InUse saved={saved.maxUploadMB} effective={eff.maxUploadMB} format={v => `${v} MB`} />
      </Group>
      <Group title="Diagnostics">
        <Toggle
          label="Diagnostics in generation reports"
          description="Adds the configuration used (without keys) to each viral adaptation's report."
          checked={bind(['advanced', 'diagnostics']).value}
          defaultValue={bind(['advanced', 'diagnostics']).defaultValue}
          onChange={bind(['advanced', 'diagnostics']).onChange}
        />
        <SelectField
          label="Server log level"
          {...bind(['advanced', 'logLevel'])}
          options={[
            { value: 'error', label: 'Errors only' },
            { value: 'warn', label: 'Warnings and errors' },
            { value: 'log', label: 'Normal (default)' },
            { value: 'debug', label: 'Debug' },
            { value: 'verbose', label: 'Verbose' }
          ]}
        />
        <Note>Logs never contain API keys. Security checks (upload verification, origin checks, path checks) cannot be switched off here.</Note>
      </Group>
    </div>
  );
}
