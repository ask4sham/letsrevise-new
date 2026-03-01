# Content sprint tracker

## Source of truth

- **TAXONOMY_TOPIC_LIST.csv** — Exported from the taxonomy (Subject → Main topic → Sub-topic). It is generated from `backend/config/*_topics.json` and is the authoritative list of leaf topics. Do not edit it for tracking; use it only as reference.

- **CONTENT_SPRINT_TRACKER.csv** — The working tracker. It contains every row from the taxonomy list plus columns for content counts and status. This is the file you edit (in Excel/Google Sheets) to track progress.

## Regenerating the tracker

If the taxonomy changes (new topics/specs) or you want a fresh tracker with default targets and zeros:

```bash
cd backend
npm run create:content-sprint-tracker
```

This overwrites `docs/CONTENT_SPRINT_TRACKER.csv` with all rows from `docs/TAXONOMY_TOPIC_LIST.csv` and appends the tracker columns with defaults. **If you have already updated the tracker with progress, do not regenerate** unless you are okay losing those edits. To refresh from taxonomy without losing data you would need a custom merge (not provided here).

## Filtering in Excel / Google Sheets

To work on a single subject/spec/main topic:

1. **Subject**  
   - Filter column **subject**  
   - e.g. *Text contains* → `Biology`

2. **Spec**  
   - Filter column **specKey**  
   - Use the exact value from the CSV (e.g. Biology AQA GCSE: `aqa-gcse-biology`).

3. **Main topic**  
   - Filter column **mainTopicTitle**  
   - e.g. *Equals* → `Cell Biology` (copy/paste the exact value from the CSV to avoid typos)

The filtered rows are the leaf topics for that scope in the correct order. Use **topicKey** as the stable identifier when creating or linking content (e.g. flashcards, MCQs, short answers).

## Tracker columns (appended)

| Column              | Default   | Meaning                          |
|---------------------|-----------|----------------------------------|
| mcq_target          | 10        | Target number of MCQs per topic  |
| mcq_done            | 0         | MCQs created so far             |
| short_target        | 5         | Target short-answer questions    |
| short_done          | 0         | Short answers created            |
| flashcard_target    | 10        | Target flashcards                |
| flashcard_done      | 0         | Flashcards created               |
| examq_target        | 2         | Target exam/past-paper questions |
| examq_done          | 0         | Exam questions added             |
| status              | NOT_STARTED | IN_PROGRESS / DONE             |
| owner               | (blank)   | Who is responsible               |
| notes               | (blank)   | Free-form notes                  |
| last_updated        | (blank)   | Date or timestamp of last update |

Update `*_done` and `status` as you complete content for each leaf topic.
