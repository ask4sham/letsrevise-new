/**
 * PR-002: Index Lesson pages/blocks as KnowledgeDocuments.
 * PR-006.1: Accurate blockIndex per chunk via [[BLOCK:n]] markers.
 * PR-030: Index diagram blocks as lessonDiagram for diagram-aware retrieval.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const Lesson = require("../../../models/Lesson");
const KnowledgeDocument = require("../../../models/KnowledgeDocument");
const VisualModel = require("../../../models/VisualModel");
const { chunkText } = require("../chunkText");

const BLOCK_MARKER_RE = /\[\[BLOCK:(\d+)\]\]/g;

function hash(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 32);
}

/**
 * Normalize specKey for lesson topicKey matching.
 * AQA_GCSE_BIOLOGY -> matches aqa-gcse-biology:...
 */
function specKeyToTopicPrefix(specKey) {
  if (!specKey || typeof specKey !== "string") return null;
  return String(specKey)
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

/**
 * Extract indexable text from a block.
 * Include content, caption, alt for diagrams.
 */
function blockToText(block) {
  if (!block) return "";
  const parts = [];
  if (block.content && String(block.content).trim()) parts.push(block.content.trim());
  if (block.caption && String(block.caption).trim()) parts.push(block.caption.trim());
  if (block.alt && String(block.alt).trim()) parts.push(block.alt.trim());
  if (block.prompt && String(block.prompt).trim()) parts.push(block.prompt.trim());
  if (block.title && String(block.title).trim()) parts.push(block.title.trim());
  if (block.note && String(block.note).trim()) parts.push(block.note.trim());
  return parts.join("\n\n");
}

/**
 * Extract block text units with block indices.
 * Excludes checkpoint blocks (not rendered in lesson view; no block-N id).
 * Hero caption prepended to first block. Checkpoint not indexed (rendered separately).
 * Returns array of { pageIndex, pageId, pageTitle, blockTextUnits: [{ blockIndex, text }] }
 */
function extractLessonBlockTextUnits(lesson) {
  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  const result = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageTitle = (page?.title || "").trim() || "Page";
    const pageId = page?.pageId || `p${i}`;
    const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
    const blockTextUnits = [];
    const heroCaption = page?.hero?.caption && String(page.hero.caption).trim() ? page.hero.caption.trim() : null;

    for (let bi = 0; bi < blocks.length; bi++) {
      if (blocks[bi]?.type === "checkpoint") continue; // not in blocksToRender
      let t = blockToText(blocks[bi]);
      if (t) {
        if (blockTextUnits.length === 0 && heroCaption) t = `${heroCaption}\n\n${t}`;
        blockTextUnits.push({ blockIndex: bi, text: t });
      }
    }

    if (blockTextUnits.length > 0) {
      result.push({ pageIndex: i, pageId, pageTitle, blockTextUnits });
    }
  }
  return result;
}

/**
 * Build pageText with [[BLOCK:n]] markers for mapping chunks back to blocks.
 */
function buildPageTextWithMarkers(blockTextUnits) {
  return blockTextUnits.map((u) => `[[BLOCK:${u.blockIndex}]]${u.text}`).join("\n\n");
}

/**
 * Extract block indices from chunk text (with markers).
 * Returns { blockIndexStart, blockIndexEnd } or null if no markers.
 */
function extractBlockIndicesFromChunk(chunkTextVal) {
  const indices = [];
  let m;
  BLOCK_MARKER_RE.lastIndex = 0;
  while ((m = BLOCK_MARKER_RE.exec(chunkTextVal)) !== null) {
    indices.push(parseInt(m[1], 10));
  }
  if (indices.length === 0) return null;
  return {
    blockIndexStart: Math.min(...indices),
    blockIndexEnd: Math.max(...indices),
  };
}

/**
 * Strip [[BLOCK:n]] markers from text for storage/embedding.
 */
function stripBlockMarkers(text) {
  if (!text || typeof text !== "string") return text;
  return text.replace(BLOCK_MARKER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Build candidate KnowledgeDocuments from Lessons.
 * PR-006.1: Each chunk gets blockIndexStart/blockIndexEnd from [[BLOCK:n]] markers.
 * @param {{ specKey?: string }} opts - optional specKey filter (topicKey prefix match)
 * @returns {Promise<Array<{ doc: object, sourceId: object, chunkIndex: number }>>}
 */
async function buildCandidates(opts = {}) {
  const query = {};
  query.topicKey = { $exists: true, $ne: null, $ne: "" };
  if (opts.topicKey && String(opts.topicKey).trim()) {
    query.topicKey = String(opts.topicKey).trim();
  } else if (opts.specKey && String(opts.specKey).trim()) {
    const prefix = specKeyToTopicPrefix(opts.specKey);
    if (prefix) {
      query.topicKey = new RegExp("^" + prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[:\\s]", "i");
    }
  }

  const lessons = await Lesson.find(query)
    .select("_id title topicKey board level tier pages")
    .lean();

  const candidates = [];
  for (const lesson of lessons) {
    const lessonId = lesson._id;
    const lessonTitle = (lesson.title || "").trim() || "Untitled";
    const topicKey = (lesson.topicKey || "").trim();
    if (!topicKey) continue;

    const specKey = topicKey.includes(":") ? topicKey.split(":")[0] : "unknown";
    const examBoard = lesson.board || null;
    const level = lesson.level || null;
    const tier = lesson.tier || null;

    const pageData = extractLessonBlockTextUnits(lesson);
    let globalChunkIndex = 0;
    for (const { pageIndex, pageId, pageTitle, blockTextUnits } of pageData) {
      const pageText = buildPageTextWithMarkers(blockTextUnits);
      const chunks = chunkText(pageText, { maxChars: 2000 });
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunkTextVal = chunks[ci];
        const blockIndices = extractBlockIndicesFromChunk(chunkTextVal);
        const textForStorage = stripBlockMarkers(chunkTextVal);
        const contentHash = hash(`${specKey}|${topicKey}|${lessonId}|${pageIndex}|${ci}|${textForStorage}`);

        const metadata = {
          lessonId: String(lessonId),
          pageIndex,
          pageId,
          blockIndex: blockIndices ? blockIndices.blockIndexStart : 0,
          ...(blockIndices && {
            blockIndexStart: blockIndices.blockIndexStart,
            blockIndexEnd: blockIndices.blockIndexEnd,
          }),
        };

        const doc = {
          sourceType: "lessonBlock",
          sourceId: lessonId,
          specKey,
          examBoard,
          level,
          topicKey,
          tier,
          title: `${lessonTitle} — ${pageTitle}`,
          text: textForStorage,
          chunkIndex: globalChunkIndex,
          metadata,
          contentHash,
        };
        candidates.push({ doc, sourceId: lessonId, chunkIndex: globalChunkIndex });
        globalChunkIndex++;
      }
    }

    // PR-030: Index diagram blocks as lessonDiagram (separate from lessonBlock)
    const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];
      const pageId = page?.pageId || `p${pageIndex}`;
      const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex];
        if (!block || (block.type !== "diagram" && block.type !== "image")) continue;

        const caption = (block.caption || "").trim();
        const altText = (block.alt || "").trim();
        const textForEmbed = [caption, altText].filter(Boolean).join("\n\n") || "Diagram";
        if (!textForEmbed || textForEmbed.length < 3) continue;

        let imageUrl = block.imageUrl && String(block.imageUrl).trim() ? block.imageUrl.trim() : null;
        if (!imageUrl && block.visualId && mongoose.Types.ObjectId.isValid(block.visualId)) {
          try {
            const visual = await VisualModel.findById(block.visualId)
              .select("variants")
              .lean();
            const variant = visual?.variants?.[0];
            if (variant?.src) imageUrl = variant.src;
          } catch (_) {}
        }

        const diagramChunkIndex = pageIndex * 1000 + blockIndex;
        const contentHash = hash(`${specKey}|${topicKey}|lessonDiagram|${lessonId}|${pageId}|${blockIndex}|${textForEmbed}`);

        const diagramDoc = {
          sourceType: "lessonDiagram",
          sourceId: lessonId,
          specKey,
          examBoard: lesson.board || null,
          level: lesson.level || null,
          topicKey,
          tier: lesson.tier || null,
          title: `${lessonTitle} — ${(page?.title || "Page").trim() || "Page"}`,
          text: textForEmbed,
          chunkIndex: diagramChunkIndex,
          metadata: {
            lessonId: String(lessonId),
            pageId,
            pageIndex,
            blockIndex,
            caption: caption || null,
            altText: altText || null,
            imageUrl: imageUrl || null,
            ...(block.visualId && { visualId: String(block.visualId) }),
          },
          contentHash,
        };
        candidates.push({ doc: diagramDoc, sourceId: lessonId, chunkIndex: diagramChunkIndex });
      }
    }
  }
  return candidates;
}

module.exports = { buildCandidates };
