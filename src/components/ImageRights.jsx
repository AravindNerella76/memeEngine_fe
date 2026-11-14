import React from 'react';
import { cn } from '../ui';

/**
 * Shared labels for where subject images came from. Backend classes:
 * open_license | open_license_restricted | copyrighted_unconfirmed.
 * Any image may be used (owner's choice); labels are neutral information, not warnings.
 * Open licences are highlighted because they come with a credit line to add.
 */
export const RIGHTS_STYLE = {
  open_license: 'border-ok/25 bg-ok-soft text-ok',
  open_license_restricted: 'border-line bg-paper-2 text-ink-3',
  copyrighted_unconfirmed: 'border-line bg-paper-2 text-ink-3'
};

export const MATCH_LABEL = {
  same_picture: 'Same picture as the reference',
  same_scene: 'Same scene as the reference',
  different: 'Different picture from the reference',
  unknown: 'Not compared'
};

const PROVIDER_NAMES = {
  'wikimedia-commons': 'Wikimedia Commons',
  wikipedia: 'Wikipedia',
  openverse: 'Openverse',
  'google-vision-web': 'Reverse image search (Google)',
  'brave-images': 'Brave Image Search',
  tmdb: 'TMDB',
  'google-cse': 'Google Programmable Search',
  duckduckgo: 'DuckDuckGo'
};

export function providerName(id) {
  return PROVIDER_NAMES[id] || id || '';
}

/** Neutral text for an image's licence status. */
export function rightsText(rights, compact = false) {
  if (!rights) return '';
  if (rights.classification === 'open_license') {
    return compact ? `Open licence${rights.license ? ` · ${rights.license}` : ''}` : rights.label;
  }
  if (rights.classification === 'open_license_restricted') return `Licence: ${rights.license || 'limited'}`;
  return compact ? 'Web image' : 'Web image (no licence information)';
}

/** Where an image came from and who chose it (a user's choice is never presented as AI-verified). */
export function sourceTypeText(asset) {
  const t = asset?.sourceType || (asset?.provider ? 'ai_discovery' : asset?.selectedBy === 'user' ? 'user_upload' : null);
  if (t === 'user_upload') return 'Your upload · not checked by the AI';
  if (t === 'online_search') return 'Online search, your choice · not checked by the AI';
  if (t === 'ai_discovery') return asset?.selectedBy === 'user' ? 'Earlier AI-verified candidate, your choice' : 'AI discovery · visually verified';
  return 'Source not recorded';
}

export function RightsBadge({ rights, license, compact = false }) {
  if (!rights) {
    return license ? <span className="text-[11px] text-muted">{license}</span> : null;
  }
  const style = RIGHTS_STYLE[rights.classification] || RIGHTS_STYLE.copyrighted_unconfirmed;
  return (
    <span title={rightsText(rights)} className={cn('inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold', style)}>
      {rightsText(rights, compact)}
    </span>
  );
}

/** Counts per rights class for a list of subject image assets. */
export function rightsSummary(assets) {
  const out = { open: 0, restricted: 0, copyrighted: 0, unlabelled: 0 };
  for (const a of assets || []) {
    const c = a?.rights?.classification;
    if (c === 'open_license') out.open++;
    else if (c === 'open_license_restricted') out.restricted++;
    else if (c === 'copyrighted_unconfirmed') out.copyrighted++;
    else out.unlabelled++;
  }
  return out;
}
