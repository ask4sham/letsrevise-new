/**
 * Browser verification for lesson lifecycle stability fix.
 * Run: node frontend/scripts/verify-lesson-lifecycle.cjs
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../backend/.env") });
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require(path.join(__dirname, "../../backend/utils/jwtSecret"));
const { chromium } = require("playwright");

const BASE = process.env.EXAM_REPRO_BASE_URL || "http://localhost:3002";
const PLACENTA_ID = "6a4a4c71c3c0b81fc903a2e8";
const AQA_ID = process.env.VERIFY_AQA_LESSON_ID || "69ac52012ab324862fa7f493";

const BACKGROUND_BAD_PATTERNS = [
  /setLesson\(null\)/,
  /CLEAR cache.*lesson is null/i,
  /CompositeExamQuestion UNMOUNT/,
];

function badLines(logs) {
  const bad = [];
  for (const line of logs) {
    for (const pat of BACKGROUND_BAD_PATTERNS) {
      if (pat.test(line)) bad.push(line);
    }
  }
  return bad;
}

async function authContext(browser) {
  const token = jwt.sign(
    { user: { id: "69d56606a674b9e6d56a63d3", userType: "teacher" } },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "1h" }
  );
  const user = {
    id: "69d56606a674b9e6d56a63d3",
    email: "ask4sham@yahoo.co.uk",
    userType: "teacher",
    firstName: "Sham",
    verificationStatus: "verified",
    emailVerified: true,
  };
  const context = await browser.newContext();
  await context.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    },
    { token, user: { ...user, id: "69d56606a674b9e6d56a63d3" } }
  );
  return context;
}

async function waitForLesson(page, lessonId) {
  const url = `${BASE}/#/lesson/${lessonId}?examRemountDebug=1`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2500);
}

async function typeInComposite(page, text) {
  const textarea = page.locator(".exam-composite__answer-input").first();
  await textarea.waitFor({ state: "visible", timeout: 30000 });
  await textarea.click();
  await textarea.pressSequentially(text, { delay: 60 });
  await page.waitForTimeout(400);
  return (await textarea.inputValue()).includes(text);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let allPass = true;

  console.log("\n=== 1. Edexcel composite — Role of the Placenta ===\n");
  const logs = [];
  const context = await authContext(browser);
  const page = await context.newPage();
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[exam-remount]")) logs.push(t);
  });

  await waitForLesson(page, PLACENTA_ID);
  const hasComposite = (await page.locator(".exam-composite").count()) > 0;
  const coldTyping = hasComposite ? await typeInComposite(page, "stable") : false;
  console.log("  composite block:", hasComposite ? "yes" : "no");
  console.log("  cold load typing:", coldTyping ? "PASS" : hasComposite ? "FAIL" : "n/a");
  if (hasComposite && !coldTyping) allPass = false;

  const hasPractice = (await page.locator("text=Practice Questions").count()) > 0;
  const hasQuiz = (await page.locator("text=Quiz").count()) > 0;
  console.log("  practice section:", hasPractice ? "visible" : "not found");
  console.log("  quiz section:", hasQuiz ? "visible" : "not found");
  if (!hasPractice || !hasQuiz) allPass = false;

  const singleOnPlacenta =
    (await page.locator(".exam-question-block:not(.exam-question-block--composite)").count()) > 0;
  const compositeOnPlacenta = hasComposite;
  console.log("  single exam block:", singleOnPlacenta ? "yes" : "no (composite only)");
  console.log("  composite exam block:", compositeOnPlacenta ? "yes" : "no");

  console.log("\n=== 2. Same-lesson background refresh (no navigation) ===\n");
  await page.waitForFunction(() => typeof window.__lessonViewRefetch === "function", {
    timeout: 30000,
  });
  logs.length = 0;
  await page.evaluate(() => window.__lessonViewRefetch());
  await page.waitForTimeout(4000);

  const bgBad = badLines(logs);
  const hasBgRefresh = logs.some((l) => l.includes("background refresh"));
  const bgTyping = hasComposite ? await typeInComposite(page, "afterbg") : false;

  console.log("  background refresh logged:", hasBgRefresh ? "yes" : "no");
  console.log("  typing after bg refresh:", bgTyping ? "PASS" : hasComposite ? "FAIL" : "n/a");
  console.log("  bad patterns:", bgBad.length ? bgBad : "none");
  if (!hasBgRefresh || bgBad.length || (hasComposite && !bgTyping)) allPass = false;

  await context.close();

  console.log("\n=== 3. AQA lesson ===\n");
  const aqaLogs = [];
  const aqaCtx = await authContext(browser);
  const aqaPage = await aqaCtx.newPage();
  aqaPage.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[exam-remount]")) aqaLogs.push(t);
  });
  await waitForLesson(aqaPage, AQA_ID);

  const aqaPractice = (await aqaPage.locator("text=Practice Questions").count()) > 0;
  const aqaQuiz = (await aqaPage.locator("text=Quiz").count()) > 0;
  const aqaSingle = (await aqaPage.locator(".exam-question-block:not(.exam-question-block--composite)").count()) > 0;
  const aqaComposite = (await aqaPage.locator(".exam-composite").count()) > 0;
  const aqaTitle = await aqaPage.locator("h1, h2").first().textContent().catch(() => "");

  console.log("  lesson:", AQA_ID, aqaTitle ? `(${aqaTitle.trim().slice(0, 40)})` : "");
  console.log("  practice section:", aqaPractice ? "visible" : "not found");
  console.log("  quiz section:", aqaQuiz ? "visible" : "not found");
  console.log("  single exam block:", aqaSingle ? "yes" : "no");
  console.log("  composite exam block:", aqaComposite ? "yes" : "no");
  if (!aqaPractice || !aqaQuiz) allPass = false;

  await aqaCtx.close();
  await browser.close();

  console.log("\n=== OVERALL ===", allPass ? "PASS" : "FAIL");
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
