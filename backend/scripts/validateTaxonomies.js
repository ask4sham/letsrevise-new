/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

/**
 * Taxonomy Guardrails Validator
 * - Validates all backend/config/*_topics.json files
 * - Enforces schema + key uniqueness + slug rules
 * - Ensures specKey matches filename prefix
 *
 * Run:
 *   node backend/scripts/validateTaxonomies.js
 */

const CONFIG_DIR = path.join(__dirname, "..", "config");

// Strict-ish slug rule (allow digits; allow plus for cases like 2027+; allow apostrophe removed in keys already)
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SPEC_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(errors) {
  console.error("\n❌ Taxonomy validation failed:\n");
  for (const e of errors) console.error(`- ${e}`);
  console.error("");
  process.exit(1);
}

function getTopicFiles() {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs
    .readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith("_topics.json"))
    .map((f) => path.join(CONFIG_DIR, f));
}

function readJson(filePath, errors) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    errors.push(`${path.relative(process.cwd(), filePath)}: invalid JSON (${e.message})`);
    return null;
  }
}

function assertString(obj, field, fileLabel, errors) {
  if (typeof obj[field] !== "string" || obj[field].trim() === "") {
    errors.push(`${fileLabel}: missing/invalid "${field}" (must be non-empty string)`);
    return false;
  }
  return true;
}

function assertBool(obj, field, fileLabel, errors) {
  if (typeof obj[field] !== "boolean") {
    errors.push(`${fileLabel}: missing/invalid "${field}" (must be boolean)`);
    return false;
  }
  return true;
}

function assertArray(obj, field, fileLabel, errors) {
  if (!Array.isArray(obj[field])) {
    errors.push(`${fileLabel}: missing/invalid "${field}" (must be array)`);
    return false;
  }
  return true;
}

function validateTaxonomyFile(filePath, taxonomy, errors) {
  const fileLabel = path.relative(process.cwd(), filePath);

  if (!taxonomy || typeof taxonomy !== "object") {
    errors.push(`${fileLabel}: file does not contain an object`);
    return;
  }

  // Top-level required fields
  const okSubject = assertString(taxonomy, "subject", fileLabel, errors);
  const okExamBoard = assertString(taxonomy, "examBoard", fileLabel, errors);
  const okLevel = assertString(taxonomy, "level", fileLabel, errors);
  const okSpecKey = assertString(taxonomy, "specKey", fileLabel, errors);
  const okTier = assertArray(taxonomy, "tier", fileLabel, errors);
  const okUnits = assertArray(taxonomy, "units", fileLabel, errors);

  if (okSpecKey) {
    if (!SPEC_KEY_RE.test(taxonomy.specKey)) {
      errors.push(`${fileLabel}: specKey "${taxonomy.specKey}" must be lowercase hyphenated`);
    }

    // Optional: enforce filename begins with specKey
    const base = path.basename(filePath);
    if (!base.startsWith(taxonomy.specKey.replace(/-/g, "_")) && !base.startsWith(taxonomy.specKey)) {
      // Not hard-failing because your existing naming may differ. Warn-only by default.
      // If you want strict enforcement, change this to errors.push(...)
      console.warn(`⚠️  ${fileLabel}: filename does not appear to match specKey (${taxonomy.specKey}).`);
    }
  }

  if (!okUnits) return;

  const unitKeySet = new Set();
  const topicKeySet = new Set();

  taxonomy.units.forEach((unit, unitIdx) => {
    const unitPath = `${fileLabel}:units[${unitIdx}]`;

    if (typeof unit !== "object" || unit === null) {
      errors.push(`${unitPath}: unit must be an object`);
      return;
    }

    const okUnitName = assertString(unit, "unit", unitPath, errors);
    const okUnitKey = assertString(unit, "key", unitPath, errors);
    const okTopics = assertArray(unit, "topics", unitPath, errors);

    if (okUnitKey) {
      if (!SLUG_RE.test(unit.key)) {
        errors.push(`${unitPath}: unit.key "${unit.key}" must be lowercase hyphenated`);
      }
      if (unitKeySet.has(unit.key)) {
        errors.push(`${unitPath}: duplicate unit.key "${unit.key}" within spec`);
      }
      unitKeySet.add(unit.key);
    }

    if (!okTopics) return;

    unit.topics.forEach((topic, topicIdx) => {
      const topicPath = `${unitPath}:topics[${topicIdx}]`;

      if (typeof topic !== "object" || topic === null) {
        errors.push(`${topicPath}: topic must be an object`);
        return;
      }

      const okTopicName = assertString(topic, "topic", topicPath, errors);
      const okTopicKey = assertString(topic, "key", topicPath, errors);
      const okTopicTier = assertArray(topic, "tier", topicPath, errors);
      const okRequired = assertBool(topic, "requiredPractical", topicPath, errors);

      if (okTopicKey) {
        // Special case: allow keys with "plus" already slugged as "-plus-" (we recommend that)
        // Therefore keep strict slug rule.
        if (!SLUG_RE.test(topic.key)) {
          errors.push(`${topicPath}: topic.key "${topic.key}" must be lowercase hyphenated`);
        }
        if (topicKeySet.has(topic.key)) {
          errors.push(`${topicPath}: duplicate topic.key "${topic.key}" within spec (collision risk)`);
        }
        topicKeySet.add(topic.key);
      }

      if (okTopicTier) {
        // tier must be array of strings (can be empty)
        for (const t of topic.tier) {
          if (typeof t !== "string") {
            errors.push(`${topicPath}: tier entries must be strings`);
            break;
          }
        }
      }

      // Extra: prevent accidental inclusion of namespaced stored keys inside taxonomy
      if (okTopicKey && taxonomy.specKey && topic.key.includes(":")) {
        errors.push(`${topicPath}: topic.key must NOT contain ":" (namespacing happens at storage time)`);
      }

      // okTopicName & okUnitName are just to trigger missing field errors
      void okTopicName;
      void okUnitName;
      void okRequired;
    });
  });
}

function main() {
  const files = getTopicFiles();
  const errors = [];

  if (files.length === 0) {
    console.warn("⚠️  No *_topics.json files found in backend/config. Nothing to validate.");
    process.exit(0);
  }

  for (const filePath of files) {
    const taxonomy = readJson(filePath, errors);
    if (!taxonomy) continue;
    validateTaxonomyFile(filePath, taxonomy, errors);
  }

  if (errors.length) fail(errors);

  console.log(`✅ Taxonomy validation passed (${files.length} files).`);
}

main();
