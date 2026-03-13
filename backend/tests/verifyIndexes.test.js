/**
 * Unit tests for utils/verifyIndexes (PR-HARD-3).
 * Uses real models (test env has in-memory Mongo) so verifyIndexes runs and we get coverage.
 */
const { verifyIndexes, REQUIRED_INDEX } = require("../utils/verifyIndexes");

describe("verifyIndexes", () => {
  test("REQUIRED_INDEX is exported with expected shape", () => {
    expect(REQUIRED_INDEX).toEqual({ ownerId: 1, topicKey: 1, fingerprint: 1 });
  });

  test("verifyIndexes returns { ok, results }", async () => {
    const result = await verifyIndexes();
    expect(result).toHaveProperty("ok");
    expect(typeof result.ok).toBe("boolean");
    expect(result).toHaveProperty("results");
    expect(Array.isArray(result.results)).toBe(true);
  });

  test("results entries have collection and ok", async () => {
    const result = await verifyIndexes();
    expect(result.results.length).toBeGreaterThanOrEqual(1);
    result.results.forEach((r) => {
      expect(r).toHaveProperty("collection");
      expect(r).toHaveProperty("ok");
      expect(typeof r.ok).toBe("boolean");
    });
  });
});
