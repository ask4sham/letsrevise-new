/**
 * PR-BULK-INGEST-3: Admin media upload — local storage, SHA-256 dedupe.
 */
const path = require("path");
const fs = require("fs");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const Media = require("../models/Media");

const hashedPassword = bcrypt.hashSync("password123", 10);

// Minimal 1x1 PNG (68 bytes)
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_BASE64, "base64");

describe("POST /api/admin/media/upload", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "Media",
      lastName: "Teacher",
      email: "media-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "media-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await Media.deleteMany({ ownerId: teacherId });
  });

  it("rejects unauthenticated", async () => {
    await request(app).post("/api/admin/media/upload").expect(401);
  });

  it("rejects upload without confirmCopyright", async () => {
    const res = await request(app)
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .attach("file", TINY_PNG_BUFFER, "tiny.png")
      .expect(400);
    expect(res.body.error).toMatch(/confirm|permission/);
  });

  it("uploads a file and returns media metadata", async () => {
    const res = await request(app)
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("confirmCopyright", "true")
      .attach("file", TINY_PNG_BUFFER, "tiny.png")
      .expect(201);

    expect(res.body).toHaveProperty("mediaId");
    expect(res.body).toHaveProperty("url");
    expect(res.body.url).toMatch(/^\/uploads\//);
    expect(res.body).toHaveProperty("sha256");
    expect(res.body).toHaveProperty("mimeType", "image/png");
    expect(res.body).toHaveProperty("size");
    expect(res.body.size).toBeGreaterThanOrEqual(TINY_PNG_BUFFER.length);
    expect(res.body).toHaveProperty("originalName", "tiny.png");
  });

  it("uploading same file twice returns same mediaId (dedupe)", async () => {
    const first = await request(app)
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("confirmCopyright", "true")
      .attach("file", TINY_PNG_BUFFER, "tiny2.png");
    expect([200, 201]).toContain(first.status);
    expect(first.body).toHaveProperty("mediaId");
    expect(first.body).toHaveProperty("sha256");

    const second = await request(app)
      .post("/api/admin/media/upload")
      .set("Authorization", `Bearer ${teacherToken}`)
      .field("confirmCopyright", "true")
      .attach("file", TINY_PNG_BUFFER, "tiny2.png")
      .expect(200);

    expect(second.body.mediaId).toEqual(first.body.mediaId);
    expect(second.body.sha256).toBe(first.body.sha256);
    expect(second.body.url).toBe(first.body.url);
  });
});
