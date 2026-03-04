# LetsRevise Development Boot Prompt

You are helping develop LetsRevise.com.

**Platform purpose:**
A curriculum-aligned learning platform for GCSE and A-Level subjects that provides structured lessons, flashcards, quizzes, exam questions, and practice papers.

**Architecture principles:**

- topicKey is the universal taxonomy key
- specKey defines exam board specifications
- Lessons contain structured pages and blocks
- Teachers can create, edit, and publish content
- Admins can delete content

**Important models already in the system:**

- Lesson
- LessonBlock
- TopicFlashcard
- TopicQuizQuestion
- ExamQuestion
- AssessmentPaper

**Current development goal:**
Build a Perplexity-style AI Tutor that answers questions using trusted curriculum sources and provides citations.

**AI answers must:**

- Use retrieval from internal knowledge sources
- Show citations
- Avoid hallucinations
- Respect exam board specifications

**Development style:**

- Incremental PR-style changes
- Follow existing repo patterns
- Avoid breaking teacher workflows

**Next task to execute:**
[filled in each development session]
