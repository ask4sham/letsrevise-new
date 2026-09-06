#!/usr/bin/env node
/**
 * Block 28 Semantic Marking — LIVE provider calibration harness.
 * NOT part of normal CI. Requires OPENAI_API_KEY or LLM_API_KEY.
 *
 * Usage:
 *   BLOCK28_SEMANTIC_MARKING_V1=1 node backend/scripts/block28SemanticMarkingCalibration.js
 *   BLOCK28_SEMANTIC_MARKING_MODEL=gpt-4o-mini node backend/scripts/block28SemanticMarkingCalibration.js
 */
const mutationFixture = require("../tests/fixtures/semanticMarking/mutation");
const crossTopicFixtures = require("../tests/fixtures/semanticMarking/crossTopic");
const { markShortAnswerSemantically } = require("../services/semanticShortAnswerMarking");

const REPEATS = parseInt(process.env.CALIBRATION_REPEATS || "3", 10);

function hasProvider() {
  return Boolean(
    String(process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || "").trim()
  );
}

function lessonForFixture(fixture, topicKey) {
  return {
    topicKey,
    subject: "Biology",
    level: "GCSE",
    board: "AQA",
    examQuestions: [
      {
        questionId: {
          _id: "507f1f77bcf86cd799439077",
          type: "short",
          question: fixture.question,
          marks: fixture.marks,
          markScheme: fixture.markScheme,
          status: "published",
          topicKey,
        },
      },
    ],
  };
}

async function runCase(label, fixture, caseRow, topicKey) {
  const lesson = lessonForFixture(fixture, topicKey);
  const scores = [];
  const latencies = [];

  for (let i = 0; i < REPEATS; i += 1) {
    const started = Date.now();
    const result = await markShortAnswerSemantically({
      lesson,
      questionId: "507f1f77bcf86cd799439077",
      studentAnswer: caseRow.answer,
    });
    latencies.push(Date.now() - started);
    if (result.status !== "ok") {
      scores.push(null);
    } else {
      scores.push(result.score);
    }
  }

  const valid = scores.filter((s) => s != null);
  const flip =
    valid.length > 1 ? new Set(valid).size > 1 : false;
  const pass =
    valid.length === REPEATS &&
    valid.every((s) => s === caseRow.expectedScore);

  return {
    label,
    caseId: caseRow.id,
    expectedScore: caseRow.expectedScore,
    actualScores: scores,
    pass,
    flip,
    avgLatencyMs:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null,
  };
}

async function main() {
  if (!hasProvider()) {
    console.log("LIVE CALIBRATION NOT RUN — PROVIDER NOT CONFIGURED");
    process.exit(0);
  }

  process.env.BLOCK28_SEMANTIC_MARKING_V1 = "1";

  const results = [];

  for (const c of mutationFixture.cases) {
    results.push(
      await runCase("mutation", mutationFixture, c, "aqa-gcse-biology:mutation")
    );
  }

  for (const topic of crossTopicFixtures) {
    for (const c of topic.cases) {
      results.push(
        await runCase(
          topic.topic,
          topic,
          c,
          `aqa-gcse-biology:${topic.topic}`
        )
      );
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const flipped = results.filter((r) => r.flip).length;
  const failed = results.filter((r) => !r.pass);

  console.log(
    JSON.stringify(
      {
        model:
          process.env.BLOCK28_SEMANTIC_MARKING_MODEL ||
          process.env.LLM_MODEL ||
          process.env.OPENAI_MODEL ||
          "gpt-4o-mini",
        repeats: REPEATS,
        total: results.length,
        passed,
        failed: failed.length,
        flipCases: flipped,
        failures: failed.slice(0, 20),
      },
      null,
      2
    )
  );

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
