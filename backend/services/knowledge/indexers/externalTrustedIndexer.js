/**
 * PR-021: Index external search results as KnowledgeDocuments.
 * sourceType: externalTrusted. These are exploratory and never treated as spec.
 */
const crypto = require("crypto");
const KnowledgeDocument = require("../../../models/KnowledgeDocument");
const { embedText } = require("../../embeddings/provider");
const { upsertEmbedding, testConnection } = require("../../vector/pgvectorClient");
const { getExternalMaxSnippetChars } = require("../../../config/externalSearch");

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex").slice(0, 32);
}

function extractDomain(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * Upsert external search results into KnowledgeDocuments.
 * @param {{ results: Array<{ url, title, snippet, fetchedAt }>, specKey: string, topicKey?: string }} opts
 * @returns {Promise<Array<{ knowledgeDocumentId: string, url: string, title: string, domain: string }>>}
 */
async function indexExternalResults(opts = {}) {
  const results = opts?.results || [];
  const specKey = (opts?.specKey || "").trim();
  const topicKey = (opts?.topicKey || "").trim() || specKey;
  if (!specKey || results.length === 0) return [];

  const maxSnippet = getExternalMaxSnippetChars();
  const indexed = [];

  for (const r of results) {
    const url = (r.url || "").trim();
    if (!url) continue;

    const sourceId = sha256(url);
    const title = (r.title || "").slice(0, 300);
    const text = (r.snippet || "").slice(0, maxSnippet);
    const domain = extractDomain(url);
    const contentHash = sha256(`${url}|${text}`);

    const doc = {
      sourceType: "externalTrusted",
      sourceId,
      specKey,
      topicKey,
      title: title || `External: ${domain}`,
      text: text || "(No snippet)",
      chunkIndex: 0,
      metadata: { url, domain, fetchedAt: r.fetchedAt || new Date().toISOString() },
      contentHash,
    };

    const existing = await KnowledgeDocument.findOne({
      sourceType: "externalTrusted",
      sourceId,
      chunkIndex: 0,
    }).lean();

    let docId;
    if (!existing) {
      const created = await KnowledgeDocument.create(doc);
      docId = String(created._id);
    } else if (existing.contentHash !== contentHash) {
      await KnowledgeDocument.updateOne(
        { sourceType: "externalTrusted", sourceId, chunkIndex: 0 },
        { $set: { ...doc, updatedAt: new Date() } }
      );
      docId = String(existing._id);
    } else {
      docId = String(existing._id);
    }

    indexed.push({
      knowledgeDocumentId: docId,
      url,
      title,
      domain,
      text,
      contentHash,
    });
  }

  return indexed;
}

/**
 * Embed external docs so they appear in vector search.
 * Skips gracefully if vector DB unavailable.
 */
async function embedExternalDocs(indexed) {
  if (!indexed || indexed.length === 0) return { embedded: 0, skipped: 0 };

  try {
    await testConnection();
  } catch {
    return { embedded: 0, skipped: indexed.length };
  }

  const texts = indexed.map((x) => x.text);
  let embeddings;
  try {
    embeddings = await embedText(texts);
  } catch {
    return { embedded: 0, skipped: indexed.length };
  }

  if (embeddings.length !== indexed.length) {
    return { embedded: 0, skipped: indexed.length };
  }

  let embedded = 0;
  for (let i = 0; i < indexed.length; i++) {
    try {
      await upsertEmbedding({
        knowledgeDocumentId: indexed[i].knowledgeDocumentId,
        contentHash: indexed[i].contentHash,
        embedding: embeddings[i],
      });
      embedded++;
    } catch {
      // continue
    }
  }
  return { embedded, skipped: indexed.length - embedded };
}

module.exports = {
  indexExternalResults,
  embedExternalDocs,
};
