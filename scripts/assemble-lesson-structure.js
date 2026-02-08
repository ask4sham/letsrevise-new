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
    else if (args[i] === "--rules" && args[i + 1]) { out.rules = args[i + 1]; i++; }
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

function applyTemplate(template, vars) {
  if (typeof template !== "string") return template;
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value ?? ""));
  }
  return out;
}

function main() {
  const opts = parseArgs();
  const contractPath = resolvePath(opts.contract) || path.join(ROOT, "docs", "curriculum", "engine", "derivation.contract.json");
  const statutoryPath = resolvePath(opts.statutory) || path.join(ROOT, "docs", "curriculum", "statutory", "england-gcse-biology.v1.json");
  const boardSpecPath = resolvePath(opts.board) || path.join(ROOT, "docs", "curriculum", "boards", "aqa-gcse-biology-photosynthesis.v1.json");
  const rulesPath = resolvePath(opts.rules) || path.join(ROOT, "docs", "curriculum", "engine", "mapping-rules.contract.json");

  const contract = loadJson(contractPath);
  const statutory = loadJson(statutoryPath);
  const boardSpec = loadJson(boardSpecPath);
  const rules = loadJson(rulesPath);

  if (!contract || !statutory || !boardSpec) {
    process.exit(1);
  }
  if (!rules) {
    console.error("Error: Missing or invalid rules file: " + rulesPath);
    process.exit(1);
  }

  const { topic, examBoard, specVersion } = contract.input || {};
  const lessonId = `dry-run:${topic}:${examBoard}:${specVersion}`;

  const statements = statutory.statements || [];
  const statementById = new Map(statements.map((s) => [s.id, s]));

  const mapsToDfE = boardSpec.mapsToDfE || [];
  const pageRules = rules.pageRules || {};
  const blockRulesList = Array.isArray(rules.blockRules) ? rules.blockRules : [];
  const statutoryBlockRule = blockRulesList.find((r) => r.when === "statutory");

  const pages = [];
  for (const statementId of mapsToDfE) {
    const st = statementById.get(statementId);
    if (!st || typeof st.text !== "string") {
      process.exit(1);
    }
    const pageId = pageRules.pageIdTemplate != null
      ? applyTemplate(pageRules.pageIdTemplate, { statementId })
      : `page:${statementId}`;
    const title = pageRules.titleTemplate != null
      ? applyTemplate(pageRules.titleTemplate, { statementId })
      : `DfE: ${statementId}`;
    const blockType = statutoryBlockRule && statutoryBlockRule.type != null ? statutoryBlockRule.type : "statutory";
    const blockSources = statutoryBlockRule && statutoryBlockRule.sources && statutoryBlockRule.sources.length
      ? statutoryBlockRule.sources.map((t) => applyTemplate(t, { statementId }))
      : [statementId];
    pages.push({
      pageId,
      title,
      blocks: [
        { type: blockType, content: st.text, sources: blockSources }
      ]
    });
  }

  const examRequirements = boardSpec.examRequirements || [];
  const topicVal = boardSpec.topic || topic;
  const assessmentRules = rules.assessmentRules || {};
  const assessmentType = assessmentRules.type != null ? assessmentRules.type : "mcq";
  const sourcesTemplate = assessmentRules.sourcesTemplate != null
    ? assessmentRules.sourcesTemplate
    : `AQA:{{topic}}`;
  const assessmentSources = [applyTemplate(sourcesTemplate, { topic: topicVal })];
  const assessments = examRequirements.map((prompt) => ({
    type: assessmentType,
    prompt,
    sources: assessmentSources
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
    metadata: {
      requiresReview: rules.metadata && typeof rules.metadata.requiresReview === "boolean"
        ? rules.metadata.requiresReview
        : true
    }
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

main();
