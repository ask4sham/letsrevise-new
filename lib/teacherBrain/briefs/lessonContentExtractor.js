/**
 * Deterministic vocabulary extraction from lesson page blocks (V1 — no AI).
 */

const GENERIC_PLACEHOLDER_PATTERNS = [
  /key process or mechanism described in words/i,
  /structure or feature with its function explained/i,
  /common misconception corrected in one line/i,
  /cause linked to a clear effect in this topic/i,
  /match on diagram/i,
  /^\(prompt\)$/i,
  /^\(structure \d+\)$/i,
  /^\(add cards from lesson/i,
];

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

function isGenericPlaceholder(text) {
  const t = safeStr(text);
  if (!t) return true;
  return GENERIC_PLACEHOLDER_PATTERNS.some((re) => re.test(t));
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function blockToPlainText(block) {
  if (!block || typeof block !== "object") return "";
  const parts = [
    block.title,
    block.content,
    block.text,
    block.body,
    block.summary,
    block.keyIdea,
    block.prompt,
    block.question,
    block.instructions,
    block.explanation,
    block.caption,
  ];
  if (Array.isArray(block.items)) {
    parts.push(block.items.map((i) => (typeof i === "string" ? i : i?.text || i?.label || "")).join("\n"));
  }
  if (Array.isArray(block.keywords)) parts.push(block.keywords.join(", "));
  if (Array.isArray(block.keyWords)) parts.push(block.keyWords.join(", "));
  return parts
    .filter(Boolean)
    .map((p) => stripHtml(p))
    .join("\n")
    .trim();
}

function extractBoldTermDefinitions(raw) {
  const pairs = [];
  const text = String(raw || "");
  const patterns = [
    /<strong[^>]*>([^<]+)<\/strong>\s+is\s+([^.<\n]+)/gi,
    /<strong[^>]*>([^<]+)<\/strong>\s+(produces|releases|carries|receives|lines|protects|transports|contains)\s+([^.<\n]+)/gi,
    /\*\*([^*]+)\*\*\s+is\s+([^.<\n]+)/gi,
    /\*\*([^*]+)\*\*\s+(produces|releases|carries|receives|lines|protects|transports|contains)\s+([^.<\n]+)/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text))) {
      const term = safeStr(m[1]);
      const definition = safeStr(m[3] ? `${m[2]} ${m[3]}` : m[2]);
      if (term && definition && !isGenericPlaceholder(term)) {
        pairs.push({ term, definition });
      }
    }
  }
  return pairs;
}

function extractBoldTerms(raw) {
  const text = String(raw || "");
  const terms = [];
  const htmlRe = /<strong[^>]*>([^<]+)<\/strong>/gi;
  let m;
  while ((m = htmlRe.exec(text))) {
    const t = safeStr(m[1]);
    if (t && !isGenericPlaceholder(t)) terms.push(t);
  }
  const mdRe = /\*\*([^*]+)\*\*/g;
  while ((m = mdRe.exec(text))) {
    const t = safeStr(m[1]);
    if (t && !isGenericPlaceholder(t)) terms.push(t);
  }
  return terms;
}

function extractTermDefinitionPairs(text) {
  const pairs = [];
  const seen = new Set();
  const lines = String(text || "").split(/\n+/);
  const lineRe = /^(.{2,48}?)\s*[—–:\u2192-]\s*(.{4,200})$/;

  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/^[-•*]\s*/, "");
    if (/^(actually|in fact|not)\b/i.test(line)) continue;
    const m = line.match(lineRe);
    if (!m) continue;
    const term = safeStr(m[1].replace(/\*\*/g, ""));
    const definition = safeStr(m[2]);
    if (!term || !definition || isGenericPlaceholder(term) || isGenericPlaceholder(definition)) {
      continue;
    }
    if (/^(fertilisation|fertilization) happens/i.test(term)) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ term, definition });
  }
  return pairs;
}

function extractPathwaySteps(text) {
  const steps = [];
  const pathwayRe =
    /([A-Za-z][A-Za-z0-9\s/()'-]{1,40}?)(?:\s*(?:→|->|→| to )\s*([A-Za-z][A-Za-z0-9\s/()'-]{1,40}?))+/gi;
  let m;
  while ((m = pathwayRe.exec(text))) {
    const segment = m[0];
    const parts = segment
      .split(/\s*(?:→|->| to )\s*/i)
      .map((p) => safeStr(p))
      .filter(Boolean);
    if (parts.length >= 2) {
      steps.push({ label: segment, parts });
    }
  }
  return steps;
}

function extractStructureFunctionStatements(text) {
  const statements = [];
  const seen = new Set();
  const re =
    /\b(?:the\s+)?([a-z][a-z\s/()'-]{1,24}?)\s+(produces|releases|carries|stores|lines|receives|protects|transports|implants|fertilises|fertilizes|secretes|contains)\s+(.{4,100}?)(?:[.;<]|$)/gi;
  let m;
  while ((m = re.exec(text))) {
    const term = safeStr(m[1]);
    const verb = safeStr(m[2]);
    const rest = safeStr(m[3]).replace(/<[^>]+>/g, "").trim();
    if (!term || !rest || isGenericPlaceholder(term)) continue;
    if (term.split(/\s+/).length > 3) continue;
    const definition = `${verb} ${rest}`.trim();
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    statements.push({ term, definition });
  }
  return statements;
}

function extractMisconceptionLines(text) {
  const lines = [];
  const raw = String(text || "");
  for (const line of raw.split(/\n+/)) {
    const trimmed = safeStr(line);
    if (!trimmed) continue;
    if (
      /misconception|students often|many pupils|common mistake|actually|not the|does not (usually )?occur/i.test(
        trimmed
      )
    ) {
      if (!isGenericPlaceholder(trimmed)) lines.push(trimmed.replace(/^[-•*]\s*/, ""));
    }
    const dashSplit = trimmed.match(/^(.+?)\s*[—–-]\s*(actually|in fact|not)\s+(.+)$/i);
    if (dashSplit) {
      lines.push(trimmed.replace(/^[-•*]\s*/, ""));
    }
  }
  return lines;
}

function pairsFromBlock(block) {
  const pairs = Array.isArray(block?.pairs) ? block.pairs : [];
  return pairs
    .map((p, i) => ({
      id: safeStr(p?.id) || `pair-${i + 1}`,
      prompt: safeStr(p?.prompt) || safeStr(p?.label) || "",
      answer: safeStr(p?.answer) || safeStr(p?.definition) || "",
      explanation: safeStr(p?.explanation),
    }))
    .filter((p) => p.prompt || p.answer);
}

function pairsAreGeneric(pairs) {
  if (!pairs.length) return true;
  return pairs.every(
    (p) => isGenericPlaceholder(p.prompt) || isGenericPlaceholder(p.answer)
  );
}

/**
 * Collect blocks on the same page, preferring content before and near the activity.
 * @param {object[]} pages
 * @param {number} pageIndex
 * @param {number} blockIndex
 */
function collectSurroundingBlocks(pages, pageIndex, blockIndex) {
  const page = pages?.[pageIndex];
  if (!page || !Array.isArray(page.blocks)) return [];
  const blocks = page.blocks;
  const before = blocks.slice(0, blockIndex);
  const after = blocks.slice(blockIndex + 1, blockIndex + 3);
  return [...before, ...after];
}

/**
 * @param {object[]} blocks
 */
function extractLessonVocabulary(blocks = []) {
  const termDefs = [];
  const boldTerms = [];
  const pathways = [];
  const misconceptions = [];
  const vocabulary = new Set();
  const seenTerms = new Set();

  const addPair = (term, definition) => {
    const t = safeStr(term);
    const d = safeStr(definition);
    if (!t || !d || isGenericPlaceholder(t) || isGenericPlaceholder(d)) return;
    const key = t.toLowerCase();
    if (seenTerms.has(key)) return;
    seenTerms.add(key);
    termDefs.push({ term: t, definition: d });
    vocabulary.add(t);
  };

  for (const block of blocks) {
    const type = safeStr(block?.type).toLowerCase();
    const plain = blockToPlainText(block);
    if (!plain) continue;

    for (const pair of extractTermDefinitionPairs(plain)) {
      addPair(pair.term, pair.definition);
    }
    for (const pair of extractBoldTermDefinitions(block.content || block.text || block.body || "")) {
      addPair(pair.term, pair.definition);
    }
    for (const stmt of extractStructureFunctionStatements(plain)) {
      addPair(stmt.term, stmt.definition);
    }
    for (const term of extractBoldTerms(block.content || block.text || block.body || plain)) {
      if (term.split(/\s+/).length <= 3) {
        boldTerms.push(term);
        vocabulary.add(term);
      }
    }
    for (const step of extractPathwaySteps(plain)) {
      pathways.push(step);
    }

    if (type === "commonmistake" || type === "misconception" || /mistake|misconception/i.test(plain)) {
      misconceptions.push(...extractMisconceptionLines(plain));
    } else {
      misconceptions.push(...extractMisconceptionLines(plain));
    }

    if (Array.isArray(block.keywords)) {
      for (const kw of block.keywords) vocabulary.add(safeStr(kw));
    }
    if (Array.isArray(block.keyWords)) {
      for (const kw of block.keyWords) vocabulary.add(safeStr(kw));
    }
  }

  return {
    termDefinitions: termDefs,
    boldTerms,
    pathways,
    misconceptions: [...new Set(misconceptions.map((m) => safeStr(m)).filter(Boolean))],
    vocabulary: [...vocabulary].filter(Boolean),
  };
}

module.exports = {
  safeStr,
  isGenericPlaceholder,
  stripHtml,
  blockToPlainText,
  extractBoldTerms,
  extractBoldTermDefinitions,
  extractTermDefinitionPairs,
  extractPathwaySteps,
  extractStructureFunctionStatements,
  extractMisconceptionLines,
  pairsFromBlock,
  pairsAreGeneric,
  collectSurroundingBlocks,
  extractLessonVocabulary,
  GENERIC_PLACEHOLDER_PATTERNS,
};
