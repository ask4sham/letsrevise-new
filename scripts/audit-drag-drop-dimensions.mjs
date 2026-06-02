/**
 * Browser audit — drag-drop TTI main layout dimensions + fit check.
 * Run: node scripts/audit-drag-drop-dimensions.mjs [--screenshot=path]
 */
import { createRequire } from "module";
import { readFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const puppeteer = require(path.join(root, "node_modules", "puppeteer"));

const screenshotArg = process.argv.find((a) => a.startsWith("--screenshot="));
const screenshotPath = screenshotArg
  ? path.resolve(screenshotArg.split("=")[1])
  : path.join(root, "docs/design/validation/tti-visual-tuning-after.png");

const cssFiles = [
  "frontend/src/components/lesson/lessonImageCard.css",
  "frontend/src/components/lesson/dragDropMatchBlock.css",
  "frontend/src/components/lesson/dragDropDiagramWorksheetLayout.css",
  "frontend/src/components/lesson/dragDropTextToImageLayout.css",
];
const inlineCss = cssFiles.map((rel) => readFileSync(path.join(root, rel), "utf8")).join("\n");

const portraitPath = path.join(
  root,
  "backend/public/visuals/Metabolism/Nervious system/Nervous-response-drag-drop-portrait.png"
);
const portraitImg = `data:image/png;base64,${readFileSync(portraitPath).toString("base64")}`;

const contractZones = [
  { letter: "A", left: 82.67, top: 33.04 },
  { letter: "B", left: 82.67, top: 51.85 },
  { letter: "C", left: 82.67, top: 65.63 },
  { letter: "D", left: 82.67, top: 80.44 },
];
const zoneButtonsHtml = contractZones
  .map(
    ({ letter, left, top }) =>
      `<button type="button" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed drag-drop-match__diagram-zone--filled drag-drop-match__diagram-zone--chip-tone-0" style="left:${left}%;top:${top}%"><span class="drag-drop-match__diagram-zone-boxed-fill"><span class="drag-drop-match__diagram-zone-boxed-text">Sensory neurone</span></span></button>`
  )
  .join("\n");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${inlineCss.replace(/<\/style/gi, "<\\/style")}</style>
<style>
  body { margin: 0; background: #f1f5f9; font-family: Arial, Helvetica, sans-serif; }
  .audit-shell { max-width: 880px; margin: 24px auto; padding: 0 16px; box-sizing: border-box; }
  [data-lesson-presentation="v12"] { --ds-content-max: 880px; }
</style>
</head>
<body>
  <div class="audit-shell" data-lesson-presentation="v12">
    <div class="drag-drop-match drag-drop-match--text-to-image drag-drop-match--tti-main">
      <div class="drag-drop-match__diagram-worksheet" data-ddm-diagram-layout="side-by-side-v1">
        <div class="drag-drop-match__diagram-worksheet-stage">
          <div class="drag-drop-match__diagram-panel">
            <div class="drag-drop-match__diagram-visual">
              <div class="drag-drop-match__diagram-image-container">
                <div class="lesson-image-card drag-drop-match__diagram-frame">
                  <img class="drag-drop-match__diagram-img" src="${portraitImg}" alt="Reflex arc" />
                </div>
                <div class="drag-drop-match__diagram-overlay">${zoneButtonsHtml}</div>
              </div>
            </div>
          </div>
          <div class="drag-drop-match__diagram-bank">
            <div class="drag-drop-match__answers drag-drop-match__answers--tti">
              <div class="drag-drop-match__card-list drag-drop-match__card-list--tti">
                <button type="button" class="drag-drop-match__card drag-drop-match__card--tti-prompt"><span class="drag-drop-match__card-text drag-drop-match__card-text--tti">Sensory neurone</span></button>
                <button type="button" class="drag-drop-match__card drag-drop-match__card--tti-prompt"><span class="drag-drop-match__card-text drag-drop-match__card-text--tti">Relay neurone</span></button>
                <button type="button" class="drag-drop-match__card drag-drop-match__card--tti-prompt"><span class="drag-drop-match__card-text drag-drop-match__card-text--tti">Motor neurone</span></button>
                <button type="button" class="drag-drop-match__card drag-drop-match__card--tti-prompt"><span class="drag-drop-match__card-text drag-drop-match__card-text--tti">Effector</span></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("img")?.naturalWidth > 0);

  mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const data = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    };
    const card = document.querySelector(".drag-drop-match__card--tti-prompt");
    const cardR = card?.getBoundingClientRect();
    const zone = document.querySelector(".drag-drop-match__diagram-zone--tti-boxed");
    const zoneR = zone?.getBoundingClientRect();
    const text = zone?.querySelector(".drag-drop-match__diagram-zone-boxed-text");
    const textR = text?.getBoundingClientRect();
    const textCs = text ? getComputedStyle(text) : null;
    const img = document.querySelector(".drag-drop-match__diagram-img");
    const imgR = img?.getBoundingClientRect();
    return {
      panel: pick(".drag-drop-match__diagram-panel"),
      bank: pick(".drag-drop-match__diagram-bank"),
      imageContainer: pick(".drag-drop-match__diagram-image-container"),
      img: imgR ? { width: imgR.width, height: imgR.height } : null,
      card: cardR ? { width: cardR.width, height: cardR.height } : null,
      overlayBox: zoneR ? { width: zoneR.width, height: zoneR.height } : null,
      placedText: textR ? { width: textR.width, height: textR.height } : null,
      textOverflow: textCs
        ? {
            overflow: textCs.overflow,
            textOverflow: textCs.textOverflow,
            scrollWidth: text?.scrollWidth,
            clientWidth: text?.clientWidth,
          }
        : null,
    };
  });

  await browser.close();

  const imgW = data.img?.width ?? 0;
  const contractBoxW = (420 / 900) * imgW;
  const contractBoxH = (110 / 1350) * (data.img?.height ?? 0);
  const cardW = data.card?.width ?? 0;
  const boxW = data.overlayBox?.width ?? 0;
  const paddingEachSide = boxW > 0 && cardW > 0 ? (boxW - Math.min(cardW, data.placedText?.width ?? cardW)) / 2 : null;

  const fit = {
    cardFitsInOverlayWidth: cardW <= boxW,
    textNotTruncated: (data.textOverflow?.scrollWidth ?? 0) <= (data.textOverflow?.clientWidth ?? 0) + 1,
    contractBoxW,
    contractBoxH,
    horizontalPaddingEstimate: paddingEachSide,
  };

  console.log(
    JSON.stringify(
      {
        viewport: "1280×900",
        screenshot: screenshotPath,
        measurements: data,
        contractDisplayBox: { width: contractBoxW, height: contractBoxH },
        fit,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
