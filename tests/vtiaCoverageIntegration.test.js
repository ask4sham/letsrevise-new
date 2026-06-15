/**
 * Phase 3H.1.8b.4d — VTIA coverage review integration.
 */

const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");

describe("Phase 3H.1.8b.4d — VTIA coverage integration", () => {
  const prevVtia = process.env.TEACHER_BRAIN_VTIA;

  afterEach(() => {
    if (prevVtia === undefined) delete process.env.TEACHER_BRAIN_VTIA;
    else process.env.TEACHER_BRAIN_VTIA = prevVtia;
  });

  const biologyTfPages = [
    {
      blocks: [
        { type: "text", title: "Definition", content: "The eye detects light." },
        { type: "text", title: "Why it matters", content: "Vision supports survival." },
        { type: "keyIdea", title: "Core model", content: "Light is refracted by the cornea." },
        { type: "text", title: "Core Teaching", content: "Label the parts of the eye shown." },
      ],
    },
  ];

  test("vtiaTelemetry absent when flag unset", () => {
    delete process.env.TEACHER_BRAIN_VTIA;
    const review = buildLessonCoverageReview({
      topic: "The eye",
      topicKey: "aqa-gcse-biology:the-eye",
      subject: "Biology",
      pages: biologyTfPages,
    });
    expect(review.vtiaTelemetry).toBeDefined();
    expect(review.vtiaTelemetry.enabled).toBe(false);
    expect(review.teachingQualityReview).toBeDefined();
  });

  test("vtiaTelemetry attached when TEACHER_BRAIN_VTIA=0", () => {
    process.env.TEACHER_BRAIN_VTIA = "0";
    const review = buildLessonCoverageReview({
      topic: "The eye",
      topicKey: "aqa-gcse-biology:the-eye",
      subject: "Biology",
      pages: biologyTfPages,
    });
    expect(review.vtiaTelemetry.enabled).toBe(true);
    expect(review.vtiaTelemetry.mode).toBe("report_only");
    expect(review.vtiaTelemetry.summary.highConfidenceViolations).toBeGreaterThanOrEqual(1);
    expect(review.vtiaTelemetry.findings[0].intent).toBe("LABEL_DIAGRAM");
  });
});
