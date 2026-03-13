/**
 * PR-037: AI Study Coach — coverage-aware learning suggestions.
 * No new LLM calls. Uses CoverageSnapshot + EnquiryLog + TopicSummary data.
 */
const CoverageSnapshot = require("../../models/CoverageSnapshot");
const Lesson = require("../../models/Lesson");
const { normalizeSpecKey } = require("../../config/featureFlags");

/**
 * Find best published lesson for a topicKey (prefer newest).
 * @param {string} topicKey
 * @returns {Promise<{ _id: string } | null>}
 */
async function findBestLessonForTopicKey(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return null;
  const tk = String(topicKey).trim();
  if (!tk) return null;
  const lesson = await Lesson.findOne({
    topicKey: tk,
    $or: [{ isPublished: true }, { status: "published" }],
  })
    .select("_id")
    .sort({ updatedAt: -1 })
    .limit(1)
    .lean();
  return lesson;
}

function topicKeyToTitle(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return "Topic";
  const last = String(topicKey).split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;
}

function statusToBadge(status) {
  if (status === "NO_SPEC" || status === "EMPTY") return "Missing";
  if (status === "THIN") return "Thin";
  if (status === "OK" || status === "STRONG") return "Strong";
  return status || "—";
}

/**
 * Build reason text for a suggestion.
 */
function buildReason(row, isCurrentTopic, confidenceLevel, warnings) {
  const weakConfidence = confidenceLevel === "weak";
  const hasWeakWarning =
    Array.isArray(warnings) &&
    warnings.some((w) => typeof w === "string" && w.toLowerCase().includes("insufficient trusted sources"));

  if (isCurrentTopic) {
    if (row.status === "THIN") {
      return "Coverage for this topic is still thin, so revising it now will help.";
    }
    if (row.status === "EMPTY" || row.status === "NO_SPEC") {
      return "This topic has little or no course content yet.";
    }
    if (weakConfidence || hasWeakWarning) {
      return "Your question touched an area with limited trusted sources.";
    }
  }

  if ((row.enquiriesWeakEvidence || 0) > 0) {
    return "Students often struggle with this topic.";
  }
  if (row.status === "THIN") {
    return "Coverage for this topic is still thin, so revising it now will help.";
  }
  if (row.status === "EMPTY" || row.status === "NO_SPEC") {
    return "This topic has little or no course content yet.";
  }
  if ((row.demandScore || 0) >= 60) {
    return "High demand topic — worth revising.";
  }
  return "Consider revising this topic.";
}

/**
 * Compute priority for sorting (lower = higher priority).
 * EMPTY/NO_SPEC > THIN > weakEnquiries > high demand > OK
 */
function computePriority(row, isCurrentTopic) {
  let p = 100;
  if (row.status === "NO_SPEC" || row.status === "EMPTY") p = 0;
  else if (row.status === "THIN") p = 10;
  else if (row.status === "OK") p = 40;
  else if (row.status === "STRONG") p = 50;

  if (isCurrentTopic && (row.status === "THIN" || row.status === "EMPTY" || row.status === "NO_SPEC")) {
    p -= 5;
  }
  if ((row.enquiriesWeakEvidence || 0) > 0) p -= 15;
  if ((row.demandScore || 0) >= 60) p -= 5;
  return p;
}

/**
 * Build actions for a suggestion.
 */
async function buildActions(topicKey, specKey, lessonId) {
  const actions = [];
  const enc = encodeURIComponent(topicKey);

  if (lessonId) {
    const lid = String(lessonId);
    actions.push({
      id: "view-lesson",
      label: "View lesson",
      href: `/lesson/${lid}`,
    });
    actions.push({
      id: "summarise",
      label: "Summarise topic",
      href: `/lesson/${lid}?openTopicSummary=1`,
    });
    actions.push({
      id: "practice",
      label: "Practice",
      href: `/lesson/${lid}#check-understanding`,
    });
    actions.push({
      id: "flashcards",
      label: "Flashcards",
      href: `/lesson/${lid}`,
    });
  } else {
    actions.push({
      id: "view-lesson",
      label: "View lesson",
      href: `/browse-lessons?topicKey=${enc}`,
    });
    actions.push({
      id: "practice",
      label: "Practice",
      href: `/browse-lessons?topicKey=${enc}`,
    });
  }

  return actions.slice(0, 3);
}

/**
 * PR-037: Build learning suggestions for students.
 * @param {{
 *   specKey: string,
 *   topicKey?: string | null,
 *   role: string,
 *   confidenceLevel?: string,
 *   warnings?: string[],
 *   coverageSnapshot?: object,
 *   limit?: number
 * }} opts
 * @returns {Promise<Array<{
 *   topicKey: string,
 *   status: string,
 *   reason: string,
 *   priority: number,
 *   actions: Array<{ id: string, label: string, href: string }>
 * }>>}
 */
async function buildLearningSuggestions(opts) {
  const specKey = (opts?.specKey || "").trim();
  const topicKey = opts?.topicKey ? String(opts.topicKey).trim() : null;
  const role = (opts?.role || "").toString().toLowerCase();
  const confidenceLevel = (opts?.confidenceLevel || "").toString().toLowerCase();
  const warnings = opts?.warnings || [];
  const limit = Math.min(5, Math.max(1, parseInt(opts?.limit, 10) || 3));

  if (role !== "student") return [];

  const normalized = normalizeSpecKey(specKey);
  if (!normalized) return [];

  const latestDoc = await CoverageSnapshot.findOne({ specKey: normalized })
    .sort({ computedAt: -1 })
    .lean();
  if (!latestDoc) return [];

  const rows = await CoverageSnapshot.find({
    specKey: normalized,
    computedAt: latestDoc.computedAt,
  })
    .sort({ topicKey: 1 })
    .lean();

  if (rows.length === 0) return [];

  const currentRow = topicKey ? rows.find((r) => String(r.topicKey).trim() === topicKey) : null;
  const candidates = [];

  if (currentRow && ["THIN", "EMPTY", "NO_SPEC"].includes(currentRow.status)) {
    candidates.push({
      row: currentRow,
      isCurrentTopic: true,
    });
  }

  const excludeTopic = topicKey ? new Set([topicKey]) : new Set();
  const related = rows
    .filter((r) => !excludeTopic.has(String(r.topicKey).trim()))
    .map((r) => ({
      row: r,
      isCurrentTopic: false,
    }))
    .sort((a, b) => {
      const pa = computePriority(a.row, a.isCurrentTopic);
      const pb = computePriority(b.row, b.isCurrentTopic);
      if (pa !== pb) return pa - pb;
      const da = (a.row.demandScore || 0) - (a.row.enquiriesWeakEvidence || 0) * 10;
      const db = (b.row.demandScore || 0) - (b.row.enquiriesWeakEvidence || 0) * 10;
      return db - da;
    })
    .slice(0, 2);

  for (const c of related) {
    if (candidates.length >= limit) break;
    candidates.push(c);
  }

  const results = [];
  for (const { row, isCurrentTopic } of candidates) {
    const tk = String(row.topicKey).trim();
    const lesson = await findBestLessonForTopicKey(tk);
    const lessonId = lesson?._id ? String(lesson._id) : null;
    const actions = await buildActions(tk, normalized, lessonId);

    results.push({
      topicKey: tk,
      status: row.status,
      reason: buildReason(row, isCurrentTopic, confidenceLevel, warnings),
      priority: computePriority(row, isCurrentTopic),
      actions,
    });
  }

  return results.sort((a, b) => a.priority - b.priority).slice(0, limit);
}

module.exports = {
  buildLearningSuggestions,
  findBestLessonForTopicKey,
  topicKeyToTitle,
  statusToBadge,
};
