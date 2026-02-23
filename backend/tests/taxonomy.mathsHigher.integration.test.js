/**
 * GET /api/taxonomy/aqa-gcse-maths-higher — returns AQA GCSE Maths (Higher) taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-gcse-maths-higher", () => {
  test("returns 200 and normalized taxonomy payload", async () => {
    const res = await request(app)
      .get("/api/taxonomy/aqa-gcse-maths-higher")
      .expect(200);

    expect(res.body).toHaveProperty("subject", "Mathematics");
    expect(res.body).toHaveProperty("examBoard", "AQA");
    expect(res.body).toHaveProperty("level", "GCSE");
    expect(res.body).toHaveProperty("specKey", "aqa-gcse-maths-higher");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units.length).toBeGreaterThan(0);

    const unit = res.body.units[0];
    expect(unit).toHaveProperty("unit");
    expect(unit).toHaveProperty("key");
    expect(Array.isArray(unit.topics)).toBe(true);

    const topic = unit.topics[0];
    expect(topic).toHaveProperty("topic");
    expect(topic).toHaveProperty("key");
  });

  test("contains SS1 and SS2 units", async () => {
    const res = await request(app)
      .get("/api/taxonomy/aqa-gcse-maths-higher")
      .expect(200);

    const unitNames = res.body.units.map((u) => u.unit);
    expect(unitNames.some((n) => n.startsWith("SS1:"))).toBe(true);
    expect(unitNames.some((n) => n.startsWith("SS2:"))).toBe(true);
  });
});
