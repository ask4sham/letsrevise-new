/**
 * Phase 1: CSV import for Flashcards and Exam Questions.
 * Tests: valid import, duplicate detection, dryRun, invalid topicKey, defaultSpecKey/defaultTopicKey, imageUrl.
 */
const request = require("supertest");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const app = require("../app");
const User = require("../models/User");
const TopicFlashcard = require("../models/TopicFlashcard");
const ExamQuestion = require("../models/ExamQuestion");

const hashedPassword = bcrypt.hashSync("Password123!", 10);

const csvDir = path.join(__dirname, "..", "uploads", "csv-import");
if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

function writeTempCsv(content) {
  const filePath = path.join(csvDir, `test-${Date.now()}.csv`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

describe("CSV Import Service", () => {
  let token;
  let teacherId;

  beforeAll(async () => {
    const user = await User.create({
      firstName: "CSV",
      lastName: "Import",
      email: `csv_import_${Date.now()}@example.com`,
      password: hashedPassword,
      userType: "teacher",
    });
    teacherId = user._id;
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "Password123!" })
      .expect(200);
    token = login.body.token;
  }, 15000);

  describe("POST /api/import/flashcards/csv", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).post("/api/import/flashcards/csv");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("msg");
    });

    it("returns 403 for non-teacher/admin", async () => {
      const user = await User.create({
        firstName: "Student",
        lastName: "User",
        email: `student_${Date.now()}@example.com`,
        password: hashedPassword,
        userType: "student",
      });
      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: user.email, password: "Password123!" })
        .expect(200);
      const csv = "front,back,specKey,topicKey\nQ,A,aqa-gcse-biology,cell-structure";
      const filePath = writeTempCsv(csv);
      try {
        await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${login.body.token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(403);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("returns 400 when no file", async () => {
      await request(app)
        .post("/api/import/flashcards/csv")
        .set("Authorization", `Bearer ${token}`)
        .field("dryRun", "true")
        .expect(400);
    });

    it("dryRun does not write to DB", async () => {
      const csv = "front,back,specKey,topicKey\nWhat is mitosis?,Cell division,aqa-gcse-biology,cell-division";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.dryRun).toBe(true);
        expect(res.body.summary.parsedRows).toBe(1);
        expect(res.body.summary.validRows).toBe(1);
        expect(res.body.summary.importedRows).toBeGreaterThanOrEqual(0);

        const count = await TopicFlashcard.countDocuments({ ownerId: teacherId });
        expect(count).toBe(0);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("invalid topicKey is rejected", async () => {
      const csv = "front,back,specKey,topicKey\nQ,A,aqa-gcse-biology,not-a-real-topic";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.invalidRows).toBe(1);
        expect(res.body.errors[0].reason).toMatch(/topicKey|Invalid/);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("defaultSpecKey and defaultTopicKey work when CSV omits them", async () => {
      const csv = "front,back\nQ1,A1\nQ2,A2";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .field("defaultSpecKey", "aqa-gcse-biology")
          .field("defaultTopicKey", "cell-structure")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.validRows).toBe(2);
        expect(res.body.summary.invalidRows).toBe(0);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("imageUrl is stored in assets", async () => {
      const csv = "front,back,specKey,topicKey,imageUrl\nQ,A,aqa-gcse-biology,cell-structure,https://example.com/img.png";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "false")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.importedRows).toBe(1);
        const card = await TopicFlashcard.findOne({ ownerId: teacherId, front: "Q" });
        expect(card).toBeTruthy();
        expect(card.assets).toHaveLength(1);
        expect(card.assets[0].url).toBe("https://example.com/img.png");
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
        await TopicFlashcard.deleteMany({ ownerId: teacherId, front: "Q" });
      }
    });

    it("duplicate in file is skipped", async () => {
      const csv = "front,back,specKey,topicKey\nSame,Same,aqa-gcse-biology,cell-structure\nSame,Same,aqa-gcse-biology,cell-structure";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.duplicateRows).toBeGreaterThanOrEqual(1);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("partial failures do not abort whole file", async () => {
      const csv = "front,back,specKey,topicKey\nValid,A,aqa-gcse-biology,cell-structure\nBad,,,\nValid2,A2,aqa-gcse-biology,cell-structure";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/flashcards/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.parsedRows).toBe(3);
        expect(res.body.summary.invalidRows).toBe(1);
        expect(res.body.summary.validRows).toBe(2);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });
  });

  describe("POST /api/import/exam-questions/csv", () => {
    it("returns 401 without auth", async () => {
      const res = await request(app).post("/api/import/exam-questions/csv");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("msg");
    });

    it("dryRun does not write to DB", async () => {
      const csv = "questionText,markScheme,specKey,topicKey\nExplain mitosis,1. Condense 2. Divide,aqa-gcse-biology,cell-division";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/exam-questions/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.dryRun).toBe(true);
        expect(res.body.summary.validRows).toBe(1);
        const count = await ExamQuestion.countDocuments({ teacherId });
        expect(count).toBe(0);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("invalid topicKey is rejected", async () => {
      const csv = "questionText,markScheme,specKey,topicKey\nQ,MS,aqa-gcse-biology,bad-topic";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/exam-questions/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.invalidRows).toBe(1);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("defaultSpecKey and defaultTopicKey work", async () => {
      const csv = "questionText,markScheme\nQ1,MS1\nQ2,MS2";
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/exam-questions/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "true")
          .field("defaultSpecKey", "aqa-gcse-biology")
          .field("defaultTopicKey", "cell-structure")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.validRows).toBe(2);
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
      }
    });

    it("imageUrl is stored in assets", async () => {
      const q = "Explain nucleus " + Date.now();
      const csv = `questionText,markScheme,specKey,topicKey,imageUrl\n${q},Control,aqa-gcse-biology,cell-structure,https://example.com/diagram.png`;
      const filePath = writeTempCsv(csv);
      try {
        const res = await request(app)
          .post("/api/import/exam-questions/csv")
          .set("Authorization", `Bearer ${token}`)
          .field("dryRun", "false")
          .attach("file", filePath, "test.csv")
          .expect(200);

        expect(res.body.summary.importedRows).toBe(1);
        const eq = await ExamQuestion.findOne({ teacherId, question: q });
        expect(eq).toBeTruthy();
        expect(eq.assets).toHaveLength(1);
        expect(eq.assets[0].url).toBe("https://example.com/diagram.png");
      } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
        await ExamQuestion.deleteMany({ teacherId, question: q });
      }
    });
  });

  describe("GET /api/import/templates", () => {
    it("flashcards template returns CSV", async () => {
      const res = await request(app)
        .get("/api/import/templates/flashcards-csv")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text).toMatch(/front,back,specKey,topicKey/);
    });

    it("exam-questions template returns CSV", async () => {
      const res = await request(app)
        .get("/api/import/templates/exam-questions-csv")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.text).toMatch(/questionText,markScheme/);
    });
  });
});
