# Curriculum → Lesson Mapping Contract (v1)

## Purpose
Define a deterministic mapping from a Curriculum Topic to one-or-more Lessons that fit the existing Lesson/Page/Block content model.
This contract is **data-only** and must not change runtime access control, monetisation, or user entitlements.

## Scope
- Input: Curriculum Spec Topic (subject/level/board/topic + subtopics + examRequirements)
- Output: A Lesson Plan Bundle: one or more lesson definitions (structure + required metadata) that can later be created as Lesson documents.

## Non-Negotiable Constraints
1. **Access control is unchanged**
   - Published ≠ free
   - `lesson.isFreePreview` controls preview availability
   - `hasAccess` is computed server-side via existing entitlement logic
2. **No AI behaviour implied by this contract**
   - This contract describes shape and requirements only
3. **No curriculum exposure**
   - Curriculum does not appear in student UI or routes due to this contract

---

## Input Shape (Topic)
A Topic is identified by:
- subject.id (slug)
- level.id (slug)
- board.id (slug)
- topic.id (slug)

Plus:
- topic.name (string)
- topic.subtopics (string[])
- topic.examRequirements (string[])

---

## Output Shape: Lesson Plan Bundle
A **Lesson Plan Bundle** is an array of Lessons, where each lesson is a self-contained learning unit.

### Cardinality Rules (v1)
- Default: **1 Topic → 1 Lesson**
- If `subtopics.length > 6` OR `examRequirements.length > 6`, allow:
  - **1 Topic → 2–4 Lessons** (split by subtopic clusters)
- Do not exceed 4 lessons per topic in v1.

### Stable Identifiers
Each generated lesson must have a stable, deterministic `slug`:

`{subjectId}-{levelId}-{boardId}-{topicId}`  
If split into multiple lessons, suffix:

`{...}-{partN}` (part1, part2, …)

Examples:
- biology-gcse-aqa-photosynthesis
- biology-gcse-aqa-photosynthesis-part2

---

## Lesson Definition Requirements (v1)

### Required Lesson Metadata
Each lesson must define:
- `slug` (stable, kebab-case, unique)
- `title` (human readable)
- `subjectId`, `levelId`, `boardId`, `topicId` (echo inputs)
- `learningObjectives[]` (3–7 items, exam-aligned)
- `keywords[]` (5–20 items)
- `examTips[]` (0–5 items)
- `commonMistakes[]` (0–5 items)

### Publication & Preview Rules (explicit)
The bundle may suggest:
- `isPublished` (default false unless explicitly approved by humans later)
- `isFreePreview` (default false)

This contract **must not** auto-publish or auto-enable previews. Those are editorial decisions.

---

## Content Structure Requirements (Page/Block compatible)
Each lesson must contain:
- `pages[]` (3–8 pages, v1)
- Each page contains `blocks[]` (2–8 blocks, v1)

### Block Types (v1 allowed set)
Blocks may only be one of:
- `explanation`
- `workedExample`
- `diagramDescription` (text-only description; no image generation implied)
- `quizCheckpoint` (1–2 MCQs per page)
- `summary`
- `examStylePrompt` (question prompt only; no mark scheme required in v1)

### Checkpoint Rules
- Every page should include 1–2 MCQs via `quizCheckpoint`
- Each MCQ includes:
  - `question`
  - `choices` (4)
  - `correctIndex` (0–3)
  - `rationale` (short explanation)
  - `misconceptionDistractors[]` (optional strings)

---

## Quality & Safety Requirements
- Must align to UK exam terminology for the given board/level
- No copyrighted textbook copying
- No claims that content is “teacher-written” unless human-reviewed
- Output should be suitable for teacher review

---

## Example Mapping (Topic → Lesson)
**Input Topic**
- subject: Biology
- level: GCSE
- board: AQA
- topic: Photosynthesis
- subtopics: Definition, Word equation, Limiting factors, Required practicals
- examRequirements: Define photosynthesis, Interpret rate graphs

**Output Lesson (single)**
slug: biology-gcse-aqa-photosynthesis  
title: Photosynthesis (AQA GCSE Biology)  
pages:
1) What photosynthesis is + word equation  
2) Limiting factors + graph interpretation  
3) Required practical overview + evaluation prompts  
Each page includes 1–2 MCQs checkpoint.

---

## Versioning
- Contract version: v1
- Breaking changes require: v2 (new file or explicit header update)
- Schema changes must remain backwards compatible within a major version when possible

