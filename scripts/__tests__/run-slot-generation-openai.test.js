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

    // Output must be parseable JSON
    const result = JSON.parse(stdout);
    expect(result).toHaveProperty("status", "STUB");
    expect(result).toHaveProperty("jobId", "J1");

    // Output must be JSON-only (no markdown/commentary)
    expect(stdout).not.toContain("```");
    expect(stdout).not.toMatch(/(^|\n)#/);
  });

  test("kill-switch forces stub even when FEATURE_SLOTGEN_AI is true", () => {
    const { status, stdout } = runExecutor(VALID_JOB, {
      FEATURE_SLOTGEN_AI: "true",
      SLOTGEN_AI_KILL: "true",
    });

    expect(status).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.status).toBe("STUB");
  });

  test("with FEATURE_SLOTGEN_AI on fails fast with clear error (no model calls yet)", () => {
    const { status, stdout, stderr } = runExecutor(VALID_JOB, {
      FEATURE_SLOTGEN_AI: "true",
      SLOTGEN_AI_KILL: "false",
      OPENAI_API_KEY: "",
    });

    // With canary gate and no metadata.allowAI, this should stay on the stub path.
    expect(status).toBe(0);
    const result = JSON.parse(stdout);
    expect(result.status).toBe("STUB");
    expect(stderr || "").toContain("NOT_ALLOWLISTED");
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

  test("FEATURE on + allowAI true still STUBs when allowlist is disabled (deny-by-default)", () => {
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const validJobNoNetwork = JSON.stringify({
      version: "v1",
      appliesTo: {
        subject: "Biology",
        level: "GCSE",
        board: "AQA",
        specVersion: "v1"
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
          required: true
        }
      ],
      // Explicitly opts-in, but allowlist disabled must still force STUB.
      metadata: { requiresReview: false, allowAI: true }
    });

    const tmpAllowlistPath = path.join(
      os.tmpdir(),
      `slotgen-allowlist-disabled-${Date.now()}.json`
    );

    fs.writeFileSync(
      tmpAllowlistPath,
      JSON.stringify(
        {
          version: "allowlist.v1",
          enabled: false,
          mode: "deny_by_default",
          rules: []
        },
        null,
        2
      ),
      "utf8"
    );

    const res = spawnSync("node", [EXECUTOR_PATH], {
      cwd: REPO_ROOT,
      input: validJobNoNetwork,
      encoding: "utf8",
      env: {
        ...process.env,
        FEATURE_SLOTGEN_AI: "true",
        SLOTGEN_AI_KILL: "false",
        SLOTGEN_ALLOWLIST_PATH: tmpAllowlistPath,
        // Provide fake key/base to ensure any accidental network attempt would be obvious.
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: "http://127.0.0.1:1"
      }
    });

    // Must succeed and STUB (no OpenAI call path).
    expect(res.status).toBe(0);

    const out = JSON.parse(res.stdout);
    expect(out.status).toBe("STUB");
    expect(out.jobId).toBe("J1");

    // Telemetry should indicate it was blocked by allowlist, not by kill-switch.
    const stderrLines = (res.stderr || "").trim().split("\n");
    const last = stderrLines[stderrLines.length - 1] || "";
    const telemetry = JSON.parse(last);
    expect(telemetry.path).toBe("stub");
    expect(telemetry.status).toBe("STUB");
    expect(telemetry.errorCode).toBe("NOT_ALLOWLISTED");

    try {
      fs.unlinkSync(tmpAllowlistPath);
    } catch {}
  });
});

