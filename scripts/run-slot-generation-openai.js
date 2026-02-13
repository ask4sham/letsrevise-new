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
const { emitTelemetry } = require("./slotgen-telemetry");

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

function loadAllowlist() {
  const allowlistPath =
    process.env.SLOTGEN_ALLOWLIST_PATH ||
    path.join(
      __dirname,
      "../docs/curriculum/engine/slot-generation-allowlist.v1.json"
    );

  const raw = fs.readFileSync(allowlistPath, "utf8");
  return JSON.parse(raw);
}

function isAllowedByPolicy({ allowlist, appliesTo, job }) {
  // Deny-by-default: if allowlist is missing or disabled, nothing is allowed.
  if (!allowlist || allowlist.enabled !== true) return false;
  if (allowlist.mode !== "deny_by_default") return false;

  return allowlist.rules.some((rule) => {
    if (!rule.enabled) return false;

    const matchSubject = rule.appliesTo.subject.includes(appliesTo.subject);
    const matchLevel = rule.appliesTo.level.includes(appliesTo.level);
    const matchBoard = rule.appliesTo.board.includes(appliesTo.board);
    const matchSpec = rule.appliesTo.specVersion.includes(appliesTo.specVersion);

    const matchKind =
      Array.isArray(rule.kinds) && rule.kinds.length > 0
        ? rule.kinds.includes(job.kind)
        : true;

    const matchSlot =
      Array.isArray(rule.slotIds) && rule.slotIds.length > 0
        ? rule.slotIds.includes(job.slotId)
        : true;

    return matchSubject && matchLevel && matchBoard && matchSpec && matchKind && matchSlot;
  });
}

/** Deterministic bucket 0..99 from jobId (same jobId → same bucket). */
function rolloutBucket(jobId) {
  let h = 0;
  const s = String(jobId ?? "");
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % 100;
}

function isJobAllowlisted(job, allowlist) {
  if (!allowlist.enabled) return false;

  return allowlist.rules.some((rule) => {
    const appliesTo = job.appliesTo || {};
    const firstJob = job.jobs?.[0];
    const subjectMatch = rule.appliesTo?.subject?.includes(appliesTo.subject);
    const levelMatch = rule.appliesTo?.level?.includes(appliesTo.level);
    const boardMatch = rule.appliesTo?.board?.includes(appliesTo.board);
    const kindMatch =
      !Array.isArray(rule.kinds) || rule.kinds.length === 0
        ? true
        : rule.kinds.includes(firstJob?.kind);
    return (
      rule.enabled !== false &&
      subjectMatch &&
      levelMatch &&
      boardMatch &&
      kindMatch
    );
  });
}

process.stdin.resume();
process.stdin.setEncoding("utf8");

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", async () => {
  const start = Date.now();
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

  const allowlist = loadAllowlist();

  const featureEnabled = process.env.FEATURE_SLOTGEN_AI === "true";
  const allowAI = jobSpec?.metadata?.allowAI === true;

  const aiPermitted =
    featureEnabled &&
    allowAI &&
    allowlist.enabled &&
    isJobAllowlisted(jobSpec, allowlist);

  if (!aiPermitted || process.env.SLOTGEN_AI_KILL === "true") {
    const firstJobId = jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN";
    const result = {
      version: "v1",
      jobId: firstJobId,
      status: "STUB",
      generatedAt: new Date().toISOString(),
      output: null
    };

    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: firstJobId,
      path: "stub",
      status: "STUB",
      latencyMs: Date.now() - start,
      errorCode:
        process.env.SLOTGEN_AI_KILL === "true"
          ? "KILL_SWITCH"
          : "NOT_ALLOWLISTED"
    });

    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Rollout gate: deterministic by jobId (0 = no gate; 1..100 = percent in)
  const firstJobId = jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN";
  const rolloutPercent = Math.min(100, Math.max(0, parseInt(process.env.SLOTGEN_AI_ROLLOUT_PERCENT || "0", 10) || 0));
  const inRollout = rolloutPercent === 0 || rolloutBucket(firstJobId) < rolloutPercent;

  if (!inRollout) {
    const result = {
      version: "v1",
      jobId: firstJobId,
      status: "STUB",
      generatedAt: new Date().toISOString(),
      output: null
    };
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: firstJobId,
      path: "stub",
      status: "STUB",
      latencyMs: Date.now() - start,
      errorCode: "ROLLOUT_EXCLUDED"
    });
    process.stdout.write(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // Phase 4C (real call) — still schema-locked.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const latencyMs = Date.now() - start;
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
      path: "openai",
      status: "FAILED",
      latencyMs,
      errorCode: "MISSING_API_KEY",
    });
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const url = `${baseUrl}/chat/completions`;

  // Minimal, strict JSON-only instruction.
  const system = `${promptContract}

STRICT OUTPUT RULES:
- Return ONLY valid JSON (no markdown, no commentary).
- The JSON MUST be an object representing the generated OUTPUT payload for this job spec.
`;

  const user = `JOB SPEC (JSON):
${JSON.stringify(jobSpec, null, 2)}`;

  const body = {
    model: executorConfig.model,
    temperature: executorConfig.temperature,
    top_p: executorConfig.top_p,
    max_tokens: executorConfig.max_output_tokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };

  let responseText = "";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    responseText = await res.text();
    if (!res.ok) {
      const latencyMs = Date.now() - start;
      emitTelemetry({
        executorVersion: executorConfig.version,
        jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
        path: "openai",
        status: "FAILED",
        latencyMs,
        errorCode: "OPENAI_HTTP_ERROR",
      });
      process.stderr.write(responseText);
      process.exit(1);
    }
  } catch (err) {
    const latencyMs = Date.now() - start;
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
      path: "openai",
      status: "FAILED",
      latencyMs,
      errorCode: "OPENAI_REQUEST_FAILED",
    });
    console.error(`OpenAI request failed: ${err && err.message ? err.message : String(err)}`);
    process.exit(1);
  }

  let completion;
  try {
    completion = JSON.parse(responseText);
  } catch {
    const latencyMs = Date.now() - start;
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
      path: "openai",
      status: "FAILED",
      latencyMs,
      errorCode: "OPENAI_NON_JSON_RESPONSE",
    });
    process.stderr.write("OpenAI response was not valid JSON\n");
    process.stderr.write(responseText);
    process.exit(1);
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    const latencyMs = Date.now() - start;
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
      path: "openai",
      status: "FAILED",
      latencyMs,
      errorCode: "OPENAI_MISSING_CONTENT",
    });
    process.stderr.write("OpenAI response missing choices[0].message.content\n");
    process.stderr.write(responseText);
    process.exit(1);
  }

  let generatedOutput;
  try {
    generatedOutput = JSON.parse(content);
  } catch {
    const latencyMs = Date.now() - start;
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
      path: "openai",
      status: "FAILED",
      latencyMs,
      errorCode: "OPENAI_NON_JSON_CONTENT",
    });
    process.stderr.write("Model did not return valid JSON-only output\n");
    process.stderr.write(content);
    process.exit(1);
  }

  if (generatedOutput === null || typeof generatedOutput !== "object" || Array.isArray(generatedOutput)) {
    const latencyMs = Date.now() - start;
    emitTelemetry({
      executorVersion: executorConfig.version,
      jobId: jobSpec.jobId ?? jobSpec.jobs?.[0]?.jobId ?? "UNKNOWN",
      path: "openai",
      status: "FAILED",
      latencyMs,
      errorCode: "OPENAI_OUTPUT_NOT_OBJECT",
    });
    process.stderr.write("Model output must be a JSON object\n");
    process.exit(1);
  }

  const result = {
    version: "v1",
    jobId: firstJobId,
    status: "COMPLETED",
    generatedAt: new Date().toISOString(),
    output: generatedOutput
  };

  const outputJson = JSON.stringify(result, null, 2);

  // Validate output schema (contract-locked)
  validateJsonStdin(
    outputJson,
    "docs/curriculum/engine/slot-generation-result.v1.schema.json"
  );

  process.stdout.write(outputJson);

  const latencyMs = Date.now() - start;
  emitTelemetry({
    executorVersion: executorConfig.version,
    jobId: firstJobId,
    path: "openai",
    status: "COMPLETED",
    latencyMs,
    errorCode: null,
  });
});

