/**
 * Optional refactor engine — reorder/rechunk existing lessons to match V2 blueprint.
 * Does not run automatically; teacher must opt in.
 */

const { buildLessonBlueprint } = require("./lessonBlueprintEngine");
const { scanLessonDuplication, applyDuplicationFixes } = require("./lessonDuplicationGuard");

const BLOCK_TYPE_ORDER_HINT = {
  objectives: 0,
  "prior-knowledge": 1,
  hook: 2,
  "text-concept": 10,
  text: 10,
  keyIdea: 11,
  diagram: 20,
  "interactive-diagram": 21,
  interactiveSequence: 22,
  dragDropMatch: 23,
  graph: 24,
  hotspot: 25,
  checkpoint: 30,
  "self-check-question": 31,
  commonMistake: 40,
  examTip: 41,
  "worked-example": 42,
  "exam-practice": 50,
  summary: 60,
  keywords: 61,
};

function flattenPagesToBlocks(pages) {
  if (!Array.isArray(pages)) return [];
  const blocks = [];
  for (const page of pages) {
    const list = Array.isArray(page?.blocks) ? page.blocks : [];
    for (const b of list) {
      blocks.push({ ...b, _pageTitle: page.title });
    }
  }
  return blocks;
}

function blocksToPages(blocks, originalPages) {
  const page = originalPages?.[0] || { title: "Lesson", order: 1, pageType: "lesson", blocks: [] };
  return [{ ...page, blocks: blocks.map(({ _pageTitle, ...b }) => b) }];
}

function scoreBlockForJourneyStep(block, step) {
  let score = 0;
  const type = String(block.type || "").toLowerCase();
  const stepType = String(step.blockType || "").toLowerCase();
  if (type === stepType) score += 50;
  if (step.role === "check" && (type === "checkpoint" || type === "self-check-question")) score += 40;
  if (step.role === "activity" && ["diagram", "dragdropmatch", "interactivesequence", "graph", "hotspot"].includes(type.replace(/-/g, ""))) {
    score += 35;
  }
  const hay = normalizeHay(block);
  if (step.conceptName && hay.includes(normalizeHay({ content: step.conceptName }))) score += 25;
  return score;
}

function normalizeHay(block) {
  return String(block.content || block.text || block.title || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ");
}

/**
 * Reorder blocks to follow blueprint journey; preserve block payloads.
 * @param {object[]} pages
 * @param {object} blueprint
 * @param {{ removeDuplicates?: boolean }} opts
 */
function refactorLessonFromBlueprint(pages, blueprint, opts = {}) {
  const originalBlocks = flattenPagesToBlocks(pages);
  const journey = blueprint.learningJourney || [];
  const used = new Set();
  const ordered = [];

  for (const step of journey) {
    let bestIdx = -1;
    let bestScore = -1;
    originalBlocks.forEach((block, idx) => {
      if (used.has(idx)) return;
      const s = scoreBlockForJourneyStep(block, step);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0 && bestScore > 0) {
      used.add(bestIdx);
      ordered.push({
        ...originalBlocks[bestIdx],
        _v2JourneyOrder: step.order,
        _v2Rationale: step.rationale,
      });
    }
  }

  for (let i = 0; i < originalBlocks.length; i++) {
    if (!used.has(i)) {
      ordered.push({
        ...originalBlocks[i],
        _v2JourneyOrder: 1000 + i,
        _v2Rationale: "Preserved curated content (unmapped to blueprint step)",
      });
    }
  }

  ordered.sort((a, b) => (a._v2JourneyOrder ?? 0) - (b._v2JourneyOrder ?? 0));

  let finalBlocks = ordered;
  const dup = scanLessonDuplication(finalBlocks);
  if (opts.removeDuplicates && dup.issues.length) {
    finalBlocks = applyDuplicationFixes(dup.issues, finalBlocks);
  }

  return {
    pages: blocksToPages(finalBlocks, pages),
    changes: {
      reordered: true,
      blockCount: finalBlocks.length,
      duplicates: dup,
      preservedUnmapped: finalBlocks.filter((b) => String(b._v2Rationale || "").includes("Preserved")).length,
    },
  };
}

/**
 * Full refactor: blueprint from topic metadata + existing pages.
 */
function refactorExistingLesson(input = {}) {
  const blueprint = buildLessonBlueprint({
    topic: input.topic,
    subject: input.subject,
    examBoard: input.examBoard || input.board,
    tier: input.tier,
    topicKey: input.topicKey,
    durationTier: input.durationTier || "standard",
  });

  const result = refactorLessonFromBlueprint(input.pages || [], blueprint, {
    removeDuplicates: input.removeDuplicates !== false,
  });

  return {
    blueprint,
    ...result,
  };
}

module.exports = {
  refactorLessonFromBlueprint,
  refactorExistingLesson,
  flattenPagesToBlocks,
};
