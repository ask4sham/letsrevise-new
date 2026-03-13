/**
 * Step 2: Read-only script builder.
 * Turns lesson-like input into clean narration text for future video pipeline.
 * No routes. No DB. No integration.
 */

/**
 * Strip media, markdown, and links from text for narration.
 * Removes: [Video:...](...), ![...](...), /uploads/ links, heading markers, repeated blanks.
 */
function stripMarkdown(text) {
  if (!text || typeof text !== "string") return "";
  let out = text
    .replace(/\[Video:[^\]]*\]\([^)]*\)/gi, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\/uploads\/[^\s)\]]+/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return out;
}

/**
 * Build narration from lesson-like input.
 * @param {Object} lesson - { title, description, subject, topic, blocks? }
 * @returns {Object} { narration, sections, metadata }
 */
function buildScript(lesson) {
  const input = lesson || {};
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const subject = String(input.subject || "").trim();
  const topic = String(input.topic || "").trim();
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];

  const sections = [];

  // Section 1: intro from title + description
  const introParts = [];
  if (title) introParts.push(title);
  if (description) introParts.push(stripMarkdown(description));
  const introText = introParts.join(". ");
  if (introText) {
    sections.push({ key: "intro", title: title || "Intro", text: introText });
  }

  // Remaining sections: one per text block
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const content = b && typeof b.content === "string" ? b.content : "";
    if (!content.trim()) continue;
    const blockType = (b && b.type) || "text";
    if (blockType === "checkpoint" || blockType === "pageQuiz" || blockType === "diagram") continue;
    const cleaned = stripMarkdown(content);
    if (!cleaned) continue;
    const firstLine = (cleaned.split("\n")[0] || "").trim();
    const sectionTitle = firstLine.length > 60 ? firstLine.slice(0, 57) + "..." : firstLine || `Section ${sections.length + 1}`;
    sections.push({
      key: `block_${i}`,
      title: sectionTitle,
      text: cleaned,
    });
  }

  const narration = sections.map((s) => s.text).filter(Boolean).join("\n\n");

  return {
    narration,
    sections,
    metadata: {
      title,
      subject,
      topic,
      sectionCount: sections.length,
    },
  };
}

module.exports = buildScript;
