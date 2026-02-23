/**
 * GET /api/taxonomy/aqa-gcse-chemistry — returns AQA GCSE Chemistry taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-gcse-chemistry", () => {
  test("returns 200 and chemistry taxonomy", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-chemistry").expect(200);
    expect(res.body).toHaveProperty("subject", "Chemistry");
    expect(res.body).toHaveProperty("examBoard", "AQA");
    expect(res.body).toHaveProperty("level", "GCSE");
    expect(res.body).toHaveProperty("specKey", "aqa-gcse-chemistry");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units).toHaveLength(10);
  });

  test("each unit has unit name and topics array", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-chemistry").expect(200);
    const units = res.body.units;
    expect(units.length).toBe(10);
    for (const u of units) {
      expect(u).toHaveProperty("unit");
      expect(Array.isArray(u.topics)).toBe(true);
      if (u.topics.length > 0) {
        const t = u.topics[0];
        expect(t).toHaveProperty("topic");
        expect(t).toHaveProperty("key");
        expect(Array.isArray(t.tier)).toBe(true);
        expect(typeof t.requiredPractical).toBe("boolean");
      }
    }
  });

  test("known Chemistry unit and topic exist", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-chemistry").expect(200);
    const units = res.body.units;
    const atomic = units.find((u) => u.unit === "Atomic Structure & the Periodic Table");
    expect(atomic).toBeDefined();
    expect(atomic.topics.some((t) => t.key === "simple-model-of-the-atom" && t.topic === "Simple Model of the Atom")).toBe(true);
  });
});
