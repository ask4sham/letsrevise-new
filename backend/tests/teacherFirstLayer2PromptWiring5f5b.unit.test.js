/**
 * Phase 3b.3f.5B — Layer 2 opening appendix wired into dashboard prompt (non-RP).
 * @jest-environment node
 */

const {
  buildUserPromptFromMdForTest,
  buildTeacherFirstLayer2OpeningAppendixForTest,
} = require("../routes/ai");

describe("teacherFirstLayer2PromptWiring5f5b (Phase 3b.3f.5B)", () => {
  const prevFlag = process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    else process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = prevFlag;
  });

  test("appendix empty when Teacher-First flag off", () => {
    delete process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING;
    expect(
      buildTeacherFirstLayer2OpeningAppendixForTest({
        topic: "Reflex Arc",
        topicKey: "aqa-gcse-biology:reflex-arc",
        subject: "Biology",
      })
    ).toBe("");
  });

  test("profiled topic appendix contains Layer 2 definition and core model", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const appendix = buildTeacherFirstLayer2OpeningAppendixForTest({
      topic: "Reflex Arc",
      topicKey: "aqa-gcse-biology:reflex-arc",
      subject: "Biology",
    });
    expect(appendix).toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
    expect(appendix).toMatch(/reflex-arc/);
    expect(appendix).toMatch(/automatic response/i);
    expect(appendix).toMatch(/Sensory neurone/i);
  });

  test("required practical mode skips Layer 2 theory appendix in dashboard prompt", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const appendix = buildTeacherFirstLayer2OpeningAppendixForTest({
      topic: "Required Practical: Reaction time",
      topicKey: "aqa-gcse-biology:rp-reaction-time",
      subject: "Biology",
    });
    expect(appendix).toBe("");
  });

  test("buildUserPromptFromMd includes appendix for profiled non-RP topic", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    const prompt = buildUserPromptFromMdForTest({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      tier: "higher",
      topicKey: "aqa-gcse-biology:cell-structure",
      subTopicDisplay: "Cell structure",
    });
    expect(prompt).toMatch(/TEACHER-FIRST KNOWLEDGE DELIVERY/);
    expect(prompt).toMatch(/cell-structure/);
    expect(prompt).toMatch(/chloroplast/i);
  });
});
