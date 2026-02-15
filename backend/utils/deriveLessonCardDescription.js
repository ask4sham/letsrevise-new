// backend/utils/deriveLessonCardDescription.js

function clip(text, max = 140) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

/**
 * Extracts a safe description for lesson cards.
 * - Prefers lesson.description if present.
 * - Otherwise derives from the first page's TEXT-like blocks only.
 * - Avoids checkpoints/answers/mark schemes by skipping non-text block types.
 */
function deriveLessonCardDescription(lesson) {
  const explicit = (lesson?.description || "").trim();
  if (explicit) return clip(explicit, 160);

  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const first = pages[0];
  if (!first) return "";

  // Try common schemas defensively
  const blocks =
    (Array.isArray(first.blocks) && first.blocks) ||
    (Array.isArray(first.content) && first.content) ||
    (Array.isArray(first.elements) && first.elements) ||
    [];

  const texts = [];

  for (const b of blocks) {
    const type = String(b?.type || b?.kind || "").toLowerCase();

    // Allow only text-like block types (avoid checkpoint/quiz/etc.)
    const isTextLike =
      type === "text" ||
      type === "paragraph" ||
      type === "markdown" ||
      type === "richtext" ||
      type === "html";

    if (!isTextLike) continue;

    // Pull text from likely fields
    const t =
      b?.text ??
      b?.content ??
      b?.data?.text ??
      b?.data?.content ??
      b?.value ??
      "";

    const cleaned = String(t).replace(/<[^>]+>/g, " "); // strip HTML tags if any
    if (cleaned.trim()) texts.push(cleaned);
    if (texts.join(" ").length > 260) break; // stop early
  }

  return clip(texts.join(" "), 160);
}

module.exports = { deriveLessonCardDescription };
