/**
 * Capture Edit Lesson layout regression screenshots (requires logged-in session).
 *
 *   EDIT_LESSON_URL=http://localhost:3000/edit-lesson/<id> \
 *   EDIT_LESSON_AUTH_COOKIE="token=..." \
 *   node scripts/editor-layout-regression-screenshot.mjs
 */
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

let puppeteer;
try {
  puppeteer = require(path.join(root, "node_modules", "puppeteer"));
} catch {
  console.error("Install puppeteer in repo root: npm install -D puppeteer");
  process.exit(1);
}

const url =
  process.env.EDIT_LESSON_URL ||
  "http://localhost:3000/edit-lesson/6a1c7b28e2b056a760772243";
const outDir = path.join(root, "docs/teacher-brain/screenshots/editor-layout");
mkdirSync(outDir, { recursive: true });

const shots = [
  {
    file: "editor-layout-full-page.png",
    width: 1680,
    height: 1200,
    clip: null,
  },
  {
    file: "editor-layout-lesson-actions-rail.png",
    selector: ".edit-lesson-outside-actions-rail, .edit-lesson-top-action-row",
  },
  {
    file: "editor-layout-teacher-editor-rail.png",
    selector: ".edit-lesson-left-rail",
  },
  {
    file: "editor-layout-lesson-details.png",
    selector: ".edit-lesson-main-column",
  },
  {
    file: "editor-layout-preview-rail.png",
    selector: ".edit-lesson-preview-rail, #edit-lesson-preview",
  },
];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

if (process.env.EDIT_LESSON_AUTH_COOKIE) {
  const [name, ...rest] = process.env.EDIT_LESSON_AUTH_COOKIE.split("=");
  await page.setCookie({
    name,
    value: rest.join("="),
    url: new URL(url).origin,
  });
}

await page.setViewport({ width: 1680, height: 1200 });
await page.goto(url, { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForSelector(".edit-lesson-editor-column, .edit-lesson-page", { timeout: 60000 });

for (const shot of shots) {
  const outPath = path.join(outDir, shot.file);
  if (shot.selector) {
    const el = await page.$(shot.selector);
    if (!el) {
      console.warn("Skip (not found):", shot.selector, "→", shot.file);
      continue;
    }
    await el.screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage: shot.clip === null });
  }
  console.log("Wrote", outPath);
}

await browser.close();
