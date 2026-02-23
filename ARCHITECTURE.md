# Architecture — Multi-Spec Taxonomy & Namespaced Topic Keys

## Purpose

LetsRevise supports multiple specs (AQA now; OCR/Edexcel/WJEC later) without collisions.

This is achieved by:

- a taxonomy per spec (JSON source of truth)
- a single normalized taxonomy API shape
- namespaced topic keys in storage: `specKey:topicKey` with legacy read fallback

## Taxonomy

Each spec has:

- `backend/config/<spec>_topics.json`

API:

- `GET /api/taxonomy/<specKey>`

Payload shape:

- `{ subject, examBoard, level, specKey, units: [...] }`

Units:

- `unit` (display name)
- `key` (slug)
- `topics[]`

Topics:

- `topic` (display name)
- `key` (slug)
- `tier` (array)
- `requiredPractical` (boolean)

## Storage: Topic Key Namespacing

All saved items store:

- `topicKey = specKey:topicKey`

All queries use:

- candidates = `[specKey:topicKey, topicKey]` (supports legacy docs)

## Guardrails

A validator runs in CI:

- ensures schema completeness
- enforces slug rules
- prevents duplicate unit/topic keys within a spec
- prevents accidental `:` inside taxonomy keys

This ensures future exam boards can be added consistently.

Run: `cd backend && npm run validate:taxonomies`

See: [docs/ADDING_NEW_SUBJECT_SPEC.md](docs/ADDING_NEW_SUBJECT_SPEC.md) for the full adding-new-spec rule.
