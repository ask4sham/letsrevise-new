# Spec scaffold micro-prompt

Paste this into Cursor and fill in the placeholders.

---

Create a new spec scaffold for:

- **subject:** <...>
- **examBoard:** <AQA / OCR / Edexcel / WJEC>
- **level:** <GCSE / Level 2 / etc>
- **specKey:** <...>
- **units and topics:** <paste headings/topics>

You must:

- create `backend/config/<file>_topics.json` in correct schema
- wire `backend/utils/topicTaxonomy.js` dispatcher for specKey
- ensure `GET /api/taxonomy/<specKey>` works (route or param route)
- add backend integration test
- add SpecSelector option
- keep topic keys unique and slugged
- include verification commands
