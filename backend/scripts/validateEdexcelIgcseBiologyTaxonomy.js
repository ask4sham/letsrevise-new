/* eslint-disable no-console */
/**
 * Validate edexcel_igcse_biology_topics.json (3-level: main topic → section → topic).
 * Not wired into npm scripts — run manually:
 *   node backend/scripts/validateEdexcelIgcseBiologyTaxonomy.js
 */
const fs = require("fs");
const path = require("path");

const SPEC_KEY = "edexcel-igcse-biology";
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(errors) {
  console.error("\n❌ Edexcel IGCSE Biology taxonomy validation failed:\n");
  for (const e of errors) console.error(`- ${e}`);
  console.error("");
  process.exit(1);
}

function main() {
  const filePath = path.join(__dirname, "..", "config", "edexcel_igcse_biology_topics.json");
  const errors = [];
  let taxonomy;

  try {
    taxonomy = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    fail([`${filePath}: invalid JSON (${e.message})`]);
    return;
  }

  if (taxonomy.specKey !== SPEC_KEY) {
    errors.push(`specKey must be "${SPEC_KEY}" (got "${taxonomy.specKey}")`);
  }
  if (taxonomy.displayName !== "Edexcel IGCSE Biology") {
    errors.push(`displayName must be "Edexcel IGCSE Biology" (got "${taxonomy.displayName}")`);
  }
  if (taxonomy.examBoard !== "Edexcel" || taxonomy.level !== "IGCSE" || taxonomy.subject !== "Biology") {
    errors.push("subject/examBoard/level must be Biology / Edexcel / IGCSE");
  }
  if (!Array.isArray(taxonomy.units) || taxonomy.units.length === 0) {
    errors.push("units must be a non-empty array");
  }

  const topicKeySet = new Set();

  for (const [ui, unit] of (taxonomy.units || []).entries()) {
    const unitPath = `units[${ui}]`;
    if (!unit.unit || !unit.key) errors.push(`${unitPath}: missing unit or key`);
    if (unit.mainTopic !== unit.unit) {
      errors.push(`${unitPath}: mainTopic must match unit title`);
    }
    if (unit.key && !SLUG_RE.test(unit.key)) {
      errors.push(`${unitPath}: invalid unit.key "${unit.key}"`);
    }
    if (!Array.isArray(unit.sections) || unit.sections.length === 0) {
      errors.push(`${unitPath}: sections must be a non-empty array`);
    }
    if (!Array.isArray(unit.topics)) {
      errors.push(`${unitPath}: topics must be an array (use [] when using sections)`);
    }

    for (const [si, section] of (unit.sections || []).entries()) {
      const secPath = `${unitPath}.sections[${si}]`;
      if (!section.title || !section.slug) errors.push(`${secPath}: missing title or slug`);
      if (section.slug && !SLUG_RE.test(section.slug)) {
        errors.push(`${secPath}: invalid section slug "${section.slug}"`);
      }
      if (!Array.isArray(section.topics) || section.topics.length === 0) {
        errors.push(`${secPath}: topics must be a non-empty array`);
      }

      for (const [ti, topic] of (section.topics || []).entries()) {
        const tPath = `${secPath}.topics[${ti}]`;
        if (!topic.topic || !topic.key) errors.push(`${tPath}: missing topic title or key`);
        if (topic.mainTopic !== unit.mainTopic) {
          errors.push(`${tPath}: mainTopic must match parent unit.mainTopic`);
        }
        if (topic.section !== section.title) {
          errors.push(`${tPath}: section must match parent section.title`);
        }
        if (topic.topicKey !== `${SPEC_KEY}:${topic.key}`) {
          errors.push(`${tPath}: topicKey must be "${SPEC_KEY}:${topic.key}"`);
        }
        if (topic.key && !SLUG_RE.test(topic.key)) {
          errors.push(`${tPath}: invalid topic.key "${topic.key}"`);
        }
        if (topic.key && topic.key.includes(":")) {
          errors.push(`${tPath}: topic.key must not contain ":"`);
        }
        if (typeof topic.requiredPractical !== "boolean") {
          errors.push(`${tPath}: requiredPractical must be boolean`);
        }
        if (topicKeySet.has(topic.key)) {
          errors.push(`${tPath}: duplicate topic.key "${topic.key}"`);
        }
        topicKeySet.add(topic.key);
      }
    }
  }

  if (errors.length) fail(errors);

  const mainTopics = taxonomy.units.length;
  const sections = taxonomy.units.reduce((n, u) => n + (u.sections || []).length, 0);
  const topics = taxonomy.units.reduce(
    (n, u) => n + (u.sections || []).reduce((m, s) => m + (s.topics || []).length, 0),
    0
  );

  console.log("✅ Edexcel IGCSE Biology taxonomy validation passed.");
  console.log(`   Main topics: ${mainTopics}`);
  console.log(`   Sections: ${sections}`);
  console.log(`   Lesson topics: ${topics}`);
}

main();
