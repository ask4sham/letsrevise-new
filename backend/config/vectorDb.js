/**
 * PR-003: Vector DB (Postgres/pgvector) config.
 * Never logs the URL.
 */
"use strict";

function getVectorDbUrl() {
  const url = process.env.VECTOR_DB_URL || process.env.DATABASE_URL;
  if (!url || typeof url !== "string" || !url.trim()) {
    throw new Error("VECTOR_DB_URL is required for vector operations. Set it in .env");
  }
  return url.trim();
}

/** Embedding dimension (1536 for OpenAI text-embedding-ada-002 / text-embedding-3-small). */
const EMBEDDING_DIM = 1536;

module.exports = { getVectorDbUrl, EMBEDDING_DIM };
