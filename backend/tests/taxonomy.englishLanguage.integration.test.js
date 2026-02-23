/**
 * GET /api/taxonomy/aqa-gcse-english-language — returns AQA GCSE English Language taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-gcse-english-language", () => {
  it("returns taxonomy payload", async () => {
    const res = await request(app)
      .get("/api/taxonomy/aqa-gcse-english-language")
      .expect(200);

    expect(res.body).toHaveProperty("specKey", "aqa-gcse-english-language");
    expect(res.body).toHaveProperty("subject", "English Language");
    expect(Array.isArray(res.body.units)).toBe(true);

    const unitNames = res.body.units.map((u) => u.unit);
    expect(unitNames).toContain("SS1. Paper 1");
    expect(unitNames).toContain("SS1. Paper 2");
    expect(unitNames).toContain("SS1. Exam Skills");
    expect(unitNames).toContain("SS1. Exams");
  });
});
