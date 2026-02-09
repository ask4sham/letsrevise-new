#!/usr/bin/env node
/**
 * fill-content-slots.js
 *
 * Deterministic slot filler (no AI):
 * - Reads slot-mapped JSON from stdin
 * - Ensures required slots have the minimum required fields:
 *   - statutory slots => content
 *   - assessment slots => prompt
 * - If anything is missing, inserts a TODO placeholder and flips metadata.requiresReview = true
 * - Always prints JSON to stdout (pipeline-safe)
 */

const fs = require("fs");

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e };
  }
}

function main() {
  const raw = readStdin();
  if (!raw || !raw.trim()) {
    console.error("Error: No JSON provided on stdin.");
    process.exit(1);
  }

  const parsed = safeJsonParse(raw);
  if (!parsed.ok) {
    console.error("Error: Invalid JSON on stdin.");
    process.exit(1);
  }

  const doc = parsed.value;

  // Minimal shape checks (keep it simple + deterministic)
  if (!doc || typeof doc !== "object") {
    console.error("Error: Expected a JSON object.");
    process.exit(1);
  }

  // Ensure version exists (schema requires it)
  if (!doc.version || typeof doc.version !== "string") {
    doc.version = "v1";
    doc.metadata = doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {};
    doc.metadata.requiresReview = true;
  }

  if (!Array.isArray(doc.slots)) {
    console.error("Error: Expected slots to be an array.");
    process.exit(1);
  }

  let touched = false;

  for (const slot of doc.slots) {
    if (!slot || typeof slot !== "object") continue;

    const required = slot.required === true;
    const kind = slot.kind;

    if (!required) continue;

    if (kind === "statutory") {
      const hasContent = typeof slot.content === "string" && slot.content.trim().length > 0;
      if (!hasContent) {
        slot.content = `TODO: missing statutory content for ${slot.slotId || "unknown-slot"}`;
        touched = true;
      }
    }

    if (kind === "assessment") {
      const hasPrompt = typeof slot.prompt === "string" && slot.prompt.trim().length > 0;
      if (!hasPrompt) {
        slot.prompt = `TODO: missing assessment prompt for ${slot.slotId || "unknown-slot"}`;
        touched = true;
      }
    }
  }

  if (touched) {
    doc.metadata = doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {};
    doc.metadata.requiresReview = true;
  } else {
    // keep existing value; if missing, default true (review-safe)
    doc.metadata = doc.metadata && typeof doc.metadata === "object" ? doc.metadata : {};
    if (typeof doc.metadata.requiresReview !== "boolean") doc.metadata.requiresReview = true;
  }

  process.stdout.write(JSON.stringify(doc, null, 2) + "\n");
}

main();
