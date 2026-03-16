# Adaptive Revision Engine Implementation

## Summary

The adaptive revision engine extends the canonical mastery system with spaced repetition scheduling and difficulty adaptation. It does **not** replace canonical mastery (LearningEvidenceEvent / studentTopicEvidenceService).

## Algorithm

### Priority Formula

```
priorityScore =
  (100 - masteryScore) * 0.35   // mastery gap
  + overdueDaysScore * 0.20     // spaced repetition
  + difficultyScore * 0.20      // adaptive difficulty
  + daysSinceLastReviewScore * 0.15
  + examReadinessScore * 0.10
```

Weights are defined in `adaptiveRevisionService.WEIGHTS`.

### Spaced Repetition Schedule

| Success count | Next interval |
|---------------|---------------|
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 14 days |
| 5+ | 30 days |

Hard / poor performance resets to 1–2 days.

### Adaptive Difficulty

Per-topic labels: `easy` | `moderate` | `hard` | `very_hard`

Derived from:
- quiz accuracy
- exam accuracy
- flashcard average difficulty rating
- mastery score

## Data Model

### StudentTopicReviewState

| Field | Type | Purpose |
|-------|------|---------|
| userId | ObjectId | Student |
| specKey | string | Spec (e.g. aqa-gcse-biology) |
| topicKey | string | Namespaced topic key |
| lastReviewedAt | Date | Last practice time |
| nextReviewAt | Date | Next scheduled review |
| intervalDays | number | Current interval |
| easeFactor | number | Reserved for future |
| lastDifficultyRating | number | 1–5 from flashcard |
| successCount | number | Consecutive successes |
| updatedAt | Date | Last update |

Indexes: `{ userId, specKey, topicKey }` (unique), `{ userId, specKey, nextReviewAt }`

## Integration Points

- **studentDashboardService**: Calls `getAdaptiveRevisionData`, adds `dueToday`, `overdueTopics`, `adaptiveRecommendations` to dashboard response. Enriches study plan with adaptive reasons.
- **progress.routes.js** (POST /flashcard-review): Calls `updateReviewStateAfterSession` after evidence recording.
- **practiceAttempts.js** (POST /): Calls `updateReviewStateAfterSession` after quiz/exam attempt recording.

## Revision Reasons

| Condition | Reason |
|-----------|--------|
| Overdue | "Overdue review" |
| Due today | "Due today" |
| Hard/very_hard + low mastery | "Low mastery and recent difficulty" |
| Hard/very_hard | "Recently struggled" |
| Mastery 70–84 | "Ready for exam practice" |
| >7 days since review | "Needs refresh" |
| Default | "Consider revising this topic" |

## Confirmation

- Canonical mastery remains unchanged (LearningEvidenceEvent, studentTopicEvidenceService).
- Adaptive service consumes specEvidence and adds adaptation logic only.
- No duplicate mastery computation.
