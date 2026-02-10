#!/usr/bin/env node

/**
 * Phase 4C — OpenAI Slot Generation Executor (DARK)
 *
 * Rules:
 * - Validate input job schema (slot-generation.v1)
 * - Output must validate result schema (slot-generation-result.v1)
 * - NO model calls yet (dark launch). Always returns status "STUB".
 * - Later we will swap the stub section for real OpenAI calls.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function readFile(p) {
  return fs.readFileSync(p, "utf8");
}

function validateJsonStdin(jsonText, schemaPath) {
  const validate = spawnSync(
    "node",
    ["scripts/validate-json.js", "-", schemaPath],
    { input: jsonText, encoding: "utf8" }
  );

  if (validate.status !== 0) {
    process.stderr.write(validate.stderr || `JSON failed schema validation: ${schemaPath}\n`);
    process.exit(1);
  }
}

process.stdin.resume();
process.stdin.setEncoding("utf8");

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  if (!input.trim()) {
    console.error("No input provided to run-slot-generation-openai");
    process.exit(1);
  }

  // 1) Validate input schema
  validateJsonStdin(input, "docs/curriculum/engine/slot-generation.v1.schema.json");

  const jobSpec = JSON.parse(input);

  // 2) Load canonical executor config + prompt contract (versioned inputs for hashing later)
  const cfgPath = "docs/curriculum/engine/slot-generation-executor.openai.v1.json";
  const promptPath = "docs/curriculum/engine/slot-generation-prompt.openai.v1.md";

  if (!fs.existsSync(cfgPath)) {
    console.error(`Missing executor config: ${cfgPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(promptPath)) {
    console.error(`Missing prompt contract: ${promptPath}`);
    process.exit(1);
  }

  const executorConfig = JSON.parse(readFile(cfgPath));
  const promptContract = readFile(promptPath);

  // 3) Dark-launch feature flag (OFF by default)
  const enabled = process.env.FEATURE_SLOTGEN_AI === "true";
  if (!enabled) {
    // Deterministic stub output (still schema-valid)
    const firstJobId = jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN";

    const result = {
      version: "v1",
      jobId: firstJobId,
      status: "STUB",
      generatedAt: new Date().toISOString(),
      output: null,
      metadata: {
        requiresReview: true,
        executor: executorConfig.version,
        model: executorConfig.model,
        promptContract: path.basename(promptPath),
        note: "FEATURE_SLOTGEN_AI is disabled; no model call was made."
      }
    };

    const outputJson = JSON.stringify(result, null, 2);

    // 4) Validate output schema
    validateJsonStdin(outputJson, "docs/curriculum/engine/slot-generation-result.v1.schema.json");

    process.stdout.write(outputJson);
    return;
  }

  // Placeholder for Phase 4C model call implementation (next steps).
  console.error("FEATURE_SLOTGEN_AI is enabled, but model call is not implemented yet.");
  process.exit(1);
});

