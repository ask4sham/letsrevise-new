/**
 * Legacy ExamQuestion topicKey / identity repair helpers (canonical spec:slug).
 * Used by scripts only — does not loosen publish/API validation rules.
 */
const { parseTopicKey, buildTopicKey } = require("./topicKey");
const { normalizeSpecKey } = require("../config/featureFlags");
const { getTaxonomyBySpecKey, topicDisplayToCanonicalKey } = require("./topicTaxonomy");
const { isValidTopicSlugForSpec } = require("./specTopicRegistry");

/** Spec keys with bundled static taxonomies (same order as topicTaxonomy). */
const KNOWN_SPECS = [
  "aqa-gcse-biology",
  "aqa-gcse-chemistry",
  "aqa-gcse-physics",
  "aqa-gcse-maths-foundation",
  "aqa-gcse-maths-higher",
  "aqa-l2-further-maths",
  "aqa-gcse-english-literature",
  "aqa-gcse-english-language",
];

/**
 * Infer a single specKey from ExamQuestion subject/level when unambiguous.
 * @returns {string|null}
 */
function inferSpecFromExamRow(row) {
  const sub = (row.subject || "").trim().toLowerCase();
  const level = (row.level || "").trim().toLowerCase();
  if (!sub) return null;
  if (sub === "biology") return "aqa-gcse-biology";
  if (sub === "chemistry") return "aqa-gcse-chemistry";
  if (sub === "physics") return "aqa-gcse-physics";
  if (sub === "maths" || sub === "mathematics") {
    if (level.includes("higher")) return "aqa-gcse-maths-higher";
    if (level.includes("foundation")) return "aqa-gcse-maths-foundation";
    return null;
  }
  if (/further/.test(sub) && /math/.test(sub)) return "aqa-l2-further-maths";
  if (sub.includes("english") && sub.includes("literature")) return "aqa-gcse-english-literature";
  if (sub.includes("english") && sub.includes("language") && !sub.includes("literature")) {
    return "aqa-gcse-english-language";
  }
  return null;
}

/**
 * If display string matches exactly one topic label across all known specs, return { specKey, slug }.
 * @returns {{ specKey: string, slug: string } | null}
 */
function findUniqueTopicLabelAcrossSpecs(displayName) {
  const norm = String(displayName || "").trim().toLowerCase();
  if (!norm) return null;
  const matches = [];
  for (const specKey of KNOWN_SPECS) {
    const taxonomy = getTaxonomyBySpecKey(specKey);
    if (!taxonomy || !Array.isArray(taxonomy.units)) continue;
    for (const u of taxonomy.units) {
      for (const t of u.topics || []) {
        if (t.topic && String(t.topic).trim().toLowerCase() === norm && t.key) {
          matches.push({ specKey, slug: String(t.key).trim() });
        }
      }
    }
  }
  if (matches.length !== 1) return null;
  return matches[0];
}

/**
 * List specs where slug is valid (static + admin registry).
 * @returns {string[]}
 */
function specsWhereSlugValid(slug) {
  const k = String(slug || "").trim().toLowerCase();
  if (!k) return [];
  const out = [];
  for (const specKey of KNOWN_SPECS) {
    if (isValidTopicSlugForSpec(specKey, k)) out.push(specKey);
  }
  return out;
}

/**
 * Classify a row for reporting (no DB writes).
 * @returns {string}
 */
function classifyExamQuestionRow(row) {
  const tk = row.topicKey != null ? String(row.topicKey).trim() : "";
  const topicLabel = row.topic != null ? String(row.topic).trim() : "";
  if (!tk) {
    if (topicLabel) return "missing_topicKey_with_label";
    return "missing_topicKey";
  }
  const parsed = parseTopicKey(tk);
  if (!parsed.isNamespaced) {
    return "slug_only_topicKey";
  }
  const specNorm = normalizeSpecKey(parsed.specKey || "");
  const slug = (parsed.topicKey || "").trim().toLowerCase();
  if (!slug) return "invalid_empty_slug_after_namespace";
  if (!isValidTopicSlugForSpec(specNorm, slug)) {
    const inferred = inferSpecFromExamRow(row);
    if (inferred && isValidTopicSlugForSpec(inferred, slug)) {
      return "namespaced_wrong_spec_prefix_repairable";
    }
    return "namespaced_invalid_slug_for_prefix";
  }
  const inferred = inferSpecFromExamRow(row);
  if (inferred && specNorm && inferred !== specNorm && isValidTopicSlugForSpec(inferred, slug)) {
    return "namespaced_spec_subject_mismatch_repairable";
  }
  return "ok_or_unknown";
}

/**
 * Propose a canonical topicKey repair (metadata only). Returns null if ambiguous or unsafe.
 * Requires specTopicRegistry cache refreshed when using admin sub-topics.
 * @param {object} row - lean ExamQuestion-like { topicKey, topic, subject, level }
 * @returns {{ nextTopicKey: string, rule: string } | null}
 */
function proposeExamQuestionTopicKeyRepair(row) {
  const current = row.topicKey != null ? String(row.topicKey).trim() : "";
  const topicLabel = row.topic != null ? String(row.topic).trim() : "";
  const inferred = inferSpecFromExamRow(row);

  // 1) Missing topicKey — label-only unique match
  if (!current) {
    if (topicLabel) {
      const unique = findUniqueTopicLabelAcrossSpecs(topicLabel);
      if (unique && isValidTopicSlugForSpec(unique.specKey, unique.slug)) {
        return { nextTopicKey: buildTopicKey(unique.specKey, unique.slug), rule: "label_unique_across_taxonomies" };
      }
      if (inferred) {
        const slug = topicDisplayToCanonicalKey(topicLabel, inferred);
        if (slug && isValidTopicSlugForSpec(inferred, slug)) {
          return { nextTopicKey: buildTopicKey(inferred, slug), rule: "topic_display_to_canonical_under_inferred_spec" };
        }
      }
    }
    return null;
  }

  const parsed = parseTopicKey(current);
  const slug = (parsed.topicKey || "").trim().toLowerCase();

  // 2) Slug-only: namespace using inferred subject or single-spec slug match
  if (!parsed.isNamespaced) {
    if (!slug) return null;
    if (inferred && isValidTopicSlugForSpec(inferred, slug)) {
      return { nextTopicKey: buildTopicKey(inferred, slug), rule: "slug_only_plus_inferred_spec" };
    }
    const specs = specsWhereSlugValid(slug);
    if (specs.length === 1) {
      return { nextTopicKey: buildTopicKey(specs[0], slug), rule: "slug_only_unique_spec_for_slug" };
    }
    return null;
  }

  const specNorm = normalizeSpecKey(parsed.specKey || "");

  // 3) Namespaced: prefix invalid for slug — try inferred spec
  if (!isValidTopicSlugForSpec(specNorm, slug)) {
    if (inferred && isValidTopicSlugForSpec(inferred, slug)) {
      return { nextTopicKey: buildTopicKey(inferred, slug), rule: "wrong_prefix_inferred_spec_fixes_slug" };
    }
    const specs = specsWhereSlugValid(slug);
    if (specs.length === 1) {
      return { nextTopicKey: buildTopicKey(specs[0], slug), rule: "wrong_prefix_unique_spec_for_slug" };
    }
    return null;
  }

  // 4) Namespaced: slug valid under prefix but subject implies a different spec — align only if slug is NOT valid under current prefix (handled above) OR current prefix invalid for subject while inferred matches — if slug is valid under BOTH specs, do not guess
  if (inferred && inferred !== specNorm && isValidTopicSlugForSpec(inferred, slug) && isValidTopicSlugForSpec(specNorm, slug)) {
    return null;
  }

  return null;
}

module.exports = {
  KNOWN_SPECS,
  inferSpecFromExamRow,
  findUniqueTopicLabelAcrossSpecs,
  specsWhereSlugValid,
  classifyExamQuestionRow,
  proposeExamQuestionTopicKeyRepair,
};
