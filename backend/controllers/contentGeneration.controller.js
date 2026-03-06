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
const { runWeakEvidenceFixGeneration } = require("../services/generation/weakEvidenceFixService");
const { runPracticeSetGeneration } = require("../services/generation/practiceSetService");
const { fingerprint: flashcardFingerprint } = require("../utils/flashcardDedupe");
const { fingerprintItem: quizFingerprintItem } = require("../utils/quizDedupe");
const { examQuestionFingerprint } = require("../utils/examQuestionDedupe");
const { normalizeSpecKey } = require("../config/featureFlags");
const { filterBankItemsByDrift } = require("../utils/topicDriftValidation");
const { parseTopicKey } = require("../utils/topicKey");

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

/** Subsection title patterns → lesson block type. PR: subsection labels become blocks, not pages. */
const SUBSECTION_PATTERNS = {
  examTip: /exam\s*tips?|exam\s*focus/i,
  commonMistake: /misconception|common\s*mistake|avoid/i,
  stretch: /stretch|deeper\s*knowledge|extension/i,
  keyIdea: /core\s*concept|key\s*(idea|point)|overview|introduction|comparison|examples/i,
  checkpoint: /check\s*understanding|quick\s*check|test\s*yourself/i,
};

function mapLlmBlockToLessonBlock(block, pageTitle = "") {
  if (!block || typeof block !== "object") return null;
  const t = String(block.type || "text").toLowerCase();
  if (t === "text") {
    const content = (block.content || "").trim();
    if (!content) return null;
    let blockType = "text";
    for (const [type, pattern] of Object.entries(SUBSECTION_PATTERNS)) {
      if (pattern.test(pageTitle)) {
        blockType = type;
        break;
      }
    }
    return { type: blockType, content };
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
    const prompt = (block.question || block.prompt || "").trim();
    if (!prompt) return null;
    const options = Array.isArray(block.options) ? block.options.map((o) => String(o || "").trim()).filter(Boolean).slice(0, 6) : [];
    const questionType = options.length > 0 ? "mcq" : "short";
    const correctAnswer = (block.answer || block.correctAnswer || "").trim();
    return {
      type: "checkpoint",
      prompt,
      questionType,
      options: questionType === "mcq" && options.length < 4 ? [...options, ...Array(4 - options.length).fill("Option")].slice(0, 4) : options.slice(0, 4),
      correctAnswer: correctAnswer || (options[0] || ""),
    };
  }
  if (t === "examtip" || t === "exam_tip") return { type: "examTip", content: (block.content || "").trim() || "" };
  if (t === "commonmistake" || t === "misconception") return { type: "commonMistake", content: (block.content || "").trim() || "" };
  if (t === "stretch" || t === "deeperknowledge") return { type: "stretch", content: (block.content || "").trim() || "" };
  if (t === "keyidea") return { type: "keyIdea", content: (block.content || "").trim() || "" };
  return { type: "text", content: (block.content || JSON.stringify(block)).slice(0, 500) };
}

/**
 * PR: Collapse multiple LLM pages into ONE lesson page.
 * Subsection labels (Core Concept, Exam Tips, Check Understanding, Stretch) become blocks, not pages.
 */
function collapseLlmPagesToSinglePage(llmPages, seed) {
  if (!Array.isArray(llmPages) || llmPages.length === 0) {
    return [
      {
        pageId: `p_starter_${seed.slice(0, 8)}_0`,
        title: "Page 1",
        order: 0,
        blocks: [{ type: "text", content: "Draft content — edit and expand." }],
      },
    ];
  }
  const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 8);
  const allBlocks = [];
  const sorted = [...llmPages].sort((a, b) => (Number(a?.order) ?? 0) - (Number(b?.order) ?? 0));

  for (const p of sorted) {
    const pageTitle = String(p?.title || "").trim();
    const blocksRaw = Array.isArray(p?.blocks) ? p.blocks : [];
    const cp = p?.checkpoint || {};

    for (const b of blocksRaw) {
      const mapped = mapLlmBlockToLessonBlock(b, pageTitle);
      if (mapped) allBlocks.push(mapped);
    }

    if (blocksRaw.length === 0 && cp && String(cp?.question || "").trim()) {
      const options = Array.isArray(cp?.options) ? cp.options.map((o) => String(o || "").trim()).filter(Boolean).slice(0, 4) : [];
      while (options.length < 4) options.push(`Option ${options.length + 1}`);
      const answer = String(cp?.answer || "").trim();
      allBlocks.push({
        type: "checkpoint",
        prompt: String(cp?.question || "Quick check").trim(),
        questionType: "mcq",
        options: options.slice(0, 4),
        correctAnswer: options.some((o) => o === answer) ? answer : options[0],
      });
    }
  }

  const hasCheckpoint = allBlocks.some((b) => b?.type === "checkpoint");
  const finalBlocks = allBlocks.length > 0 ? allBlocks : [{ type: "text", content: "Placeholder — add content." }];
  if (!hasCheckpoint) {
    finalBlocks.push({
      type: "checkpoint",
      prompt: "Quick check: which statement is correct?",
      questionType: "mcq",
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      correctAnswer: "Option 1",
    });
  }

  return [
    {
      pageId: `p_starter_${hash}_0`,
      title: "Page 1",
      order: 0,
      blocks: finalBlocks,
    },
  ];
}

function mapLlmPagesToLessonPages(llmPages, seed) {
  return collapseLlmPagesToSinglePage(llmPages, seed);
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

    const generatedFrom = { jobId: String(job._id), statementCodes: job.statementCodes || [], seed };
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
      metadata: { generatedFrom },
    });
    await lesson.save();
    job.outputs.lessonId = lesson._id;

    // STRICT TAXONOMY: Filter AI-generated bank items for sibling-topic drift
    const specKeyForDrift = parseTopicKey(topic).specKey || normalizedSpec;
    const topicKeyShort = parseTopicKey(topic).topicKey || topic;
    const filtered = filterBankItemsByDrift({
      topicKey: topicKeyShort,
      specKey: specKeyForDrift,
      subTopicLabel: topicDisplay,
      flashcards: pack?.flashcards || [],
      quizItems: pack?.quiz || [],
      examQuestions: pack?.examQuestions || [],
    });
    let allWarnings = Array.isArray(warnings) ? [...warnings] : [];
    if (filtered.removedCount > 0) {
      allWarnings.push(`Removed ${filtered.removedCount} item(s) that drifted into neighbouring sub-topics: ${filtered.driftedPhrases.slice(0, 3).join(", ")}`);
    }

    const flashcardIds = [];
    for (const f of filtered.flashcards) {
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
        metadata: { generatedFrom },
      });
      await doc.save();
      flashcardIds.push(doc._id);
    }
    job.outputs.flashcardIds = flashcardIds;

    const quizIds = [];
    for (const q of filtered.quizItems) {
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
    for (const eq of filtered.examQuestions) {
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
        metadata: { generatedFrom },
      });
      await doc.save();
      examIds.push(doc._id);
    }
    job.outputs.examQuestionIds = examIds;

    job.status = "completed";
    if (allWarnings.length) {
      job.errors = allWarnings;
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
 * POST /api/generate/weak-evidence-fix
 * PR-031: Generate draft pack to fix missing spec coverage and weak enquiries.
 */
async function postWeakEvidenceFix(req, res) {
  if (!requireTeacherOrAdmin(req, res)) return;

  const { specKey, topicKey, statementCodes, weakQuestions, allowExternal, windowDays } = req.body || {};
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
  const effectiveWindowDays = Math.min(30, Math.max(7, Number(windowDays) || 14));

  const job = new ContentGenerationJob({
    requestedBy: userId,
    role,
    specKey: normalizedSpec,
    topicKey: topic,
    mode: "weakEvidenceFix",
    status: "running",
    seed,
    inputs: {
      missingStatementCodes: Array.isArray(statementCodes) ? statementCodes.slice(0, 5) : [],
      weakQuestions: Array.isArray(weakQuestions) ? weakQuestions.slice(0, 5) : [],
      allowExternal: !!allowExternal,
      windowDays: effectiveWindowDays,
    },
    outputs: {},
  });
  await job.save();

  try {
    const {
      pack,
      inputsUsed,
      contextChunks,
    } = await runWeakEvidenceFixGeneration({
      specKey: normalizedSpec,
      topicKey: topic,
      missingStatementCodes: Array.isArray(statementCodes) ? statementCodes : undefined,
      weakQuestions: Array.isArray(weakQuestions) ? weakQuestions : undefined,
      allowExternal: !!allowExternal,
      windowDays: effectiveWindowDays,
      user: req.user,
    });

    job.inputs = {
      missingStatementCodes: inputsUsed.missingStatementCodes || [],
      weakQuestions: inputsUsed.weakQuestions || [],
      allowExternal: !!allowExternal,
      windowDays: effectiveWindowDays,
      retrievedDocs: (contextChunks || []).slice(0, 15).map((c) => ({
        knowledgeDocumentId: c.knowledgeDocumentId,
        sourceType: c.sourceType,
        snippet: (c.text || "").slice(0, 80),
      })),
    };

    const meta = parseSpecToMeta(normalizedSpec);
    const topicDisplay = topicDisplayName(topic);
    const generatedFrom = { jobId: String(job._id), seed };
    const llmLesson = pack?.lesson || {};
    const llmPages = llmLesson.pages || [];
    const pages = mapLlmPagesToLessonPages(llmPages, seed);

    const lesson = new Lesson({
      title: (llmLesson.title || `Draft — Gap fix: ${topicDisplay}`).trim(),
      description: (llmLesson.subtitle || `Covers missing spec + weak enquiries`).trim(),
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
      metadata: { generatedFrom },
    });
    await lesson.save();
    job.outputs.lessonId = lesson._id;

    // STRICT TAXONOMY: Filter AI-generated bank items for sibling-topic drift
    const specKeyForDrift = parseTopicKey(topic).specKey || normalizedSpec;
    const topicKeyShort = parseTopicKey(topic).topicKey || topic;
    const filtered = filterBankItemsByDrift({
      topicKey: topicKeyShort,
      specKey: specKeyForDrift,
      subTopicLabel: topicDisplay,
      flashcards: pack?.flashcards || [],
      quizItems: pack?.quiz || [],
      examQuestions: pack?.examQuestions || [],
    });
    let allWarnings = [];
    if (filtered.removedCount > 0) {
      allWarnings.push(`Removed ${filtered.removedCount} item(s) that drifted into neighbouring sub-topics: ${filtered.driftedPhrases.slice(0, 3).join(", ")}`);
    }

    const flashcardIds = [];
    for (const f of filtered.flashcards) {
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
        metadata: { generatedFrom },
      });
      await doc.save();
      flashcardIds.push(doc._id);
    }
    job.outputs.flashcardIds = flashcardIds;

    const quizIds = [];
    for (const q of filtered.quizItems) {
      const questionText = (q.question || "").trim();
      if (!questionText) continue;

      const isShort = (q.kind || "").toLowerCase() === "short";
      if (isShort) {
        const acceptableAnswers = Array.isArray(q.acceptableAnswers)
          ? q.acceptableAnswers.map((x) => String(x).trim()).filter(Boolean)
          : [];
        const item = {
          questionText,
          acceptableAnswers,
          matchMode: "contains",
          type: "short-answer",
          kind: q.kind || "quiz",
        };
        const fp = quizFingerprintItem(item);
        const doc = new TopicQuizQuestion({
          ownerId: userId,
          topicKey: topic,
          questionText,
          choices: [],
          correctIndex: 0,
          acceptableAnswers,
          matchMode: "contains",
          explanation: (q.explanation || "").trim().slice(0, 1000),
          type: "short-answer",
          kind: q.kind || "quiz",
          status: "draft",
          fingerprint: fp,
          metadata: { generatedFrom },
        });
        await doc.save();
        quizIds.push(doc._id);
      } else {
        const choices = Array.isArray(q.options) ? q.options.map((x) => String(x).trim()) : [];
        const correctIndex = Math.min(Math.max(0, Number(q.correctIndex) || 0), Math.max(0, choices.length - 1));
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
          metadata: { generatedFrom },
        });
        await doc.save();
        quizIds.push(doc._id);
      }
    }
    job.outputs.quizQuestionIds = quizIds;

    const examIds = [];
    for (const eq of filtered.examQuestions) {
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
        metadata: { generatedFrom },
      });
      await doc.save();
      examIds.push(doc._id);
    }
    job.outputs.examQuestionIds = examIds;

    job.status = "completed";
    if (allWarnings.length) job.errors = allWarnings;
    await job.save();

    const enc = encodeURIComponent(topic);
    return res.json({
      jobId: job._id,
      lessonId: String(lesson._id),
      ...(allWarnings.length > 0 && { warnings: allWarnings }),
      flashcards: flashcardIds.map((id) => String(id)),
      quiz: quizIds.map((id) => String(id)),
      exam: examIds.map((id) => String(id)),
      inputsUsed: {
        missingStatementCodes: job.inputs.missingStatementCodes || [],
        weakQuestions: job.inputs.weakQuestions || [],
        allowExternal: !!allowExternal,
        windowDays: effectiveWindowDays,
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
    console.error("[contentGeneration] weak-evidence-fix failed:", err);
    return res.status(500).json({
      error: "Generation failed",
      message: err.message,
      jobId: job._id,
    });
  }
}

/**
 * POST /api/generate/practice-set
 * PR-032: Generate draft practice set (flashcards, quiz, exam questions).
 */
async function postPracticeSet(req, res) {
  if (!requireTeacherOrAdmin(req, res)) return;

  const { specKey, topicKey, counts, allowExternal } = req.body || {};
  const normalizedSpec = normalizeSpecKey(specKey);
  const topic = String(topicKey || "").trim();

  if (!normalizedSpec || !topic) {
    return res.status(400).json({ error: "specKey and topicKey are required" });
  }

  const seed = crypto
    .createHash("sha256")
    .update(`${normalizedSpec}|${topic}|${Date.now()}|${Math.random()}`)
    .digest("hex")
    .slice(0, 16);

  const userId = req.user._id || req.user.userId || req.user.id;
  const role = (req.user.userType || req.user.role || "teacher").toString();

  const job = new ContentGenerationJob({
    requestedBy: userId,
    role,
    specKey: normalizedSpec,
    topicKey: topic,
    mode: "practiceSet",
    status: "running",
    seed,
    inputs: { counts: counts || {}, allowExternal: !!allowExternal },
    outputs: {},
  });
  await job.save();

  try {
    const { pack, contextChunks, counts: effectiveCounts, warnings } = await runPracticeSetGeneration({
      specKey: normalizedSpec,
      topicKey: topic,
      counts: counts || {},
      allowExternal: !!allowExternal,
      seed,
      user: req.user,
    });

    job.inputs = {
      counts: effectiveCounts,
      allowExternal: !!allowExternal,
      retrievedDocs: (contextChunks || []).slice(0, 15).map((c) => ({
        knowledgeDocumentId: c.knowledgeDocumentId,
        sourceType: c.sourceType,
        snippet: (c.text || "").slice(0, 80),
      })),
    };

    const meta = parseSpecToMeta(normalizedSpec);
    const topicDisplay = topicDisplayName(topic);
    const generatedFrom = { jobId: String(job._id), seed };

    // STRICT TAXONOMY: Filter AI-generated bank items for sibling-topic drift
    const specKeyForDrift = parseTopicKey(topic).specKey || normalizedSpec;
    const topicKeyShort = parseTopicKey(topic).topicKey || topic;
    const packFlashcards = pack?.flashcards || [];
    const packQuiz = pack?.quiz || [];
    const packExam = pack?.exam || pack?.examQuestions || [];
    const filteredPractice = filterBankItemsByDrift({
      topicKey: topicKeyShort,
      specKey: specKeyForDrift,
      subTopicLabel: topicDisplay,
      flashcards: packFlashcards,
      quizItems: packQuiz,
      examQuestions: packExam,
    });
    let practiceWarnings = [];
    if (filteredPractice.removedCount > 0) {
      practiceWarnings.push(`Removed ${filteredPractice.removedCount} item(s) that drifted into neighbouring sub-topics: ${filteredPractice.driftedPhrases.slice(0, 3).join(", ")}`);
    }

    const flashcardIds = [];
    for (const f of filteredPractice.flashcards) {
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
        metadata: { generatedFrom },
      });
      await doc.save();
      flashcardIds.push(doc._id);
    }
    job.outputs.flashcardIds = flashcardIds;

    const quizIds = [];
    for (const q of filteredPractice.quizItems) {
      const questionText = (q.question || "").trim();
      if (!questionText) continue;

      const isShort = (q.type || "").toLowerCase() === "short";
      if (isShort) {
        const acceptableAnswers = Array.isArray(q.answers) ? q.answers.map((x) => String(x).trim()).filter(Boolean) : [];
        const item = {
          questionText,
          acceptableAnswers,
          matchMode: "contains",
          type: "short-answer",
          kind: q.kind || "quiz",
        };
        const fp = quizFingerprintItem(item);
        const doc = new TopicQuizQuestion({
          ownerId: userId,
          topicKey: topic,
          questionText,
          choices: [],
          correctIndex: 0,
          acceptableAnswers,
          matchMode: "contains",
          explanation: (q.explanation || "").trim().slice(0, 1000),
          type: "short-answer",
          kind: q.kind || "quiz",
          status: "draft",
          fingerprint: fp,
          metadata: { generatedFrom },
        });
        await doc.save();
        quizIds.push(doc._id);
      } else {
        const choices = Array.isArray(q.options) ? q.options.map((x) => String(x).trim()) : [];
        const correctIndex = Math.min(Math.max(0, Number(q.correctIndex) || 0), Math.max(0, choices.length - 1));
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
          metadata: { generatedFrom },
        });
        await doc.save();
        quizIds.push(doc._id);
      }
    }
    job.outputs.quizQuestionIds = quizIds;

    const examIds = [];
    for (const eq of filteredPractice.examQuestions) {
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
        metadata: { generatedFrom },
      });
      await doc.save();
      examIds.push(doc._id);
    }
    job.outputs.examQuestionIds = examIds;

    job.status = "completed";
    const allJobErrors = [...(Array.isArray(warnings) ? warnings : []), ...practiceWarnings];
    if (allJobErrors.length) job.errors = allJobErrors;
    await job.save();

    const enc = encodeURIComponent(topic);
    return res.json({
      jobId: job._id,
      ...(practiceWarnings.length > 0 && { warnings: practiceWarnings }),
      outputs: {
        flashcardIdsCount: flashcardIds.length,
        quizCount: quizIds.length,
        examCount: examIds.length,
      },
      links: {
        flashcardsBank: `/teacher/topic-banks/flashcards?topicKey=${enc}`,
        quizBank: `/teacher/topic-banks/quizzes?topicKey=${enc}`,
        examBank: `/teacher/exam-question-bank?topicKey=${enc}`,
      },
    });
  } catch (err) {
    job.status = "failed";
    job.errors = [err.message || String(err)];
    await job.save();
    console.error("[contentGeneration] practice-set failed:", err);
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
  postWeakEvidenceFix,
  postPracticeSet,
  getJobs,
  collapseLlmPagesToSinglePage,
};
