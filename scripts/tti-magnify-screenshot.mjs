/**
 * Screenshot: TTI placed-answer magnify (green box + open modal).
 * Run: node scripts/tti-magnify-screenshot.mjs
 */
import { readFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const puppeteer = require(path.join(root, "node_modules", "puppeteer"));

const cssFiles = [
  "frontend/src/components/lesson/lessonImageCard.css",
  "frontend/src/components/lesson/dragDropMatchBlock.css",
  "frontend/src/components/lesson/dragDropDiagramWorksheetLayout.css",
  "frontend/src/components/lesson/ttiPlacedAnswerMagnify.css",
];
const inlineCss = cssFiles.map((rel) => readFileSync(path.join(root, rel), "utf8")).join("\n");
const imgB64 = readFileSync(
  path.join(root, "docs/design/validation/calibrated-respone2-display.png")
).toString("base64");

function shell(showModal) {
  const modal = showModal
    ? `<div class="tti-placed-magnify__backdrop">
        <div class="tti-placed-magnify__dialog" role="dialog" aria-modal="true">
          <h2 class="tti-placed-magnify__title">Box D</h2>
          <div class="tti-placed-magnify__section">
            <div class="tti-placed-magnify__label">Concept card</div>
            <p class="tti-placed-magnify__answer">contraction or secretion Effector (muscle or gland)</p>
          </div>
          <div class="tti-placed-magnify__section">
            <div class="tti-placed-magnify__label">Answer</div>
            <p class="tti-placed-magnify__answer">Produces the response</p>
          </div>
          <div class="tti-placed-magnify__section">
            <div class="tti-placed-magnify__label">Explanation</div>
            <div class="tti-placed-magnify__explain">Produces the response is correct because the effector (muscle or gland) carries out the reflex action.</div>
          </div>
          <button type="button" class="tti-placed-magnify__close">Close</button>
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<style>${inlineCss.replace(/<\/style/gi, "<\\/style")}</style>
<style>body{margin:0;background:#f1f5f9;font-family:Arial,sans-serif}.wrap{max-width:560px;margin:24px auto;padding:0 12px}</style>
</head><body><div class="wrap">
<div class="drag-drop-match drag-drop-match--tti-main">
<div class="drag-drop-match__diagram-worksheet" data-ddm-diagram-layout="side-by-side-v1">
<div class="drag-drop-match__diagram-image-container">
<div class="lesson-image-card drag-drop-match__diagram-frame">
<img class="drag-drop-match__diagram-img" src="data:image/png;base64,${imgB64}" alt="Reflex arc" />
</div>
<div class="drag-drop-match__diagram-overlay" style="--tti-boxed-w:21.67%;--tti-boxed-h:10.33%">
<button type="button" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed drag-drop-match__diagram-zone--filled drag-drop-match__diagram-zone--correct" style="left:70.25%;top:25.92%;width:calc(21.67% * 1.17);height:calc(10.33% * 1.08);padding:2px 5px;border-color:#dcfce7;background:#dcfce7">
<span class="drag-drop-match__diagram-zone-boxed-fill">
<span class="drag-drop-match__diagram-zone-boxed-text">Sensory neurone</span>
<span class="drag-drop-match__diagram-zone-boxed-status drag-drop-match__diagram-zone-boxed-status--ok">✓</span>
<span class="tti-placed-magnify__btn" role="button" tabindex="0" aria-label="View full answer for box A"><span>🔍</span></span>
</span></button>
</div></div></div></div></div>${modal}</body></html>`;
}

const outDir = path.join(root, "docs/design/validation");
mkdirSync(outDir, { recursive: true });
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });

await page.setContent(shell(false), { waitUntil: "domcontentloaded" });
await page.screenshot({ path: path.join(outDir, "tti-magnify-green-box.png") });

await page.setContent(shell(true), { waitUntil: "domcontentloaded" });
await page.screenshot({ path: path.join(outDir, "tti-magnify-modal-open.png") });

await browser.close();
console.log("Wrote docs/design/validation/tti-magnify-green-box.png");
console.log("Wrote docs/design/validation/tti-magnify-modal-open.png");
