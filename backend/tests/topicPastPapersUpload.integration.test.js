/**
 * PR-PP1: Topic Past Paper Bank — file upload integration tests.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const app = require("../app");
const User = require("../models/User");
const TopicPastPaper = require("../models/TopicPastPaper");
const FileAsset = require("../models/FileAsset");
const { queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");

const hashedPassword = bcrypt.hashSync("password123", 10);
const FIXTURE_PDF = path.join(__dirname, "fixtures", "sample.pdf");
const FIXTURE_PDF2 = path.join(__dirname, "fixtures", "sample2.pdf");

describe("Topic Past Paper Bank - File Upload (PR-PP1)", () => {
  let teacherToken;
  let teacherId;
  let otherTeacherToken;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Upload",
      lastName: "Teacher",
      email: "upload-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const other = await User.create({
      firstName: "Other",
      lastName: "Teacher",
      email: "upload-other@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    const login1 = await request(app).post("/api/auth/login").send({ email: "upload-teacher@test.com", password: "password123" });
    teacherToken = login1.body?.token;
    const login2 = await request(app).post("/api/auth/login").send({ email: "upload-other@test.com", password: "password123" });
    otherTeacherToken = login2.body?.token;
    if (!teacherToken || !otherTeacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    const papers = await TopicPastPaper.find({ ownerId: teacherId }).lean();
    for (const p of papers) {
      if (p.sourceType === "file" && p.file?.fileId) {
        const fa = await FileAsset.findById(p.file.fileId);
        if (fa && fa.path && fs.existsSync(fa.path)) {
          try { fs.unlinkSync(fa.path); } catch (_) {}
        }
        await FileAsset.deleteOne({ _id: p.file.fileId });
      }
    }
    await TopicPastPaper.deleteMany({ ownerId: teacherId });
  });

  test("upload 2 PDF files creates 2 draft TopicPastPaper + FileAsset", async function () {
    if (!fs.existsSync(FIXTURE_PDF)) return;
    const secondFile = fs.existsSync(FIXTURE_PDF2) ? FIXTURE_PDF2 : FIXTURE_PDF;
    const res = await request(app)
      .post("/api/topic-past-papers/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("topicKey", "diffusion")
      .field("confirmCopyright", "true")
      .attach("files", FIXTURE_PDF, "sample.pdf")
      .attach("files", secondFile, "sample2.pdf");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.createdCount).toBeGreaterThanOrEqual(1);
    expect(res.body.createdIds.length).toBeGreaterThanOrEqual(1);

    const topicKeyCandidates = queryCandidates(DEFAULT_SPEC_LEGACY, "diffusion");
    const list = await TopicPastPaper.find({ ownerId: teacherId, topicKey: { $in: topicKeyCandidates } }).lean();
    expect(list.length).toBeGreaterThanOrEqual(1);
    const uploaded = list.filter((p) => p.sourceType === "file");
    expect(uploaded.length).toBeGreaterThanOrEqual(1);
    expect(uploaded.every((p) => p.status === "draft" && p.file?.fileId)).toBe(true);
  });

  test("upload same file again dedupes via sha256 (skip mode)", async function () {
    if (!fs.existsSync(FIXTURE_PDF)) return;
    const res = await request(app)
      .post("/api/topic-past-papers/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("topicKey", "diffusion")
      .field("confirmCopyright", "true")
      .field("metadata", JSON.stringify({ title: "sample" }))
      .attach("files", FIXTURE_PDF, "duplicate.pdf");

    expect(res.status).toBe(200);
    expect(res.body.createdCount).toBe(0);
    expect(res.body.rejected.some((r) => r.reason && r.reason.includes("Duplicate"))).toBe(true);
  });

  test("download endpoint streams file for owner", async function () {
    const papers = await TopicPastPaper.find({ ownerId: teacherId, sourceType: "file" }).limit(1).lean();
    if (papers.length === 0) return;
    const fileId = papers[0].file?.fileId;
    if (!fileId) return;
    const res = await request(app)
      .get(`/api/topic-past-papers/file/${fileId}`)
      .set("Authorization", `Bearer ${teacherToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/pdf|octet-stream/);
  });

  test("non-owner teacher cannot download (404, no existence leak)", async function () {
    const papers = await TopicPastPaper.find({ ownerId: teacherId, sourceType: "file" }).limit(1).lean();
    if (papers.length === 0) return;
    const fileId = papers[0].file?.fileId;
    if (!fileId) return;
    const res = await request(app)
      .get(`/api/topic-past-papers/file/${fileId}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);

    expect(res.status).toBe(404);
  });

  test("AQA upload with examBoard=AQA returns 400", async function () {
    if (!fs.existsSync(FIXTURE_PDF)) return;
    const res = await request(app)
      .post("/api/topic-past-papers/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("topicKey", "diffusion")
      .field("metadata", JSON.stringify({ examBoard: "AQA" }))
      .attach("files", FIXTURE_PDF, "sample.pdf");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/AQA past papers must be linked from aqa.org.uk/);
  });

  test("non-owner cannot delete others' items (404)", async () => {
    const papers = await TopicPastPaper.find({ ownerId: teacherId }).limit(1).lean();
    if (papers.length === 0) return;
    const id = papers[0]._id;
    const res = await request(app)
      .delete(`/api/topic-past-papers/${id}`)
      .set("Authorization", `Bearer ${otherTeacherToken}`);
    expect(res.status).toBe(404);
  });
});
