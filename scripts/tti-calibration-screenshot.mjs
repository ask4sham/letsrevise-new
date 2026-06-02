/**
 * One-off: render TTI boxed overlay on Reflex Arc display PNG for calibration review.
 * Run: node scripts/tti-calibration-screenshot.mjs
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
];
const inlineCss = cssFiles.map((rel) => readFileSync(path.join(root, rel), "utf8")).join("\n");

const imgPath = path.join(root, "docs/design/validation/calibrated-respone2-display.png");
const imgB64 = readFileSync(imgPath).toString("base64");

const zones = [
  { letter: "A", x: 70.25, y: 25.92 },
  { letter: "B", x: 70.25, y: 48.08 },
  { letter: "C", x: 70.25, y: 70.08 },
  { letter: "D", x: 70.25, y: 91.08 },
];

const zoneHtml = zones
  .map(
    ({ letter, x, y }) =>
      `<button type="button" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed drag-drop-match__diagram-zone--active" style="left:${x}%;top:${y}%">` +
      `<span class="drag-drop-match__diagram-zone-boxed-status-only">${letter}</span></button>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>${inlineCss.replace(/<\/style/gi, "<\\/style")}</style>
<style>
  body { margin: 0; background: #f1f5f9; font-family: Arial, sans-serif; }
  .wrap { max-width: 560px; margin: 24px auto; padding: 0 12px; }
</style></head><body>
<div class="wrap">
  <div class="drag-drop-match drag-drop-match--tti-main">
    <div class="drag-drop-match__diagram-worksheet" data-ddm-diagram-layout="side-by-side-v1">
    <div class="drag-drop-match__diagram-image-container">
      <div class="lesson-image-card drag-drop-match__diagram-frame">
        <img class="drag-drop-match__diagram-img" src="data:image/png;base64,${imgB64}" alt="Reflex arc" />
      </div>
      <div class="drag-drop-match__diagram-overlay" style="--tti-boxed-w:21.67%;--tti-boxed-h:10.33%">
        ${zoneHtml}
      </div>
    </div>
    </div>
  </div>
</div>
</body></html>`;

const outPath = path.join(root, "docs/design/validation/tti-calibration-respone2-after.png");
mkdirSync(path.dirname(outPath), { recursive: true });

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
await page.setContent(html, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("img")?.complete);
await page.screenshot({ path: outPath });
await browser.close();
console.log("Wrote", outPath);
