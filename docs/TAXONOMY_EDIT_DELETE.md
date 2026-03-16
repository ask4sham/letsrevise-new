# Taxonomy Edit / Delete Support

Admin Taxonomy Manager (`/admin/taxonomy`) supports full CRUD for main topics and sub-topics added via admin (not static config). Deletions are guarded by linked content.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| PATCH | `/api/admin/taxonomy/main-topic/:id` | Rename main topic (title, optional slug) |
| PATCH | `/api/admin/taxonomy/sub-topic/:id` | Rename sub-topic (title; slug only if no linked content) |
| DELETE | `/api/admin/taxonomy/main-topic/:id` | Delete main topic (blocked if sub-topics or linked content) |
| DELETE | `/api/admin/taxonomy/sub-topic/:id` | Delete sub-topic (blocked if linked content) |
| POST | `/api/admin/taxonomy/sub-topic/:id/move` | Move sub-topic to another main topic (body: `{ targetMainTopicId }`) |

## Deletion Safeguards

- **Main topic**: Cannot delete if it has sub-topics or if any sub-topic has linked content (lessons, flashcards, quizzes, exam questions).
- **Sub-topic**: Cannot delete if it has linked content.

When blocked, the API returns 409 with:
```json
{
  "error": "Topic has linked content",
  "linkedCounts": { "lessons": 2, "flashcards": 5, "quizzes": 0, "examQuestions": 1 }
}
```

## Slug / topicKey Editing

- **Main topic**: Slug (unitKey) can be edited. Sub-topics under it are updated to reference the new unitKey. Content uses sub-topic topicKeys (specKey:key), so main topic slug changes do not break content links.
- **Sub-topic**: Slug (key) is part of topicKey. If the topic has linked content, slug cannot be changed (only display title). If no linked content, slug can be changed.

## Content Graph

After taxonomy rename or move, consider running **Rebuild Graph For Spec** on the Content Coverage page so graph nodes stay in sync. No automatic rebuild is triggered.
