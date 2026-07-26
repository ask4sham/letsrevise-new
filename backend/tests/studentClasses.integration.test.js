/**
 * Class + invitation APIs — anti-enumeration, ownership, opaque IDs.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");

jest.setTimeout(60000);

function assertNoRawMongoIds(obj) {
  const json = JSON.stringify(obj);
  expect(json).not.toMatch(/"[a-f0-9]{24}"/i);
  expect(json).not.toMatch(/"_id"/);
  expect(json).not.toMatch(/"teacherId"/);
  expect(json).not.toMatch(/"classId"/);
  expect(json).not.toMatch(/"studentId"/);
}

describe("Student classes + invitations", () => {
  let teacherA;
  let teacherB;
  let student;
  let teacherAToken;
  let teacherBToken;
  let studentToken;
  const createdUserIds = [];
  const createdClassIds = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const stamp = Date.now();
    [teacherA, teacherB, student] = await Promise.all([
      User.create({
        email: `cls-teacher-a-${stamp}@test.com`,
        password: pw,
        firstName: "A",
        lastName: "Teacher",
        userType: "teacher",
        verificationStatus: "verified",
      }),
      User.create({
        email: `cls-teacher-b-${stamp}@test.com`,
        password: pw,
        firstName: "B",
        lastName: "Teacher",
        userType: "teacher",
        verificationStatus: "verified",
      }),
      User.create({
        email: `cls-student-${stamp}@test.com`,
        password: pw,
        firstName: "S",
        lastName: "Student",
        userType: "student",
        verificationStatus: "verified",
      }),
    ]);
    createdUserIds.push(teacherA._id, teacherB._id, student._id);

    const [loginA, loginB, loginS] = await Promise.all([
      request(app).post("/api/auth/login").send({
        email: teacherA.email,
        password: "Pass123!",
      }),
      request(app).post("/api/auth/login").send({
        email: teacherB.email,
        password: "Pass123!",
      }),
      request(app).post("/api/auth/login").send({
        email: student.email,
        password: "Pass123!",
      }),
    ]);
    teacherAToken = loginA.body.token;
    teacherBToken = loginB.body.token;
    studentToken = loginS.body.token;
    if (!teacherAToken || !teacherBToken || !studentToken) {
      throw new Error("Login failed in studentClasses setup");
    }
  });

  afterAll(async () => {
    await StudentClassInvitation.deleteMany({ teacherId: { $in: createdUserIds } });
    await StudentClass.deleteMany({ teacherId: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
  });

  async function createClass(token, name = "Period 3 Biology") {
    const res = await request(app)
      .post("/api/student-classes")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, teacherId: new mongoose.Types.ObjectId().toString() });
    if (res.status === 201 && res.body.class?.publicId) {
      const doc = await StudentClass.findOne({ publicId: res.body.class.publicId }).lean();
      if (doc) createdClassIds.push(doc._id);
    }
    return res;
  }

  test("teacher creates class; student rejected; teacherId body ignored; no Mongo IDs", async () => {
    const studentRes = await request(app)
      .post("/api/student-classes")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ name: "Nope" });
    expect(studentRes.status).toBe(403);

    const res = await createClass(teacherAToken, "Year 11 Chemistry");
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.class.publicId).toBeTruthy();
    expect(res.body.class.name).toBe("Year 11 Chemistry");
    expect(res.body.class.status).toBe("active");
    assertNoRawMongoIds(res.body);

    const owned = await StudentClass.findOne({ publicId: res.body.class.publicId }).lean();
    expect(String(owned.teacherId)).toBe(String(teacherA._id));
  });

  test("teacher lists only own classes; another teacher cannot access", async () => {
    const created = await createClass(teacherAToken, "Only A");
    const publicId = created.body.class.publicId;

    const mineA = await request(app)
      .get("/api/student-classes/mine")
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(mineA.status).toBe(200);
    expect(mineA.body.classes.some((c) => c.publicId === publicId)).toBe(true);
    assertNoRawMongoIds(mineA.body);

    const mineB = await request(app)
      .get("/api/student-classes/mine")
      .set("Authorization", `Bearer ${teacherBToken}`);
    expect(mineB.body.classes.some((c) => c.publicId === publicId)).toBe(false);

    const getB = await request(app)
      .get(`/api/student-classes/${publicId}`)
      .set("Authorization", `Bearer ${teacherBToken}`);
    expect(getB.status).toBe(404);
  });

  test("preview: syntax counts; no DB write; known/unknown identical shape", async () => {
    const created = await createClass(teacherAToken, "Preview Class");
    const publicId = created.body.class.publicId;
    const before = await StudentClassInvitation.countDocuments({
      classId: (await StudentClass.findOne({ publicId }).lean())._id,
    });

    const known = student.email;
    const unknown = `unknown-${Date.now()}@nowhere.example`;
    const input = `${known}\n${unknown}\nbad\n${known}`;

    const res = await request(app)
      .post(`/api/student-classes/${publicId}/invitations/preview`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ input });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      totalSubmitted: 4,
      validCount: 2,
      duplicateCount: 1,
      invalidCount: 1,
    });
    expect(res.body.validEmails).toContain(known.toLowerCase());
    expect(res.body.validEmails).toContain(unknown.toLowerCase());
    expect(res.body).not.toHaveProperty("users");
    expect(JSON.stringify(res.body)).not.toMatch(/firstName|userType|verification/i);

    const after = await StudentClassInvitation.countDocuments({
      classId: (await StudentClass.findOne({ publicId }).lean())._id,
    });
    expect(after).toBe(before);
  });

  test("create invitations: anti-enumeration; idempotent pending; no silent reset", async () => {
    const created = await createClass(teacherAToken, "Invite Class");
    const publicId = created.body.class.publicId;
    const classDoc = await StudentClass.findOne({ publicId }).lean();

    const known = student.email;
    const unknown = `ghost-${Date.now()}@example.com`;
    const nonStudent = teacherB.email;
    const unverifiedEmail = `unverified-${Date.now()}@example.com`;
    await User.create({
      email: unverifiedEmail,
      password: await bcrypt.hash("Pass123!", 10),
      firstName: "U",
      lastName: "Student",
      userType: "student",
      verificationStatus: "pending",
    }).then((u) => createdUserIds.push(u._id));

    const payload = {
      emails: [known, unknown, nonStudent, unverifiedEmail, "not-email", known],
    };

    const res1 = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send(payload);
    expect(res1.status).toBe(200);
    expect(res1.body).toEqual({
      ok: true,
      message: "Invitations processed.",
      summary: {
        submitted: 6,
        invalid: 1,
        duplicates: 1,
      },
    });
    assertNoRawMongoIds(res1.body);
    expect(JSON.stringify(res1.body)).not.toMatch(/firstName|userType|verification|linkId/i);

    const pending = await StudentClassInvitation.find({ classId: classDoc._id }).lean();
    expect(pending).toHaveLength(4);
    expect(pending.every((p) => p.status === "pending")).toBe(true);
    expect(pending.every((p) => p.studentId == null)).toBe(true);

    const res2 = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ input: `${known}\n${unknown}` });
    expect(res2.status).toBe(200);
    expect(res2.body.message).toBe("Invitations processed.");
    expect(await StudentClassInvitation.countDocuments({ classId: classDoc._id })).toBe(4);

    await StudentClassInvitation.updateOne(
      { classId: classDoc._id, targetEmail: known.toLowerCase() },
      { $set: { status: "accepted", respondedAt: new Date() } }
    );
    await StudentClassInvitation.updateOne(
      { classId: classDoc._id, targetEmail: unknown.toLowerCase() },
      { $set: { status: "declined", respondedAt: new Date() } }
    );

    const res3 = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ emails: [known, unknown] });
    expect(res3.status).toBe(200);

    const after = await StudentClassInvitation.find({ classId: classDoc._id }).lean();
    expect(after.find((r) => r.targetEmail === known.toLowerCase()).status).toBe("accepted");
    expect(after.find((r) => r.targetEmail === unknown.toLowerCase()).status).toBe("declined");

    const other = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherBToken}`)
      .send({ emails: ["intruder@ex.com"] });
    expect(other.status).toBe(404);

    const zero = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ input: "not-valid;;;" });
    expect(zero.status).toBe(400);

    const over = Array.from({ length: 201 }, (_, i) => `u${i}@limit.example`).join("\n");
    const limitRes = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ input: over });
    expect(limitRes.status).toBe(400);
    expect(limitRes.body.code).toBe("EMAIL_LIMIT_EXCEEDED");
  });

  test("archived class blocks invitations", async () => {
    const created = await createClass(teacherAToken, "Archived Class");
    const publicId = created.body.class.publicId;
    await StudentClass.updateOne(
      { publicId },
      { $set: { status: "archived", archivedAt: new Date() } }
    );

    const res = await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ emails: ["a@ex.com"] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/archived/i);
  });

  test("list and cancel invitations", async () => {
    const created = await createClass(teacherAToken, "Cancel Class");
    const publicId = created.body.class.publicId;

    await request(app)
      .post(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`)
      .send({ emails: ["pending.cancel@ex.com", "keep.accepted@ex.com"] });

    const classDoc = await StudentClass.findOne({ publicId }).lean();
    await StudentClassInvitation.updateOne(
      { classId: classDoc._id, targetEmail: "keep.accepted@ex.com" },
      { $set: { status: "accepted", respondedAt: new Date() } }
    );

    const listB = await request(app)
      .get(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherBToken}`);
    expect(listB.status).toBe(404);

    const list = await request(app)
      .get(`/api/student-classes/${publicId}/invitations`)
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(list.status).toBe(200);
    expect(list.body.invitations).toHaveLength(2);
    for (const inv of list.body.invitations) {
      expect(inv.publicId).toBeTruthy();
      expect(inv.targetEmail).toMatch(/@ex\.com$/);
      expect(inv).not.toHaveProperty("studentId");
      expect(inv).not.toHaveProperty("firstName");
    }
    assertNoRawMongoIds(list.body);

    const pending = list.body.invitations.find((i) => i.targetEmail === "pending.cancel@ex.com");
    const accepted = list.body.invitations.find((i) => i.targetEmail === "keep.accepted@ex.com");

    const cancel1 = await request(app)
      .post(`/api/student-classes/${publicId}/invitations/${pending.publicId}/cancel`)
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(cancel1.status).toBe(200);
    expect(cancel1.body.invitation.status).toBe("cancelled");

    const cancel2 = await request(app)
      .post(`/api/student-classes/${publicId}/invitations/${pending.publicId}/cancel`)
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(cancel2.status).toBe(200);
    expect(cancel2.body.invitation.status).toBe("cancelled");

    const cancelAccepted = await request(app)
      .post(`/api/student-classes/${publicId}/invitations/${accepted.publicId}/cancel`)
      .set("Authorization", `Bearer ${teacherAToken}`);
    expect(cancelAccepted.status).toBe(400);
  });
});
