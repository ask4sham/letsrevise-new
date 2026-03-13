/**
 * Build create-lesson-options from backend/config/*_topics.json.
 * Single source of truth for Subject → Spec → Main Topic → Sub-topic dropdowns.
 * Merged with admin taxonomy additions.
 */
const fs = require("fs");
const path = require("path");
const { getMergedTaxonomyBySpecKey } = require("./adminTaxonomyService");

const CONFIG_DIR = path.join(__dirname, "..", "config");

const SPEC_KEYS = [
  "aqa-gcse-biology",
  "aqa-gcse-chemistry",
  "aqa-gcse-physics",
  "aqa-gcse-maths-foundation",
  "aqa-gcse-maths-higher",
  "aqa-l2-further-maths",
  "aqa-gcse-english-literature",
  "aqa-gcse-english-language",
];

function specKeyFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const withoutSuffix = base.replace(/_topics$/, "");
  return withoutSuffix.replace(/_/g, "-").toLowerCase();
}

function getTopicFiles() {
  if (!fs.existsSync(CONFIG_DIR)) return [];
  return fs
    .readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith("_topics.json"))
    .sort()
    .map((f) => path.join(CONFIG_DIR, f));
}

function specLabel(data, specKey) {
  const examBoard = (data.examBoard && data.examBoard.trim()) || "AQA";
  const level = (data.level && data.level.trim()) || "GCSE";
  const subject = (data.subject && data.subject.trim()) || specKey;
  return `${examBoard} ${level} ${subject}`.trim();
}

/**
 * Returns create-lesson-options shape:
 * { subjects: [ { subject, specs: [ { specKey, specLabel, mainTopics: [ { title, subTopics: [ { title, topicSlug, topicKey, path } ] } ] } ] } ] }
 */
function getCreateLessonOptions() {
  const files = getTopicFiles();
  const bySubject = new Map();

  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {
      console.warn(`[taxonomyService] Skip invalid JSON: ${path.basename(filePath)}`, e.message);
      continue;
    }

    const specKey =
      typeof data.specKey === "string" && data.specKey.trim()
        ? data.specKey.trim()
        : specKeyFromFilename(filePath);
    const subject =
      typeof data.subject === "string" && data.subject.trim() ? data.subject.trim() : "Unknown";
    const label = specLabel(data, specKey);

    const mainTopics = [];
    const units = Array.isArray(data.units) ? data.units : [];

    for (const unit of units) {
      const mainTitle =
        typeof unit.unit === "string" && unit.unit.trim() ? unit.unit.trim() : null;
      const topics = Array.isArray(unit.topics) ? unit.topics : [];
      const subTopics = [];

      for (const t of topics) {
        const leafTitle = typeof t.topic === "string" && t.topic.trim() ? t.topic.trim() : null;
        const topicSlug = typeof t.key === "string" && t.key.trim() ? t.key.trim() : null;
        if (!leafTitle || !topicSlug) continue;
        subTopics.push({
          title: leafTitle,
          topicSlug,
          topicKey: `${specKey}:${topicSlug}`,
          path: mainTitle ? `${mainTitle} > ${leafTitle}` : leafTitle,
        });
      }

      if (mainTitle) {
        mainTopics.push({ title: mainTitle, subTopics });
      }
    }

    const spec = { specKey, specLabel: label, mainTopics };
    if (!bySubject.has(subject)) {
      bySubject.set(subject, { subject, specs: [] });
    }
    bySubject.get(subject).specs.push(spec);
  }

  const subjects = Array.from(bySubject.values());
  return { subjects };
}

/**
 * Async: create-lesson-options merged with admin taxonomy additions.
 */
async function getCreateLessonOptionsMerged() {
  const bySubject = new Map();

  for (const specKey of SPEC_KEYS) {
    const taxonomy = await getMergedTaxonomyBySpecKey(specKey);
    if (!taxonomy) continue;

    const subject = taxonomy.subject || "Unknown";
    const label = specLabel(taxonomy, specKey);
    const mainTopics = [];

    for (const unit of taxonomy.units || []) {
      const mainTitle = (unit.unit && String(unit.unit).trim()) || null;
      const subTopics = [];

      for (const t of unit.topics || []) {
        const leafTitle = (t.topic && String(t.topic).trim()) || null;
        const topicSlug = (t.key && String(t.key).trim()) || null;
        if (!leafTitle || !topicSlug) continue;
        const spec = taxonomy.specKey || specKey;
        subTopics.push({
          title: leafTitle,
          topicSlug,
          topicKey: t.topicKey || `${spec}:${topicSlug}`,
          path: mainTitle ? `${mainTitle} > ${leafTitle}` : leafTitle,
        });
      }

      if (mainTitle) mainTopics.push({ title: mainTitle, subTopics });
    }

    const spec = { specKey, specLabel: label, mainTopics };
    if (!bySubject.has(subject)) bySubject.set(subject, { subject, specs: [] });
    bySubject.get(subject).specs.push(spec);
  }

  return { subjects: Array.from(bySubject.values()) };
}

module.exports = { getCreateLessonOptions, getCreateLessonOptionsMerged, getTopicFiles, specKeyFromFilename };
