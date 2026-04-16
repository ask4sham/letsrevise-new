/**
 * Flatten lesson pages + legacy content into plain text for AI prompts (caps size).
 */
const MAX_CHARS = 14000;

function blockText(b) {
  if (!b || typeof b !== "object") return "";
  const parts = [];
  if (b.content) parts.push(String(b.content));
  if (b.prompt) parts.push(String(b.prompt));
  if (b.question) parts.push(String(b.question));
  if (Array.isArray(b.options)) parts.push(b.options.join(" | "));
  if (b.caption) parts.push(String(b.caption));
  if (b.title) parts.push(String(b.title));
  return parts.filter(Boolean).join("\n");
}

/**
 * @param {Object} lesson - Mongoose lesson doc or plain object
 * @returns {{ text: string, pageIds: string[] }}
 */
function extractLessonTextForAssets(lesson) {
  const chunks = [];
  const pageIds = [];

  if (lesson.title) chunks.push(`Title: ${lesson.title}`);
  if (lesson.description) chunks.push(`Description: ${lesson.description}`);
  if (lesson.content && String(lesson.content).trim()) {
    chunks.push(`Legacy content:\n${String(lesson.content).trim()}`);
  }

  const pages = Array.isArray(lesson.pages) ? lesson.pages : [];
  for (const p of pages) {
    const pid = p.pageId ? String(p.pageId) : "";
    if (pid) pageIds.push(pid);
    const header = pid ? `\n--- Page ${pid}${p.title ? `: ${p.title}` : ""} ---\n` : "\n--- Page ---\n";
    let body = "";
    const blocks = Array.isArray(p.blocks) ? p.blocks : [];
    for (const b of blocks) {
      body += blockText(b) + "\n";
    }
    if (body.trim()) chunks.push(header + body.trim());
  }

  let text = chunks.join("\n\n").trim();
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n\n[…truncated for generation]";
  }
  return { text, pageIds: [...new Set(pageIds)] };
}

module.exports = { extractLessonTextForAssets, MAX_CHARS };
