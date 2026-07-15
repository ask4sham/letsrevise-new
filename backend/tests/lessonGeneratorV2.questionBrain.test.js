/**
 * Lesson Generator V2 — Phase 3 Question Brain tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const {
  runLessonGeneratorV2Scaffold,
  buildPhase1Lesson,
  buildPhase2VisualActivities,
  buildPhase3Questions,
  validatePhase3Questions,
  isBannedStem,
  STAGE_STATUS,
} = require("../services/lessonGeneratorV2");

const hashedPassword = bcrypt.hashSync("password123", 10);

const BANNED_SAMPLES = [
  "Which statement best explains a key idea about this topic?",
  "Which statement best matches this topic?",
  "A correct statement about this topic is Option 1",
  "Identify the role of X in Y",
  "Which option correctly defines X for Y?",
  "X alone completes Y",
  "This might be tested in an exam",
  "The cause → effect chain best explains the idea",
  "A key factor in this process is missing",
  "Choose the later step in this process",
];

describe("Lesson Generator V2 Phase 3 Question Brain", () => {
  let teacherToken;
  const prevFlag = process.env.LESSON_GENERATOR_V2_ENABLED;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "V2",
      lastName: "QuestionBrain",
      email: "lesson-gen-v2-phase3@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "lesson-gen-v2-phase3@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = prevFlag;
    await User.deleteMany({ email: "lesson-gen-v2-phase3@test.com" });
  });

  test("V2 flag off still returns 503", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "0";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ topic: "Cell structure", subject: "Biology", level: "GCSE" });
    expect(res.status).toBe(503);
  });

  test("Phase 3 requires completed Phase 1 and Phase 2", async () => {
    const { runQuestionBrain } = require("../services/lessonGeneratorV2/questionBrain");
    const stagedMissingPhase2 = {
      phase1Lesson: {
        status: STAGE_STATUS.COMPLETE,
        topic: "Cell structure",
        keyTerms: ["nucleus"],
        sections: [{ id: "core", content: "Eukaryotic cells have a nucleus." }],
        misconceptions: [],
        examTips: [],
      },
      phase2VisualActivities: {
        status: STAGE_STATUS.STUB,
        teachingDiagrams: [],
        retrievalActivities: [],
        studentSafe: true,
      },
      phase3Questions: {},
    };
    await expect(
      runQuestionBrain(
        { topic: "Cell structure", subject: "Biology", level: "GCSE" },
        stagedMissingPhase2
      )
    ).rejects.toMatchObject({ code: "LESSON_V2_PHASE3_FAILED", status: 422 });

    const stagedMissingPhase1 = {
      phase1Lesson: { status: STAGE_STATUS.STUB },
      phase2VisualActivities: { status: STAGE_STATUS.COMPLETE, studentSafe: true },
      phase3Questions: {},
    };
    await expect(
      runQuestionBrain(
        { topic: "Cell structure", subject: "Biology", level: "GCSE" },
        stagedMissingPhase1
      )
    ).rejects.toMatchObject({ code: "LESSON_V2_PHASE3_FAILED", status: 422 });
  });

  async function assertPhase3Topic(topic) {
    const result = await runLessonGeneratorV2Scaffold({
      topic,
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    expect(result.saved).toBe(false);
    expect(result.phase3Complete).toBe(true);
    const p3 = result.staged.phase3Questions;
    expect(p3.status).toBe(STAGE_STATUS.COMPLETE);
    expect(p3.selfCheck).toHaveLength(3);
    expect(p3.checkpoint).toHaveLength(3);
    expect(p3.quiz).toHaveLength(5);

    const stems = [...p3.selfCheck, ...p3.checkpoint, ...p3.quiz].map((q) => q.prompt);
    for (const stem of stems) {
      expect(isBannedStem(stem, { topic })).toBe(false);
      expect(stem).not.toMatch(/\bOption\s*[123]\b/i);
    }

    const cpStems = p3.checkpoint.map((q) => q.prompt.toLowerCase());
    expect(new Set(cpStems).size).toBe(3);

    for (const q of [...p3.selfCheck, ...p3.checkpoint, ...p3.quiz]) {
      expect(String(q.correctAnswer || "").trim().length).toBeGreaterThan(2);
      if (q.questionType === "mcq") {
        const opts = q.options.map((o) => o.toLowerCase());
        expect(new Set(opts).size).toBe(opts.length);
        expect(opts.some((o) => /^option\s*[123]$/i.test(o))).toBe(false);
      }
    }

    const scPurposes = p3.selfCheck.map((q) => q.purpose);
    expect(scPurposes).toEqual(expect.arrayContaining(["misconception"]));
    expect(scPurposes.some((p) => ["recall", "definition"].includes(p))).toBe(true);
    expect(scPurposes.some((p) => ["explain", "application"].includes(p))).toBe(true);

    const phase1 = result.staged.phase1Lesson;
    const blob = stems.join(" ").toLowerCase();
    expect(phase1.keyTerms.some((t) => blob.includes(String(t).toLowerCase()))).toBe(true);

    expect(result.staged.criticReport.phase3QualityOk).toBe(true);
    expect(result.staged.criticReport.ok).toBe(false);
    expect(result.staged.criticReport.issues).toContain("final_lesson_persistence_not_ready");
    return result;
  }

  test("Cell structure: counts, variety, no banned stems", async () => {
    await assertPhase3Topic("Cell structure");
  });

  test("Homeostasis fixture: counts and answers", async () => {
    await assertPhase3Topic("Homeostasis");
  });

  test("Gametes & Fertilisation: topic-specific questions", async () => {
    const result = await assertPhase3Topic("Gametes & Fertilisation");
    const blob = [...result.staged.phase3Questions.selfCheck, ...result.staged.phase3Questions.quiz]
      .map((q) => q.prompt)
      .join(" ")
      .toLowerCase();
    expect(blob).toMatch(/gamete|fertilis|zygote|haploid|sperm|egg/);
  });

  test("Sexual & Asexual Reproduction: no filler checkpoint clone", async () => {
    const result = await assertPhase3Topic("Sexual & Asexual Reproduction");
    const purposes = result.staged.phase3Questions.checkpoint.map((q) => q.purpose);
    expect(new Set(purposes).size).toBe(3);
  });

  test("hard bans reject known bad stems", () => {
    for (const stem of BANNED_SAMPLES) {
      expect(isBannedStem(stem, { topic: "Cell structure" })).toBe(true);
    }
  });

  test("validator rejects wrong counts and Option filler", () => {
    const phase1 = buildPhase1Lesson({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    const phase2 = buildPhase2VisualActivities(
      { topic: "Cell structure", subject: "Biology", level: "GCSE" },
      phase1
    );
    const good = buildPhase3Questions(
      { topic: "Cell structure", subject: "Biology", level: "GCSE", board: "AQA" },
      phase1,
      phase2
    );
    expect(validatePhase3Questions(good, { phase1, phase2, topic: "Cell structure" }).ok).toBe(true);

    const bad = {
      ...good,
      selfCheck: good.selfCheck.slice(0, 2),
      checkpoint: [
        ...good.checkpoint.slice(0, 2),
        {
          id: "bad",
          prompt: "Which statement best explains a key idea about Cell structure?",
          questionType: "mcq",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          correctAnswer: "Option 1",
          purpose: "recall",
        },
      ],
    };
    const check = validatePhase3Questions(bad, { phase1, phase2, topic: "Cell structure" });
    expect(check.ok).toBe(false);
    expect(check.issues.some((i) => i.includes("selfCheck_must_be_exactly_3") || i.includes("banned"))).toBe(
      true
    );
  });

  test("Phase 3 fail-closed on bad override", async () => {
    await expect(
      runLessonGeneratorV2Scaffold({
        topic: "Cell structure",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        phase3Override: {
          status: STAGE_STATUS.COMPLETE,
          selfCheck: [],
          checkpoint: [],
          quiz: [],
          questionsFinalised: true,
        },
      })
    ).rejects.toMatchObject({ code: "LESSON_V2_PHASE3_FAILED", status: 422 });
  });

  test("retrieval-image answers are not revealed by student-facing questions", async () => {
    const result = await runLessonGeneratorV2Scaffold({
      topic: "Cell structure",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
    });
    const banned = (result.staged.phase2VisualActivities.retrievalActivities || []).flatMap(
      (a) => a.bannedRevealTerms || []
    );
    for (const q of result.staged.phase3Questions.selfCheck) {
      expect(String(q.prompt)).not.toMatch(/\bCORRECT\b/);
      expect(String(q.prompt)).not.toMatch(/\bTARGET\s+CELL\b/);
      for (const term of banned) {
        expect(String(q.prompt).toLowerCase()).not.toMatch(
          new RegExp(`the (highlighted|labelled|labeled) structure is ${term}`, "i")
        );
      }
    }
  });

  test("V1 generate-and-save still present", () => {
    const aiRouter = require("../routes/ai");
    const hasV1 = (aiRouter.stack || []).some(
      (layer) => layer.route && layer.route.path === "/generate-and-save" && layer.route.methods?.post
    );
    expect(hasV1).toBe(true);
  });

  test("HTTP path returns Phase 3 complete and does not save", async () => {
    process.env.LESSON_GENERATOR_V2_ENABLED = "1";
    const res = await request(app)
      .post("/api/ai/generate-and-save-v2")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        topic: "Gametes & Fertilisation",
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
      });
    expect(res.status).toBe(200);
    expect(res.body.phase3Complete).toBe(true);
    expect(res.body.saved).toBe(false);
    expect(res.body.staged.phase3Questions.selfCheck).toHaveLength(3);
    expect(res.body.staged.phase3Questions.checkpoint).toHaveLength(3);
    expect(res.body.staged.phase3Questions.quiz).toHaveLength(5);
  });
});
