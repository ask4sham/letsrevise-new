#!/usr/bin/env node
/**
 * execute-slot-generation.js
 *
 * Deterministic executor for slot-generation.contract.json (no AI).
 *
 * Intended pipeline:
 *   assemble-lesson-structure -> map-lesson-to-slots -> fill-content-slots
 *   -> execute-slot-generation (this script)
 *
 * Behavior:
 * - Reads slot-mapped JSON from stdin (output of fill-content-slots).
 * - Loads docs/curriculum/engine/slot-generation.contract.json by default
 *   (overridable via --jobs <path>).
 * - For each job:
 *   - Finds the matching slot by slotId.
 *   - If mode === "verbatim": copies existing slot content into the
 *     configured output field (no-op but explicit boundary).
 *   - If mode === "generate": writes a deterministic TODO placeholder
 *     into the configured output field, based on topic/board/specVersion.
 * - If any placeholders are inserted or mismatches occur, ensures
 *   metadata.requiresReview = true.
 *
 * No AI, no network, no DB. Purely deterministic and CI-safe.
 */

const fs = require("fs");
const path = require("path");

function readStdinText() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function safeParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function loadJson(filePath) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Missing file: ${abs}`);
  }
  // tolerate BOM if present
  const raw = fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function inferPlaceholder(job, slot, appliesTo) {
  const topic = (appliesTo && appliesTo.topic) || "Unknown topic";
  const board = (appliesTo && appliesTo.board) || "Unknown board";
  const specVersion =
    (appliesTo && appliesTo.specVersion) || "Unknown specVersion";

  // Try to infer a label from slotId if it's an assessment MCQ slot
  let label = "content";
  if (job.kind === "assessment") {
    if (typeof slot.slotId === "string" && slot.slotId.includes("mcq")) {
      label = "MCQ";
    } else {
      label = "assessment content";
    }
  } else if (job.kind === "statutory") {
    label = "statutory content";
  }

  return `TODO: Generate ${label} for ${topic} (${board} ${specVersion})`;
}

function main() {
  const args = process.argv.slice(2);
  let jobsPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--jobs" && args[i + 1]) {
      jobsPath = args[i + 1];
      i++;
    }
  }

  const raw = readStdinText();
  if (!raw || !raw.trim()) {
    console.error("Error: No JSON provided on stdin.");
    process.exit(1);
  }

  const parsed = safeParseJson(raw.replace(/^\uFEFF/, ""));
  if (!parsed.ok || !parsed.value || typeof parsed.value !== "object") {
    console.error("Error: Invalid JSON on stdin.");
    process.exit(1);
  }

  const doc = parsed.value;
  const ROOT = process.cwd();
  const jobsFile =
    jobsPath ||
    path.join(
      ROOT,
      "docs",
      "curriculum",
      "engine",
      "slot-generation.contract.json"
    );

  let contract;
  try {
    contract = loadJson(jobsFile);
  } catch (e) {
    console.error("Error loading slot-generation.contract.json:", e.message);
    process.exit(1);
  }

  if (!Array.isArray(doc.slots)) {
    console.error("Error: Expected doc.slots to be an array.");
    process.exit(1);
  }

  const slotsById = new Map(
    doc.slots
      .filter((s) => s && typeof s === "object" && typeof s.slotId === "string")
      .map((s) => [s.slotId, s])
  );

  const jobs = Array.isArray(contract.jobs) ? contract.jobs : [];
  const appliesTo = contract.appliesTo || doc.appliesTo || {};

  let touched = false;

  for (const job of jobs) {
    if (!job || typeof job !== "object") continue;

    const { jobId, slotId, kind, mode, output } = job;
    if (!slotId || !output || typeof output.field !== "string") {
      // Malformed job; mark review and continue
      touched = true;
      continue;
    }

    const slot = slotsById.get(slotId);
    if (!slot) {
      // No matching slot; mark for review
      touched = true;
      continue;
    }

    const field = output.field;

    if (mode === "verbatim") {
      // For "verbatim" we expect the slot to already carry the source text
      // (e.g. filled from statutory statements). We simply ensure it is
      // present on the configured field.
      if (typeof slot[field] !== "string" || !slot[field].trim()) {
        // Fallback: reuse existing content/prompt if present
        const candidate =
          (typeof slot.content === "string" && slot.content.trim()) ||
          (typeof slot.prompt === "string" && slot.prompt.trim()) ||
          "";
        if (candidate) {
          slot[field] = candidate;
        } else {
          slot[field] = `TODO: missing verbatim content for ${slotId}`;
          touched = true;
        }
      }
    } else if (mode === "generate") {
      // Deterministic placeholder only (no AI)
      const placeholder = inferPlaceholder(job, slot, appliesTo);
      slot[field] = placeholder;
      touched = true;
    } else {
      // Unknown mode – mark for review
      touched = true;
    }
  }

  // Ensure metadata.requiresReview reflects whether we touched anything
  if (!doc.metadata || typeof doc.metadata !== "object") {
    doc.metadata = {};
  }
  if (touched) {
    doc.metadata.requiresReview = true;
  } else if (typeof doc.metadata.requiresReview !== "boolean") {
    doc.metadata.requiresReview = true;
  }

  process.stdout.write(JSON.stringify(doc, null, 2) + "\n");
}

main();

