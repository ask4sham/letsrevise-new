/**
 * GET /api/taxonomy/aqa-gcse-physics — returns AQA GCSE Physics taxonomy.
 */
const request = require("supertest");
const app = require("../app");

describe("GET /api/taxonomy/aqa-gcse-physics", () => {
  test("returns 200 and normalized taxonomy payload", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-physics");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("subject", "Physics");
    expect(res.body).toHaveProperty("examBoard", "AQA");
    expect(res.body).toHaveProperty("level", "GCSE");
    expect(res.body).toHaveProperty("specKey", "aqa-gcse-physics");
    expect(Array.isArray(res.body.units)).toBe(true);
  });

  test("contains expected units and a known topic", async () => {
    const res = await request(app).get("/api/taxonomy/aqa-gcse-physics");
    expect(res.status).toBe(200);
    expect(res.body.units.length).toBeGreaterThanOrEqual(6);

    const energyUnit = res.body.units.find((u) => u.unit === "Energy");
    expect(energyUnit).toBeTruthy();
    expect(Array.isArray(energyUnit.topics)).toBe(true);

    const topic = energyUnit.topics.find((t) => t.key === "energy-stores-and-transfers");
    expect(topic).toBeTruthy();
    expect(topic.topic).toBe("Energy Stores & Transfers");
  });
});
