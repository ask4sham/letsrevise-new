# Cursor Repro Rule — Adding Any New Subject / Spec

**This rule applies to ALL future subjects. No exceptions.**

---

## 1️⃣ Source of truth = Taxonomy JSON

Every subject must start with a taxonomy file:

```
backend/config/<specKey>_topics.json
```

**Required structure (no deviations):**

```json
{
  "subject": "...",
  "examBoard": "...",
  "level": "...",
  "specKey": "...",
  "tier": [],
  "units": [
    {
      "unit": "SS1. ...",
      "key": "ss1-...",
      "topics": [
        {
          "topic": "...",
          "key": "...",
          "tier": [],
          "requiredPractical": false
        }
      ]
    }
  ]
}
```

**Rules:**

- Keys are lowercase, hyphenated
- Topic keys are unique within the spec
- Repeated headings (e.g. Context, Mark Scheme) must be prefixed by unit
- JSON is the single source of truth

---

## 2️⃣ Backend must expose taxonomy

Every new spec must be reachable via:

```
GET /api/taxonomy/<specKey>
```

**Implementation checklist:**

- Import/load JSON in `backend/utils/topicTaxonomy.js`
- Add a `getTaxonomyBySpecKey(specKey)` case
- Add loader (e.g. `loadXTaxonomy()`), getter (e.g. `getXTopics()`), finder (e.g. `findXTopicByKey()`)
- Add `isValidTopicForSpec` and `findTopicBySpecAndKey` cases for the new spec
- Add route in `backend/routes/taxonomy.js`
- No hard-coded subject logic anywhere else

---

## 3️⃣ Tests are mandatory

Each spec must have an integration test that checks:

- HTTP 200
- `specKey` matches
- `units.length > 0`
- Expected unit names exist (e.g. SS1)

**If no test → PR is incomplete.**

Place tests in `backend/tests/` (e.g. `taxonomy.<specName>.integration.test.js`).

---

## 4️⃣ Frontend must use specKey

Every subject must be selectable via:

- `frontend/src/components/SpecSelector.tsx`

**Rules:**

- Value = `specKey`
- Add `specKey` to `SpecKey` type in `frontend/src/api/taxonomy.ts`
- UI must rely on `useTaxonomy(specKey)`
- No subject-specific conditionals in UI

---

## 5️⃣ TopicKey namespacing is mandatory

All stored content must use:

```
<specKey>:<topicKey>
```

**Rules:**

- Writes → always namespaced
- Reads → `$in` with namespaced + legacy fallback (see `topicKey.js` `queryCandidates`)
- New specs must never write legacy keys

---

## 6️⃣ Definition of Done (hard gate)

A subject is **not complete** unless:

- [ ] `/api/taxonomy/<specKey>` works
- [ ] SpecSelector switches cleanly
- [ ] Topic pickers populate
- [ ] Banks + lessons respect specKey
- [ ] Tests pass
- [ ] No topicKey collisions

---

## 7️⃣ Standard PR sequence

All future subjects follow this exact order:

| PR       | Scope                                      |
|----------|--------------------------------------------|
| **PR-X-1** | Taxonomy JSON + loader + route + API + tests |
| **PR-X-2** | SpecSelector + SpecKey + UI verification     |
| **PR-X-3** (optional) | Ingestion / validation / tooling          |

---

## Reference: existing specs

| specKey                      | Config file                                      |
|-----------------------------|--------------------------------------------------|
| aqa-gcse-biology            | aqa_gcse_biology_topics.json                     |
| aqa-gcse-chemistry         | aqa_gcse_chemistry_topics.json                   |
| aqa-gcse-physics            | aqa_gcse_physics_topics.json                     |
| aqa-gcse-maths-foundation   | aqa_gcse_maths_foundation_topics.json            |
| aqa-gcse-maths-higher       | aqa_gcse_maths_higher_topics.json                |
| aqa-l2-further-maths        | aqa_l2_further_maths_topics.json                 |
| aqa-gcse-english-literature | aqa_gcse_english_literature_topics.json          |
| aqa-gcse-english-language   | aqa_gcse_english_language_topics.json            |

Use these as the pattern for any new subject.
