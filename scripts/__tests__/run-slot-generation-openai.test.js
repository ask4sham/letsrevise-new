const { spawnSync } = require("child_process");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const EXECUTOR_PATH = path.join(REPO_ROOT, "scripts", "run-slot-generation-openai.js");
const VALID_JOB = JSON.stringify(
  {
    version: "v1",
    appliesTo: {
      subject: "Biology",
      level: "GCSE",
      board: "AQA",
      specVersion: "v1",
    },
    jobs: [
      {
        jobId: "J1",
        slotId: "S1",
        kind: "explanatory",
        mode: "generate",
        input: {},
        output: { field: "content", type: "text" },
        sources: [],
        required: true,
      },
    ],
    metadata: { requiresReview: false },
  },
  null,
  2
);

function runExecutor(inputJson, extraEnv = {}) {
  return spawnSync("node", [EXECUTOR_PATH], {
    cwd: REPO_ROOT,
    input: inputJson,
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
  });
}

describe("run-slot-generation-openai (Phase 4C dark-launch skeleton)", () => {
  test("with FEATURE_SLOTGEN_AI off returns deterministic STUB result and schema-valid JSON-only output", () => {
    const { status, stdout, stderr } = runExecutor(VALID_JOB, {
      FEATURE_SLOTGEN_AI: "false",
    });

    // Process should succeed
    expect(status).toBe(0);
    expect(stderr || "").toBe("");

    // Output must be parseable JSON
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("status", "STUB");
    expect(result).toHaveProperty("jobId", "J1");

    // Output must be JSON-only (no markdown/commentary)
    expect(stdout).not.toContain("```");
    expect(stdout).not.toMatch(/(^|\n)#/);
  });

  test("with FEATURE_SLOTGEN_AI on fails fast with clear error (no model calls yet)", () => {
    const { status, stdout, stderr } = runExecutor(VALID_JOB, {
      FEATURE_SLOTGEN_AI: "true",
    });

    expect(status).not.toBe(0);
    expect(stdout || "").toBe("");
    expect(stderr || "").toContain(
      "FEATURE_SLOTGEN_AI is enabled, but model call is not implemented yet."
    );
  });

  test("rejects schema-invalid jobs with non-zero exit and no JSON on stdout", () => {
    const invalidJob = JSON.stringify({ version: "v1" });

    const { status, stdout, stderr } = runExecutor(invalidJob, {
      FEATURE_SLOTGEN_AI: "false",
    });

    expect(status).not.toBe(0);
    expect(stdout || "").toBe("");
    expect(stderr || "").not.toBe("");
  });
});

