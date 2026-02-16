/**
 * GET /api/taxonomy/aqa-gcse-biology — returns canonical AQA GCSE Biology topic taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-gcse-biology", () => {
  test("returns subject, examBoard, level, and units", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-biology");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("subject", "Biology");
    expect(res.body).toHaveProperty("examBoard", "AQA");
    expect(res.body).toHaveProperty("level", "GCSE");
    expect(Array.isArray(res.body.units)).toBe(true);
    expect(res.body.units.length).toBeGreaterThan(0);
  });

  test("each unit has unit name and topics array with topic, key, tier, requiredPractical", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-biology");
    expect(res.status).toBe(200);
    const units = res.body.units;
    expect(units.length).toBeGreaterThan(0);
    const first = units[0];
    expect(first).toHaveProperty("unit");
    expect(Array.isArray(first.topics)).toBe(true);
    if (first.topics.length > 0) {
      const t = first.topics[0];
      expect(t).toHaveProperty("topic");
      expect(t).toHaveProperty("key");
      expect(Array.isArray(t.tier)).toBe(true);
      expect(typeof t.requiredPractical).toBe("boolean");
    }
  });
});
