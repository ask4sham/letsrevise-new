/**
 * One-shot browser repro for embedded exam question remount investigation.
 * Run: node frontend/scripts/exam-remount-repro.cjs
 * Requires: frontend on :3000, backend on :5000, playwright chromium installed.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../backend/.env") });
const jwt = require("jsonwebtoken");
const { chromium } = require("playwright");

const LESSON_ID = "6a4a4c71c3c0b81fc903a2e8";
const TEACHER_ID = "69d56606a674b9e6d56a63d3";
const BASE_URL = process.env.EXAM_REPRO_BASE_URL || "http://localhost:3000";

function getJwtSecret() {
  const candidates = [
    process.env.JWT_SECRET,
    process.env.JWT_SECRET_KEY,
    process.env.JWT_KEY,
    process.env.SECRET,
  ];
  for (const raw of candidates) {
    const secret = typeof raw === "string" ? raw.trim() : "";
    if (secret) return secret;
  }
  throw new Error("JWT secret missing from backend/.env");
}

async function buildTeacherAuth() {
  const token = jwt.sign(
    { user: { id: TEACHER_ID, userType: "teacher" } },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "1h" }
  );

  const userPayload = {
    id: TEACHER_ID,
    email: "ask4sham@yahoo.co.uk",
    userType: "teacher",
    firstName: "Sham",
    lastName: "Sharma",
    verificationStatus: "verified",
    emailVerified: true,
  };

  return { token, user: userPayload };
}

async function main() {
  const { token, user } = await buildTeacherAuth();
  const logs = [];
  const lessonUrl = `${BASE_URL}/#/lesson/${LESSON_ID}?examRemountDebug=1`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(
    ({ token, user }) => {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    },
    { token, user }
  );
  const page = await context.newPage();

  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("[exam-remount]")) {
      logs.push(text);
    }
  });

  let typingWorked = false;
  let disabled = null;
  let readOnly = null;
  let beforeValue = "";
  let afterValue = "";
  let pageSnippet = "";

  try {
    console.log(`\n=== Navigating to ${lessonUrl} ===\n`);
    await page.goto(lessonUrl, { waitUntil: "networkidle", timeout: 120000 });

    pageSnippet = await page.locator("body").innerText().then((t) => t.slice(0, 1200)).catch(() => "");

    const textarea = page.locator(".exam-composite__answer-input").first();
    await textarea.waitFor({ state: "visible", timeout: 120000 });
    await page.waitForTimeout(1500);

    beforeValue = await textarea.inputValue();
    await textarea.click();
    await page.waitForTimeout(300);

    const typed = "fhb";
    await textarea.pressSequentially(typed, { delay: 80 });
    await page.waitForTimeout(500);

    afterValue = await textarea.inputValue();
    typingWorked = afterValue.includes(typed);
    disabled = await textarea.isDisabled();
    readOnly = await textarea.evaluate((el) => el.readOnly);
  } finally {
    await browser.close();

    console.log("=== PAGE SNIPPET (first 1200 chars) ===");
    console.log(pageSnippet || "(empty)");

    console.log("\n=== TYPING RESULT ===");
    console.log({
      beforeValue,
      afterValue,
      typingWorked,
      disabled,
      readOnly,
    });

    const mountCount = logs.filter((l) => l.includes("CompositeExamQuestion MOUNT")).length;
    const unmountCount = logs.filter((l) => l.includes("CompositeExamQuestion UNMOUNT")).length;
    const unmountDuringTyping = (() => {
      const focusIdx = logs.findIndex((l) => l.includes("textarea focused"));
      if (focusIdx < 0) return false;
      return logs.slice(focusIdx).some((l) => l.includes("CompositeExamQuestion UNMOUNT"));
    })();

    console.log("\n=== SUMMARY ===");
    console.log({
      totalExamRemountLogs: logs.length,
      compositeMounts: mountCount,
      compositeUnmounts: unmountCount,
      unmountAfterFocus: unmountDuringTyping,
      typingWorked,
    });

    console.log("\n=== FULL [exam-remount] TIMELINE ===\n");
    for (const line of logs) {
      console.log(line);
    }

    if (!typingWorked && !unmountDuringTyping && logs.length > 0) {
      console.log(
        "\nNOTE: Typing failed but no UNMOUNT after focus — likely focus/disabled/pointer-events, not remount."
      );
    }
    if (!typingWorked && unmountDuringTyping) {
      console.log("\nNOTE: Typing failed with UNMOUNT after focus — remount theory supported.");
    }
    if (typingWorked && unmountDuringTyping) {
      console.log("\nNOTE: Typing worked despite unmount after focus — intermittent race.");
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
