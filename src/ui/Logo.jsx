import React from 'react';
import { cn } from './cn';

const SIZES = {
  sm: 'h-8 w-8 rounded-[9px]',
  md: 'h-10 w-10 rounded-[11px]',
  lg: 'h-14 w-14 rounded-[15px]'
};

/**
 * Telugu "మీ" (mee, as in meme), drawn from the Noto Sans Telugu Bold outlines as a plain SVG path.
 * Drawing it instead of typing it means the 120 KB Telugu font is not downloaded just to show the logo,
 * so every screen, the sign-in page included, paints without waiting for it.
 */
const MEE_PATH =
  'M481 12Q435 12 400 -6Q365 -24 335.5 -56Q306 -88 273 -131Q244 -171 223 -189Q202 -207 172 -207Q144 -207 125.5 -189Q107 -171 107 -136Q107 -105 126.5 -84Q146 -63 180 -63Q214 -63 236.5 -83Q259 -103 275 -141L328 -81Q309 -54 288 -33Q267 -12 240.5 0Q214 12 175 12Q122 12 90 -10Q58 -32 43.5 -66.5Q29 -101 29 -138Q29 -182 48 -214Q67 -246 99 -264Q131 -282 170 -282Q206 -282 234 -269.5Q262 -257 289 -230.5Q316 -204 348 -161Q375 -126 396 -105Q417 -84 438 -75.5Q459 -67 487 -67Q522 -67 545.5 -82.5Q569 -98 581 -133Q593 -168 593 -225Q593 -291 571 -356.5Q549 -422 510 -478Q471 -534 419 -573.5Q367 -613 307 -626Q295 -629 282 -630.5Q269 -632 256 -632Q219 -632 199 -616Q179 -600 179 -576Q179 -551 193 -536Q207 -521 236 -521Q263 -521 280.5 -535Q298 -549 298 -584Q298 -608 288.5 -628.5Q279 -649 265 -662L336 -673Q350 -651 359.5 -626.5Q369 -602 369 -575Q369 -519 334 -485.5Q299 -452 235 -452Q189 -452 160 -471Q131 -490 118 -517.5Q105 -545 105 -572Q105 -614 125.5 -642.5Q146 -671 183 -686Q220 -701 269 -701Q348 -701 421 -664.5Q494 -628 551.5 -563Q609 -498 642.5 -411Q676 -324 676 -223Q676 -142 653 -90Q630 -38 586.5 -13Q543 12 481 12ZM828 12Q761 12 710.5 -22Q660 -56 621 -111L661 -176Q689 -139 716.5 -115Q744 -91 773.5 -79Q803 -67 835 -67Q886 -67 913 -99.5Q940 -132 940 -193Q940 -251 916.5 -294.5Q893 -338 853.5 -369.5Q814 -401 764 -423L801 -500Q863 -474 913 -430Q963 -386 993 -328Q1023 -270 1023 -199Q1023 -100 973 -44Q923 12 828 12ZM286 -853Q347 -853 381.5 -827.5Q416 -802 433 -757L357 -737Q352 -752 343 -763.5Q334 -775 320.5 -781Q307 -787 287 -787Q260 -787 240 -773Q220 -759 220 -732Q220 -718 229.5 -700.5Q239 -683 269 -663L195 -635Q168 -660 156.5 -685Q145 -710 145 -740Q145 -776 163.5 -801Q182 -826 214 -839.5Q246 -853 286 -853Z';

/**
 * The brand mark: "మీ" on a yellow sticker with the same black outline and hard shadow the memes themselves use.
 */
export function LogoMark({ size = 'md', className }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid shrink-0 place-items-center border-2 border-ink bg-marker text-ink shadow-[2.5px_2.5px_0_0_rgb(var(--shadow))]',
        SIZES[size],
        className
      )}
    >
      <svg viewBox="16 -866 1020 891" className="h-auto w-[54%]" fill="currentColor" stroke="currentColor" strokeWidth="26" strokeLinejoin="round">
        <path d={MEE_PATH} />
      </svg>
    </span>
  );
}
