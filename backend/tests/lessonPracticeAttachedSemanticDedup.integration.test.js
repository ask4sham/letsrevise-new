/**
 * Attached practice semantic dedup: teacher-attached questions are authoritative.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const ExamQuestion = require("../models/ExamQuestion");
const {
  overlapsExamFingerprint,
  buildExamQuestionFingerprints,
} = require("../../lib/teacherBrain/examAwarePractice");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id/practice attached semantic dedup", () => {
  let teacherId;
  let lessonId;
  let token;
  let compositeId;
  let phenotypeAttachedId;
  const attachedIds = [];

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Attached",
      lastName: "Dedup",
      email: "attached-practice-dedup-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const composite = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "composite",
      question: "Mutations can have various effects on organisms, and understanding these effects is crucial in genetics.",
      imageUrl: "/visuals/mutation.png",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      parts: [
        {
          type: "mcq",
          questionText: "Which of the following statements about mutations is most accurate?",
          markScheme: ["Award 1 mark for selecting option C."],
        },
        {
          type: "short",
          questionText:
            "Explain how a mutation in DNA can lead to a change in an organism's phenotype.",
          markScheme: [
            "Mutation can change the base sequence of DNA.",
            "This may change the sequence of amino acids in a protein.",
          ],
        },
      ],
    });
    compositeId = composite._id;

    const phenotypeMaster = await ExamQuestion.create({
      teacherId,
      subject: "Biology",
      type: "short",
      question: "Explain how mutations can affect protein synthesis and organism traits.",
      marks: 4,
      markScheme: ["Describe the process of how mutations change amino acid sequences."],
      topicKey: "edexcel-igcse-biology:mutation",
      topic: "Mutation",
      status: "published",
    });
    phenotypeAttachedId = phenotypeMaster._id;

    const curated = [
      {
        master: {
          question: "State how mutations can contribute to evolution.",
          marks: 5,
          markScheme: ["Discuss how mutations introduce genetic variation."],
        },
        lessonEdit: {
          type: "short",
          question: "Explain how mutations can contribute to evolution.",
          marks: 4,
          markScheme: [
            "Mutations can produce new alleles and increase genetic variation.",
            "Some mutations may produce an advantageous characteristic.",
            "Individuals with the advantageous characteristic may be more likely to survive and reproduce.",
            "The advantageous allele may be passed to offspring and become more common in the population over generations.",
          ],
          editedAt: new Date(),
        },
      },
      {
        master: {
          question: "Explain how mutations can increase genetic variation within a population",
          marks: 5,
          markScheme: ["Discuss the role of mutations in creating new alleles."],
        },
        lessonEdit: {
          type: "short",
          question: "Explain how an error during DNA replication can cause a mutation.",
          marks: 2,
          markScheme: [
            "An incorrect DNA base may be inserted or paired during DNA replication.",
            "This changes the DNA base sequence, producing a mutation.",
          ],
          editedAt: new Date(),
        },
      },
      {
        master: {
          question: "Describe how a mutation can lead to a genetic disorder.",
          marks: 4,
          markScheme: ["Explain the process of how a mutation alters a gene."],
        },
        lessonEdit: {
          type: "short",
          question: "Explain how a mutation in a gene can lead to a genetic disorder.",
          marks: 4,
          markScheme: [
            "A mutation changes the DNA base sequence of a gene.",
            "This may change the sequence of amino acids in the protein produced.",
            "The protein may have a different shape or function.",
            "This can disrupt normal cell function and result in a genetic disorder.",
          ],
          editedAt: new Date(),
        },
      },
      {
        master: phenotypeMaster.toObject(),
        lessonEdit: {
          type: "short",
          question: "Explain how a mutation in DNA can result in a change in phenotype.",
          marks: 4,
          markScheme: [
            "A mutation changes the DNA base sequence of a gene.",
            "This may change the sequence of amino acids in the protein produced.",
            "The protein may have a different shape or function.",
            "This may result in a change in the organism's phenotype.",
          ],
          editedAt: new Date(),
        },
      },
    ];

    for (let i = 4; i < 10; i++) {
      curated.push({
        master: {
          question: `Placeholder attached master ${i + 1}`,
          marks: 2,
          markScheme: [`Point ${i + 1}`],
        },
        lessonEdit: {
          type: "short",
          question: `Attached curated question ${i + 1}`,
          marks: 2,
          markScheme: [`Curated point ${i + 1}a`, `Curated point ${i + 1}b`],
          editedAt: new Date(),
        },
      });
    }

    for (const item of curated) {
      const eq =
        item.master._id != null
          ? item.master
          : await ExamQuestion.create({
              teacherId,
              subject: "Biology",
              type: "short",
              question: item.master.question,
              marks: item.master.marks,
              markScheme: item.master.markScheme,
              topicKey: "edexcel-igcse-biology:mutation",
              topic: "Mutation",
              status: "published",
            });
      attachedIds.push(String(eq._id));
    }

    const examQuestions = curated.map((item, idx) => {
      const id = attachedIds[idx];
      return {
        questionId: id,
        addedAt: new Date(`2026-08-30T09:43:39.${530 + idx}Z`),
        lessonEdit: item.lessonEdit,
      };
    });

    const lesson = await Lesson.create({
      title: "Attached Dedup Lesson",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      isFreePreview: false,
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 1,
          blocks: [
            { type: "text", content: "Intro" },
            { type: "examQuestion", examQuestionId: compositeId },
          ],
        },
      ],
      examQuestions,
    });
    lessonId = lesson._id;

    const login = await request(app).post("/api/auth/login").send({
      email: "attached-practice-dedup-teacher@test.com",
      password: "password123",
    });
    token = login.body?.token;
    if (!token) {
      const res = await request(app).post("/api/users/login").send({
        email: "attached-practice-dedup-teacher@test.com",
        password: "password123",
      });
      token = res.body?.token;
    }
  });

  afterAll(async () => {
    await User.deleteMany({ email: /attached-practice-dedup-teacher@test.com/ });
    await Lesson.deleteMany({ title: "Attached Dedup Lesson" });
    await ExamQuestion.deleteMany({ topicKey: "edexcel-igcse-biology:mutation", teacherId });
  });

  it("production-shaped: includes phenotype attached question despite embedded composite overlap", async () => {
    const fps = buildExamQuestionFingerprints([
      {
        _id: compositeId,
        type: "composite",
        question: "Mutations can have various effects on organisms.",
        imageUrl: "/visuals/mutation.png",
        topic: "Mutation",
        parts: [
          {
            type: "short",
            questionText:
              "Explain how a mutation in DNA can lead to a change in an organism's phenotype.",
            markScheme: ["Mutation can change the base sequence of DNA."],
          },
        ],
      },
    ]);
    const phenotypeText = "Explain how a mutation in DNA can result in a change in phenotype.";
    expect(overlapsExamFingerprint(phenotypeText, fps)).toBe(true);

    const res = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=10`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.source).toBe("attached");
    expect(res.body.questions).toHaveLength(10);
    const phenotype = res.body.questions.find((q) => String(q.id) === String(phenotypeAttachedId));
    expect(phenotype).toBeDefined();
    expect(phenotype.question).toBe(phenotypeText);
    expect(phenotype.marks).toBe(4);
    expect(phenotype.markScheme).toHaveLength(4);
  });

  it("exact-ID duplicate: embedded composite ID is not duplicated when also attached", async () => {
    const lessonWithDup = await Lesson.create({
      title: "Attached Dedup Exact ID",
      description: "D",
      content: "C",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Mutation",
      topicKey: "edexcel-igcse-biology:mutation",
      status: "published",
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 1,
          blocks: [{ type: "examQuestion", examQuestionId: compositeId }],
        },
      ],
      examQuestions: [{ questionId: compositeId, addedAt: new Date() }],
    });

    const res = await request(app)
      .get(`/api/lessons/${lessonWithDup._id}/practice?limit=10`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.source).toBe("attached");
    expect(res.body.questions).toHaveLength(0);

    await Lesson.deleteOne({ _id: lessonWithDup._id });
  });

  it("preserves teacher-selected attachment order for 10 attached questions", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonId}/practice?limit=10`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.questions.map((q) => String(q.id))).toEqual(attachedIds);
  });
});
