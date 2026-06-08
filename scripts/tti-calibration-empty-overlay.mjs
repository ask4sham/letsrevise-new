/** Empty dotted overlay alignment on a TTI display PNG (no filled-card nudge). */
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const puppeteer = require(path.join(root, "node_modules", "puppeteer"));
const { getTtiBoxGeometryLayout } = require(path.join(root, "lib", "ttiBoxGeometry.js"));

const imgPath = path.resolve(
  process.argv[2] || path.join(root, "docs/design/validation/reflex-arc-tti-v1.display.png")
);
const geo = getTtiBoxGeometryLayout("square-display", "tti-box-geometry-v1");
const css = [
  "frontend/src/components/lesson/lessonImageCard.css",
  "frontend/src/components/lesson/dragDropMatchBlock.css",
  "frontend/src/components/lesson/dragDropDiagramWorksheetLayout.css",
]
  .map((rel) => readFileSync(path.join(root, rel), "utf8"))
  .join("\n");
const imgB64 = readFileSync(imgPath).toString("base64");
const zoneHtml = geo.zones
  .map(
    (z) =>
      `<button type="button" data-letter="${z.letter}" class="drag-drop-match__diagram-zone drag-drop-match__diagram-zone--tti-boxed" style="left:${geo.box.centerXPct}%;top:${z.centerYPct}%"></button>`
  )
  .join("");
const html = `<!DOCTYPE html><html><head><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>
<div class="drag-drop-match drag-drop-match--tti-main" style="width:560px;margin:20px auto">
<div class="drag-drop-match__diagram-worksheet"><div class="drag-drop-match__diagram-image-container" id="container">
<div class="lesson-image-card drag-drop-match__diagram-frame"><img class="drag-drop-match__diagram-img" id="img" src="data:image/png;base64,${imgB64}" alt=""/></div>
<div class="drag-drop-match__diagram-overlay" style="--tti-boxed-w:${geo.box.widthPct}%;--tti-boxed-h:${geo.box.heightPct}%">${zoneHtml}</div>
</div></div></div></body></html>`;

const screenshotOut = path.join(
  root,
  "docs/design/validation/tti-calibration-reflex-arc-v1-empty-overlay.png"
);
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 800, height: 900 });
await page.setContent(html, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelector("img")?.complete);

const expected = geo.zones.map((z) => ({
  letter: z.letter,
  centerXPx: geo.box.centerXPx,
  centerYPx: z.centerYPx,
  widthPx: geo.box.widthPx,
  heightPx: geo.box.heightPx,
}));

const metrics = await page.evaluate((exp) => {
  const container = document.getElementById("container");
  const img = document.getElementById("img");
  const cRect = container.getBoundingClientRect();
  const iRect = img.getBoundingClientRect();
  return [...document.querySelectorAll("[data-letter]")].map((el) => {
    const letter = el.getAttribute("data-letter");
    const r = el.getBoundingClientRect();
    const rel = exp.find((e) => e.letter === letter);
    const expCenterX = (rel.centerXPx / 600) * iRect.width + iRect.left - cRect.left;
    const expCenterY = (rel.centerYPx / 600) * iRect.height + iRect.top - cRect.top;
    const expW = (rel.widthPx / 600) * iRect.width;
    const expH = (rel.heightPx / 600) * iRect.height;
    const actCenterX = r.left + r.width / 2 - cRect.left;
    const actCenterY = r.top + r.height / 2 - cRect.top;
    return {
      letter,
      centerDeltaPx: {
        x: +(actCenterX - expCenterX).toFixed(2),
        y: +(actCenterY - expCenterY).toFixed(2),
      },
      sizeDeltaPx: {
        w: +(r.width - expW).toFixed(2),
        h: +(r.height - expH).toFixed(2),
      },
    };
  });
}, expected);

await page.screenshot({ path: screenshotOut });
await browser.close();

const maxDelta = Math.max(
  ...metrics.flatMap((m) => [Math.abs(m.centerDeltaPx.x), Math.abs(m.centerDeltaPx.y)])
);
console.log(
  JSON.stringify(
    {
      image: imgPath,
      screenshot: screenshotOut,
      emptyOverlayMetrics: metrics,
      maxCenterDeltaPx: maxDelta,
      within2px: maxDelta <= 2,
    },
    null,
    2
  )
);
