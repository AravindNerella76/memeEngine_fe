import React, { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code drawn as one crisp SVG path in ink on white (phone cameras want strong contrast and a quiet margin).
 * Error correction "M": survives a smudged screen or a glare without making the code needlessly dense.
 */
export default function QrCode({ value, size = 136, label, className }) {
  const { path, count } = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(String(value || ''));
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (!qr.isDark(r, c)) continue;
          // merge runs of dark modules on a row into one rectangle: a smaller path, no hairline seams between modules
          let w = 1;
          while (c + w < n && qr.isDark(r, c + w)) w++;
          d += `M${c + 4} ${r + 4}h${w}v1h-${w}z`;
          c += w - 1;
        }
      }
      return { path: d, count: n };
    } catch {
      return { path: '', count: 0 };
    }
  }, [value]);

  if (!count) return null;
  const box = count + 8; // 4 modules of quiet zone on every side, as the standard asks
  return (
    <svg viewBox={`0 0 ${box} ${box}`} width={size} height={size} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={box} height={box} fill="#fff" />
      <path d={path} fill="#0E0E0C" />
    </svg>
  );
}
