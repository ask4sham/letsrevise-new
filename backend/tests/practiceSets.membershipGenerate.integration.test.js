/**
 * Phase 3C: POST /practice-sets/generate via membershipPublicId.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const PracticeSet = require("../models/PracticeSet");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");

jest.setTimeout(60000);

const SPEC = "aqa-gcse-biology";
const TOPIC = "aqa-gcse-biology:cell-structure";

function assertNoRawMembershipIds(body) {
  const json = JSON.stringify(body);
  expect(json).not.toMatch(/"_id"/);
  expect(json).not.toMatch(/"classId"/);
  expect(json).not.toMatch(/"studentId"/);
  expect(json).not.toMatch(/"membershipId"/);
}

describe("POST /api/practice-sets/generate membershipPublicId", () => {
  let teacher;
  let teacherB;
  let student;
  let otherStudent;
  let teacherToken;
  let studentToken;
  let otherToken;
  const userIds = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const stamp = Date.now();
    [teacher, teacherB, student, otherStudent] = await Promise.all([
      User.create({
        email: `p3c-t-${stamp}@test.com`,
        password: pw,
        firstName: "Tina",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `p3c-tb-${stamp}@test.com`,
        password: pw,
        firstName: "Bob",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `p3c-s-${stamp}@test.com`,
        password: pw,
        firstName: "Sam",
        lastName: "Student",
        userType: "student",
      }),
      User.create({
        email: `p3c-o-${stamp}@test.com`,
        password: pw,
        firstName: "Ollie",
        lastName: "Other",
        userType: "student",
      }),
    ]);
    userIds.push(teacher._id, teacherB._id, student._id, otherStudent._id);

    const { ensurePracticeSetIdempotencyIndex } = require("../services/practiceSetIdempotencyIndex");
    await ensurePracticeSetIdempotencyIndex(PracticeSet);

    const logins = await Promise.all([
      request(app).post("/api/auth/login").send({ email: teacher.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: student.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: otherStudent.email, password: "Pass123!" }),
    ]);
    teacherToken = logins[0].body.token;
    studentToken = logins[1].body.token;
    otherToken = logins[2].body.token;

    await TopicQuizQuestion.create({
      ownerId: teacher._id,
      topicKey: TOPIC,
      type: "mcq",
      questionText: "P3C cell?",
      choices: ["A", "B", "C"],
      correctIndex: 0,
      status: "published",
      kind: "quiz",
      fingerprint: `p3c-mcq-${stamp}`,
    });
  });

  afterAll(async () => {
    await PracticeSet.deleteMany({ studentId: { $in: userIds } });
    await TopicQuizQuestion.deleteMany({ ownerId: { $in: userIds } });
    await StudentTeacherLink.deleteMany({ studentId: { $in: userIds } });
    await StudentClassMembership.deleteMany({ studentId: { $in: userIds } });
    await StudentClassInvitation.deleteMany({ teacherId: { $in: userIds } });
    await StudentClass.deleteMany({ teacherId: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  });

  async function acceptMembership(name = "P3C Class") {
    const classDoc = await StudentClass.create({
      teacherId: teacher._id,
      name,
      status: "active",
      subject: "Biology",
      specKey: SPEC,
    });
    const invitation = await StudentClassInvitation.create({
      classId: classDoc._id,
      teacherId: teacher._id,
      targetEmail: student.email.toLowerCase(),
      status: "pending",
    });
    const accept = await request(app)
      .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(accept.status).toBe(200);
    const membership = await StudentClassMembership.findOne({
      classId: classDoc._id,
      studentId: student._id,
      status: "active",
    }).lean();
    expect(membership).toBeTruthy();
    return { classDoc, membership, membershipPublicId: membership.publicId };
  }

  test("membership path resolves teacher server-side; stores teacherId; no client teacherId", async () => {
    const { membershipPublicId } = await acceptMembership("Generate Happy");

    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        include: ["quiz_mcq"],
        membershipPublicId,
      });

    expect(res.status).toBe(200);
    expect(res.body.practiceSetId).toBeTruthy();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    assertNoRawMembershipIds(res.body);
    expect(res.body).not.toHaveProperty("teacherId");

    const set = await PracticeSet.findById(res.body.practiceSetId).lean();
    expect(String(set.teacherId)).toBe(String(teacher._id));
    expect(String(set.studentId)).toBe(String(student._id));
  });

  test("idempotent membership generate reuses unfinished set", async () => {
    const { membershipPublicId } = await acceptMembership("Idempotent Class");
    const key = `p3c-idem-${Date.now()}`;

    const first = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        include: ["quiz_mcq"],
        membershipPublicId,
        idempotencyKey: key,
      });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        limit: 5,
        include: ["quiz_mcq"],
        membershipPublicId,
        idempotencyKey: key,
      });
    expect(second.status).toBe(200);
    expect(second.body.practiceSetId).toBe(first.body.practiceSetId);
    expect(second.body.reusedFromIdempotencyKey).toBe(true);
  });

  test("ambiguous membershipPublicId + teacherId rejected", async () => {
    const { membershipPublicId } = await acceptMembership("Ambiguous");
    const res = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId,
        teacherId: String(teacher._id),
      });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("AMBIGUOUS_PRACTICE_CONTEXT");
  });

  test("forged and other-student membership denied", async () => {
    const { membershipPublicId } = await acceptMembership("Ownership");

    const forged = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId: "not-a-real-membership-id",
      });
    expect(forged.status).toBe(404);

    const stolen = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId,
      });
    expect(stolen.status).toBe(404);
  });

  test("removed membership and archived class denied", async () => {
    const { classDoc, membership, membershipPublicId } = await acceptMembership("Lifecycle");

    await StudentClassMembership.updateOne(
      { _id: membership._id },
      { $set: { status: "removed", leftAt: new Date() } }
    );
    const removed = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId,
      });
    expect(removed.status).toBe(404);
    expect(removed.body.code).toBe("MEMBERSHIP_REMOVED");

    // Restore membership then archive class
    await StudentClassMembership.updateOne(
      { _id: membership._id },
      { $set: { status: "active", leftAt: null } }
    );
    await StudentClass.updateOne(
      { _id: classDoc._id },
      { $set: { status: "archived", archivedAt: new Date() } }
    );
    const archived = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId,
      });
    expect(archived.status).toBe(400);
    expect(archived.body.code).toBe("CLASS_ARCHIVED");
  });

  test("pending invitation alone does not authorise; teacher cannot use membership path", async () => {
    const classDoc = await StudentClass.create({
      teacherId: teacher._id,
      name: "Pending Only",
      status: "active",
    });
    const invitation = await StudentClassInvitation.create({
      classId: classDoc._id,
      teacherId: teacher._id,
      targetEmail: student.email.toLowerCase(),
      status: "pending",
    });

    const pending = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId: invitation.publicId,
      });
    expect(pending.status).toBe(404);

    const { membershipPublicId } = await acceptMembership("Teacher Blocked");
    const asTeacher = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        membershipPublicId,
      });
    expect(asTeacher.status).toBe(403);
  });

  test("legacy teacherId path still relationship-checked", async () => {
    await StudentTeacherLink.create({
      studentId: student._id,
      teacherId: teacherB._id,
      status: "accepted",
      source: "direct",
    });

    const ok = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        teacherId: String(teacherB._id),
      });
    // Authorised even if the bank is empty (practiceSetId may be null).
    expect(ok.status).toBe(200);
    expect(ok.status).not.toBe(403);

    const unlinked = await request(app)
      .post("/api/practice-sets/generate")
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        specKey: SPEC,
        topicKeys: [TOPIC],
        include: ["quiz_mcq"],
        teacherId: String(teacher._id),
      });
    expect(unlinked.status).toBe(403);
  });
});
