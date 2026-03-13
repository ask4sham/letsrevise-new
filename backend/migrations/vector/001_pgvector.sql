-- PR-003: pgvector schema for KnowledgeDocument embeddings.
-- Run via: node backend/scripts/runVectorMigrations.js

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  knowledge_document_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_content_hash ON knowledge_embeddings (content_hash);

-- HNSW index for cosine similarity (works on empty tables, unlike ivfflat)
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_embedding_cosine
  ON knowledge_embeddings
  USING hnsw (embedding vector_cosine_ops);
