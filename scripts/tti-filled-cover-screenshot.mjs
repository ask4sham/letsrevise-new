/** Validation: filled green cards cover all four printed boxes. */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const puppeteer = require(path.join(root, "node_modules", "puppeteer"));

const css = [
  "frontend/src/components/lesson/lessonImageCard.css",
  "frontend/src/components/lesson/dragDropMatchBlock.css",
  "frontend/src/components/lesson/dragDropDiagramWorksheetLayout.css",
  "frontend/src/components/lesson/ttiPlacedAnswerMagnify.css",
]
  .map((rel) => readFileSync(path.join(root, rel), "utf8"))
  .join("\n");

const imgB64 = readFileSync(
  path.join(root, "docs/design/validation/calibrated-respone2-display.png")
).toString("base64");

const boxes = [
  { y: 25.92, text: "Sensory neurone" },
  { y: 48.08, text: "Relay neurone" },
  { y: 70.08, text: "Motor neurone" },
  { y: 91.08, text: "contraction or secretion Effector (muscle or gland)" },
];

const zoneHtml = boxes
  .map(
    ({ y, text }) =>
      `<button type="button" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed drag-drop-match__diagram-zone--filled drag-drop-match__diagram-zone--correct" style="left:70.25%;top:${y}%"><span class="drag-drop-match__diagram-zone-boxed-fill"><span class="drag-drop-match__diagram-zone-boxed-text">${text}</span><span class="drag-drop-match__diagram-zone-boxed-status drag-drop-match__diagram-zone-boxed-status--ok">✓</span></span></button>`
  )
  .join("\n");

const html = `<!DOCTYPE html><html><head><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>
<div class="drag-drop-match drag-drop-match--tti-main" style="max-width:560px;margin:20px auto">
<div class="drag-drop-match__diagram-worksheet">
<div class="drag-drop-match__diagram-image-container">
<div class="lesson-image-card drag-drop-match__diagram-frame"><img class="drag-drop-match__diagram-img" src="data:image/png;base64,${imgB64}" alt="" /></div>
<div class="drag-drop-match__diagram-overlay" style="--tti-boxed-w:21.67%;--tti-boxed-h:10.33%">${zoneHtml}</div>
</div></div></div></body></html>`;

const out = path.join(root, "docs/design/validation/tti-filled-cover-all-boxes.png");
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
await page.setContent(html, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("img")?.complete);
await page.screenshot({ path: out });
await browser.close();
console.log("Wrote", out);
