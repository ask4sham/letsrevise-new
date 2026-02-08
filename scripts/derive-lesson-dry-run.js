#!/usr/bin/env node
/**
 * derive-lesson-dry-run.js
 * Reads derivation contract + statutory + board spec, outputs a dry-run derivation
 * output (no disk/DB/AI). Exit 1 if any file missing or JSON parse fails.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);
const CONTRACT_PATH = path.join(ROOT, "docs", "curriculum", "engine", "derivation.contract.json");
const STATUTORY_PATH = path.join(ROOT, "docs", "curriculum", "statutory", "england-gcse-biology.v1.json");
const BOARD_SPEC_PATH = path.join(ROOT, "docs", "curriculum", "boards", "aqa-gcse-biology-photosynthesis.v1.json");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const contract = loadJson(CONTRACT_PATH);
  const statutory = loadJson(STATUTORY_PATH);
  const boardSpec = loadJson(BOARD_SPEC_PATH);

  if (!contract || !statutory || !boardSpec) {
    process.exit(1);
  }

  const { topic, examBoard, specVersion } = contract.input || {};
  const lessonId = `dry-run:${topic}:${examBoard}:${specVersion}`;

  const mapsToDfE = boardSpec.mapsToDfE || [];
  const pages = mapsToDfE.length > 0
    ? [{ title: "Overview", source: mapsToDfE[0] }]
    : [];

  const examRequirements = boardSpec.examRequirements || [];
  const assessments = examRequirements.map((source) => ({ type: "mcq", source }));

  const output = {
    lessonId,
    pages,
    assessments
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
