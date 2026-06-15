/**
 * Phase 3H.1.8b.4d — VTIA unit tests (frozen V1 taxonomy).
 */

const path = require("path");
const fs = require("fs");
const {
  isVtiaTelemetryEnabled,
  detectV1Intent,
  detectExplainProse,
  blockPassesSolvabilityContract,
  buildVtiaTelemetry,
  computeIntentPrecisionEstimate,
  aggregateVtiaTelemetry,
  auditBlockForVtia,
} = require("../lib/teacherBrain/visualTaskInteractionAuthority");

const FIXTURES_PATH = path.resolve(
  __dirname,
  "../docs/design/validation/3H18b4d-vtia/fixtures.json"
);
const fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, "utf8"));

describe("Phase 3H.1.8b.4d — VTIA telemetry", () => {
  const prevVtia = process.env.TEACHER_BRAIN_VTIA;

  afterEach(() => {
    if (prevVtia === undefined) delete process.env.TEACHER_BRAIN_VTIA;
    else process.env.TEACHER_BRAIN_VTIA = prevVtia;
  });

  test("TEACHER_BRAIN_VTIA unset is fully disabled", () => {
    delete process.env.TEACHER_BRAIN_VTIA;
    expect(isVtiaTelemetryEnabled()).toBe(false);
    const telemetry = buildVtiaTelemetry({
      topicKey: "aqa-gcse-biology:homeostasis",
      subject: "Biology",
      pages: [{ blocks: [{ type: "text", content: "Label the diagram." }] }],
    });
    expect(telemetry.enabled).toBe(false);
  });

  test("TEACHER_BRAIN_VTIA=0 enables report-only telemetry", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    expect(isVtiaTelemetryEnabled()).toBe(true);
  });

  test("MATCH_LABELS_TO_IMAGE detection", () => {
    expect(detectV1Intent("Place the labels on the diagram.").intent).toBe(
      "MATCH_LABELS_TO_IMAGE"
    );
    expect(detectV1Intent("Drag each label onto the reflex arc diagram.").intent).toBe(
      "MATCH_LABELS_TO_IMAGE"
    );
  });

  test("LABEL_PATHWAY detection (strict)", () => {
    expect(detectV1Intent("Label the nervous pathway involved in the response.").intent).toBe(
      "LABEL_PATHWAY"
    );
    expect(detectV1Intent("Label the reflex arc from stimulus to effector.").intent).toBe(
      "LABEL_PATHWAY"
    );
  });

  test("LABEL_PATHWAY excludes explain/link without label", () => {
    expect(detectV1Intent("Link your results to the nervous system pathway.")).toBeNull();
    expect(detectExplainProse("Link your results to the nervous system pathway.")).toBe(true);
  });

  test("LABEL_DIAGRAM detection (strict)", () => {
    expect(detectV1Intent("Label the parts of the eye shown.").intent).toBe("LABEL_DIAGRAM");
    expect(detectV1Intent("Label the main parts of a neurone.").intent).toBe("LABEL_DIAGRAM");
  });

  test("descriptive labelled diagram is not an intent", () => {
    expect(detectV1Intent("This labelled diagram shows the reflex arc.")).toBeNull();
  });

  test("dragDropMatch with diagram contract passes solvability", () => {
    expect(
      blockPassesSolvabilityContract({
        type: "dragDropMatch",
        matchMode: "diagram",
        imageUrl: "https://example.com/x.png",
      })
    ).toBe(true);
  });

  test("RP variables dragDropMatch passes", () => {
    const result = auditBlockForVtia(
      { type: "dragDropMatch", role: "match", content: "Match each variable type." },
      0,
      { topicKey: "aqa-gcse-biology:rp-osmosis", subject: "Biology" }
    );
    expect(result.kind).toBe("pass");
  });

  test("RP analysis label pathway is high-confidence violation", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const telemetry = buildVtiaTelemetry({
      topic: "Reaction Time Required Practical",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
      pages: [
        {
          blocks: [
            {
              type: "text",
              role: "analysis",
              content: "Label the nervous pathway involved in the ruler-drop response.",
            },
          ],
        },
      ],
    });
    expect(telemetry.enabled).toBe(true);
    expect(telemetry.lessonCategory).toBe("required_practical");
    const viol = telemetry.findings.filter((f) => f.violation === "UNSOLVABLE_VISUAL_TASK");
    expect(viol).toHaveLength(1);
    expect(viol[0].intent).toBe("LABEL_PATHWAY");
    expect(viol[0].confidence).toBe("high");
  });

  test("EXPLAIN_PROSE suppressor prevents violation on adjacent analysis block", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const telemetry = buildVtiaTelemetry({
      topic: "Reaction Time Required Practical",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
      pages: [
        {
          blocks: [
            {
              type: "text",
              role: "analysis",
              content: "Link your results to the nervous system pathway.",
            },
          ],
        },
      ],
    });
    expect(telemetry.suppressorHits).toHaveLength(1);
    expect(telemetry.suppressorHits[0].suppressor).toBe("EXPLAIN_PROSE");
    expect(telemetry.summary.highConfidenceViolations).toBe(0);
  });

  test("Chemistry lesson is out of scope", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const telemetry = buildVtiaTelemetry({
      topic: "Atomic structure",
      topicKey: "aqa-gcse-chemistry:atomic-structure",
      subject: "Chemistry",
      pages: [{ blocks: [{ type: "text", content: "Label the diagram of an atom." }] }],
    });
    expect(telemetry.enabled).toBe(false);
    expect(telemetry.scope).toBe("out_of_scope");
  });

  test("structural Teacher-First detection without TF flag", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const lesson = fixtures.lessons.find((l) => l.name === "Homeostasis");
    const telemetry = buildVtiaTelemetry({
      topic: lesson.topic,
      topicKey: lesson.topicKey,
      subject: lesson.subject,
      pages: lesson.pages,
    });
    expect(telemetry.enabled).toBe(true);
    expect(telemetry.lessonCategory).toBe("teacher_first");
  });

  test("VISUAL_CONTRACT_INCOMPLETE recorded separately from V1 violation", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const lesson = fixtures.lessons.find((l) => l.name === "The Eye");
    const telemetry = buildVtiaTelemetry({
      topic: lesson.topic,
      topicKey: lesson.topicKey,
      subject: lesson.subject,
      pages: lesson.pages,
    });
    expect(telemetry.visualContractIncomplete.length).toBeGreaterThanOrEqual(1);
    const violIntents = telemetry.findings.filter((f) => f.violation === "UNSOLVABLE_VISUAL_TASK");
    expect(violIntents.every((f) => f.intent !== "VISUAL_CONTRACT_INCOMPLETE")).toBe(true);
  });

  test("curated corpus meets 4c success criterion (≥9/10 bad, ≤2/20 good)", () => {
    const bad = fixtures.fixtures.filter((f) => f.groundTruth.shouldViolate);
    const good = fixtures.fixtures.filter((f) => !f.groundTruth.shouldViolate && f.subject === "Biology");

    let badCaught = 0;
    for (const f of bad) {
      const result = auditBlockForVtia(f.block, 0, {
        topic: f.topic,
        topicKey: f.topicKey,
        subject: f.subject,
      });
      if (
        result.kind === "finding" &&
        result.confidence === "high" &&
        result.violation === "UNSOLVABLE_VISUAL_TASK"
      ) {
        badCaught += 1;
      }
    }

    let goodFalsePositives = 0;
    for (const f of good) {
      const result = auditBlockForVtia(f.block, 0, {
        topic: f.topic,
        topicKey: f.topicKey,
        subject: f.subject,
      });
      if (
        result.kind === "finding" &&
        result.confidence === "high" &&
        result.violation === "UNSOLVABLE_VISUAL_TASK"
      ) {
        goodFalsePositives += 1;
      }
    }

    expect(badCaught).toBeGreaterThanOrEqual(9);
    expect(goodFalsePositives).toBeLessThanOrEqual(2);
  });

  test("intentPrecisionEstimate computed per intent", () => {
    const estimate = computeIntentPrecisionEstimate(fixtures.fixtures);
    expect(estimate.MATCH_LABELS_TO_IMAGE).toBeDefined();
    expect(estimate.LABEL_PATHWAY).toBeDefined();
    expect(estimate.LABEL_DIAGRAM).toBeDefined();
    expect(estimate.LABEL_PATHWAY.truePositive).toBeGreaterThanOrEqual(1);
    expect(estimate.LABEL_DIAGRAM.truePositive).toBeGreaterThanOrEqual(1);
  });

  test("aggregateVtiaTelemetry produces violation rate and top slots", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const perLesson = fixtures.lessons.map((lesson) => ({
      name: lesson.name,
      topicKey: lesson.topicKey,
      vtiaTelemetry: buildVtiaTelemetry({
        topic: lesson.topic,
        topicKey: lesson.topicKey,
        subject: lesson.subject,
        pages: lesson.pages,
      }),
    }));
    const report = aggregateVtiaTelemetry(perLesson, fixtures.fixtures);
    expect(report.mode).toBe("VTIA=0_report_only");
    expect(report.lessonsInScope).toBeGreaterThan(0);
    expect(report.intentPrecisionEstimate).toBeDefined();
    expect(report.topOffendingSlots.length).toBeGreaterThan(0);
    expect(typeof report.violationRatePct).toBe("number");
  });
});
