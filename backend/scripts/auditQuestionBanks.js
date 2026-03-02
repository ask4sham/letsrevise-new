/**
 * CLI: Audit question banks for one spec or all specs.
 *
 * Run one spec:
 *   node scripts/auditQuestionBanks.js --spec aqa-gcse-biology
 *
 * Run all specs (from backend/config/*_topics.json):
 *   node scripts/auditQuestionBanks.js --all
 *
 * Outputs (per spec): docs/QUESTION_BANK_AUDIT_<specKey>.md, docs/SPRINT_ORDER_<specKey>.md
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const { runQuestionBankAuditAndWrite, safeSpecKeyForFilename } = require("./_audit/questionBankAudit");
const { getTaxonomyBySpecKey } = require("../utils/topicTaxonomy");

const CONFIG_DIR = path.resolve(__dirname, "..", "config");
const DOCS_DIR = path.resolve(__dirname, "..", "..", "docs");
/** Where React serves /docs from. __dirname-based so it works no matter where you run the script from. */
const PUBLIC_DOCS_DIR = path.resolve(__dirname, "..", "..", "frontend", "public", "docs");

/**
 * Derive specKey from config filename.
 * e.g. aqa_gcse_biology_topics.json -> aqa-gcse-biology
 */
function specKeyFromConfigFilename(filename) {
  const base = path.basename(filename, ".json");
  if (!base.endsWith("_topics")) return null;
  const stem = base.slice(0, -"_topics".length);
  return stem.replace(/_/g, "-");
}

/**
 * Discover all specKeys: read config/*_topics.json; use specKey from JSON if present, else from filename.
 */
function discoverSpecKeys() {
  const files = fs.readdirSync(CONFIG_DIR).filter((f) => f.endsWith("_topics.json"));
  const specKeys = [];
  for (const file of files) {
    const filePath = path.join(CONFIG_DIR, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
    const fromJson = data && data.specKey;
    const fromFile = specKeyFromConfigFilename(file);
    const specKey = fromJson || fromFile;
    if (specKey) specKeys.push(specKey);
  }
  return specKeys;
}

/**
 * List available specKeys (from getTaxonomyBySpecKey so we only list supported ones).
 * Platform supports a fixed set; config files may add more that taxonomy service doesn't yet load.
 */
function getAvailableSpecKeys() {
  const fromConfig = discoverSpecKeys();
  const supported = [];
  for (const specKey of fromConfig) {
    try {
      const taxonomy = getTaxonomyBySpecKey(specKey);
      if (taxonomy && Array.isArray(taxonomy.units)) supported.push(specKey);
    } catch {
      // skip if taxonomy not loaded for this spec
    }
  }
  if (supported.length > 0) return supported;
  // Fallback: known keys from topicTaxonomy getTaxonomyBySpecKey
  return [
    "aqa-gcse-biology",
    "aqa-gcse-chemistry",
    "aqa-gcse-physics",
    "aqa-gcse-maths-foundation",
    "aqa-gcse-maths-higher",
    "aqa-l2-further-maths",
    "aqa-gcse-english-literature",
    "aqa-gcse-english-language",
  ].filter((k) => getTaxonomyBySpecKey(k));
}

function printAvailableSpecKeys() {
  const list = getAvailableSpecKeys();
  console.error("Available specKeys:");
  list.forEach((k) => console.error("  -", k));
}

async function main() {
  const args = process.argv.slice(2);
  const specIndex = args.indexOf("--spec");
  const allIndex = args.indexOf("--all");

  if (allIndex !== -1) {
    const specKeys = getAvailableSpecKeys();
    if (specKeys.length === 0) {
      console.error("No specs found in config or taxonomy.");
      process.exit(1);
    }
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error("MONGO_URI is required. Set it in backend/.env");
      process.exit(1);
    }
    await mongoose.connect(MONGO_URI);
    try {
      for (const specKey of specKeys) {
        console.log(`Auditing ${specKey}...`);
        await runQuestionBankAuditAndWrite({ specKey, outDir: DOCS_DIR, publicDocsDir: PUBLIC_DOCS_DIR });
        const safe = safeSpecKeyForFilename(specKey);
        console.log(`  Wrote docs/QUESTION_BANK_AUDIT_${safe}.md`);
        console.log(`  Wrote docs/SPRINT_ORDER_${safe}.md`);
      }
      console.log("All specs audited.");
    } finally {
      await mongoose.disconnect();
    }
    return;
  }

  if (specIndex !== -1 && args[specIndex + 1]) {
    const specKey = args[specIndex + 1];
    const taxonomy = getTaxonomyBySpecKey(specKey);
    if (!taxonomy || !Array.isArray(taxonomy.units)) {
      console.error(`Invalid specKey: ${specKey}`);
      printAvailableSpecKeys();
      process.exit(1);
    }
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error("MONGO_URI is required. Set it in backend/.env");
      process.exit(1);
    }
    await mongoose.connect(MONGO_URI);
    try {
      await runQuestionBankAuditAndWrite({ specKey, outDir: DOCS_DIR, publicDocsDir: PUBLIC_DOCS_DIR });
      const safe = safeSpecKeyForFilename(specKey);
      console.log(`Wrote docs/QUESTION_BANK_AUDIT_${safe}.md`);
      console.log(`Wrote docs/SPRINT_ORDER_${safe}.md`);
    } finally {
      await mongoose.disconnect();
    }
    return;
  }

  console.error("Usage:");
  console.error("  node scripts/auditQuestionBanks.js --spec <specKey>");
  console.error("  node scripts/auditQuestionBanks.js --all");
  console.error("");
  printAvailableSpecKeys();
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
