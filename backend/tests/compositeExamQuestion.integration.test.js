/**
 * Composite Exam Question V1 — create (draft), publish (strict), and lesson-embed round-trip.
 *
 * Guards:
 *  - POST creates a composite draft with computed totalMarks and normalised parts.
 *  - Draft save is lenient (no full mark scheme required on MCQ parts).
 *  - Publish is strict (short parts need a substantive mark-scheme point).
 *  - GET /:id and lesson embed return the full parts array so ExamQuestionBlock can render it.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("password123", 10);

jest.setTimeout(20000);

const SPEC_KEY = "edexcel-igcse-biology";
const TOPIC_KEY = "edexcel-igcse-biology:human-male-and-female-reproductive-systems";

function compositePayload(overrides = {}) {
  return {
    subject: "Biology",
    examBoard: "Edexcel",
    level: "IGCSE",
    specKey: SPEC_KEY,
    topicKey: TOPIC_KEY,
    topic: "Human Male & Female Reproductive Systems",
    questionMode: "composite",
    title: "Sperm cell",
    sharedStem: "The diagram shows a human sperm cell.",
    imageUrl: "https://cdn.example.com/exam-questions/sperm.png",
    parts: [
      {
        label: "a",
        type: "mcq",
        marks: 1,
        questionText: "What is the maximum number of X chromosomes in a sperm cell nucleus?",
        options: ["0", "1", "2", "23"],
        correctIndex: 1,
      },
      {
        label: "b",
        type: "short",
        marks: 2,
        questionText: "Explain the function of the mitochondria in the middle piece.",
        markScheme: ["Release energy via aerobic respiration to power the tail for swimming."],
      },
      {
        label: "c",
        type: "short",
        marks: 2,
        questionText: "Suggest the function of the acrosome.",
        markScheme: ["Contains digestive enzymes to break down the egg cell membrane at fertilisation."],
      },
    ],
    ...overrides,
  };
}

describe("Composite Exam Question V1", () => {
  let token;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Composite",
      lastName: "Teacher",
      email: "composite-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "composite-teacher@test.com", password: "password123" });
    token = login.body?.token;
    if (!token) throw new Error("Login failed");
  });

  test("POST creates a composite draft with computed totalMarks and parts", async () => {
    const res = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(compositePayload());
    expect(res.status).toBe(201);
    const q = res.body?.question;
    expect(q).toBeTruthy();
    expect(q.questionMode).toBe("composite");
    expect(q.type).toBe("composite");
    expect(q.totalMarks).toBe(5);
    expect(q.marks).toBe(5);
    expect(Array.isArray(q.parts)).toBe(true);
    expect(q.parts).toHaveLength(3);
    expect(q.parts[0].type).toBe("mcq");
    expect(q.parts[0].correctIndex).toBe(1);
    expect(q.imageUrl).toBe("https://cdn.example.com/exam-questions/sperm.png");
    expect(q.status).toBe("draft");

    const inDb = await ExamQuestion.findById(q._id).lean();
    expect(inDb.questionMode).toBe("composite");
    expect(inDb.parts).toHaveLength(3);
    expect(inDb.totalMarks).toBe(5);
  });

  test("POST rejects composite draft with an MCQ part missing a correct option", async () => {
    const res = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        compositePayload({
          parts: [
            {
              label: "a",
              type: "mcq",
              marks: 1,
              questionText: "Pick one",
              options: ["only-one"],
            },
          ],
        })
      );
    expect(res.status).toBe(400);
  });

  test("PUT publish succeeds when short parts have substantive mark schemes", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(compositePayload());
    const id = created.body.question._id;

    const pub = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });
    expect(pub.status).toBe(200);
    expect(pub.body?.question?.status).toBe("published");
  });

  test("PUT publish is blocked when a short part has no substantive mark scheme", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        compositePayload({
          parts: [
            {
              label: "a",
              type: "short",
              marks: 2,
              questionText: "Describe the route of a sperm cell.",
              markScheme: ["short"],
            },
          ],
        })
      );
    const id = created.body.question._id;

    const pub = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });
    expect(pub.status).toBe(400);

    const inDb = await ExamQuestion.findById(id).lean();
    expect(inDb.status).toBe("draft");
  });

  test("PUT can edit parts and recomputes totalMarks", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(compositePayload());
    const id = created.body.question._id;

    const put = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        parts: [
          { label: "a", type: "short", marks: 3, questionText: "Explain fertilisation.", markScheme: ["Fusion of nuclei"] },
          { label: "b", type: "short", marks: 4, questionText: "Explain implantation.", markScheme: ["Embeds in uterus lining"] },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body?.question?.totalMarks).toBe(7);
    expect(put.body?.question?.parts).toHaveLength(2);
  });

  test("lesson embed round-trip returns composite parts for the referenced id", async () => {
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(compositePayload());
    const id = String(created.body.question._id);
    await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "published" });

    const lesson = await Lesson.create({
      title: "Reproduction",
      description: "Desc",
      content: "Content",
      teacherId,
      teacherName: "Composite Teacher",
      subject: "Biology",
      level: "IGCSE",
      topic: "Reproduction",
      status: "draft",
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 1,
          blocks: [{ type: "examQuestion", examQuestionId: id }],
        },
      ],
    });

    const res = await request(app)
      .get(`/api/exam-questions/${id}`)
      .query({ lessonId: String(lesson._id) })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const q = res.body?.question;
    expect(q.questionMode).toBe("composite");
    expect(Array.isArray(q.parts)).toBe(true);
    expect(q.parts).toHaveLength(3);
    expect(q.totalMarks).toBe(5);
  });

  test("MCQ partData.explanation survives POST/GET/PUT and by-ids without changing scoring fields", async () => {
    const rationale =
      "Light is not essential for germination because the seed initially uses energy stored in its food reserves. Water activates enzymes, oxygen is required for aerobic respiration, and a suitable temperature allows enzyme-controlled reactions to occur.";
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        compositePayload({
          parts: [
            {
              label: "a",
              type: "mcq",
              marks: 1,
              questionText: "Which factor is NOT essential for seed germination?",
              options: ["Water", "Oxygen", "Suitable temperature", "Light"],
              correctIndex: 3,
              markScheme: ["Award 1 mark for selecting Light."],
              partData: {
                explanation: `  ${rationale}  `,
                unexpectedKey: "remove me",
              },
            },
            {
              label: "b",
              type: "short",
              marks: 2,
              questionText: "Explain why water is needed.",
              markScheme: ["Water activates enzymes so metabolism can begin."],
            },
          ],
        })
      );
    expect(created.status).toBe(201);
    const id = String(created.body.question._id);
    const mcq = created.body.question.parts[0];
    expect(mcq.partData).toEqual({ explanation: rationale });
    expect(mcq.partData).not.toHaveProperty("unexpectedKey");
    expect(mcq.options).toEqual(["Water", "Oxygen", "Suitable temperature", "Light"]);
    expect(mcq.correctIndex).toBe(3);
    expect(mcq.marks).toBe(1);

    const got = await request(app)
      .get(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(got.status).toBe(200);
    expect(got.body.question.parts[0].partData).toEqual({ explanation: rationale });

    const updatedRationale = "Updated rationale: seeds use stored food reserves, so light is not essential.";
    const put = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionMode: "composite",
        sharedStem: created.body.question.sharedStem,
        topicKey: TOPIC_KEY,
        specKey: SPEC_KEY,
        parts: [
          {
            label: "a",
            type: "mcq",
            marks: 1,
            questionText: "Which factor is NOT essential for seed germination?",
            options: ["Water", "Oxygen", "Suitable temperature", "Light"],
            correctIndex: 3,
            markScheme: ["Award 1 mark for selecting Light."],
            partData: { explanation: updatedRationale },
          },
          {
            label: "b",
            type: "short",
            marks: 2,
            questionText: "Explain why water is needed.",
            markScheme: ["Water activates enzymes so metabolism can begin."],
          },
        ],
      });
    expect(put.status).toBe(200);
    expect(put.body.question.parts[0].partData).toEqual({ explanation: updatedRationale });
    expect(put.body.question.parts[0].correctIndex).toBe(3);
    expect(put.body.question.parts[0].marks).toBe(1);
    expect(put.body.question.totalMarks).toBe(3);

    const byIds = await request(app)
      .post("/api/exam-questions/by-ids")
      .set("Authorization", `Bearer ${token}`)
      .send({ ids: [id] });
    expect(byIds.status).toBe(200);
    const listed = byIds.body?.questions || byIds.body;
    const found = Array.isArray(listed)
      ? listed.find((q) => String(q._id) === id)
      : null;
    expect(found).toBeTruthy();
    expect(found.parts[0].partData).toEqual({ explanation: updatedRationale });
  });

  test("POST rejects over-length MCQ explanation with 400", async () => {
    const res = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        compositePayload({
          parts: [
            {
              label: "a",
              type: "mcq",
              marks: 1,
              questionText: "Pick one",
              options: ["A", "B", "C", "D"],
              correctIndex: 0,
              partData: { explanation: "x".repeat(1001) },
            },
          ],
        })
      );
    expect(res.status).toBe(400);
    expect(res.body?.msg || res.body?.error || "").toMatch(/at most 1000 characters/i);
  });

  test("PUT rejects over-length explanation without persisting and clearing removes partData", async () => {
    const validRationale = "Water activates enzymes so metabolism can begin in the seed.";
    const created = await request(app)
      .post("/api/exam-questions")
      .set("Authorization", `Bearer ${token}`)
      .send(
        compositePayload({
          parts: [
            {
              label: "a",
              type: "mcq",
              marks: 1,
              questionText: "Pick one",
              options: ["Water", "Light"],
              correctIndex: 0,
              markScheme: ["Award 1 mark for Water."],
              partData: { explanation: validRationale },
            },
            {
              label: "b",
              type: "short",
              marks: 2,
              questionText: "Explain briefly.",
              markScheme: ["Point one is long enough"],
            },
          ],
        })
      );
    expect(created.status).toBe(201);
    const id = String(created.body.question._id);
    expect(created.body.question.parts[0].partData).toEqual({ explanation: validRationale });
    expect(created.body.question.status).toBe("draft");

    const rejected = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionMode: "composite",
        sharedStem: created.body.question.sharedStem,
        topicKey: TOPIC_KEY,
        specKey: SPEC_KEY,
        parts: [
          {
            label: "a",
            type: "mcq",
            marks: 1,
            questionText: "Pick one",
            options: ["Water", "Light"],
            correctIndex: 0,
            markScheme: ["Award 1 mark for Water."],
            partData: { explanation: "x".repeat(1001) },
          },
          {
            label: "b",
            type: "short",
            marks: 2,
            questionText: "Explain briefly.",
            markScheme: ["Point one is long enough"],
          },
        ],
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body?.msg || "").toMatch(/at most 1000 characters/i);

    const afterReject = await ExamQuestion.findById(id).lean();
    expect(afterReject.parts[0].partData).toEqual({ explanation: validRationale });
    expect(afterReject.parts[0].correctIndex).toBe(0);
    expect(afterReject.parts[0].options).toEqual(["Water", "Light"]);
    expect(afterReject.parts[0].marks).toBe(1);
    expect(afterReject.status).toBe("draft");

    const cleared = await request(app)
      .put(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        questionMode: "composite",
        sharedStem: created.body.question.sharedStem,
        topicKey: TOPIC_KEY,
        specKey: SPEC_KEY,
        parts: [
          {
            label: "a",
            type: "mcq",
            marks: 1,
            questionText: "Pick one",
            options: ["Water", "Light"],
            correctIndex: 0,
            markScheme: ["Award 1 mark for Water."],
          },
          {
            label: "b",
            type: "short",
            marks: 2,
            questionText: "Explain briefly.",
            markScheme: ["Point one is long enough"],
          },
        ],
      });
    expect(cleared.status).toBe(200);
    expect(cleared.body.question.parts[0].partData).toBeUndefined();
    expect(cleared.body.question.parts[0].correctIndex).toBe(0);
    expect(cleared.body.question.status).toBe("draft");

    const got = await request(app)
      .get(`/api/exam-questions/${id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(got.status).toBe(200);
    expect(got.body.question.parts[0].partData).toBeUndefined();
  });
});
