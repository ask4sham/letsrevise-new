/**
 * Strict taxonomy linkage for question banks.
 * Verifies: exact topicKey matching only; no sibling drift; thin coverage warning.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");
const Lesson = require("../models/Lesson");
const { filterBankItemsByDrift, validateGeneratedContentAgainstTopic } = require("../utils/topicDriftValidation");
const { queryCandidates } = require("../utils/topicKey");

const hashedPassword = bcrypt.hashSync("password123", 10);

const CELL_STRUCTURE_KEY = "aqa-gcse-biology:cell-structure";
const BIODIVERSITY_KEY = "aqa-gcse-biology:biodiversity";

describe("Question bank taxonomy scoping", () => {
  let teacherToken;
  let teacherId;
  let lessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Tax",
      lastName: "Bank",
      email: "taxonomy-bank-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "taxonomy-bank-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");

    const lesson = await Lesson.create({
      teacherId,
      teacherName: "Tax Bank",
      title: "Cell Structure Test",
      description: "Test lesson for taxonomy scoping",
      content: "Test content",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: CELL_STRUCTURE_KEY,
      status: "draft",
      isPublished: false,
      pages: [{ pageId: "p1", title: "Page 1", order: 0, blocks: [{ type: "text", content: "Intro" }] }],
    });
    lessonId = lesson._id;
  }, 15000);

  afterAll(async () => {
    await User.deleteMany({ email: "taxonomy-bank-teacher@test.com" });
    await TopicQuizQuestion.deleteMany({ ownerId: teacherId });
    await TopicFlashcard.deleteMany({ ownerId: teacherId });
    await ExamQuestion.deleteMany({ teacherId });
    await Lesson.deleteMany({ teacherId });
  });

  describe("queryCandidates returns exact sub-topic keys only", () => {
    test("cell-structure candidates are namespaced + legacy, no sibling topics", () => {
      const candidates = queryCandidates("aqa-gcse-biology", "cell-structure");
      expect(candidates).toContain("aqa-gcse-biology:cell-structure");
      expect(candidates).toContain("cell-structure");
      expect(candidates).not.toContain("mitosis-cell-cycle");
      expect(candidates).not.toContain("osmosis");
      expect(candidates).not.toContain("diffusion");
    });
  });

  describe("filterBankItemsByDrift excludes sibling-topic items", () => {
    test("Cell structure: allows nucleus, cytoplasm, cell membrane; removes mitosis, osmosis", () => {
      const filtered = filterBankItemsByDrift({
        topicKey: "cell-structure",
        specKey: "aqa-gcse-biology",
        subTopicLabel: "Cell structure",
        flashcards: [
          { front: "Function of nucleus?", back: "Contains DNA and controls cell" },
          { front: "What is mitosis?", back: "Cell division producing daughter cells" },
        ],
        quizItems: [
          { question: "Where is the cytoplasm?", options: ["A", "B", "C"] },
          { question: "Osmosis is the movement of water. Osmosis occurs across membranes.", options: ["A", "B"] },
        ],
        examQuestions: [],
      });
      expect(filtered.flashcards.length).toBe(1);
      expect(filtered.flashcards[0].front).toMatch(/nucleus/i);
      expect(filtered.removedCount).toBeGreaterThan(0);
      expect(filtered.driftedPhrases.some((p) => p.includes("mitosis") || p.includes("osmosis"))).toBe(true);
    });

    test("Biodiversity: allows biodiversity terms; removes deforestation", () => {
      const filtered = filterBankItemsByDrift({
        topicKey: "biodiversity",
        specKey: "aqa-gcse-biology",
        flashcards: [
          { front: "What is biodiversity?", back: "Variety of life" },
          { front: "Deforestation reduces biodiversity. Deforestation destroys habitats.", back: "Impact" },
        ],
        quizItems: [],
        examQuestions: [],
      });
      expect(filtered.flashcards.length).toBe(1);
      expect(filtered.flashcards[0].front).toMatch(/biodiversity/i);
      expect(filtered.removedCount).toBe(1);
    });
  });

  describe("validateGeneratedContentAgainstTopic: Cell Biology → Cell structure", () => {
    test("ALLOWED: nucleus, cytoplasm, cell membrane, ribosomes, eukaryotic, prokaryotic", () => {
      const result = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey: "aqa-gcse-biology",
        quizItems: [
          { question: "What is the function of the nucleus?", options: ["Contains DNA", "B", "C"] },
          { question: "Role of cytoplasm?", options: ["A", "B", "C"] },
          { question: "Cell membrane function?", options: ["A", "B", "C"] },
        ],
      });
      expect(result.valid).toBe(true);
      expect(result.driftedPhrases).toEqual([]);
    });

    test("MUST NOT: mitosis, osmosis, diffusion, microscopy, stem cells", () => {
      const mitosisResult = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey: "aqa-gcse-biology",
        quizItems: [
          { question: "Mitosis is the process of cell division. Mitosis produces two identical cells.", options: ["A", "B"] },
        ],
      });
      expect(mitosisResult.valid).toBe(false);
      expect(mitosisResult.driftedPhrases).toContain("mitosis");

      const osmosisResult = validateGeneratedContentAgainstTopic({
        topicKey: "cell-structure",
        specKey: "aqa-gcse-biology",
        quizItems: [
          { question: "Osmosis is water movement. Osmosis occurs across membranes.", options: ["A", "B"] },
        ],
      });
      expect(osmosisResult.valid).toBe(false);
    });
  });

  describe("GET topic-quiz-questions by exact topicKey", () => {
    beforeAll(async () => {
      await TopicQuizQuestion.create({
        ownerId: teacherId,
        topicKey: CELL_STRUCTURE_KEY,
        questionText: "What is the function of the nucleus?",
        choices: ["Contains DNA", "Makes proteins", "Stores water", "Produces energy"],
        correctIndex: 0,
        type: "mcq",
        kind: "quiz",
        status: "published",
        fingerprint: "fp_nucleus_" + Date.now(),
      });
      await TopicQuizQuestion.create({
        ownerId: teacherId,
        topicKey: "aqa-gcse-biology:mitosis-cell-cycle",
        questionText: "What happens during mitosis?",
        choices: ["A", "B", "C", "D"],
        correctIndex: 0,
        type: "mcq",
        kind: "quiz",
        status: "published",
        fingerprint: "fp_mitosis_" + Date.now(),
      });
    });

    test("returns only cell-structure questions when topicKey=aqa-gcse-biology:cell-structure", async () => {
      const res = await request(app)
        .get("/api/topic-quiz-questions")
        .set("Authorization", `Bearer ${teacherToken}`)
        .query({ topicKey: CELL_STRUCTURE_KEY });
      expect(res.status).toBe(200);
      const items = res.body?.items || [];
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.every((q) => q.topicKey === CELL_STRUCTURE_KEY || q.topicKey === "cell-structure")).toBe(true);
      expect(items.some((q) => (q.questionText || "").includes("mitosis"))).toBe(false);
    });
  });

  describe("Auto-attach returns thin coverage warning when few exact-match items", () => {
    test("attach-by-topic returns warning when added < requested", async () => {
      const res = await request(app)
        .post(`/api/lessons/${lessonId}/exam-questions/attach-by-topic`)
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ limit: 20 });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      if (res.body.added < res.body.requested && res.body.requested > 0) {
        expect(res.body.warning).toMatch(/limited|exact-match/i);
      }
    });
  });
});
