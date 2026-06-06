/**
 * Shared closing-block helpers for Summary / Memory Rule scope authorities (Phase 3H.1.8b.2).
 */

const { findDriftTermsInText } = require("./objectivesAuthority");

const FUTURE_LESSON_PREVIEW_MARKERS = [
  /\b(?:covered|studied|learned|explored)\s+(?:in\s+)?(?:a\s+)?(?:later|future|subsequent|next)\s+lesson\b/i,
  /\b(?:next|later)\s+lesson\s+(?:will|we)\b/i,
  /\bnot\s+(?:covered|taught)\s+(?:in\s+)?this\s+lesson\b/i,
  /\bfuture[\-\s]lesson\s+preview\b/i,
];

function hasFutureLessonPreviewMarker(text = "") {
  const hay = String(text || "");
  return FUTURE_LESSON_PREVIEW_MARKERS.some((re) => re.test(hay));
}

function splitClosingBodyIntoChunks(body = "") {
  const raw = String(body || "");
  const chunks = [];

  raw.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) chunks.push(text);
    return "";
  });

  raw.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => {
    const text = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) chunks.push(text);
    return "";
  });

  if (chunks.length === 0) {
    const plain = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plain) {
      for (const sentence of plain.split(/(?<=[.!?])\s+/)) {
        const s = sentence.trim();
        if (s.length >= 12) chunks.push(s);
      }
    }
  }

  return chunks;
}

/**
 * Drift terms in closing text, excluding sentences/items explicitly marked as future-lesson previews.
 */
function findClosingDriftTermsInText(text = "") {
  const chunks = splitClosingBodyIntoChunks(text);
  if (chunks.length === 0) {
    return hasFutureLessonPreviewMarker(text) ? [] : findDriftTermsInText(text);
  }

  const terms = new Set();
  for (const chunk of chunks) {
    if (hasFutureLessonPreviewMarker(chunk)) continue;
    for (const term of findDriftTermsInText(chunk)) {
      terms.add(term);
    }
  }
  return [...terms];
}

function listSummaryBlockSpans(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  const spans = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) continue;
    const head = lines[i];
    if (!/\bSUMMARY\b/i.test(head)) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^(\d+)\s*[—\-–]\s+/i.test(lines[j]) || /^PAGE\s+\d/i.test(lines[j].trim())) {
        end = j;
        break;
      }
    }
    spans.push({
      kind: "summary",
      start: i,
      end,
      headerLine: head,
      text: lines.slice(i, end).join("\n"),
    });
    i = end - 1;
  }
  return spans;
}

function extractSummaryBlockBody(blockText = "") {
  const lines = String(blockText || "").split("\n");
  const pasteIdx = lines.findIndex((l) => /^Paste into:/i.test(l.trim()));
  if (pasteIdx < 0) return blockText;
  return lines.slice(pasteIdx + 1).join("\n");
}

function listMemoryRuleBlockSpans(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  const spans = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) continue;
    const head = lines[i];
    if (!/\bFINAL\s+MEMORY\s+RULE\b/i.test(head) && !/\bKEY\s+INSIGHT\b/i.test(head)) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^(\d+)\s*[—\-–]\s+/i.test(lines[j]) || /^PAGE\s+\d/i.test(lines[j].trim())) {
        end = j;
        break;
      }
    }
    spans.push({
      kind: "memoryRule",
      start: i,
      end,
      headerLine: head,
      text: lines.slice(i, end).join("\n"),
    });
    i = end - 1;
  }
  return spans;
}

function extractClosingBlockBody(blockText = "") {
  return extractSummaryBlockBody(blockText);
}

module.exports = {
  FUTURE_LESSON_PREVIEW_MARKERS,
  hasFutureLessonPreviewMarker,
  splitClosingBodyIntoChunks,
  findClosingDriftTermsInText,
  listSummaryBlockSpans,
  extractSummaryBlockBody,
  listMemoryRuleBlockSpans,
  extractClosingBlockBody,
};
