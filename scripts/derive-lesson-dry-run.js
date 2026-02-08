#!/usr/bin/env node
/**
 * derive-lesson-dry-run.js
 * Reads derivation contract + statutory + board spec, outputs a dry-run derivation
 * output (no disk/DB/AI). Exit 1 if any file missing or JSON parse fails.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.dirname(__dirname);

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--contract" && args[i + 1]) { out.contract = args[i + 1]; i++; }
    else if (args[i] === "--statutory" && args[i + 1]) { out.statutory = args[i + 1]; i++; }
    else if (args[i] === "--board" && args[i + 1]) { out.board = args[i + 1]; i++; }
  }
  return out;
}

function resolvePath(raw) {
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function loadJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs();
  const contractPath = resolvePath(opts.contract) || path.join(ROOT, "docs", "curriculum", "engine", "derivation.contract.json");
  const statutoryPath = resolvePath(opts.statutory) || path.join(ROOT, "docs", "curriculum", "statutory", "england-gcse-biology.v1.json");
  const boardSpecPath = resolvePath(opts.board) || path.join(ROOT, "docs", "curriculum", "boards", "aqa-gcse-biology-photosynthesis.v1.json");

  const contract = loadJson(contractPath);
  const statutory = loadJson(statutoryPath);
  const boardSpec = loadJson(boardSpecPath);

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
