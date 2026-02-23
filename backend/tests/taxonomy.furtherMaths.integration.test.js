/**
 * GET /api/taxonomy/aqa-l2-further-maths — returns AQA Level 2 Further Maths taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-l2-further-maths", () => {
  test("returns normalized taxonomy payload", async () => {
    const res = await request(app)
      .get("/api/taxonomy/aqa-l2-further-maths")
      .expect(200);

    expect(res.body).toHaveProperty("subject", "Further Mathematics");
    expect(res.body).toHaveProperty("examBoard", "AQA");
    expect(res.body).toHaveProperty("level", "Level 2 Certificate");
    expect(res.body).toHaveProperty("specKey", "aqa-l2-further-maths");
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

  test("includes SS1 units (Number / Algebra & Functions / Coordinate Geometry / Calculus / Matrix Transformations / Geometry)", async () => {
    const res = await request(app)
      .get("/api/taxonomy/aqa-l2-further-maths")
      .expect(200);

    const unitNames = res.body.units.map((u) => u.unit);

    expect(unitNames).toContain("SS1. Number");
    expect(unitNames).toContain("SS1. Algebra & Functions");
    expect(unitNames).toContain("SS1. Coordinate Geometry");
    expect(unitNames).toContain("SS1. Calculus");
    expect(unitNames).toContain("SS1. Matrix Transformations");
    expect(unitNames).toContain("SS1. Geometry");
  });
});
