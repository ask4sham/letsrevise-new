/**
 * Phase 3H.1.7 manual acceptance — Teaching Quality Rubric.
 * Usage: node backend/scripts/manualAcceptance3H17.js [--base-url http://localhost:5000] [--offline]
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const axios = require("axios");
const fs = require("fs");
const {
  buildTeachingQualityReview,
  formatTeachingQualityReviewLines,
} = require("../../lib/teacherBrain/teachingQualityRubric");
const { buildLessonCoverageReview } = require("../../lib/teacherBrain/lessonCoverageReview");

const BASE_URL = process.argv.includes("--base-url")
  ? process.argv[process.argv.indexOf("--base-url") + 1]
  : "http://localhost:5000";
const OFFLINE = process.argv.includes("--offline");

const ACCEPT_EMAIL = "phase3h17-accept@test.com";
const ACCEPT_PASSWORD = "accept3H17!test";

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

function offlineFixturePages(cfg) {
  const compareSnippet =
    cfg.topicKey.includes("nervous")
      ? " Sensory neurones carry impulses to the CNS whereas motor neurones carry impulses away."
      : cfg.topicKey.includes("the-eye")
        ? " Compare cornea and lens: cornea refracts whereas lens adjusts focus."
        : " Negative feedback reverses change whereas positive feedback amplifies it in homeostasis.";

  return [
    {
      blocks: [
        { type: "text", title: "Definition", content: `Definition for ${cfg.name}.` },
        { type: "keyIdea", role: "coreRule", title: "Core model", content: "Structure enables function because adaptation matters." },
        { type: "checkpoint", question: "State one key term (1 mark)", answer: "Term." },
        {
          type: "text",
          title: "Core Teaching",
          content: `Retrieval: recall prior knowledge. ${compareSnippet} For example, exam answers need causal links.`,
        },
        {
          type: "commonMistake",
          content: `Wrong: Common error in ${cfg.name}.\nCorrect: Accurate understanding.\nExam link: Loses explanation marks.`,
        },
        {
          type: "examTip",
          content: `<h2>Premium Exam Tip</h2><p>Name structures and use explain/compare for marks in ${cfg.name} GCSE questions.</p>`,
        },
        {
          type: "checkpoint",
          role: "workedExample",
          question: `Explain ${cfg.name} (4 marks)`,
          answer: "- Step one because structure allows function\n- Step two therefore response occurs\n- Step three so that the process completes",
        },
        {
          type: "stretch",
          content: "Grade 9: top-band answers link structure to function because examiners reward causal chains.",
        },
        {
          type: "keyIdea",
          role: "finalMemoryRule",
          content: `<h2>💡 Key Insight</h2><p>Memory rule for ${cfg.name}.</p>`,
        },
      ],
    },
  ];
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
      firstName: "Phase3H17",
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

async function generateLesson(cfg, auth, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const genStart = Date.now();
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
      return {
        lessonId: String(lessonId),
        generationSeconds: ((Date.now() - genStart) / 1000).toFixed(1),
        attempts: attempt,
        pages: lesson.pages,
        topic: cfg.topic,
        topicKey: cfg.topicKey,
        subTopic: cfg.topic,
      };
    } catch (err) {
      lastErr = err;
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.details ||
        err.response?.data?.msg ||
        err.message;
      if (attempt === maxAttempts) throw err;
      console.warn(`  Attempt ${attempt} failed (${detail}); retrying…`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw lastErr;
}

const TEACHER_BRAIN_FLAG_BUNDLE = {
  TEACHER_BRAIN_TEACHER_FIRST_OPENING: "1",
  TEACHER_BRAIN_TEACHING_QUALITY: "1",
  TEACHER_BRAIN_SUBTOPIC_BOUNDARY: "2",
  TEACHER_BRAIN_PEDAGOGY_ENGINE: "1",
  TEACHER_BRAIN_GCSE_REASONING_ENGINE: "1",
  TEACHER_BRAIN_CONCEPT_COMPRESSION: "1",
  TEACHER_BRAIN_PRIORITY_ENGINE: "1",
};

function applyTeacherBrainFlags() {
  for (const [key, value] of Object.entries(TEACHER_BRAIN_FLAG_BUNDLE)) {
    process.env[key] = value;
  }
}

function blockTitlesInOrder(pages, limit = 12) {
  const titles = [];
  for (const page of pages || []) {
    for (const block of page.blocks || []) {
      titles.push(block.title || block.role || block.type || "(untitled)");
      if (titles.length >= limit) return titles;
    }
  }
  return titles;
}

function collectDriftSignals(review) {
  const drift = [];
  if (review.teacherFirstOpeningCoverage?.scenarioBeforeCoreKnowledge) {
    drift.push("Scenario before core knowledge");
  }
  if (review.teacherFirstOpeningCoverage?.scenarioBeforeDefinition) {
    drift.push("Scenario before definition");
  }
  for (const flag of review.teacherFirstOpeningCoverage?.flags || []) {
    drift.push(`Opening: ${flag}`);
  }
  for (const w of review.boundaryWarnings || []) {
    drift.push(`Boundary: ${w}`);
  }
  for (const w of review.boundaryAudit?.warnings || []) {
    drift.push(`Boundary audit: ${w}`);
  }
  for (const hit of review.interactionAuthority?.unauthorisedDetected || []) {
    drift.push(`Interaction drift: ${hit.conceptName || hit.conceptId || hit.pattern || JSON.stringify(hit)}`);
  }
  for (const risk of review.interactionAuthority?.blockedRisks || []) {
    drift.push(`Blocked risk: ${risk.conceptName || risk.reason || JSON.stringify(risk)}`);
  }
  for (const w of review.dominanceWarnings || []) {
    drift.push(`Coverage: ${w}`);
  }
  return [...new Set(drift)];
}

function scoreLesson(input) {
  applyTeacherBrainFlags();
  const rubric = buildTeachingQualityReview(input);
  const review = buildLessonCoverageReview({
    topic: input.topic,
    subTopic: input.subTopic || input.topic,
    topicKey: input.topicKey,
    subject: "Biology",
    pages: input.pages,
  });
  return {
    rubric,
    review,
    first12Titles: blockTitlesInOrder(input.pages, 12),
    openingScorePct: review.teacherFirstOpeningCoverage?.openingScorePct ?? 0,
    boundaryScore: review.scopeContaminationScore ?? 0,
    boundaryStatus: review.boundaryStatus ?? "off",
    missingRubric: rubric.missing || [],
    drift: collectDriftSignals(review),
  };
}

async function main() {
  console.log("\n=== Phase 3H.1.7 Manual Acceptance — Teaching Quality Rubric ===");
  console.log("Mode:", OFFLINE ? "offline (fixtures)" : "live generation");
  console.log("Expected Teacher Brain flag bundle:");
  Object.entries(TEACHER_BRAIN_FLAG_BUNDLE).forEach(([k, v]) => console.log(`  ${k}=${v}`));

  const results = [];

  if (OFFLINE) {
    for (const cfg of LESSONS) {
      console.log(`\n--- Scoring fixture: ${cfg.name} ---`);
      const pages = offlineFixturePages(cfg);
      const scored = scoreLesson({
        topic: cfg.topic,
        topicKey: cfg.topicKey,
        subTopic: cfg.topic,
        pages,
      });
      console.log(formatTeachingQualityReviewLines(scored.rubric));
      results.push({
        name: cfg.name,
        topicKey: cfg.topicKey,
        mode: "offline",
        ...scored,
        pass: scored.rubric.totalScore >= 26,
      });
    }
  } else {
    const health = await axios.get(`${BASE_URL}/api/health`);
    console.log("\nHealth:", health.data?.status, "| commit:", health.data?.commit);
    const token = await ensureTeacherToken();
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    for (const cfg of LESSONS) {
      console.log(`\n--- Generating: ${cfg.name} ---`);
      const out = await generateLesson(cfg, auth);
      const scored = scoreLesson(out);
      console.log("Lesson ID:", out.lessonId, `(${out.generationSeconds}s)`);
      console.log("First 12 blocks:");
      scored.first12Titles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
      console.log("Teaching Quality:", scored.rubric.scoreLabel);
      console.log("Opening score:", `${scored.openingScorePct}%`);
      console.log("Boundary score (contamination):", scored.boundaryScore, `(${scored.boundaryStatus})`);
      console.log("Missing rubric:", scored.missingRubric.join(", ") || "(none)");
      console.log("Drift:", scored.drift.join("; ") || "(none)");
      console.log(formatTeachingQualityReviewLines(scored.rubric));
      results.push({
        name: cfg.name,
        topicKey: cfg.topicKey,
        lessonId: out.lessonId,
        mode: "live",
        generationSeconds: out.generationSeconds,
        teachingQuality: scored.rubric,
        teachingQualityScore: scored.rubric.scoreLabel,
        openingScorePct: scored.openingScorePct,
        boundaryScore: scored.boundaryScore,
        first12Titles: scored.first12Titles,
        missingRubric: scored.missingRubric,
        drift: scored.drift,
        pass:
          scored.openingScorePct >= 80 &&
          scored.rubric.totalScore >= 20 &&
          scored.drift.length === 0,
      });
    }
  }

  const reportPath = path.resolve(__dirname, "manualAcceptance3H17-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log("\nReport written:", reportPath);

  console.log("\n=== SUMMARY ===");
  results.forEach((r) => {
    const tq = r.teachingQuality || r.rubric;
    console.log(
      `  ${r.pass ? "PASS" : "REVIEW"} — ${r.name}: TQ ${tq?.scoreLabel || "?"} | opening ${r.openingScorePct ?? "?"}% | boundary ${r.boundaryScore ?? "?"} | missing: ${(r.missingRubric || tq?.missing || []).join(", ") || "(none)"} | drift: ${(r.drift || []).length ? r.drift.join("; ") : "(none)"}`
    );
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("\nAcceptance failed:", err.response?.data || err.message);
  process.exit(1);
});
