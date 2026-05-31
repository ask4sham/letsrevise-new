/**
 * Golden comparison — curated Metabolism lesson as pedagogical benchmark.
 */

const fs = require("fs");
const path = require("path");
const { scoreTenOutOfTenRubric } = require("./tenOutOfTenRubric");
const { buildLessonBlueprint } = require("../lessonGeneratorV2/lessonBlueprintEngine");

const BENCHMARK_PATH = path.join(
  __dirname,
  "../../backend/scripts/dry-run-pilot-lessons-output.json"
);

/** Pedagogical floors from curated Metabolism (preview-truncated export). */
const GOLDEN_METABOLISM_PEDAGOGY_FLOOR = {
  teachingClarity: 3,
  conceptStorytelling: 7,
  explanationDepth: 2,
  examinerThinking: 4,
  retrievalProgression: 3,
  activityDepth: 3,
  workedExamples: 2,
  conceptLinking: 2,
  higherTierChallenge: 2,
  finalExamReadiness: 2,
};

function parseDryRunLessons() {
  const raw = fs.readFileSync(BENCHMARK_PATH, "utf8");
  return raw
    .trim()
    .split(/\n(?=\{)/)
    .map((s) => JSON.parse(s));
}

function beforeToPages(before) {
  return [
    {
      title: "Lesson",
      order: 1,
      blocks: before.map((b) => ({
        type: b.type,
        role: b.role,
        title: b.title,
        content: b.preview || "",
      })),
    },
  ];
}

function loadCuratedMetabolismPages() {
  const lessons = parseDryRunLessons();
  const meta = lessons.find((l) => /metabolism/i.test(l.title || ""));
  if (!meta?.before) return null;
  return beforeToPages(meta.before);
}

/**
 * Compare candidate lesson pedagogical scores to curated Metabolism benchmark.
 * @param {object[]} candidatePages
 * @param {object} [ctx]
 */
function compareToGoldenMetabolism(candidatePages, ctx = {}) {
  const blueprint =
    ctx.blueprint ||
    buildLessonBlueprint({
      topic: "Metabolism",
      subject: "Biology",
      examBoard: "AQA",
      tier: "higher",
    });

  const curatedPages = loadCuratedMetabolismPages();
  if (!curatedPages) {
    return { error: "Curated Metabolism benchmark not found", passed: false };
  }

  const ctxFull = { blueprint, tier: "higher", ...ctx };
  const golden = scoreTenOutOfTenRubric(curatedPages, ctxFull);
  const candidate = scoreTenOutOfTenRubric(candidatePages, ctxFull);

  const dimensionComparison = {};
  const dimensions = Object.keys(golden.categories);
  let meetsOrExceeds = 0;

  for (const dim of dimensions) {
    const g = golden.categories[dim];
    const c = candidate.categories[dim];
    const floor = GOLDEN_METABOLISM_PEDAGOGY_FLOOR[dim] ?? 3;
    const delta = Math.round((c - g) * 10) / 10;
    const ok = c >= g - 0.5 || c >= floor;
    if (ok) meetsOrExceeds++;
    dimensionComparison[dim] = {
      golden: g,
      candidate: c,
      floor,
      delta,
      meetsOrExceeds: ok,
    };
  }

  const passed =
    meetsOrExceeds >= Math.ceil(dimensions.length * 0.7) &&
    candidate.average >= Math.max(golden.average - 1.5, 3) &&
    candidate.categories.conceptStorytelling >= GOLDEN_METABOLISM_PEDAGOGY_FLOOR.conceptStorytelling - 1;

  return {
    passed,
    golden,
    candidate,
    dimensionComparison,
    meetsOrExceedsCount: meetsOrExceeds,
    totalDimensions: dimensions.length,
    summary: passed
      ? "Candidate matches or exceeds curated Metabolism on pedagogical quality."
      : "Candidate below curated Metabolism on one or more pedagogical dimensions.",
  };
}

module.exports = {
  loadCuratedMetabolismPages,
  compareToGoldenMetabolism,
  GOLDEN_METABOLISM_PEDAGOGY_FLOOR,
  BENCHMARK_PATH,
};
