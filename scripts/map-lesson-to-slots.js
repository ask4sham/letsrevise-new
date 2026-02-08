#!/usr/bin/env node
/**
 * map-lesson-to-slots.js
 *
 * Maps an assembled lesson structure to content slots
 * using content-slots.contract.json.
 *
 * Deterministic, pipeline-safe:
 * - Reads lesson JSON from stdin
 * - Loads content-slots contract
 * - Emits slot-mapped JSON to stdout
 */

const fs = require("fs");
const path = require("path");

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.on("data", chunk => (data += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error("Invalid JSON on stdin"));
      }
    });
  });
}

function loadJson(p) {
  const full = path.resolve(p);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing file: ${full}`);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  const slotsPath =
    args[0] ||
    "docs/curriculum/engine/content-slots.contract.json";

  const lesson = await readStdin();
  const slotsContract = loadJson(slotsPath);

  const slots = [];

  // Pages → slots
  for (const page of lesson.pages || []) {
    for (const block of page.blocks || []) {
      slots.push({
        slotId: `slot:${page.pageId}:${block.type}`,
        kind: block.type,
        required: true,
        sources: block.sources || [],
        content: block.content
      });
    }
  }

  // Assessments → slots
  for (const assessment of lesson.assessments || []) {
    slots.push({
      slotId: `slot:assessment:${assessment.type}`,
      kind: "assessment",
      required: true,
      sources: assessment.sources || [],
      prompt: assessment.prompt
    });
  }

  const output = {
    lessonId: lesson.lessonId,
    appliesTo: slotsContract.appliesTo,
    slots,
    metadata: slotsContract.metadata || {}
  };

  process.stdout.write(JSON.stringify(output, null, 2));
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
