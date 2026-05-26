// backend/routes/lessons.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Lesson = require("../models/Lesson");
const AssessmentPaper = require("../models/AssessmentPaper");
const LessonUnlock = require("../models/LessonUnlock");
const LessonReview = require("../models/LessonReview");
const LessonRevisionDraft = require("../models/LessonRevisionDraft");
const User = require("../models/User");
const Purchase = require("../models/Purchase");
const LessonPurchase = require("../models/LessonPurchase");
const VisualModel = require("../models/VisualModel");
const ExamQuestion = require("../models/ExamQuestion");
const TopicQuizQuestion = require("../models/TopicQuizQuestion");
const PracticeAttempt = require("../models/PracticeAttempt");
const ReteachPlan = require("../models/ReteachPlan");
const { findTopicByKey, findTopicBySpecAndKey, topicToKey } = require("../utils/topicTaxonomy");
const { parseTopicKey, queryCandidates, DEFAULT_SPEC_LEGACY, buildTopicKey } = require("../utils/topicKey");
const { assertValidSpecKey, assertValidNamespacedTopicKey } = require("../utils/specTopicValidation");
const { normalizeNamespacedLessonTopicKey } = require("../utils/normalizeLessonTopicKey");
const { resolveQuestionBankNamespacedTopicKey } = require("../utils/resolveTopicRuntimeKeys");
const { attachExamQuestionsByTopic } = require("../utils/attachExamQuestionsByTopic");
const { fetchTopicFlashcardsForSeed, fetchTopicFlashcardsForTopicOnly } = require("../utils/seedLessonFlashcardsFromTopic");
const { generateLessonQuizFromTopic } = require("../services/generateLessonQuizFromTopic");
const { generateLessonPastPapersFromTopic } = require("../services/generateLessonPastPapersFromTopic");
const { generateLessonAssessmentFromTopic } = require("../services/generateLessonAssessmentFromTopic");
const { autoGenerateLessonFromBanks } = require("../services/autoGenerateLessonFromBanks");
const { generateLessonAssets } = require("../services/generateLessonAssets");
const { autoAttachLessonContent } = require("../services/autoAttachLessonContentService");
const auth = require("../middleware/auth");
const { applyLessonAccess } = require("../middleware");
const { canAccessContent } = require("../utils/canAccessContent");
const { isSubscriptionActive } = require("../utils/isSubscriptionActive");
const {
  toLessonPreviewPayload,
  toLessonFullPayload,
  stripCheckpointAutoMarkFromLesson,
} = require("../utils/lessonPayload");
const { makeLessonDbSafe } = require("../utils/lessonDbSafe");
const { computeLessonReadiness } = require("../utils/lessonReadiness");
const { getDiagramSuggestionsForLesson } = require("../utils/diagramSuggestions");
const { grantTrialIfEligible } = require("../utils/grantTrialIfEligible");
const { sendInternalError } = require("../utils/safeErrorResponse");
const { normalizeLessonDescription } = require("../utils/lessonDescriptionLimits");

// ✅ ADDED: Import for revision validation
const { validateAndNormalizeRevision } = require("../services/validateRevision");

// ✅ ADDED: Import for curated visuals
const { findCuratedVisual } = require("../utils/curatedVisuals");
const { promoteHeroOnLesson, promotePageHeroToBlock } = require("../utils/promotePageHeroToBlock");
const { pickLessonFlags } = require("../utils/lessonValidation");
const { deriveLessonCardDescription } = require("../utils/deriveLessonCardDescription");
const {
  validateLessonStructure,
  validateLessonStructureForPublish,
  buildPublishWarningSummary,
  mergeStructureValidationForScoring,
} = require("../services/lessonDraftValidation");
const { scoreLessonQuality } = require("../lib/lessonQualityScoring");
const {
  isCurriculumAiReviewEnabled,
  isAutoRunOnDraftSaveEnabled,
  isPhase1AutoOnceEnabled,
  getCurriculumReviewPublishWarning,
  runCurriculumAiReviewForLesson,
  scheduleDraftSaveCurriculumReviewIfEligible,
} = require("../services/curriculumAiReviewService");

console.log("✅ lessons router file loaded");

/* =========================================
   ✅ ADDED: PING ROUTE FOR TESTING
   ========================================= */

router.get("/_ping", (req, res) => {
  res.json({ ok: true, router: "lessons", ts: Date.now() });
});

/* =========================================
   GCSE TIER HELPERS
   ========================================= */

function normalizeTier(tier) {
  if (tier === undefined || tier === null) return undefined;

  const t = String(tier).trim().toLowerCase();

  if (t === "" || t === "none" || t === "all") return undefined;
  if (t.includes("foundation")) return "foundation";
  if (t.includes("higher")) return "higher";
  if (t === "foundation" || t === "higher") return t;

  return t;
}

function sanitizeTierByLevel(level, tier) {
  if (!level) return undefined;
  if (String(level).toUpperCase() !== "GCSE") return undefined;
  return normalizeTier(tier);
}

/* =========================================
   ✅ ADDED: ROLE ENFORCEMENT HELPER (Centralized)
   ========================================= */

function isAdmin(user) {
  return user?.userType === "admin" || user?.role === "admin" || user?.isAdmin === true;
}

function isTeacher(user) {
  return user?.userType === "teacher";
}

function isTeacherOrAdmin(user) {
  return isTeacher(user) || isAdmin(user);
}

function isStudent(user) {
  return user?.userType === "student";
}

/**
 * Pattern B: validate lesson topic (registry) and build ExamQuestion bank filter using
 * resolveQuestionBankNamespacedTopicKey (inheritQuestionBankFrom / mapsToCanonicalKey).
 * @returns {{ namespacedKey: string|null, examBankTopicFilter: { topicKey: unknown }|null }}
 */
function examBankTopicQueryFromLessonTopicKey(topicKeyRaw) {
  if (!topicKeyRaw || typeof topicKeyRaw !== "string" || !topicKeyRaw.trim()) {
    return { namespacedKey: null, examBankTopicFilter: null };
  }
  const trimmed = topicKeyRaw.trim();
  const parsed = parseTopicKey(trimmed);
  const specKey = parsed.specKey || DEFAULT_SPEC_LEGACY;
  const topicOnly = parsed.topicKey || trimmed.toLowerCase();
  const namespaced = trimmed.includes(":") ? trimmed : buildTopicKey(specKey, topicOnly);
  try {
    const nsSpec = parseTopicKey(namespaced).specKey || specKey;
    assertValidNamespacedTopicKey(nsSpec, namespaced);
  } catch (_) {
    return { namespacedKey: null, examBankTopicFilter: null };
  }
  const nsSpec = parseTopicKey(namespaced).specKey || specKey;
  const bankNs = resolveQuestionBankNamespacedTopicKey(nsSpec, namespaced);
  const bankParsed = parseTopicKey(bankNs);
  const bankSpec = bankParsed.specKey || nsSpec;
  const bankTopicOnly = bankParsed.topicKey || topicOnly;
  const candidates = queryCandidates(bankSpec, bankTopicOnly);
  const examBankTopicFilter =
    candidates.length > 0 ? { topicKey: { $in: candidates } } : { topicKey: bankNs };
  return { namespacedKey: namespaced, examBankTopicFilter };
}

/* =========================================
   PAGES SANITISER (shared) - FIXED HERO PERSISTENCE
   ========================================= */

function makePageIdFallback(idx) {
  return `p_${Date.now()}_${idx}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Glossary / keyword highlight metadata (student view). Whitelist: contentKeywords only.
 * @param {unknown} m
 * @returns {{ contentKeywords: Array<{ term: string, definition?: string }> }|undefined}
 */
function sanitisePageMetadataForGlossary(m) {
  if (!m || typeof m !== "object") return undefined;
  const arr = m.contentKeywords;
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const term = typeof item.term === "string" ? item.term.trim().slice(0, 200) : "";
    if (!term) continue;
    const k = term.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    const row = { term };
    if (typeof item.definition === "string" && item.definition.trim()) {
      row.definition = item.definition.trim().slice(0, 8000);
    }
    out.push(row);
    if (out.length >= 100) break;
  }
  return out.length ? { contentKeywords: out } : undefined;
}

/** Sanitize checkpoint.autoMark (keyword-bank auto-marking); omit if empty. */
function sanitiseCheckpointAutoMark(raw) {
  if (!raw || typeof raw !== "object") return undefined;
  const clamp01 = (x) => {
    const n = Number(x);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.6;
  };
  const strArr = (a, maxLen, maxItems) => {
    if (!Array.isArray(a)) return undefined;
    const out = a
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((s) => s.slice(0, maxLen));
    return out.length ? out : undefined;
  };
  const canonicalAnswer =
    typeof raw.canonicalAnswer === "string" ? raw.canonicalAnswer.trim().slice(0, 4000) : "";
  const requiredKeywords = strArr(raw.requiredKeywords, 120, 40);
  const optionalKeywords = strArr(raw.optionalKeywords, 120, 40);
  const forbiddenMisconceptions = strArr(raw.forbiddenMisconceptions, 200, 30);
  const acceptedVariants = strArr(raw.acceptedVariants, 2000, 25);
  const minMatchThreshold = clamp01(raw.minMatchThreshold);
  const hasAny =
    canonicalAnswer ||
    requiredKeywords ||
    optionalKeywords ||
    forbiddenMisconceptions ||
    acceptedVariants;
  if (!hasAny) return undefined;
  return {
    canonicalAnswer,
    ...(requiredKeywords ? { requiredKeywords } : {}),
    ...(optionalKeywords ? { optionalKeywords } : {}),
    ...(forbiddenMisconceptions ? { forbiddenMisconceptions } : {}),
    ...(acceptedVariants ? { acceptedVariants } : {}),
    minMatchThreshold,
  };
}

// ✅ UPDATED: Separate sanitization from merging logic
function contentLooksLikeGraphJson(content) {
  const raw = typeof content === "string" ? content.trim() : "";
  if (!raw.startsWith("{")) return false;
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== "object") return false;
    const series = j.graphSeries || j.series;
    if (!Array.isArray(series) || series.length === 0) return false;
    return series.some(
      (row) =>
        row &&
        typeof row === "object" &&
        Array.isArray(row.points) &&
        row.points.length > 0
    );
  } catch {
    return false;
  }
}

/** Merge graph JSON backup in `content` into structured graph fields; never persist JSON as prose. */
function hydrateGraphBlockFromInput(b) {
  if (!b || typeof b !== "object") return null;

  let rawType = String(b.type ?? "").trim();
  const compactType = rawType.replace(/[\s_-]/g, "").toLowerCase();
  if (compactType === "graph" || compactType === "graphblock") rawType = "graph";

  const contentRaw = typeof b.content === "string" ? b.content.trim() : "";
  const fromContentJson = contentLooksLikeGraphJson(contentRaw);
  const isGraphType = rawType === "graph";
  const hasSeries =
    Array.isArray(b.graphSeries) &&
    b.graphSeries.some(
      (row) =>
        row &&
        typeof row === "object" &&
        Array.isArray(row.points) &&
        row.points.length > 0
    );

  if (!isGraphType && !fromContentJson) return null;

  let merged = { ...b };
  if (fromContentJson && !hasSeries) {
    try {
      const j = JSON.parse(contentRaw);
      if (j && typeof j === "object") {
        merged = {
          ...merged,
          ...j,
          graphSeries: j.graphSeries || j.series || merged.graphSeries,
        };
      }
    } catch {
      /* ignore */
    }
  }

  const title =
    typeof merged.title === "string" ? merged.title.trim().slice(0, 500) : "";
  const intro = typeof merged.intro === "string" ? merged.intro.trim().slice(0, 8000) : "";
  const graphTypeRaw = String(merged.graphType ?? "line").trim().toLowerCase();
  const graphType =
    graphTypeRaw === "bar" ? "bar" : graphTypeRaw === "scatter" ? "scatter" : "line";

  const graphOut = {
    type: "graph",
    content: "",
    title,
    intro,
    graphType,
    xAxisLabel:
      typeof merged.xAxisLabel === "string" ? merged.xAxisLabel.trim().slice(0, 200) : "",
    yAxisLabel:
      typeof merged.yAxisLabel === "string" ? merged.yAxisLabel.trim().slice(0, 200) : "",
    xUnits: typeof merged.xUnits === "string" ? merged.xUnits.trim().slice(0, 80) : "",
    yUnits: typeof merged.yUnits === "string" ? merged.yUnits.trim().slice(0, 80) : "",
    graphSeries: Array.isArray(merged.graphSeries) ? merged.graphSeries : [],
    graphAnnotations: Array.isArray(merged.graphAnnotations)
      ? merged.graphAnnotations
      : [],
    examQuestion:
      typeof merged.examQuestion === "string"
        ? merged.examQuestion.trim().slice(0, 2000)
        : "",
    markScheme:
      typeof merged.markScheme === "string" ? merged.markScheme.trim().slice(0, 4000) : "",
    examinerTip:
      typeof merged.examinerTip === "string" ? merged.examinerTip.trim().slice(0, 2000) : "",
  };
  if (typeof merged.role === "string" && merged.role.trim()) {
    graphOut.role = merged.role.trim();
  }
  if (typeof merged.number === "number" && Number.isFinite(merged.number) && merged.number > 0) {
    graphOut.number = Math.trunc(merged.number);
  }
  return graphOut;
}

function sanitisePageInput(p, isUpdate = false) {
  const pageId =
    p && typeof p.pageId === "string" && p.pageId.trim()
      ? p.pageId.trim()
      : makePageIdFallback(0);

  const order = Number.isFinite(Number(p?.order)) ? Number(p.order) : 1;

  // ✅ FIXED: During update, don't default hero to {type:"none"} if missing
  let hero;
  if (p?.hero && typeof p.hero === "object") {
    const heroType = String(p.hero.type || "");
    if (["none", "image", "video", "animation"].includes(heroType)) {
      hero = {
        type: heroType,
        src: typeof p.hero.src === "string" ? p.hero.src : "",
        caption: typeof p.hero.caption === "string" ? p.hero.caption : "",
      };
    } else if (!isUpdate && heroType === "") {
      // Only default to "none" on creation, not update
      hero = { type: "none", src: "", caption: "" };
    }
  } else if (!isUpdate) {
    // Only default on creation
    hero = { type: "none", src: "", caption: "" };
  }

  const allowedBlockTypes = [
    "text",
    "keyIdea",
    "keyWords",
    "examTip",
    "commonMistake",
    "stretch",
    "checkpoint",
    "selfCheck",
    "pageQuiz",
    "diagram",
    "interactiveSequence",
    "interactiveDiagram",
    "dragDropMatch",
    "graph",
  ];
  const blocks = Array.isArray(p?.blocks)
    ? p.blocks.map((b) => {
        let rawType = String(b?.type ?? "").trim();
        const compactType = rawType.replace(/[\s_-]/g, "").toLowerCase();
        if (compactType === "dragdropmatch") rawType = "dragDropMatch";
        else if (compactType === "interactivediagram") rawType = "interactiveDiagram";
        else if (compactType === "interactivesequence") rawType = "interactiveSequence";
        else if (compactType === "graph" || compactType === "graphblock") rawType = "graph";
        else if (compactType === "keywords") rawType = "keyWords";
        else if (compactType === "selfcheck") rawType = "selfCheck";
        const type = allowedBlockTypes.includes(rawType) ? rawType : "text";
        if (type === "checkpoint") {
          const prompt = typeof b?.prompt === "string" ? b.prompt : "";
          const options = Array.isArray(b?.options) ? b.options.map((x) => String(x)).slice(0, 6) : [];
          const correctAnswer = typeof b?.correctAnswer === "string" ? b.correctAnswer : "";
          const questionType = b?.questionType === "short" ? "short" : "mcq";
          const nonEmptyOpts = options.filter((o) => String(o || "").trim());
          const hasPrompt = String(prompt || "").trim().length > 0;
          const isValidMcq = questionType === "mcq" ? nonEmptyOpts.length >= 2 && nonEmptyOpts.some((o) => String(o).trim() === String(correctAnswer || "").trim()) : hasPrompt && String(correctAnswer || "").trim().length > 0;
          if (!hasPrompt || !isValidMcq) {
            return {
              type: "checkpoint",
              prompt: "Which statement is correct?",
              questionType: "mcq",
              options: ["Option 1", "Option 2", "Option 3", "Option 4"],
              correctAnswer: "Option 1",
              explanation: "",
            };
          }
          const markSchemeBlk = Array.isArray(b?.markScheme)
            ? b.markScheme.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
            : undefined;
          const explanationTrim =
            typeof b?.explanation === "string" && b.explanation.trim()
              ? b.explanation.trim().slice(0, 8000)
              : undefined;
          const cpOut = {
            type: "checkpoint",
            prompt: prompt.trim(),
            questionType,
            options: questionType === "mcq" ? nonEmptyOpts.slice(0, 6) : [],
            correctAnswer: correctAnswer.trim(),
            ...(explanationTrim ? { explanation: explanationTrim } : {}),
            ...(markSchemeBlk && markSchemeBlk.length ? { markScheme: markSchemeBlk } : {}),
          };
          if (typeof b?.role === "string" && b.role.trim()) cpOut.role = b.role.trim();
          return cpOut;
        }
        if (type === "selfCheck") {
          const prompt = typeof b?.prompt === "string" ? b.prompt : "";
          const options = Array.isArray(b?.options) ? b.options.map((x) => String(x)).slice(0, 6) : [];
          const correctAnswer = typeof b?.correctAnswer === "string" ? b.correctAnswer : "";
          const questionType = b?.questionType === "short" ? "short" : "mcq";
          const nonEmptyOpts = options.filter((o) => String(o || "").trim());
          const hasPrompt = String(prompt || "").trim().length > 0;
          const isValidMcq =
            questionType === "mcq"
              ? nonEmptyOpts.length >= 2 &&
                nonEmptyOpts.some((o) => String(o).trim() === String(correctAnswer || "").trim())
              : hasPrompt && String(correctAnswer || "").trim().length > 0;
          if (!hasPrompt || !isValidMcq) {
            return {
              type: "selfCheck",
              prompt: "Which statement is correct?",
              questionType: "mcq",
              options: ["Option 1", "Option 2", "Option 3", "Option 4"],
              correctAnswer: "Option 1",
              explanation: "",
            };
          }
          const scOut = {
            type: "selfCheck",
            prompt: prompt.trim(),
            questionType,
            options: questionType === "mcq" ? nonEmptyOpts.slice(0, 6) : [],
            correctAnswer: correctAnswer.trim(),
            explanation: typeof b?.explanation === "string" ? b.explanation : undefined,
          };
          if (typeof b?.role === "string" && b.role.trim()) scOut.role = b.role.trim();
          return scOut;
        }
        if (type === "pageQuiz") {
          const qText = typeof b?.question === "string" ? b.question : (typeof b?.prompt === "string" ? b.prompt : "");
          const pqOut = {
            type: "pageQuiz",
            question: qText,
            questionType: b?.questionType === "short" || b?.type === "shortAnswer" ? "short" : "mcq",
            options: Array.isArray(b?.options) ? b.options.map((x) => String(x)).slice(0, 6) : [],
            correctAnswer: typeof b?.correctAnswer === "string" ? b.correctAnswer : "",
            explanation: typeof b?.explanation === "string" ? b.explanation : undefined,
          };
          if (typeof b?.role === "string" && b.role.trim()) pqOut.role = b.role.trim();
          return pqOut;
        }
        if (type === "diagram") {
          const visualId =
            b?.visualId && mongoose.Types.ObjectId.isValid(String(b.visualId))
              ? b.visualId
              : undefined;
          const mode = ["static", "annotated", "step"].includes(String(b?.mode || "").trim())
            ? String(b.mode).trim()
            : "static";
          // PR11: sanitize annotations (max 30, text <= 80, x/y 0..1)
          const rawAnnotations = Array.isArray(b?.annotations) ? b.annotations : [];
          const annotations = rawAnnotations
            .slice(0, 30)
            .filter((a) => a && typeof a.id === "string" && String(a.id).trim())
            .map((a) => {
              const text = typeof a.text === "string" ? a.text.trim().slice(0, 80) : "";
              const x = Math.max(0, Math.min(1, Number(a.x) || 0.5));
              const y = Math.max(0, Math.min(1, Number(a.y) || 0.5));
              return {
                id: String(a.id).trim(),
                kind: a.kind === "callout" ? "callout" : "label",
                text,
                x,
                y,
                color: typeof a.color === "string" ? a.color.trim().slice(0, 20) : "",
                align: ["left", "center", "right"].includes(String(a.align || "").trim())
                  ? String(a.align).trim()
                  : "center",
              };
            });
          // PR11: sanitize steps (max 10, title <= 60, showAnnotationIds string[])
          const rawSteps = Array.isArray(b?.steps) ? b.steps : [];
          const steps = rawSteps
            .slice(0, 10)
            .filter((s) => s && typeof s.id === "string" && String(s.id).trim())
            .map((s) => ({
              id: String(s.id).trim(),
              title: typeof s.title === "string" ? s.title.trim().slice(0, 60) : "",
              showAnnotationIds: Array.isArray(s.showAnnotationIds)
                ? s.showAnnotationIds.map((id) => String(id)).filter(Boolean)
                : [],
            }));
          const rawConnectors = Array.isArray(b?.connectors) ? b.connectors : [];
          const connectors = rawConnectors
            .slice(0, 50)
            .filter((c) => c && typeof c.id === "string" && typeof c.labelId === "string")
            .map((c) => ({
              id: String(c.id).trim(),
              labelId: String(c.labelId).trim(),
              x: Math.max(0, Math.min(1, Number(c.x) ?? 0.5)),
              y: Math.max(0, Math.min(1, Number(c.y) ?? 0.5)),
            }));
          const diagramBlock = {
            type: "diagram",
            visualId: visualId || undefined,
            caption: typeof b?.caption === "string" ? b.caption : "",
            content: typeof b?.content === "string" && b.content.trim() ? b.content.trim() : "image here",
            mode,
            annotations: annotations.length ? annotations : undefined,
            steps: steps.length ? steps : undefined,
            connectors: connectors.length ? connectors : undefined,
          };
          if (typeof b?.imageUrl === "string" && b.imageUrl.trim()) diagramBlock.imageUrl = b.imageUrl.trim();
          if (typeof b?.imageSource === "string" && b.imageSource.trim()) diagramBlock.imageSource = b.imageSource.trim();
          if (typeof b?.alt === "string" && b.alt.trim()) diagramBlock.alt = b.alt.trim();
          if (typeof b?.role === "string" && b.role.trim()) diagramBlock.role = b.role.trim();
          if (String(b?.diagramVariant ?? "").trim() === "featured") {
            diagramBlock.diagramVariant = "featured";
          }
          if (typeof b?.title === "string" && b.title.trim()) diagramBlock.title = b.title.trim();
          const diagramInstructions =
            (typeof b?.subtitle === "string" && b.subtitle.trim()) ||
            (typeof b?.intro === "string" && b.intro.trim()) ||
            (typeof b?.note === "string" && b.note.trim()) ||
            "";
          if (diagramInstructions) {
            const trimmed = diagramInstructions.trim().slice(0, 4000);
            diagramBlock.subtitle = trimmed;
            diagramBlock.intro = trimmed;
            diagramBlock.note = trimmed;
            diagramBlock.content = trimmed;
          }
          if (typeof b?.number === "number" && Number.isFinite(b.number) && b.number > 0) {
            diagramBlock.number = Math.trunc(b.number);
          }
          return diagramBlock;
        }
        if (type === "interactiveSequence") {
          const title = typeof b?.title === "string" ? b.title.trim().slice(0, 240) : "";
          const intro = typeof b?.intro === "string" ? b.intro.trim().slice(0, 4000) : "";
          const rawSeq = Array.isArray(b?.sequenceSteps)
            ? b.sequenceSteps
            : Array.isArray(b?.steps)
              ? b.steps
              : [];
          const sequenceSteps = rawSeq
            .slice(0, 40)
            .map((s) => {
              if (!s || typeof s !== "object") {
                return { title: "", description: "", imageUrl: "", caption: "" };
              }
              const sid = typeof s.id === "string" && s.id.trim() ? s.id.trim().slice(0, 64) : "";
              const row = {
                title: typeof s.title === "string" ? s.title.trim().slice(0, 200) : "",
                description: typeof s.description === "string" ? s.description.trim().slice(0, 8000) : "",
                imageUrl: typeof s.imageUrl === "string" ? s.imageUrl.trim().slice(0, 2000) : "",
                caption: typeof s.caption === "string" ? s.caption.trim().slice(0, 500) : "",
              };
              if (typeof s.testQuestion === "string" && s.testQuestion.trim()) {
                row.testQuestion = s.testQuestion.trim().slice(0, 500);
              }
              if (typeof s.testExplanation === "string" && s.testExplanation.trim()) {
                row.testExplanation = s.testExplanation.trim().slice(0, 4000);
              }
              return sid ? { id: sid, ...row } : row;
            })
            .filter(
              (s) =>
                s.title ||
                s.description ||
                s.imageUrl ||
                s.caption ||
                s.testQuestion ||
                s.testExplanation
            );
          const seqOut = {
            type: "interactiveSequence",
            title,
            intro,
            sequenceSteps,
          };
          if (typeof b?.role === "string" && b.role.trim()) seqOut.role = b.role.trim();
          return seqOut;
        }
        if (type === "interactiveDiagram") {
          const title = typeof b?.title === "string" ? b.title.trim().slice(0, 240) : "";
          const intro = typeof b?.intro === "string" ? b.intro.trim().slice(0, 4000) : "";
          const imageUrl = typeof b?.imageUrl === "string" ? b.imageUrl.trim().slice(0, 2000) : "";
          const rawH = Array.isArray(b?.hotspots) ? b.hotspots : [];
          const sanitizeHotspotTest = (t) => {
            if (!t || typeof t !== "object") return undefined;
            const question = typeof t.question === "string" ? t.question.trim().slice(0, 2000) : "";
            const optionsRaw = Array.isArray(t.options) ? t.options.map((x) => String(x ?? "").trim()) : [];
            if (!question || optionsRaw.length !== 4 || optionsRaw.some((s) => !s)) return undefined;
            let ci = typeof t.correctIndex === "number" && Number.isFinite(t.correctIndex) ? Math.round(t.correctIndex) : 0;
            ci = Math.max(0, Math.min(3, ci));
            const explanation =
              typeof t.explanation === "string" && t.explanation.trim()
                ? t.explanation.trim().slice(0, 8000)
                : undefined;
            return {
              question,
              options: optionsRaw,
              correctIndex: ci,
              ...(explanation ? { explanation } : {}),
            };
          };
          const hotspots = rawH
            .slice(0, 40)
            .map((h, i) => {
              if (!h || typeof h !== "object")
                return { id: `h${i + 1}`, label: "", description: "" };
              const id =
                typeof h.id === "string" && h.id.trim()
                  ? h.id.trim().slice(0, 64)
                  : `h${i + 1}`;
              const label = typeof h.label === "string" ? h.label.trim().slice(0, 200) : "";
              const explanationIn =
                typeof h.explanation === "string" ? h.explanation.trim().slice(0, 8000) : "";
              const descriptionIn =
                typeof h.description === "string" ? h.description.trim().slice(0, 8000) : "";
              const resolved = explanationIn || descriptionIn;
              const test = sanitizeHotspotTest(h.test);
              const nx = h.x;
              const ny = h.y;
              const hasX = nx != null && nx !== "" && Number.isFinite(Number(nx));
              const hasY = ny != null && ny !== "" && Number.isFinite(Number(ny));
              if (hasX && hasY) {
                return {
                  id,
                  x: Math.max(0, Math.min(100, Number(nx))),
                  y: Math.max(0, Math.min(100, Number(ny))),
                  label,
                  description: resolved,
                  ...(resolved ? { explanation: resolved } : {}),
                  ...(test ? { test } : {}),
                };
              }
              return {
                id,
                label,
                description: resolved,
                ...(resolved ? { explanation: resolved } : {}),
                ...(test ? { test } : {}),
              };
            })
            .filter((h) => h.id);
          const outId = {
            type: "interactiveDiagram",
            title,
            intro,
            ...(imageUrl ? { imageUrl } : {}),
            hotspots,
          };
          if (typeof b?.role === "string" && b.role.trim()) outId.role = b.role.trim();
          return outId;
        }
        if (type === "dragDropMatch") {
          const title = typeof b?.title === "string" ? b.title.trim().slice(0, 240) : "";
          const intro = typeof b?.intro === "string" ? b.intro.trim().slice(0, 4000) : "";
          const instructions = typeof b?.instructions === "string" ? b.instructions.trim().slice(0, 4000) : "";
          const rawPairs = Array.isArray(b?.pairs) ? b.pairs : [];
          const pairs = rawPairs
            .slice(0, 20)
            .map((row, i) => {
              if (!row || typeof row !== "object") {
                return { id: `pair_${i + 1}`, prompt: "", answer: "", explanation: "" };
              }
              const id =
                typeof row.id === "string" && row.id.trim()
                  ? row.id.trim().slice(0, 64)
                  : `pair_${i + 1}`;
              let answerImageUrlRaw =
                typeof row.answerImageUrl === "string" ? row.answerImageUrl.trim().slice(0, 8000) : "";
              if (!answerImageUrlRaw && typeof row.answer_image_url === "string") {
                answerImageUrlRaw = row.answer_image_url.trim().slice(0, 8000);
              }
              const pairOut = {
                id,
                prompt: typeof row.prompt === "string" ? row.prompt.trim().slice(0, 2000) : "",
                answer: typeof row.answer === "string" ? row.answer.trim().slice(0, 2000) : "",
                explanation:
                  typeof row.explanation === "string" && row.explanation.trim()
                    ? row.explanation.trim().slice(0, 8000)
                    : undefined,
              };
              if (answerImageUrlRaw) pairOut.answerImageUrl = answerImageUrlRaw;
              let imageUrlRaw =
                typeof row.imageUrl === "string" ? row.imageUrl.trim().slice(0, 8000) : "";
              if (!imageUrlRaw && typeof row.image_url === "string") {
                imageUrlRaw = row.image_url.trim().slice(0, 8000);
              }
              if (imageUrlRaw) pairOut.imageUrl = imageUrlRaw;
              const imageAltRaw =
                typeof row.imageAlt === "string" ? row.imageAlt.trim().slice(0, 500) : "";
              if (imageAltRaw) pairOut.imageAlt = imageAltRaw;
              return pairOut;
            })
            .filter((row) => row.id);
          const pairIdSet = new Set(pairs.map((r) => r.id));
          const rawMm = b?.dragDropLayout ?? b?.matchMode;
          const mmRaw = rawMm == null ? "" : String(rawMm).trim().toLowerCase().replace(/[\s_]+/g, "-");
          const mmNorm =
            rawMm == null
              ? undefined
              : mmRaw === "diagram"
                ? "diagram"
                : mmRaw === "text" || mmRaw === "standard"
                  ? "text"
                  : mmRaw === "text-to-image" || mmRaw === "texttoimage"
                    ? "text-to-image"
                    : undefined;
          const rawZones = Array.isArray(b?.dropZones) ? b.dropZones : [];
          const dropZones = rawZones
            .slice(0, 40)
            .map((z, zi) => {
              if (!z || typeof z !== "object") return null;
              const id =
                typeof z.id === "string" && z.id.trim()
                  ? z.id.trim().slice(0, 64)
                  : `dz_${zi + 1}`;
              const correctPairId =
                typeof z.correctPairId === "string" && z.correctPairId.trim()
                  ? z.correctPairId.trim().slice(0, 80)
                  : "";
              if (!correctPairId || !pairIdSet.has(correctPairId)) return null;
              const zoneOut = { id, correctPairId };
              const nx = z.x;
              const ny = z.y;
              if (nx != null && nx !== "" && Number.isFinite(Number(nx))) {
                zoneOut.x = Math.max(0, Math.min(100, Number(nx)));
              }
              if (ny != null && ny !== "" && Number.isFinite(Number(ny))) {
                zoneOut.y = Math.max(0, Math.min(100, Number(ny)));
              }
              const expl =
                typeof z.explanation === "string" && z.explanation.trim()
                  ? z.explanation.trim().slice(0, 8000)
                  : undefined;
              if (expl) zoneOut.explanation = expl;
              return zoneOut;
            })
            .filter(Boolean);
          const fitNorm =
            typeof b?.imageFit === "string" && b.imageFit.trim()
              ? String(b.imageFit).trim().toLowerCase()
              : "";
          const imageFit = fitNorm === "cover" ? "cover" : fitNorm === "contain" ? "contain" : undefined;
          const posNorm =
            typeof b?.imagePosition === "string" && b.imagePosition.trim()
              ? String(b.imagePosition).trim().toLowerCase().replace(/\s+/g, " ")
              : "";
          const imagePosition =
            posNorm === "center center" || posNorm === "center top" || posNorm === "center bottom"
              ? posNorm
              : posNorm === "center"
                ? "center center"
                : posNorm === "top"
                  ? "center top"
                  : posNorm === "bottom"
                    ? "center bottom"
                    : undefined;
          let effectiveMm = mmNorm;
          if (effectiveMm !== "diagram" && effectiveMm !== "text" && effectiveMm !== "text-to-image") {
            const hasPairTargetImages = pairs.some((row) => Boolean(row.imageUrl));
            if (hasPairTargetImages) {
              effectiveMm = "text-to-image";
            } else {
              const inferredImg =
                typeof b?.imageUrl === "string" && String(b.imageUrl).trim().length > 0;
              if (inferredImg && dropZones.length > 0) {
                effectiveMm = "diagram";
              }
            }
          }
          const ddmOut = {
            type: "dragDropMatch",
            title,
            intro,
            instructions,
            pairs,
          };
          if (typeof b?.role === "string" && b.role.trim()) ddmOut.role = b.role.trim();
          if (effectiveMm === "diagram") {
            ddmOut.matchMode = "diagram";
            ddmOut.dragDropLayout = "diagram";
            const imageUrl =
              typeof b?.imageUrl === "string" && b.imageUrl.trim()
                ? b.imageUrl.trim().slice(0, 8000)
                : "";
            if (imageUrl) ddmOut.imageUrl = imageUrl;
            if (imageFit) ddmOut.imageFit = imageFit;
            if (imagePosition) ddmOut.imagePosition = imagePosition;
            ddmOut.dropZones = dropZones;
          } else if (effectiveMm === "text") {
            ddmOut.matchMode = "text";
            ddmOut.dragDropLayout = "standard";
          } else if (effectiveMm === "text-to-image") {
            ddmOut.matchMode = "textToImage";
            ddmOut.dragDropLayout = "textToImage";
          }
          return ddmOut;
        }
        const hydratedGraph = hydrateGraphBlockFromInput(b);
        if (hydratedGraph) {
          return hydratedGraph;
        }
        const out = {
          type,
          content: typeof b?.content === "string" ? b.content : "",
        };
        if (typeof b?.title === "string" && b.title.trim()) out.title = b.title.trim();
        if (typeof b?.number === "number" && Number.isFinite(b.number) && b.number > 0) {
          out.number = Math.trunc(b.number);
        }
        if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
        return out;
      })
    : [];

  const VALID_DEFAULT_CHECKPOINT = {
    question: "Which statement is correct?",
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
    answer: "Option 1",
    type: "mcq",
  };

  let checkpoint;
  if (p?.checkpoint && typeof p.checkpoint === "object") {
    const cp = p.checkpoint;
    const cpType = cp.type === "shortExplain" ? "shortExplain" : "mcq";
    const markScheme = Array.isArray(cp.markScheme)
      ? cp.markScheme.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
      : undefined;
    const autoMark = sanitiseCheckpointAutoMark(cp.autoMark);
    const explanation =
      typeof cp.explanation === "string" && cp.explanation.trim()
        ? cp.explanation.trim().slice(0, 8000)
        : undefined;

    const base = {
      question: typeof cp.question === "string" ? cp.question : "",
      options: Array.isArray(cp.options) ? cp.options.map((x) => String(x)).slice(0, 4) : [],
      answer: typeof cp.answer === "string" ? cp.answer : "",
      type: cpType,
      ...(explanation ? { explanation } : {}),
      ...(markScheme && markScheme.length ? { markScheme } : {}),
      ...(autoMark ? { autoMark } : {}),
    };

    if (cpType === "shortExplain") {
      const hasValidQuestion = String(base.question || "").trim().length > 0;
      checkpoint = hasValidQuestion ? base : VALID_DEFAULT_CHECKPOINT;
    } else {
      const nonEmptyOpts = (base.options || []).filter((o) => String(o || "").trim());
      const hasValidQuestion = String(base.question || "").trim().length > 0;
      const hasEnoughOptions = nonEmptyOpts.length >= 2;
      const answerMatches = nonEmptyOpts.some((o) => String(o).trim() === String(base.answer || "").trim());
      if (!hasValidQuestion || !hasEnoughOptions || !answerMatches) {
        checkpoint = VALID_DEFAULT_CHECKPOINT;
      } else {
        checkpoint = { ...base, options: nonEmptyOpts.slice(0, 4) };
      }
    }
  } else {
    checkpoint = undefined;
  }

  const nonEmptyOptsMcq = (checkpoint?.options || []).filter((o) => String(o || "").trim());
  const hasValidQuestionMcq = String(checkpoint?.question || "").trim().length > 0;
  const hasEnoughOptionsMcq = nonEmptyOptsMcq.length >= 2;
  const answerMatchesMcq = nonEmptyOptsMcq.some((o) => String(o).trim() === String(checkpoint?.answer || "").trim());
  if (
    !checkpoint ||
    (checkpoint.type !== "shortExplain" &&
      (!hasValidQuestionMcq || !hasEnoughOptionsMcq || !answerMatchesMcq))
  ) {
    checkpoint = VALID_DEFAULT_CHECKPOINT;
  }

  // ✅ NEW (non-breaking): allow saving visualModelId if provided
  const visualModelId =
    p?.visualModelId && mongoose.Types.ObjectId.isValid(String(p.visualModelId))
      ? String(p.visualModelId)
      : undefined;

  const pageMetadata = sanitisePageMetadataForGlossary(p?.metadata);

  return {
    pageId,
    title: typeof p?.title === "string" ? p.title : "",
    order,
    pageType: typeof p?.pageType === "string" ? p.pageType : "",
    hero,
    blocks,
    checkpoint,
    ...(visualModelId ? { visualModelId } : {}),
    ...(pageMetadata ? { metadata: pageMetadata } : {}),
  };
}

function sanitisePagesInput(pages, isUpdate = false) {
  if (!Array.isArray(pages)) return [];
  return pages.map((p) => sanitisePageInput(p, isUpdate));
}

/**
 * If incoming page object did not include a `metadata` key at all, preserve glossary
 * metadata from the existing DB page (partial client payloads used to wipe contentKeywords).
 */
function preservePageGlossaryMetadataIfMissingOnIncoming(incomingPage, existingPage, sanitizedPage) {
  if (!sanitizedPage || sanitizedPage.metadata) return sanitizedPage;
  if (!existingPage || !existingPage.metadata) return sanitizedPage;
  if (incomingPage && Object.prototype.hasOwnProperty.call(incomingPage, "metadata")) {
    return sanitizedPage;
  }
  const fromExisting = sanitisePageMetadataForGlossary(existingPage.metadata);
  if (!fromExisting) return sanitizedPage;
  return { ...sanitizedPage, metadata: fromExisting };
}

// ✅ NEW: Merge pages while preserving existing hero if not explicitly set in update
function mergePagesOnUpdate(lessonId, existingPages = [], incomingPages = []) {
  if (!Array.isArray(incomingPages)) {
    console.warn(`⚠️ [Lesson ${lessonId}] incomingPages is not an array, defaulting to empty`);
    incomingPages = [];
  }

  const existingPagesMap = new Map();
  existingPages.forEach(page => {
    if (page.pageId) {
      existingPagesMap.set(page.pageId, page);
    }
  });

  const result = [];

  incomingPages.forEach((incomingPage, idx) => {
    const pageId = incomingPage.pageId || makePageIdFallback(idx);
    const existingPage = existingPagesMap.get(pageId);
    
    // If we have an existing page, check if we should preserve its hero
    if (existingPage && existingPage.hero && existingPage.hero.type !== "none") {
      const incomingHero = incomingPage.hero;
      
      // ✅ ADDED: Suspicious overwrite detection with logging
      if (!incomingHero || (incomingHero && incomingHero.type === "none")) {
        // ✅ FIX: REGRESSION GUARD - Log warning about suspicious hero overwrite
        console.warn(`⚠️ [Lesson ${lessonId}] Suspicious hero overwrite on page ${pageId}:`, {
          existingHeroType: existingPage.hero.type,
          incomingHero: incomingHero ? "type: 'none'" : "missing",
          action: "PRESERVING existing hero"
        });
        
        // Incoming doesn't specify hero or sets it to "none", preserve existing hero
        let sanitizedPage = sanitisePageInput(incomingPage, true);
        sanitizedPage.hero = existingPage.hero;
        sanitizedPage = preservePageGlossaryMetadataIfMissingOnIncoming(
          incomingPage,
          existingPage,
          sanitizedPage
        );
        result.push(sanitizedPage);
      } else if (incomingHero && incomingHero.type !== "none") {
        // Incoming has a valid hero, use it
        result.push(
          preservePageGlossaryMetadataIfMissingOnIncoming(
            incomingPage,
            existingPage,
            sanitisePageInput(incomingPage, true)
          )
        );
      } else {
        // Edge case: use incoming as-is
        result.push(
          preservePageGlossaryMetadataIfMissingOnIncoming(
            incomingPage,
            existingPage,
            sanitisePageInput(incomingPage, true)
          )
        );
      }
    } else {
      // No existing page or no existing hero, use incoming as-is
      result.push(
        preservePageGlossaryMetadataIfMissingOnIncoming(
          incomingPage,
          existingPage,
          sanitisePageInput(incomingPage, true)
        )
      );
    }
  });

  return result.sort((a, b) => (a.order || 0) - (b.order || 0));
}

/* =========================================
   UPLOADED IMAGES NORMALISER
   ========================================= */

function normalizeUploadedImages(uploadedImages) {
  if (!Array.isArray(uploadedImages)) return [];

  return uploadedImages
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && typeof x.url === "string") return x.url;
      return "";
    })
    .map((s) => String(s).trim())
    .filter(Boolean);
}

/* =========================================
   ✅ STAGE/KEYSTAGE HELPERS (Option A)
   ========================================= */

// Support your typo migration: stageKey -> Keystage
function normalizeKeyStage(v) {
  const s = (v || "").toString().trim().toLowerCase();
  if (!s) return "";
  if (s.includes("ks3")) return "ks3";
  if (s.includes("gcse") || s.includes("ks4")) return "gcse";
  if (s.includes("a-level") || s.includes("alevel") || s.includes("a level")) return "a-level";
  return s;
}

function deriveKeyStageFromYearGroup(yearGroup) {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return "";
  if (n >= 7 && n <= 9) return "ks3";
  if (n >= 10 && n <= 11) return "gcse";
  if (n >= 12 && n <= 13) return "a-level";
  return "";
}

function keyStageToLessonLevelLabel(ks) {
  const k = normalizeKeyStage(ks);
  if (k === "ks3") return "KS3";
  if (k === "gcse") return "GCSE";
  if (k === "a-level") return "A-Level";
  return "";
}

// best-effort auth id getter
function getAuthUserId(req) {
  return req.user?.userId || req.user?.id || req.user?._id || null;
}

/* =========================================
   ✅ NORMALISATION HELPERS (level/board)
   ========================================= */

// Case/format safe regex for Lesson.level
function levelToRegex(levelStr) {
  if (!levelStr) return null;
  const s = String(levelStr).trim().toLowerCase();

  if (!s) return null;
  if (s.includes("ks3") || s === "ks 3") return /ks\s*3/i;
  if (s.includes("gcse")) return /gcse/i;

  // A-Level variants: "A-Level", "A level", "Alevel", "A-level"
  if (s.includes("a") && s.includes("level")) return /a[\s-]?level/i;

  // fallback: case-insensitive exact-ish
  return new RegExp(`^${escapeRegex(String(levelStr).trim())}$`, "i");
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Treat null/empty/"not set" as "Not set"
function isNotSetBoard(boardStr) {
  const b = (boardStr || "").toString().trim().toLowerCase();
  return !b || b === "not set" || b === "none";
}

/* =========================================
   ✅ VISUAL ENRICHMENT HELPERS (non-breaking)
   ========================================= */

function normalizeLevelForVisual(levelRaw) {
  const s = (levelRaw || "").toString().trim().toLowerCase();
  if (!s) return "";
  if (s.includes("ks3") || s.includes("key stage 3")) return "KS3";
  if (s.includes("gcse")) return "GCSE";
  if (s.includes("a") && s.includes("level")) return "A-Level";
  return levelRaw;
}

function topicToConceptKey(topic) {
  const t = (topic || "").toString().trim().toLowerCase();
  if (!t) return "";
  if (t.includes("photosynthesis")) return "photosynthesis";
  return "";
}

async function attachVisualsToPagesIfPossible(lessonObj) {
  try {
    if (!lessonObj) return lessonObj;

    const pages = Array.isArray(lessonObj.pages) ? lessonObj.pages : [];
    if (pages.length === 0) return lessonObj;

    const conceptKey = topicToConceptKey(lessonObj.topic);
    if (!conceptKey) return lessonObj;

    const level = normalizeLevelForVisual(lessonObj.level);
    if (!level) return lessonObj;

    const visualModel = await VisualModel.findOne({
      conceptKey,
      isPublished: true,
    }).lean();

    if (!visualModel) return lessonObj;

    const variant = (visualModel.variants || []).find((v) => String(v.level) === String(level));
    if (!variant) return lessonObj;

    // Attach the same variant to any page that has no explicit visualModelId
    // This keeps behaviour stable AND gives you instant MVP visuals for Photosynthesis.
    const nextPages = pages.map((p) => {
      if (p && p.visualModelId) return p;
      return {
        ...p,
        visual: {
          conceptKey: visualModel.conceptKey,
          level,
          type: variant.type,
          src: variant.src,
          steps: Array.isArray(variant.steps) ? variant.steps : [],
          labels: Array.isArray(variant.labels) ? variant.labels : [],
          hiddenLabels: Array.isArray(variant.hiddenLabels) ? variant.hiddenLabels : [],
          narration: variant.narration || "",
        },
      };
    });

    return { ...lessonObj, pages: nextPages };
  } catch (e) {
    // Never break lesson view if visuals fail
    console.warn("⚠️ Visual enrichment skipped:", e?.message || e);
    return lessonObj;
  }
}

/* =========================================
   CREATE LESSON HANDLER (teachers only)
   ========================================= */

async function createLessonHandler(req, res) {
  try {
    console.log("✅ [Lessons] POST /api/lessons hit");

    if (!req.user) {
      console.error("❌ [Lessons] No req.user on request");
      return res.status(401).json({ msg: "No user on request" });
    }

    console.log("✅ [Lessons] Authenticated user:", {
      id: req.user._id || req.user.id,
      email: req.user.email,
      userType: req.user.userType,
    });

    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can create lessons" });
    }

    let {
      title,
      description,
      content,
      subject,
      level,
      topic,
      topicKey,
      specKey,
      mainTopic,
      subTopic,
      tags,
      estimatedDuration,
      resources,
      board,
      examBoard,
      tier,
      externalResources,
      uploadedImages,
      pages,
      quiz,
      autoGenerateFromBanks,
    } = req.body || {};

    description = normalizeLessonDescription(description);

    const missing = {};
    if (!title) missing.title = true;
    if (!description) missing.description = true;
    if (!content) missing.content = true;
    if (!subject) missing.subject = true;
    if (!level) missing.level = true;
    if (!topic) missing.topic = true;
    if (estimatedDuration === undefined || estimatedDuration === null) {
      missing.estimatedDuration = true;
    }

    if (Object.keys(missing).length > 0) {
      console.log("❌ [Lessons] Validation failed, missing:", missing);
      return res.status(400).json({
        msg: "Please fill in all required fields",
        missing,
      });
    }

    const tagsArray =
      typeof tags === "string"
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(tags)
        ? tags
        : [];

    const resourcesArray = Array.isArray(resources)
      ? resources
      : typeof externalResources === "string"
      ? externalResources
          .split(",")
          .map((u) => u.trim())
          .filter(Boolean)
      : [];

    const flags = pickLessonFlags(req.body);
    const lessonData = {
      title,
      description,
      content,
      teacherId: req.user._id,
      teacherName:
        `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() ||
        req.user.email,
      subject,
      level,
      topic,
      tags: tagsArray,
      estimatedDuration,
      resources: resourcesArray,

      // Teachers create drafts by default.
      status: "draft",
      isPublished: false,
      ...flags,
    };
    if (autoGenerateFromBanks === true || autoGenerateFromBanks === "true") {
      lessonData.autoGenerateFromBanks = true;
    }
    if (typeof topicKey === "string" && topicKey.trim()) {
      lessonData.topicKey = topicKey.trim();
    }
    if (typeof specKey === "string" && specKey.trim()) {
      lessonData.specKey = specKey.trim();
    }
    if (typeof mainTopic === "string" && mainTopic.trim()) {
      lessonData.mainTopic = mainTopic.trim();
    }
    if (typeof subTopic === "string" && subTopic.trim()) {
      lessonData.subTopic = subTopic.trim();
    }

    // PR0: accept examBoard or board, store as board
    const boardValue = examBoard !== undefined && examBoard !== null ? String(examBoard).trim() : (board !== undefined && board !== null ? String(board).trim() : "");
    if (boardValue) lessonData.board = boardValue;

    const normalisedTier = sanitizeTierByLevel(level, tier);
    if (normalisedTier) {
      lessonData.tier = normalisedTier;
    }

    const imgs = normalizeUploadedImages(uploadedImages);
    if (imgs.length > 0) {
      lessonData.uploadedImages = imgs;
    }

    // ✅ FIXED: Use sanitisePagesInput for creation (no merge needed)
    const safePages = sanitisePagesInput(pages, false);
    if (safePages.length > 0) {
      const sorted = safePages.sort((a, b) => (a.order || 0) - (b.order || 0));
      lessonData.pages = makeLessonDbSafe({ pages: sorted }).pages;
    }

    // Manual create: strict contract → warnings only (draft may use placeholders). AI paths use isManual: false.
    const structureValidation = validateLessonStructure({ pages: lessonData.pages }, { isManual: true });
    if (structureValidation.blocking.length > 0) {
      return res.status(400).json({
        msg: "Lesson failed structure validation",
        structureIssues: structureValidation.blocking,
        structureWarnings: structureValidation.warnings,
        missing: { structure: structureValidation.blocking },
      });
    }

    // ✅ ADDED: Normalize quiz.questions to array server-side
    if (quiz && typeof quiz === "object") {
      const quizData = { ...quiz };
      if (!Array.isArray(quizData.questions)) {
        console.warn("⚠️ [Lessons] quiz.questions is not an array, defaulting to empty");
        quizData.questions = [];
      }
      lessonData.quiz = quizData;
    }

    // ✅ ADDED: Auto-attach curated hero visual for AQA GCSE Biology with debug logging
    console.log("🧩 [CuratedVisual] lookup input:", {
      subject: lessonData.subject,
      examBoard: lessonData.board || "AQA",
      level: lessonData.level,
      topic: lessonData.topic,
    });

    try {
      const result = findCuratedVisual({
        subject: lessonData.subject,
        examBoard: lessonData.board || "AQA",
        level: lessonData.level,
        topic: lessonData.topic,
      });

      console.log("🧩 [CuratedVisual] result:", result?.debug);

      const hero = result?.hero;

      if (hero) {
        if (!Array.isArray(lessonData.pages)) lessonData.pages = [];
        if (!lessonData.pages[0])
          lessonData.pages[0] = {
            pageId: `p_${Date.now()}_0`,
            order: 1,
            title: "Overview",
            blocks: [],
          };

        lessonData.pages[0].hero = hero;
        lessonData.pages[0] = promotePageHeroToBlock(lessonData.pages[0]);
        console.log("✅ [CuratedVisual] hero promoted to diagram block:", hero);
      } else {
        console.log("⚠️ [CuratedVisual] no hero match");
      }
    } catch (e) {
      console.warn("⚠️ Curated hero attach skipped:", e?.message || e);
    }

    console.log("🧠 [Lessons] Saving lesson with payload:", {
      ...lessonData,
      pagesCount: Array.isArray(lessonData.pages) ? lessonData.pages.length : 0,
      uploadedImagesCount: Array.isArray(lessonData.uploadedImages)
        ? lessonData.uploadedImages.length
        : 0,
      hasHero: lessonData.pages?.[0]?.hero ? true : false,
    });

    // Pattern B: reject unregistered topicKey; normalize to namespaced form
    if (typeof lessonData.topicKey === "string" && lessonData.topicKey.trim()) {
      try {
        const spec =
          (lessonData.specKey && String(lessonData.specKey).trim()) ||
          parseTopicKey(lessonData.topicKey).specKey ||
          DEFAULT_SPEC_LEGACY;
        const namespaced =
          normalizeNamespacedLessonTopicKey(spec, {
            topicKey: lessonData.topicKey,
            canonicalTopicKey: lessonData.canonicalTopicKey,
            title: lessonData.title,
            topic: lessonData.topic,
            subTopic: lessonData.subTopic,
          }) ||
          (lessonData.topicKey.trim().includes(":") ? lessonData.topicKey.trim() : buildTopicKey(spec, lessonData.topicKey.trim()));
        assertValidNamespacedTopicKey(spec, namespaced);
        lessonData.topicKey = namespaced;
        lessonData.specKey = lessonData.specKey || spec;
      } catch (e) {
        if (e.code === "INVALID_SPEC_KEY" || e.code === "INVALID_TOPIC_KEY") {
          return res.status(400).json({ msg: e.message || "Invalid topicKey for this specification." });
        }
        throw e;
      }
    }

    const lesson = new Lesson(lessonData);
    await lesson.save();
    console.log("✅ [Lessons] Lesson saved:", lesson._id);

    // PR-EDGE-1: Auto-attach content from topic banks (fill-only, deterministic) when checkbox is set
    let autoGenResult = { flashcardsAdded: 0, quizAdded: 0, assessmentAdded: 0, pastPapersAdded: 0 };
    const shouldAutoGen = autoGenerateFromBanks === true || autoGenerateFromBanks === "true";
    if (shouldAutoGen) {
      try {
        const attach = await autoAttachLessonContent({
          lessonId: lesson._id,
          actorUserId: req.user._id || req.user.userId,
        });
        if (attach.ok && attach.attached) {
          const a = attach.attached;
          autoGenResult = {
            flashcardsAdded: (a.flashcards && a.flashcards.count) || 0,
            quizAdded: ((a.quiz && (a.quiz.mcqCount + a.quiz.shortCount)) || 0),
            assessmentAdded: (a.assessments && a.assessments.count) || 0,
            pastPapersAdded: 0,
          };
          if (attach.lesson) {
            Object.assign(lesson, attach.lesson);
          }
          console.log("✅ [Lessons] Auto-attach result:", autoGenResult);
        }
      } catch (e) {
        console.warn("⚠️ [Lessons] Auto-attach failed:", e?.message || e);
      }
    }

    const resPayload = {
      success: true,
      msg: "Lesson created successfully!",
      lesson,
    };
    if (structureValidation.warnings.length > 0) {
      resPayload.structureWarnings = structureValidation.warnings;
    }
    if (shouldAutoGen) {
      resPayload.autoGenerateResult = autoGenResult;
    }
    return res.json(resPayload);
  } catch (err) {
    return sendInternalError("lessons/create", err, res, { extra: { success: false } });
  }
}

/* =========================================
   CLONE GOLD-STANDARD LESSON HANDLER
   ========================================= */

async function cloneGoldLesson(req, res) {
  try {
    console.log("✅ [Lessons] POST /api/lessons/clone-gold hit");

    if (!req.user) {
      console.error("❌ [Lessons] No req.user on request");
      return res.status(401).json({ msg: "No user on request" });
    }

    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can clone lessons" });
    }

    // Find a gold-standard lesson to clone
    // For now, let's find the most recent well-structured lesson as a template
    // In the future, you can mark specific lessons as "gold-standard" in your database
    const goldLesson = await Lesson.findOne({
      isPublished: true,
      status: "published",
      $or: [
        { title: { $regex: /photosynthesis/i } },
        { topic: { $regex: /photosynthesis/i } }
      ]
    }).sort({ createdAt: -1 });

    if (!goldLesson) {
      // If no gold lesson found, create a basic template
      const templateLesson = new Lesson({
        title: "GCSE Biology: Photosynthesis (Template Copy)",
        description: "A comprehensive lesson on photosynthesis including light-dependent and light-independent reactions.",
        content: "This is a gold-standard template lesson. Customize it for your needs.",
        teacherId: req.user._id,
        teacherName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email,
        subject: "Biology",
        level: "GCSE",
        topic: "Photosynthesis",
        topicKey: "aqa-gcse-biology:photosynthesis",
        specKey: "aqa-gcse-biology",
        mainTopic: "Bioenergetics",
        subTopic: "Photosynthesis",
        tags: ["biology", "photosynthesis", "plants", "respiration"],
        estimatedDuration: 60,
        resources: [],
        board: "AQA",
        tier: "higher",
        status: "draft",
        isPublished: false,
        // ✅ Add flag to identify template-created lessons
        createdFromTemplate: true,
        pages: [
          {
            pageId: "overview",
            title: "Overview",
            order: 1,
            pageType: "overview",
            blocks: [
              {
                type: "text",
                content: "Photosynthesis is the process by which plants convert light energy into chemical energy."
              },
              {
                type: "keyIdea",
                content: "Key equation: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂"
              }
            ]
          },
          {
            pageId: "core_content",
            title: "Core Content",
            order: 2,
            pageType: "content",
            blocks: [
              {
                type: "text",
                content: "Photosynthesis occurs in the chloroplasts of plant cells, specifically in the thylakoid membranes."
              },
              {
                type: "examTip",
                content: "Remember that chlorophyll is the pigment that absorbs light energy."
              }
            ]
          },
          {
            pageId: "check_understanding",
            title: "Check Understanding",
            order: 3,
            pageType: "checkpoint",
            blocks: [
              {
                type: "text",
                content: "Test your knowledge with these questions:"
              }
            ],
            checkpoint: {
              question: "What are the products of photosynthesis?",
              options: ["Glucose and oxygen", "Carbon dioxide and water", "ATP and NADPH", "Chlorophyll and water"],
              answer: "Glucose and oxygen"
            }
          },
          {
            pageId: "exam_tips",
            title: "Exam Tips",
            order: 4,
            pageType: "exam",
            blocks: [
              {
                type: "examTip",
                content: "Always write the photosynthesis equation with state symbols for full marks."
              },
              {
                type: "commonMistake",
                content: "Don't confuse photosynthesis with respiration - they are opposite processes!"
              }
            ]
          },
          {
            pageId: "stretch",
            title: "Stretch & Challenge",
            order: 5,
            pageType: "stretch",
            blocks: [
              {
                type: "text",
                content: "Core knowledge: Photosynthesis converts light energy to chemical energy."
              },
              {
                type: "stretch",
                content: "Deeper knowledge: The Calvin cycle uses ATP and NADPH from the light-dependent reactions to fix carbon dioxide into organic molecules."
              }
            ]
          }
        ]
      });

      const clonedLesson = await templateLesson.save();
      
      console.log("✅ [Lessons] Created template lesson for cloning:", clonedLesson._id);
      
      return res.json({
        success: true,
        msg: "Gold-standard template lesson created successfully!",
        lessonId: clonedLesson._id,
        lesson: clonedLesson
      });
    }

    // Clone the found gold lesson
    const clonedData = {
      ...goldLesson.toObject(),
      _id: undefined,
      id: undefined,
      // ✅ UPDATED: Clear title to avoid accidental publishing of "Copy of ..."
      title: `${goldLesson.title} (Template Copy)`,
      teacherId: req.user._id,
      teacherName: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email,
      status: "draft",
      isPublished: false,
      // ✅ Add flag to identify template-created lessons
      createdFromTemplate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      views: 0,
      averageRating: 0,
      purchaseCount: 0,
      totalEarnings: 0
    };

    // Remove any purchase-related fields
    delete clonedData.purchaseCount;
    delete clonedData.totalEarnings;

    const clonedLesson = new Lesson(clonedData);
    await clonedLesson.save();

    console.log("✅ [Lessons] Gold lesson cloned:", {
      originalId: goldLesson._id,
      originalTitle: goldLesson.title,
      clonedId: clonedLesson._id,
      clonedTitle: clonedLesson.title,
      teacher: req.user.email
    });

    return res.json({
      success: true,
      msg: "Gold-standard lesson cloned successfully!",
      lessonId: clonedLesson._id,
      lesson: clonedLesson
    });
  } catch (err) {
    return sendInternalError("lessons/clone-gold", err, res, { extra: { success: false } });
  }
}

/* =========================================
   ✅ ADDED: ADMIN-ONLY DELETE ENFORCEMENT HELPER
   ========================================= */

function enforceAdminOnlyDeletion(req, existingLesson, incomingData) {
  if (isAdmin(req.user)) {
    return true; // Admins can do anything
  }

  // ✅ Check if teacher is trying to delete flashcards
  const existingFlashIds = new Set();
  (existingLesson.flashcards || []).forEach(card => {
    if (card.id) existingFlashIds.add(String(card.id));
  });

  const incomingFlashIds = new Set();
  const incomingFlashcards = incomingData.flashcards || [];
  incomingFlashcards.forEach(card => {
    if (card.id) incomingFlashIds.add(String(card.id));
  });

  // If existing has IDs that incoming doesn't have → deletion attempt
  for (const id of existingFlashIds) {
    if (!incomingFlashIds.has(id)) {
      console.warn(`⚠️ Teacher ${req.user._id} attempted to delete flashcard ${id}`);
      return false;
    }
  }

  // ✅ Check if teacher is trying to delete quiz questions
  const existingQuizIds = new Set();
  ((existingLesson.quiz || {}).questions || []).forEach(q => {
    if (q.id) existingQuizIds.add(String(q.id));
  });

  const incomingQuizQuestions = 
    incomingData.quiz?.questions || 
    incomingData.quizQuestions || 
    incomingData.quiz || 
    [];
  
  const incomingQuizIds = new Set();
  incomingQuizQuestions.forEach(q => {
    if (q.id) incomingQuizIds.add(String(q.id));
  });

  // If existing has IDs that incoming doesn't have → deletion attempt
  for (const id of existingQuizIds) {
    if (!incomingQuizIds.has(id)) {
      console.warn(`⚠️ Teacher ${req.user._id} attempted to delete quiz question ${id}`);
      return false;
    }
  }

  // ✅ Check empty array cases
  if (incomingFlashcards.length === 0 && existingFlashIds.size > 0) {
    console.warn(`⚠️ Teacher ${req.user._id} attempted to delete all flashcards with empty array`);
    return false;
  }

  if (incomingQuizQuestions.length === 0 && existingQuizIds.size > 0) {
    console.warn(`⚠️ Teacher ${req.user._id} attempted to delete all quiz questions with empty array`);
    return false;
  }

  return true;
}

/* =========================================
   ✅ ADDED: REVISION CONTENT ROUTE
   Attach or replace revision content (flashcards + quiz)
   ========================================= */

// ✅ AUTH MIDDLEWARE RESTORED
router.post("/:id/revision", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    // ✅ AUTHORIZATION CHECK RESTORED
    const requesterId = req.user?._id;
    const requesterType = req.user?.userType;
    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ msg: "Not authorized to update this lesson" });
    }

    // ✅ ENFORCE ADMIN-ONLY DELETION
    if (!isAdminUser && !enforceAdminOnlyDeletion(req, lesson, req.body)) {
      return res.status(403).json({ 
        msg: "Teachers cannot delete flashcards or quiz questions. Only admins can delete." 
      });
    }

    // Validate + normalise revision payload
    const { flashcards, quiz } = validateAndNormalizeRevision(req.body);

    // Attach (additive, non-destructive to lesson pages)
    if (flashcards !== undefined) {
      lesson.flashcards = flashcards;
    }

    if (quiz !== undefined) {
      lesson.quiz = quiz;
    }

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save();

    if (process.env.NODE_ENV !== "production" && updatedLesson.flashcards && updatedLesson.flashcards.length > 0) {
      const sample = updatedLesson.flashcards.slice(0, 3).map((c) => ({
        id: c.id,
        topicBankId: c.topicBankId || null,
        source: c.source || null,
        front: (c.front || "").slice(0, 30),
      }));
      console.log("[revision] Saved flashcards; first 3 (id, topicBankId, source, front):", JSON.stringify(sample));
    }

    res.json({
      success: true,
      lessonId: updatedLesson._id,
      flashcardsCount: updatedLesson.flashcards?.length ?? 0,
      quizQuestionsCount: updatedLesson.quiz?.questions?.length ?? 0,
      lesson: updatedLesson
    });
  } catch (err) {
    console.error("REVISION_ATTACH_ERROR", err);
    res.status(400).json({
      error: err.message || "Failed to attach revision content"
    });
  }
});

/* =========================================
   ✅ ADDED: AI-GENERATED REVISION CONTENT
   ========================================= */

/* =========================================
   Phase 9E: AI revision pipeline — generate into DRAFT only (draft-only visibility)
   Kill-switch: DISABLE_AI_REVISION_GENERATION=1 → 503
   ========================================= */
router.post("/:id/generate-revision", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const requesterId = req.user?._id;
    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ msg: "Not authorized to generate revision for this lesson" });
    }

    if (!lesson.pages || lesson.pages.length === 0) {
      return res.status(400).json({
        error: "Lesson has no content pages to generate revision from",
      });
    }

    // PR-CONTENT-TARGETING-1: require valid topicKey (body or from lesson); validate body when provided
    let specKey, namespacedTopicKey;
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      specKey = resolved.specKey;
      namespacedTopicKey = (req.body && req.body.topicKey) ? String(req.body.topicKey).trim() : resolved.namespacedTopicKey;
      if (req.body && req.body.topicKey) {
        assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
      }
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({
          error: err.message || "Lesson must be mapped to a valid syllabus topicKey (specKey:topicSlug) to generate practice.",
        });
      }
      throw err;
    }

    if (process.env.DISABLE_AI_REVISION_GENERATION === "1") {
      return res.status(503).json({
        success: false,
        code: "REVISION_GENERATION_DISABLED",
        error: "AI revision generation is temporarily disabled",
      });
    }

    const { generateRevisionForLesson } = require("../services/generateRevision");
    const revisionContent = await generateRevisionForLesson({ lesson });
    const { validateAndNormalizeRevision } = require("../services/validateRevision");
    const { flashcards, quiz } = validateAndNormalizeRevision({
      flashcards: revisionContent.flashcards,
      quiz: revisionContent.quiz,
    });
    const engineTelemetry = revisionContent.engineTelemetry || null;

    const draft = await LessonRevisionDraft.findOneAndUpdate(
      { lessonId: lesson._id },
      {
        $set: {
          generatedBy: requesterId,
          flashcards: flashcards || [],
          quiz: quiz || { timeSeconds: 600, questions: [] },
          status: "draft",
          ...(engineTelemetry && { engine: engineTelemetry }),
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    const engine = draft.engine || undefined;
    const messageForUser =
      engine?.status === "STUB"
        ? "Revision generated using standard content. You can edit the draft before applying."
        : undefined;

    res.status(200).json({
      success: true,
      lessonId: lesson._id,
      draftId: draft._id,
      flashcardsCount: (flashcards || []).length,
      quizQuestionsCount: (quiz?.questions || []).length,
      draft: {
        id: draft._id,
        lessonId: draft.lessonId,
        status: draft.status,
        engine: engine,
        flashcards: draft.flashcards,
        quiz: draft.quiz,
      },
      ...(messageForUser && { messageForUser }),
    });
  } catch (err) {
    if (err.code === "REVISION_GENERATION_DISABLED") {
      return res.status(503).json({
        success: false,
        code: "REVISION_GENERATION_DISABLED",
        error: err.message,
        messageForUser: "Revision is temporarily unavailable. Please try again later.",
      });
    }
    // 503 = service unavailable / gated; errorCode e.g. NOT_ALLOWLISTED, ROLLOUT_EXCLUDED, ENGINE_SPAWN_FAILED
    if (err.code === "REVISION_ENGINE_UNAVAILABLE") {
      return res.status(503).json({
        success: false,
        code: "REVISION_ENGINE_UNAVAILABLE",
        error: err.message,
        errorCode: err.engineErrorCode ?? null,
        messageForUser: "Revision is temporarily unavailable. Please try again later.",
      });
    }
    console.error("AI_REVISION_GENERATION_ERROR", err);
    let errorMessage = "Failed to generate revision content";
    if (err.message && (err.message.includes("API key") || err.message.includes("OpenAI"))) {
      errorMessage = "OpenAI API error. Please check API key configuration.";
    }
    res.status(400).json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
});

/* =========================================
   Phase 9E: GET revision draft (owner/admin only — draft-only visibility)
   ========================================= */
router.get("/:id/revision-draft", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Only lesson owner or admin can view revision draft" });
    }

    const draft = await LessonRevisionDraft.findOne({ lessonId }).lean();
    if (!draft) return res.status(404).json({ error: "No revision draft found for this lesson" });

    return res.json({
      id: draft._id,
      lessonId: draft.lessonId,
      generatedBy: draft.generatedBy,
      status: draft.status,
      engine: draft.engine || undefined,
      flashcards: draft.flashcards || [],
      quiz: draft.quiz || { timeSeconds: 600, questions: [] },
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });
  } catch (err) {
    console.error("GET revision-draft error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================
   Phase 9E: PUT revision draft (owner/admin — teacher edits)
   ========================================= */
router.put("/:id/revision-draft", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Only lesson owner or admin can edit revision draft" });
    }

    const draft = await LessonRevisionDraft.findOne({ lessonId });
    if (!draft) return res.status(404).json({ error: "No revision draft found for this lesson" });
    if (draft.status !== "draft") {
      return res.status(409).json({
        code: "DRAFT_ALREADY_APPLIED",
        error: "This draft has already been applied to the lesson",
      });
    }

    const merged = {
      flashcards: req.body?.flashcards !== undefined ? req.body.flashcards : draft.flashcards,
      quiz: req.body?.quiz !== undefined ? req.body.quiz : draft.quiz,
    };
    const { flashcards, quiz } = validateAndNormalizeRevision(merged);
    draft.flashcards = flashcards;
    draft.quiz = quiz;
    await draft.save({ runValidators: true });

    return res.json({
      success: true,
      draft: {
        id: draft._id,
        lessonId: draft.lessonId,
        status: draft.status,
        flashcards: draft.flashcards,
        quiz: draft.quiz,
        updatedAt: draft.updatedAt,
      },
    });
  } catch (err) {
    console.error("PUT revision-draft error:", err);
    if (err.message && err.message.startsWith("Must provide")) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================
   Post-publish AI checkpoint generation — owner/admin (background job)
   ========================================= */
router.get("/:id/checkpoint-generation/latest", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId).select("teacherId checkpointDraft").lean();
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Only lesson owner or admin can view checkpoint generation" });
    }

    const CheckpointGenerationJob = require("../models/CheckpointGenerationJob");
    const jobId = lesson.checkpointDraft?.jobId;
    const query = jobId
      ? { _id: jobId, lessonId }
      : { lessonId };
    const job = await CheckpointGenerationJob.findOne(query).sort({ createdAt: -1 }).lean();
    if (!job) return res.status(404).json({ error: "No checkpoint generation job for this lesson" });

    return res.json({
      job: {
        id: job._id,
        status: job.status,
        reviewStatus: job.reviewStatus,
        qualityScore: job.qualityScore,
        validationIssues: job.validationIssues || [],
        usage: job.usage || {},
        error: job.error || null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
      resultPayload: job.resultPayload || null,
    });
  } catch (err) {
    console.error("GET checkpoint-generation/latest error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * Merge validated checkpoint items from a completed job into lesson.pages (teacher review).
 * Works for published lessons — only updates page.checkpoint fields.
 */
router.post("/:id/checkpoint-draft/apply", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Only lesson owner or admin can apply checkpoint draft" });
    }

    const CheckpointGenerationJob = require("../models/CheckpointGenerationJob");
    const { applyCheckpointItemsToLesson } = require("../services/checkpointGeneration/applyDraftToLesson");

    const jobId = req.body?.jobId || lesson.checkpointDraft?.jobId;
    if (!jobId || !mongoose.Types.ObjectId.isValid(String(jobId))) {
      return res.status(400).json({ error: "jobId required (or save checkpoint draft first)" });
    }

    const job = await CheckpointGenerationJob.findOne({ _id: jobId, lessonId });
    if (!job) return res.status(404).json({ error: "Checkpoint job not found" });
    if (job.status !== "completed") {
      return res.status(409).json({ code: "JOB_NOT_READY", error: "Job is not completed yet" });
    }

    const items = job.resultPayload?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No checkpoint items in this job" });
    }

    const { updatedPages } = applyCheckpointItemsToLesson(lesson, items, { onlyIfCheckpointEmpty: false });
    lesson.checkpointDraft = {
      ...(lesson.checkpointDraft || {}),
      jobId: job._id,
      status: "applied_manually",
      qualityScore: job.qualityScore,
      generatedAt: lesson.checkpointDraft?.generatedAt || job.updatedAt,
      itemCounts: lesson.checkpointDraft?.itemCounts || { mcq: 0, shortExplain: 0 },
    };
    job.reviewStatus = "applied_manually";
    await job.save();
    await lesson.save({ runValidators: true });

    return res.json({
      success: true,
      msg: "Checkpoint draft applied to lesson pages",
      updatedPages,
      jobId: job._id,
    });
  } catch (err) {
    console.error("POST checkpoint-draft/apply error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/revision-draft/apply", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner && !isAdmin(req.user)) {
      return res.status(403).json({ error: "Only lesson owner or admin can apply revision draft" });
    }

    const lessonStatus = String(lesson.status || "").toLowerCase();
    if (lessonStatus === "published") {
      return res.status(409).json({
        success: false,
        code: "EDIT_PUBLISHED",
        error: "Cannot apply revision draft to a published lesson; unpublish first.",
      });
    }

    const draft = await LessonRevisionDraft.findOne({ lessonId });
    if (!draft) return res.status(404).json({ error: "No revision draft found for this lesson" });
    if (draft.status !== "draft") {
      return res.status(409).json({
        code: "DRAFT_ALREADY_APPLIED",
        error: "This draft has already been applied to the lesson",
      });
    }

    lesson.flashcards = draft.flashcards || [];
    lesson.quiz = draft.quiz || lesson.quiz || { timeSeconds: 600, questions: [] };
    await lesson.save({ runValidators: true });

    draft.status = "applied";
    await draft.save({ runValidators: true });

    return res.json({
      success: true,
      msg: "Revision draft applied to lesson",
      lesson: { id: lesson._id, flashcardsCount: lesson.flashcards?.length || 0, quizQuestionsCount: lesson.quiz?.questions?.length || 0 },
    });
  } catch (err) {
    console.error("POST revision-draft/apply error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================
   ROUTES
   ========================================= */

// Create a lesson
router.post("/", auth, createLessonHandler);

// Clone gold-standard lesson
router.post("/clone-gold", auth, cloneGoldLesson);

// Get all lessons by a teacher WITH purchase stats
router.get("/teacher", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can view their lessons" });
    }

    const lessons = await Lesson.find({ teacherId: req.user._id }).sort({
      createdAt: -1,
    });

    const lessonsWithStats = await Promise.all(
      lessons.map(async (lesson) => {
        const lessonObj = lesson.toObject();

        const purchaseCount = await Purchase.countDocuments({
          lessonId: lesson._id,
        });
        lessonObj.purchaseCount = purchaseCount;

        const purchases = await Purchase.find({ lessonId: lesson._id });
        const totalEarnings = purchases.reduce(
          (sum, purchase) => sum + (purchase.teacherEarnings || 0),
          0
        );
        lessonObj.totalEarnings = totalEarnings;

        lessonObj.readiness = computeLessonReadiness(lessonObj);
        return lessonObj;
      })
    );

    const {
      isRecommendInListEnabled,
      buildRecommendedCurriculumCheckSet,
    } = require("../utils/highPriorityLessonsForReview");
    let recommendedSet = null;
    if (isRecommendInListEnabled()) {
      recommendedSet = buildRecommendedCurriculumCheckSet(lessonsWithStats, 25);
    }

    const {
      isTagNeedsFromStudentsEnabled,
      getWeakLessonIdSetForTeacher,
    } = require("../utils/weakLessonsForCurriculumReview");
    let weakStudentSet = null;
    if (isCurriculumAiReviewEnabled() && isTagNeedsFromStudentsEnabled()) {
      try {
        weakStudentSet = await getWeakLessonIdSetForTeacher(req.user._id, {
          days: parseInt(String(process.env.CURRICULUM_AI_REVIEW_WEAK_LESSONS_DAYS || "14"), 10) || 14,
          limit: 60,
        });
      } catch (e) {
        console.error("[lessons/teacher] weakStudentSet:", e?.message || e);
      }
    }

    const payload = lessonsWithStats.map((lessonObj) => {
      const id = String(lessonObj._id);
      let row = lessonObj;
      if (recommendedSet && recommendedSet.has(id)) {
        row = { ...row, recommendedForCurriculumCheck: true };
      }
      if (weakStudentSet && weakStudentSet.has(id)) {
        row = { ...row, needsCurriculumReview: true };
      }
      return row;
    });

    return res.json(payload);
  } catch (err) {
    return sendInternalError("lessons/teacher-list", err, res);
  }
});

/* =========================================
   Phase 2: ranked draft lessons for manual curriculum AI (no batch jobs)
   GET /api/lessons/high-priority-for-review
   ========================================= */

router.get("/high-priority-for-review", auth, async (req, res) => {
  try {
    const {
      isHighPriorityEndpointEnabled,
      getHighPriorityLessonsForReview,
    } = require("../utils/highPriorityLessonsForReview");
    if (!isHighPriorityEndpointEnabled()) {
      return res.status(404).json({ msg: "Not found" });
    }
    if (!isCurriculumAiReviewEnabled()) {
      return res.status(404).json({ msg: "Curriculum AI review is not enabled" });
    }

    let teacherId = req.user._id;
    if (isAdmin(req.user) && req.query.teacherId && mongoose.Types.ObjectId.isValid(String(req.query.teacherId))) {
      teacherId = req.query.teacherId;
    } else if (req.user.userType !== "teacher" && !isAdmin(req.user)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (req.user.userType === "teacher" && String(teacherId) !== String(req.user._id)) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const items = await getHighPriorityLessonsForReview({ teacherId, limit });
    return res.json({ items, count: items.length });
  } catch (err) {
    return sendInternalError("lessons/high-priority-for-review", err, res);
  }
});

/* =========================================
   Phase 3: lessons with weak student practice signals (PracticeAttempt; no new analytics)
   GET /api/lessons/needs-curriculum-review
   ========================================= */

router.get("/needs-curriculum-review", auth, async (req, res) => {
  try {
    const {
      isWeakLessonsApiEnabled,
      getWeakLessonsForCurriculumReview,
    } = require("../utils/weakLessonsForCurriculumReview");
    if (!isWeakLessonsApiEnabled()) {
      return res.status(404).json({ msg: "Not found" });
    }
    if (!isCurriculumAiReviewEnabled()) {
      return res.status(404).json({ msg: "Curriculum AI review is not enabled" });
    }

    let teacherId = req.user._id;
    if (isAdmin(req.user) && req.query.teacherId && mongoose.Types.ObjectId.isValid(String(req.query.teacherId))) {
      teacherId = req.query.teacherId;
    } else if (req.user.userType !== "teacher" && !isAdmin(req.user)) {
      return res.status(403).json({ msg: "Not authorized" });
    }
    if (req.user.userType === "teacher" && String(teacherId) !== String(req.user._id)) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    let days = parseInt(String(req.query.days || ""), 10);
    if (!Number.isFinite(days) || days < 1) days = undefined;
    if (days != null && days > 60) days = 60;

    const items = await getWeakLessonsForCurriculumReview({ teacherId, limit, days });
    return res.json({ items, count: items.length });
  } catch (err) {
    return sendInternalError("lessons/needs-curriculum-review", err, res);
  }
});

// Teacher dashboard stats
router.get("/teacher/stats", auth, async (req, res) => {
  try {
    if (req.user.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can view stats" });
    }

    const teacherId = req.user._id;
    const lessons = await Lesson.find({ teacherId });

    const stats = {
      totalLessons: lessons.length,
      publishedLessons: lessons.filter((l) => l.isPublished === true).length,
      draftLessons: lessons.filter((l) => l.isPublished === false).length,
      totalEarnings: 0,
      totalPurchases: 0,
      averageRating: 0,
      monthlyEarnings: [],
    };

    const purchases = await Purchase.find({ teacherId });

    stats.totalPurchases = purchases.length;
    stats.totalEarnings = purchases.reduce(
      (sum, purchase) => sum + (purchase.teacherEarnings || 0),
      0
    );

    const publishedLessons = lessons.filter((l) => l.isPublished === true);
    if (publishedLessons.length > 0) {
      const totalRating = publishedLessons.reduce(
        (sum, lesson) => sum + (lesson.averageRating || 0),
        0
      );
      stats.averageRating = totalRating / publishedLessons.length;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentPurchases = purchases.filter((p) => p.timestamp >= sixMonthsAgo);

    const monthlyData = {};
    recentPurchases.forEach((purchase) => {
      const month = purchase.timestamp.toISOString().slice(0, 7);
      monthlyData[month] = (monthlyData[month] || 0) + (purchase.teacherEarnings || 0);
    });

    stats.monthlyEarnings = Object.entries(monthlyData)
      .map(([month, earnings]) => ({
        month: new Date(month + "-01").toLocaleString("default", { month: "short" }),
        earnings,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month + " 1");
        const dateB = new Date(b.month + " 1");
        return dateA - dateB;
      });

    return res.json(stats);
  } catch (err) {
    return sendInternalError("lessons/teacher-stats", err, res);
  }
});

/* =========================================
   GET lessons by topicKey (reuse suggestions; do not block creation)
   GET /api/lessons/by-topicKey?topicKey=specKey:topicSlug&includeDrafts=true
   ========================================= */
router.get("/by-topicKey", auth, async (req, res) => {
  try {
    const topicKey = typeof req.query.topicKey === "string" ? req.query.topicKey.trim() : "";
    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query is required" });
    }
    const includeDrafts = req.query.includeDrafts !== "false";
    const isTeacherOrAdmin = req.user?.userType === "teacher" || req.user?.userType === "admin" || req.user?.role === "admin";
    const query = { topicKey };
    if (!includeDrafts) query.status = "published";
    const lessons = await Lesson.find(query)
      .select("_id title subject level board topicKey status isPublished updatedAt teacherId teacherName")
      .sort({ isPublished: -1, updatedAt: -1 })
      .limit(10)
      .lean();
    const teacherIds = [...new Set(lessons.map((l) => l.teacherId).filter(Boolean))];
    const users = teacherIds.length
      ? await User.find({ _id: { $in: teacherIds } }).select("_id firstName lastName email").lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const list = lessons.map((l) => {
      const u = userMap.get(String(l.teacherId));
      const ownerName = u
        ? [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email
        : l.teacherName || "";
      return {
        _id: l._id,
        title: l.title,
        subject: l.subject,
        level: l.level,
        examBoard: l.board || "",
        topicKey: l.topicKey || "",
        updatedAt: l.updatedAt,
        ownerName: ownerName || undefined,
        teacherId: l.teacherId ? String(l.teacherId) : undefined,
        isPublished: !!l.isPublished,
        status: l.status || "draft",
      };
    });
    return res.json({ lessons: list });
  } catch (err) {
    return sendInternalError("lessons/by-topicKey", err, res);
  }
});

// Alias for reuse suggestions (same as by-topicKey; UI: "Similar lessons exist — view or copy")
router.get("/reuse-suggestions", auth, async (req, res) => {
  try {
    const topicKey = typeof req.query.topicKey === "string" ? req.query.topicKey.trim() : "";
    if (!topicKey) {
      return res.status(400).json({ error: "topicKey query is required" });
    }
    const includeDrafts = req.query.includeDrafts !== "false";
    const query = { topicKey };
    if (!includeDrafts) query.status = "published";
    const lessons = await Lesson.find(query)
      .select("_id title subject level board topicKey status isPublished updatedAt teacherId teacherName")
      .sort({ isPublished: -1, updatedAt: -1 })
      .limit(10)
      .lean();
    const teacherIds = [...new Set(lessons.map((l) => l.teacherId).filter(Boolean))];
    const users = teacherIds.length
      ? await User.find({ _id: { $in: teacherIds } }).select("_id firstName lastName email").lean()
      : [];
    const userMap = new Map(users.map((u) => [String(u._id), u]));
    const list = lessons.map((l) => {
      const u = userMap.get(String(l.teacherId));
      const ownerName = u
        ? [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email
        : l.teacherName || "";
      return {
        _id: l._id,
        title: l.title,
        subject: l.subject,
        level: l.level,
        examBoard: l.board || "",
        topicKey: l.topicKey || "",
        updatedAt: l.updatedAt,
        ownerName: ownerName || undefined,
        teacherId: l.teacherId ? String(l.teacherId) : undefined,
        isPublished: !!l.isPublished,
        status: l.status || "draft",
      };
    });
    return res.json({ lessons: list });
  } catch (err) {
    return sendInternalError("lessons/reuse-suggestions", err, res);
  }
});

/* =========================================
   POST /:id/duplicate — clone lesson as new draft owned by current teacher
   ========================================= */
router.post("/:id/duplicate", auth, async (req, res) => {
  try {
    if (req.user?.userType !== "teacher") {
      return res.status(403).json({ msg: "Only teachers can duplicate lessons" });
    }
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const source = await Lesson.findById(lessonId).lean();
    if (!source) return res.status(404).json({ msg: "Lesson not found" });
    const teacherName = `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email;
    const copy = {
      title: (source.title || "Untitled").trim() + " (Copy)",
      description: normalizeLessonDescription(source.description || ""),
      content: source.content || "",
      teacherId: req.user._id,
      teacherName,
      subject: source.subject || "",
      level: source.level || "",
      topic: source.topic || "",
      topicKey: source.topicKey || undefined,
      tags: Array.isArray(source.tags) ? source.tags : [],
      estimatedDuration: source.estimatedDuration ?? 0,
      resources: Array.isArray(source.resources) ? source.resources : [],
      board: source.board || "",
      tier: source.tier || undefined,
      pages: makeLessonDbSafe({
        pages: Array.isArray(source.pages) ? JSON.parse(JSON.stringify(source.pages)) : [],
      }).pages,
      quiz: source.quiz && typeof source.quiz === "object" ? JSON.parse(JSON.stringify(source.quiz)) : undefined,
      assessment: source.assessment && typeof source.assessment === "object" ? JSON.parse(JSON.stringify(source.assessment)) : undefined,
      flashcards: Array.isArray(source.flashcards) ? JSON.parse(JSON.stringify(source.flashcards)) : [],
      status: "draft",
      isPublished: false,
      examQuestions: [],
      pastPapers: [],
      createdFromTemplate: true,
      templateSource: source._id,
    };
    const lesson = new Lesson(copy);
    await lesson.save();
    return res.json({ lessonId: lesson._id });
  } catch (err) {
    return sendInternalError("lessons/duplicate", err, res);
  }
});

/* =========================================
   SAVE STRUCTURED PAGES (teacher/admin) - FIXED HERO PERSISTENCE
   ========================================= */

router.put("/:id/pages", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const requesterId = req.user?._id;
    const requesterType = req.user?.userType;

    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ msg: "Not authorised" });
    }

    const pages = Array.isArray(req.body.pages) ? req.body.pages : null;
    if (!pages) return res.status(400).json({ msg: "pages[] required" });

    // ✅ FIXED: Use mergePagesOnUpdate instead of sanitisePagesInput
    const mergedPages = mergePagesOnUpdate(lessonId, lesson.pages || [], pages);
    const promotedPages = promoteHeroOnLesson({ pages: mergedPages }).pages;

    lesson.pages = makeLessonDbSafe({ pages: promotedPages }).pages;
    lesson.markModified("pages");

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save({ new: true, runValidators: true });

    return res.json({
      success: true,
      msg: "Pages saved",
      pagesCount: updatedLesson.pages.length,
      firstPageId: updatedLesson.pages[0]?.pageId || null,
      lesson: updatedLesson
    });
  } catch (err) {
    console.error("Save pages error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   PUBLISH / UNPUBLISH (teacher/admin)
   ========================================= */

async function publishToggleHandler(req, res, mode) {
  try {
    const lessonId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    const requesterId = req.user?._id;
    const isOwner = String(lesson.teacherId) === String(requesterId);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is moderated and cannot be published" });
    }

    let willBePublished = false;
    if (mode === "publish") {
      willBePublished = true;
    } else {
      if (typeof req.body?.isPublished === "boolean") {
        willBePublished = req.body.isPublished;
      } else {
        willBePublished = !Boolean(lesson.isPublished);
      }
    }

    let publishWarningSummary = null;
    let publishValidationMode = null;
    let publishQualityScore = null;
    /** Phase 1: soft-only curriculum AI hint (never blocks publish). */
    let curriculumReviewPublishWarning = null;

    if (willBePublished) {
      const { checkPublishGateForGenerated } = require("../middleware/requirePublishGateIfGenerated");
      const lessonObj = lesson.toObject ? lesson.toObject() : { ...lesson._doc, metadata: lesson.metadata };
      const gate = await checkPublishGateForGenerated(lessonObj, req.user);
      if (!gate.ok) {
        return res.status(400).json({ error: "Fix issues first", issues: gate.issues, blocks: gate.blocks });
      }

      const structureValidation = validateLessonStructureForPublish(lessonObj);
      publishValidationMode = structureValidation.mode;
      const structureIssues = mergeStructureValidationForScoring(structureValidation);
      const qualityResult = scoreLessonQuality(lessonObj, { structureIssues, source: "manual" });
      publishQualityScore = qualityResult.score;

      if (structureValidation.blocking.length > 0) {
        return res.status(400).json({
          error: "Lesson failed structure validation",
          msg: "Lesson failed structure validation",
          structureIssues: structureValidation.blocking,
          structureWarnings: structureValidation.warnings,
          publishValidationMode: structureValidation.mode,
        });
      }

      if (structureValidation.mode === "manual_teacher") {
        publishWarningSummary = buildPublishWarningSummary(structureValidation, qualityResult);
      } else       if (qualityResult.score < 70) {
        return res.status(400).json({
          error: "Lesson quality too low to publish",
          msg: "Lesson quality too low to publish",
          score: qualityResult.score,
          band: qualityResult.band,
          topIssues: (qualityResult.issues || []).slice(0, 10),
          topSuggestions: (qualityResult.suggestions || []).slice(0, 10),
          qualityResult,
          publishValidationMode: structureValidation.mode,
        });
      }

      curriculumReviewPublishWarning = getCurriculumReviewPublishWarning(lesson);
    }

    if (mode === "publish") {
      lesson.isPublished = true;
    } else {
      if (typeof req.body?.isPublished === "boolean") {
        lesson.isPublished = req.body.isPublished;
      } else {
        lesson.isPublished = !Boolean(lesson.isPublished);
      }
    }

    if (lesson.isPublished) {
      lesson.status = "published";
    } else {
      lesson.status = "draft";
    }

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save({ new: true, runValidators: true });

    // PR-015: Enqueue knowledge refresh when publishing (async, non-blocking)
    if (lesson.isPublished && lesson.topicKey) {
      const specKey = String(lesson.topicKey).split(":")[0];
      if (specKey) {
        const { enqueueKnowledgeRefresh } = require("../services/jobs/enqueueKnowledgeRefresh");
        enqueueKnowledgeRefresh({
          specKey,
          topicKey: lesson.topicKey,
          sourceTypes: ["lessonBlock"],
          userId: req.user?._id,
        }).catch((e) => console.error("[lessons] enqueueKnowledgeRefresh error:", e?.message));
      }
    }

    // Post-publish: AI checkpoint drafts (background job; CHECKPOINT_GEN_ON_PUBLISH=1)
    if (lesson.isPublished && Array.isArray(lesson.pages) && lesson.pages.length > 0) {
      const { enqueueCheckpointGenerationAfterPublish } = require("../services/jobs/enqueueCheckpointGeneration");
      let specKey = lesson.specKey ? String(lesson.specKey).trim() : "";
      if (!specKey && lesson.topicKey) {
        specKey = String(lesson.topicKey).split(":")[0] || "";
      }
      const topicKey = lesson.topicKey ? String(lesson.topicKey).trim() : null;
      if (specKey) {
        enqueueCheckpointGenerationAfterPublish({
          lessonId: lesson._id,
          specKey,
          topicKey,
          userId: req.user,
        }).catch((e) => console.error("[lessons] enqueueCheckpointGeneration error:", e?.message));
      }
    }

    const publishSuccessMsg =
      lesson.isPublished && publishWarningSummary
        ? publishWarningSummary.headline
        : lesson.isPublished
          ? "Lesson published successfully"
          : "Lesson unpublished successfully";

    return res.json({
      success: true,
      msg: publishSuccessMsg,
      ...(lesson.isPublished && publishWarningSummary
        ? {
            publishedWithWarnings: true,
            publishWarningSummary,
            publishValidationMode,
            qualityScore: publishQualityScore,
          }
        : lesson.isPublished && publishValidationMode
          ? { publishValidationMode, qualityScore: publishQualityScore }
          : {}),
      ...(lesson.isPublished && curriculumReviewPublishWarning
        ? { curriculumReviewPublishWarning, publishedWithCurriculumHint: true }
        : {}),
      lesson: updatedLesson,
    });
  } catch (err) {
    console.error("Publish toggle error:", err);
    return res.status(500).send("Server error");
  }
}

router.patch("/:id/publish", auth, async (req, res) =>
  publishToggleHandler(req, res, "toggle")
);

router.put("/:id/publish", auth, async (req, res) =>
  publishToggleHandler(req, res, "publish")
);

/* =========================================
   Phase 9D: Submit for review (owner only), DRAFT → in_review
   ========================================= */
router.post("/:id/submit-review", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner) {
      return res.status(403).json({ error: "Only the lesson owner can submit for review" });
    }

    const status = String(lesson.status || "draft").toLowerCase();
    if (status === "published") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATE",
        error: "Published lesson cannot be submitted for review",
      });
    }
    if (status !== "draft" && status !== "in_review") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATE",
        error: "Only draft lessons can be submitted for review",
      });
    }

    const updatedLesson = await Lesson.findOneAndUpdate(
      { _id: lessonId, status: "draft" },
      { $set: { status: "in_review", isPublished: false } },
      { new: true, runValidators: true }
    );
    if (!updatedLesson) {
      const current = await Lesson.findById(lessonId).select("status").lean();
      if (current && String(current.status).toLowerCase() === "in_review") {
        return res.json({
          success: true,
          alreadyInReview: true,
          msg: "Lesson submitted for review",
          lesson: { id: lessonId, status: "in_review" },
        });
      }
      return res.status(409).json({
        success: false,
        code: "INVALID_STATE",
        error: "Lesson is already in review or not in draft",
      });
    }

    await LessonReview.create({
      lessonId: updatedLesson._id,
      submittedBy: req.user._id,
      status: "PENDING",
    });

    return res.json({
      success: true,
      msg: "Lesson submitted for review",
      lesson: { id: updatedLesson._id, status: updatedLesson.status },
    });
  } catch (err) {
    console.error("Submit review error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================
   Phase 9D: Unpublish (owner/admin), PUBLISHED → draft
   ========================================= */
router.post("/:id/unpublish", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isAdminUser = isAdmin(req.user);
    if (!isOwner && !isAdminUser) {
      return res.status(403).json({ error: "Only owner or admin can unpublish" });
    }

    const status = String(lesson.status || "").toLowerCase();
    if (status !== "published") {
      return res.status(409).json({
        success: false,
        code: "INVALID_STATE",
        error: "Only published lessons can be unpublished",
      });
    }

    lesson.status = "draft";
    lesson.isPublished = false;
    await lesson.save({ runValidators: true });

    return res.json({
      success: true,
      msg: "Lesson unpublished",
      lesson: { id: lesson._id, status: lesson.status },
    });
  } catch (err) {
    console.error("Unpublish error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/* =========================================
   PR-PRACTICE-1: Deterministic seeded shuffle for practice randomisation
   ========================================= */
function deterministicShuffle(arr, seed) {
  if (!Array.isArray(arr) || arr.length <= 1) return [...(arr || [])];
  const copy = [...arr];
  let h = 0;
  const s = String(seed || "");
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
  for (let i = copy.length - 1; i > 0; i--) {
    h = ((h * 1103515245) + 12345) >>> 0;
    const j = h % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* =========================================
   PR3b/PR3b.1: GET /api/lessons/:id/practice — Student practice (entitled only).
   PR-PRACTICE-1: limit, seed, mode params; deterministic bank shuffle.
   Teacher/Admin owner can view practice on draft lessons; students require published + entitlement.
   No question content unless accessDecision.allowed === true.
   ========================================= */
function isOwnerOrAdminForPractice(user, lesson) {
  if (!user || !lesson) return false;
  if (isAdmin(user)) return true;
  const teacherId = lesson.teacherId?._id ?? lesson.teacherId;
  return teacherId != null && String(teacherId) === String(user._id ?? user.id);
}

router.get(
  "/:id/practice",
  auth,
  async (req, res, next) => {
    try {
      const lessonId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }
      const lesson = await Lesson.findById(lessonId).select("_id teacherId status isPublished").lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      if (isOwnerOrAdminForPractice(req.user, lesson)) {
        req.lesson = lesson;
        req.accessDecision = { allowed: true, reason: "OWNER" };
        return next();
      }
      return applyLessonAccess({ requirePublished: true })(req, res, next);
    } catch (err) {
      console.error("practice precheck error:", err);
      return res.status(500).json({ error: "Failed to check access" });
    }
  },
  async (req, res) => {
    try {
      const lessonId = req.params.id;
      if (!req.accessDecision || !req.accessDecision.allowed) {
        return res.status(200).json({
          ok: true,
          allowed: false,
          reason: req.accessDecision?.reason || "UNKNOWN",
          lessonId,
          questions: [],
          source: null,
          limit: 10,
          seedUsed: null,
        });
      }

      // PR-PRACTICE-1: limit (default 10, max 25), seed, mode
      let limit = parseInt(String(req.query.limit || "10"), 10);
      if (Number.isNaN(limit) || limit < 1) return res.status(400).json({ error: "Invalid limit (min 1)" });
      if (limit > 25) limit = 25;
      const seed = typeof req.query.seed === "string" ? req.query.seed : null;
      const mode = req.query.mode === "bank-only" ? "bank-only" : "attached-first";

      const lesson = await Lesson.findById(lessonId)
        .select("_id examQuestions teacherId topic topicKey subject level organisationId")
        .populate({
          path: "examQuestions.questionId",
          model: "ExamQuestion",
          select: "question type marks options correctAnswer correctIndex markScheme topicKey topic status",
        })
        .lean();
      if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

      // PR-CONTENT-TARGETING-1: prefer query topicKey (namespaced) when valid so practice is strictly scoped
      const queryTopicKey = typeof req.query.topicKey === "string" ? req.query.topicKey.trim() : null;
      let topicKey = lesson.topicKey || topicToKey(lesson.topic) || "";
      if (queryTopicKey && queryTopicKey.includes(":")) {
        try {
          const qParsed = parseTopicKey(queryTopicKey);
          const qSpec = qParsed.specKey || DEFAULT_SPEC_LEGACY;
          assertValidNamespacedTopicKey(qSpec, queryTopicKey.trim());
          topicKey = queryTopicKey;
        } catch (_) {
          /* keep lesson-derived topicKey */
        }
      }
      const { namespacedKey: validatedKey, examBankTopicFilter } = examBankTopicQueryFromLessonTopicKey(topicKey);

      const mapQuestion = (q) => {
        const options = Array.isArray(q.options) ? q.options : [];
        const correctAnswer =
          q.correctAnswer != null
            ? String(q.correctAnswer)
            : options[q.correctIndex] != null
              ? String(options[q.correctIndex])
              : "";
        const explanation =
          Array.isArray(q.markScheme) && q.markScheme.length > 0
            ? q.markScheme.join("\n")
            : "";
        return {
          id: String(q._id),
          question: q.question != null ? String(q.question) : "",
          type: q.type || "short",
          marks: typeof q.marks === "number" ? q.marks : 1,
          options: options.length > 0 ? options : undefined,
          correctAnswer: correctAnswer || undefined,
          explanation: explanation || undefined,
          markScheme: Array.isArray(q.markScheme) ? q.markScheme : undefined,
          topicKey: q.topicKey != null ? String(q.topicKey) : undefined,
          topic: q.topic != null ? String(q.topic) : undefined,
        };
      };

      const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
      let questions = [];
      let source = null;

      if (mode !== "bank-only" && refs.length > 0) {
        questions = refs
          .map((ref) => {
            const q = ref.questionId;
            if (!q || !q._id) return null;
            return mapQuestion(q);
          })
          .filter(Boolean);
        questions = questions.slice(0, limit);
        source = "attached";
      }

      if (questions.length === 0 && validatedKey && examBankTopicFilter) {
        const ownershipFilter = {
          $or: [
            { teacherId: lesson.teacherId },
            ...(lesson.organisationId ? [{ scope: "organisation", organisationId: lesson.organisationId }] : []),
            { scope: "platform" },
          ],
        };
        let bankRaw = await ExamQuestion.find({
          ...examBankTopicFilter,
          status: "published",
          ...ownershipFilter,
        })
          .select("_id question type marks options correctAnswer correctIndex markScheme topicKey topic")
          .sort({ _id: 1 })
          .limit(200)
          .lean();
        const effectiveSeed = seed || `${lessonId}:${req.user?._id ?? "anon"}:${new Date().toISOString().slice(0, 10)}`;
        bankRaw = deterministicShuffle(bankRaw, effectiveSeed);
        questions = bankRaw.slice(0, limit).map((q) => mapQuestion(q));
        source = "bank";
      }

      return res.status(200).json({
        ok: true,
        allowed: true,
        reason: req.accessDecision.reason,
        lessonId,
        topicKey: validatedKey || undefined,
        source: source || undefined,
        limit,
        seedUsed: source === "bank" ? (seed || `${lessonId}:date`) : undefined,
        questions,
      });
    } catch (err) {
      console.error("GET /api/lessons/:id/practice error:", err);
      return res.status(500).json({ error: "Failed to load practice questions" });
    }
  }
);

/* =========================================
   PR-LESSON-AUDIT-3: GET /api/lessons/:id/practice-questions — Same access as /practice.
   Returns published ExamQuestions from bank by topicKey (10–25). Used when attached list is empty.
   ========================================= */
router.get(
  "/:id/practice-questions",
  auth,
  async (req, res, next) => {
    try {
      const lessonId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }
      const lesson = await Lesson.findById(lessonId).select("_id teacherId status isPublished topic subject level organisationId").lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      if (isOwnerOrAdminForPractice(req.user, lesson)) {
        req.lesson = lesson;
        req.accessDecision = { allowed: true, reason: "OWNER" };
        return next();
      }
      return applyLessonAccess({ requirePublished: true })(req, res, next);
    } catch (err) {
      console.error("practice-questions precheck error:", err);
      return res.status(500).json({ error: "Failed to check access" });
    }
  },
  async (req, res) => {
    try {
      const lessonId = req.params.id;
      if (!req.accessDecision || !req.accessDecision.allowed) {
        return res.status(200).json({
          ok: true,
          allowed: false,
          reason: req.accessDecision?.reason || "UNKNOWN",
          lessonId,
          questions: [],
        });
      }
      const lesson = await Lesson.findById(lessonId)
        .select("_id topic topicKey subject level teacherId organisationId")
        .lean();
      if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
      const topicKey = lesson.topicKey || topicToKey(lesson.topic) || "";
      const { namespacedKey: validatedKey, examBankTopicFilter } = examBankTopicQueryFromLessonTopicKey(topicKey);
      if (!validatedKey || !examBankTopicFilter) {
        return res.status(200).json({
          ok: true,
          allowed: true,
          lessonId,
          questions: [],
        });
      }
      const ownershipFilter = {
        $or: [
          { teacherId: lesson.teacherId },
          ...(lesson.organisationId ? [{ scope: "organisation", organisationId: lesson.organisationId }] : []),
          { scope: "platform" },
        ],
      };
      const bankQuestions = await ExamQuestion.find({
        ...examBankTopicFilter,
        status: "published",
        ...ownershipFilter,
      })
        .select("_id question type marks options correctAnswer correctIndex markScheme topicKey topic")
        .sort({ marks: -1, createdAt: -1 })
        .limit(25)
        .lean();
      const questions = bankQuestions.map((q) => {
        const options = Array.isArray(q.options) ? q.options : [];
        const correctAnswer =
          q.correctAnswer != null
            ? String(q.correctAnswer)
            : options[q.correctIndex] != null
              ? String(options[q.correctIndex])
              : "";
        const explanation =
          Array.isArray(q.markScheme) && q.markScheme.length > 0
            ? q.markScheme.join("\n")
            : "";
        return {
          id: String(q._id),
          question: q.question != null ? String(q.question) : "",
          type: q.type || "short",
          marks: typeof q.marks === "number" ? q.marks : 1,
          options: options.length > 0 ? options : undefined,
          correctAnswer: correctAnswer || undefined,
          explanation: explanation || undefined,
          markScheme: Array.isArray(q.markScheme) ? q.markScheme : undefined,
          topicKey: q.topicKey != null ? String(q.topicKey) : undefined,
          topic: q.topic != null ? String(q.topic) : undefined,
        };
      });
      return res.status(200).json({
        ok: true,
        allowed: true,
        lessonId,
        questions,
      });
    } catch (err) {
      console.error("GET /api/lessons/:id/practice-questions error:", err);
      return res.status(500).json({ error: "Failed to load practice questions" });
    }
  }
);

/* =========================================
   PR13.2: GET /api/lessons/:id/targeted-practice — Student targeted set (misconception-driven).
   Same access as /practice: auth + requirePublished; owner/admin bypass. Returns 200 allowed:false when not allowed.
   ========================================= */
router.get(
  "/:id/targeted-practice",
  auth,
  async (req, res, next) => {
    try {
      const lessonId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }
      const lesson = await Lesson.findById(lessonId).select("_id teacherId status isPublished").lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      if (isOwnerOrAdminForPractice(req.user, lesson)) {
        req.lesson = lesson;
        req.accessDecision = { allowed: true, reason: "OWNER" };
        return next();
      }
      return applyLessonAccess({ requirePublished: true })(req, res, next);
    } catch (err) {
      console.error("targeted-practice precheck error:", err);
      return res.status(500).json({ error: "Failed to check access" });
    }
  },
  async (req, res) => {
    try {
      const lessonId = req.params.id;
      const days = Math.min(30, Math.max(1, parseInt(String(req.query.days || "14"), 10) || 14));
      let limit = parseInt(String(req.query.limit || "10"), 10);
      if (Number.isNaN(limit) || limit < 1) limit = 10;
      if (limit > 20) limit = 20;

      if (!req.accessDecision || !req.accessDecision.allowed) {
        return res.status(200).json({
          ok: true,
          allowed: false,
          reason: req.accessDecision?.reason || "UNKNOWN",
          lessonId,
          days,
          questions: [],
        });
      }

      const lesson = await Lesson.findById(lessonId)
        .select("_id examQuestions teacherId")
        .populate({
          path: "examQuestions.questionId",
          model: "ExamQuestion",
          select: "question type marks options correctAnswer correctIndex markScheme topicKey topic",
        })
        .lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
      const questionIds = refs
        .map((r) => r.questionId)
        .filter((q) => q && q._id)
        .map((q) => q._id);
      if (questionIds.length === 0) {
        return res.status(200).json({
          ok: true,
          allowed: true,
          lessonId,
          days,
          questions: [],
        });
      }

      const since = new Date();
      since.setDate(since.getDate() - days);
      const userId = req.user._id;
      const lessonOid = new mongoose.Types.ObjectId(lessonId);

      const attempts = await PracticeAttempt.find({
        userId,
        lessonId: lessonOid,
        source: "practice",
        questionId: { $in: questionIds },
        createdAt: { $gte: since },
      }).lean();

      const byQuestion = new Map();
      for (const a of attempts) {
        const qid = a.questionId ? String(a.questionId) : null;
        if (!qid) continue;
        if (!byQuestion.has(qid)) {
          byQuestion.set(qid, { attempts: 0, wrong: 0, correct: 0, highConfidenceWrong: 0 });
        }
        const rec = byQuestion.get(qid);
        rec.attempts += 1;
        if (a.isCorrect) rec.correct += 1;
        else rec.wrong += 1;
        if (a.isCorrect === false && a.confidence === 3) rec.highConfidenceWrong += 1;
      }

      const scored = questionIds.map((qid) => {
        const oid = qid._id || qid;
        const idStr = String(oid);
        const rec = byQuestion.get(idStr) || { attempts: 0, wrong: 0, correct: 0, highConfidenceWrong: 0 };
        const score = rec.highConfidenceWrong * 3 + rec.wrong * 1 - rec.correct * 0.5;
        const ref = refs.find((r) => r.questionId && String(r.questionId._id) === idStr);
        const q = ref?.questionId;
        const marks = typeof q?.marks === "number" ? q.marks : 1;
        return { idStr, score, attempts: rec.attempts, marks, ref, q };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.attempts !== a.attempts) return b.attempts - a.attempts;
        return (b.marks || 0) - (a.marks || 0);
      });

      const top = scored.slice(0, limit);
      const questions = top
        .filter((s) => s.q)
        .map((s) => {
          const q = s.q;
          const options = Array.isArray(q.options) ? q.options : [];
          const correctAnswer =
            q.correctAnswer != null
              ? String(q.correctAnswer)
              : options[q.correctIndex] != null
                ? String(options[q.correctIndex])
                : "";
          const explanation =
            Array.isArray(q.markScheme) && q.markScheme.length > 0
              ? q.markScheme.join("\n")
              : "";
          return {
            id: s.idStr,
            question: q.question != null ? String(q.question) : "",
            type: q.type || "short",
            marks: typeof q.marks === "number" ? q.marks : 1,
            options: options.length > 0 ? options : undefined,
            correctAnswer: correctAnswer || undefined,
            explanation: explanation || undefined,
            markScheme: Array.isArray(q.markScheme) ? q.markScheme : undefined,
            topicKey: q.topicKey != null ? String(q.topicKey) : undefined,
            topic: q.topic != null ? String(q.topic) : undefined,
          };
        });

      return res.status(200).json({
        ok: true,
        allowed: true,
        lessonId,
        days,
        questions,
      });
    } catch (err) {
      console.error("GET /api/lessons/:id/targeted-practice error:", err);
      return res.status(500).json({ error: "Failed to load targeted practice" });
    }
  }
);

/* =========================================
   PR15: GET /api/lessons/:id/next-steps — Student-safe next steps from pinned/latest reteach plan.
   Same access as /practice. Returns only studentSummary (no full plan content).
   ========================================= */
router.get(
  "/:id/next-steps",
  auth,
  async (req, res, next) => {
    try {
      const lessonId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(lessonId)) {
        return res.status(400).json({ error: "Invalid lessonId" });
      }
      const lesson = await Lesson.findById(lessonId).select("_id teacherId status isPublished").lean();
      if (!lesson) return res.status(404).json({ error: "Lesson not found" });
      if (isOwnerOrAdminForPractice(req.user, lesson)) {
        req.lesson = lesson;
        req.accessDecision = { allowed: true, reason: "OWNER" };
        return next();
      }
      return applyLessonAccess({ requirePublished: true })(req, res, next);
    } catch (err) {
      console.error("next-steps precheck error:", err);
      return res.status(500).json({ error: "Failed to check access" });
    }
  },
  async (req, res) => {
    try {
      const lessonId = req.params.id;
      if (!req.accessDecision || !req.accessDecision.allowed) {
        return res.status(200).json({
          ok: true,
          allowed: false,
          reason: req.accessDecision?.reason || "UNKNOWN",
          lessonId,
          nextSteps: null,
        });
      }
      const lessonOid = new mongoose.Types.ObjectId(lessonId);
      const pinned = await ReteachPlan.findOne({ lessonId: lessonOid, pinned: true })
        .sort({ generatedAt: -1 })
        .select("studentSummary updatedAt editedAt generatedAt")
        .lean();
      const plan = pinned || (await ReteachPlan.findOne({ lessonId: lessonOid }).sort({ generatedAt: -1 }).select("studentSummary updatedAt editedAt generatedAt").lean());
      if (!plan || !(String(plan.studentSummary || "").trim())) {
        return res.status(200).json({
          ok: true,
          allowed: true,
          lessonId,
          nextSteps: null,
        });
      }
      const updatedAt = plan.editedAt || plan.updatedAt || plan.generatedAt;
      return res.status(200).json({
        ok: true,
        allowed: true,
        lessonId,
        nextSteps: {
          studentSummary: String(plan.studentSummary || "").trim(),
          updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
        },
      });
    } catch (err) {
      console.error("GET /api/lessons/:id/next-steps error:", err);
      return res.status(500).json({ error: "Server error" });
    }
  }
);

/* =========================================
   Curriculum AI review (draft lessons only; opt-in via CURRICULUM_AI_REVIEW_ENABLED)
   GET/POST /api/lessons/:id/curriculum-ai-review
   ========================================= */

router.get("/:id/curriculum-ai-review", auth, async (req, res) => {
  try {
    if (!isCurriculumAiReviewEnabled()) {
      return res.status(404).json({ msg: "Curriculum AI review is not enabled" });
    }
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId).select("teacherId curriculumAiReview status isPublished").lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const isOwner = String(lesson.teacherId) === String(req.user._id);
    if (!isOwner && !isAdmin(req.user)) return res.status(401).json({ msg: "Not authorized" });
    return res.json({ curriculumAiReview: lesson.curriculumAiReview || null });
  } catch (err) {
    return sendInternalError("lessons/curriculum-ai-review GET", err, res);
  }
});

router.post("/:id/curriculum-ai-review", auth, async (req, res) => {
  try {
    if (!isCurriculumAiReviewEnabled()) {
      return res.status(403).json({
        msg: "Curriculum AI review is disabled. Set CURRICULUM_AI_REVIEW_ENABLED=true on the server.",
      });
    }
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId).select("teacherId status isPublished").lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const allow = isOwner || isAdmin(req.user);
    if (!allow) return res.status(401).json({ msg: "Not authorized" });

    const st = String(lesson.status || "draft").toLowerCase();
    if (lesson.isPublished || st === "published") {
      return res.status(403).json({ msg: "Curriculum review is only available for unpublished draft lessons" });
    }
    if (st !== "draft" && st !== "in_review") {
      return res.status(403).json({ msg: "Curriculum review is only for draft or in_review lessons" });
    }

    const updated = await runCurriculumAiReviewForLesson({
      lessonId,
      userId: req.user._id,
      isAdmin: isAdmin(req.user),
      trigger: "manual",
    });
    return res.json({
      ok: true,
      curriculumAiReview: updated.curriculumAiReview,
      lesson: updated,
    });
  } catch (err) {
    const msg = err?.message || "Curriculum review failed";
    if (String(msg).includes("already running")) {
      return res.status(409).json({ msg, code: "REVIEW_IN_PROGRESS" });
    }
    console.error("[curriculum-ai-review] POST", err);
    return res.status(500).json({ msg });
  }
});

/* =========================================
   Get lesson by ID (private)
   GET /api/lessons/:id — Gate: applyLessonAccess (deny-by-default; 402 NOT_ENTITLED, 403 other)
   ✅ FREE_PREVIEW → partial response; SUB_ACTIVE/PURCHASED/ADMIN/OWNER → full
   ========================================= */

router.get("/:id", auth, applyLessonAccess({ requirePublished: true }), async (req, res) => {
  try {
    let lesson = req.lesson;
    const lessonId = req.params.id;
    const decision = req.accessDecision;

    Lesson.updateOne({ _id: lessonId }, { $inc: { views: 1 } }).catch(() => {});

    lesson = await attachVisualsToPagesIfPossible(lesson);
    lesson = promoteHeroOnLesson(lesson);

    // Enrich Microscopy lessons with magnification video (for existing lessons that have old hero or none)
    const topicNorm = String(lesson.topic || "").trim().toLowerCase();
    if (topicNorm === "microscopy" && Array.isArray(lesson.pages) && lesson.pages[0]) {
      const hero = lesson.pages[0].hero;
      const hasOldOrNoHero = !hero || !hero.src || String(hero.src).includes("microscopy.svg");
      if (hasOldOrNoHero) {
        const { hero: curatedHero } = findCuratedVisual({
          subject: lesson.subject || "Biology",
          examBoard: lesson.board || "AQA",
          level: lesson.level || "GCSE",
          topic: lesson.topic,
        });
        if (curatedHero && curatedHero.type === "video") {
          lesson.pages[0] = { ...lesson.pages[0], hero: curatedHero };
        }
      }
    }

    // Always send a predictable accessDecision shape so frontend can rely on it
    const accessDecision = req.accessDecision && typeof req.accessDecision.reason === "string"
      ? { allowed: !!req.accessDecision.allowed, reason: req.accessDecision.reason }
      : { allowed: true, reason: "UNKNOWN" };

    if (decision?.reason === "FREE_PREVIEW") {
      const payload = toLessonPreviewPayload(lesson);
      return res.json({ ...payload, accessDecision });
    }
    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isPrivilegedViewer = isAdmin(req.user) || isOwner;
    const lessonForResponse =
      !isPrivilegedViewer && req.user?.userType === "student"
        ? stripCheckpointAutoMarkFromLesson(lesson)
        : lesson;
    const payload = toLessonFullPayload(lessonForResponse);
    payload.readiness = computeLessonReadiness(lesson);
    return res.json({ ...payload, accessDecision });
  } catch (err) {
    console.error("Get lesson error:", err);
    return res.status(500).send("Server error");
  }
});

// Update lesson (teacher only)
router.put("/:id", auth, async (req, res) => {
  try {
    const lessonId = req.params.id;
    
    // ✅ UPDATED: Use findByIdAndUpdate with runValidators and return updated doc
    const lesson = await Lesson.findById(lessonId);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is moderated and cannot be edited" });
    }

    // Phase 9D: owner may only edit draft or in_review; admin may edit any
    const status = String(lesson.status || "draft").toLowerCase();
    if (!isAdminUser && status !== "draft" && status !== "in_review") {
      return res.status(403).json({
        error: "Lesson is published; unpublish to edit",
        code: "EDIT_PUBLISHED",
      });
    }

    const updates = req.body || {};
    delete updates.curriculumAiReview;

    if (Object.prototype.hasOwnProperty.call(updates, "description")) {
      updates.description = normalizeLessonDescription(updates.description);
    }

    // ✅ FIXED: Handle pages update with hero preservation
    if (updates.pages && Array.isArray(updates.pages)) {
      // Use the new mergePagesOnUpdate function
      const merged = mergePagesOnUpdate(lessonId, lesson.pages || [], updates.pages);
      lesson.pages = promoteHeroOnLesson({ pages: merged }).pages;
      lesson.markModified("pages");
      delete updates.pages; // Remove from general updates to avoid overwriting
    }

    // ✅ ADDED: Normalize quiz.questions to array server-side
    if (updates.quiz && typeof updates.quiz === "object") {
      const quizData = { ...updates.quiz };
      if (!Array.isArray(quizData.questions)) {
        console.warn(`⚠️ [Lesson ${lessonId}] quiz.questions is not an array, defaulting to empty`);
        quizData.questions = [];
      }
      lesson.quiz = quizData;
      delete updates.quiz;
    }

    // ✅ ADDED: Normalize flashcards to array server-side
    if (updates.flashcards !== undefined) {
      if (!Array.isArray(updates.flashcards)) {
        console.warn(`⚠️ [Lesson ${lessonId}] flashcards is not an array, defaulting to empty`);
        lesson.flashcards = [];
      } else {
        lesson.flashcards = updates.flashcards;
      }
      delete updates.flashcards;
    }

    // PR0: accept examBoard or board on update, store as board
    if (updates.examBoard !== undefined || updates.board !== undefined) {
      lesson.board = (updates.examBoard ?? updates.board ?? "").toString().trim();
      delete updates.examBoard;
      delete updates.board;
    }

    // PR-TAXONOMY: When topicKey is set, derive specKey from it if not provided
    const topicKeyVal = updates.topicKey ?? lesson.topicKey;
    if (typeof topicKeyVal === "string" && topicKeyVal.trim() && topicKeyVal.includes(":")) {
      const derivedSpecKey = topicKeyVal.trim().slice(0, topicKeyVal.indexOf(":"));
      if (derivedSpecKey && !updates.specKey) {
        lesson.specKey = lesson.specKey || derivedSpecKey;
      }
    }
    if (typeof updates.specKey === "string" && updates.specKey.trim()) lesson.specKey = updates.specKey.trim();
    if (typeof updates.mainTopic === "string" && updates.mainTopic.trim()) lesson.mainTopic = updates.mainTopic.trim();
    if (typeof updates.subTopic === "string" && updates.subTopic.trim()) lesson.subTopic = updates.subTopic.trim();
    if (typeof updates.topicKey === "string" && updates.topicKey.trim()) {
      try {
        const spec =
          (typeof updates.specKey === "string" && updates.specKey.trim()) ||
          lesson.specKey ||
          parseTopicKey(updates.topicKey).specKey ||
          DEFAULT_SPEC_LEGACY;
        const namespaced =
          normalizeNamespacedLessonTopicKey(spec, {
            topicKey: updates.topicKey,
            canonicalTopicKey: updates.canonicalTopicKey,
            title: updates.title ?? lesson.title,
            topic: updates.topic ?? lesson.topic,
            subTopic: updates.subTopic ?? lesson.subTopic,
          }) ||
          (updates.topicKey.trim().includes(":") ? updates.topicKey.trim() : buildTopicKey(spec, updates.topicKey.trim()));
        assertValidNamespacedTopicKey(spec, namespaced);
        lesson.topicKey = namespaced;
        if (!lesson.specKey) lesson.specKey = spec;
      } catch (e) {
        if (e.code === "INVALID_SPEC_KEY" || e.code === "INVALID_TOPIC_KEY") {
          return res.status(400).json({ msg: e.message || "Invalid topicKey for this specification." });
        }
        throw e;
      }
    }
    delete updates.specKey;
    delete updates.mainTopic;
    delete updates.subTopic;
    delete updates.topicKey;

    // Authorable free preview (whitelisted + coerced)
    const flags = pickLessonFlags(req.body);
    if (typeof flags.isFreePreview === "boolean") lesson.isFreePreview = flags.isFreePreview;

    // Apply other updates
    Object.keys(updates).forEach((key) => {
      if (key === "isPublished") return;
      if (key === "status") return;
      if (key === "isFreePreview") return;
      lesson[key] = updates[key];
    });

    const newLevel = typeof updates.level === "string" ? updates.level : lesson.level;
    const requestedTier = Object.prototype.hasOwnProperty.call(updates, "tier")
      ? updates.tier
      : lesson.tier;

    lesson.tier = sanitizeTierByLevel(newLevel, requestedTier);

    // ✅ Step 16: Populate quality metadata on save (admin QA, filtering, tracking)
    const lessonObj = lesson.toObject ? lesson.toObject() : { ...lesson._doc };
    const structureValidation = validateLessonStructure(lessonObj, { isManual: true });
    const structureIssues = mergeStructureValidationForScoring(structureValidation);
    const qualityResult = scoreLessonQuality(lessonObj, { structureIssues, source: "manual" });
    lesson.qualityScore = qualityResult.score;
    lesson.qualityBand = qualityResult.band;
    lesson.qualityCategories = qualityResult.categories;
    lesson.qualityIssues = qualityResult.issues?.length ? qualityResult.issues : undefined;

    // ✅ ADDED: runValidators and return updated document
    const updatedLesson = await lesson.save({ new: true, runValidators: true });

    if (isCurriculumAiReviewEnabled() && !updatedLesson.isPublished) {
      const st = String(updatedLesson.status || "draft").toLowerCase();
      const draftLike = st === "draft" || st === "in_review";
      if (draftLike) {
        const phase1On = isPhase1AutoOnceEnabled();
        const draftSaveOn = isAutoRunOnDraftSaveEnabled();

        let ranPhase1ThisRequest = false;
        if (phase1On && st === "draft") {
          try {
            const resPhase = await Lesson.updateOne(
              { _id: updatedLesson._id, "curriculumAiReview.phase1AutoOnceRun": { $ne: true } },
              { $set: { "curriculumAiReview.phase1AutoOnceRun": true } }
            );
            if (resPhase.modifiedCount > 0) {
              ranPhase1ThisRequest = true;
              setImmediate(() => {
                runCurriculumAiReviewForLesson({
                  lessonId: updatedLesson._id,
                  trigger: "phase1_first_save",
                  internal: true,
                }).catch((e) => console.error("[curriculumAiReview] phase1_first_save:", e?.message || e));
              });
            }
          } catch (e) {
            console.error("[curriculumAiReview] phase1 flag:", e?.message || e);
          }
        }

        if (draftSaveOn && st === "draft" && !(phase1On && ranPhase1ThisRequest)) {
          scheduleDraftSaveCurriculumReviewIfEligible(updatedLesson._id).catch((e) =>
            console.error("[curriculumAiReview] draft_save_schedule:", e?.message || e)
          );
        }
      }
    }

    return res.json({
      msg: "Lesson updated successfully",
      lesson: updatedLesson,
      structureWarnings:
        structureValidation.warnings.length > 0 ? structureValidation.warnings : undefined,
      qualityResult: {
        score: qualityResult.score,
        band: qualityResult.band,
        topIssues: (qualityResult.issues || []).slice(0, 10),
        topSuggestions: (qualityResult.suggestions || []).slice(0, 10),
      },
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

/* =========================================
   USP 3a: Past paper questions attached to lesson
   GET /:id/exam-questions — list attached (populated)
   POST /:id/exam-questions — add questionIds (max 20, dedupe)
   DELETE /:id/exam-questions/:questionId — remove one
   ========================================= */

async function requireLessonOwnerOrAdmin(req, res, next) {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId).select("teacherId").lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isAdminUser = isAdmin(req.user);
    if (!isOwner && !isAdminUser) return res.status(404).json({ msg: "Lesson not found" });
    req._lesson = lesson;
    next();
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
}

router.get("/:id/exam-questions", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
    if (refs.length === 0) {
      return res.json({ questions: [] });
    }
    const ids = refs.map((r) => r.questionId).filter(Boolean);
    const questions = await ExamQuestion.find({ _id: { $in: ids } })
      .select("_id question type marks topicKey topic")
      .lean();
    const byId = new Map(questions.map((q) => [String(q._id), q]));
    const ordered = ids.map((id) => byId.get(String(id))).filter(Boolean);
    return res.json({ questions: ordered });
  } catch (err) {
    console.error("GET exam-questions error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.post("/:id/exam-questions", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const questionIds = Array.isArray(req.body.questionIds) ? req.body.questionIds : [];
    const max = 20;
    const raw = questionIds.slice(0, max).map((id) => String(id).trim()).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const unique = [...new Set(raw)];
    if (unique.length === 0) {
      return res.json({ ok: true, added: 0 });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const existing = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
    const existingIds = new Set(existing.map((r) => String(r.questionId)));
    let added = 0;
    for (const qid of unique) {
      if (!existingIds.has(qid)) {
        lesson.examQuestions.push({ questionId: new mongoose.Types.ObjectId(qid), addedAt: new Date() });
        existingIds.add(qid);
        added++;
      }
    }
    await lesson.save();
    return res.json({ ok: true, added });
  } catch (err) {
    console.error("POST exam-questions error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.delete("/:id/exam-questions/:questionId", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const questionId = req.params.questionId;
    if (!mongoose.Types.ObjectId.isValid(questionId)) {
      return res.status(400).json({ msg: "Invalid question id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const refs = Array.isArray(lesson.examQuestions) ? lesson.examQuestions : [];
    const before = refs.length;
    lesson.examQuestions = refs.filter((r) => String(r.questionId) !== String(questionId));
    const removed = before !== lesson.examQuestions.length;
    await lesson.save();
    return res.json({ ok: true, removed });
  } catch (err) {
    console.error("DELETE exam-questions error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   Lesson↔AssessmentPaper linking
   POST /:id/assessment-papers — attach paper (body: { paperId })
   DELETE /:id/assessment-papers/:paperId — detach paper
   ========================================= */

router.post("/:id/assessment-papers", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const paperId = req.body?.paperId;
    if (!paperId || !mongoose.Types.ObjectId.isValid(String(paperId))) {
      return res.status(400).json({ msg: "paperId is required and must be a valid ObjectId" });
    }
    const paper = await AssessmentPaper.findById(paperId).select("_id").lean();
    if (!paper) return res.status(404).json({ msg: "Assessment paper not found" });
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const ids = Array.isArray(lesson.assessmentPaperIds) ? lesson.assessmentPaperIds : [];
    const idStr = String(paperId);
    if (ids.some((id) => String(id) === idStr)) {
      return res.json({ ok: true, attached: false, msg: "Already attached" });
    }
    lesson.assessmentPaperIds = [...ids, new mongoose.Types.ObjectId(paperId)];
    await lesson.save();
    return res.json({ ok: true, attached: true });
  } catch (err) {
    console.error("POST lesson assessment-papers error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.delete("/:id/assessment-papers/:paperId", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const paperId = req.params.paperId;
    if (!mongoose.Types.ObjectId.isValid(paperId)) {
      return res.status(400).json({ msg: "Invalid paper id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const ids = Array.isArray(lesson.assessmentPaperIds) ? lesson.assessmentPaperIds : [];
    const before = ids.length;
    lesson.assessmentPaperIds = ids.filter((id) => String(id) !== String(paperId));
    const removed = before !== lesson.assessmentPaperIds.length;
    await lesson.save();
    return res.json({ ok: true, removed });
  } catch (err) {
    console.error("DELETE lesson assessment-papers error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PR-EDGE-1: Generate all from topic banks (flashcards + quiz + assessment + past papers)
router.post("/:id/auto-generate", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const result = await autoGenerateLessonFromBanks({
      lessonId,
      userId: req.user._id || req.user.userId,
    });
    return res.json({
      ok: true,
      lessonId: result.lessonId,
      topicKey: result.topicKey,
      results: result.results,
      lesson: result.lesson,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ msg: err.message || "Lesson not found" });
    }
    console.error("auto-generate error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * POST /api/lessons/:id/generate-assets — AI draft flashcards + quiz MCQs (+ optional exam) into topic banks.
 * Manual trigger only; all items saved as draft. Requires OPENAI_API_KEY / LLM_API_KEY.
 * Body: { generateFlashcards?: true, generateQuizQuestions?: true, generateExamQuestions?: false }
 */
router.post("/:id/generate-assets", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }
    const b = req.body || {};
    const result = await generateLessonAssets({
      lessonId,
      ownerId: req.user._id || req.user.userId || req.user.id,
      generateFlashcards: b.generateFlashcards !== false,
      generateQuizQuestions: b.generateQuizQuestions !== false,
      generateExamQuestions: b.generateExamQuestions === true,
    });
    return res.status(200).json({
      lessonId: result.lessonId,
      lessonUpdatedAtSnapshot: result.lessonUpdatedAtSnapshot,
      generated: result.generated,
      examQuestionStats: result.examQuestionStats,
      skipped: result.skipped,
      errors: result.errors,
      status: result.status,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message || "Lesson not found" });
    }
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    if (err.code === "LLM_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message, code: err.code });
    }
    console.error("generate-assets error:", err);
    return sendInternalError("lessons/generate-assets", err, res, { extra: { error: err.message || "Generation failed" } });
  }
});

// Auto-attach content (fill-only when empty): flashcards + quiz (+ optional assessments) from topic banks
router.post("/:id/auto-attach-content", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const includeAssessments = req.body && req.body.includeAssessments === true;
    const result = await autoAttachLessonContent({
      lessonId,
      actorUserId: req.user._id || req.user.userId,
      includeAssessments,
    });
    if (result.ok === false && result.reason === "NO_TOPIC_KEY") {
      return res.status(400).json({ ok: false, reason: "NO_TOPIC_KEY", msg: "Lesson has no topicKey set." });
    }
    return res.json({
      ok: true,
      lessonId: result.lessonId,
      topicKey: result.topicKey,
      attached: result.attached,
      lesson: result.lesson,
      ...(result.thinCoverage && { thinCoverage: true, warning: result.warning }),
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ msg: err.message || "Lesson not found" });
    }
    console.error("auto-attach-content error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Detach auto-attached content only (items with tag "auto-attached"); manual content untouched
router.post("/:id/detach-auto-attached-content", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    let detachedFlashcards = 0;
    let detachedQuiz = 0;

    // Flashcards: remove only object items with tags including "auto-attached"; keep strings/untagged
    if (Array.isArray(lesson.flashcards)) {
      const before = lesson.flashcards.length;
      lesson.flashcards = lesson.flashcards.filter((fc) => {
        if (!fc || typeof fc !== "object") return true;
        const tags = Array.isArray(fc.tags) ? fc.tags : [];
        return !tags.includes("auto-attached");
      });
      detachedFlashcards = before - lesson.flashcards.length;
      if (detachedFlashcards > 0) lesson.markModified("flashcards");
    }

    // Quiz: remove only questions tagged "auto-attached"
    if (lesson.quiz && Array.isArray(lesson.quiz.questions)) {
      const before = lesson.quiz.questions.length;
      lesson.quiz.questions = lesson.quiz.questions.filter((q) => {
        const tags = Array.isArray(q.tags) ? q.tags : [];
        return !tags.includes("auto-attached");
      });
      detachedQuiz = before - lesson.quiz.questions.length;
      if (detachedQuiz > 0) lesson.markModified("quiz");
    }

    await lesson.save();
    const updated = await Lesson.findById(lessonId).lean();

    return res.json({
      ok: true,
      detached: { flashcards: detachedFlashcards, quiz: detachedQuiz },
      lesson: updated,
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ msg: err.message || "Lesson not found" });
    }
    console.error("detach-auto-attached-content error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PR-CONTENT-TARGETING-1: Resolve and validate namespaced topicKey from lesson; throw if invalid.
function getValidNamespacedTopicKeyFromLesson(lesson) {
  const raw =
    (lesson.topicKey && String(lesson.topicKey).trim()) ||
    (lesson.topic && topicToKey(lesson.topic)) ||
    "";
  if (!raw) {
    const err = new Error("Lesson must be mapped to a valid syllabus topicKey (specKey:topicSlug) to generate practice.");
    err.code = "INVALID_TOPIC_KEY";
    throw err;
  }
  const specKey =
    (lesson.specKey && String(lesson.specKey).trim()) ||
    parseTopicKey(raw).specKey ||
    DEFAULT_SPEC_LEGACY;
  const topicOnly = parseTopicKey(raw).topicKey || raw.trim();
  const namespacedTopicKey = raw.includes(":") ? raw.trim() : buildTopicKey(specKey, topicOnly);
  assertValidSpecKey(specKey);
  assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
  return { specKey, namespacedTopicKey };
}

// PR-FLOW-2: Generate lesson flashcards from topic bank (published only, replace semantics)
async function handleGenerateFlashcardsFromTopic(req, res) {
  try {
    const lessonId = req.params.id;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    let specKey, namespacedTopicKey;
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      specKey = resolved.specKey;
      namespacedTopicKey = (req.body && req.body.topicKey) ? String(req.body.topicKey).trim() : resolved.namespacedTopicKey;
      if (req.body && req.body.topicKey) assertValidNamespacedTopicKey(specKey, namespacedTopicKey);
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({
          msg: err.message || "Lesson must be mapped to a valid syllabus topicKey (specKey:topicSlug) to generate practice.",
        });
      }
      throw err;
    }
    const bankTopicKey = resolveQuestionBankNamespacedTopicKey(specKey, namespacedTopicKey);
    const ownerId = lesson.teacherId || lesson.createdBy;
    if (!ownerId) return res.status(400).json({ msg: "Lesson has no owner" });
    let bankCards = await fetchTopicFlashcardsForSeed(ownerId, bankTopicKey, 20, { publishedOnly: true });
    if (bankCards.length === 0) {
      bankCards = await fetchTopicFlashcardsForTopicOnly(bankTopicKey, 20, {
        publishedOnly: true,
        specKey,
      });
    }
    lesson.flashcards = bankCards;
    await lesson.save();
    const addedCount = bankCards.length;
    return res.json({
      ok: true,
      addedCount,
      added: addedCount,
      flashcardsCount: lesson.flashcards.length,
      lesson: lesson.toObject ? lesson.toObject() : lesson,
    });
  } catch (err) {
    console.error("generate-flashcards-from-topic error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
}

// PR-FLOW-2: New production endpoint (preferred)
router.post("/:id/generate/flashcards-from-topic", auth, requireLessonOwnerOrAdmin, handleGenerateFlashcardsFromTopic);

// PR-F1: Alias (calls same handler)
router.post("/:id/seed-flashcards-from-topic", auth, requireLessonOwnerOrAdmin, handleGenerateFlashcardsFromTopic);

// Sync from topic bank: refresh existing topic-bank cards (overwrite from bank) + add missing. Teacher-authored cards untouched.
async function handleSyncTopicBankFlashcards(req, res) {
  try {
    const lessonId = req.params.id || req.params.lessonId;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    let namespacedTopicKey;
    let bankTopicKey;
    let bankSpecKey;
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      bankSpecKey = resolved.specKey;
      namespacedTopicKey = (req.body && req.body.topicKey) ? String(req.body.topicKey).trim() : resolved.namespacedTopicKey;
      if (req.body && req.body.topicKey) assertValidNamespacedTopicKey(resolved.specKey, namespacedTopicKey);
      bankTopicKey = resolveQuestionBankNamespacedTopicKey(resolved.specKey, namespacedTopicKey);
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({
          msg: err.message || "Lesson must be mapped to a valid syllabus topicKey to sync flashcards.",
        });
      }
      throw err;
    }
    const ownerId = lesson.teacherId || lesson.createdBy;
    if (!ownerId) return res.status(400).json({ msg: "Lesson has no owner" });

    let bankCards = await fetchTopicFlashcardsForSeed(ownerId, bankTopicKey, 50, { publishedOnly: true });
    const usedFallback = bankCards.length === 0;
    if (bankCards.length === 0) {
      bankCards = await fetchTopicFlashcardsForTopicOnly(bankTopicKey, 50, {
        publishedOnly: true,
        specKey: bankSpecKey,
      });
    }

    if (process.env.NODE_ENV !== "production") {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      console.log("[sync-topic-bank] lessonId:", lessonId, "namespacedTopicKey:", namespacedTopicKey, "bankTopicKey:", bankTopicKey, "specKey:", resolved.specKey, "req.body.topicKey:", req.body?.topicKey, "ownerId:", ownerId, "usedFallback:", usedFallback, "bankCards.length:", bankCards.length);
      if (bankCards.length > 0) {
        console.log("[sync-topic-bank] first 3 bank cards:", bankCards.slice(0, 3).map((tc) => ({ id: tc.id, topicBankId: tc.topicBankId })));
      }
    }

    lesson.flashcards = Array.isArray(lesson.flashcards) ? lesson.flashcards : [];

    // Canonical id for matching: same shape on bank and lesson so updates reliably run
    const toBankId = (tc) => String(tc.topicBankId || tc._id || tc.id || "");
    const toLessonId = (c) => String(c.topicBankId || c._id || c.id || "");

    const bankById = new Map();
    for (const tc of bankCards) {
      const bankId = toBankId(tc);
      bankById.set(bankId, tc);
    }

    // Pass A: Update lesson cards whose canonical id matches a bank card (even if they lack topicBankId/source)
    let updated = 0;
    const matchedSamples = [];
    lesson.flashcards = lesson.flashcards.map((c) => {
      const candidateId = toLessonId(c);
      const tc = candidateId ? bankById.get(candidateId) : null;
      if (!tc) return c;

      const prev = c.toObject ? c.toObject() : { ...c };
      const bankId = toBankId(tc);
      const wasUnlinked = !prev.topicBankId && prev.source !== "topic-bank";
      const next = {
        ...prev,
        id: prev.id || bankId,
        front: tc.front || "",
        back: tc.back || "",
        difficulty: tc.difficulty ?? (prev.difficulty ?? 1),
        tags: Array.isArray(tc.tags) ? tc.tags : [],
        source: "topic-bank",
        topicBankId: bankId,
      };
      const contentChanged =
        (prev.front || "") !== next.front ||
        (prev.back || "") !== next.back ||
        (prev.difficulty ?? 1) !== (next.difficulty ?? 1) ||
        JSON.stringify(prev.tags || []) !== JSON.stringify(next.tags || []);
      if (contentChanged || wasUnlinked) updated++;
      if (process.env.NODE_ENV !== "production" && matchedSamples.length < 3) {
        matchedSamples.push({ id: candidateId, promoted: wasUnlinked });
      }
      return next;
    });

    const matchesById = lesson.flashcards.filter((c) => {
      const candidateId = toLessonId(c);
      return candidateId && bankById.has(candidateId);
    }).length;

    // Pass B: Add missing bank cards (dedupe by canonical id)
    const existingIds = new Set(
      lesson.flashcards.map((c) => toLessonId(c)).filter(Boolean)
    );
    let added = 0;
    for (const tc of bankCards) {
      const bankId = toBankId(tc);
      if (!bankId || existingIds.has(bankId)) continue;
      lesson.flashcards.push({
        id: bankId,
        front: tc.front || "",
        back: tc.back || "",
        difficulty: tc.difficulty ?? 1,
        tags: Array.isArray(tc.tags) ? tc.tags : [],
        source: "topic-bank",
        topicBankId: bankId,
      });
      existingIds.add(bankId);
      added++;
    }

    await lesson.save();
    const syncedCount = added + updated;
    if (process.env.NODE_ENV !== "production") {
      console.log("[sync-topic-bank] topicBankCount:", bankCards.length, "matchesById:", matchesById, "updated:", updated, "added:", added);
      console.log("[sync-topic-bank] first 3 matched (id, promoted):", JSON.stringify(matchedSamples));
    }
    const payload = {
      ok: true,
      added,
      updated,
      syncedCount,
      topicBankCount: bankCards.length,
      flashcardsCount: lesson.flashcards.length,
      flashcards: lesson.flashcards,
      lesson: lesson.toObject ? lesson.toObject() : lesson,
    };
    return res.json(payload);
  } catch (err) {
    console.error("sync-topic-bank-flashcards error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
}

// Primary path (matches frontend api.post `/lessons/${lessonId}/sync-topic-bank/flashcards`)
router.post("/:id/sync-topic-bank/flashcards", auth, requireLessonOwnerOrAdmin, handleSyncTopicBankFlashcards);
// Alias so /api/lessons/:id/flashcards/sync-from-topic-bank also works (avoids "route not found")
router.post("/:id/flashcards/sync-from-topic-bank", auth, requireLessonOwnerOrAdmin, handleSyncTopicBankFlashcards);

// PR-Q2: Generate quiz from topic bank (published-only, replace). PR-CONTENT-TARGETING-1: validate body topicKey when provided.
router.post("/:id/generate/quiz-from-topic", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      if (req.body && req.body.topicKey) {
        assertValidNamespacedTopicKey(resolved.specKey, String(req.body.topicKey).trim());
      }
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({
          msg: err.message || "Lesson must be mapped to a valid syllabus topicKey (specKey:topicSlug) to generate practice.",
        });
      }
      throw err;
    }
    const result = await generateLessonQuizFromTopic({
      lessonId,
      userId: req.user._id || req.user.userId,
      opts: { publishedOnly: true },
    });
    return res.json({
      ok: true,
      addedCount: result.addedCount,
      questionsCount: result.questionsCount,
      lesson: result.lesson,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ msg: err.message || "Lesson has no topicKey; cannot generate quiz." });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ msg: err.message || "Lesson not found" });
    }
    console.error("generate/quiz-from-topic error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PR: Attach page quiz from Topic Quiz Bank (published-only, exact topicKey, append to lesson.quiz.questions with pageId).
router.post("/:id/attach-page-quiz-from-bank", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    let namespacedTopicKey;
    let bankTopicKey;
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      namespacedTopicKey = resolved.namespacedTopicKey;
      bankTopicKey = resolveQuestionBankNamespacedTopicKey(resolved.specKey, resolved.namespacedTopicKey);
    } catch (err) {
      if (err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({ msg: err.message || "Lesson must have a valid topicKey." });
      }
      throw err;
    }

    const { pageId, questionIds } = req.body || {};
    if (!pageId || typeof pageId !== "string" || !pageId.trim()) {
      return res.status(400).json({ msg: "pageId is required" });
    }
    const ids = Array.isArray(questionIds) ? questionIds.filter((id) => id && mongoose.Types.ObjectId.isValid(String(id))) : [];
    if (ids.length === 0) {
      return res.status(400).json({ msg: "questionIds array with at least one valid id is required" });
    }

    const allowDraft = req.body && req.body.allowDraft === true;
    const teacherIdForDraft = lesson.teacherId || lesson.ownerId;
    const bankQuery = {
      _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
      topicKey: bankTopicKey,
      kind: "quiz",
      isArchived: { $ne: true },
    };
    if (allowDraft) {
      bankQuery.$or = [
        { status: "published" },
        { status: "draft", ownerId: teacherIdForDraft },
      ];
    } else {
      bankQuery.status = "published";
    }
    const bankQuestions = await TopicQuizQuestion.find(bankQuery).lean();

    const existingQuiz = lesson.quiz && Array.isArray(lesson.quiz.questions) ? lesson.quiz.questions : [];
    const existingSourceIds = new Set(
      existingQuiz
        .filter((q) => String(q.pageId || "") === String(pageId) && (q.sourceQuestionId || q.sourceType === "topicQuizQuestion"))
        .map((q) => String(q.sourceQuestionId || q.id || ""))
        .filter(Boolean)
    );

    const alreadyExistedCount = ids.filter((id) => existingSourceIds.has(String(id))).length;

    const toAttach = [];
    for (const q of bankQuestions) {
      const sid = String(q._id);
      if (existingSourceIds.has(sid)) continue;
      const choices = Array.isArray(q.choices) ? q.choices : [];
      const correctIndex = Math.min(Math.max(0, Number(q.correctIndex)), Math.max(0, choices.length - 1));
      const isShort = String(q.type || "").toLowerCase() === "short-answer";
      const correctAnswer = isShort
        ? (Array.isArray(q.acceptableAnswers) && q.acceptableAnswers[0] ? q.acceptableAnswers[0] : "")
        : (choices[correctIndex] || "");
      const meta = q.metadata && typeof q.metadata === "object" ? q.metadata : {};
      toAttach.push({
        id: `pq_${pageId}_${Date.now()}_${toAttach.length}`,
        type: isShort ? "short" : "mcq",
        question: q.questionText || "",
        options: isShort ? undefined : choices,
        correctAnswer,
        explanation: q.explanation || "",
        pageId: pageId.trim(),
        sourceQuestionId: sid,
        sourceType: "topicQuizQuestion",
        source: "topic_quiz_bank",
        aiGenerated: meta.aiGenerated === true,
      });
      existingSourceIds.add(sid);
    }

    const alreadyExisted = ids.length - toAttach.length;
    const newQuestions = [...existingQuiz, ...toAttach];

    if (!lesson.quiz || typeof lesson.quiz !== "object") {
      lesson.quiz = { timeSeconds: 600, questions: [] };
    }
    lesson.quiz.questions = newQuestions;
    lesson.markModified("quiz");
    await lesson.save();

    return res.json({
      ok: true,
      addedCount: toAttach.length,
      alreadyExisted: alreadyExistedCount,
      lesson: lesson.toObject ? lesson.toObject() : lesson,
    });
  } catch (err) {
    console.error("attach-page-quiz-from-bank error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PR-PP2: Generate past papers from topic bank (published-only, replace). PR-CONTENT-TARGETING-1: validate body topicKey when provided.
router.post("/:id/generate/past-papers-from-topic", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      if (req.body && req.body.topicKey) {
        assertValidNamespacedTopicKey(resolved.specKey, String(req.body.topicKey).trim());
      }
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({
          msg: err.message || "Lesson must be mapped to a valid syllabus topicKey (specKey:topicSlug) to generate practice.",
        });
      }
      throw err;
    }
    const result = await generateLessonPastPapersFromTopic({
      lessonId,
      userId: req.user._id || req.user.userId,
    });
    return res.json({
      ok: true,
      addedCount: result.addedCount,
      pastPapersCount: result.pastPapersCount,
      lesson: result.lesson,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ msg: err.message || "Lesson has no topicKey; cannot generate past papers." });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ msg: err.message || "Lesson not found" });
    }
    console.error("generate/past-papers-from-topic error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PR-A1: Generate assessment from topic bank (kind=assessment, published-only, replace). PR-CONTENT-TARGETING-1: validate body topicKey when provided.
router.post("/:id/generate/assessment-from-topic", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    try {
      const resolved = getValidNamespacedTopicKeyFromLesson(lesson);
      if (req.body && req.body.topicKey) {
        assertValidNamespacedTopicKey(resolved.specKey, String(req.body.topicKey).trim());
      }
    } catch (err) {
      if (err.code === "INVALID_SPEC_KEY" || err.code === "INVALID_TOPIC_KEY") {
        return res.status(400).json({
          msg: err.message || "Lesson must be mapped to a valid syllabus topicKey (specKey:topicSlug) to generate practice.",
        });
      }
      throw err;
    }
    const result = await generateLessonAssessmentFromTopic({
      lessonId,
      userId: req.user._id || req.user.userId,
    });
    return res.json({
      ok: true,
      addedCount: result.addedCount,
      questionsCount: result.questionsCount,
      lesson: result.lesson,
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ msg: err.message || "Lesson has no topicKey; cannot generate assessment." });
    }
    if (err.statusCode === 404) {
      return res.status(404).json({ msg: err.message || "Lesson not found" });
    }
    console.error("generate/assessment-from-topic error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// PR3a.1: One-click attach top N questions by topicKey (derived from lesson.topic if not provided). PR16: uses shared helper.
router.post("/:id/exam-questions/attach-by-topic", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }
    const lesson = await Lesson.findById(lessonId)
      .select("topic subTopic topicKey specKey title canonicalTopicKey metadata teacherId organisationId examQuestions")
      .lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });

    let limit = typeof req.body.limit === "number" ? req.body.limit : parseInt(req.body.limit, 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 10;
    if (limit > 20) limit = 20;

    const result = await attachExamQuestionsByTopic(lesson, {
      topicKey: req.body.topicKey,
      limit,
    });
    const thinCoverage = result.added < result.requested && result.requested > 0;
    return res.json({
      ok: true,
      topicKey: result.topicKey,
      topic: result.topic,
      requested: result.requested,
      added: result.added,
      addedIds: result.addedIds,
      ...(thinCoverage && {
        thinCoverage: true,
        warning: "Question bank coverage is limited for this sub-topic. Only exact-match questions were used.",
      }),
    });
  } catch (err) {
    if (err.code === "INVALID_TOPIC_KEY") {
      return res.status(400).json({
        error: "Invalid topicKey",
        msg: "Lesson topic isn't mapped to Biology taxonomy yet — set a valid topicKey.",
      });
    }
    if (err.code === "INVALID_TOPIC") {
      return res.status(400).json({
        error: "Invalid topic",
        msg: err.message || "Lesson topic isn't mapped to Biology taxonomy yet — set a valid topic.",
      });
    }
    console.error("POST attach-by-topic error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   PR7: Toggle lesson reviewed state (owner/admin only)
   POST /api/lessons/:id/review — body: { reviewed: boolean }
   ========================================= */
router.post("/:id/review", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const reviewed = req.body?.reviewed === true;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    lesson.reviewedAt = reviewed ? new Date() : null;
    lesson.reviewedBy = reviewed ? req.user._id : null;
    await lesson.save();
    const updated = lesson.toObject();
    return res.json({
      ok: true,
      reviewedAt: lesson.reviewedAt ? lesson.reviewedAt.toISOString() : null,
      reviewedBy: lesson.reviewedBy ? String(lesson.reviewedBy) : null,
      readiness: computeLessonReadiness(updated),
    });
  } catch (err) {
    console.error("POST /:id/review error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   PR8: GET /api/lessons/:id/diagram-suggestions — owner/admin, read-only
   ========================================= */
router.get("/:id/diagram-suggestions", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = await Lesson.findById(lessonId).select("topic topicKey subject").lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const result = await getDiagramSuggestionsForLesson(lesson, { limit: 8 });
    return res.json({
      ok: true,
      lessonId,
      topicKey: result.topicKey,
      topic: result.topic,
      suggestions: result.suggestions,
    });
  } catch (err) {
    console.error("GET diagram-suggestions error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

/* =========================================
   GET /api/lessons/:id/quality-score — owner/admin, for publish gate UI
   ========================================= */
router.get("/:id/quality-score", auth, requireLessonOwnerOrAdmin, async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) return res.status(404).json({ msg: "Lesson not found" });
    const result = scoreLessonQuality(lesson);
    return res.json({
      lessonId,
      ...result,
    });
  } catch (err) {
    console.error("GET quality-score error:", err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Delete lesson (teacher only)
router.delete("/:id", auth, async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id);

    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const isOwner = String(lesson.teacherId) === String(req.user._id);
    const isAdminUser = isAdmin(req.user);

    if (!isOwner && !isAdminUser) {
      return res.status(401).json({ msg: "User not authorized" });
    }

    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ msg: "Lesson is moderated and cannot be deleted" });
    }

    await lesson.deleteOne();
    return res.json({ msg: "Lesson removed" });
  } catch (err) {
    console.error(err.message);
    return res.status(500).send("Server error");
  }
});

// Idempotency key format: length 16–128, no whitespace (prevents accidental collisions)
const IDEMPOTENCY_KEY_MIN = 16;
const IDEMPOTENCY_KEY_MAX = 128;
function isValidIdempotencyKey(key) {
  if (typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.length < IDEMPOTENCY_KEY_MIN || trimmed.length > IDEMPOTENCY_KEY_MAX) return false;
  if (/\s/.test(trimmed)) return false;
  return true;
}

// Purchase lesson (students only) — subscription entitlement; ledger row at cost 0 (no coin debit)
router.post("/:id/purchase", auth, async (req, res) => {
  const lessonIdParam = req.params.id;
  const idempotencyKeyRaw =
    req.body && typeof req.body.idempotencyKey === "string" ? req.body.idempotencyKey : null;
  const idempotencyKey = idempotencyKeyRaw ? String(idempotencyKeyRaw).trim() : null;

  const entitlementsPayload = (user) => ({
    purchasedLessonsCount: Array.isArray(user.purchasedLessons) ? user.purchasedLessons.length : 0,
  });

  const stableResponse = (payload) => ({
    success: payload.success,
    alreadyPurchased: payload.alreadyPurchased ?? false,
    idempotentReplay: payload.idempotentReplay ?? false,
    entitlements: payload.entitlements,
    ...(payload.purchaseId != null && { purchaseId: payload.purchaseId }),
    ...(payload.via != null && { via: payload.via }),
    ...(payload.coinsCharged !== undefined && { coinsCharged: payload.coinsCharged }),
    ...(payload.subscriptionActive !== undefined && { subscriptionActive: payload.subscriptionActive }),
  });

  const subscriptionMeta = (u) =>
    u && isSubscriptionActive(u) ? { via: "subscription", coinsCharged: 0, subscriptionActive: true } : {};

  try {
    if (req.user.userType !== "student") {
      return res.status(403).json({ error: "Only students can purchase lessons" });
    }
    if (!idempotencyKey) {
      return res.status(400).json({ error: "idempotencyKey required", code: "MISSING_IDEMPOTENCY_KEY" });
    }
    if (!isValidIdempotencyKey(idempotencyKey)) {
      return res.status(400).json({
        error: "idempotencyKey must be 16–128 characters, no whitespace",
        code: "INVALID_IDEMPOTENCY_KEY",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(lessonIdParam)) {
      return res.status(400).json({ error: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonIdParam).lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found" });
    }
    if (["archived", "flagged"].includes(String(lesson.status || ""))) {
      return res.status(403).json({ error: "Lesson is not available for purchase" });
    }
    if (!lesson.isPublished) {
      return res.status(400).json({ error: "Lesson is not published" });
    }

    const userId = req.user._id || req.user.userId;

    if (req.user.userType === "student" && !isSubscriptionActive(req.user)) {
      return res.status(403).json({
        code: "SUBSCRIPTION_REQUIRED",
        message: "Full lesson access requires an active subscription.",
      });
    }

    const existingByLesson = await LessonPurchase.findOne({
      userId,
      lessonId: lesson._id,
    }).lean();
    if (existingByLesson) {
      const user = await User.findById(userId).select("purchasedLessons").lean();
      return res.status(200).json(
        stableResponse({
          success: true,
          alreadyPurchased: true,
          idempotentReplay: false,
          entitlements: entitlementsPayload(user || {}),
          ...subscriptionMeta(req.user),
        })
      );
    }

    const existingByKey = await LessonPurchase.findOne({
      userId,
      idempotencyKey,
    }).lean();
    if (existingByKey) {
      const user = await User.findById(userId).select("purchasedLessons").lean();
      return res.status(200).json(
        stableResponse({
          success: true,
          alreadyPurchased: true,
          idempotentReplay: true,
          entitlements: entitlementsPayload(user || {}),
          ...subscriptionMeta(req.user),
        })
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(500).json({ error: "User not found" });
    }
    if (!isSubscriptionActive(user)) {
      return res.status(403).json({
        code: "SUBSCRIPTION_REQUIRED",
        message: "Full lesson access requires an active subscription.",
      });
    }

    const cost = 0;

    // 9C hardening: fail closed if transactions not available (replica set required)
    let transactionsAvailable = false;
    try {
      const db = mongoose.connection.db;
      if (db) {
        const hello = await db.admin().command({ hello: 1 });
        transactionsAvailable = !!(hello && hello.setName);
      }
    } catch (e) {
      console.error("Purchase: transaction capability check failed", e.message);
    }
    if (!transactionsAvailable) {
      console.error(
        "Purchase: MongoDB transactions unavailable (replica set required). Refusing to run non-atomic purchase."
      );
      return res.status(503).json({
        error: "Purchase temporarily unavailable",
        code: "TRANSACTIONS_UNAVAILABLE",
      });
    }

    const maxAttempts = 2;
    let ledgerDoc = null;
    let lastTxErr = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Order: insert ledger first so duplicate (userId, lessonId) aborts without debiting
        const [created] = await LessonPurchase.create(
          [
            {
              userId,
              lessonId: lesson._id,
              cost,
              idempotencyKey,
            },
          ],
          { session }
        );
        ledgerDoc = created;

        const purchaseRecord = {
          lessonId: lesson._id,
          price: cost,
          purchasedAt: new Date(),
        };
        await User.findByIdAndUpdate(
          userId,
          {
            $addToSet: { purchasedLessons: purchaseRecord },
          },
          { session }
        );
        await session.commitTransaction();
        lastTxErr = null;
        break;
      } catch (txErr) {
        await session.abortTransaction();
        lastTxErr = txErr;
        const isDuplicateKey =
          txErr.code === 11000 ||
          txErr.codeName === "DuplicateKey" ||
          (txErr.writeErrors && txErr.writeErrors.some((e) => e.code === 11000));
        if (isDuplicateKey) {
          const userAfter = await User.findById(userId).select("purchasedLessons").lean();
          return res.status(200).json(
            stableResponse({
              success: true,
              alreadyPurchased: true,
              idempotentReplay: false,
              entitlements: entitlementsPayload(userAfter || {}),
              ...subscriptionMeta(req.user),
            })
          );
        }
        const isTransientTx =
          txErr.code === 112 ||
          txErr.codeName === "WriteConflict" ||
          (txErr.errorLabelSet && txErr.errorLabelSet.has && txErr.errorLabelSet.has("TransientTransactionError"));
        if (isTransientTx && attempt < maxAttempts) {
          continue;
        }
        throw txErr;
      } finally {
        session.endSession();
      }
    }
    if (lastTxErr) throw lastTxErr;

    const updatedUser = await User.findById(userId).select("purchasedLessons").lean();
    const teacherEarnings = 0;
    const teacher = await User.findById(lesson.teacherId);
    if (teacher) {
      teacher.transactions = teacher.transactions || [];
      teacher.transactions.push({
        type: "sale",
        amount: teacherEarnings,
        date: new Date(),
        description: `Lesson access recorded (subscription): ${lesson.title}`,
        lessonId: lesson._id,
        status: "completed",
      });
      await teacher.save();
      try {
        const { createNotification } = require("./notifications");
        await createNotification(
          teacher._id,
          "purchase_success",
          "Lesson access",
          `A student accessed your lesson "${lesson.title}" via subscription.`,
          { lessonId: lesson._id, price: cost, earnings: teacherEarnings },
          `/lesson/${lesson._id}`
        );
      } catch (_) {}
    }
    await Purchase.create({
      lessonId: lesson._id,
      studentId: userId,
      teacherId: lesson.teacherId,
      price: cost,
      teacherEarnings,
      timestamp: new Date(),
    });

    return res.status(200).json(
      stableResponse({
        success: true,
        alreadyPurchased: false,
        idempotentReplay: false,
        entitlements: entitlementsPayload(updatedUser || {}),
        purchaseId: ledgerDoc && ledgerDoc._id ? String(ledgerDoc._id) : undefined,
        ...subscriptionMeta(req.user),
      })
    );
  } catch (err) {
    const isTransient =
      err.code === 112 ||
      err.codeName === "WriteConflict" ||
      (err.errorLabelSet && err.errorLabelSet.has && err.errorLabelSet.has("TransientTransactionError"));
    if (isTransient) {
      console.warn("Purchase conflict (transient); client should retry with same idempotencyKey", err.codeName || err.code);
      return res.status(409).json({
        success: false,
        code: "PURCHASE_CONFLICT",
        error: "Purchase conflict; retry with the same idempotencyKey",
      });
    }
    return sendInternalError("lessons/purchase", err, res, { extra: { success: false } });
  }
});

/*
 * POST /api/lessons/:id/unlock — Legacy unlock; subscription or entitled access only (no coin debit).
 *
 * Trial: granted on first unlock attempt, once per user (grantTrialIfEligible); does not block unlock on failure.
 */
router.post("/:id/unlock", auth, async (req, res) => {
  try {
    if (req.user.userType !== "student") {
      return res.status(403).json({ msg: "Only students can unlock lessons" });
    }

    const lessonId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ msg: "Invalid lesson id" });
    }

    const lesson = await Lesson.findById(lessonId).lean();
    if (!lesson) {
      return res.status(404).json({ msg: "Lesson not found" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(500).json({ error: "User not found" });
    }

    if (isSubscriptionActive(user)) {
      return res.status(200).json({ success: true, alreadyHasAccess: true });
    }

    const alreadyPurchased = Array.isArray(user.purchasedLessons) && user.purchasedLessons.some(
      (pl) => String(pl?.lessonId ?? pl) === String(lesson._id)
    );
    if (alreadyPurchased) {
      return res.status(200).json({ success: true, alreadyHasAccess: true });
    }

    let trialGranted = false;
    let trialExpiresAt;
    try {
      const trial = await grantTrialIfEligible({ userId: user._id, reason: "first_unlock" });
      if (trial.granted) {
        trialGranted = true;
        trialExpiresAt = trial.expiresAt;
      }
    } catch (e) {
      console.warn("Unlock: trial grant failed", e?.message || e);
    }

    const userAfterTrial = await User.findById(req.user._id).lean();
    if (userAfterTrial && isSubscriptionActive(userAfterTrial)) {
      return res.status(200).json({
        success: true,
        alreadyHasAccess: true,
        trialGranted,
        ...(trialExpiresAt && { trialExpiresAt }),
      });
    }

    return res.status(403).json({
      success: false,
      code: "SUBSCRIPTION_REQUIRED",
      message: "Full lesson access requires an active subscription, purchasing this lesson, or an eligible trial.",
      trialGranted,
      ...(trialExpiresAt && { trialExpiresAt }),
    });
  } catch (err) {
    return sendInternalError("lessons/unlock", err, res);
  }
});

/* =========================================
   POST /api/lessons/by-ids — Batch fetch lesson card metadata (auth required)
   Body: { ids: string[] }. Used for purchased-lessons join; no pages/content.
   ========================================= */
router.post("/by-ids", auth, async (req, res) => {
  try {
    const raw = req.body?.ids;
    if (!Array.isArray(raw)) {
      return res.status(400).json({ ok: false, error: "ids must be an array" });
    }
    const ids = raw
      .map((id) => (id != null ? String(id).trim() : ""))
      .filter((id) => id && mongoose.Types.ObjectId.isValid(id));
    const unique = [...new Set(ids)];
    if (unique.length > 200) {
      return res.status(400).json({ ok: false, error: "ids array limited to 200" });
    }
    if (unique.length === 0) {
      return res.json({ ok: true, lessons: [] });
    }
    const lessons = await Lesson.find({ _id: { $in: unique } })
      .select("_id title subject level board topic description teacherId isFreePreview status isPublished teacherName")
      .lean();
    const byId = {};
    lessons.forEach((l) => {
      const boardVal = l.board ?? "";
      byId[String(l._id)] = {
        _id: l._id,
        id: String(l._id),
        title: l.title ?? null,
        subject: l.subject ?? null,
        level: l.level ?? null,
        board: boardVal || null,
        examBoard: boardVal || "",
        topic: l.topic ?? null,
        description: l.description ?? null,
        teacherId: l.teacherId ?? null,
        teacherName: l.teacherName ?? null,
        status: l.status ?? null,
        isPublished: l.isPublished ?? false,
      };
    });
    const ordered = unique.map((id) => byId[id]).filter(Boolean);
    return res.json({ ok: true, lessons: ordered });
  } catch (err) {
    console.error("POST /api/lessons/by-ids error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch lessons" });
  }
});

/* =========================================
   ✅ Option A: Get all published lessons (students)
   - Enforces student's level on the server
   - Supports query filters: subject, topic, board, tier, q
   ========================================= */

router.get("/", auth, async (req, res) => {
  try {
    const { subject, level, topic, teacher, tier, board, q, search } = req.query;

    const requesterType = (req.user?.userType || "").toString().toLowerCase();

    // Phase 9D: list filtering by role — students only see published; teachers see own; admins see all
    const query = { status: { $nin: ["archived", "flagged"] } };
    if (requesterType === "student") {
      query.status = "published";
      query.isPublished = true;
    } else if (requesterType === "teacher") {
      query.teacherId = req.user._id;
    }
    // admin: no extra filter (all non-archived/flagged)

    // ✅ HARD RULE: students are locked to their own level
    if (requesterType === "student") {
      const userId = getAuthUserId(req);
      if (userId) {
        const u = await User.findById(userId)
          .select("Keystage stageKey yearGroup userType")
          .lean();

        const ks =
          normalizeKeyStage(u?.Keystage) ||
          normalizeKeyStage(u?.stageKey) ||
          deriveKeyStageFromYearGroup(u?.yearGroup);

        const forcedLevel = keyStageToLessonLevelLabel(ks);

        // If we can determine it, enforce it (normalization-safe)
        if (forcedLevel) {
          const re = levelToRegex(forcedLevel);
          if (re) query.level = re;
        }
      }
    } else {
      // teacher/admin: allow explicit level filtering (normalization-safe)
      if (level) {
        const re = levelToRegex(level);
        if (re) query.level = re;
      }
    }

    if (subject) query.subject = subject;

    if (board !== undefined) {
      // ✅ "Not set" should match missing/empty/"Not set"
      if (isNotSetBoard(board)) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { board: { $exists: false } },
            { board: null },
            { board: "" },
            { board: { $regex: /^not set$/i } },
            { board: { $regex: /^none$/i } },
          ],
        });
      } else {
        // supports exact board match (case-insensitive exact)
        query.board = { $regex: `^${escapeRegex(String(board).trim())}$`, $options: "i" };
      }
    }

    if (topic) {
      query.topic = { $regex: String(topic), $options: "i" };
    }

    if (teacher) {
      query.teacherName = { $regex: String(teacher), $options: "i" };
    }

    // tier only applies when query.level is GCSE (works for regex too)
    // We only apply tier if caller explicitly sent tier AND the requested/effective level is GCSE.
    const levelIsGCSE =
      requesterType === "student"
        ? normalizeKeyStage(
            (await User.findById(getAuthUserId(req))
              .select("Keystage stageKey yearGroup")
              .lean()
              .then((u) => u?.Keystage || u?.stageKey || deriveKeyStageFromYearGroup(u?.yearGroup))
              .catch(() => "")) || ""
          ) === "gcse"
        : String(level || "").toLowerCase().includes("gcse");

    if (tier && levelIsGCSE) {
      const normalisedTier = normalizeTier(tier);
      if (normalisedTier) query.tier = normalisedTier;
    }

    // free-text search (title/subject/topic/board/level)
    const text = (q || search || "").toString().trim();
    if (text) {
      const rx = { $regex: text, $options: "i" };
      query.$or = [
        { title: rx },
        { subject: rx },
        { topic: rx },
        { board: rx },
        { level: rx },
      ];
    }

    let lessons = await Lesson.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // List-safe shape only: never return pages, content, quiz, flashcards (Phase 9 — non-leaky).
    const LIST_SAFE_KEYS = [
      "id", "_id", "title", "summary", "description", "subject", "level", "board", "examBoard", "topic", "tier",
      "status", "isPublished", "teacherId", "teacherName", "createdAt", "updatedAt", "views",
      "averageRating", "isFreePreview", "preview",
    ];
    function toListSafe(lesson, extra = {}) {
      const safe = {};
      for (const k of LIST_SAFE_KEYS) {
        if (lesson[k] !== undefined) safe[k] = lesson[k];
      }
      // PR0: canonical examBoard (stored as board; lean() has no virtuals)
      safe.examBoard = lesson?.examBoard ?? lesson?.board ?? "";
      if (lesson._id !== undefined) safe._id = lesson._id;
      if (safe.id === undefined && lesson._id !== undefined) safe.id = lesson._id;
      return { ...safe, ...extra };
    }

    const fullUser = await User.findById(getAuthUserId(req))
      .select("userType subscriptionV2 subscription purchasedLessons")
      .lean();

    const lessonIds = lessons.map((l) => l._id);
    let unlockSet = new Set();
    if (fullUser?._id) {
      const unlockRows = await LessonUnlock.find({
        userId: fullUser._id,
        lessonId: { $in: lessonIds },
      })
        .select("lessonId")
        .lean();
      unlockSet = new Set(unlockRows.map((r) => String(r.lessonId)));
    }

    const visible = await Promise.all(
      lessons.map(async (l) => {
        const isFreePreview = Boolean(l.isFreePreview);
        const status = l.status || (l.isPublished ? "published" : "draft");
        const isPublished = String(status).toLowerCase() === "published";
        const decision = fullUser
          ? await canAccessContent(fullUser, {
              _id: l._id,
              id: l._id?.toString(),
              isFreePreview,
              isPublished,
            }, { unlockSet })
          : { allowed: false, reason: "UNAUTHENTICATED" };

        if (!decision.allowed) {
          const out = toListSafe(l, { locked: true, hasAccess: false, reason: decision.reason });
          if (!out.description || !String(out.description).trim()) {
            out.description = deriveLessonCardDescription(l);
          }
          return out;
        }
        if (decision.reason === "FREE_PREVIEW") {
          const out = toListSafe(l, {
            hasAccess: false,
            isFreePreview: true,
            locked: false,
            preview: l.preview ?? null,
          });
          if (!out.description || !String(out.description).trim()) {
            out.description = deriveLessonCardDescription(l);
          }
          return out;
        }
        const pageCount = Array.isArray(l.pages) ? l.pages.length : 0;
        const out = toListSafe(l, {
          hasAccess: true,
          isFreePreview,
          locked: false,
          pageCount,
        });
        if (!out.description || !String(out.description).trim()) {
          out.description = deriveLessonCardDescription(l);
        }
        return out;
      })
    );

    return res.json(visible);
  } catch (err) {
    console.error("GET /api/lessons error:", err.message);
    return res.status(500).send("Server error");
  }
});

module.exports = router;
module.exports.createLessonHandler = createLessonHandler;
module.exports.mergePagesOnUpdate = mergePagesOnUpdate;
module.exports.sanitisePagesInput = sanitisePagesInput;