/**
 * PR-003: Embeddings provider abstraction.
 * embedText(texts) -> Promise<number[][]>
 * Supports mock (dev) and openai.
 */
const crypto = require("crypto");
const { EMBEDDING_DIM } = require("../../config/vectorDb");

const MAX_TEXT_LENGTH = 8000;
const BATCH_SIZE = 16;

function getProvider() {
  const p = (process.env.EMBEDDINGS_PROVIDER || "mock").toLowerCase().trim();
  return p === "openai" ? "openai" : "mock";
}

/**
 * Deterministic fake embedding from hash (dev-only).
 * Returns a normalized vector of EMBEDDING_DIM.
 */
function mockEmbed(text) {
  const h = crypto.createHash("sha256").update(text, "utf8").digest("hex");
  const arr = [];
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const sub = h.slice((i * 2) % 64, (i * 2 + 4) % 64 + 4) || h;
    arr.push((parseInt(sub, 16) % 1000) / 1000 - 0.5);
  }
  const norm = Math.sqrt(arr.reduce((s, x) => s + x * x, 0)) || 1;
  return arr.map((x) => x / norm);
}

/**
 * OpenAI embeddings API.
 */
async function openaiEmbed(texts) {
  const axios = require("axios");
  const apiKey = process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("EMBEDDINGS_API_KEY or OPENAI_API_KEY required for openai provider");
  const model = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";
  const res = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { input: texts, model },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const data = res.data?.data;
  if (!Array.isArray(data)) throw new Error("Unexpected OpenAI embeddings response");
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Embed texts. Batches, trims, skips empty.
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedText(texts) {
  const provider = getProvider();
  const trimmed = texts.map((t) => {
    if (t == null || typeof t !== "string") return "";
    const s = t.trim();
    if (s.length > MAX_TEXT_LENGTH) {
      console.warn(`[embeddings] Truncated text from ${s.length} to ${MAX_TEXT_LENGTH} chars`);
      return s.slice(0, MAX_TEXT_LENGTH);
    }
    return s;
  });
  const nonEmpty = trimmed.map((t, i) => ({ t, i })).filter((x) => x.t.length > 0);
  if (nonEmpty.length === 0) return [];

  const results = new Array(texts.length);
  for (let i = 0; i < nonEmpty.length; i += BATCH_SIZE) {
    const batch = nonEmpty.slice(i, i + BATCH_SIZE);
    const batchTexts = batch.map((x) => x.t);
    let embeddings;
    if (provider === "openai") {
      embeddings = await openaiEmbed(batchTexts);
    } else {
      embeddings = batchTexts.map((t) => mockEmbed(t));
    }
    batch.forEach((x, j) => {
      results[x.i] = embeddings[j];
    });
  }
  return results;
}

module.exports = { embedText, getProvider, BATCH_SIZE, MAX_TEXT_LENGTH };
