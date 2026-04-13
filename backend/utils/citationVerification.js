/**
 * PR-024: Shared citation verification.
 * Extracted from enquiry.controller for reuse by topic summary.
 * Verify: cited knowledgeDocumentId must resolve to the retrieved set. When quote is present,
 * prefer strict then loose text match; if both fail but the id is trusted, accept and use a
 * canonical excerpt from doc.text (same trust model as an empty quote).
 */

/** Strip light markdown so model quotes can match stored lesson markdown. */
function stripLightMarkdown(s) {
  return String(s || "")
    .replace(/\*\*|__/g, "")
    .replace(/(^|\s)#{1,6}\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Second-pass match for retrieved chunks: model often quotes plain text from markdown or paraphrases slightly.
 * Used for lesson-local and curriculum KnowledgeDocuments alike.
 */
function quoteMatchesDocLoosely(docText, quote) {
  const dt = stripLightMarkdown(docText).toLowerCase();
  const q = stripLightMarkdown(quote).toLowerCase();
  if (!q) return true;
  if (dt.includes(q.slice(0, 150))) return true;
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return true;
  const sig = words.filter((w) => w.length >= 4);
  const toCheck = sig.length > 0 ? sig : words;
  const matched = toCheck.filter((w) => dt.includes(w));
  return matched.length >= Math.max(1, Math.ceil(toCheck.length * 0.5));
}

/**
 * Resolve citation id against retrieved chunks: exact key, case-insensitive, doc-N alias,
 * and lesson-local prefix fallback when segment index is wrong but lesson id matches.
 */
function createResolveDocFn(normalizedMap, retrievalOrder) {
  return function resolveDoc(rawId) {
    const id = rawId ? String(rawId).trim() : "";
    if (!id) return null;
    let doc = normalizedMap.get(id);
    if (doc) return doc;
    const lower = id.toLowerCase();
    for (const [key, d] of normalizedMap) {
      if (String(key).toLowerCase() === lower) return d;
    }
    if (retrievalOrder && /^doc-\d+$/i.test(id)) {
      const idx = parseInt(id.replace(/^doc-/i, ""), 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < retrievalOrder.length) {
        const kid = retrievalOrder[idx]?.knowledgeDocumentId;
        if (kid != null) {
          doc = normalizedMap.get(String(kid));
          if (doc) return doc;
        }
      }
    }
    // Wrong lessonlocal:…:segment index — still same lesson; pick best-scoring retrieved chunk for that lesson.
    if (/^lessonlocal:/i.test(id)) {
      const m = /^lessonlocal:([^:]+):/i.exec(id);
      if (m) {
        const lessonPrefix = `lessonlocal:${m[1]}:`;
        let best = null;
        let bestScore = -Infinity;
        for (const [key, d] of normalizedMap) {
          const ks = String(key);
          if (ks.toLowerCase().startsWith(lessonPrefix.toLowerCase())) {
            const sc = Number(d.score ?? 0);
            if (sc > bestScore) {
              bestScore = sc;
              best = d;
            }
          }
        }
        if (best) return best;
      }
    }
    return null;
  };
}

/**
 * @param {Map} docMap knowledgeDocumentId -> retrieval row
 * @param {Array<{ knowledgeDocumentId?: string }>|undefined} retrievalOrder same order as prompt context (for doc-0 style ids)
 */
function verifyCitations(citations, docMap, retrievalOrder) {
  const valid = [];
  const warnings = [];

  const normalizedMap = new Map();
  for (const [k, v] of docMap) {
    normalizedMap.set(String(k), v);
  }

  const resolveDoc = createResolveDocFn(normalizedMap, retrievalOrder);

  for (const c of citations || []) {
    const id = c?.knowledgeDocumentId ? String(c.knowledgeDocumentId).trim() : null;
    if (!id) continue;
    const doc = resolveDoc(id);
    if (!doc) continue;

    const quote = (c.quote || "").trim();
    const meta = doc.metadata || {};
    const blockIndex =
      meta.blockIndexStart != null ? meta.blockIndexStart : meta.blockIndex;
    const isLessonBlock = (c.sourceType || doc.sourceType) === "lessonBlock";
    const isLessonDiagram = (c.sourceType || doc.sourceType) === "lessonDiagram";
    const deepLink =
      (isLessonBlock || isLessonDiagram) && doc.sourceId
        ? {
            type: "lesson",
            lessonId: String(doc.sourceId),
            pageIndex: meta.pageIndex,
            pageId: meta.pageId,
            blockIndex: blockIndex != null ? blockIndex : 0,
            ...(meta.blockIndexEnd != null && { blockIndexEnd: meta.blockIndexEnd }),
            ...(isLessonDiagram && {
              sourceType: "lessonDiagram",
              caption: meta.caption,
              imageUrl: meta.imageUrl,
            }),
          }
        : null;

    const canonicalId = String(doc.knowledgeDocumentId != null ? doc.knowledgeDocumentId : id);

    const citationBase = {
      knowledgeDocumentId: canonicalId,
      sourceType: c.sourceType || doc.sourceType,
      sourceId: c.sourceId || doc.sourceId,
      quote: quote ? quote.slice(0, 200) : (doc.text || "").slice(0, 200),
      reason: c.reason || "",
      ...(deepLink && { deepLink }),
      ...(doc.sourceType === "externalTrusted" && {
        externalUrl: (meta.url && String(meta.url).trim()) || (meta.domain ? `https://${meta.domain}` : "#"),
      }),
      ...(doc.sourceType === "lessonDiagram" && {
        lessonId: meta.lessonId ? String(meta.lessonId) : String(doc.sourceId),
        pageId: meta.pageId,
        blockIndex: blockIndex != null ? blockIndex : 0,
        caption: meta.caption,
        imageUrl: meta.imageUrl,
      }),
    };

    if (!quote) {
      valid.push(citationBase);
      continue;
    }

    const docTextRaw = doc.text || "";
    const docText = docTextRaw.toLowerCase();
    const quoteNorm = quote.toLowerCase().replace(/\s+/g, " ").trim();
    const snippet = quoteNorm.slice(0, 150);
    if (docText.includes(snippet) || snippet.split(" ").every((w) => docText.includes(w))) {
      valid.push(citationBase);
      continue;
    }
    if (quoteMatchesDocLoosely(docTextRaw, quote)) {
      valid.push(citationBase);
      continue;
    }
    // Resolved id → trusted for this request. Non-verbatim model quotes (lists, paraphrases) still verify.
    const canonicalExcerpt = (doc.text || "").slice(0, 200);
    valid.push({
      ...citationBase,
      quote: canonicalExcerpt,
    });
  }

  // Only surface when every cited source failed verification; partial success still shows valid citations.
  if ((citations || []).length > 0 && valid.length === 0) {
    warnings.push("Some citations could not be verified");
  }

  return { valid, warnings };
}

/**
 * Temporary runtime trace: mirrors verifyCitations per-citation decisions (no side effects).
 * @returns {Array<{ knowledgeDocumentId: string|null, resolvedInDocMap: boolean, strictFailed: boolean|null, looseFailed: boolean|null, usedExcerptFallback: boolean }>}
 */
function traceCitationVerification(citations, docMap, retrievalOrder) {
  const normalizedMap = new Map();
  for (const [k, v] of docMap) {
    normalizedMap.set(String(k), v);
  }
  const resolveDoc = createResolveDocFn(normalizedMap, retrievalOrder);

  const items = [];
  for (const c of citations || []) {
    const id = c?.knowledgeDocumentId ? String(c.knowledgeDocumentId).trim() : null;
    if (!id) {
      items.push({
        knowledgeDocumentId: null,
        resolvedInDocMap: false,
        strictFailed: null,
        looseFailed: null,
        usedExcerptFallback: false,
      });
      continue;
    }
    const doc = resolveDoc(id);
    if (!doc) {
      items.push({
        knowledgeDocumentId: id,
        resolvedInDocMap: false,
        strictFailed: null,
        looseFailed: null,
        usedExcerptFallback: false,
      });
      continue;
    }
    const quote = (c.quote || "").trim();
    if (!quote) {
      items.push({
        knowledgeDocumentId: id,
        resolvedInDocMap: true,
        strictFailed: false,
        looseFailed: false,
        usedExcerptFallback: false,
      });
      continue;
    }
    const docTextRaw = doc.text || "";
    const docText = docTextRaw.toLowerCase();
    const quoteNorm = quote.toLowerCase().replace(/\s+/g, " ").trim();
    const snippet = quoteNorm.slice(0, 150);
    const strictOk =
      docText.includes(snippet) || snippet.split(" ").every((w) => docText.includes(w));
    if (strictOk) {
      items.push({
        knowledgeDocumentId: id,
        resolvedInDocMap: true,
        strictFailed: false,
        looseFailed: false,
        usedExcerptFallback: false,
      });
      continue;
    }
    const looseOk = quoteMatchesDocLoosely(docTextRaw, quote);
    if (looseOk) {
      items.push({
        knowledgeDocumentId: id,
        resolvedInDocMap: true,
        strictFailed: true,
        looseFailed: false,
        usedExcerptFallback: false,
      });
      continue;
    }
    items.push({
      knowledgeDocumentId: id,
      resolvedInDocMap: true,
      strictFailed: true,
      looseFailed: true,
      usedExcerptFallback: true,
    });
  }
  return items;
}

module.exports = { verifyCitations, traceCitationVerification };
