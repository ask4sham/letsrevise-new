/**
 * PR-002: Simple deterministic text chunking for KnowledgeDocument indexing.
 * No external libs. Splits on double newlines, then sentence boundaries, max maxChars per chunk.
 */
"use strict";

/**
 * Split text into chunks of at most maxChars.
 * - Prefer split on double newlines
 * - Otherwise split on sentence boundaries (. ! ?)
 * - Trim whitespace, drop empty chunks
 *
 * @param {string} text - Raw text to chunk
 * @param {{ maxChars?: number }} opts - maxChars default 2000
 * @returns {string[]} Array of chunk strings
 */
function chunkText(text, { maxChars = 2000 } = {}) {
  if (text == null || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  const max = Math.max(100, Math.floor(maxChars));

  // First split on double newlines (paragraphs)
  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= max) {
      current = current ? `${current}\n\n${para}` : para;
      continue;
    }
    // Flush current if we have it
    if (current) {
      chunks.push(current);
      current = "";
    }
    // If single para exceeds max, split on sentences
    if (para.length > max) {
      const subChunks = splitBySentences(para, max);
      for (let i = 0; i < subChunks.length; i++) {
        if (i === subChunks.length - 1 && subChunks[i].length < max) {
          current = subChunks[i];
        } else {
          chunks.push(subChunks[i]);
        }
      }
    } else {
      current = para;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Split long text on sentence boundaries.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
function splitBySentences(text, maxChars) {
  const parts = text.split(/(?<=[.!?])\s+/);
  const result = [];
  let buf = "";
  for (const p of parts) {
    if (buf.length + p.length + 1 <= maxChars) {
      buf = buf ? `${buf} ${p}` : p;
    } else {
      if (buf) result.push(buf);
      if (p.length > maxChars) {
        // Very long sentence: hard split
        let rest = p;
        while (rest.length > maxChars) {
          result.push(rest.slice(0, maxChars));
          rest = rest.slice(maxChars).trim();
        }
        buf = rest;
      } else {
        buf = p;
      }
    }
  }
  if (buf) result.push(buf);
  return result;
}

module.exports = { chunkText };
