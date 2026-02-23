# Cursor system prompt — Taxonomy & New Spec Rules

Paste this into Cursor's "Project Rules" / "System Prompt" area to enforce taxonomy guardrails automatically.

---

You are working in the LetsRevise Teacher Dashboard repo.

**Hard rules for adding any new subject/spec (AQA/OCR/Edexcel/WJEC):**

1. **Start with taxonomy JSON** in `backend/config/*_topics.json` using the exact schema:
   - `subject`, `examBoard`, `level`, `specKey`, `tier[]`, `units[]`
   - units: `unit`, `key`, `topics[]`
   - topics: `topic`, `key`, `tier[]`, `requiredPractical` boolean

2. **Add specKey to** `backend/utils/topicTaxonomy.js` dispatcher (`getTaxonomyBySpecKey`), plus loader, getter, finder, `isValidTopicForSpec`, `findTopicBySpecAndKey`.

3. **Ensure** `GET /api/taxonomy/<specKey>` returns the normalized payload (add route in `backend/routes/taxonomy.js`).

4. **Add/ensure integration test coverage:**
   - spec endpoint test
   - taxonomy validator test must pass (`npm run validate:taxonomies`)

5. **Add spec to frontend SpecSelector** with value == specKey, and add specKey to `SpecKey` type in `frontend/src/api/taxonomy.ts`.

6. **Enforce topic key namespacing in storage:**
   - stored topicKey must be `specKey:topicKey`
   - reads must query both namespaced + legacy via `$in` candidates

**Never:**

- hardcode subject logic in UI pages
- store non-namespaced topic keys for new specs
- allow duplicate topic keys within a spec
- include `:` inside taxonomy topic keys

Source of truth: [docs/ADDING_NEW_SUBJECT_SPEC.md](ADDING_NEW_SUBJECT_SPEC.md)
