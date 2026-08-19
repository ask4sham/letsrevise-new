/**
 * Integration: GET /api/catalogue/availability — auth, isolation, public/private separation.
 */
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const User = require("../models/User");
const Lesson = require("../models/Lesson");
const LessonUnlock = require("../models/LessonUnlock");
const { getJwtSecret } = require("../utils/jwtSecret");
const { PUBLIC_STATUS } = require("../services/catalogueAvailabilityService");

function authToken(user) {
  return jwt.sign(
    { user: { id: user._id.toString(), userType: user.userType } },
    getJwtSecret(),
    { expiresIn: "1h", algorithm: "HS256" }
  );
}

function findSubjectNode(tree, subjectLabel) {
  for (const level of tree?.levels || []) {
    for (const subject of level.children || []) {
      if (subject.label === subjectLabel) return subject;
    }
  }
  return null;
}

describe("GET /api/catalogue/availability", () => {
  let ownerToken;
  let otherToken;
  let subscriberToken;
  let chemLessonId;
  let templateLessonId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Cat",
      lastName: "Teacher",
      email: "catalogue-avail-teacher@test.com",
      password: "test-password-not-used",
      userType: "teacher",
    });

    const owner = await User.create({
      firstName: "Owner",
      lastName: "Student",
      email: "catalogue-avail-owner@test.com",
      password: "test-password-not-used",
      userType: "student",
      stageKey: "gcse",
      yearGroup: 11,
    });

    const other = await User.create({
      firstName: "Other",
      lastName: "Student",
      email: "catalogue-avail-other@test.com",
      password: "test-password-not-used",
      userType: "student",
      stageKey: "gcse",
      yearGroup: 11,
    });

    const subscriber = await User.create({
      firstName: "Sub",
      lastName: "Student",
      email: "catalogue-avail-subscriber@test.com",
      password: "test-password-not-used",
      userType: "student",
      stageKey: "gcse",
      yearGroup: 11,
      subscriptionV2: { status: "active", expiresAt: new Date(Date.now() + 86400000) },
    });

    const chemLesson = await Lesson.create({
      title: "Atomic structure (unapproved)",
      description: "Chemistry grant test lesson",
      content: "Content",
      teacherId: teacher._id,
      teacherName: "Cat Teacher",
      subject: "Chemistry",
      level: "GCSE",
      board: "AQA",
      topic: "Atomic structure",
      topicKey: "aqa-gcse-chemistry:atomic-structure",
      specKey: "aqa-gcse-chemistry",
      status: "published",
      isPublished: true,
      teacherLibrary: { status: "none" },
    });
    chemLessonId = chemLesson._id;

    const templateLesson = await Lesson.create({
      title: "Gold template",
      description: "Template must not appear in grant overlay",
      content: "Template content",
      teacherId: teacher._id,
      teacherName: "Cat Teacher",
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      topic: "Cell structure",
      topicKey: "aqa-gcse-biology:cell-structure",
      specKey: "aqa-gcse-biology",
      status: "published",
      isPublished: true,
      isTemplate: true,
      teacherLibrary: { status: "none" },
    });
    templateLessonId = templateLesson._id;

    await LessonUnlock.create({ userId: owner._id, lessonId: chemLessonId, source: "admin" });
    await LessonUnlock.create({ userId: owner._id, lessonId: templateLessonId, source: "admin" });
    await LessonUnlock.create({ userId: subscriber._id, lessonId: chemLessonId, source: "credit" });

    ownerToken = authToken(owner);
    otherToken = authToken(other);
    subscriberToken = authToken(subscriber);
  });

  test("unauthenticated returns 401", async () => {
    await request(app).get("/api/catalogue/availability").expect(401);
  });

  test("?userId rejected with 400", async () => {
    const res = await request(app)
      .get("/api/catalogue/availability")
      .query({ userId: "some-other-user" })
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400);
    expect(res.body.ok).toBe(false);
  });

  test("?user rejected with 400", async () => {
    const res = await request(app)
      .get("/api/catalogue/availability")
      .query({ user: "some-other-user" })
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400);
    expect(res.body.ok).toBe(false);
  });

  test("authenticated own-account request returns scoped availability", async () => {
    const res = await request(app)
      .get("/api/catalogue/availability")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.profileStage).toBe("gcse");
    expect(res.body.publicTree).toBeDefined();
    expect(Array.isArray(res.body.grantedToYou)).toBe(true);
    expect(res.body.generatedAt).toBeDefined();
  });

  describe("public/private separation", () => {
    test("private Chemistry grant visible to owner", async () => {
      const res = await request(app)
        .get("/api/catalogue/availability")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const grant = res.body.grantedToYou.find(
        (item) => String(item.lessonId) === String(chemLessonId)
      );
      expect(grant).toBeDefined();
      expect(grant.subject).toBe("Chemistry");
      expect(grant.visibilityReason).toBe("admin_grant");
      expect(grant.publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
    });

    test("Chemistry remains globally coming_soon", async () => {
      const res = await request(app)
        .get("/api/catalogue/availability")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const chemistry = findSubjectNode(res.body.publicTree, "Chemistry");
      expect(chemistry?.publicStatus).toBe(PUBLIC_STATUS.COMING_SOON);
    });

    test("other user cannot see owner grant", async () => {
      const res = await request(app)
        .get("/api/catalogue/availability")
        .set("Authorization", `Bearer ${otherToken}`)
        .expect(200);

      expect(
        res.body.grantedToYou.some((item) => String(item.lessonId) === String(chemLessonId))
      ).toBe(false);
    });
  });

  test("trial/subscription does not create grantedToYou entries", async () => {
    const res = await request(app)
      .get("/api/catalogue/availability")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    expect(res.body.grantedToYou).toEqual([]);
  });

  test("isTemplate admin unlock not exposed in grantedToYou", async () => {
    const res = await request(app)
      .get("/api/catalogue/availability")
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    expect(
      res.body.grantedToYou.some((item) => String(item.lessonId) === String(templateLessonId))
    ).toBe(false);
  });
});
