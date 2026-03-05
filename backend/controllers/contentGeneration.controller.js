/**
 * PR-014: Content generation controller — starter pack.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const Lesson = require("../models/Lesson");
const TopicFlashcard = require("../models/TopicFlashcard");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const ExamQuestion = require("../models/ExamQuestion");
const ContentGenerationJob = require("../models/ContentGenerationJob");
const { runStarterPackGeneration } = require("../services/generation/starterPackService");
const { fingerprint: flashcardFingerprint } = require("../utils/flashcardDedupe");
const { fingerprintItem: quizFingerprintItem } = require("../utils/quizDedupe");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const { normalizeSpecKey } = require("../config/featureFlags");

function requireTeacherOrAdmin(req, res) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  const t = (req.user.userType || req.user.role || "").toString().toLowerCase();
  if (t !== "teacher" && t !== "admin") {
    res.status(403).json({ error: "Teacher or admin only" });
    return false;
  }
  return true;
}

function parseSpecToMeta(specKey) {
  const parts = (specKey || "").split("-").filter(Boolean);
  if (parts.length >= 3) {
    return {
      examBoard: (parts[0] || "AQA").toUpperCase(),
      level: (parts[1] || "GCSE").toUpperCase(),
      subject: (parts[2] || "Biology").charAt(0).toUpperCase() + (parts[2] || "").slice(1).toLowerCase(),
    };
  }
  return { examBoard: "AQA", level: "GCSE", subject: "Biology" };
}

function topicDisplayName(topicKey) {
  const last = (topicKey || "").split(":").pop();
  return last ? last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey || "Topic";
}

function mapLlmBlockToLessonBlock(block, pageIdx) {
  if (!block || typeof block !== "object") return null;
  const t = String(block.type || "text").toLowerCase();
  if (t === "text") {
    return { type: "text", content: (block.content || "").trim() || "" };
  }
  if (t === "bulletlist") {
    const items = Array.isArray(block.items) ? block.items : [];
    const content = items.map((i) => `- ${String(i || "").trim()}`).filter((s) => s.length > 2).join("\n");
    return { type: "keyIdea", content: content || "Key points" };
  }
  if (t === "workedexample") {
    const prompt = (block.prompt || "").trim();
    const answer = (block.answer || "").trim();
    const content = `**Worked example**\n\n${prompt}\n\n**Answer:** ${answer}`.trim();
    return { type: "text", content };
  }
  if (t === "checkpoint") {
    return {
      type: "checkpoint",
      prompt: (block.question || block.prompt || "").trim(),
      questionType: "short",
      options: [],
      correctAnswer: (block.answer || block.correctAnswer || "").trim(),
    };
  }
  return { type: "text", content: JSON.stringify(block).slice(0, 500) };
}

function mapLlmPagesToLessonPages(llmPages, seed) {
  if (!Array.isArray(llmPages) || llmPages.length === 0) {
    return [
      {
        pageId: `p_starter_${seed.slice(0, 8)}_0`,
        title: "Introduction",
        order: 0,
        blocks: [{ type: "text", content: "Draft content — edit and expand." }],
      },
    ];
  }
  const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return llmPages.map((p, i) => {
    const blocks = Array.isArray(p.blocks)
      ? p.blocks.map((b) => mapLlmBlockToLessonBlock(b, i)).filter(Boolean)
      : [];
    return {
      pageId: `p_starter_${hash}_${i}`,
      title: (p.title || `Page ${i + 1}`).trim(),
      order: i,
      blocks: blocks.length ? blocks : [{ type: "text", content: "Placeholder — add content." }],
    };
  });
}

/**
 * POST /api/generate/starter-pack
 */
async function postStarterPack(req, res) {
  if (!requireTeacherOrAdmin(req, res)) return;

  const { specKey, topicKey, statementCodes, tier } = req.body || {};
  const normalizedSpec = normalizeSpecKey(specKey);
  const topic = String(topicKey || "").trim();

  if (!normalizedSpec || !topic) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }

  const seed = crypto
    .createHash("sha256")
    .update(`${normalizedSpec}|${topic}|${(statementCodes || []).join(",")}|${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  const userId = req.user._id || req.user.userId || req.user.id;
  const role = (req.user.userType || req.user.role || "teacher").toString();

  const job = new ContentGenerationJob({
    requestedBy: userId,
    role,
    specKey: normalizedSpec,
    topicKey: topic,
    statementCodes: Array.isArray(statementCodes) ? statementCodes : [],
    tier: tier ? String(tier).trim() : null,
    mode: "starterPack",
    status: "running",
    seed,
    inputs: { statements: [], retrievedDocs: [] },
    outputs: {},
  });
  await job.save();

  try {
    const { pack, statements, contextChunks, warnings } = await runStarterPackGeneration({
      specKey: normalizedSpec,
      topicKey: topic,
      statementCodes: Array.isArray(statementCodes) ? statementCodes : undefined,
      tier: tier ? String(tier).trim() : undefined,
      seed,
      user: req.user,
    });

    job.inputs = {
      statements: (statements || []).map((s) => ({
        statementCode: s.statementCode,
        snippet: (s.statementText || "").slice(0, 80),
      })),
      retrievedDocs: (contextChunks || []).slice(0, 20).map((c) => ({
        knowledgeDocumentId: c.knowledgeDocumentId,
        sourceType: c.sourceType,
        snippet: (c.text || "").slice(0, 100),
      })),
    };

    const meta = parseSpecToMeta(normalizedSpec);
    const topicDisplay = topicDisplayName(topic);
    const llmLesson = pack?.lesson || {};
    const llmPages = llmLesson.pages || [];
    const pages = mapLlmPagesToLessonPages(llmPages, seed);

    const lesson = new Lesson({
      title: (llmLesson.title || `Draft — ${topicDisplay}`).trim(),
      description: (llmLesson.subtitle || `Starter pack for ${topicDisplay}`).trim(),
      content: (llmLesson.learningObjectives || []).join("\n") || "",
      teacherId: userId,
      teacherName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email || "",
      subject: meta.subject,
      level: meta.level,
      topic: topicDisplay,
      topicKey: topic,
      board: meta.examBoard,
      status: "draft",
      isPublished: false,
      pages,
    });
    await lesson.save();
    job.outputs.lessonId = lesson._id;

    const flashcardIds = [];
    for (const f of pack?.flashcards || []) {
      const front = (f.front || "").trim().slice(0, 500);
      const back = (f.back || "").trim().slice(0, 2000);
      if (!front || !back) continue;
      const fp = flashcardFingerprint(front, back);
      const doc = new TopicFlashcard({
        ownerId: userId,
        subject: meta.subject,
        examBoard: meta.examBoard,
        level: meta.level,
        topicKey: topic,
        topic: topicDisplay,
        front,
        back,
        status: "draft",
        fingerprint: fp,
      });
      await doc.save();
      flashcardIds.push(doc._id);
    }
    job.outputs.flashcardIds = flashcardIds;

    const quizIds = [];
    for (const q of pack?.quiz || []) {
      const questionText = (q.question || "").trim();
      const choices = Array.isArray(q.options) ? q.options.map((x) => String(x).trim()) : [];
      const correctIndex = Math.min(Math.max(0, Number(q.correctIndex) || 0), Math.max(0, choices.length - 1));
      if (!questionText) continue;
      const item = {
        questionText,
        choices,
        correctIndex,
        type: "mcq",
        kind: q.kind || "quiz",
      };
      const fp = quizFingerprintItem(item);
      const doc = new TopicQuizQuestion({
        ownerId: userId,
        topicKey: topic,
        questionText,
        choices,
        correctIndex,
        explanation: (q.explanation || "").trim().slice(0, 1000),
        type: "mcq",
        kind: q.kind || "quiz",
        status: "draft",
        fingerprint: fp,
      });
      await doc.save();
      quizIds.push(doc._id);
    }
    job.outputs.quizQuestionIds = quizIds;

    const examIds = [];
    for (const eq of pack?.examQuestions || []) {
      const question = (eq.question || "").trim();
      const markScheme = (eq.markScheme || "").trim();
      const marks = Math.min(10, Math.max(1, Number(eq.marks) || 1));
      if (!question) continue;
      const fp = examQuestionFingerprint({
        specKey: normalizedSpec,
        topicKey: topic,
        question,
        markScheme,
        marks,
      });
      const doc = new ExamQuestion({
        teacherId: userId,
        subject: meta.subject,
        examBoard: meta.examBoard,
        level: meta.level,
        topic: topicDisplay,
        topicKey: topic,
        type: "short",
        marks,
        question,
        markScheme: markScheme ? [markScheme] : [],
        status: "draft",
        fingerprint: fp,
      });
      await doc.save();
      examIds.push(doc._id);
    }
    job.outputs.examQuestionIds = examIds;

    job.status = "completed";
    if (Array.isArray(warnings) && warnings.length) {
      job.errors = warnings;
    }
    await job.save();

    const enc = encodeURIComponent(topic);
    return res.json({
      jobId: job._id,
      outputs: {
        lessonId: String(lesson._id),
        flashcardIdsCount: flashcardIds.length,
        quizCount: quizIds.length,
        examCount: examIds.length,
      },
      links: {
        editLesson: `/edit-lesson/${lesson._id}`,
        flashcardsBank: `/teacher/topic-banks/flashcards?topicKey=${enc}`,
        quizBank: `/teacher/topic-banks/quizzes?topicKey=${enc}`,
        examBank: `/teacher/exam-question-bank?topicKey=${enc}`,
      },
    });
  } catch (err) {
    job.status = "failed";
    job.errors = [err.message || String(err)];
    await job.save();
    console.error("[contentGeneration] starter-pack failed:", err);
    return res.status(500).json({
      error: "Generation failed",
      message: err.message,
      jobId: job._id,
    });
  }
}

/**
 * GET /api/generate/jobs
 */
async function getJobs(req, res) {
  if (!requireTeacherOrAdmin(req, res)) return;

  const { specKey, topicKey, limit } = req.query || {};
  const query = {};
  if (specKey) query.specKey = normalizeSpecKey(specKey);
  if (topicKey) query.topicKey = String(topicKey).trim();
  query.requestedBy = req.user._id || req.user.userId;

  const isAdmin =
    (req.user.userType || req.user.role || "").toString().toLowerCase() === "admin" || req.user?.isAdmin === true;
  if (isAdmin) delete query.requestedBy;

  const jobs = await ContentGenerationJob.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(50, Math.max(1, Number(limit) || 20)))
    .lean();

  return res.json({ jobs });
}

module.exports = {
  postStarterPack,
  getJobs,
};
