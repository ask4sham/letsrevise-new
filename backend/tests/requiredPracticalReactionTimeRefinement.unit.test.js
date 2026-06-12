/**
 * Phase 3b.3f.9 — Required Practical: Reaction Time educational refinement.
 * @jest-environment node
 */

const {
  ensureReactionTimeEducationalRefinement,
  EXAMINER_THINKING_MARKER,
  GRADE79_MARKER,
  RETRIEVAL_MARKER,
  PATTERN_MARKER,
  SUMMARY_MARKER,
  WORKED_ANOMALY_MARKER,
} = require("../../lib/teacherBrain/requiredPracticalReactionTimeRefinement");
const {
  enforceDashboardTeacherFirstOpening,
  REQUIRED_PRACTICAL_DASHBOARD_SLOTS,
} = require("../../lib/teacherBrain/dashboardTeacherFirstOpening");
const { sanitizeDraftForTest } = require("../routes/ai");

const RP_CTX = {
  topic: "Required Practical: Reaction time",
  subTopic: "Required Practical: Reaction time",
  topicKey: "aqa-gcse-biology:rp-reaction-time",
  subject: "Biology",
};

function minimalRpDraft() {
  return {
    title: RP_CTX.topic,
    topic: RP_CTX.topic,
    pages: [
      {
        title: "Page 1",
        order: 1,
        blocks: REQUIRED_PRACTICAL_DASHBOARD_SLOTS.map((slot) => ({
          type: slot.type,
          title: slot.title,
          role: slot.role,
          content: `Placeholder content for ${slot.title}.`,
        })),
      },
    ],
  };
}

function blockByRole(draft, role) {
  return (draft.pages[0].blocks || []).find((b) => String(b.role || "").toLowerCase() === role.toLowerCase());
}

describe("ensureReactionTimeEducationalRefinement (Phase 3b.3f.9)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  beforeAll(() => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
  });

  afterAll(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("adds examiner thinking, pattern rules, retrieval, grade 7–9, and worked anomaly", () => {
    const draft = minimalRpDraft();
    ensureReactionTimeEducationalRefinement(draft, RP_CTX);

    const allText = draft.pages[0].blocks.map((b) => `${b.title} ${b.content}`).join("\n");
    expect(EXAMINER_THINKING_MARKER.test(allText)).toBe(true);
    expect(PATTERN_MARKER.test(allText)).toBe(true);
    expect(RETRIEVAL_MARKER.test(allText)).toBe(true);
    expect(GRADE79_MARKER.test(allText)).toBe(true);
    expect(WORKED_ANOMALY_MARKER.test(allText)).toBe(true);
    expect(SUMMARY_MARKER.test(blockByRole(draft, "synthesis").content)).toBe(true);
  });

  test("preserves 19-block RP structure after refinement", () => {
    const draft = minimalRpDraft();
    enforceDashboardTeacherFirstOpening(draft, RP_CTX);
    expect(draft.pages[0].blocks).toHaveLength(19);

    ensureReactionTimeEducationalRefinement(draft, RP_CTX);
    expect(draft.pages[0].blocks).toHaveLength(19);
    expect(draft.pages[0].blocks.map((b) => b.title)).toEqual(
      REQUIRED_PRACTICAL_DASHBOARD_SLOTS.map((s) => s.title)
    );
  });

  test("does not duplicate examiner thinking when already strong", () => {
    const draft = minimalRpDraft();
    const cm = blockByRole(draft, "commonMistake");
    cm.content =
      "**Students often lose marks because** they confuse reaction time with reflex action.\n**The examiner is looking for** reliability and validity.\n**A full-mark answer should** justify anomalies.\n**Avoid saying:** vague accuracy claims.\n**Say this instead:** repeat and calculate a mean.";

    ensureReactionTimeEducationalRefinement(draft, RP_CTX);
    expect((cm.content.match(/students often lose marks/gi) || []).length).toBe(1);
  });

  test("skips non–reaction-time Required Practical topics", () => {
    const draft = minimalRpDraft();
    draft.topic = "Required Practical: Osmosis";
    ensureReactionTimeEducationalRefinement(draft, {
      topic: "Required Practical: Osmosis",
      topicKey: "aqa-gcse-biology:rp-osmosis",
    });
    const allText = draft.pages[0].blocks.map((b) => b.content).join("\n");
    expect(WORKED_ANOMALY_MARKER.test(allText)).toBe(false);
    expect(GRADE79_MARKER.test(allText)).toBe(false);
  });

  test("skips normal theory lessons", () => {
    const draft = {
      pages: [{ blocks: [{ type: "text", role: "definition", content: "Homeostasis definition." }] }],
    };
    ensureReactionTimeEducationalRefinement(draft, {
      topic: "Homeostasis",
      topicKey: "aqa-gcse-biology:homeostasis",
    });
    expect(draft.pages[0].blocks).toHaveLength(1);
  });

  test("sanitizeDraft applies refinement for reaction time RP", () => {
    const draft = {
      title: RP_CTX.topic,
      topic: RP_CTX.topic,
      pages: [
        {
          title: "Page 1",
          order: 1,
          blocks: [
            { type: "text", role: "hook", content: "Hook" },
            { type: "text", role: "definition", content: "Definition" },
          ],
        },
      ],
    };

    const sanitized = sanitizeDraftForTest(draft, {
      topic: RP_CTX.topic,
      topicKey: RP_CTX.topicKey,
      subTopic: RP_CTX.subTopic,
      subject: "Biology",
    });

    expect(sanitized.pages[0].blocks.length).toBeGreaterThanOrEqual(19);
    expect(sanitized.pages[0].blocks.slice(0, 19).map((b) => b.title)).toEqual(
      REQUIRED_PRACTICAL_DASHBOARD_SLOTS.map((s) => s.title)
    );
    const allText = sanitized.pages[0].blocks.map((b) => b.content).join("\n");
    expect(EXAMINER_THINKING_MARKER.test(allText)).toBe(true);
    expect(WORKED_ANOMALY_MARKER.test(allText)).toBe(true);
  });
});
