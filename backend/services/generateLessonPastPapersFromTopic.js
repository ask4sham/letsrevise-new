/**
 * PR-PP2: Generate past papers from Topic Past Paper bank into lesson (published-only, replace).
 * PR-CHEM-3: Query by topicKey $in(namespaced, legacy).
 */
const Lesson = require("../models/Lesson");
const TopicPastPaper = require("../models/TopicPastPaper");
const { topicToKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY } = require("../utils/topicKey");

/**
 * @param {Object} opts
 * @param {string} opts.lessonId
 * @param {ObjectId|string} opts.userId - for permission check (caller must be owner/admin)
 * @returns {Promise<{ addedCount: number; pastPapersCount: number; lesson: Object }>}
 */
async function generateLessonPastPapersFromTopic({ lessonId, userId }) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw Object.assign(new Error("Lesson not found"), { statusCode: 404 });

  const topicKey =
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";
  if (!topicKey) {
    throw Object.assign(new Error("Lesson has no topicKey; cannot generate past papers."), { statusCode: 400 });
  }

  const ownerId = lesson.teacherId || lesson.createdBy;
  const specKey = (lesson.specKey && String(lesson.specKey).trim()) || parseTopicKey(topicKey).specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(topicKey).topicKey || topicKey.trim().toLowerCase();
  const candidates = queryCandidates(specKey, topicOnly);

  const bankItems = await TopicPastPaper.find({
    ownerId,
    topicKey: candidates.length ? { $in: candidates } : topicOnly,
    status: "published",
  })
    .sort({ createdAt: 1 })
    .lean();

  const pastPapers = bankItems.map((item) => {
    const ref = {
      title: item.title || "",
      examBoard: item.examBoard || "",
      qualification: item.qualification || "",
      subject: item.subject || "",
      year: item.year,
      paper: item.paper || "",
      session: item.session || "",
      tier: item.tier || "",
      type: item.type || "",
      tags: Array.isArray(item.tags) ? item.tags : [],
      sourceType: item.sourceType,
      officialSource: !!item.officialSource,
      officialHost: item.officialHost || "",
    };
    if (item.sourceType === "url" && item.url) {
      ref.url = item.url;
    }
    if (item.sourceType === "file" && item.file) {
      ref.fileId = item.file.fileId;
      ref.originalName = item.file.originalName || "";
      ref.mimeType = item.file.mimeType || "";
      ref.size = item.file.size || 0;
    }
    return ref;
  });

  lesson.pastPapers = pastPapers;
  lesson.markModified("pastPapers");
  await lesson.save();

  return {
    addedCount: pastPapers.length,
    pastPapersCount: pastPapers.length,
    lesson: lesson.toObject ? lesson.toObject() : lesson,
  };
}

module.exports = { generateLessonPastPapersFromTopic };
