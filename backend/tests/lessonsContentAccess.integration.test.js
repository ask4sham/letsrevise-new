/**
 * Phase 9 — Integration tests for GET /api/lessons/:id content access.
 * Asserts: not entitled → 403; free preview → 200 partial; subscribed/purchased → 200 full.
 */
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const bcrypt = require("bcryptjs");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("GET /api/lessons/:id content access (Phase 9)", () => {
  jest.setTimeout(15000);

  let teacherId;
  let lessonAId;
  let lessonBId;
  let tokenU1;
  let tokenU2;
  let tokenU3;
  let tokenUTrialing;
  let tokenUPastDue;
  let tokenUExpired;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "T",
      lastName: "Teacher",
      email: "phase9-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const lessonA = await Lesson.create({
      title: "Lesson A (locked)",
      description: "Description A",
      content: "Full content A",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      pages: [
        { pageId: "p1", title: "Page 1", order: 0, blocks: [] },
        { pageId: "p2", title: "Page 2", order: 1, blocks: [] },
      ],
      quiz: { questions: [{ id: "q1", type: "mcq", question: "Q?", correctAnswer: "A" }] },
      flashcards: [{ id: "f1", front: "F", back: "B" }],
    });
    lessonAId = lessonA._id;

    const lessonB = await Lesson.create({
      title: "Lesson B (free preview)",
      description: "Description B",
      content: "Full content B",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      pages: [
        { pageId: "p1", title: "Preview Page", order: 0, blocks: [] },
        { pageId: "p2", title: "Locked Page", order: 1, blocks: [] },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonBId = lessonB._id;

    const u1 = await User.create({
      firstName: "U1",
      lastName: "Student",
      email: "phase9-u1@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });

    const u2 = await User.create({
      firstName: "U2",
      lastName: "Student",
      email: "phase9-u2@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [{ lessonId: lessonAId, progress: 0 }],
    });

    const future = new Date(Date.now() + 86400000);
    const u3 = await User.create({
      firstName: "U3",
      lastName: "Student",
      email: "phase9-u3@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: future },
      purchasedLessons: [],
    });

    // Phase 9B: subscription status edge cases (trialing, past_due, active+expired)
    const uTrialing = await User.create({
      firstName: "UTrialing",
      lastName: "Student",
      email: "phase9b-trialing@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "trialing", expiresAt: future },
      purchasedLessons: [],
    });
    const uPastDue = await User.create({
      firstName: "UPastDue",
      lastName: "Student",
      email: "phase9b-past_due@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "past_due", expiresAt: future },
      purchasedLessons: [],
    });
    const past = new Date(Date.now() - 86400000);
    const uExpired = await User.create({
      firstName: "UExpired",
      lastName: "Student",
      email: "phase9b-expired@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: past },
      purchasedLessons: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenU1 = await login("phase9-u1@test.com");
    tokenU2 = await login("phase9-u2@test.com");
    tokenU3 = await login("phase9-u3@test.com");
    tokenUTrialing = await login("phase9b-trialing@test.com");
    tokenUPastDue = await login("phase9b-past_due@test.com");
    tokenUExpired = await login("phase9b-expired@test.com");
  });

  test("not entitled user gets 402 with NOT_ENTITLED on locked lesson", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenU1}`);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("Subscription required");
    expect(res.body.reason).toBe("NOT_ENTITLED");
    expect(res.body.lessonId).toBeDefined();
    expect(res.body.published).toBe(true);
  });

  test("purchased user gets 200 and full content (pages, quiz, flashcards)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenU2}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(2);
    expect(res.body.quiz).toBeDefined();
    expect(Array.isArray(res.body.flashcards)).toBe(true);
    expect(res.body.isFreePreview).not.toBe(true);
  });

  test("subscribed user gets 200 and full content", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenU3}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(2);
    expect(res.body.quiz).toBeDefined();
  });

  test("free preview user gets 200 with partial content only (first page, no quiz/flashcards)", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonBId}`)
      .set("Authorization", `Bearer ${tokenU1}`);
    expect(res.status).toBe(200);
    expect(res.body.isFreePreview).toBe(true);
    expect(res.body.pages).toHaveLength(1);
    expect(res.body.flashcards).toEqual([]);
    expect(res.body.quiz).toBeUndefined();
  });

  test("owner of published lesson gets 200 and full content including flashcards (not FREE_PREVIEW)", async () => {
    const tokenTeacher = await request(app)
      .post("/api/auth/login")
      .send({ email: "phase9-teacher@test.com", password: "password123" })
      .then((r) => r.body.token);
    expect(tokenTeacher).toBeDefined();
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("OWNER");
    expect(Array.isArray(res.body.flashcards)).toBe(true);
    expect(res.body.flashcards).toHaveLength(1);
    expect(res.body.flashcards[0]).toMatchObject({ id: "f1", front: "F", back: "B" });
    expect(res.body.pages).toHaveLength(2);
  });

  test("Phase 9B: trialing status gets 200 full content", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenUTrialing}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(2);
    expect(res.body.quiz).toBeDefined();
  });

  test("Phase 9B: past_due status gets 402 NOT_ENTITLED", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenUPastDue}`);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("Subscription required");
    expect(res.body.reason).toBe("NOT_ENTITLED");
  });

  test("Phase 9B: active but expiresAt in past gets 402 NOT_ENTITLED", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonAId}`)
      .set("Authorization", `Bearer ${tokenUExpired}`);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe("Subscription required");
    expect(res.body.reason).toBe("NOT_ENTITLED");
  });
});

const PROGRESSIVE_PROHIBITED_KEYS = [
  "caption",
  "testQuestion",
  "testExplanation",
  "note",
  "teacherBrief",
  "modelAnswer",
  "expectedResponse",
  "teacherGuidance",
];

const TEACHER_KEY_RE = /teacher-key\s*:/i;
const TEACHER_KEY_KEY_RE = /teacher-key/i;

function findProgressiveBlock(pages) {
  return (pages || [])
    .flatMap((page) => page.blocks || [])
    .find((block) => block.type === "interactiveSequence" && block.presentationMode === "progressiveReveal");
}

function findCarouselBlock(pages) {
  return (pages || [])
    .flatMap((page) => page.blocks || [])
    .find((block) => block.type === "interactiveSequence" && !block.presentationMode);
}

function collectProgressiveProhibitedHits(value, path = "", hits = []) {
  if (value == null) return hits;
  if (typeof value === "string") {
    if (TEACHER_KEY_RE.test(value)) hits.push(`${path}:value`);
    return hits;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectProgressiveProhibitedHits(item, `${path}[${index}]`, hits)
    );
    return hits;
  }
  if (typeof value !== "object") return hits;

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (TEACHER_KEY_KEY_RE.test(key)) hits.push(childPath);
    if (PROGRESSIVE_PROHIBITED_KEYS.includes(key)) hits.push(childPath);
    if (key === "metadata" && child && typeof child === "object" && child.teacherBrief !== undefined) {
      hits.push(`${childPath}.teacherBrief`);
    }
    collectProgressiveProhibitedHits(child, childPath, hits);
  }
  return hits;
}

describe("GET /api/lessons/:id progressiveReveal learner payload shaping", () => {
  jest.setTimeout(20000);

  let teacherId;
  let lessonFullId;
  let lessonPreviewId;
  let lessonTeacherKeyId;
  let tokenStudent;
  let tokenParent;
  let tokenTeacher;
  let tokenPreviewStudent;

  const progressiveBlock = {
    type: "interactiveSequence",
    id: "block-prog-route",
    role: "sequence",
    title: "Process",
    intro: "Follow each step.",
    presentationMode: "progressiveReveal",
    enableTestMe: false,
    sourceIds: ["spec:topic:point-1"],
    sequenceSteps: [
      {
        id: "step-1",
        title: "Step 1",
        description: "First teaching step.",
        imageUrl: "",
        sourceIds: ["spec:topic:point-1"],
      },
    ],
  };

  const carouselBlock = {
    type: "interactiveSequence",
    title: "Carousel",
    intro: "Intro",
    sequenceSteps: [
      {
        id: "c1",
        title: "One",
        description: "Desc",
        imageUrl: "",
        caption: "Key idea",
      },
    ],
  };

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Progressive",
      lastName: "Teacher",
      email: "progressive-route-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;

    const fullLesson = await Lesson.create({
      title: "Progressive full lesson",
      description: "Full lesson with progressive block",
      content: "Content",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 0,
          blocks: [progressiveBlock, carouselBlock],
        },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonFullId = fullLesson._id;

    const previewLesson = await Lesson.create({
      title: "Progressive preview lesson",
      description: "Preview lesson with progressive block",
      content: "Content",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: true,
      pages: [
        {
          pageId: "p1",
          title: "Preview Page",
          order: 0,
          blocks: [progressiveBlock],
        },
        {
          pageId: "p2",
          title: "Locked Page",
          order: 1,
          blocks: [],
        },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonPreviewId = previewLesson._id;

    const teacherKeyLesson = await Lesson.create({
      title: "Teacher-key lesson",
      description: "Mixed-case teacher-key markers",
      content: "Content",
      teacherId,
      teacherName: "Teacher",
      subject: "Biology",
      level: "GCSE",
      topic: "Cells",
      status: "published",
      isPublished: true,
      isFreePreview: false,
      pages: [
        {
          pageId: "p1",
          title: "Page 1",
          order: 0,
          blocks: [progressiveBlock],
        },
      ],
      quiz: { questions: [] },
      flashcards: [],
    });
    lessonTeacherKeyId = teacherKeyLesson._id;
    await Lesson.collection.updateOne(
      { _id: lessonTeacherKeyId },
      {
        $set: {
          "pages.0.blocks.0.note": "Teacher-Key: route leak",
          "pages.0.blocks.0.metadata": { "nested-Teacher-KEY-marker": "TEACHER-KEY : hidden" },
        },
      }
    );

    const future = new Date(Date.now() + 86400000);
    await User.create({
      firstName: "Progressive",
      lastName: "Student",
      email: "progressive-route-student@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: { status: "active", expiresAt: future },
      purchasedLessons: [],
    });
    await User.create({
      firstName: "Preview",
      lastName: "Student",
      email: "progressive-route-preview-student@test.com",
      password: hashedPassword,
      userType: "student",
      subscriptionV2: null,
      purchasedLessons: [],
    });
    await User.create({
      firstName: "Progressive",
      lastName: "Parent",
      email: "progressive-route-parent@test.com",
      password: hashedPassword,
      userType: "parent",
      subscriptionV2: { status: "active", expiresAt: future },
      purchasedLessons: [],
    });

    const login = (email) =>
      request(app)
        .post("/api/auth/login")
        .send({ email, password: "password123" })
        .then((res) => res.body.token);

    tokenStudent = await login("progressive-route-student@test.com");
    tokenPreviewStudent = await login("progressive-route-preview-student@test.com");
    tokenParent = await login("progressive-route-parent@test.com");
    tokenTeacher = await login("progressive-route-teacher@test.com");
  });

  test("authenticated student full payload shapes progressive block and omits prohibited keys", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonFullId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(1);

    const progressive = findProgressiveBlock(res.body.pages);
    expect(progressive).toBeDefined();
    expect(progressive.id).toBe("block-prog-route");
    expect(progressive.presentationMode).toBe("progressiveReveal");
    expect(progressive.sequenceSteps[0].id).toBe("step-1");
    expect(progressive.sequenceSteps[0].title).toBe("Step 1");
    expect(collectProgressiveProhibitedHits(progressive)).toEqual([]);
  });

  test("parent full payload shapes progressive block and omits prohibited keys", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonFullId}`)
      .set("Authorization", `Bearer ${tokenParent}`);
    expect(res.status).toBe(200);
    expect(res.body.pages).toHaveLength(1);

    const progressive = findProgressiveBlock(res.body.pages);
    expect(progressive).toBeDefined();
    expect(collectProgressiveProhibitedHits(progressive)).toEqual([]);
  });

  test("non-privileged FREE_PREVIEW shapes progressive block on preview page only", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonPreviewId}`)
      .set("Authorization", `Bearer ${tokenPreviewStudent}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("FREE_PREVIEW");
    expect(res.body.pages).toHaveLength(1);
    expect(res.body.flashcards).toEqual([]);
    expect(res.body.quiz).toBeUndefined();

    const progressive = findProgressiveBlock(res.body.pages);
    expect(progressive).toBeDefined();
    expect(collectProgressiveProhibitedHits(progressive)).toEqual([]);
  });

  test("privileged teacher owner receives unshaped progressive block", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonFullId}`)
      .set("Authorization", `Bearer ${tokenTeacher}`);
    expect(res.status).toBe(200);
    expect(res.body.accessDecision?.reason).toBe("OWNER");

    const progressive = findProgressiveBlock(res.body.pages);
    expect(progressive).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(progressive, "caption")).toBe(true);
    expect(progressive.sequenceSteps[0]).toHaveProperty("caption");
  });

  test("legacy carousel caption remains available on non-privileged full payload", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonFullId}`)
      .set("Authorization", `Bearer ${tokenStudent}`);
    expect(res.status).toBe(200);

    const carousel = findCarouselBlock(res.body.pages);
    expect(carousel).toBeDefined();
    expect(carousel.sequenceSteps[0].caption).toBe("Key idea");
  });

  test("mixed-case teacher-key markers are absent from non-privileged progressive payload", async () => {
    const res = await request(app)
      .get(`/api/lessons/${lessonTeacherKeyId}`)
      .set("Authorization", `Bearer ${tokenParent}`);
    expect(res.status).toBe(200);

    const progressive = findProgressiveBlock(res.body.pages);
    expect(progressive).toBeDefined();
    expect(collectProgressiveProhibitedHits(progressive)).toEqual([]);
    expect(JSON.stringify(progressive).match(TEACHER_KEY_RE)).toBeNull();
    expect(JSON.stringify(progressive).match(TEACHER_KEY_KEY_RE)).toBeNull();
  });
});

describe("GET /api/lessons list — no premium fields (Phase 9 tripwire)", () => {
  let tokenU3;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "phase9-u3@test.com", password: "password123" });
    if (!res.body.token) throw new Error("phase9-u3@test.com login failed (run first describe before this)");
    tokenU3 = res.body.token;
  });

  test("list as subscribed user must not contain pages, content, quiz, flashcards on any item", async () => {
    const res = await request(app)
      .get("/api/lessons")
      .set("Authorization", `Bearer ${tokenU3}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const forbiddenKeys = ["pages", "content", "quiz", "flashcards"];
    for (const item of res.body) {
      for (const key of forbiddenKeys) {
        expect(item[key]).toBeUndefined();
      }
      // May contain pageCount for entitled users
      if (item.hasAccess) {
        expect(typeof item.pageCount).toBe("number");
      }
    }
  });
});
