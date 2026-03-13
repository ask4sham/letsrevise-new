/**
 * PR-024: Shared citation verification.
 * Extracted from enquiry.controller for reuse by topic summary.
 * Verify: cited knowledgeDocumentId must be in retrieved set, quote must appear in source text.
 */
function verifyCitations(citations, docMap) {
  const valid = [];
  const warnings = [];

  for (const c of citations || []) {
    const id = c?.knowledgeDocumentId ? String(c.knowledgeDocumentId).trim() : null;
    if (!id) continue;
    const doc = docMap.get(id);
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

    const citationBase = {
      knowledgeDocumentId: id,
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

    const docText = (doc.text || "").toLowerCase();
    const quoteNorm = quote.toLowerCase().replace(/\s+/g, " ").trim();
    const snippet = quoteNorm.slice(0, 150);
    if (docText.includes(snippet) || snippet.split(" ").every((w) => docText.includes(w))) {
      valid.push(citationBase);
    }
  }

  const dropped = (citations || []).length - valid.length;
  if (dropped > 0) {
    warnings.push("Some citations could not be verified");
  }

  return { valid, warnings };
}

module.exports = { verifyCitations };
