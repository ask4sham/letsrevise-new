/**
 * PR-HARD-2: Input limits, bulk constraints, file upload validation, rate limiting.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const app = require("../app");
const User = require("../models/User");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicPastPaper = require("../models/TopicPastPaper");
const FileAsset = require("../models/FileAsset");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("PR-HARD-2: Limits and rate limiting", () => {
  let teacherToken;
  let teacherId;
  const topicKey = "cell-structure";

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Limit",
      lastName: "Teacher",
      email: "limit-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "limit-teacher@test.com", password: "password123" });
    teacherToken = loginRes.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await TopicFlashcard.deleteMany({ ownerId: teacherId });
    const papers = await TopicPastPaper.find({ ownerId: teacherId, sourceType: "file" }).lean();
    for (const p of papers) {
      if (p.file?.fileId) {
        const fa = await FileAsset.findById(p.file.fileId);
        if (fa?.path && fs.existsSync(fa.path)) {
          try { fs.unlinkSync(fa.path); } catch (_) {}
        }
        await FileAsset.deleteOne({ _id: p.file.fileId });
      }
    }
    await TopicPastPaper.deleteMany({ ownerId: teacherId });
  });

  describe("bulk import too many items", () => {
    test("topic-flashcards bulk with 501 items returns 400", async () => {
      const items = Array.from({ length: 501 }, (_, i) => ({
        front: `Q${i}`,
        back: `A${i}`,
      }));
      const res = await request(app)
        .post("/api/topic-flashcards/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topicKey, items });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Too many|max 500/i);
    });

    test("topic-past-papers bulk with 501 items returns 400", async () => {
      const items = Array.from({ length: 501 }, (_, i) => ({
        title: `Paper ${i}`,
        url: `https://example.com/p${i}.pdf`,
      }));
      const res = await request(app)
        .post("/api/topic-past-papers/bulk")
        .set("Authorization", `Bearer ${teacherToken}`)
        .send({ topicKey: "diffusion", items });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Too many|max 500/i);
    });
  });

  describe("file upload invalid mime type", () => {
    test("upload with invalid mime type returns 400", async function () {
      const txtPath = path.join(__dirname, "fixtures", "sample.txt");
      const jsPath = path.join(__dirname, "..", "utils", "parseBulkFlashcards.js");
      const fallbackPath = fs.existsSync(txtPath) ? txtPath : (fs.existsSync(jsPath) ? jsPath : null);
      if (!fallbackPath) {
        this.skip();
        return;
      }
      const res = await request(app)
        .post("/api/topic-past-papers/upload")
        .set("Authorization", `Bearer ${teacherToken}`)
        .field("topicKey", "diffusion")
        .field("confirmCopyright", "true")
        .attach("files", fallbackPath, "file.txt");
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid file type|Allowed: pdf/i);
    });
  });

  describe("rate limiter returns 429 when exceeded", () => {
    test("bulk limiter returns 429 on second request when max=1", async () => {
      const express = require("express");
      const { createBulkLimiter } = require("../middleware/rateLimitBulk");
      const testApp = express();
      testApp.use(express.json());
      const limiter = createBulkLimiter({ max: 1, windowMs: 60000 });
      testApp.post("/bulk-test", limiter, (req, res) => res.json({ ok: true }));

      const r1 = await request(testApp).post("/bulk-test").send({});
      expect(r1.status).toBe(200);

      const r2 = await request(testApp).post("/bulk-test").send({});
      expect(r2.status).toBe(429);
    });
  });
});
