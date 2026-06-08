/** Verify TTI overlay alignment against live-reflex-display.png printed boxes. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const puppeteer = require(path.join(root, "node_modules", "puppeteer"));
const { getTtiBoxGeometryLayout } = require(path.join(root, "lib", "ttiBoxGeometry.js"));

const geometryVersion = process.argv.includes("--legacy") ? "legacy" : "tti-box-geometry-v1";
const geo = getTtiBoxGeometryLayout("square-display", geometryVersion);

const css = [
  "frontend/src/components/lesson/lessonImageCard.css",
  "frontend/src/components/lesson/dragDropMatchBlock.css",
  "frontend/src/components/lesson/dragDropDiagramWorksheetLayout.css",
  "frontend/src/components/lesson/ttiPlacedAnswerMagnify.css",
]
  .map((rel) => readFileSync(path.join(root, rel), "utf8"))
  .join("\n");

const imgPath = path.join(root, "docs/design/validation/live-reflex-display.png");
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
}));

const zoneHtml = zones
  .map(
    ({ x, y, text, tone }) =>
      `<button type="button" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed drag-drop-match__diagram-zone--filled drag-drop-match__diagram-zone--chip-tone-${tone}" style="left:${x}%;top:${y}%">` +
      `<span class="drag-drop-match__diagram-zone-boxed-fill"><span class="drag-drop-match__diagram-zone-boxed-text">${text}</span></span></button>`
  )
  .join("\n");

const html = `<!DOCTYPE html><html><head><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>
<div class="drag-drop-match drag-drop-match--tti-main" style="max-width:560px;margin:20px auto">
<div class="drag-drop-match__diagram-worksheet">
<div class="drag-drop-match__diagram-image-container">
<div class="lesson-image-card drag-drop-match__diagram-frame"><img class="drag-drop-match__diagram-img" src="data:image/png;base64,${imgB64}" alt="" /></div>
<div class="drag-drop-match__diagram-overlay" style="--tti-boxed-w:${geo.box.widthPct}%;--tti-boxed-h:${geo.box.heightPct}%">${zoneHtml}</div>
</div></div></div></body></html>`;

const suffix = geometryVersion === "legacy" ? "legacy" : "v1";
const out = path.join(root, `docs/design/validation/tti-calibration-live-reflex-${suffix}.png`);
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
await page.setContent(html, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("img")?.complete);
await page.screenshot({ path: out });
await browser.close();
console.log(`Wrote ${out} (${geometryVersion})`);
