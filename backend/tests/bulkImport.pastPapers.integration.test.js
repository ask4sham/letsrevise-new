/**
 * PR-BULK-INGEST-4: Admin bulk import past papers — specKey validation, dryRun, dedupe/update.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const app = require("../app");
const User = require("../models/User");
const PastPaper = require("../models/PastPaper");

const hashedPassword = bcrypt.hashSync("password123", 10);

describe("POST /api/admin/bulk-import/past-papers", () => {
  let teacherToken;
  let teacherId;

  beforeAll(async () => {
    const teacher = await User.create({
      firstName: "PastPaper",
      lastName: "Teacher",
      email: "pastpaper-teacher@test.com",
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = teacher._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "pastpaper-teacher@test.com", password: "password123" });
    teacherToken = login.body?.token;
    if (!teacherToken) throw new Error("Login failed");
  }, 15000);

  afterAll(async () => {
    await PastPaper.deleteMany({ ownerId: teacherId });
  });

  it("unknown specKey -> 400", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/past-papers")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "not-a-real-spec",
        dryRun: true,
        items: [
          {
            examBoard: "AQA",
            level: "GCSE",
            year: "2024",
            paperCode: "Paper 1",
          },
        ],
      })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("valid dryRun -> would_insert", async () => {
    const res = await request(app)
      .post("/api/admin/bulk-import/past-papers")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        specKey: "aqa-gcse-biology",
        dryRun: true,
        items: [
          {
            examBoard: "AQA",
            level: "GCSE",
            year: "2024",
            series: "June",
            paperCode: "Paper 1",
            tier: "higher",
            title: "June 2024 Paper 1 (Higher)",
          },
        ],
      })
      .expect(200);

    expect(res.body).toHaveProperty("valid", 1);
    expect(res.body).toHaveProperty("dryRun", true);
    expect(res.body.preview[0]).toHaveProperty("action", "would_insert");
  });

  it("same payload twice -> second run would_update (dedupe)", async () => {
    const payload = {
      specKey: "aqa-gcse-biology",
      dryRun: false,
      items: [
        {
          examBoard: "AQA",
          level: "GCSE",
          year: "2023",
          paperCode: "P1",
          series: "November",
        },
      ],
    };

    const first = await request(app)
      .post("/api/admin/bulk-import/past-papers")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(payload)
      .expect(200);

    expect(first.body.inserted).toBe(1);

    const second = await request(app)
      .post("/api/admin/bulk-import/past-papers")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ ...payload, dryRun: true })
      .expect(200);

    expect(second.body.valid).toBe(1);
    expect(second.body.preview[0].action).toBe("would_update");
  });
});
