/**
 * Generate one native 600×600 Reflex Arc `.display.png` with v1 canonical box geometry.
 * Deterministic (SVG → PNG) so printed boxes match runtime overlay within px tolerance.
 *
 * Usage: node scripts/generate-reflex-arc-v1-display.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const sharp = require(path.join(root, "backend", "node_modules", "sharp"));
const { getTtiBoxGeometryLayout } = require(path.join(root, "lib", "ttiBoxGeometry.js"));

const geo = getTtiBoxGeometryLayout("square-display", "tti-box-geometry-v1");
const { box, zones } = geo;

const portraitPath = path.join(
  root,
  "backend/public/visuals/Metabolism/Nervious system/reflex-arc-drag-drop-match-portrait.svg"
);
const portraitRaw = readFileSync(portraitPath, "utf8");
const portraitInner = portraitRaw
  .replace(/<g id="drop-zones"[\s\S]*?<\/g>\s*/i, "")
  .replace(/^[\s\S]*?<svg[^>]*>/i, "")
  .replace(/<\/svg>\s*$/i, "");

const scale = 600 / 1350;
const leftClipWidth = Math.floor(box.centerXPx - box.widthPx / 2 - 8);

function boxMarkup(zone) {
  const x = box.centerXPx - box.widthPx / 2;
  const y = zone.centerYPx - box.heightPx / 2;
  const labelY = y - 10;
  const labelX = x - 4;
  return (
    `<rect x="${x}" y="${y}" width="${box.widthPx}" height="${box.heightPx}" rx="6" fill="#FFFFFF" stroke="#111111" stroke-width="3"/>` +
    `<text x="${labelX}" y="${labelY}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#111111">${zone.letter}</text>`
  );
}

const displaySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <rect width="600" height="600" fill="#FFFFFF"/>
  <defs>
    <clipPath id="left-diagram">
      <rect x="0" y="0" width="${leftClipWidth}" height="600"/>
    </clipPath>
  </defs>
  <g transform="scale(${scale})" clip-path="url(#left-diagram)">
    ${portraitInner}
  </g>
  <line x1="${leftClipWidth}" y1="88" x2="${leftClipWidth}" y2="580" stroke="#CBD5E1" stroke-width="2" stroke-dasharray="6 6"/>
  <g id="drop-zones-v1" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#111111">
    ${zones.map(boxMarkup).join("\n    ")}
  </g>
</svg>`;

const svgOut = path.join(
  root,
  "docs/design/validation/reflex-arc-tti-v1-display.svg"
);
const pngOut = path.join(
  root,
  "docs/design/validation/reflex-arc-tti-v1.display.png"
);
const publicDir = path.join(
  root,
  "backend/public/visuals/Metabolism/Nervious system"
);
const publicPngOut = path.join(publicDir, "reflex-arc-drag-drop-match-v1.display.png");

writeFileSync(svgOut, displaySvg, "utf8");

const pngBuffer = await sharp(Buffer.from(displaySvg)).png().toBuffer();
writeFileSync(pngOut, pngBuffer);
mkdirSync(publicDir, { recursive: true });
writeFileSync(publicPngOut, pngBuffer);

console.log(JSON.stringify({
  svg: svgOut,
  displayPng: pngOut,
  publicPng: publicPngOut,
  geometry: {
    box: { widthPx: box.widthPx, heightPx: box.heightPx, centerXPx: box.centerXPx },
    zones: zones.map((z) => ({ letter: z.letter, centerYPx: z.centerYPx, centerYPct: z.centerYPct })),
  },
}, null, 2));
