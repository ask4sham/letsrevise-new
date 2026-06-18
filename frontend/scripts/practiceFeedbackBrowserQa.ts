/**
 * P3.2C browser QA — real PracticeShortQuestion in Chromium.
 * Run: npx tsx scripts/practiceFeedbackBrowserQa.ts
 */
import { chromium, type Page } from "playwright";
import { createServer, type Server } from "http";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BROWSER_QA_CASES, type BrowserQaCase } from "./practiceFeedbackBrowserQa.cases";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, ".tmp-browser-qa");
const BUNDLE_PATH = join(OUT_DIR, "bundle.js");

function buildBundle() {
  mkdirSync(OUT_DIR, { recursive: true });
  execSync(
    `npx esbuild "${join(__dirname, "practiceFeedbackBrowserQa.entry.tsx")}" --bundle --outfile="${BUNDLE_PATH}" --format=esm --loader:.tsx=tsx --loader:.ts=ts --jsx=automatic --define:process.env.NODE_ENV=\\"production\\"`,
    { stdio: "inherit", cwd: join(__dirname, "..") }
  );
}

function startServer(): Promise<{ server: Server; url: string }> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Practice QA</title></head>
<body><div id="root"></div><script>window.process = { env: { NODE_ENV: "production" } };</script><script type="module" src="/bundle.js"></script></body>
</html>`;

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === "/" || req.url?.startsWith("/?")) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        return;
      }
      if (req.url === "/bundle.js") {
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(readFileSync(BUNDLE_PATH));
        return;
      }
      res.writeHead(404);
      res.end("Not found");
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to bind QA server"));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${addr.port}` });
    });
  });
}

function parseScore(text: string): { score: number; max: number } | null {
  const m = text.match(/Estimated score \(guide\):\s*(\d+)\s*\/\s*(\d+)/i);
  if (!m) return null;
  return { score: Number(m[1]), max: Number(m[2]) };
}

async function runCase(page: Page, baseUrl: string, qaCase: BrowserQaCase) {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(`${baseUrl}/?case=${encodeURIComponent(qaCase.id)}`, { waitUntil: "domcontentloaded" });

  try {
    await page.waitForSelector('[data-testid="qa-title"]', { timeout: 15000 });
  } catch {
    const html = await page.content();
    throw new Error(
      `Failed to render ${qaCase.id}. Console: ${consoleErrors.join(" | ") || "none"}. HTML snippet: ${html.slice(0, 500)}`
    );
  }

  const seeded = await page.locator('[data-testid="qa-seed-answer"]').inputValue();
  await page.locator('textarea[placeholder="Type your answer…"]').fill(seeded);
  await page.getByRole("button", { name: "Check answer" }).click();

  await page.waitForSelector('[data-testid="practice-short-your-answer"]');
  const bodyText = await page.locator("body").innerText();
  const issues: string[] = [];

  const scoreVisible = /Estimated score \(guide\):/i.test(bodyText);
  const guidedVisible = (await page.locator('[data-testid="practice-short-guided-self-check"]').count()) > 0;

  if (qaCase.expectEstimatedScore) {
    if (!scoreVisible) issues.push("expected estimated score to be shown");
    const parsed = parseScore(bodyText);
    if (!parsed) {
      issues.push("could not parse estimated score");
    } else {
      if (qaCase.minScore != null && parsed.score < qaCase.minScore) {
        issues.push(`score ${parsed.score}/${parsed.max} below minimum ${qaCase.minScore}/${qaCase.maxScore ?? parsed.max}`);
      }
      if (qaCase.maxScore != null && parsed.score > qaCase.maxScore) {
        issues.push(`score ${parsed.score}/${parsed.max} above maximum ${qaCase.maxScore}`);
      }
    }
    if (guidedVisible) issues.push("guided self-check shown when score expected");
  } else {
    if (scoreVisible) issues.push("estimated score shown when confidence should be low");
    if (!guidedVisible) issues.push("guided self-check not shown for low-confidence case");
  }

  for (const re of qaCase.mustInclude) {
    if (!re.test(bodyText)) issues.push(`missing required pattern ${re}`);
  }
  for (const re of qaCase.mustExclude) {
    if (re.test(bodyText)) issues.push(`forbidden pattern matched ${re}`);
  }

  const includedItems = await page.locator('[data-testid="practice-short-included"] li').allTextContents();
  const uniqueIncluded = new Set(includedItems.map((t) => t.trim()));
  if (includedItems.length > 0 && uniqueIncluded.size !== includedItems.length) {
    issues.push("duplicate You included entries");
  }

  return {
    id: qaCase.id,
    pass: issues.length === 0,
    details: issues.length ? issues.join("; ") : "OK",
    scoreText: bodyText.match(/Estimated score \(guide\):[^\n]*/i)?.[0] ?? "(no score)",
    includedCount: includedItems.length,
  };
}

async function main() {
  buildBundle();
  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const results: Awaited<ReturnType<typeof runCase>>[] = [];

  try {
    for (const qaCase of BROWSER_QA_CASES) {
      const page = await browser.newPage();
      results.push(await runCase(page, url, qaCase));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));

  console.log("\n=== P3.2C Practice Feedback Browser QA (Chromium + PracticeShortQuestion) ===\n");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id}`);
    console.log(`  ${r.scoreText} | included: ${r.includedCount}`);
    console.log(`  ${r.details}\n`);
  }

  const allPass = results.every((r) => r.pass);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
