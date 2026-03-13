/**
 * GET /api/taxonomy/aqa-gcse-english-literature — returns AQA GCSE English Literature taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-gcse-english-literature", () => {
  it("returns taxonomy payload", async () => {
    const res = await request(app)
      .get("/api/taxonomy/aqa-gcse-english-literature")
      .expect(200);

    expect(res.body).toHaveProperty("specKey", "aqa-gcse-english-literature");
    expect(res.body).toHaveProperty("subject", "English Literature");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units.length).toBeGreaterThan(0);

    const unitNames = res.body.units.map((u) => u.unit);
    expect(unitNames).toContain("SS1. Shakespeare");
    expect(unitNames).toContain("SS1. The 19th Century Novel");
    expect(unitNames).toContain("SS1. Modern Texts");
    expect(unitNames).toContain("SS1. The Poetry Anthology");
    expect(unitNames).toContain("SS1. Unseen Poetry");
    expect(unitNames).toContain("SS1. Exam Skills");
  });
});
