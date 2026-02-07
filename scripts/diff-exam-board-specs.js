#!/usr/bin/env node
/**
 * diff-exam-board-specs.js
 * Compares two exam board spec JSON files and outputs a JSON diff report.
 * Usage: node scripts/diff-exam-board-specs.js <oldSpecPath> <newSpecPath>
 */
const fs = require("fs");
const path = require("path");

function loadJson(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

function arrayDiff(oldArr, newArr) {
  const oldSet = new Set(oldArr || []);
  const newSet = new Set(newArr || []);
  const added = [...newSet].filter((x) => !oldSet.has(x));
  const removed = [...oldSet].filter((x) => !newSet.has(x));
  return { added, removed };
}

function main() {
  const [oldSpecPath, newSpecPath] = process.argv.slice(2);
  if (!oldSpecPath || !newSpecPath) {
    process.exit(1);
  }

  const oldSpec = loadJson(oldSpecPath);
  const newSpec = loadJson(newSpecPath);
  if (!oldSpec || !newSpec) {
    process.exit(1);
  }

  const changes = [];

  const reqDiff = arrayDiff(oldSpec.examRequirements, newSpec.examRequirements);
  for (const r of reqDiff.added) {
    changes.push({
      changeType: "added-requirement",
      detail: r,
      impact: "lesson-content"
    });
  }
  for (const r of reqDiff.removed) {
    changes.push({
      changeType: "removed-requirement",
      detail: r,
      impact: "lesson-content"
    });
  }

  const mapDiff = arrayDiff(oldSpec.mapsToDfE, newSpec.mapsToDfE);
  for (const m of mapDiff.added) {
    changes.push({
      changeType: "added-mapping",
      detail: m,
      impact: "mapping"
    });
  }
  for (const m of mapDiff.removed) {
    changes.push({
      changeType: "removed-mapping",
      detail: m,
      impact: "mapping"
    });
  }

  const oldTier = oldSpec.tier;
  const newTier = newSpec.tier;
  if (oldTier !== newTier) {
    changes.push({
      changeType: "tier-changed",
      detail: `${oldTier ?? "(unspecified)"} → ${newTier ?? "(unspecified)"}`,
      impact: "assessment"
    });
  }

  const report = {
    board: newSpec.board,
    subject: newSpec.subject,
    level: newSpec.level,
    fromSpecVersion: oldSpec.specVersion,
    toSpecVersion: newSpec.specVersion,
    topic: newSpec.topic,
    changes
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

main();
