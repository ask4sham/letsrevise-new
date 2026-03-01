# Sprint: AQA GCSE Biology — Cell Biology (Week 1)

## Sprint goal
Ship **Classroom-Ready** lessons for the first 6 Cell Biology sub-topics using the new taxonomy, topicKey, and auto-attach pipelines.

This sprint validates:
- TopicKey → lesson → banks → practice loop
- Teacher UX from Create → Edit → Student view
- Readiness scoring + auto-attached content labels

---

## Scope (Batch A)

| # | Sub-topic | topicKey | Target status |
|---|----------|----------|---------------|
| 1 | Cell structure | aqa-gcse-biology:cell-structure | Classroom-Ready |
| 2 | Animal and plant cells | aqa-gcse-biology:animal-plant-cells | Classroom-Ready |
| 3 | Eukaryotes and prokaryotes | aqa-gcse-biology:eukaryotes-prokaryotes | Classroom-Ready |
| 4 | Cell specialisation | aqa-gcse-biology:cell-specialisation | Classroom-Ready |
| 5 | Cell differentiation | aqa-gcse-biology:cell-differentiation | Classroom-Ready |
| 6 | Microscopy | aqa-gcse-biology:microscopy | Classroom-Ready |

---

## Definition of Done

### Minimum Publishable (must pass)
- Correct **topicKey** set via taxonomy dropdowns
- ≥ 1 page
- ≥ 1 diagram
- ≥ 1 checkpoint
- Quiz present (manual or auto-attached)
- Flashcards present (manual or auto-attached)
- Lesson marked **Reviewed**

### Classroom-Ready (sprint target)
- 2–4 pages, clean sequencing
- 2+ diagrams where conceptually useful
- ≥ 2 checkpoints (placed immediately after key ideas)
- Quiz balanced (MCQ + short answer)
- Flashcards reviewed for clarity (no vague cards)
- Misconceptions block included
- Exam tips added where applicable
- Student view visually clean and scannable

---

## Operating model (repeat per sub-topic)

1. **Create lesson**
   - Create Lesson (manual or AI)
   - Subject → Spec → Main topic → Sub-topic
   - Confirm topicKey auto-filled

2. **Auto-attach baseline**
   - Keep "Auto-generate from topic banks" enabled
   - Verify quiz + flashcards attached

3. **Build lesson**
   - Add pages
   - Insert diagrams
   - Add checkpoints
   - Add misconceptions + exam tips

4. **Review**
   - Use 5-minute rubric (see [REVIEW_RUBRIC_5MIN.md](./REVIEW_RUBRIC_5MIN.md))
   - Fix issues
   - Mark lesson reviewed

5. **Bank hygiene**
   - Only save cleaned quiz/flashcards back to banks
   - Never save raw AI output

---

## Sprint metrics (end of week)
- 6 lessons Classroom-Ready
- 0 lessons without topicKey
- 100% lessons show readiness "Ready to publish" or "Classroom-Ready"
- At least 1 student view sanity check per lesson

---

## Sub-topic checklist template (reuse per lesson)

Use this for each lesson PR or as a personal checklist.

### Sub-topic checklist — `SUB-TOPIC TITLE`

**TopicKey:** `specKey:topicSlug`

#### Structure
- [ ] 2–4 pages
- [ ] One clear idea per page
- [ ] Page titles meaningful (not generic)

#### Core content
- [ ] Accurate GCSE-level explanations
- [ ] Key terms introduced before use
- [ ] No unnecessary verbosity

#### Diagrams
- [ ] ≥ 1 diagram
- [ ] Labels readable
- [ ] Diagram placed immediately after explanation

#### Checkpoints
- [ ] ≥ 2 checkpoints
- [ ] Questions test understanding, not recall only
- [ ] Positioned after key concepts

#### Quiz
- [ ] Quiz present
- [ ] Mix of MCQ + short answer
- [ ] No ambiguous correct answers
- [ ] Tagged correctly (auto-attached or manual)

#### Flashcards
- [ ] Flashcards present
- [ ] Front = clear question / term
- [ ] Back = concise, exam-appropriate answer
- [ ] No vague "describe/explain" cards

#### Exam awareness
- [ ] Misconceptions block included
- [ ] Exam tips added where relevant

#### Final checks
- [ ] Student view clean and readable
- [ ] Lesson marked reviewed

---

## Notes
- Multiple lessons per topic are allowed.
- Reuse suggestions are advisory, never blocking.
- Auto-attached content is a starting point, not final authority.
