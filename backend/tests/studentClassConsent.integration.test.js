/**
 * Phase 2: student inbox, Accept/Decline, roster, memberships, STL provenance.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const StudentClass = require("../models/StudentClass");
const StudentClassInvitation = require("../models/StudentClassInvitation");
const StudentClassMembership = require("../models/StudentClassMembership");
const StudentTeacherLink = require("../models/StudentTeacherLink");
const PracticeAttempt = require("../models/PracticeAttempt");
const { hasAcceptedStudentTeacherLink } = require("../utils/hasAcceptedStudentTeacherLink");

jest.setTimeout(90000);

function assertNoRawMongoIds(obj) {
  const json = JSON.stringify(obj);
  expect(json).not.toMatch(/"_id"/);
  expect(json).not.toMatch(/"teacherId"/);
  expect(json).not.toMatch(/"classId"/);
  expect(json).not.toMatch(/"studentId"/);
}

describe("Student class consent Phase 2", () => {
  let teacher;
  let teacherB;
  let student;
  let otherStudent;
  let teacherToken;
  let teacherBToken;
  let studentToken;
  let otherToken;
  const userIds = [];

  beforeAll(async () => {
    const pw = await bcrypt.hash("Pass123!", 10);
    const stamp = Date.now();
    [teacher, teacherB, student, otherStudent] = await Promise.all([
      User.create({
        email: `c2-teacher-${stamp}@test.com`,
        password: pw,
        firstName: "Tina",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `c2-teacher-b-${stamp}@test.com`,
        password: pw,
        firstName: "Bob",
        lastName: "Teacher",
        userType: "teacher",
      }),
      User.create({
        email: `C2.Student.${stamp}@Test.COM`,
        password: pw,
        firstName: "Sam",
        lastName: "Student",
        userType: "student",
        verificationStatus: "pending",
      }),
      User.create({
        email: `c2-other-${stamp}@test.com`,
        password: pw,
        firstName: "Ollie",
        lastName: "Other",
        userType: "student",
      }),
    ]);
    userIds.push(teacher._id, teacherB._id, student._id, otherStudent._id);

    const logins = await Promise.all([
      request(app).post("/api/auth/login").send({ email: teacher.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: teacherB.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: student.email, password: "Pass123!" }),
      request(app).post("/api/auth/login").send({ email: otherStudent.email, password: "Pass123!" }),
    ]);
    teacherToken = logins[0].body.token;
    teacherBToken = logins[1].body.token;
    studentToken = logins[2].body.token;
    otherToken = logins[3].body.token;
  });

  afterAll(async () => {
    await PracticeAttempt.deleteMany({ studentId: { $in: userIds } });
    await StudentTeacherLink.deleteMany({ studentId: { $in: userIds } });
    await StudentClassMembership.deleteMany({ studentId: { $in: userIds } });
    await StudentClassInvitation.deleteMany({ teacherId: { $in: userIds } });
    await StudentClass.deleteMany({ teacherId: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  });

  async function createClassAndInvite(email = student.email, name = "Consent Class") {
    // Model fixtures avoid teacher bulk rate-limit noise across many cases.
    const classDoc = await StudentClass.create({
      teacherId: teacher._id,
      name,
      status: "active",
    });
    const invitation = await StudentClassInvitation.create({
      classId: classDoc._id,
      teacherId: teacher._id,
      targetEmail: email.toLowerCase(),
      status: "pending",
    });
    return {
      classPublicId: classDoc.publicId,
      classDoc: classDoc.toObject ? classDoc.toObject() : classDoc,
      invitation: invitation.toObject ? invitation.toObject() : invitation,
    };
  }

  async function submitPractice(token, teacherId) {
    return request(app)
      .post("/api/practice-attempts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        specKey: "aqa-gcse-biology",
        topicKey: "aqa-gcse-biology:cell-structure",
        contentType: "exam_question",
        contentId: new mongoose.Types.ObjectId().toString(),
        isCorrect: true,
        teacherId: String(teacherId),
      });
  }

  describe("inbox", () => {
    test("matching student sees pending; case-normalised; wrong users blocked", async () => {
      const { invitation } = await createClassAndInvite(student.email, "Inbox Class");

      const inbox = await request(app)
        .get("/api/student-class-invitations/incoming")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(inbox.status).toBe(200);
      expect(inbox.body.invitations.some((i) => i.publicId === invitation.publicId)).toBe(true);
      const row = inbox.body.invitations.find((i) => i.publicId === invitation.publicId);
      expect(row.teacher.displayName).toMatch(/Tina/);
      expect(row).not.toHaveProperty("targetEmail");
      assertNoRawMongoIds(inbox.body);
      expect(JSON.stringify(inbox.body)).not.toMatch(/@test\.com/i);

      const other = await request(app)
        .get("/api/student-class-invitations/incoming")
        .set("Authorization", `Bearer ${otherToken}`);
      expect(other.body.invitations.some((i) => i.publicId === invitation.publicId)).toBe(false);

      const teacherInbox = await request(app)
        .get("/api/student-class-invitations/incoming")
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(teacherInbox.status).toBe(403);
    });

    test("expired/cancelled/declined/accepted/archived omitted", async () => {
      const a = await createClassAndInvite(student.email, "Omit Expired");
      await StudentClassInvitation.updateOne(
        { _id: a.invitation._id },
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );

      const b = await createClassAndInvite(student.email, "Omit Cancelled");
      await StudentClassInvitation.updateOne(
        { _id: b.invitation._id },
        { $set: { status: "cancelled" } }
      );

      const c = await createClassAndInvite(student.email, "Omit Declined");
      await StudentClassInvitation.updateOne(
        { _id: c.invitation._id },
        { $set: { status: "declined" } }
      );

      const d = await createClassAndInvite(student.email, "Omit Accepted");
      await StudentClassInvitation.updateOne(
        { _id: d.invitation._id },
        { $set: { status: "accepted", studentId: student._id } }
      );

      const e = await createClassAndInvite(student.email, "Omit Archived");
      await StudentClass.updateOne(
        { _id: e.classDoc._id },
        { $set: { status: "archived", archivedAt: new Date() } }
      );

      const inbox = await request(app)
        .get("/api/student-class-invitations/incoming")
        .set("Authorization", `Bearer ${studentToken}`);
      const ids = new Set(inbox.body.invitations.map((i) => i.publicId));
      expect(ids.has(a.invitation.publicId)).toBe(false);
      expect(ids.has(b.invitation.publicId)).toBe(false);
      expect(ids.has(c.invitation.publicId)).toBe(false);
      expect(ids.has(d.invitation.publicId)).toBe(false);
      expect(ids.has(e.invitation.publicId)).toBe(false);
    });
  });

  describe("accept", () => {
    test("accept creates membership + class STL; practice authorised; idempotent", async () => {
      const { classPublicId, classDoc, invitation } = await createClassAndInvite(
        student.email,
        "Accept Fresh"
      );

      const res = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.invitation.status).toBe("accepted");
      expect(res.body.membership.status).toBe("active");
      assertNoRawMongoIds(res.body);

      const inv = await StudentClassInvitation.findById(invitation._id).lean();
      expect(inv.status).toBe("accepted");
      expect(String(inv.studentId)).toBe(String(student._id));

      const memberships = await StudentClassMembership.find({
        classId: classDoc._id,
        studentId: student._id,
      }).lean();
      expect(memberships).toHaveLength(1);
      expect(memberships[0].status).toBe("active");

      const links = await StudentTeacherLink.find({
        studentId: student._id,
        teacherId: teacher._id,
      }).lean();
      expect(links).toHaveLength(1);
      expect(links[0].status).toBe("accepted");
      expect(links[0].source).toBe("class");

      await expect(
        hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
      ).resolves.toBe(true);
      const practice = await submitPractice(studentToken, teacher._id);
      expect(practice.status).toBe(200);

      const again = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(again.status).toBe(200);
      expect(
        await StudentClassMembership.countDocuments({
          classId: classDoc._id,
          studentId: student._id,
        })
      ).toBe(1);
      expect(
        await StudentTeacherLink.countDocuments({
          studentId: student._id,
          teacherId: teacher._id,
        })
      ).toBe(1);

      // cleanup practice auth pollution for later tests using same pair
      await PracticeAttempt.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentClassMembership.deleteMany({ studentId: student._id, classId: classDoc._id });
      await StudentClass.deleteOne({ _id: classDoc._id });
      void classPublicId;
    });

    test("STL provenance rules", async () => {
      // Legacy missing status preserved
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentTeacherLink.create({ studentId: student._id, teacherId: teacher._id });
      const legacyInvite = await createClassAndInvite(student.email, "Legacy STL");
      await request(app)
        .post(`/api/student-class-invitations/${legacyInvite.invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      const legacy = await StudentTeacherLink.findOne({
        studentId: student._id,
        teacherId: teacher._id,
      }).lean();
      expect(legacy.status).toBeUndefined();
      expect(legacy.source).toBeUndefined();
      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentClassInvitation.deleteMany({ classId: legacyInvite.classDoc._id });
      await StudentClass.deleteOne({ _id: legacyInvite.classDoc._id });

      // Accepted direct source preserved
      await StudentTeacherLink.create({
        studentId: student._id,
        teacherId: teacher._id,
        status: "accepted",
        source: "direct",
      });
      const directInvite = await createClassAndInvite(student.email, "Direct STL");
      await request(app)
        .post(`/api/student-class-invitations/${directInvite.invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      const direct = await StudentTeacherLink.findOne({
        studentId: student._id,
        teacherId: teacher._id,
      }).lean();
      expect(direct.source).toBe("direct");
      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentClass.deleteOne({ _id: directInvite.classDoc._id });

      // Revoked class reactivated
      await StudentTeacherLink.create({
        studentId: student._id,
        teacherId: teacher._id,
        status: "revoked",
        source: "class",
      });
      const classRev = await createClassAndInvite(student.email, "Revoked Class STL");
      await request(app)
        .post(`/api/student-class-invitations/${classRev.invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      const reactivated = await StudentTeacherLink.findOne({
        studentId: student._id,
        teacherId: teacher._id,
      }).lean();
      expect(reactivated.status).toBe("accepted");
      expect(reactivated.source).toBe("class");
      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentClass.deleteOne({ _id: classRev.classDoc._id });

      // Revoked direct provenance preserved; membership still authorises
      await StudentTeacherLink.create({
        studentId: student._id,
        teacherId: teacher._id,
        status: "revoked",
        source: "direct",
      });
      const revDirect = await createClassAndInvite(student.email, "Revoked Direct");
      await request(app)
        .post(`/api/student-class-invitations/${revDirect.invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      const kept = await StudentTeacherLink.findOne({
        studentId: student._id,
        teacherId: teacher._id,
      }).lean();
      expect(kept.status).toBe("revoked");
      expect(kept.source).toBe("direct");
      await expect(
        hasAcceptedStudentTeacherLink({ studentId: student._id, teacherId: teacher._id })
      ).resolves.toBe(true);
      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentClass.deleteOne({ _id: revDirect.classDoc._id });
    });

    test("wrong student/teacher/forged/cancelled/declined/expired/archived blocked", async () => {
      const { invitation, classDoc } = await createClassAndInvite(student.email, "Blocked Accept");

      const wrong = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(wrong.status).toBe(404);

      const teacherTry = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(teacherTry.status).toBe(403);

      const forged = await request(app)
        .post("/api/student-class-invitations/not-a-real-public-id/accept")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(forged.status).toBe(404);

      await StudentClassInvitation.updateOne(
        { _id: invitation._id },
        { $set: { status: "cancelled" } }
      );
      expect(
        (
          await request(app)
            .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
            .set("Authorization", `Bearer ${studentToken}`)
        ).status
      ).toBe(409);

      const declinedSetup = await createClassAndInvite(student.email, "Declined Block");
      await StudentClassInvitation.updateOne(
        { _id: declinedSetup.invitation._id },
        { $set: { status: "declined" } }
      );
      expect(
        (
          await request(app)
            .post(`/api/student-class-invitations/${declinedSetup.invitation.publicId}/accept`)
            .set("Authorization", `Bearer ${studentToken}`)
        ).status
      ).toBe(409);

      const expiredSetup = await createClassAndInvite(student.email, "Expired Block");
      await StudentClassInvitation.updateOne(
        { _id: expiredSetup.invitation._id },
        { $set: { expiresAt: new Date(Date.now() - 5000) } }
      );
      expect(
        (
          await request(app)
            .post(`/api/student-class-invitations/${expiredSetup.invitation.publicId}/accept`)
            .set("Authorization", `Bearer ${studentToken}`)
        ).status
      ).toBe(410);

      const archivedSetup = await createClassAndInvite(student.email, "Archived Block");
      await StudentClass.updateOne(
        { _id: archivedSetup.classDoc._id },
        { $set: { status: "archived", archivedAt: new Date() } }
      );
      expect(
        (
          await request(app)
            .post(`/api/student-class-invitations/${archivedSetup.invitation.publicId}/accept`)
            .set("Authorization", `Bearer ${studentToken}`)
        ).status
      ).toBe(409);

      void classDoc;
    });

    test("reactivates removed membership", async () => {
      const { classDoc, invitation } = await createClassAndInvite(student.email, "Reactivate");
      const membership = await StudentClassMembership.create({
        classId: classDoc._id,
        teacherId: teacher._id,
        studentId: student._id,
        status: "removed",
        leftAt: new Date(),
      });
      const publicId = membership.publicId;

      const res = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      const updated = await StudentClassMembership.findById(membership._id).lean();
      expect(updated.status).toBe("active");
      expect(updated.publicId).toBe(publicId);
      expect(updated.leftAt).toBeNull();

      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
      await StudentClass.deleteOne({ _id: classDoc._id });
    });
  });

  describe("decline", () => {
    test("decline sets status; no membership/STL; idempotent; guards", async () => {
      const { invitation, classDoc } = await createClassAndInvite(student.email, "Decline Class");

      const res = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/decline`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.invitation.status).toBe("declined");
      assertNoRawMongoIds(res.body);

      expect(
        await StudentClassMembership.countDocuments({
          classId: classDoc._id,
          studentId: student._id,
        })
      ).toBe(0);
      expect(
        await StudentTeacherLink.countDocuments({
          studentId: student._id,
          teacherId: teacher._id,
        })
      ).toBe(0);

      const again = await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/decline`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(again.status).toBe(200);

      expect(
        (
          await request(app)
            .post(`/api/student-class-invitations/${invitation.publicId}/decline`)
            .set("Authorization", `Bearer ${otherToken}`)
        ).status
      ).toBe(404);

      const acceptedSetup = await createClassAndInvite(student.email, "Cannot Decline Accepted");
      await request(app)
        .post(`/api/student-class-invitations/${acceptedSetup.invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);
      expect(
        (
          await request(app)
            .post(`/api/student-class-invitations/${acceptedSetup.invitation.publicId}/decline`)
            .set("Authorization", `Bearer ${studentToken}`)
        ).status
      ).toBe(409);

      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    });
  });

  describe("teacher roster + invitation list identity", () => {
    test("pending has email no name; accepted has display name; roster isolation", async () => {
      const { classPublicId, invitation } = await createClassAndInvite(
        student.email,
        "Roster Class"
      );

      const pendingList = await request(app)
        .get(`/api/student-classes/${classPublicId}/invitations`)
        .set("Authorization", `Bearer ${teacherToken}`);
      const pendingRow = pendingList.body.invitations.find((i) => i.publicId === invitation.publicId);
      expect(pendingRow.targetEmail).toBe(student.email.toLowerCase());
      expect(pendingRow).not.toHaveProperty("student");

      await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);

      const acceptedList = await request(app)
        .get(`/api/student-classes/${classPublicId}/invitations`)
        .set("Authorization", `Bearer ${teacherToken}`);
      const acceptedRow = acceptedList.body.invitations.find(
        (i) => i.publicId === invitation.publicId
      );
      expect(acceptedRow.status).toBe("accepted");
      expect(acceptedRow.student.displayName).toMatch(/Sam/);
      expect(JSON.stringify(acceptedList.body)).not.toMatch(/verification/i);
      assertNoRawMongoIds(acceptedList.body);

      const roster = await request(app)
        .get(`/api/student-classes/${classPublicId}/students`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(roster.status).toBe(200);
      expect(roster.body.students).toHaveLength(1);
      expect(roster.body.students[0].student.displayName).toMatch(/Sam/);
      assertNoRawMongoIds(roster.body);

      const otherTeacher = await request(app)
        .get(`/api/student-classes/${classPublicId}/students`)
        .set("Authorization", `Bearer ${teacherBToken}`);
      expect(otherTeacher.status).toBe(404);

      // removed membership excluded
      await StudentClassMembership.updateOne(
        { publicId: roster.body.students[0].membershipPublicId },
        { $set: { status: "removed", leftAt: new Date() } }
      );
      const roster2 = await request(app)
        .get(`/api/student-classes/${classPublicId}/students`)
        .set("Authorization", `Bearer ${teacherToken}`);
      expect(roster2.body.students).toHaveLength(0);

      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    });
  });

  describe("student accepted classes", () => {
    test("lists own active memberships; isolation; archived omitted", async () => {
      const { classPublicId, classDoc, invitation } = await createClassAndInvite(
        student.email,
        "My Classes"
      );
      await request(app)
        .post(`/api/student-class-invitations/${invitation.publicId}/accept`)
        .set("Authorization", `Bearer ${studentToken}`);

      const mine = await request(app)
        .get("/api/student-class-memberships/mine")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(mine.status).toBe(200);
      expect(mine.body.classes.some((c) => c.class.publicId === classPublicId)).toBe(true);
      assertNoRawMongoIds(mine.body);

      const otherMine = await request(app)
        .get("/api/student-class-memberships/mine")
        .set("Authorization", `Bearer ${otherToken}`);
      expect(otherMine.body.classes.some((c) => c.class.publicId === classPublicId)).toBe(false);

      expect(
        (
          await request(app)
            .get("/api/student-class-memberships/mine")
            .set("Authorization", `Bearer ${teacherToken}`)
        ).status
      ).toBe(403);

      await StudentClass.updateOne(
        { _id: classDoc._id },
        { $set: { status: "archived", archivedAt: new Date() } }
      );
      const afterArchive = await request(app)
        .get("/api/student-class-memberships/mine")
        .set("Authorization", `Bearer ${studentToken}`);
      expect(afterArchive.body.classes.some((c) => c.class.publicId === classPublicId)).toBe(false);

      await StudentClassMembership.deleteMany({ studentId: student._id });
      await StudentTeacherLink.deleteMany({ studentId: student._id, teacherId: teacher._id });
    });
  });
});
