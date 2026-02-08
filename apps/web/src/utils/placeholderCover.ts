function escapeXml(input: string) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createPlaceholderCoverDataUrl(opts: {
  title?: string;
  mood?: string;
  seed?: string | number;
  note?: string;
}): string {
  const title = String(opts.title ?? '').trim() || 'AIRIA';
  const mood = String(opts.mood ?? '').trim() || 'mood';
  const seed = String(opts.seed ?? '0');
  const note = String(opts.note ?? 'Placeholder cover').trim() || 'Placeholder cover';

  const hue =
    Math.abs(seed.split('').reduce((acc, ch) => acc * 33 + ch.charCodeAt(0), 7)) % 360;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue} 70% 52%)" stop-opacity="0.95"/>
      <stop offset="55%" stop-color="hsl(${(hue + 35) % 360} 65% 42%)" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="hsl(${(hue + 120) % 360} 55% 28%)" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="n">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.16"/>
      </feComponentTransfer>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect width="1024" height="1024" filter="url(#n)" opacity="0.6"/>
  <circle cx="770" cy="300" r="240" fill="rgba(255,255,255,0.14)"/>
  <circle cx="820" cy="270" r="120" fill="rgba(0,0,0,0.10)"/>

  <g fill="rgba(255,255,255,0.92)" font-family="system-ui, -apple-system, Segoe UI, sans-serif">
    <text x="72" y="794" font-size="54" font-weight="720" letter-spacing="0.02em">${escapeXml(title).slice(0, 28)}</text>
    <text x="72" y="858" font-size="28" font-weight="600" opacity="0.9">${escapeXml(mood).slice(0, 24)}</text>
    <text x="72" y="916" font-size="18" opacity="0.8">${escapeXml(note).slice(0, 64)}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
