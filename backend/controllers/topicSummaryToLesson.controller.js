/**
 * PR-029: Convert Topic Summary → Draft Lesson Skeleton.
 * Pure transformation — no AI. Teacher/admin only.
 */
const mongoose = require("mongoose");
const TopicSummaryLog = require("../models/TopicSummaryLog");
const Lesson = require("../models/Lesson");
const { getCreateLessonOptions } = require("../services/taxonomyService");

function isTeacherOrAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "teacher" || t === "admin" || req.user?.isAdmin === true;
}

function formatTopicTitle(topicKey) {
  if (!topicKey || typeof topicKey !== "string") return "Topic";
  const seg = String(topicKey).split(":").pop() || String(topicKey);
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveSubjectLevelFromSpecKey(specKey) {
  const options = getCreateLessonOptions();
  const sk = (specKey || "").trim().toLowerCase();
  for (const subj of options.subjects || []) {
    for (const spec of subj.specs || []) {
      if ((spec.specKey || "").trim().toLowerCase() === sk) {
        const subject = subj.subject || "Unknown";
        const label = spec.specLabel || "";
        const level = label.includes("GCSE") ? "GCSE" : label.includes("A-Level") ? "A-Level" : "GCSE";
        return { subject, level };
      }
    }
  }
  if (sk.includes("biology")) return { subject: "Biology", level: "GCSE" };
  if (sk.includes("chemistry")) return { subject: "Chemistry", level: "GCSE" };
  if (sk.includes("physics")) return { subject: "Physics", level: "GCSE" };
  if (sk.includes("maths")) return { subject: "Maths", level: "GCSE" };
  if (sk.includes("english")) return { subject: "English", level: "GCSE" };
  return { subject: "Unknown", level: "GCSE" };
}

function makePageId(idx) {
  return `p_ts_${Date.now()}_${idx}`;
}

/**
 * Build lesson pages from TopicSummaryLog response.
 * Page 1: Overview (summary + keyPoints)
 * Page 2: Core ideas (sections or keyPoints grouped)
 * Page 3: Exam practice (examFocus / revisionSheet)
 */
function buildPagesFromSummary(log, strategy, includeCheckpoint) {
  const res = log.response || {};
  const summary = (res.summary || "").trim();
  const keyPoints = Array.isArray(res.keyPoints) ? res.keyPoints.filter((k) => typeof k === "string" && k.trim()) : [];
  const sections = res.sections && typeof res.sections === "object" ? res.sections : {};

  const blocksForPage1 = [];
  if (summary) {
    blocksForPage1.push({ type: "text", content: summary });
  }
  if (keyPoints.length > 0) {
    const bulletContent = keyPoints.map((kp) => `- ${kp.trim()}`).join("\n\n");
    blocksForPage1.push({ type: "keyIdea", content: bulletContent });
  }
  if (blocksForPage1.length === 0) {
    blocksForPage1.push({ type: "text", content: "Overview content will be added here." });
  }

  const blocksForPage2 = [];
  const lp = sections.lessonPlan;
  if (lp?.segments?.length) {
    for (const seg of lp.segments.slice(0, 4)) {
      const title = (seg.title || "").trim();
      const script = (seg.teacherScript || "").trim();
      const activity = (seg.activity || "").trim();
      if (title) blocksForPage2.push({ type: "text", content: `**${title}**\n\n${script || activity || ""}` });
    }
  }
  if (blocksForPage2.length === 0 && keyPoints.length > 0) {
    const grouped = keyPoints.slice(0, 6).map((kp) => `- ${kp.trim()}`).join("\n\n");
    blocksForPage2.push({ type: "keyIdea", content: grouped });
  }
  if (blocksForPage2.length === 0) {
    blocksForPage2.push({ type: "text", content: "Core ideas will be developed here." });
  }

  const blocksForPage3 = [];
  const ef = sections.examFocus;
  const rs = sections.revisionSheet;
  if (ef?.examQuestion?.question) {
    const q = ef.examQuestion.question;
    const ms = ef.examQuestion.markScheme || "";
    blocksForPage3.push({ type: "text", content: `**Exam-style question**\n\n${q}\n\n**Mark scheme:** ${ms}` });
  }
  if (ef?.commandWords?.length) {
    blocksForPage3.push({ type: "examTip", content: `Command words: ${ef.commandWords.join(", ")}` });
  }
  if (rs?.commonMistakes?.length) {
    const cm = rs.commonMistakes.map((m) => `- ${m}`).join("\n");
    blocksForPage3.push({ type: "commonMistake", content: cm });
  }
  if (blocksForPage3.length === 0) {
    blocksForPage3.push({ type: "text", content: "Exam practice and revision tips will be added here." });
  }

  if (includeCheckpoint) {
    const practiceMcq = sections?.revisionSheet?.flashcards?.[0] || sections?.examFocus?.examQuestion;
    const checkpointBlock = {
      type: "checkpoint",
      prompt: practiceMcq?.question || (keyPoints[0] ? `Explain: ${keyPoints[0].slice(0, 80)}` : "What are the key points of this topic?"),
      questionType: "short",
      options: [],
      correctAnswer: practiceMcq?.markScheme || practiceMcq?.answer || (keyPoints[0] || "").slice(0, 200),
      explanation: "",
    };
    blocksForPage3.push(checkpointBlock);
  }

  return [
    { pageId: makePageId(0), title: "Overview", order: 0, blocks: blocksForPage1 },
    { pageId: makePageId(1), title: "Core ideas", order: 1, blocks: blocksForPage2 },
    { pageId: makePageId(2), title: "Exam practice", order: 2, blocks: blocksForPage3 },
  ];
}

/**
 * POST /api/topic-summary/to-lesson
 */
async function postTopicSummaryToLesson(req, res) {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({ error: "Teacher or admin only" });
    }

    const { topicSummaryLogId, lessonTitle, strategy = "standard", includeCheckpoint = true } = req.body || {};

    if (!topicSummaryLogId || typeof topicSummaryLogId !== "string") {
      return res.status(400).json({ error: "topicSummaryLogId is required" });
    }

    const id = topicSummaryLogId.trim();
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid topicSummaryLogId" });
    }

    const log = await TopicSummaryLog.findById(id).lean();
    if (!log) {
      return res.status(404).json({ error: "Topic summary not found" });
    }

    const userId = req.user?._id || req.user?.userId || req.user?.id;
    const logUserId = String(log.userId || "");
    const reqUserId = String(userId || "");
    const isAdmin = (req.user?.userType || req.user?.role || "").toString().toLowerCase() === "admin" || req.user?.isAdmin;

    if (!isAdmin && logUserId !== reqUserId) {
      return res.status(403).json({ error: "Access denied — you can only create lessons from your own summaries" });
    }

    const specKey = log.specKey || "";
    const topicKey = log.topicKey || "";
    const { subject, level } = deriveSubjectLevelFromSpecKey(specKey);
    const topicDisplay = formatTopicTitle(topicKey);
    const title = lessonTitle && String(lessonTitle).trim() ? String(lessonTitle).trim() : `${topicDisplay} — Lesson`;
    const description = `Draft lesson created from topic summary for ${topicDisplay}.`;

    const pages = buildPagesFromSummary(log, strategy, includeCheckpoint);

    const derivedSpecKey = (topicKey && topicKey.includes(":")) ? topicKey.slice(0, topicKey.indexOf(":")) : (specKey || null);
    const lesson = new Lesson({
      title,
      description,
      content: (log.response?.summary || "").slice(0, 5000) || description,
      teacherId: userId,
      teacherName: `${req.user?.firstName || ""} ${req.user?.lastName || ""}`.trim() || req.user?.email || "",
      subject,
      level,
      topic: topicDisplay,
      topicKey: topicKey || null,
      specKey: derivedSpecKey,
      subTopic: topicDisplay,
      board: "AQA",
      status: "draft",
      isPublished: false,
      pages,
      metadata: {
        generatedFrom: {
          topicSummaryLogId: id,
          kind: "topicSummary",
        },
      },
    });

    await lesson.save();

    return res.status(201).json({
      lessonId: String(lesson._id),
      lessonUrlEdit: `/edit-lesson/${lesson._id}`,
      lessonUrlView: `/lesson/${lesson._id}`,
      createdFrom: { topicSummaryLogId: id },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[topicSummaryToLesson]", err);
    }
    return res.status(500).json({ error: err.message || "Failed to create draft lesson" });
  }
}

module.exports = { postTopicSummaryToLesson };
