/**
 * Asset autopilot — runs generateLessonAssets for lessons missing bank drafts (flashcards/quiz).
 * Exam generation off by default. Idempotent: skips when snapshot already satisfied thresholds.
 */
const Lesson = require("../../models/Lesson");
const TopicFlashcard = require("../../models/TopicFlashcard");
const TopicQuizQuestion = require("../../models/TopicQuizQuestion");
const { generateLessonAssets, META_SOURCE } = require("../generateLessonAssets");
const { extractLessonTextForAssets } = require("../../utils/extractLessonTextForAssets");

const MIN_FC = 5;
const MIN_QUIZ = 3;

function lessonUpdatedAtIso(lesson) {
  if (lesson.updatedAt == null) return new Date().toISOString();
  const d = lesson.updatedAt instanceof Date ? lesson.updatedAt : new Date(lesson.updatedAt);
  return d.toISOString();
}

/**
 * @param {{ specKey?: string, adminUserId?: string, dryRun?: boolean, lessonLimit?: number, autopilotRunId?: string }} opts
 */
async function runAssetAutopilot(opts) {
  const { specKey, adminUserId, dryRun = false, lessonLimit = 40 } = opts;

  const q = {
    status: "draft",
    specKey: { $exists: true, $nin: [null, ""] },
    topicKey: { $exists: true, $nin: [null, ""] },
    teacherId: { $exists: true },
  };
  if (specKey) q.specKey = specKey;

  const lessons = await Lesson.find(q)
    .sort({ updatedAt: -1 })
    .limit(Math.min(200, Math.max(1, lessonLimit)))
    .lean();

  const topicResults = [];
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const lesson of lessons) {
    const lessonId = String(lesson._id);
    const ownerId = lesson.teacherId;
    if (!ownerId) {
      skipped += 1;
      continue;
    }

    const { text } = extractLessonTextForAssets(lesson);
    if (!text || text.length < 80) {
      skipped += 1;
      continue;
    }

    const snap = lessonUpdatedAtIso(lesson);
    const fcQ = {
      ownerId,
      status: "draft",
      "metadata.source": META_SOURCE,
      "metadata.lessonId": lessonId,
      "metadata.lessonUpdatedAt": snap,
    };
    const [fcCount, qCount] = await Promise.all([
      TopicFlashcard.countDocuments(fcQ),
      TopicQuizQuestion.countDocuments(fcQ),
    ]);

    if (fcCount >= MIN_FC && qCount >= MIN_QUIZ) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      generated += 1;
      topicResults.push({
        topicKey: lesson.topicKey || "_",
        topicTitle: lesson.title || "",
        executedActions: [{ type: "generate_lesson_assets", status: "planned", reason: "dry_run" }],
      });
      continue;
    }

    try {
      const result = await generateLessonAssets({
        lessonId,
        ownerId,
        lesson,
        generateFlashcards: true,
        generateQuizQuestions: true,
        generateExamQuestions: false,
      });

      generated += 1;
      topicResults.push({
        topicKey: lesson.topicKey || "_",
        topicTitle: lesson.title || "",
        executedActions: [
          {
            type: "generate_lesson_assets",
            status: "generated",
            createdCount: (result.generated?.flashcards || 0) + (result.generated?.quizQuestions || 0),
            reason: JSON.stringify(result.generated || {}),
          },
        ],
      });
    } catch (e) {
      errors += 1;
      const code = e.code || e.message;
      topicResults.push({
        topicKey: lesson.topicKey || "_",
        topicTitle: lesson.title || "",
        executedActions: [{ type: "generate_lesson_assets", status: "failed", reason: String(code).slice(0, 500) }],
      });
    }
  }

  return { ok: true, generated, skipped, errors, topicResults };
}

module.exports = { runAssetAutopilot };
