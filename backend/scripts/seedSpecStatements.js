/**
 * PR-001: Seed SpecStatement records from JSON.
 * Usage: node backend/scripts/seedSpecStatements.js [--specKey AQA_GCSE_BIOLOGY] [--file path/to/statements.json]
 * Default file: docs/specStatements.example.json
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const SpecStatement = require("../models/SpecStatement");

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { specKey: null, file: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--specKey" && args[i + 1]) {
      opts.specKey = args[i + 1].trim();
      i++;
    } else if (args[i] === "--file" && args[i + 1]) {
      opts.file = args[i + 1].trim();
      i++;
    }
  }
  return opts;
}

async function run() {
  const { specKey, file } = parseArgs();
  const repoRoot = path.resolve(__dirname, "..", "..");
  const filePath = file
    ? path.isAbsolute(file)
      ? file
      : path.join(repoRoot, file)
    : path.join(repoRoot, "docs", "specStatements.example.json");

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }

  let statements;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    statements = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse JSON:", err.message);
    process.exit(1);
  }

  if (!Array.isArray(statements)) {
    console.error("JSON must be an array of statement objects");
    process.exit(1);
  }

  let toInsert = statements;
  if (specKey) {
    toInsert = statements.filter((s) => s.specKey === specKey);
    if (toInsert.length === 0) {
      console.log(`No statements with specKey=${specKey} in file. Exiting.`);
      process.exit(0);
    }
    console.log(`Filtered to ${toInsert.length} statements for specKey=${specKey}`);
  }

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  let inserted = 0;
  for (const s of toInsert) {
    if (!s.specKey || !s.examBoard || !s.level || !s.topicKey || !s.statementCode || !s.statementText) {
      console.warn("Skipping invalid statement:", JSON.stringify(s).slice(0, 80) + "...");
      continue;
    }
    try {
      await SpecStatement.create({
        specKey: String(s.specKey).trim(),
        examBoard: String(s.examBoard).trim(),
        level: String(s.level).trim(),
        topicKey: String(s.topicKey).trim(),
        statementCode: String(s.statementCode).trim(),
        statementText: String(s.statementText).trim(),
        tier: s.tier != null ? String(s.tier).trim() || null : null,
        tags: Array.isArray(s.tags) ? s.tags.map((t) => String(t).trim()).filter(Boolean) : [],
        metadata: s.metadata && typeof s.metadata === "object" ? s.metadata : {},
      });
      inserted++;
    } catch (err) {
      console.warn("Failed to insert:", s.statementCode, err.message);
    }
  }

  await mongoose.disconnect();
  console.log(`Inserted ${inserted} SpecStatement(s).`);
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { run };
