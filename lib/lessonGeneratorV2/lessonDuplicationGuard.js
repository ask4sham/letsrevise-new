/**
 * Duplication guard — detect repeated questions / concepts with identical wording.
 */

const COGNITIVE_VARIANTS = ["define", "identify", "explain", "compare", "apply", "evaluate"];

function normalizeText(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQuestionText(block) {
  if (!block || typeof block !== "object") return "";
  return normalizeText(
    block.question ||
      block.checkpointQuestion ||
      block.content ||
      block.text ||
      block.title ||
      ""
  );
}

/**
 * @param {Array<{ type?: string, content?: string, question?: string, title?: string }>} blocks
 */
function scanLessonDuplication(blocks) {
  const issues = [];
  const seenExact = new Map();
  const seenConceptQuestion = new Map();

  blocks.forEach((block, index) => {
    const type = String(block.type || "").toLowerCase();
    const q = extractQuestionText(block);
    if (!q || q.length < 12) return;

    if (seenExact.has(q)) {
      issues.push({
        kind: "duplicate_question",
        blockIndex: index,
        duplicateOf: seenExact.get(q),
        suggestion: "rewrite_with_different_cognitive_demand",
        variant: COGNITIVE_VARIANTS[(issues.length + 1) % COGNITIVE_VARIANTS.length],
      });
    } else {
      seenExact.set(q, index);
    }

    const conceptKey = inferConceptKey(block);
    if (conceptKey) {
      const prev = seenConceptQuestion.get(conceptKey);
      if (prev && similarity(prev.text, q) > 0.85) {
        issues.push({
          kind: "duplicate_concept_wording",
          conceptKey,
          blockIndex: index,
          duplicateOf: prev.index,
          suggestion: "remove_or_rewrite",
        });
      } else {
        seenConceptQuestion.set(conceptKey, { index, text: q });
      }
    }
  });

  return {
    duplicateCount: issues.length,
    issues,
    clean: issues.length === 0,
  };
}

function inferConceptKey(block) {
  const hay = normalizeText(
    [block.title, block.content, block.question, block.topic, block.conceptId].filter(Boolean).join(" ")
  );
  if (hay.includes("oxygen debt")) return "oxygen_debt";
  if (hay.includes("atp")) return "atp";
  if (hay.includes("anaerobic")) return "anaerobic_respiration";
  if (hay.includes("aerobic")) return "aerobic_respiration";
  if (hay.includes("starch")) return "starch_storage";
  if (hay.includes("limiting factor")) return "limiting_factor";
  return "";
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wa = new Set(a.split(" "));
  const wb = new Set(b.split(" "));
  let inter = 0;
  for (const w of wa) {
    if (wb.has(w)) inter++;
  }
  const union = wa.size + wb.size - inter;
  return union ? inter / union : 0;
}

/**
 * @param {object[]} issues
 * @param {object[]} blocks
 * @returns {object[]}
 */
function applyDuplicationFixes(issues, blocks) {
  const out = blocks.slice();
  const removeIdx = new Set();
  for (const issue of issues) {
    if (issue.suggestion === "remove_or_rewrite" && issue.blockIndex != null) {
      removeIdx.add(issue.blockIndex);
    }
  }
  return out.filter((_, i) => !removeIdx.has(i));
}

module.exports = {
  COGNITIVE_VARIANTS,
  scanLessonDuplication,
  applyDuplicationFixes,
};
