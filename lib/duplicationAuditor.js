/**
 * Duplication auditor — semantic + exact duplicate detection across block types.
 */

const { scanLessonDuplication } = require("./lessonGeneratorV2/lessonDuplicationGuard");
const { flattenPagesToBlocks, normalizeText, blockHaystack } = require("./lessonBlockAnalysis");

const CONCEPT_PATTERNS = [
  ["atp", "ATP"],
  ["oxygen debt", "oxygen_debt"],
  ["anaerobic", "anaerobic_respiration"],
  ["aerobic", "aerobic_respiration"],
  ["metabolism", "metabolism"],
  ["catabolism", "catabolism"],
  ["anabolism", "anabolism"],
  ["starch", "starch_storage"],
  ["nitrate", "nitrate_ions"],
  ["limiting factor", "limiting_factor"],
  ["graph interpretation", "graph_interpretation"],
  ["plant defence", "defence_types"],
];

function extractMeaningText(block) {
  return normalizeText(
    block.question ||
      block.checkpointQuestion ||
      block.content ||
      block.text ||
      block.title ||
      ""
  );
}

function inferDuplicateConcept(block) {
  const hay = blockHaystack(block);
  for (const [needle, id] of CONCEPT_PATTERNS) {
    if (hay.includes(needle)) return id;
  }
  return null;
}

function jaccard(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const wa = new Set(a.split(" ").filter((w) => w.length > 2));
  const wb = new Set(b.split(" ").filter((w) => w.length > 2));
  let inter = 0;
  for (const w of wa) {
    if (wb.has(w)) inter++;
  }
  const union = wa.size + wb.size - inter;
  return union ? inter / union : 0;
}

/**
 * @param {object[]} pages
 */
function auditDuplication(pages) {
  const blocks = flattenPagesToBlocks(pages);
  const exactScan = scanLessonDuplication(blocks);
  const flags = [];
  const byConcept = Object.create(null);

  blocks.forEach((block, index) => {
    const type = String(block.type || "").toLowerCase();
    const meaning = extractMeaningText(block);
    if (meaning.length < 10) return;

    const concept = inferDuplicateConcept(block);
    if (!concept) return;

    if (!byConcept[concept]) {
      byConcept[concept] = [];
    }
    byConcept[concept].push({ index, type, meaning, block });
  });

  for (const [concept, entries] of Object.entries(byConcept)) {
    if (entries.length < 2) continue;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const sim = jaccard(entries[i].meaning, entries[j].meaning);
        if (sim >= 0.72) {
          flags.push({
            duplicateConcept: concept,
            duplicateBlocks: [entries[i].index, entries[j].index],
            similarity: Math.round(sim * 100) / 100,
            kinds: [entries[i].type, entries[j].type],
            message: `Similar ${concept} content in blocks ${entries[i].index + 1} and ${entries[j].index + 1}`,
          });
        }
      }
    }
  }

  const summaryDefinitions = blocks.filter((b, i) => {
    const hay = blockHaystack(b);
    return (
      String(b.role || "").toLowerCase() === "summary" ||
      String(b.title || "").toLowerCase().includes("summary") ||
      (String(b.type || "").toLowerCase() === "keywords" && hay.length > 40)
    );
  });

  return {
    exactDuplicates: exactScan.issues,
    semanticFlags: flags,
    duplicateCount: exactScan.duplicateCount + flags.length,
    clean: exactScan.clean && flags.length === 0,
    byConcept,
  };
}

/**
 * @param {object[]} pages
 */
function scoreDuplication(pages) {
  const audit = auditDuplication(pages);
  const penalty = audit.duplicateCount * 15;
  return Math.max(0, 100 - penalty);
}

module.exports = {
  auditDuplication,
  scoreDuplication,
};
