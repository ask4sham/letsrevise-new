/**
 * Phase 3H.1.5 manual acceptance — teacher-first SS1 opening order.
 * Usage: node backend/scripts/manualAcceptance3H15.js [--base-url http://localhost:5000]
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const axios = require("axios");
const fs = require("fs");

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:5000";

const ACCEPT_EMAIL = "phase3h15-accept@test.com";
const ACCEPT_PASSWORD = "accept3H15!test";

const LESSONS = [
  {
    name: "Homeostasis",
    topic: "Homeostasis",
    topicKey: "aqa-gcse-biology:homeostasis",
  },
  {
    name: "Structure and function of the nervous system",
    topic: "Structure and function of the nervous system",
    topicKey: "aqa-gcse-biology:homeostasis-and-response:nervous-system-structure",
  },
  {
    name: "The eye",
    topic: "The eye",
    topicKey: "aqa-gcse-biology:the-eye",
  },
];

const EXPECTED_FOUNDATION = [
  "LESSON OBJECTIVES",
  "PRIOR KNOWLEDGE",
  "DEFINITION",
  "WHY IT MATTERS",
  "CORE MODEL",
  "KEY EXAMPLES",
  "EXAM VOCABULARY",
  "SCENARIO",
  "CORE TEACHING",
];

function normalizeTitle(t) {
  return String(t || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function blockTitlesInOrder(pages, limit = 10) {
  const titles = [];
  for (const page of pages || []) {
    for (const block of page.blocks || []) {
      titles.push(block.title || block.role || block.type || "(untitled)");
      if (titles.length >= limit) return titles;
    }
  }
  return titles;
}

function checkFoundationOrder(titles) {
  const norm = titles.map(normalizeTitle);
  const scenarioIdx = norm.findIndex((t) => t.includes("SCENARIO") || t.includes("HOOK"));
  const checks = {
    scenarioIndex: scenarioIdx >= 0 ? scenarioIdx + 1 : null,
    scenarioBeforeBlock8: scenarioIdx >= 0 && scenarioIdx < 7,
    blocks3to7: norm.slice(2, 7),
    expectedBlocks3to7: EXPECTED_FOUNDATION.slice(2, 7),
    foundationMatch:
      norm.slice(2, 7).length >= 5 &&
      norm.slice(2, 7).every((t, i) => {
        const exp = EXPECTED_FOUNDATION[i + 2];
        return t.includes(exp) || exp.split(" ").every((w) => t.includes(w));
      }),
  };
  checks.pass =
    !checks.scenarioBeforeBlock8 &&
    checks.scenarioIndex === 8 &&
    checks.foundationMatch;
  return checks;
}

async function ensureTeacherToken() {
  try {
    const login = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: ACCEPT_EMAIL,
      password: ACCEPT_PASSWORD,
    });
    if (login.data?.token) return login.data.token;
  } catch (_) {
    /* register */
  }
  await axios
    .post(`${BASE_URL}/api/auth/register`, {
      firstName: "Phase3H15",
      lastName: "Accept",
      email: ACCEPT_EMAIL,
      password: ACCEPT_PASSWORD,
      userType: "teacher",
    })
    .catch((e) => {
      if (e.response?.status !== 400) throw e;
    });
  const login = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: ACCEPT_EMAIL,
    password: ACCEPT_PASSWORD,
  });
  if (!login.data?.token) throw new Error("Login failed");
  return login.data.token;
}

async function generateLesson(cfg, auth, maxAttempts = 6) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const genStart = Date.now();
    try {
      const gen = await axios.post(
        `${BASE_URL}/api/ai/generate-and-save`,
        {
          topic: cfg.topic,
          subject: "Biology",
          level: "GCSE",
          board: "AQA",
          tier: "higher",
          topicKey: cfg.topicKey,
          useLessonGeneratorV2: true,
          useLessonGeneratorV4: true,
          autoGenerateFromBanks: false,
        },
        { ...auth, timeout: 600000 }
      );
      const lessonId = gen.data?.lessonId || gen.data?.lesson?._id || gen.data?._id;
      if (!lessonId) throw new Error(`No lessonId for ${cfg.name}`);
      const lessonRes = await axios.get(`${BASE_URL}/api/lessons/${lessonId}`, auth);
      const lesson = lessonRes.data?.lesson || lessonRes.data;
      const reviewRes = await axios.get(`${BASE_URL}/api/lessons/${lessonId}/coverage-review`, auth);
      return {
        lessonId: String(lessonId),
        generationSeconds: ((Date.now() - genStart) / 1000).toFixed(1),
        attempts: attempt,
        pages: lesson.pages,
        review: reviewRes.data?.review || reviewRes.data,
      };
    } catch (err) {
      lastErr = err;
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.details ||
        err.response?.data?.msg ||
        err.message;
      const retryable =
        /structure validation|server_error|timeout|ECONNRESET|503|502|429/i.test(String(detail));
      if (!retryable || attempt === maxAttempts) throw err;
      console.warn(`  Attempt ${attempt} failed (${detail}); retrying…`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

async function main() {
  console.log("\n=== Phase 3H.1.5 Manual Acceptance ===");
  console.log("Base URL:", BASE_URL);
  console.log("Expected flags on backend:");
  [
    "TEACHER_BRAIN_TEACHER_FIRST_OPENING=1",
    "TEACHER_BRAIN_CONCEPT_COMPRESSION=1",
    "TEACHER_BRAIN_SUBTOPIC_BOUNDARY=2",
    "TEACHER_BRAIN_PRIORITY_ENGINE=1",
    "TEACHER_BRAIN_PEDAGOGY_ENGINE=1",
    "TEACHER_BRAIN_GCSE_REASONING_ENGINE=1",
  ].forEach((f) => console.log(" ", f));

  const health = await axios.get(`${BASE_URL}/api/health`);
  console.log("\nHealth:", health.data?.status, "| commit:", health.data?.commit);

  const token = await ensureTeacherToken();
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  const results = [];
  for (const cfg of LESSONS) {
    console.log(`\n--- Generating: ${cfg.name} ---`);
    const out = await generateLesson(cfg, auth);
    const titles = blockTitlesInOrder(out.pages, 10);
    const orderCheck = checkFoundationOrder(titles);
    const tf = out.review?.teacherFirstOpeningCoverage || {};

    console.log("Lesson ID:", out.lessonId, `(${out.generationSeconds}s)`);
    console.log("First 10 block titles:");
    titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log("Foundation order pass:", orderCheck.pass ? "YES" : "NO");
    console.log("Scenario at block:", orderCheck.scenarioIndex ?? "not found");
    console.log("Coverage Review:");
    console.log("  teacherFirst enabled:", tf.enabled);
    console.log("  scenarioBeforeCoreKnowledge:", tf.scenarioBeforeCoreKnowledge);
    console.log("  openingScorePct:", tf.openingScorePct);
    console.log("  flags:", (tf.flags || []).join(", ") || "(none)");

    results.push({
      name: cfg.name,
      topicKey: cfg.topicKey,
      lessonId: out.lessonId,
      generationSeconds: out.generationSeconds,
      first10Titles: titles,
      orderCheck,
      teacherFirstOpeningCoverage: tf,
      pass:
        orderCheck.pass &&
        tf.scenarioBeforeCoreKnowledge === false &&
        (tf.openingScorePct ?? 0) > 25,
    });
  }

  const reportPath = path.resolve(__dirname, "manualAcceptance3H15-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log("\nReport written:", reportPath);

  const allPass = results.every((r) => r.pass);
  console.log("\n=== SUMMARY ===");
  results.forEach((r) => {
    console.log(`  ${r.pass ? "PASS" : "FAIL"} — ${r.name}`);
  });
  process.exit(allPass ? 0 : 2);
}

main().catch((err) => {
  console.error("\nAcceptance failed:", err.response?.data || err.message);
  process.exit(1);
});
