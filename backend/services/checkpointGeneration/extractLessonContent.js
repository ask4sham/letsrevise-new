/**
 * Flatten lesson pages/blocks into prompt-safe text for checkpoint generation.
 * Does not include answers — only teaching content.
 */

const MAX_TOTAL_CHARS = 14000;
const MAX_BLOCK_CHARS = 2000;

function stripCheckpointLike(block) {
  if (!block || typeof block !== "object") return "";
  const t = String(block.type || "");
  if (t === "checkpoint" || t === "pageQuiz") return "";
  const content = typeof block.content === "string" ? block.content : "";
  const title = typeof block.title === "string" ? block.title : "";
  return [title, content].filter(Boolean).join("\n").trim();
}

/**
 * @param {import("mongoose").Document | object} lesson
 * @returns {{ text: string, pages: { pageId: string, title: string, snippet: string }[], summary: { pageCount: number, charCount: number } }}
 */
function extractLessonContent(lesson) {
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const outPages = [];
  let textParts = [];

  const title = typeof lesson?.title === "string" ? lesson.title.trim() : "";
  const description = typeof lesson?.description === "string" ? lesson.description.trim() : "";
  const legacy = typeof lesson?.content === "string" ? lesson.content.trim() : "";

  if (title) textParts.push(`# ${title}`);
  if (description) textParts.push(description);
  if (legacy && legacy.length < 8000) textParts.push(legacy);

  for (const p of pages) {
    const pageId = typeof p?.pageId === "string" ? p.pageId : "";
    const pt = typeof p?.title === "string" ? p.title.trim() : "";
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    const blockTexts = blocks.map(stripCheckpointLike).filter(Boolean);
    let pageBody = blockTexts.join("\n\n").slice(0, MAX_BLOCK_CHARS);
    if (p?.checkpoint?.question && typeof p.checkpoint.question === "string") {
      pageBody += ""; // do not include existing checkpoint question to avoid copying
    }
    const snippet = [pt, pageBody].filter(Boolean).join("\n").slice(0, MAX_BLOCK_CHARS);
    outPages.push({ pageId, title: pt, snippet });
    textParts.push(`\n## Page: ${pt || pageId || "untitled"}\n${snippet}`);
  }

  let text = textParts.join("\n").replace(/\s+\n/g, "\n").trim();
  if (text.length > MAX_TOTAL_CHARS) {
    text = text.slice(0, MAX_TOTAL_CHARS) + "\n[...truncated]";
  }

  return {
    text,
    pages: outPages,
    summary: {
      pageCount: outPages.length,
      charCount: text.length,
    },
  };
}

module.exports = { extractLessonContent, MAX_TOTAL_CHARS };
