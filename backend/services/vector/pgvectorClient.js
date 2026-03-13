/**
 * PR-003: pgvector client for KnowledgeDocument embeddings.
 * Uses cosine similarity for search.
 * Connection errors include friendly hints (never logs credentials).
 */
const { getVectorDbUrl, EMBEDDING_DIM } = require("../../config/vectorDb");

let _pool = null;

function getPool() {
  if (!_pool) {
    const pg = require("pg");
    _pool = new pg.Pool({ connectionString: getVectorDbUrl(), max: 5 });
  }
  return _pool;
}

/**
 * Wrap connection errors with actionable hints. Does NOT log VECTOR_DB_URL.
 */
function formatConnectionError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  let hint = "";
  if (msg.includes("password authentication failed")) {
    hint = "Check VECTOR_DB_URL credentials (user/password).";
  } else if (msg.includes("does not exist") || (msg.includes("database") && msg.includes("exist"))) {
    hint = "Create the database or run: npm run vector:up && npm run vector:migrate";
  } else if (msg.includes("econnrefused") || msg.includes("connection refused")) {
    hint = "Start Postgres: npm run vector:up (Docker) or ensure Postgres is running.";
  } else if (msg.includes("extension") && msg.includes("vector")) {
    hint = "Use pgvector image: docker compose -f docker-compose.vector.yml up -d";
  } else if (msg.includes("pg_hba.conf") || msg.includes("no pg_hba.conf")) {
    hint = "Postgres host auth rejected. Use Docker vector DB: npm run vector:up";
  }
  if (hint) {
    const e = new Error(err.message + (err.message.endsWith(".") ? " " : ". ") + "Hint: " + hint);
    e.cause = err;
    return e;
  }
  return err;
}

/**
 * Upsert embedding by knowledge_document_id.
 * @param {{ knowledgeDocumentId: string, contentHash: string, embedding: number[] }}
 */
async function upsertEmbedding({ knowledgeDocumentId, contentHash, embedding }) {
  try {
    const pool = getPool();
    const vec = `[${embedding.join(",")}]`;
    await pool.query(
      `INSERT INTO knowledge_embeddings (knowledge_document_id, content_hash, embedding, updated_at)
       VALUES ($1, $2, $3::vector, NOW())
       ON CONFLICT (knowledge_document_id)
       DO UPDATE SET content_hash = $2, embedding = $3::vector, updated_at = NOW()`,
      [knowledgeDocumentId, contentHash, vec]
    );
  } catch (err) {
    throw formatConnectionError(err);
  }
}

/**
 * Get embedding meta by ID.
 * @param {string} knowledgeDocumentId
 * @returns {{ contentHash: string } | null}
 */
async function getEmbeddingMeta(knowledgeDocumentId) {
  try {
    const pool = getPool();
    const r = await pool.query(
      "SELECT content_hash FROM knowledge_embeddings WHERE knowledge_document_id = $1",
      [knowledgeDocumentId]
    );
    if (r.rows.length === 0) return null;
    return { contentHash: r.rows[0].content_hash };
  } catch (err) {
    throw formatConnectionError(err);
  }
}

/**
 * Search by vector similarity (cosine).
 * Returns top K IDs + scores (1 - cosine_distance, so higher = more similar).
 * @param {{ queryEmbedding: number[], limit?: number }} opts
 * @returns {Promise<Array<{ knowledgeDocumentId: string, score: number }>>}
 */
async function searchEmbeddings({ queryEmbedding, limit = 50 }) {
  try {
    const pool = getPool();
    const vec = `[${queryEmbedding.join(",")}]`;
    const k = Math.min(100, Math.max(1, limit));
    const r = await pool.query(
      `SELECT knowledge_document_id, 1 - (embedding <=> $1::vector) AS score
       FROM knowledge_embeddings
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vec, k]
    );
    return r.rows.map((row) => ({
      knowledgeDocumentId: row.knowledge_document_id,
      score: parseFloat(row.score),
    }));
  } catch (err) {
    throw formatConnectionError(err);
  }
}

/**
 * Test that Vector DB connection works. Throws with formatted error on failure.
 */
async function testConnection() {
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
  } catch (err) {
    throw formatConnectionError(err);
  }
}

module.exports = {
  upsertEmbedding,
  getEmbeddingMeta,
  searchEmbeddings,
  testConnection,
  EMBEDDING_DIM,
};
