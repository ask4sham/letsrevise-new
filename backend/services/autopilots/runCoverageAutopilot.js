/**
 * Coverage autopilot — detects missing lessons (taxonomy-backed gaps) and creates draft skeleton lessons only.
 * Never publishes. Does not invent topic keys; uses curriculumGapDetectionService output.
 */
const mongoose = require("mongoose");
const Lesson = require("../../models/Lesson");
const curriculumGapDetectionService = require("../curriculumGapDetectionService");
const { assertValidNamespacedTopicKey } = require("../../utils/specTopicValidation");

function parseSpecMeta(specKey) {
  const parts = (specKey || "").split("-").filter(Boolean);
  const examBoard = (parts[0] || "aqa").toUpperCase();
  const level = (parts[1] || "GCSE").toUpperCase();
  const subjectRaw = parts[2] || "Biology";
  const subject = subjectRaw.charAt(0).toUpperCase() + subjectRaw.slice(1).toLowerCase();
  return { examBoard, level, subject, board: examBoard };
}

function namespacedTopic(specKey, topicKeyFromGap) {
  const t = (topicKeyFromGap || "").trim();
  if (!t) return "";
  return t.includes(":") ? t : `${specKey}:${t}`;
}

/**
 * @param {{ specKey: string, adminUserId: string, teacherName?: string, dryRun?: boolean, limit?: number, minPriorityScore?: number, autopilotRunId?: string }} opts
 */
async function runCoverageAutopilot(opts) {
  const {
    specKey,
    adminUserId,
    teacherName = "Content engine",
    dryRun = false,
    limit = 15,
    minPriorityScore = 30,
    autopilotRunId,
  } = opts;

  if (!specKey || !adminUserId || !mongoose.Types.ObjectId.isValid(String(adminUserId))) {
    return { ok: false, error: "specKey and valid adminUserId required", proposalsCreated: 0, skipped: 0, topicResults: [] };
  }

  const gaps = await curriculumGapDetectionService.detectTopicGaps(specKey);
  const candidates = gaps.filter(
    (g) => (g.priorityScore ?? 0) >= minPriorityScore && g.gapFlags?.missingLesson === true
  );
  const toProcess = limit > 0 ? candidates.slice(0, limit) : candidates;

  const topicResults = [];
  let proposalsCreated = 0;
  let skipped = 0;

  for (const gap of toProcess) {
    const ns = namespacedTopic(specKey, gap.topicKey);
    if (!ns) {
      skipped += 1;
      topicResults.push({
        topicKey: gap.topicKey || "_",
        topicTitle: gap.topicTitle || "",
        plannedActions: ["create_lesson_skeleton"],
        executedActions: [{ type: "create_lesson_skeleton", status: "skipped", reason: "empty_topic_key" }],
      });
      continue;
    }

    try {
      assertValidNamespacedTopicKey(specKey, ns);
    } catch (e) {
      skipped += 1;
      topicResults.push({
        topicKey: gap.topicKey || "_",
        topicTitle: gap.topicTitle || "",
        plannedActions: ["create_lesson_skeleton"],
        executedActions: [{ type: "create_lesson_skeleton", status: "skipped", reason: e.message || "invalid_topic_key" }],
      });
      continue;
    }

    const dup = await Lesson.findOne({
      specKey,
      topicKey: ns,
      "metadata.autopilotCoverageProposal": true,
    })
      .select("_id")
      .lean();
    if (dup) {
      skipped += 1;
      topicResults.push({
        topicKey: gap.topicKey,
        topicTitle: gap.topicTitle || "",
        plannedActions: ["create_lesson_skeleton"],
        executedActions: [{ type: "create_lesson_skeleton", status: "skipped", reason: "proposal_already_exists" }],
      });
      continue;
    }

    if (dryRun) {
      proposalsCreated += 1;
      topicResults.push({
        topicKey: gap.topicKey,
        topicTitle: gap.topicTitle || "",
        plannedActions: ["create_lesson_skeleton"],
        executedActions: [{ type: "create_lesson_skeleton", status: "planned", reason: "dry_run", createdCount: 1 }],
      });
      continue;
    }

    const meta = parseSpecMeta(specKey);
    const title = (gap.topicTitle || gap.topicKey || "Topic").trim();
    const placeholder =
      "This is a **draft skeleton** created by the coverage autopilot. Replace all content before publishing.";
    const lesson = new Lesson({
      title: `${title} (draft skeleton)`,
      description: "Coverage autopilot draft — not ready for students. Edit and complete before review.",
      content: placeholder,
      teacherId: adminUserId,
      teacherName,
      subject: meta.subject,
      level: meta.level,
      topic: title,
      topicKey: ns,
      specKey,
      subTopic: title,
      board: meta.board,
      status: "draft",
      isPublished: false,
      pages: [
        {
          title: "Introduction",
          order: 1,
          blocks: [
            {
              type: "text",
              content: placeholder,
              prompt: "",
              questionType: "mcq",
              options: [],
              correctAnswer: "",
              explanation: "",
            },
          ],
        },
      ],
      metadata: {
        autopilotSource: "coverage",
        autopilotCoverageProposal: true,
        autopilotRunId: autopilotRunId || null,
        generatedBy: "autopilot",
        generatedAt: new Date().toISOString(),
      },
    });

    await lesson.save();
    proposalsCreated += 1;
    topicResults.push({
      topicKey: gap.topicKey,
      topicTitle: gap.topicTitle || "",
      plannedActions: ["create_lesson_skeleton"],
      executedActions: [
        {
          type: "create_lesson_skeleton",
          status: "generated",
          createdCount: 1,
          reason: `lessonId=${String(lesson._id)}`,
        },
      ],
    });
  }

  return {
    ok: true,
    proposalsCreated,
    skipped,
    topicResults,
  };
}

module.exports = { runCoverageAutopilot };
