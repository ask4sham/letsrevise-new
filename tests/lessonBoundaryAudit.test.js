/**
 * Phase 3B — final lesson boundary audit.
 */

const { auditLessonBoundary } = require("../lib/teacherBrain/lessonBoundaryAudit");
const { buildLessonCoverageReview } = require("../lib/teacherBrain/lessonCoverageReview");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
  topic: "Homeostasis and Response",
};

const structureLessonPages = [
  {
    blocks: [
      {
        type: "text",
        content: "Motor neurones have dendrites, axons and a myelin sheath for rapid impulse transmission.",
      },
      {
        type: "labeldiagram",
        title: "Label the motor neurone",
        prompt: "Label dendrites, axon and myelin sheath on the neurone diagram.",
      },
      {
        type: "interactivediagram",
        title: "Brain regions interactive diagram",
        content: "Label the brain regions: cerebrum, cerebellum and medulla.",
      },
      {
        type: "checkpoint",
        prompt: "Explain thermoregulation and vasodilation when body temperature rises.",
      },
      {
        type: "dragdropmatch",
        title: "Reflex arc pathway",
        content: "Order the reflex arc pathway from stimulus to effector.",
      },
    ],
  },
];

describe("lessonBoundaryAudit (Phase 3B)", () => {
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevBoundary === undefined) {
      delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    } else {
      process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
    }
  });

  test("flag off returns empty safe audit without findings", () => {
    delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    const audit = auditLessonBoundary({
      ...STRUCTURE_INPUT,
      pages: structureLessonPages,
    });
    expect(audit.boundaryMode).toBe(0);
    expect(audit.blockFindings).toEqual([]);
    expect(audit.summary.safeToPublish).toBe(true);
  });

  test("nervous-system-structure classifies in-scope and out-of-scope items", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditLessonBoundary({
      ...STRUCTURE_INPUT,
      pages: structureLessonPages,
    });

    expect(audit.boundaryProfileKey).toBe("nervous-system-structure");
    expect(audit.boundaryMode).toBe(1);

    const byTitle = (t) =>
      audit.blockFindings.find((f) => String(f.title || "").toLowerCase().includes(t));

    const neurone = audit.blockFindings.find(
      (f) => f.primaryConceptId === "neurones" || f.primaryConceptId === "myelin_sheath"
    );
    expect(neurone).toBeTruthy();
    expect(neurone.boundaryStatus).toBe("in_scope");

    const brain = byTitle("brain regions");
    expect(brain).toBeTruthy();
    expect(["forbidden", "neighbouring"]).toContain(brain.boundaryStatus);

    const thermo = audit.blockFindings.find((f) => f.primaryConceptId === "thermoregulation");
    expect(thermo).toBeTruthy();
    expect(thermo.boundaryStatus).toBe("forbidden");
    expect(thermo.suggestedReplacementFocus).toMatch(/myelin/i);

    const reflex = audit.blockFindings.find(
      (f) => f.primaryConceptId === "reflex_arc_pathway" || f.primaryConceptId === "reflex_arc"
    );
    expect(reflex).toBeTruthy();
    expect(["forbidden", "neighbouring"]).toContain(reflex.boundaryStatus);
  });

  test("scopeContaminationScore reflects out-of-scope assessed share", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditLessonBoundary({
      ...STRUCTURE_INPUT,
      pages: structureLessonPages,
    });

    const assessedOut = audit.neighbourItems + audit.forbiddenItems;
    expect(audit.summary.assessedCount).toBeGreaterThan(0);
    const expected = Math.round((assessedOut / audit.summary.assessedCount) * 100);
    expect(audit.scopeContaminationScore).toBe(expected);
    expect(audit.scopeContaminationScore).toBeGreaterThan(0);
  });

  test("unknown topic / no profile returns safe empty audit", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditLessonBoundary({
      topicKey: "aqa-gcse-biology:unknown-widget-topic",
      subTopic: "Widget mechanics",
      pages: structureLessonPages,
    });
    expect(audit.boundaryProfileKey).toBeNull();
    expect(audit.blockFindings).toEqual([]);
    expect(audit.summary.safeToPublish).toBe(true);
  });

  test("mode 1 reports warnings only, not blockers", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const audit = auditLessonBoundary({
      ...STRUCTURE_INPUT,
      pages: structureLessonPages,
    });
    expect(audit.summary.blockers).toEqual([]);
    expect(audit.summary.safeToPublish).toBe(true);
    const forbiddenFinding = audit.blockFindings.find((f) => f.boundaryStatus === "forbidden");
    expect(forbiddenFinding?.severity).toBe("warning");
  });

  test("mode 2 marks forbidden-primary as blockers without deleting content", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "2";
    const audit = auditLessonBoundary({
      ...STRUCTURE_INPUT,
      pages: structureLessonPages,
    });
    expect(audit.blockFindings.length).toBeGreaterThan(0);
    const blockers = audit.blockFindings.filter((f) => f.severity === "blocker");
    expect(blockers.length).toBeGreaterThan(0);
    expect(audit.summary.blockers.length).toBeGreaterThan(0);
    expect(audit.summary.safeToPublish).toBe(false);
    expect(audit.summary.repairRecommendations?.length).toBeGreaterThan(0);
  });

  test("buildLessonCoverageReview includes boundaryAudit when flag enabled", () => {
    process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = "1";
    const review = buildLessonCoverageReview({
      ...STRUCTURE_INPUT,
      pages: structureLessonPages,
    });
    expect(review.boundaryAudit).toBeDefined();
    expect(review.boundaryAudit.boundaryProfileKey).toBe("nervous-system-structure");
    expect(review.scopeContaminationScore).toBe(review.boundaryAudit.scopeContaminationScore);
  });
});
