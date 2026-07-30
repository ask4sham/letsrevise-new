/**
 * Unit: V2.3A generation lease configuration bounds.
 */
const {
  getMcqRationaleGenerationLeaseMs,
  DEFAULT_GENERATION_LEASE_MS,
  MIN_GENERATION_LEASE_MS,
  MAX_GENERATION_LEASE_MS,
} = require("../config/mcqRationaleBackfillFlags");

describe("getMcqRationaleGenerationLeaseMs", () => {
  const prev = process.env.MCQ_RATIONALE_GENERATION_LEASE_MS;

  afterEach(() => {
    if (prev == null) delete process.env.MCQ_RATIONALE_GENERATION_LEASE_MS;
    else process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = prev;
  });

  test("defaults to 10 minutes covering 2×120s provider timeouts", () => {
    delete process.env.MCQ_RATIONALE_GENERATION_LEASE_MS;
    expect(getMcqRationaleGenerationLeaseMs()).toBe(DEFAULT_GENERATION_LEASE_MS);
    expect(DEFAULT_GENERATION_LEASE_MS).toBe(10 * 60 * 1000);
    expect(DEFAULT_GENERATION_LEASE_MS).toBeGreaterThan(2 * 120 * 1000);
  });

  test("invalid / empty / negative fall back to default", () => {
    process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = "";
    expect(getMcqRationaleGenerationLeaseMs()).toBe(DEFAULT_GENERATION_LEASE_MS);
    process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = "abc";
    expect(getMcqRationaleGenerationLeaseMs()).toBe(DEFAULT_GENERATION_LEASE_MS);
    process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = "-1";
    expect(getMcqRationaleGenerationLeaseMs()).toBe(DEFAULT_GENERATION_LEASE_MS);
  });

  test("clamps to min and max", () => {
    process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = String(30 * 1000);
    expect(getMcqRationaleGenerationLeaseMs()).toBe(MIN_GENERATION_LEASE_MS);
    process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = String(60 * 60 * 1000);
    expect(getMcqRationaleGenerationLeaseMs()).toBe(MAX_GENERATION_LEASE_MS);
    process.env.MCQ_RATIONALE_GENERATION_LEASE_MS = String(5 * 60 * 1000);
    expect(getMcqRationaleGenerationLeaseMs()).toBe(5 * 60 * 1000);
  });
});
