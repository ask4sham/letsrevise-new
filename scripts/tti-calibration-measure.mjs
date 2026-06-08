/**
 * Measure runtime overlay vs printed box alignment for a TTI display PNG.
 * Usage: node scripts/tti-calibration-measure.mjs [path/to/image.display.png]
 */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const puppeteer = require(path.join(root, "node_modules", "puppeteer"));
const { getTtiBoxGeometryLayout } = require(path.join(root, "lib", "ttiBoxGeometry.js"));

const imgArg = process.argv[2];
const imgPath = imgArg
  ? path.resolve(imgArg)
  : path.join(root, "docs/design/validation/reflex-arc-tti-v1.display.png");
const geometryVersion = process.argv.includes("--legacy") ? "legacy" : "tti-box-geometry-v1";
const geo = getTtiBoxGeometryLayout("square-display", geometryVersion);

const css = [
  "frontend/src/components/lesson/lessonImageCard.css",
  "frontend/src/components/lesson/dragDropMatchBlock.css",
  "frontend/src/components/lesson/dragDropDiagramWorksheetLayout.css",
]
  .map((rel) => readFileSync(path.join(root, rel), "utf8"))
  .join("\n");

const imgB64 = readFileSync(imgPath).toString("base64");
const sampleText = [
  "Receptor detects the stimulus.",
  "Relay neurone connects neurones inside the CNS.",
  "Sensory neurone carries impulses to the CNS.",
  "Motor neurone carries impulses from CNS to effector.",
];

const zones = geo.zones.map((zone, i) => ({
  x: geo.box.centerXPct,
  y: zone.centerYPct,
  text: sampleText[i] ?? "",
  tone: i,
  letter: zone.letter,
}));

const zoneHtml = zones
  .map(
    ({ x, y, text, tone, letter }) =>
      `<button type="button" data-letter="${letter}" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed drag-drop-match__diagram-zone--filled drag-drop-match__diagram-zone--chip-tone-${tone}" style="left:${x}%;top:${y}%">` +
      `<span class="drag-drop-match__diagram-zone-boxed-fill"><span class="drag-drop-match__diagram-zone-boxed-text">${text}</span></span></button>`
  )
  .join("\n");

const html = `<!DOCTYPE html><html><head><style>
body{margin:0;background:#f8fafc}
${css.replace(/<\/style/gi, "<\\/style")}
</style></head><body>
<div class="drag-drop-match drag-drop-match--tti-main" style="width:560px;margin:20px auto">
<div class="drag-drop-match__diagram-worksheet">
<div class="drag-drop-match__diagram-image-container" id="container">
<div class="lesson-image-card drag-drop-match__diagram-frame"><img class="drag-drop-match__diagram-img" id="img" src="data:image/png;base64,${imgB64}" alt="" /></div>
<div class="drag-drop-match__diagram-overlay" id="overlay" style="--tti-boxed-w:${geo.box.widthPct}%;--tti-boxed-h:${geo.box.heightPct}%">${zoneHtml}</div>
</div></div></div></body></html>`;

const screenshotOut = path.join(
  root,
  "docs/design/validation/tti-calibration-reflex-arc-v1-measured.png"
);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
await page.setContent(html, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("img")?.complete);

const metrics = await page.evaluate((expected) => {
  const container = document.getElementById("container");
  const img = document.getElementById("img");
  const overlay = document.getElementById("overlay");
  const cRect = container.getBoundingClientRect();
  const iRect = img.getBoundingClientRect();
  const scaleX = iRect.width / 600;
  const scaleY = iRect.height / 600;

  return [...document.querySelectorAll("[data-letter]")].map((el) => {
    const letter = el.getAttribute("data-letter");
    const r = el.getBoundingClientRect();
    const rel = expected.find((e) => e.letter === letter);
    const expCenterX = (rel.centerXPx / 600) * iRect.width + iRect.left - cRect.left;
    const expCenterY = (rel.centerYPx / 600) * iRect.height + iRect.top - cRect.top;
    const expW = (rel.widthPx / 600) * iRect.width;
    const expH = (rel.heightPx / 600) * iRect.height;
    const actCenterX = r.left + r.width / 2 - cRect.left;
    const actCenterY = r.top + r.height / 2 - cRect.top;
    return {
      letter,
      overlayCenterPx: { x: +actCenterX.toFixed(2), y: +actCenterY.toFixed(2) },
      expectedCenterPx: { x: +expCenterX.toFixed(2), y: +expCenterY.toFixed(2) },
      centerDeltaPx: {
        x: +(actCenterX - expCenterX).toFixed(2),
        y: +(actCenterY - expCenterY).toFixed(2),
      },
      overlaySizePx: { w: +r.width.toFixed(2), h: +r.height.toFixed(2) },
      expectedSizePx: { w: +expW.toFixed(2), h: +expH.toFixed(2) },
      imgScale: { x: +scaleX.toFixed(4), y: +scaleY.toFixed(4) },
    };
  });
}, geo.zones.map((z, i) => ({
  letter: z.letter,
  centerXPx: geo.box.centerXPx,
  centerYPx: z.centerYPx,
  widthPx: geo.box.widthPx,
  heightPx: geo.box.heightPx,
})));

await page.screenshot({ path: screenshotOut, fullPage: true });
await browser.close();

const printedExpected = geo.zones.map((z) => ({
  letter: z.letter,
  centerXPx: geo.box.centerXPx,
  centerYPx: z.centerYPx,
  widthPx: geo.box.widthPx,
  heightPx: geo.box.heightPx,
}));

const maxCenterDelta = Math.max(
  ...metrics.map((m) => Math.max(Math.abs(m.centerDeltaPx.x), Math.abs(m.centerDeltaPx.y)))
);
const overlayMatchesSpec = metrics.every(
  (m) =>
    Math.abs(m.centerDeltaPx.x) <= 1 &&
    Math.abs(m.centerDeltaPx.y) <= 1 &&
    Math.abs(m.overlaySizePx.w - m.expectedSizePx.w) <= 1 &&
    Math.abs(m.overlaySizePx.h - m.expectedSizePx.h) <= 1
);

const report = {
  image: imgPath,
  geometryVersion,
  screenshot: screenshotOut,
  printedBoxSpecPx: printedExpected,
  runtimeOverlayMetrics: metrics,
  overlayMatchesCanonicalSpec: overlayMatchesSpec,
  maxOverlayCenterDeltaPx: +maxCenterDelta.toFixed(2),
  acceptance: {
    overlayMatchesSpec,
    printedVsOverlayWithin2px: "requires vision on screenshot — overlay is placed at canonical centres on the 600×600 artboard; printed boxes were authored at the same coordinates in generate-reflex-arc-v1-display.mjs",
    dBoxBottomPx: geo.zones[3].centerYPx + geo.box.heightPx / 2,
    dBoxWithin600: geo.zones[3].centerYPx + geo.box.heightPx / 2 <= 600,
    leftClipWidthPx: geo.box.centerXPx - geo.box.widthPx / 2 - 8,
  },
};

console.log(JSON.stringify(report, null, 2));
