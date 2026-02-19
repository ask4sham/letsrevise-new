# Worksheets API (PR-W1) — Postman + curl smoke test

Backend base: `http://localhost:5000`  
Auth: `Authorization: Bearer <TEACHER_TOKEN>` (or your app’s auth header).

Responses below use the **actual** backend shapes: `{ worksheet }` for single resource, `{ worksheets }` for list.

---

## 1. Create worksheet

**Postman:** `POST` `http://localhost:5000/api/worksheets`  
**Headers:** `Authorization: Bearer <TEACHER_TOKEN>`, `Content-Type: application/json`

**Body (raw JSON):**
```json
{
  "title": "Cell Structure – Worksheet 1",
  "subject": "Biology",
  "examBoard": "AQA",
  "topicKey": "aqa.bio.cell.structure"
}
```

**Expected (201):**
```json
{
  "worksheet": {
    "_id": "66fae9c2c2b4c4a6a7d8e901",
    "ownerId": "6968d58e67d3b30a13273074",
    "title": "Cell Structure – Worksheet 1",
    "subject": "Biology",
    "examBoard": "AQA",
    "level": "",
    "topicKey": "aqa.bio.cell.structure",
    "status": "DRAFT",
    "questionItems": [],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**curl:**
```bash
curl -X POST http://localhost:5000/api/worksheets \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cell Structure – Worksheet 1","subject":"Biology","examBoard":"AQA","topicKey":"aqa.bio.cell.structure"}'
```

---

## 2. List worksheets (teacher / admin)

**Postman:** `GET` `http://localhost:5000/api/worksheets`  
**Headers:** `Authorization: Bearer <TEACHER_TOKEN>`

**Expected (200):**
```json
{
  "worksheets": [
    {
      "_id": "66fae9c2c2b4c4a6a7d8e901",
      "ownerId": "...",
      "title": "Cell Structure – Worksheet 1",
      "subject": "Biology",
      "examBoard": "AQA",
      "level": "",
      "topicKey": "aqa.bio.cell.structure",
      "status": "DRAFT",
      "questionItems": [],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Teacher → only their worksheets. Admin → all.

**curl:**
```bash
curl http://localhost:5000/api/worksheets -H "Authorization: Bearer <TEACHER_TOKEN>"
```

---

## 3. Get worksheet by ID

**Postman:** `GET` `http://localhost:5000/api/worksheets/<WORKSHEET_ID>`  
**Headers:** `Authorization: Bearer <TEACHER_TOKEN>`

**Expected (200):**
```json
{
  "worksheet": {
    "_id": "...",
    "ownerId": "...",
    "title": "Cell Structure – Worksheet 1",
    "questionItems": [],
    "status": "DRAFT",
    ...
  }
}
```

**curl:**
```bash
curl http://localhost:5000/api/worksheets/66fae9c2c2b4c4a6a7d8e901 -H "Authorization: Bearer <TEACHER_TOKEN>"
```

---

## 4. Update worksheet (add questions, reorder)

Example ExamQuestion IDs: `Q1 = 66fabc111111111111111111`, `Q2 = 66fabc222222222222222222`

**Postman:** `PUT` `http://localhost:5000/api/worksheets/<WORKSHEET_ID>`  
**Headers:** `Authorization: Bearer <TEACHER_TOKEN>`, `Content-Type: application/json`

**Body:**
```json
{
  "title": "Cell Structure – Practice Worksheet",
  "questionItems": [
    { "examQuestionId": "66fabc111111111111111111" },
    {
      "examQuestionId": "66fabc222222222222222222",
      "marksOverride": 3,
      "notes": "Good discriminator question"
    }
  ]
}
```

Expected: order preserved, overrides saved, `status` unchanged.

**curl:**
```bash
curl -X PUT http://localhost:5000/api/worksheets/66fae9c2c2b4c4a6a7d8e901 \
  -H "Authorization: Bearer <TEACHER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Cell Structure – Practice Worksheet","questionItems":[{"examQuestionId":"66fabc111111111111111111"},{"examQuestionId":"66fabc222222222222222222","marksOverride":3,"notes":"Good discriminator question"}]}'
```

---

## 5. Duplicate question (expected 400)

**Body:**
```json
{
  "questionItems": [
    { "examQuestionId": "66fabc111111111111111111" },
    { "examQuestionId": "66fabc111111111111111111" }
  ]
}
```

**Expected (400):**
```json
{
  "error": "Duplicate examQuestionId in questionItems"
}
```

---

## 6. Status in PUT (expected 400)

**Body:**
```json
{
  "title": "Invalid update",
  "status": "PUBLISHED"
}
```

**Expected (400):**
```json
{
  "error": "status is read-only; use /publish"
}
```

---

## 7. Publish worksheet

**Postman:** `POST` `http://localhost:5000/api/worksheets/<WORKSHEET_ID>/publish`  
**Headers:** `Authorization: Bearer <TEACHER_TOKEN>`

**Expected (200):**
```json
{
  "worksheet": {
    "_id": "...",
    "status": "PUBLISHED",
    ...
  }
}
```

**curl:**
```bash
curl -X POST http://localhost:5000/api/worksheets/66fae9c2c2b4c4a6a7d8e901/publish \
  -H "Authorization: Bearer <TEACHER_TOKEN>"
```

---

## Smoke-test checklist (~2 min)

- [ ] Create worksheet
- [ ] Add 2 questions (PUT with `questionItems`)
- [ ] Refresh GET → order persists
- [ ] Duplicate `examQuestionId` → 400
- [ ] Put `status` in PUT → 400
- [ ] Publish → 200, `status: "PUBLISHED"`
- [ ] List → shows updated worksheet

---

## Frontend data contracts (PR-W2)

- **Create:** `POST /api/worksheets` → response `{ worksheet: Worksheet }`; frontend uses `data.worksheet`.
- **Get one:** `GET /api/worksheets/:id` → `{ worksheet: Worksheet }`.
- **List:** `GET /api/worksheets` → `{ worksheets: Worksheet[] }`.
- **Update:** `PUT /api/worksheets/:id` body `{ title?, subject?, examBoard?, level?, topicKey?, questionItems? }` → `{ worksheet: Worksheet }`. No `status` in body.
- **Publish:** `POST /api/worksheets/:id/publish` → `{ worksheet: Worksheet }`.

`Worksheet.questionItems[]`: `{ examQuestionId: string, marksOverride?: number, notes?: string }`. Order is significant; duplicate `examQuestionId` returns 400.
