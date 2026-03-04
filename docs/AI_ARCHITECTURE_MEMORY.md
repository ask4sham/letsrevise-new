# LetsRevise AI Architecture Memory

## Platform Overview

LetsRevise is a curriculum-aligned learning platform for GCSE and A-Level students.
The system provides structured lessons, flashcards, quizzes, exam questions, and practice papers organised by curriculum taxonomy.

Teachers create and manage lessons through an editor, and students access structured learning and practice through the lesson view.

## Core Taxonomy

The system is organised using two keys:

**specKey**
Example: AQA_GCSE_BIOLOGY

**topicKey**
Example: aqa-gcse-biology:cell-structure

topicKey is the universal join key used across lessons, questions, flashcards, and exams.

## Current Implemented Systems

### Lesson System

- Teacher editor: EditLessonPage
- Student lesson view: LessonViewPage
- Lessons contain structured pages and blocks

### Practice Questions

- Students see a single Practice Questions section
- Source: /lessons/:id/practice endpoint
- Fallback: lesson.assessment.questions ("Quick Check")

### Quick Check

- Stored in lesson.assessment.questions
- Generated from topic when teacher clicks "Generate Quick Check"

### Practice Papers

- Stored as lesson.assessmentPaperIds
- Attached through AttachPaperModal
- Rendered via AttachedAssessmentPapersPanel

### Assessment Papers API

- Supports pagination
- fields=summary
- mineOnly filter
- text search parameter q

### Maintenance Scripts

- backend/scripts/dedupLessonPracticeSources.js
- backend/scripts/runDedupLessonPracticeSources.js

Safety features:

- Dry run default
- APPLY ALL or APPLY <SPEC_KEY> confirmation

### Validation Issues System

- "Issues to fix" callout in teacher UI
- Detects incomplete quiz questions and flashcards
- Provides jump navigation to fix content

## Known Gaps

**Quiz Bank page:**

- Teachers cannot currently edit or publish quiz questions
- Admin deletion exists but teacher editing UI is missing

**Specification Coverage**

- SpecStatement model not implemented yet

**AI Tutor Components**

- KnowledgeDocument abstraction not implemented
- Embedding pipeline not implemented
- Retrieval API not implemented
- Enquiry API not implemented

## Product Rules (Teacher Trust)

AI responses must only use trusted sources.

Trusted sources in v1 include:

- Lesson blocks
- Flashcards
- Quiz questions
- Exam questions
- Spec statements (when implemented)

Every AI answer must provide citations to internal sources.

If sources are insufficient the AI must say so instead of hallucinating.

All queries must be scoped by:

- specKey
- examBoard
- level
- topicKey
- tier (when applicable)

## AI Tutor System Plan

SpecStatement model
→ KnowledgeDocument abstraction
→ Embedding pipeline
→ Retrieval API
→ Enquiry API (RAG)
→ Citation system
→ Practice generation
→ Evaluation harness
