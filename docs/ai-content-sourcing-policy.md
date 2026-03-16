# AI Content Sourcing Policy

## Overview

LetsRevise uses trusted internal sources for AI-generated curriculum content (explanations, questions, flashcards). This policy defines what sources are allowed and how they are used.

## Allowed sources

1. **SpecStatements** — Structured exam board specification requirements, ingested from official spec documents.
2. **Lesson blocks** — Teacher-authored lesson content.
3. **Teacher notes** — Teacher annotations and guidance.
4. **Lesson diagrams** — Teacher-uploaded or AI-generated diagrams with verified context.

## Official exam board specs

Official exam board specification documents may be **ingested as structured curriculum inputs** for original AI generation. See [Content Graph Rollout — Spec Document Ingestion](content-graph-rollout.md#20-spec-document-ingestion).

- Ingestion is from **official exam board documents** provided to the system (upload or server path).
- No web scraping of third-party educational sites.
- Statements are parsed, mapped to taxonomy topics, and stored as SpecStatements.
- Only high-confidence mappings are auto-saved; unmapped statements require manual review.

## Prohibited

- Scraping random educational websites for content.
- Using copyrighted textbook prose without permission.
- Copying explanatory wording from external sources into generated content.

## Draft Question Library Generation

The **Draft Question Library** (`/admin/draft-library`) uses **SpecStatements only** as the source for AI-generated flashcards and exam questions. See [Content Graph Rollout — Draft Question Library](content-graph-rollout.md#115-draft-question-library).

- **Source:** Official exam board SpecStatements (structured curriculum requirements).
- **Output:** Original draft content for teacher review before publishing.
- **No external content:** Does not use KnowledgeDocument retrieval or third-party educational sites.
- **Metadata:** `metadata.sourceType = "spec_statements_only"` and `metadata.generatorMode = "draft_library"` for traceability.

## Summary

Store curriculum statements, not generated teaching prose. Keep ingestion auditable and reviewable. Prefer high-confidence mapping only.
