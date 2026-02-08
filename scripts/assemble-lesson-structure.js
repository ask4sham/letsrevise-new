#!/usr/bin/env node
/**
 * assemble-lesson-structure.js
 * Converts derivation inputs into lesson-structure contract shape (deterministic, no AI/DB).
 * Exit 1 on missing file, parse failure, or missing statement text.
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

  const statements = statutory.statements || [];
  const statementById = new Map(statements.map((s) => [s.id, s]));

  const mapsToDfE = boardSpec.mapsToDfE || [];
  const pages = [];
  for (const statementId of mapsToDfE) {
    const st = statementById.get(statementId);
    if (!st || typeof st.text !== "string") {
      process.exit(1);
    }
    pages.push({
      pageId: `page:${statementId}`,
      title: `DfE: ${statementId}`,
      blocks: [
        { type: "statutory", content: st.text, sources: [statementId] }
      ]
    });
  }

  const examRequirements = boardSpec.examRequirements || [];
  const topicVal = boardSpec.topic || topic;
  const assessments = examRequirements.map((prompt) => ({
    type: "mcq",
    prompt,
    sources: [`AQA:${topicVal}`]
  }));

  const output = {
    lessonId,
    subject: boardSpec.subject,
    level: boardSpec.level,
    board: boardSpec.board,
    specVersion: boardSpec.specVersion,
    topic: boardSpec.topic,
    pages,
    assessments,
    metadata: { requiresReview: true }
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
