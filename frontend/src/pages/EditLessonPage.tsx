/** @module EditLessonPage */
import React, { useMemo, useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { defaultUrlTransform } from "react-markdown";
import { LessonRenderer } from "../components/lesson/LessonRenderer";
import { InlineSelfCheckBlock } from "../components/lesson/InlineSelfCheckBlock";
import { InteractiveSequenceBlock } from "../components/lesson/InteractiveSequenceBlock";
import { InteractiveDiagramBlock } from "../components/lesson/InteractiveDiagramBlock";
import { DragDropMatchBlock } from "../components/lesson/DragDropMatchBlock";
import { GraphBlock } from "../components/lesson/GraphBlock";
import { LessonDiagramBlockDisplay } from "../components/lesson/LessonDiagramBlockDisplay";
import { GraphBlockAuthoring } from "../components/lesson/GraphBlockAuthoring";
import {
  emptyGraphBlock,
  graphBlockForPersist,
  normalizeGraphBlockForDisplay,
} from "../components/lesson/graphBlockTypes";
import { resolveLessonDisplayBlockType } from "../types/lessonBlocks";
import { DragDropMatchDiagramAuthoring } from "../components/lesson/DragDropMatchDiagramAuthoring";
import { CheckpointCard } from "../components/lesson/CheckpointCard";
import { LessonBlockContentTextarea } from "../components/lesson/LessonBlockContentTextarea";
import { LessonAutoTextarea } from "../components/lesson/LessonAutoTextarea";
import { supabase } from "../lib/supabaseClient";
import api, { listVisuals, getVisualById } from "../services/api";
import { generateFlashcardsFromTopic, syncFlashcardsFromTopicBank, listTopicFlashcards } from "../api/topicFlashcards";
import { listTopicQuizQuestions } from "../api/topicQuizQuestions";
import { getDiagramAssetLibraryEnabled, getDiagramBriefFromBlockEnabled } from "../api/featureFlags";
import type { DiagramAssetRecord } from "../api/diagramAssets";
import DiagramAssetLibraryPanel from "../components/diagrams/DiagramAssetLibraryPanel";
import { makeAbsoluteAssetUrl } from "../utils/assetUrl";
import {
  checkpointMarkSchemeEditorText,
  checkpointMarkSchemeLines,
  mergeCheckpointExplanationParts,
} from "../utils/checkpointFeedback";
import {
  extractSequenceStepImagePromptFromDescription,
  mergeSequenceStepDescriptionAndImagePrompt,
  stripSequenceStepImagePromptFromDescription,
} from "../utils/interactiveSequenceStepImagePrompt";
import { toAbsoluteAssetUrl } from "../services/mediaUrl";
import { useResolvedTopicKeyForBank } from "../hooks/useResolvedTopicKeyForBank";
import {
  extractTopicSlug,
  isLikelyInvalidTopicSlug,
  normalizeLessonTopicSlugFromLesson,
} from "../utils/normalizeLessonTopicKey";
import { logTopicMappingDebug } from "../utils/resolveTopicLabelToKey";
import { resolveTopicDisplayToKey } from "../api/taxonomy";
import { getSpecKeyFromLesson } from "../utils/resolveLessonTopicKey";
import { HowToCreateLessonCallout } from "../components/teacher/HowToCreateLessonCallout";
import {
  countLessonCheckpoints,
  evaluateLessonReadiness,
  TAXONOMY_TOPIC_UNMAPPED_LABEL,
} from "../utils/lessonReadiness";
import { LESSON_DESCRIPTION_MAX_LENGTH } from "../constants/lessonDescription";
import { hasRenderableLessonImageSrc } from "../constants/lessonImageDisplay";
import {
  hideBrokenLessonImage,
  LessonImageFrame,
  lessonImageFrameImgStyle,
} from "../components/lesson/LessonImageFrame";
import {
  diagramImageUrlForPreview,
  diagramMarkdownContentForPreview,
} from "../utils/diagramBlockPreview";
import { promoteHeroOnPages } from "../utils/pageHeroMigration";
import { lessonBlockDisplayLabel } from "../utils/lessonBlockDisplayLabel";
import {
  nextHotspotFromGeneratorScript,
  nextSequenceStepFromGeneratorScript,
} from "../utils/parseGeneratorVisualScript";
import {
  applyInteractiveSequenceHydrationToPages,
  blockLooksLikeInteractiveSequence,
  normalizeInteractiveSequenceBlockForEditor,
} from "../utils/normalizeInteractiveSequenceBlock";
import { validateLessonStructure } from "../utils/validateLessonStructure";
import {
  attachLearningMetaForPersist,
  warnLearningMetaIfMissing,
} from "../utils/learningMeta";
import {
  attachPersistedBlockNumber,
  diagramAuthoringInstructionsForEditor,
  diagramAuthoringStudentTaskForEditor,
  diagramAuthoringInstructionsFromBlock,
  diagramInstructionsHiddenFromStudents,
  diagramBlockForPersist,
  mergeSavedDiagramAuthoringInstructions,
  blockNoteForPersist,
  withPersistedBlockNote,
} from "../utils/lessonBlockPersist";
import { LearningIntelligenceSummaryPanel } from "../components/lesson/LearningIntelligenceSummaryPanel";
import { TeacherBrainDesignBriefPanel } from "../components/lesson/TeacherBrainDesignBriefPanel";
import { GenerateDiagramBriefPanel } from "../components/lesson/GenerateDiagramBriefPanel";
import { TeacherCoverageReviewPanel } from "../components/lesson/TeacherCoverageReviewPanel";
import { hasTeacherBrainDesignBrief } from "../utils/teacherBrainDesignBrief";
import { injectTeacherBrainBriefs } from "../api/teacherBrainBriefs";
import {
  countTeacherBrainBriefsInPages,
  countTeacherBrainEligibleActivityBlocks,
} from "../utils/teacherBrainBriefPages";
import {
  formatPublishWithQualityWarningsMessage,
  type PublishWarningSummary,
} from "../utils/formatPublishWarningMessage";
import FlashcardsEditor from "../components/revision/FlashcardsEditor";
import { AttachedAssessmentPapersPanel } from "../components/lesson/AttachedAssessmentPapers";
import { AttachPaperModal } from "../components/lesson/AttachPaperModal";
import { AttachPageQuizModal } from "../components/lesson/AttachPageQuizModal";
import { AddKeyTermDialog } from "../components/lesson/AddKeyTermDialog";
import { SuggestKeyTermsDialog } from "../components/lesson/SuggestKeyTermsDialog";
import { generateDragDropPairsFromText, type SuggestedKeyTermRow } from "../api/ai";
import {
  applyKeyTermsToBlockContent,
  buildKeyTermSpanHtml,
  selectionIntersectsDataKeyTermSpan,
} from "../utils/keyTermInlineMarkers";
import { AddBlockByRoleSelect } from "../components/lesson/AddBlockByRoleSelect";
import {
  InteractiveBlockCreationDialog,
  INTERACTIVE_TYPES_WITH_CREATION_DIALOG,
} from "../components/lesson/InteractiveBlockCreationDialog";
import { INTERACTIVE_DIAGRAM_TEMPLATES } from "../components/lesson/interactiveDiagramTemplates";
import { INTERACTIVE_SEQUENCE_TEMPLATE_MITOSIS } from "../components/lesson/interactiveSequenceTemplates";
import { CELL_ORGANELLES_DRAG_DROP_TEMPLATE } from "../components/lesson/dragDropMatchTemplates";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { SpecKey } from "../api/taxonomy";
import { getPublishGateCheck, type PublishGateCheckResponse } from "../api/generation";
import {
  type LessonBlockType,
  type AddBlockOption,
  BLOCK_META,
  getBlockStyle,
  normalizeBlockType,
  toLegacyBlockType,
  PAGE_TYPE_OPTIONS,
} from "../types/lessonBlocks";
import Toast from "../components/Toast";
import { listReports, updateReportStatus, REPORT_PRIORITY, type LessonIssueReport } from "../api/lessonIssues";
import { fetchLessonGraph, fetchTopicCoverage, rebuildLessonGraph } from "../api/contentGraph";
import {
  getCurriculumAiReview,
  requestCurriculumAiReview,
  generateLessonAssets,
  type CurriculumAiReviewDoc,
} from "../api/lessons";
import {
  collapseExactDuplicatePaste,
  getLessonPasteInsertText,
  guardLessonBlockPatchForDuplicatePaste,
} from "../utils/lessonEditorPaste";
import {
  patchMcqAddOption,
  patchMcqOptionText,
  patchMcqRemoveOption,
} from "../utils/lessonMcqOptionsEditor";
import {
  coerceLessonMcqOptionsFour,
  lessonCheckpointWholeCellPaste,
  tryParseFlexibleCheckpointMcq,
  markSchemeFromFlexibleCheckpointParse,
} from "../utils/parseFlexibleCheckpointPaste";
import {
  getHotspotLetter,
  isInteractiveDiagramHotspotPlaced,
  normalizeInteractiveDiagramHotspot,
  resolveInteractiveDiagramHotspotExplanation,
  type NormalizedInteractiveDiagramHotspot,
} from "../utils/interactiveDiagramHotspots";
import {
  coerceDiagramZonePct,
  logDragDropMatchZoneBindings,
  dragDropPairEditorLabels,
  normalizeDragDropPairRow,
  buildDragDropMatchBlockForPersist,
  coalesceDragDropMatchBlockPatch,
  readDragDropBlockMainImageUrl,
  dragDropLayoutPersistedValues,
  type DragDropMatchAuthoringMatchMode,
  readDragDropPairAnswerImageUrl,
  dragDropMatchModeFromBlockForProps,
  mapDragDropPairForBlockRender,
  readDragDropMatchModeFromBlock,
  resolveDragDropPersistMode,
  readDragDropPairTargetImageUrl,
  parseDragDropMatchMode,
  resolveDragDropMatchModeForPersist,
  resolveDragDropMatchModeForUi,
  sanitizeDiagramDropZonesForAuthoring,
  TEXT_TO_IMAGE_PAIR_LIMIT,
} from "../utils/dragDropMatchDiagram";
import { parseGeneratorMcqForSelfCheckImport } from "../utils/parseGeneratorMcqForSelfCheckImport";

/** Topic bank URLs with filters for AI lesson drafts (draft-only review). */
function buildAiLessonAssetBankReviewUrl(
  which: "flashcards" | "quizzes",
  p: { topicKeySlug: string; specKey: string; lessonId: string }
) {
  const q = new URLSearchParams();
  q.set("topicKey", p.topicKeySlug);
  q.set("specKey", p.specKey);
  q.set("metadataSource", "ai_lesson_assets");
  q.set("lessonId", p.lessonId);
  q.set("status", "draft");
  return `/teacher/topic-banks/${which}?${q.toString()}`;
}

/** Topic exam bank — same lesson-scoped AI draft filters as flashcard/quiz banks. */
function buildAiLessonAssetExamReviewUrl(p: { topicKeySlug: string; specKey: string; lessonId: string }) {
  const q = new URLSearchParams();
  q.set("topicKey", p.topicKeySlug);
  q.set("specKey", p.specKey);
  q.set("metadataSource", "ai_lesson_assets");
  q.set("generationType", "exam");
  q.set("lessonId", p.lessonId);
  q.set("status", "draft");
  return `/teacher/exam-question-bank?${q.toString()}`;
}

function blockEditorSizeVariant(type: LessonBlockType): "default" | "long" {
  return type === "keyIdeas" ||
    type === "misconceptions" ||
    type === "examTips" ||
    type === "deeperKnowledge"
    ? "long"
    : "default";
}

interface LessonPageBlock {
  type: LessonBlockType;
  content?: string;
  /** Checkpoint block fields (when type === "checkpoint") */
  prompt?: string;
  questionType?: "mcq" | "short";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  /** Checkpoint/self-check: string[]; graph block: plain-text mark scheme. */
  markScheme?: string[] | string;
  /** Page Quiz block fields (when type === "pageQuiz") — written to lesson.quiz.questions with pageId */
  question?: string;
  /** Diagram block fields (when type === "diagram") */
  visualId?: string;
  /** P2.1 — reusable Diagram Asset Library reference */
  diagramAssetId?: string;
  caption?: string;
  /** Teacher explanation / instructions (diagram blocks) */
  subtitle?: string;
  /** Student questions / activities (diagram blocks) */
  studentTask?: string;
  /** PR11: diagram depth */
  mode?: "static" | "annotated" | "step";
  annotations?: Array<{ id: string; kind?: "label" | "callout"; text?: string; x?: number; y?: number; color?: string; align?: "left" | "center" | "right" }>;
  steps?: Array<{ id: string; title?: string; showAnnotationIds?: string[] }>;
  /** Leader lines: from label (labelId) to point (x, y) on diagram. 0–1 normalized. */
  connectors?: Array<{ id: string; labelId: string; x: number; y: number }>;
  /** ai_fallback diagram: persisted so fallback survives save and renders in editor */
  source?: string;
  title?: string;
  note?: string;
  /** Block role — semantic label for contract enforcement (e.g. Hook, Core rule, What to Notice) */
  role?: string;
  elements?: Array<{ id: string; label: string; x?: number; y?: number }>;
  /** AI-generated diagram image (when no VisualModel; Chalkie-like) */
  imageUrl?: string;
  imageSource?: string;
  alt?: string;
  /** type === "interactiveSequence" (not diagram `steps`) */
  intro?: string;
  sequenceSteps?: Array<{
    id?: string;
    title: string;
    description: string;
    imageUrl: string;
    caption: string;
    testExplanation?: string;
  }>;
  /** type === "interactiveDiagram" — x/y 0–100 (percentage); omit when unplaced */
  hotspots?: Array<{
    id: string;
    x?: number;
    y?: number;
    label: string;
    description: string;
    explanation?: string;
    test?: {
      question: string;
      options: [string, string, string, string];
      correctIndex: number;
      explanation?: string;
    };
  }>;
  /** type === "dragDropMatch" */
  instructions?: string;
  pairs?: Array<{
    id: string;
    prompt: string;
    answer: string;
    explanation?: string;
    answerImageUrl?: string;
    imageUrl?: string;
    imageAlt?: string;
  }>;
  matchMode?: DragDropMatchAuthoringMatchMode;
  dragDropLayout?: string;
  dropZones?: Array<{
    id: string;
    x?: number;
    y?: number;
    correctPairId: string;
    explanation?: string;
  }>;
  /** type === "graph" */
  graphType?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xUnits?: string;
  yUnits?: string;
  graphSeries?: Array<{
    id: string;
    label: string;
    color?: string;
    points: Array<{ x: number | string; y: number }>;
  }>;
  graphAnnotations?: Array<{
    id: string;
    text: string;
    kind?: string;
    seriesId?: string;
    pointIndex?: number;
  }>;
  examQuestion?: string;
  examinerTip?: string;
}

/** Hotspot with coordinates — only these render on the editor preview image (unplaced omitted). */
type PlacedInteractiveDiagramHotspot = NormalizedInteractiveDiagramHotspot & { x: number; y: number };

interface LessonPageHero {
  type: "none" | "image" | "video" | "animation";
  src: any;
  caption?: string;
}

interface LessonPage {
  pageId: string;
  title: string;
  order: number;
  pageType?: string;
  hero?: LessonPageHero;
  blocks?: LessonPageBlock[];
  /** Student glossary / keyword highlights (merged with lesson-level in view). */
  metadata?: { contentKeywords?: Array<{ term: string; definition?: string }> };
  checkpoint?: {
    question?: string;
    options?: string[];
    answer?: string;
    explanation?: string;
    markScheme?: string[];
    type?: "mcq" | "shortExplain";
  };
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: number;
}

interface QuizQuestion {
  id: string;
  type: "mcq" | "short" | "exam";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  tags?: string[];
  difficulty?: number;
  marks?: number;
  markScheme?: string[];
  /** Page-aware: which page shows this question. Empty or "END" = end of lesson. */
  pageId?: string;
}

/** PR7: readiness from backend (computed) */
interface LessonReadiness {
  status: "DRAFT" | "NEEDS_REVIEW" | "READY";
  score?: number;
  signals?: {
    hasCheckpoints?: boolean;
    checkpointCount?: number;
    hasDiagrams?: boolean;
    diagramCount?: number;
    hasPracticeQuestions?: boolean;
    practiceCount?: number;
    isReviewed?: boolean;
    missing?: string[];
  };
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  subject: string;
  level: string;
  topic: string;
  topicKey?: string;
  subTopic?: string;
  specKey?: string;
  examBoardName: string | null;
  teacherName: string;
  teacherId: string;
  estimatedDuration: number;
  isFreePreview?: boolean;
  isPublished: boolean;
  status?: string;
  /** GCSE tier: foundation | higher (PR21 diagram defaults) */
  tier?: string;
  views: number;
  averageRating: number;
  totalRatings: number;
  createdAt: string;
  pages?: LessonPage[];
  createdFromTemplate?: boolean;
  flashcards?: Flashcard[];
  quiz?: {
    timeSeconds?: number;
    questions?: QuizQuestion[];
  };
  /** PR-A1: Assessment questions (from topic bank kind=assessment) */
  assessment?: {
    timeSeconds?: number;
    questions?: QuizQuestion[];
  };
  /** PR7 */
  readiness?: LessonReadiness;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  /** PR-014.1: generatedFrom { jobId, statementCodes, seed } */
  metadata?: { generatedFrom?: { jobId?: string } };
  /** Draft-only AI curriculum review (suggestions; no auto-apply) */
  curriculumAiReview?: CurriculumAiReviewDoc | null;
  /** Lesson↔AssessmentPaper: IDs of attached assessment papers */
  assessmentPaperIds?: string[];
  /** PR-PP2: Past papers (snapshot from topic bank) */
  pastPapers?: Array<{
    title: string;
    year?: number;
    paper?: string;
    type?: string;
    sourceType: "url" | "file";
    url?: string;
    fileId?: string;
    originalName?: string;
    officialSource?: boolean;
    officialHost?: string;
  }>;
}

type ExamBoardRow = { name: string };

function getBoardName(
  exam_board: ExamBoardRow[] | ExamBoardRow | null | undefined
): string | null {
  if (Array.isArray(exam_board)) return exam_board[0]?.name ?? null;
  if (exam_board && typeof exam_board === "object" && "name" in exam_board) {
    return (exam_board as ExamBoardRow).name ?? null;
  }
  return null;
}

function isMongoObjectId(value: string | undefined) {
  if (!value) return false;
  return /^[a-f0-9]{24}$/i.test(value);
}

function isUuid(value: string | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function safeStr(v: any, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s : fallback;
}

/** Draft / in_review only; server rejects published */
function canRunCurriculumReview(lesson: Lesson | null): boolean {
  if (!lesson || lesson.isPublished) return false;
  const s = String(lesson.status || (lesson.isPublished ? "published" : "draft")).toLowerCase();
  return s === "draft" || s === "in_review";
}

function sortPages(pages: LessonPage[]) {
  return [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function newId() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const DEFAULT_INTERACTIVE_DIAGRAM_HOTSPOT_DESCRIPTION = "";

function createInteractiveDiagramHotspotEntry(
  block: { intro?: string; content?: string },
  existing: Array<{ label?: string }>,
  coords?: { x: number; y: number }
) {
  const next = nextHotspotFromGeneratorScript(
    String(block.intro ?? ""),
    String(block.content ?? ""),
    existing
  );
  const label = next?.label ?? "New hotspot";
  const description = next?.description ?? DEFAULT_INTERACTIVE_DIAGRAM_HOTSPOT_DESCRIPTION;
  return {
    id: newId(),
    label,
    description,
    explanation: description,
    ...(coords ? { x: coords.x, y: coords.y } : {}),
  };
}

function createInteractiveSequenceStepEntry(
  block: { intro?: string; content?: string },
  existing: Array<{ title?: string; description?: string }>
) {
  const next = nextSequenceStepFromGeneratorScript(
    String(block.intro ?? ""),
    String(block.content ?? ""),
    existing
  );
  return {
    id: newId(),
    title: next?.title ?? "",
    description: next?.description ?? "",
    imageUrl: "",
    caption: "",
    testExplanation: "",
  };
}

function mcqOptionsTuple(opts: string[]): [string, string, string, string] {
  const o = [...opts];
  while (o.length < 4) o.push("");
  return [String(o[0] ?? ""), String(o[1] ?? ""), String(o[2] ?? ""), String(o[3] ?? "")];
}

function hotspotTestPayloadFromPrev(
  prev: Record<string, unknown>,
  opts: string[],
  patch: Partial<{ question: string; correctIndex: number; explanation: string }>
) {
  const question =
    patch.question !== undefined
      ? patch.question
      : typeof prev.question === "string"
        ? prev.question
        : "";
  const correctIndex =
    patch.correctIndex !== undefined
      ? patch.correctIndex
      : typeof prev.correctIndex === "number"
        ? Math.max(0, Math.min(3, Math.round(prev.correctIndex)))
        : 0;
  const explanationRaw =
    patch.explanation !== undefined
      ? patch.explanation
      : typeof prev.explanation === "string"
        ? prev.explanation
        : "";
  const base = {
    question,
    options: mcqOptionsTuple(opts),
    correctIndex,
  };
  return explanationRaw.trim()
    ? { ...base, explanation: explanationRaw.trim() }
    : base;
}

function generateRevisionId() {
  return `rev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sanitizeTeacherMarkdown(input: string) {
  let text = (input || "").replace(/\r\n/g, "\n");
  text = text.replace(/^[ \t]*[•·–—*]\s*/gm, "- ");
  text = text.replace(/^[ \t]*-\s*(?=\S)/gm, "- ");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    const next = lines[i + 1].trim();
    const looksLikeHeading =
      cur.length > 0 &&
      cur.length <= 60 &&
      !cur.startsWith("#") &&
      !cur.startsWith("-") &&
      !cur.startsWith("*") &&
      !cur.endsWith(".") &&
      !cur.endsWith(":");
    const nextIsList = next.startsWith("- ");
    if (looksLikeHeading && nextIsList) {
      lines[i] = `### ${cur}`;
    }
  }
  return lines.join("\n").trimEnd();
}

const MEDIA_BUCKET =
  (process.env.REACT_APP_SUPABASE_MEDIA_BUCKET as string) || "lesson-media";

/** Align with server CURRICULUM_AI_REVIEW_MIN_PUBLISH_SCORE (default 60) for soft publish gate copy. */
const CURRICULUM_PUBLISH_MIN_SCORE = Number(
  process.env.REACT_APP_CURRICULUM_AI_REVIEW_MIN_SCORE || 60
);

function slugifyFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-_]/g, "");
}

function buildMarkdownForFile(url: string, file: File) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const alt = file.name.replace(/\.[^/.]+$/, "");
  if (isImage) return `\n\n![${alt}](${url})\n\n`;
  if (isVideo) return `\n\n[Video: ${alt}](${url})\n\n`;
  return `\n\n[${file.name}](${url})\n\n`;
}

// Function to download quiz CSV template
const downloadQuizCSVTemplate = () => {
  const csvContent = `question,type,correctAnswer,markScheme,marks,tags
"What is the function of mitochondria in a cell?","short","Generate ATP (energy) for the cell","Cellular respiration;ATP production;Energy conversion",2,"biology;cells;gcse"
"Which of the following is NOT a function of the cell membrane?","mcq","A) Photosynthesis","",1,"biology;cells;membrane"
"Explain how diffusion occurs across a cell membrane","exam","Movement of particles from high to low concentration through the membrane","Particles move randomly;Concentration gradient drives movement;Passive process;No energy required",4,"biology;cells;diffusion;transport"`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'quiz_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Robust CSV Parser that handles quoted fields, escaped quotes, and various newlines
const parseCSV = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = i + 1 < csvText.length ? csvText[i + 1] : '';

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    currentField += char;
    i++;
  }

  // Add the last row if there's any content
  if (currentField.trim() || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
  }

  return rows;
};

// Parse markScheme field (could be plain text with semicolons or JSON array)
const parseMarkScheme = (markSchemeStr: string): string[] => {
  if (!markSchemeStr || markSchemeStr.trim() === '') {
    return [];
  }

  const trimmed = markSchemeStr.trim();
  
  // Try to parse as JSON first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(item => item);
      }
    } catch (e) {
      // Not valid JSON, fall through to plain text parsing
    }
  }

  // Parse as plain text with semicolon separator
  return trimmed.split(';').map(item => item.trim()).filter(item => item);
};

/** Measured editor shell width must reach this (px) before 3-column layout — avoids one fixed wide row on most viewports. */
const EDIT_LESSON_WIDE_MIN_PX = 1220;
/** At or below this width (px): Edit / Preview tabs (single column). */
const EDIT_LESSON_NARROW_MAX_PX = 767;

/** Self-check / checkpoint MCQ option row — overrides global `input { width: 100% }` in App.css. */
const EDIT_LESSON_MCQ_OPTION_ROW_BASE: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 6,
  minWidth: 0,
  width: "100%",
  padding: "6px 8px",
  borderRadius: 8,
  boxSizing: "border-box",
};
/** Neutral row layout only — prefer editLessonMcqOptionRowStyle(isSelected) for correct-answer highlight. */
const EDIT_LESSON_MCQ_OPTION_ROW_STYLE = EDIT_LESSON_MCQ_OPTION_ROW_BASE;
function editLessonMcqOptionRowStyle(isSelected: boolean): React.CSSProperties {
  return {
    ...EDIT_LESSON_MCQ_OPTION_ROW_BASE,
    background: isSelected ? "#eff6ff" : "transparent",
    border: isSelected ? "1px solid #3b82f6" : "1px solid transparent",
  };
}
function isEditLessonMcqOptionCorrect(
  optionText: string | undefined | null,
  correctAnswer: string | undefined | null
): boolean {
  const opt = String(optionText ?? "").trim();
  return opt !== "" && opt === String(correctAnswer ?? "").trim();
}
const EDIT_LESSON_MCQ_RADIO_STYLE: React.CSSProperties = {
  flexShrink: 0,
  width: "auto",
  padding: 0,
  margin: 0,
};
const EDIT_LESSON_MCQ_TEXT_INPUT_STYLE: React.CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  width: "auto",
  padding: "8px 10px",
  borderRadius: 8,
  border: "2px solid rgba(0,0,0,0.14)",
  backgroundColor: "#fff",
  boxSizing: "border-box",
};

const EditLessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useCurrentUser({ watchLocation: true });
  const [generationWarning, setGenerationWarning] = useState<string | null>(() => (location.state as { generationWarning?: string } | null)?.generationWarning ?? null);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const interactiveSequenceHydratedLessonIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [teacherBrainInjectLoading, setTeacherBrainInjectLoading] = useState(false);
  const [teacherBrainBriefRefreshKey, setTeacherBrainBriefRefreshKey] = useState(0);
  const [coverageReviewRefreshKey, setCoverageReviewRefreshKey] = useState(0);
  /** null = not probed yet; server 404 = feature off (CURRICULUM_AI_REVIEW_ENABLED) */
  const [curriculumAiReviewFeature, setCurriculumAiReviewFeature] = useState<boolean | null>(null);
  const [curriculumReviewLoading, setCurriculumReviewLoading] = useState(false);
  const curriculumAiReviewFeatureRef = useRef(false);
  /** Set when saveToBackend returns false so Generate AI assets can show the real reason. */
  const lastSaveFailureReasonRef = useRef<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string>("");
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [interactiveDiagramTemplateSelect, setInteractiveDiagramTemplateSelect] = useState<Record<string, string>>({});
  const [interactiveDiagramTemplateHint, setInteractiveDiagramTemplateHint] = useState<Record<string, string>>({});
  /** When set, the next image click places that hotspot id (per block `key`). */
  const [interactiveDiagramPlacingId, setInteractiveDiagramPlacingId] = useState<Record<string, string | null>>({});
  /** dragDropMatch diagram: next click on placement image sets x/y for this zone id (key = pageId:idx). */
  const [dragDropDiagramPlacingId, setDragDropDiagramPlacingId] = useState<Record<string, string | null>>({});
  /** Per block `pageId:idx`: AI drag-drop pair generation */
  const [dragDropPairAiUi, setDragDropPairAiUi] = useState<
    Record<string, { loading: boolean; message: "error" | "empty" | null }>
  >({});
  /** Optional topic/prompt — when long enough, AI uses topic mode (4–6 pairs); else excerpt from lesson fields. */
  const [dragDropAiTopicPrompt, setDragDropAiTopicPrompt] = useState<Record<string, string>>({});
  const [interactiveBlockCreation, setInteractiveBlockCreation] = useState<
    null | { pageId: string; insertAt?: number; option: AddBlockOption }
  >(null);
  const isInteractiveCreationType = (t: LessonBlockType) =>
    (INTERACTIVE_TYPES_WITH_CREATION_DIALOG as readonly string[]).includes(t);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newFlashcard, setNewFlashcard] = useState({ front: "", back: "", tags: "" });
  const [newQuizQuestion, setNewQuizQuestion] = useState({
    type: "mcq" as "mcq" | "short" | "exam",
    question: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    explanation: "",
    pageId: "" as string,
  });
  const [isFlashcardsCollapsed, setIsFlashcardsCollapsed] = useState(false);
  const [issuesCalloutDismissed, setIssuesCalloutDismissed] = useState(false);
  const [filterFlashcardsBrokenOnly, setFilterFlashcardsBrokenOnly] = useState(false);
  const [seedFlashcardsLoading, setSeedFlashcardsLoading] = useState(false);
  const [aiAssetsMessage, setAiAssetsMessage] = useState<string | null>(null);
  const [aiAssetsLoading, setAiAssetsLoading] = useState(false);
  /** Optional exam draft generation (default off). */
  const [includeExamInAiAssets, setIncludeExamInAiAssets] = useState(false);
  const [aiReviewPanel, setAiReviewPanel] = useState<{
    lastRunAt: string | null;
    lessonUpdatedAtSnapshot: string | null;
    lastGenerated: { flashcards: number; quizQuestions: number; examQuestions: number } | null;
    pendingDrafts: { flashcards: number; quizQuestions: number; examQuestions: number };
  }>({
    lastRunAt: null,
    lessonUpdatedAtSnapshot: null,
    lastGenerated: null,
    pendingDrafts: { flashcards: 0, quizQuestions: 0, examQuestions: 0 },
  });
  const [seedFlashcardsError, setSeedFlashcardsError] = useState<string | null>(null);
  const [seedFlashcardsSuccess, setSeedFlashcardsSuccess] = useState<string | null>(null);
  const [syncFlashcardsLoading, setSyncFlashcardsLoading] = useState(false);
  const [flashcardsSyncKey, setFlashcardsSyncKey] = useState(0);
  const [syncFlashcardsError, setSyncFlashcardsError] = useState<string | null>(null);
  const [syncFlashcardsSuccess, setSyncFlashcardsSuccess] = useState<string | null>(null);
  const [examBulkText, setExamBulkText] = useState("");
  const [diagramPickerTarget, setDiagramPickerTarget] = useState<{ pageId: string; blockIndex: number } | null>(null);
  const [diagramAssetLibraryEnabled, setDiagramAssetLibraryEnabled] = useState(false);
  const [diagramBriefFromBlockEnabled, setDiagramBriefFromBlockEnabled] = useState(false);
  const [diagramAssetLibraryTarget, setDiagramAssetLibraryTarget] = useState<{
    pageId: string;
    blockIndex: number;
  } | null>(null);
  const [visualsList, setVisualsList] = useState<Array<{ _id: string; conceptKey: string; topic?: string }>>([]);

  const [attachedExamQuestions, setAttachedExamQuestions] = useState<Array<{ _id: string; question: string; type?: string; marks?: number; topicKey?: string; topic?: string }>>([]);
  const [addFromBankModalOpen, setAddFromBankModalOpen] = useState(false);
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomyData } = useTaxonomy(specKey);
  const taxonomyUnits = useMemo(() => Array.isArray(taxonomyData?.units) ? taxonomyData!.units : [], [taxonomyData]);
  const [bankTopicKey, setBankTopicKey] = useState("");
  const [bankQuestions, setBankQuestions] = useState<Array<{ _id: string; question: string; type?: string; marks?: number; topicKey?: string }>>([]);
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<Set<string>>(new Set());
  const [autoAttachLoading, setAutoAttachLoading] = useState(false);
  const [autoAttachLimit, setAutoAttachLimit] = useState(10);
  const [autoAttachMessage, setAutoAttachMessage] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  /** Attached assessment papers (summaries for display) */
  const [attachedPapersSummaries, setAttachedPapersSummaries] = useState<Array<{ _id: string; title: string; kind: string; questionCount: number; timeSeconds?: number; subject?: string; level?: string; examBoard?: string }>>([]);
  const [attachPaperModalOpen, setAttachPaperModalOpen] = useState(false);
  const [attachPageQuizModalOpen, setAttachPageQuizModalOpen] = useState(false);
  const [attachPageQuizModalMode, setAttachPageQuizModalMode] = useState<"published" | "aiDrafts">("published");
  const [attachPageQuizToast, setAttachPageQuizToast] = useState<string | null>(null);
  /** PR20: Publish gate modal + Make classroom-ready + Post-publish CTA */
  const [publishGateOpen, setPublishGateOpen] = useState(false);
  const [publishGateIssues, setPublishGateIssues] = useState<string[]>([]);
  const [postPublishClassroomModalOpen, setPostPublishClassroomModalOpen] = useState(false);
  /** Explicit generator CHECKPOINT MCQ → Self-check (modal import only; no global paste). */
  const [generatorMcqSelfCheckImportOpen, setGeneratorMcqSelfCheckImportOpen] = useState<{
    pageId: string;
    idx: number;
  } | null>(null);
  const [generatorMcqSelfCheckImportText, setGeneratorMcqSelfCheckImportText] = useState("");
  const [generatorMcqSelfCheckImportError, setGeneratorMcqSelfCheckImportError] = useState<string | null>(
    null
  );
  const [selfCheckImportToast, setSelfCheckImportToast] = useState<{
    message: string;
    type: "success" | "warning" | "error";
  } | null>(null);
  /**
   * Self-check MCQ expanded UI was reverted — identifiers kept so partial local merges still typecheck.
   * Not read in current JSX; safe to delete after confirming no references in your branch.
   */
  const [selfCheckMcqOptionsExpanded, setSelfCheckMcqOptionsExpanded] = useState<Record<string, boolean>>({});
  const [addKeyTermDialog, setAddKeyTermDialog] = useState<{
    pageId: string;
    pageTitle: string;
    initialTerm: string;
    blockContext: string;
    blockIndex: number;
    /** Captured at dialog open; used to insert inline marker in that block only. */
    selectionStart: number;
    selectionEnd: number;
  } | null>(null);
  const [suggestKeyTermsDialog, setSuggestKeyTermsDialog] = useState<{
    pageId: string;
    blockIndex: number;
    pageTitle: string;
    textareaKey: string;
  } | null>(null);
  const [makeClassroomReadyLoading, setMakeClassroomReadyLoading] = useState(false);
  const [makeClassroomReadyError, setMakeClassroomReadyError] = useState<string | null>(null);
  /** PR20.1: Copy student link feedback */
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);
  /** PR-014.1: Publish gate for generated content (metadata.generatedFrom.jobId) */
  const [publishGateGeneratedOpen, setPublishGateGeneratedOpen] = useState(false);
  const [publishGateGeneratedResult, setPublishGateGeneratedResult] = useState<PublishGateCheckResponse | null>(null);
  /** AI diagram generation: block key (pageId-blockIndex) when loading */
  const [generateDiagramLoading, setGenerateDiagramLoading] = useState<string | null>(null);
  const [generateDiagramError, setGenerateDiagramError] = useState<string | null>(null);
  /** Content graph: lesson graph + topic coverage for linked content counts */
  const [lessonGraph, setLessonGraph] = useState<{ lessonNode: { _id: string } | null; topicNodes: unknown[] } | null>(null);
  const [topicCoverage, setTopicCoverage] = useState<{ flashcardCount: number; quizCount: number; examQuestionCount: number } | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphRebuilding, setGraphRebuilding] = useState(false);
  const [graphRebuildToast, setGraphRebuildToast] = useState<string | null>(null);

  // State for CSV import
  const [csvImportData, setCsvImportData] = useState<{
    parsedQuestions: QuizQuestion[];
    previewVisible: boolean;
    rowsParsed: number;
    rowsSkipped: number;
  }>({
    parsedQuestions: [],
    previewVisible: false,
    rowsParsed: 0,
    rowsSkipped: 0
  });
  
  // State for mark preview expansion
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());
  /** Open lesson issue reports (status=open) for this lesson */
  const [lessonIssueReports, setLessonIssueReports] = useState<LessonIssueReport[]>([]);
  /** Expanded "View reports" block key: `${pageId}-${blockId}` */
  const [expandedReportsKey, setExpandedReportsKey] = useState<string | null>(null);
  /** Report id being resolved (for loading state) */
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);

  const handleResolveReport = async (reportId: string) => {
    setResolvingReportId(reportId);
    try {
      await updateReportStatus(reportId, "resolved");
      setLessonIssueReports((prev) => prev.filter((r) => r.id !== reportId));
    } catch {
      // Keep report in list on error
    } finally {
      setResolvingReportId(null);
    }
  };

  /** PR11.1: drag-to-position diagram annotations */
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  /** When set, next click on the diagram (for this block) adds a connector from this label to the click point. */
  const [connectorPickTarget, setConnectorPickTarget] = useState<{ pageId: string; blockIndex: number; labelId: string } | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [diagramPreviewUrls, setDiagramPreviewUrls] = useState<Record<string, string>>({});
  /** PR11.2: nudge step 1% | 2% | 5% */
  const [nudgeStepPct, setNudgeStepPct] = useState(2);
  const diagramRef = useRef<Record<string, HTMLDivElement | null>>({});
  /** Ref for "Edit diagram" scroll-into-view (teacher note + affordance) */
  const diagramBlockContainerRef = useRef<Record<string, HTMLDivElement | null>>({});
  const draggingIdRef = useRef<string | null>(null);
  const draggingPageIdRef = useRef<string | null>(null);
  const draggingBlockIndexRef = useRef<number | null>(null);
  /** ai_fallback diagram: container refs keyed by pageId-blockIdx-fb for drag-to-position */
  const fallbackContainerRef = useRef<Record<string, HTMLDivElement | null>>({});
  const fallbackDragRef = useRef<{ pageId: string; blockIdx: number; elementId: string } | null>(null);

  const blockTextareasRef = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const flashcardsSectionRef = useRef<HTMLDivElement | null>(null);

  const userType = (user?.userType || user?.type || "").toString().toLowerCase();
  const isAdmin = userType === "admin";
  const backHref = isAdmin ? "/admin" : "/teacher-dashboard";

  const pageParam = useMemo(
    () => searchParams.get("page") || "",
    [searchParams]
  );

  // Force scroll to top on mount and on lesson/page change (fix: page lands in middle after refresh)
  useEffect(() => {
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const t = setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 300);
    return () => {
      clearTimeout(t);
      window.history.scrollRestoration = prevRestoration;
    };
  }, [id, pageParam]);

  const hasStructuredPages = useMemo(
    () =>
      Boolean(
        lesson?.pages &&
          Array.isArray(lesson.pages) &&
          lesson.pages.length > 0
      ),
    [lesson]
  );

  const orderedPages = useMemo(() => {
    if (!lesson?.pages || !Array.isArray(lesson.pages)) return [];
    return sortPages(lesson.pages);
  }, [lesson]);

  const currentPageIndex = useMemo(() => {
    if (!hasStructuredPages) return 0;
    if (!pageParam) return 0;
    const idxById = orderedPages.findIndex(
      (p) => String(p.pageId) === String(pageParam)
    );
    if (idxById >= 0) return idxById;
    const idxByOrder = orderedPages.findIndex(
      (p) => String(p.order) === String(pageParam)
    );
    if (idxByOrder >= 0) return idxByOrder;
    return 0;
  }, [hasStructuredPages, pageParam, orderedPages]);

  const currentPage = useMemo(() => {
    if (!hasStructuredPages) return null;
    return orderedPages[currentPageIndex] || null;
  }, [hasStructuredPages, orderedPages, currentPageIndex]);

  /** Lesson-wide block ordinals (1…n) for editor chrome — matches generator SS1 numbering. */
  const lessonBlockOrdinalByKey = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const pg of orderedPages) {
      (pg.blocks || []).forEach((_, bi) => {
        n += 1;
        m.set(`${pg.pageId}:${bi}`, n);
      });
    }
    return m;
  }, [orderedPages]);

  /** Group open reports by pageId and blockId for surfacing in editor */
  const { reportsByPage, reportsByBlock, reportsByPageOnly } = useMemo(() => {
    const byPage = new Map<string, number>();
    const byBlock = new Map<string, LessonIssueReport[]>();
    const byPageOnly = new Map<string, LessonIssueReport[]>();
    for (const r of lessonIssueReports) {
      const pid = r.pageId ?? "";
      if (!pid) continue;
      byPage.set(pid, (byPage.get(pid) ?? 0) + 1);
      const bid = r.blockId ?? "";
      if (bid) {
        const key = `${pid}-${bid}`;
        const list = byBlock.get(key) ?? [];
        list.push(r);
        byBlock.set(key, list);
      } else {
        const list = byPageOnly.get(pid) ?? [];
        list.push(r);
        byPageOnly.set(pid, list);
      }
    }
    return { reportsByPage: byPage, reportsByBlock: byBlock, reportsByPageOnly: byPageOnly };
  }, [lessonIssueReports]);

  const flashcards = useMemo(() => lesson?.flashcards || [], [lesson]);
  const quizQuestions = useMemo(() => lesson?.quiz?.questions || [], [lesson]);
  const assessmentQuestions = useMemo(() => lesson?.assessment?.questions || [], [lesson]);

  /** PR-CONTENT-TARGETING-1: namespaced topicKeyForBank — uses taxonomy resolve when lesson.topicKey missing */
  const topicKeyForBank = useResolvedTopicKeyForBank(lesson, taxonomyUnits);

  /** Keep lesson.topicKey in sync with resolved mapping so save/readiness use the repaired key. */
  useEffect(() => {
    if (!topicKeyForBank || !lesson) return;
    const stored = typeof lesson.topicKey === "string" ? lesson.topicKey.trim() : "";
    const needsRepair =
      !stored || isLikelyInvalidTopicSlug(extractTopicSlug(stored)) || stored !== topicKeyForBank;
    if (needsRepair) {
      setLesson((prev) => (prev ? { ...prev, topicKey: topicKeyForBank } : prev));
    }
  }, [topicKeyForBank, lesson?.id]);

  const refreshAiLessonDraftCounts = useCallback(async () => {
    if (!id || !topicKeyForBank) {
      setAiReviewPanel((p) => ({ ...p, pendingDrafts: { flashcards: 0, quizQuestions: 0, examQuestions: 0 } }));
      return;
    }
    const specKey = (lesson as { specKey?: string })?.specKey || topicKeyForBank.split(":")[0];
    const topicKeySlug = topicKeyForBank.includes(":") ? topicKeyForBank.split(":")[1] || topicKeyForBank : topicKeyForBank;
    try {
      const [fc, qq, examRes] = await Promise.all([
        listTopicFlashcards({
          topicKey: topicKeySlug,
          specKey,
          status: "draft",
          mineOnly: !isAdmin,
          metadataSource: "ai_lesson_assets",
          lessonId: id,
          generationType: "flashcard",
        }),
        listTopicQuizQuestions(topicKeySlug, {
          specKey,
          status: "draft",
          mineOnly: !isAdmin,
          kind: "quiz",
          metadataSource: "ai_lesson_assets",
          lessonId: id,
          generationType: "quiz",
        }),
        api.get<{ success?: boolean; questions?: unknown[] }>("/exam-questions", {
          params: {
            topicKey: topicKeySlug,
            specKey,
            status: "draft",
            metadataSource: "ai_lesson_assets",
            lessonId: id,
            generationType: "exam",
            ...(isAdmin ? {} : { mineOnly: "1" }),
          },
        }),
      ]);
      const examList = Array.isArray(examRes?.data?.questions) ? examRes.data!.questions! : [];
      setAiReviewPanel((prev) => ({
        ...prev,
        pendingDrafts: {
          flashcards: fc.length,
          quizQuestions: qq.length,
          examQuestions: examList.length,
        },
      }));
      setCoverageReviewRefreshKey((k) => k + 1);
    } catch {
      setAiReviewPanel((prev) => ({ ...prev, pendingDrafts: { flashcards: 0, quizQuestions: 0, examQuestions: 0 } }));
    }
  }, [id, topicKeyForBank, lesson, isAdmin]);

  useEffect(() => {
    void refreshAiLessonDraftCounts();
  }, [refreshAiLessonDraftCounts]);

  /** Purple review links: show from live bank draft counts (persists across navigation), not only post-generate session state. */
  const hasAiLessonDraftReviewToolbar = useMemo(() => {
    if (!topicKeyForBank || !id || !isMongoObjectId(id)) return false;
    const { flashcards: fc, quizQuestions: qq, examQuestions: ex } = aiReviewPanel.pendingDrafts;
    return fc > 0 || qq > 0 || ex > 0;
  }, [topicKeyForBank, id, aiReviewPanel.pendingDrafts]);

  /** Fetch lesson graph + topic coverage when lesson has topicKey/specKey */
  useEffect(() => {
    if (!id || !topicKeyForBank) {
      setLessonGraph(null);
      setTopicCoverage(null);
      setGraphError(null);
      setGraphLoading(false);
      return;
    }
    const specKey = (lesson as { specKey?: string })?.specKey || topicKeyForBank.split(":")[0];
    const topicKey = topicKeyForBank.includes(":") ? topicKeyForBank.split(":")[1] || topicKeyForBank : topicKeyForBank;
    setGraphLoading(true);
    setGraphError(null);
    Promise.all([
      fetchLessonGraph(id).catch(() => null),
      fetchTopicCoverage(specKey, topicKey).catch(() => null),
    ])
      .then(([graph, coverage]) => {
        setLessonGraph(graph);
        setTopicCoverage(coverage ? { flashcardCount: coverage.flashcardCount, quizCount: coverage.quizCount, examQuestionCount: coverage.examQuestionCount } : null);
        setGraphError(null);
      })
      .catch(() => {
        setGraphError(null);
      })
      .finally(() => setGraphLoading(false));
  }, [id, topicKeyForBank, lesson]);

  const handleRebuildLessonGraph = async () => {
    if (!id || !topicKeyForBank) return;
    setGraphRebuilding(true);
    try {
      await rebuildLessonGraph(id);
      const specKey = (lesson as { specKey?: string })?.specKey || topicKeyForBank.split(":")[0];
      const topicKey = topicKeyForBank.includes(":") ? topicKeyForBank.split(":")[1] || topicKeyForBank : topicKeyForBank;
      const [graph, coverage] = await Promise.all([
        fetchLessonGraph(id).catch(() => null),
        fetchTopicCoverage(specKey, topicKey).catch(() => null),
      ]);
      setLessonGraph(graph);
      setTopicCoverage(coverage ? { flashcardCount: coverage.flashcardCount, quizCount: coverage.quizCount, examQuestionCount: coverage.examQuestionCount } : null);
      setGraphError(null);
      setGraphRebuildToast("Graph updated");
      setTimeout(() => setGraphRebuildToast(null), 2500);
    } catch {
      setGraphError(null);
    } finally {
      setGraphRebuilding(false);
    }
  };

  /**
   * SS1 layout: wide (3 col) / medium (2 col + preview row) / narrow (tabs).
   * Breakpoints use ResizeObserver on the editor shell — not window.innerWidth — so layout reflows
   * from actual container width (browser zoom / ultrawide / future constrained parents behave correctly).
   */
  const [layoutBreakpoint, setLayoutBreakpoint] = useState<"wide" | "medium" | "narrow">("medium");
  /** Mobile & small screens: show either editor chrome + blocks or preview — not both stacked miles apart */
  const [mobileEditorTab, setMobileEditorTab] = useState<"edit" | "preview">("edit");
  /** When set, right preview shows only this block (linked to focused / last-edited block) */
  const [previewFocusBlockIdx, setPreviewFocusBlockIdx] = useState<number | null>(null);
  const editorLayoutShellRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = editorLayoutShellRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      const w = typeof window !== "undefined" ? window.innerWidth : 1200;
      if (w >= EDIT_LESSON_WIDE_MIN_PX) setLayoutBreakpoint("wide");
      else if (w > EDIT_LESSON_NARROW_MAX_PX) setLayoutBreakpoint("medium");
      else setLayoutBreakpoint("narrow");
      return;
    }
    const apply = (width: number) => {
      if (width >= EDIT_LESSON_WIDE_MIN_PX) setLayoutBreakpoint("wide");
      else if (width > EDIT_LESSON_NARROW_MAX_PX) setLayoutBreakpoint("medium");
      else setLayoutBreakpoint("narrow");
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      if (w > 0) apply(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, loading]);

  useEffect(() => {
    fetchLessonSmart();
  }, [id]);

  useEffect(() => {
    setPreviewFocusBlockIdx(null);
  }, [currentPage?.pageId]);

  /** Fetch summaries of attached assessment papers when lesson.assessmentPaperIds changes */
  useEffect(() => {
    const ids = lesson?.assessmentPaperIds;
    if (!ids?.length) {
      setAttachedPapersSummaries([]);
      return;
    }
    let cancelled = false;
    Promise.all(ids.map((paperId) => api.get(`/assessment-papers/${paperId}`).then((r: any) => r.data?.paper ?? r.data)))
      .then((papers) => {
        if (cancelled) return;
        setAttachedPapersSummaries(
          papers
            .filter(Boolean)
            .map((p: any) => ({
              _id: String(p._id),
              title: p.title || "Untitled",
              kind: p.kind || "practice_set",
              questionCount: (p.items?.length ?? 0) + (p.questionBankIds?.length ?? 0),
              timeSeconds: p.timeSeconds,
              subject: p.subject,
              level: p.level,
              examBoard: p.examBoard ?? p.board,
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setAttachedPapersSummaries([]);
      });
    return () => { cancelled = true; };
  }, [lesson?.assessmentPaperIds]);

  // Disabled on initial mount — focus caused mid-page scroll; force top on first load instead
  // useEffect(() => {
  //   if (lesson?.createdFromTemplate && titleRef.current) {
  //     titleRef.current.focus();
  //   }
  // }, [lesson?.createdFromTemplate]);

  useEffect(() => {
    if (!diagramPickerTarget) {
      setVisualsList([]);
      return;
    }
    listVisuals("Biology")
      .then((res: any) => {
        const list = Array.isArray(res?.data?.visuals) ? res.data.visuals : [];
        setVisualsList(list.map((v: any) => ({ _id: String(v._id), conceptKey: String(v.conceptKey || ""), topic: v.topic })));
      })
      .catch(() => setVisualsList([]));
  }, [diagramPickerTarget]);

  useEffect(() => {
    const ut = (user?.userType || (user as { type?: string })?.type || "").toString().toLowerCase();
    const isTeacherOrAdmin = ut === "teacher" || ut === "admin";
    if (!token || !isTeacherOrAdmin) {
      setDiagramAssetLibraryEnabled(false);
      return;
    }
    let cancelled = false;
    getDiagramAssetLibraryEnabled()
      .then((enabled) => {
        if (!cancelled) setDiagramAssetLibraryEnabled(enabled);
      })
      .catch(() => {
        if (!cancelled) setDiagramAssetLibraryEnabled(false);
      });
    getDiagramBriefFromBlockEnabled()
      .then((enabled) => {
        if (!cancelled) setDiagramBriefFromBlockEnabled(enabled);
      })
      .catch(() => {
        if (!cancelled) setDiagramBriefFromBlockEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user]);

  useEffect(() => {
    if (!id || !lesson) return;
    api.get(`/lessons/${id}/exam-questions`).then((res: any) => {
      setAttachedExamQuestions(Array.isArray(res?.data?.questions) ? res.data.questions : []);
    }).catch(() => setAttachedExamQuestions([]));
  }, [id, lesson?.id]);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setBankTopicKey("");
  };

  useEffect(() => {
    if (!addFromBankModalOpen) return;
    if (!bankTopicKey) {
      setBankQuestions([]);
      return;
    }
    api.get("/exam-questions", { params: { topicKey: bankTopicKey } }).then((res: any) => {
      setBankQuestions(Array.isArray(res?.data?.questions) ? res.data.questions : []);
      setSelectedBankQuestionIds(new Set());
    }).catch(() => setBankQuestions([]));
  }, [addFromBankModalOpen, bankTopicKey]);

  /** Fetch open lesson issue reports when editing a lesson */
  useEffect(() => {
    if (!id) return;
    listReports({ lessonId: id, status: "open" })
      .then((res) => setLessonIssueReports(res.reports || []))
      .catch(() => setLessonIssueReports([]));
  }, [id]);

  /** Persist sequenceSteps parsed from intro/content when legacy exports left steps only in HTML. */
  useEffect(() => {
    if (!lesson?.id || !Array.isArray(lesson.pages)) return;
    const { pages, changed } = applyInteractiveSequenceHydrationToPages(lesson.pages);
    if (!changed) {
      interactiveSequenceHydratedLessonIdRef.current = lesson.id;
      return;
    }
    if (interactiveSequenceHydratedLessonIdRef.current === lesson.id) return;
    interactiveSequenceHydratedLessonIdRef.current = lesson.id;
    setLesson((prev) => (prev ? { ...prev, pages } : prev));
  }, [lesson?.id, lesson?.pages]);

  useEffect(() => {
    curriculumAiReviewFeatureRef.current = curriculumAiReviewFeature === true;
  }, [curriculumAiReviewFeature]);

  /** Probe GET /curriculum-ai-review: feature flag + refresh running/completed snapshot */
  useEffect(() => {
    if (!id || !isMongoObjectId(id) || !lesson || String(lesson.id) !== String(id)) return;
    let cancelled = false;
    (async () => {
      try {
        const { curriculumAiReview } = await getCurriculumAiReview(id);
        if (cancelled) return;
        setCurriculumAiReviewFeature(true);
        setLesson((prev) =>
          prev && String(prev.id) === String(id)
            ? { ...prev, curriculumAiReview: curriculumAiReview ?? prev.curriculumAiReview }
            : prev
        );
      } catch (e: unknown) {
        if (cancelled) return;
        const st = (e as { response?: { status?: number } })?.response?.status;
        if (st === 404) setCurriculumAiReviewFeature(false);
        else setCurriculumAiReviewFeature(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, lesson?.id]);

  /** Deep links (e.g. from Create Lesson sidebar) — scroll to #revision-materials, #edit-lesson-practice-lane, etc. */
  useEffect(() => {
    if (loading || !lesson) return;
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw) return;
    const t = window.setTimeout(() => {
      const el = document.getElementById(raw);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [loading, lesson?.id, location.hash]);

  const fetchLessonSmart = async () => {
    try {
      setLoading(true);
      setError("");
      setSaveMsg("");

      if (!id) {
        setError("Lesson id missing");
        return;
      }

      if (isMongoObjectId(id)) {
        await fetchLessonFromBackend(id);
        return;
      }

      if (isUuid(id)) {
        await fetchLessonFromSupabase(id);
        return;
      }

      setError("Invalid lesson id format");
    } catch (err: any) {
      console.error("Error loading lesson:", err);
      setError(err?.message || "Failed to load lesson");
    } finally {
      setLoading(false);
    }
  };

  const fetchLessonFromBackend = async (lessonId: string) => {
    try {
      let data: any = null;
      if (isAdmin) {
        try {
          const resAdmin = await api.get(`/admin/lessons/${lessonId}`);
          data = resAdmin?.data?.lesson || resAdmin?.data || null;
        } catch {}
      }

      if (!data) {
        const res = await api.get(`/lessons/${lessonId}`);
        data = res?.data || null;
      }

      if (!data) {
        setError("Lesson not found");
        return;
      }

      const rawNotes = safeStr(data.content, "");
      const description =
        safeStr(data.description, "") ||
        (rawNotes.trim()
          ? rawNotes.trim().slice(0, 220) +
            (rawNotes.trim().length > 220 ? "…" : "")
          : "—");

      const lessonForTopicNorm = {
        topicKey: typeof data.topicKey === "string" ? data.topicKey.trim() : undefined,
        canonicalTopicKey:
          typeof data.canonicalTopicKey === "string"
            ? data.canonicalTopicKey.trim()
            : typeof data.metadata?.canonicalTopicKey === "string"
              ? String(data.metadata.canonicalTopicKey).trim()
              : undefined,
        specKey: typeof data.specKey === "string" ? data.specKey.trim() : undefined,
        topic: safeStr(data.topic, ""),
        subTopic: safeStr(data.subTopic, ""),
        title: safeStr(data.title, ""),
        subject: safeStr(data.subject, ""),
        examBoardName: (data.examBoard ?? data.board) ? safeStr((data.examBoard ?? data.board) as string, "") : null,
        level: safeStr(data.level, ""),
      };
      const topicNorm = normalizeLessonTopicSlugFromLesson(lessonForTopicNorm, taxonomyUnits);

      const mapped: Lesson = {
        id: safeStr(data._id || data.id || lessonId, lessonId),
        title: safeStr(data.title, "Untitled Lesson"),
        description,
        content: rawNotes.trim() ? rawNotes : "No lesson content yet.",
        subject: safeStr(data.subject, "Not set"),
        level: safeStr(data.level, "Not set"),
        topic: safeStr(data.topic, "Not set"),
        subTopic: safeStr(data.subTopic, "") || undefined,
        specKey: lessonForTopicNorm.specKey,
        topicKey: topicNorm.namespaced ?? lessonForTopicNorm.topicKey,
        examBoardName: (data.examBoard ?? data.board) ? safeStr((data.examBoard ?? data.board) as string, "") : null,
        teacherName: safeStr(data.teacherName, "Teacher"),
        teacherId: safeStr(data.teacherId?._id || data.teacherId, ""),
        estimatedDuration: Number.isFinite(Number(data.estimatedDuration))
          ? Number(data.estimatedDuration)
          : 0,
        isFreePreview: Boolean(data.isFreePreview),
        isPublished: Boolean(data.isPublished),
        status:
          typeof data.status === "string"
            ? data.status
            : data.isPublished
              ? "published"
              : "draft",
        curriculumAiReview: data.curriculumAiReview ?? undefined,
        views: Number.isFinite(Number(data.views)) ? Number(data.views) : 0,
        averageRating: Number.isFinite(Number(data.averageRating))
          ? Number(data.averageRating)
          : 0,
        totalRatings: Number.isFinite(Number(data.totalRatings))
          ? Number(data.totalRatings)
          : 0,
        createdAt: safeStr(data.createdAt, new Date().toISOString()),
        pages: Array.isArray(data.pages) ? data.pages : [],
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
        quiz: data.quiz || { timeSeconds: 600, questions: [] },
        createdFromTemplate: Boolean(data.createdFromTemplate),
        readiness: data.readiness ?? undefined,
        reviewedAt: data.reviewedAt ?? undefined,
        reviewedBy: data.reviewedBy ?? undefined,
        tier: typeof data.tier === "string" ? data.tier : undefined,
        assessmentPaperIds: Array.isArray(data.assessmentPaperIds)
          ? data.assessmentPaperIds.map((id: any) => String(id))
          : [],
        assessment: data.assessment ?? undefined,
        pastPapers: Array.isArray(data.pastPapers) ? data.pastPapers : undefined,
        metadata: data.metadata ?? undefined,
      };

      if (Array.isArray(mapped.pages)) {
        mapped.pages = mapped.pages.map((p, idx) => ({
          pageId: safeStr((p as any).pageId, newId()),
          title: safeStr((p as any).title, `Page ${idx + 1}`),
          order: Number.isFinite(Number((p as any).order))
            ? Number((p as any).order)
            : idx + 1,
          pageType: (p as any).pageType,
          hero: (p as any).hero
            ? (p as any).hero
            : { type: "none", src: "", caption: "" },
          blocks: Array.isArray((p as any).blocks)
            ? (p as any).blocks.map((b: any) => {
                if (b?.type === "checkpoint") {
                  const out = {
                    type: "checkpoint" as const,
                    prompt: safeStr(b.prompt, ""),
                    questionType: b?.questionType === "short" ? "short" : "mcq",
                    options: [...coerceLessonMcqOptionsFour(b.options)],
                    correctAnswer: safeStr(b.correctAnswer, ""),
                    explanation: safeStr(b.explanation, ""),
                  } as Record<string, unknown>;
                  if (Array.isArray(b.markScheme)) {
                    const ms = b.markScheme.map((x: any) => String(x ?? "").trim()).filter(Boolean);
                    if (ms.length) out.markScheme = ms;
                  }
                  if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
                  return out;
                }
                if (normalizeBlockType(String(b?.type ?? "")) === "selfCheck") {
                  /** Editor + student render `prompt`; DB may store stem in `question` only (pageQuiz-parity fields). */
                  const mergedStem = safeStr(b.prompt, safeStr((b as { question?: string }).question, ""));
                  const out = {
                    type: "selfCheck" as const,
                    prompt: mergedStem,
                    questionType: b?.questionType === "short" ? "short" : "mcq",
                    options:
                      b?.questionType === "short"
                        ? Array.isArray(b.options)
                          ? b.options.map((o: any) => String(o ?? ""))
                          : ["", "", "", ""]
                        : [...coerceLessonMcqOptionsFour(b.options)],
                    correctAnswer: safeStr(b.correctAnswer, ""),
                    explanation: safeStr(b.explanation, ""),
                  } as Record<string, unknown>;
                  if (Array.isArray(b.markScheme)) {
                    const ms = b.markScheme.map((x: any) => String(x ?? "").trim()).filter(Boolean);
                    if (ms.length) out.markScheme = ms;
                  }
                  if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
                  return out;
                }
                if (b?.type === "diagram") {
                  const mode = b.mode === "annotated" || b.mode === "step" ? b.mode : "static";
                  const role = typeof b?.role === "string" && b.role.trim() ? b.role.trim() : undefined;
                  const annotations = Array.isArray(b.annotations) ? b.annotations.map((a: any) => ({
                    id: String(a?.id ?? ""),
                    kind: a?.kind === "callout" ? "callout" : "label",
                    text: typeof a?.text === "string" ? a.text : "",
                    x: typeof a?.x === "number" ? a.x : 0.5,
                    y: typeof a?.y === "number" ? a.y : 0.5,
                    color: typeof a?.color === "string" ? a.color : "",
                    align: a?.align === "left" || a?.align === "right" ? a.align : "center",
                  })) : [];
                  const steps = Array.isArray(b.steps) ? b.steps.map((s: any) => ({
                    id: String(s?.id ?? ""),
                    title: typeof s?.title === "string" ? s.title : "",
                    showAnnotationIds: Array.isArray(s?.showAnnotationIds) ? s.showAnnotationIds.map((id: any) => String(id)) : [],
                  })) : [];
                  const connectors = Array.isArray(b.connectors) ? b.connectors.map((c: any) => ({
                    id: String(c?.id ?? ""),
                    labelId: String(c?.labelId ?? ""),
                    x: typeof c?.x === "number" ? c.x : 0.5,
                    y: typeof c?.y === "number" ? c.y : 0.5,
                  })).filter((c) => c.id && c.labelId) : [];
                  return {
                    ...b,
                    type: "diagram" as const,
                    visualId: b.visualId != null ? String(b.visualId) : "",
                    caption: safeStr(b.caption, ""),
                    title: safeStr(b.title, "") || undefined,
                    subtitle: diagramAuthoringInstructionsForEditor(b),
                    studentTask: diagramAuthoringStudentTaskForEditor(b),
                    intro: safeStr(b.intro, "") || undefined,
                    note: safeStr(b.note, "") || undefined,
                    mode,
                    annotations,
                    steps,
                    connectors: connectors.length ? connectors : undefined,
                    imageUrl: b.imageUrl != null ? String(b.imageUrl).trim() || undefined : undefined,
                    imageSource: b.imageSource != null ? String(b.imageSource).trim() || undefined : undefined,
                    diagramAssetId:
                      b.diagramAssetId != null ? String(b.diagramAssetId).trim() || undefined : undefined,
                    alt: b.alt != null ? String(b.alt).trim() || undefined : undefined,
                    ...(role && { role }),
                  };
                }
                if (blockLooksLikeInteractiveSequence(b as Record<string, unknown>)) {
                  return normalizeInteractiveSequenceBlockForEditor(
                    b as Record<string, unknown>
                  ) as typeof b;
                }
                if (normalizeBlockType(String(b?.type ?? "")) === "interactiveDiagram") {
                  const rawH = Array.isArray(b.hotspots) ? b.hotspots : [];
                  const hotspots = rawH.map((h: any, i: number) =>
                    normalizeInteractiveDiagramHotspot(h, i)
                  );
                  const notePersisted = blockNoteForPersist(b.note);
                  const outId: Record<string, unknown> = {
                    type: "interactiveDiagram" as const,
                    content: "",
                    title: safeStr(b.title, ""),
                    intro: safeStr(b.intro, ""),
                    imageUrl: b.imageUrl != null ? String(b.imageUrl).trim() : "",
                    hotspots,
                    ...(notePersisted ? { note: notePersisted } : {}),
                  };
                  if (typeof b?.role === "string" && b.role.trim()) outId.role = b.role.trim();
                  return outId;
                }
                if (normalizeBlockType(String(b?.type ?? "")) === "dragDropMatch") {
                  const rawPairs = Array.isArray(b.pairs) ? b.pairs : [];
                  const pairs = rawPairs
                    .map((row: any, ri: number) => {
                      const n = normalizeDragDropPairRow(row, ri, newId());
                      if (!n) return null;
                      return {
                        ...n,
                        explanation: n.explanation != null ? String(n.explanation) : "",
                      };
                    })
                    .filter(Boolean) as Array<{
                      id: string;
                      prompt: string;
                      answer: string;
                      explanation: string;
                      answerImageUrl?: string;
                      imageUrl?: string;
                      imageAlt?: string;
                    }>;
                  const pairIdsForZones = pairs.map((r: { id: string }) => r.id);
                  const rawZones = Array.isArray((b as { dropZones?: unknown }).dropZones)
                    ? (b as { dropZones: unknown[] }).dropZones
                    : [];
                  const dropZonesSan = sanitizeDiagramDropZonesForAuthoring(rawZones, pairIdsForZones);
                  const resolvedHydrate = resolveDragDropPersistMode(b);
                  const ddmNote = blockNoteForPersist(b.note);
                  const outDdm: Record<string, unknown> = {
                    type: "dragDropMatch" as const,
                    content: "",
                    title: safeStr(b.title, ""),
                    intro: safeStr(b.intro, ""),
                    instructions: safeStr(b.instructions, ""),
                    pairs,
                    ...(ddmNote ? { note: ddmNote } : {}),
                  };
                  if (resolvedHydrate === "diagram") {
                    const stored = dragDropLayoutPersistedValues("diagram");
                    outDdm.matchMode = stored.matchMode;
                    outDdm.dragDropLayout = stored.dragDropLayout;
                    const img = (b as { imageUrl?: unknown }).imageUrl;
                    outDdm.imageUrl = typeof img === "string" ? img.trim() : "";
                    outDdm.dropZones = dropZonesSan;
                  } else if (resolvedHydrate === "text") {
                    const stored = dragDropLayoutPersistedValues("text");
                    outDdm.matchMode = stored.matchMode;
                    outDdm.dragDropLayout = stored.dragDropLayout;
                  } else if (resolvedHydrate === "text-to-image") {
                    const stored = dragDropLayoutPersistedValues("text-to-image");
                    outDdm.matchMode = stored.matchMode;
                    outDdm.dragDropLayout = stored.dragDropLayout;
                    const imgTti = readDragDropBlockMainImageUrl(b);
                    if (imgTti) outDdm.imageUrl = imgTti;
                  }
                  if (typeof b?.role === "string" && b.role.trim()) outDdm.role = b.role.trim();
                  return outDdm;
                }
                if (resolveLessonDisplayBlockType(b) === "graph") {
                  return normalizeGraphBlockForDisplay(b);
                }
                /** Recover blocks mis-saved as `text` while `pairs` survived (legacy client/API mismatch). */
                const nbForRepair = normalizeBlockType(String(b?.type ?? ""));
                const pairsForRepair = Array.isArray((b as any)?.pairs) ? (b as any).pairs : [];
                if (
                  nbForRepair === "text" &&
                  pairsForRepair.length >= 1 &&
                  pairsForRepair.some(
                    (row: any) =>
                      row &&
                      typeof row === "object" &&
                      (String(row?.prompt ?? "").trim() || String(row?.answer ?? "").trim())
                  )
                ) {
                  const pairs = pairsForRepair
                    .map((row: any, ri: number) => {
                      const n = normalizeDragDropPairRow(row, ri, newId());
                      if (!n) return null;
                      return {
                        ...n,
                        explanation: n.explanation != null ? String(n.explanation) : "",
                      };
                    })
                    .filter(Boolean);
                  const pairIdsRepair = pairs.map((r: { id: string }) => r.id);
                  const rawZonesRepair = Array.isArray((b as any).dropZones) ? (b as any).dropZones : [];
                  const dropZonesRepair = sanitizeDiagramDropZonesForAuthoring(rawZonesRepair, pairIdsRepair);
                  const resolvedRepair = resolveDragDropPersistMode(b);
                  const repaired: Record<string, unknown> = {
                    type: "dragDropMatch" as const,
                    content: "",
                    title: safeStr(b.title, ""),
                    intro: safeStr(b.intro, ""),
                    instructions: safeStr((b as any).instructions, ""),
                    pairs,
                    ...(blockNoteForPersist((b as { note?: string }).note)
                      ? { note: blockNoteForPersist((b as { note?: string }).note) }
                      : {}),
                  };
                  if (resolvedRepair === "diagram") {
                    const stored = dragDropLayoutPersistedValues("diagram");
                    repaired.matchMode = stored.matchMode;
                    repaired.dragDropLayout = stored.dragDropLayout;
                    const imgR = (b as any).imageUrl;
                    repaired.imageUrl = typeof imgR === "string" ? imgR.trim() : "";
                    repaired.dropZones = dropZonesRepair;
                  } else if (resolvedRepair === "text") {
                    const stored = dragDropLayoutPersistedValues("text");
                    repaired.matchMode = stored.matchMode;
                    repaired.dragDropLayout = stored.dragDropLayout;
                  } else if (resolvedRepair === "text-to-image") {
                    const stored = dragDropLayoutPersistedValues("text-to-image");
                    repaired.matchMode = stored.matchMode;
                    repaired.dragDropLayout = stored.dragDropLayout;
                    const imgTtiR = readDragDropBlockMainImageUrl(b);
                    if (imgTtiR) repaired.imageUrl = imgTtiR;
                  }
                  if (typeof b?.role === "string" && b.role.trim()) repaired.role = b.role.trim();
                  return repaired;
                }
                const out: Record<string, unknown> = {
                  type: normalizeBlockType(b?.type),
                  content: safeStr(b?.content, ""),
                };
                if (typeof b?.title === "string" && b.title.trim()) out.title = b.title.trim();
                if (typeof b?.role === "string" && b.role.trim()) out.role = b.role.trim();
                return out;
              })
            : [{ type: "text", content: "" }],
          checkpoint: (() => {
            const rawCp = (p as any).checkpoint;
            if (!rawCp) {
              return { question: "", options: ["", "", "", ""], answer: "", explanation: "" };
            }
            const cpType = rawCp.type === "shortExplain" || rawCp.type === "mcq" ? rawCp.type : undefined;
            return {
              question: safeStr(rawCp.question, ""),
              options: Array.isArray(rawCp.options) ? rawCp.options : ["", "", "", ""],
              answer: safeStr(rawCp.answer, ""),
              explanation: safeStr(rawCp.explanation, ""),
              ...(Array.isArray(rawCp.markScheme)
                ? {
                    markScheme: rawCp.markScheme.map((x: any) => String(x ?? "").trim()).filter(Boolean),
                  }
                : {}),
              ...(cpType ? { type: cpType } : {}),
            };
          })(),
          metadata:
            (p as any).metadata && typeof (p as any).metadata === "object" ? (p as any).metadata : undefined,
        }));
        mapped.pages = promoteHeroOnPages(
          mapped.pages as unknown as Parameters<typeof promoteHeroOnPages>[0]
        ) as unknown as typeof mapped.pages;
        const { pages: hydratedPages, changed: seqHydrated } =
          applyInteractiveSequenceHydrationToPages(
            mapped.pages as Array<{ blocks?: unknown[] }>
          );
        if (seqHydrated) {
          mapped.pages = hydratedPages as typeof mapped.pages;
        }
      }

      setLesson(mapped);

      if (mapped.pages && mapped.pages.length > 0) {
        const ordered = sortPages(mapped.pages);
        const first = ordered[0];
        const current = searchParams.get("page");
        if (!current && first?.pageId) {
          setSearchParams({ page: String(first.pageId) }, { replace: true });
        }
      }
    } catch (err: any) {
      console.error("Backend lesson fetch error:", err);
      setError(err?.message || "Failed to load lesson");
    }
  };

  const fetchLessonFromSupabase = async (lessonId: string) => {
    try {
      const { data, error } = await supabase
        .from("lessons")
        .select(
          `
            id,
            title,
            subject,
            level,
            stage,
            years,
            lesson_notes,
            teacher_id,
            is_published,
            created_at,
            exam_board:exam_boards(name)
          `
        )
        .eq("id", lessonId)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        setError(error.message || "Failed to load lesson");
        return;
      }

      const examBoardName = getBoardName((data as any)?.exam_board);
      const rawNotes = safeStr((data as any)?.lesson_notes, "");
      const resolvedContent = rawNotes.trim() || "No lesson content yet.";
      const resolvedDescription = rawNotes.trim()
        ? rawNotes.trim().slice(0, 220) +
          (rawNotes.trim().length > 220 ? "…" : "")
        : "—";

      const mapped: Lesson = {
        id: safeStr((data as any)?.id, ""),
        title: safeStr((data as any)?.title, "Untitled Lesson"),
        subject: safeStr((data as any)?.subject, "Not set"),
        level: safeStr((data as any)?.level, "Not set"),
        topic: "Not set",
        examBoardName: examBoardName ?? null,
        description: resolvedDescription,
        content: resolvedContent,
        teacherName: "Teacher",
        teacherId: safeStr((data as any)?.teacher_id, ""),
        estimatedDuration: 0,
        isFreePreview: false,
        isPublished: Boolean((data as any)?.is_published),
        views: 0,
        averageRating: 0,
        totalRatings: 0,
        createdAt: safeStr((data as any)?.created_at, new Date().toISOString()),
        pages: [],
        createdFromTemplate: false,
      };

      setLesson(mapped);
    } catch (err: any) {
      console.error("Error fetching lesson from Supabase:", err);
      setError("Failed to load lesson");
    }
  };

  const cleanupBadQuizEntries = () => {
    setLesson((prev: any) => {
      if (!prev) return prev;
      const prevQuiz = prev.quiz || { timeSeconds: 600, questions: [] };
      const prevQs = Array.isArray(prevQuiz.questions) ? prevQuiz.questions : [];

      const cleaned = prevQs.filter((q: any) => {
        const text = String(q?.question ?? "").trim();
        if (!text) return false;

        if (/^ANSWER\s*:/i.test(text)) return false;
        if (/^MARKS\s*:/i.test(text)) return false;
        if (/^TYPE\s*:/i.test(text)) return false;
        if (/^TAGS\s*:/i.test(text)) return false;
        if (/^MARKSCHEME\s*:/i.test(text)) return false;

        return true;
      });

      return {
        ...prev,
        quiz: {
          ...prevQuiz,
          questions: cleaned,
        },
      };
    });
  };

  const goToPage = (p: LessonPage) => {
    if (!p?.pageId) return;
    setSearchParams({ page: String(p.pageId) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateLessonField = (key: keyof Lesson, value: unknown) => {
    setLesson((prev) => {
      if (!prev) return prev;
      if (Object.is(prev[key], value)) return prev;
      return { ...prev, [key]: value };
    });
  };

  const updatePage = (pageId: string, patch: Partial<LessonPage>) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const idx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (idx < 0) return prev;
      pages[idx] = { ...pages[idx], ...patch };
      return { ...prev, pages };
    });
  };

  /**
   * Add key term → glossary: updates **only** `lesson.pages[pageId].metadata.contentKeywords`.
   * Never writes `lesson.metadata.contentKeywords`. Persisted on the next Save (PUT) via
   * `getLessonPersistPayload` → `sanitizedPages` = `{ ...p, blocks, ... }` which keeps `metadata`.
   */
  /**
   * Glossary (metadata) + optional inline wrap at the selection captured when the dialog was opened.
   * No auto-insert if there was no selection, or the slice is already a key-term span.
   */
  const addPageKeyTermWithOptionalInline = (
    pageId: string,
    term: string,
    definition: string,
    inline: { blockIndex: number; selectionStart: number; selectionEnd: number } | null
  ) => {
    const t = term.trim();
    if (!t) return;
    const defTrim = definition.trim();
    setLesson((prev) => {
      if (!prev?.pages) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) => {
          if (String(p.pageId) !== String(pageId)) return p;
          const rawMeta = (p as LessonPage).metadata;
          const meta =
            rawMeta && typeof rawMeta === "object" ? { ...rawMeta } : ({} as LessonPage["metadata"]);
          const list = Array.isArray(meta?.contentKeywords) ? [...meta.contentKeywords!] : [];
          const low = t.toLowerCase();
          const fi = list.findIndex((x) => String(x?.term ?? "").toLowerCase() === low);
          const item: { term: string; definition?: string } = { term: t };
          if (defTrim) item.definition = defTrim;
          if (fi >= 0) list[fi] = { ...list[fi], ...item };
          else list.push(item);
          let next: LessonPage = {
            ...p,
            metadata: { ...meta, contentKeywords: list },
          } as LessonPage;
          if (inline) {
            const { blockIndex, selectionStart, selectionEnd } = inline;
            const lo = Math.min(selectionStart, selectionEnd);
            const hi = Math.max(selectionStart, selectionEnd);
            if (lo < hi) {
              const blocks = Array.isArray(next.blocks) ? [...(next.blocks as any[])] : [];
              if (blockIndex >= 0 && blockIndex < blocks.length) {
                const block = blocks[blockIndex] as { content?: string; [k: string]: unknown };
                const content = String(block?.content ?? "");
                if (lo <= content.length && hi <= content.length) {
                  const slice = content.slice(lo, hi);
                  if (
                    !/data-key-term\s*=/i.test(slice) &&
                    !/<\s*span[^>]+data-key-term/i.test(slice) &&
                    !selectionIntersectsDataKeyTermSpan(content, lo, hi)
                  ) {
                    const inner = buildKeyTermSpanHtml(t, slice);
                    if (inner) {
                      const nextContent = content.slice(0, lo) + inner + content.slice(hi);
                      blocks[blockIndex] = { ...block, content: nextContent };
                      next = { ...next, blocks } as LessonPage;
                    }
                  }
                }
              }
            }
          }
          return next;
        }),
      };
    });
    setSaveMsg("Key term added. Click Save Changes to publish it.");
    setTimeout(() => setSaveMsg(""), 9000);
  };

  /** AI “Suggest key terms”: merge metadata + wrap first unmarked occurrence per row in the current block. */
  const applyBulkSuggestedKeyTerms = (pageId: string, blockIndex: number, items: SuggestedKeyTermRow[]) => {
    if (!items.length) return;
    setLesson((prev) => {
      if (!prev?.pages) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) => {
          if (String(p.pageId) !== String(pageId)) return p;
          const rawMeta = (p as LessonPage).metadata;
          const meta =
            rawMeta && typeof rawMeta === "object" ? { ...rawMeta } : ({} as LessonPage["metadata"]);
          let list = Array.isArray(meta?.contentKeywords) ? [...meta.contentKeywords!] : [];
          for (const it of items) {
            const t = it.term.trim();
            if (!t) continue;
            const defTrim = it.definition.trim();
            const low = t.toLowerCase();
            const fi = list.findIndex((x) => String(x?.term ?? "").toLowerCase() === low);
            const kwItem: { term: string; definition?: string } = { term: t };
            if (defTrim) kwItem.definition = defTrim;
            if (fi >= 0) list[fi] = { ...list[fi], ...kwItem };
            else list.push(kwItem);
          }
          const blocks = Array.isArray(p.blocks) ? [...(p.blocks as any[])] : [];
          if (blockIndex < 0 || blockIndex >= blocks.length) {
            return { ...p, metadata: { ...meta, contentKeywords: list } } as LessonPage;
          }
          const block = blocks[blockIndex] as { content?: string; [k: string]: unknown };
          const before = String(block?.content ?? "");
          const { nextContent, notFoundTerms } = applyKeyTermsToBlockContent(before, items);
          blocks[blockIndex] = { ...block, content: nextContent };
          const nextPage = { ...p, metadata: { ...meta, contentKeywords: list }, blocks } as LessonPage;
          queueMicrotask(() => {
            if (notFoundTerms.length > 0) {
              setSaveMsg(
                `Added definition, but could not mark term in text: ${notFoundTerms.join(", ")}. Click Save Changes to publish.`
              );
            } else {
              setSaveMsg("Key terms added. Click Save Changes to publish.");
            }
            setTimeout(() => setSaveMsg(""), 12000);
          });
          return nextPage;
        }),
      };
    });
  };

  const updateBlock = (
    pageId: string,
    blockIndex: number,
    patch: Partial<LessonPageBlock>,
    applyOpts?: {
      onApplied?: (info: {
        pageIndex: number;
        blockIndex: number;
        blockBefore: unknown;
        nextBlock: unknown;
      }) => void;
    }
  ) => {
    const guarded = guardLessonBlockPatchForDuplicatePaste(patch as Record<string, unknown>, {
      mode: "live",
    });
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      if (blockIndex < 0 || blockIndex >= blocks.length) return prev;
      const blockBefore = blocks[blockIndex];
      const nextBlock = { ...blocks[blockIndex], ...guarded };
      blocks[blockIndex] = nextBlock;
      pages[pIdx] = { ...pages[pIdx], blocks };
      applyOpts?.onApplied?.({
        pageIndex: pIdx,
        blockIndex,
        blockBefore,
        nextBlock,
      });
      return { ...prev, pages };
    });
  };

  /** PR11.1: clamp number to [min, max] */
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  /** PR11.1: get normalized 0..1 point from pointer/mouse event relative to container */
  const getNormalizedPointFromEvent = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  };
  /** PR11.1: update one annotation's x/y (or other fields) in a diagram block */
  const updateDiagramAnnotation = (
    pageId: string,
    blockIndex: number,
    annId: string,
    patch: Partial<{ x: number; y: number }>
  ) => {
    const clamp01 = (v: number) => clamp(v, 0, 1);
    setLesson((prev) => {
      if (!prev?.pages) return prev;
      const pages = prev.pages.map((p) => ({ ...p }));
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const page = pages[pIdx];
      const blocks = Array.isArray(page.blocks) ? [...page.blocks] : [];
      const block = blocks[blockIndex];
      if (!block || block.type !== "diagram" || !Array.isArray(block.annotations)) return prev;
      const annotations = block.annotations.map((a) => {
        if (a.id !== annId) return a;
        const next = { ...a };
        if (typeof patch.x === "number") next.x = clamp01(patch.x);
        if (typeof patch.y === "number") next.y = clamp01(patch.y);
        return next;
      });
      blocks[blockIndex] = { ...block, annotations };
      pages[pIdx] = { ...page, blocks };
      return { ...prev, pages };
    });
  };

  /** PR11.2: reduce overlap between annotations (normalized 0..1), returns new array */
  const autoSpreadAnnotations = (
    anns: Array<{ id: string; text?: string; x?: number; y?: number; [k: string]: unknown }>
  ): Array<{ id: string; text?: string; x?: number; y?: number; [k: string]: unknown }> => {
    const out = anns.map((a) => ({ ...a, x: typeof a.x === "number" ? a.x : 0.5, y: typeof a.y === "number" ? a.y : 0.5 }));
    const clamp01 = (v: number) => clamp(v, 0, 1);
    const dist2 = (i: number, j: number) => {
      const dx = out[i].x! - out[j].x!;
      const dy = out[i].y! - out[j].y!;
      return dx * dx + dy * dy;
    };
    for (let iter = 0; iter < 20; iter++) {
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          if (dist2(i, j) >= 0.003) continue;
          const dx = out[i].x! - out[j].x!;
          const dy = out[i].y! - out[j].y!;
          const push = 0.01;
          out[i].x = clamp01(out[i].x! + push * dx);
          out[i].y = clamp01(out[i].y! + push * dy);
          out[j].x = clamp01(out[j].x! - push * dx);
          out[j].y = clamp01(out[j].y! - push * dy);
        }
      }
    }
    return out;
  };

  /** PR11.1: fetch diagram image URLs for blocks that have visualId */
  useEffect(() => {
    if (!lesson?.pages) return;
    const level = lesson?.level ?? "GCSE";
    let cancelled = false;
    (async () => {
      for (const page of lesson.pages ?? []) {
        for (const b of page.blocks ?? []) {
          if (b?.type !== "diagram" || !b.visualId) continue;
          const vid = String(b.visualId);
          if (diagramPreviewUrls[vid]) continue;
          try {
            const res = await getVisualById(vid, level);
            if (cancelled) return;
            const url = res?.data?.visual?.src;
            if (url && typeof url === "string")
              setDiagramPreviewUrls((prev) => (prev[vid] ? prev : { ...prev, [vid]: url }));
          } catch {
            /* ignore */
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [lesson?.pages, lesson?.level]);

  /** Insert from creation dialog (templates / AI) without hidden defaults. */
  const insertPreparedLessonBlockEdit = (
    pageId: string,
    raw: Record<string, unknown>,
    opts?: { insertAt?: number; role?: string; title?: string }
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      const block = { ...raw } as Record<string, unknown>;
      if (opts?.role?.trim()) {
        block.role = opts.role.trim();
      } else if (block.type === "dragDropMatch") {
        block.role = "match";
      } else if (block.type === "graph") {
        block.role = "graph";
      }
      if (opts?.title !== undefined) block.title = opts.title ?? "";
      const insertAt = opts?.insertAt;
      if (typeof insertAt === "number" && insertAt >= 0 && insertAt <= blocks.length) {
        blocks.splice(insertAt, 0, block);
      } else {
        blocks.push(block);
      }
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const addBlock = (
    pageId: string,
    type: LessonBlockType,
    opts?: { role?: string; title?: string; insertAt?: number }
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const page = pages[pIdx];
      // PR-EDITOR-GUARD-1: Don't add checkpoint block when page.checkpoint has content
      if (type === "checkpoint") {
        const hasPageCheckpoint = Boolean(
          page?.checkpoint?.question?.trim() &&
          Array.isArray(page?.checkpoint?.options) &&
          (page.checkpoint!.options!.filter((o: any) => String(o ?? "").trim()).length >= 2)
        );
        if (hasPageCheckpoint) return prev;
      }
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      let block: Record<string, unknown>;
      if (type === "checkpoint") {
        block = {
          type: "checkpoint",
          prompt: "Which statement is correct?",
          questionType: "mcq",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          correctAnswer: "Option 1",
          explanation: "",
        };
      } else if (type === "diagram") {
        block = {
          type: "diagram",
          visualId: "",
          caption: "",
          title: "",
          subtitle: "",
          studentTask: "",
          mode: "static",
          annotations: [],
          steps: [],
        };
      } else if (type === "selfCheck") {
        block = {
          type: "selfCheck",
          prompt: "[Enter question]",
          questionType: "mcq",
          options: ["[Option 1]", "[Option 2]", "[Option 3]", "[Option 4]"],
          correctAnswer: "[Option 1]",
          explanation: "",
        };
      } else if (type === "pageQuiz") {
        block = {
          type: "pageQuiz",
          question: "",
          questionType: "mcq",
          options: ["", "", "", ""],
          correctAnswer: "",
          explanation: "",
        };
      } else if (type === "interactiveSequence") {
        block = {
          type: "interactiveSequence",
          title: "",
          intro: "",
          content: "",
          sequenceSteps: [],
        };
      } else if (type === "interactiveDiagram") {
        block = {
          type: "interactiveDiagram",
          title: "",
          intro: "",
          imageUrl: "",
          hotspots: [],
          content: "",
        };
      } else if (type === "dragDropMatch") {
        block = {
          type: "dragDropMatch",
          content: "",
          title: "",
          intro: "",
          instructions: "",
          pairs: [],
        };
      } else if (type === "graph") {
        block = emptyGraphBlock() as Record<string, unknown>;
      } else {
        block = { type, content: "" };
      }
      if (opts?.role?.trim()) {
        block.role = opts.role.trim();
      } else if (type === "dragDropMatch") {
        block.role = "match";
      } else if (type === "graph") {
        block.role = "graph";
      }
      if (opts?.title !== undefined) block.title = opts.title ?? "";
      const insertAt = opts?.insertAt;
      if (typeof insertAt === "number" && insertAt >= 0 && insertAt <= blocks.length) {
        blocks.splice(insertAt, 0, block);
      } else {
        blocks.push(block);
      }
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const removeBlock = (pageId: string, blockIndex: number) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      blocks.splice(blockIndex, 1);
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const moveBlock = (pageId: string, from: number, dir: -1 | 1) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      const to = from + dir;
      if (from < 0 || from >= blocks.length || to < 0 || to >= blocks.length)
        return prev;
      const tmp = blocks[from];
      blocks[from] = blocks[to];
      blocks[to] = tmp;
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const addPage = () => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const nextOrder =
        pages.length > 0
          ? Math.max(...pages.map((p) => Number(p.order || 0))) + 1
          : 1;

      const p: LessonPage = {
        pageId: newId(),
        title: `Page ${nextOrder}`,
        order: nextOrder,
        pageType: "",
        hero: { type: "none", src: "", caption: "" },
        blocks: [{ type: "text", content: "" }],
        checkpoint: {
          question: "Which statement is correct?",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          answer: "Option 1",
          explanation: "",
        },
      };

      const next = { ...prev, pages: [...pages, p] };
      setTimeout(() => setSearchParams({ page: String(p.pageId) }), 0);
      return next;
    });
  };

  const removePage = (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const nextPages = pages.filter((p) => String(p.pageId) !== String(pageId));
      const renum = nextPages
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((p, idx) => ({ ...p, order: idx + 1 }));
      setTimeout(() => {
        if (renum.length > 0) setSearchParams({ page: String(renum[0].pageId) });
        else setSearchParams({}, { replace: true });
      }, 0);
      return { ...prev, pages: renum };
    });
  };

  const movePage = (pageId: string, dir: -1 | 1) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const ordered = pages.sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = ordered.findIndex((p) => String(p.pageId) === String(pageId));
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= ordered.length) return prev;
      const tmp = ordered[idx];
      ordered[idx] = ordered[to];
      ordered[to] = tmp;
      const renum = ordered.map((p, i) => ({ ...p, order: i + 1 }));
      return { ...prev, pages: renum };
    });
  };

  const updateCheckpoint = (
    pageId: string,
    patch: Partial<NonNullable<LessonPage["checkpoint"]>>
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const cp =
        pages[pIdx].checkpoint || { question: "", options: ["", "", "", ""], answer: "", explanation: "" };
      pages[pIdx] = { ...pages[pIdx], checkpoint: { ...cp, ...patch } };
      return { ...prev, pages };
    });
  };

  const updateCheckpointOption = (
    pageId: string,
    optIndex: number,
    value: string
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const cp =
        pages[pIdx].checkpoint || { question: "", options: ["", "", "", ""], answer: "", explanation: "" };
      const options = Array.isArray(cp.options) ? [...cp.options] : [];
      while (options.length < 4) options.push("");
      options[optIndex] = value;
      pages[pIdx] = { ...pages[pIdx], checkpoint: { ...cp, options } };
      return { ...prev, pages };
    });
  };

  const saveRevision = async (flashcards: Flashcard[], quizQuestions: QuizQuestion[]) => {
    if (!id || !isMongoObjectId(id)) return false;
    
    try {
      // CSV import is append-only. Deletion is admin-only and enforced server-side.
      const payload = {
        flashcards,
        quiz: {
          timeSeconds: 600,
          questions: quizQuestions
        },
        // 🔒 INTENT ASSERTION FLAG: Makes it explicit that CSV import is add-only by design
        // Future-proofs backend enforcement and prevents silent refactors breaking security
        importIntent: "append_only" as const
      };
      
      await api.post(`/lessons/${id}/revision`, payload);
      return true;
    } catch (error: any) {
      console.error("Error saving revision:", error);
      
      // Handle 403 permission error for teachers trying to delete
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || "Permission denied";
        
        if (errorMessage.includes("delete") || errorMessage.includes("permission") || errorMessage.includes("admin")) {
          // Show styled banner instead of alert
          setSaveMsg("🚫 You don't have permission to delete existing quiz questions. You can add new ones, but only admins can delete.");
          setTimeout(() => setSaveMsg(""), 5000);
        } else {
          setSaveMsg(`❌ ${errorMessage}`);
          setTimeout(() => setSaveMsg(""), 5000);
        }
      } else {
        setSaveMsg("❌ Failed to save revision data");
        setTimeout(() => setSaveMsg(""), 5000);
      }
      
      return false;
    }
  };

  const handleAIGenerate = async () => {
    if (!id || !isMongoObjectId(id)) return;
    
    setIsGenerating(true);
    try {
      const response = await api.post(`/lessons/${id}/generate-revision`, {
        topicKey: topicKeyForBank ?? undefined,
      });
      const data = response.data;
      
      if (data.success) {
        await fetchLessonSmart();
        alert(`Generated ${data.flashcardsCount} flashcards and ${data.quizQuestionsCount} quiz questions!`);
      } else {
        alert(data.error || 'Failed to generate revision');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Error generating revision content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddFlashcard = async () => {
    if (!newFlashcard.front.trim() || !newFlashcard.back.trim()) {
      alert("Please fill in both front and back of the flashcard");
      return;
    }
    
    const newFlashcardWithId = {
      ...newFlashcard,
      id: generateRevisionId(),
      tags: newFlashcard.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      difficulty: 1
    };
    
    const updatedFlashcards = [...flashcards, newFlashcardWithId];
    
    if (await saveRevision(updatedFlashcards, quizQuestions)) {
      setNewFlashcard({ front: "", back: "", tags: "" });
      setLesson(prev => prev ? {
        ...prev,
        flashcards: updatedFlashcards
      } : null);
    }
  };

  const handleAddQuizQuestion = async () => {
    if (!newQuizQuestion.question.trim()) {
      alert("Please enter a question");
      return;
    }
    
    if (newQuizQuestion.type === "mcq" && newQuizQuestion.options.some(opt => !opt.trim())) {
      alert("Please fill in all options for MCQ");
      return;
    }
    
    const defaultPageId = currentPage?.pageId ?? orderedPages[0]?.pageId ?? "";
    const newQuestionWithId = {
      ...newQuizQuestion,
      id: generateRevisionId(),
      difficulty: 1,
      pageId: newQuizQuestion.pageId !== undefined && newQuizQuestion.pageId !== "" ? newQuizQuestion.pageId : defaultPageId || undefined,
    };
    
    const updatedQuizQuestions = [...quizQuestions, newQuestionWithId];
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setNewQuizQuestion({
        type: "mcq",
        question: "",
        options: ["", "", "", ""],
        correctAnswer: "",
        explanation: "",
        pageId: defaultPageId || "",
      });
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
    }
  };

  const handleDeleteFlashcard = async (flashcardId: string) => {
    if (!window.confirm("Delete this flashcard?")) return;
    
    const updatedFlashcards = flashcards.filter(f => f.id !== flashcardId);
    
    if (await saveRevision(updatedFlashcards, quizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        flashcards: updatedFlashcards
      } : null);
    }
  };

  const handleDeleteQuizQuestion = async (questionId: string) => {
    if (!window.confirm("Delete this quiz question?")) return;
    
    const updatedQuizQuestions = quizQuestions.filter(q => q.id !== questionId);
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
    }
  };

  const revisionValidationCounts = useMemo(() => {
    let quizIssues = 0;
    for (const q of lesson?.quiz?.questions ?? []) {
      if (q.type === "mcq" && (!q.options || q.options.filter((o: string) => String(o ?? "").trim()).length < 2)) quizIssues++;
      else if (!String(q.correctAnswer ?? "").trim()) quizIssues++;
    }
    let flashcardIssues = 0;
    for (const f of flashcards) {
      if (!String(f.front ?? "").trim() || !String(f.back ?? "").trim()) flashcardIssues++;
    }
    return { quizIssues, flashcardIssues };
  }, [lesson?.quiz?.questions, flashcards]);

  const handleUpdateQuizQuestionPageId = async (questionId: string, pageId: string) => {
    const updatedQuizQuestions = quizQuestions.map((q) =>
      q.id === questionId ? { ...q, pageId: pageId || undefined } : q
    );
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson((prev) =>
        prev
          ? { ...prev, quiz: { ...prev.quiz, questions: updatedQuizQuestions } }
          : null
      );
    }
  };

  // Toggle mark preview expansion
  const toggleMarkPreview = (questionId: string) => {
    setExpandedPreviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // ✅ CSV Import Functions
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      if (!csvText) {
        alert("Failed to read CSV file");
        return;
      }

      try {
        // Parse CSV with robust parser
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
          alert("CSV file is empty");
          return;
        }

        // Extract headers (first row)
        const headers = rows[0].map(h => h.toLowerCase().trim());
        
        // Find column indices
        const questionIdx = headers.indexOf('question');
        const typeIdx = headers.indexOf('type');
        const correctAnswerIdx = headers.indexOf('correctanswer');
        const markSchemeIdx = headers.indexOf('markscheme');
        const marksIdx = headers.indexOf('marks');
        const tagsIdx = headers.indexOf('tags');

        if (questionIdx === -1 || typeIdx === -1 || correctAnswerIdx === -1) {
          alert("CSV must contain columns: question, type, correctAnswer");
          return;
        }

        const parsedQuestions: QuizQuestion[] = [];
        let rowsSkipped = 0;

        // Process data rows (skip header row)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          
          // Skip empty rows
          if (row.every(cell => !cell.trim())) {
            rowsSkipped++;
            continue;
          }

          const question = row[questionIdx]?.trim();
          const type = row[typeIdx]?.trim().toLowerCase() as "mcq" | "short" | "exam";
          const correctAnswer = row[correctAnswerIdx]?.trim();
          const markSchemeStr = markSchemeIdx !== -1 ? row[markSchemeIdx]?.trim() : '';
          const marksStr = marksIdx !== -1 ? row[marksIdx]?.trim() : '1';
          const tagsStr = tagsIdx !== -1 ? row[tagsIdx]?.trim() : '';

          // Skip rows missing required fields
          if (!question || !type || !correctAnswer) {
            rowsSkipped++;
            continue;
          }

          // Validate question type
          const validType = type === "mcq" || type === "short" || type === "exam" ? type : "short";

          // Parse marks (default to 1)
          const marks = Math.max(1, parseInt(marksStr) || 1);

          // Parse tags (split by semicolon)
          const tags = tagsStr ? tagsStr.split(';').map(tag => tag.trim()).filter(tag => tag) : [];

          // Parse markScheme (could be JSON array or semicolon-separated)
          const markScheme = parseMarkScheme(markSchemeStr);

          parsedQuestions.push({
            id: generateRevisionId(),
            type: validType,
            question,
            correctAnswer,
            markScheme,
            marks,
            tags,
            difficulty: 1
          });
        }

        // Show preview
        setCsvImportData({
          parsedQuestions,
          previewVisible: true,
          rowsParsed: parsedQuestions.length,
          rowsSkipped
        });

      } catch (error) {
        console.error("Error parsing CSV:", error);
        alert("Error parsing CSV file. Please check the format.");
      }
    };

    reader.readAsText(file);
  };

  const applyCSVImport = () => {
    const { parsedQuestions } = csvImportData;
    
    if (parsedQuestions.length === 0) {
      alert("No questions to import");
      return;
    }

    setLesson(prev => {
      if (!prev) return prev;
      
      const prevQuiz = prev.quiz || { timeSeconds: 600, questions: [] };
      const prevQs = Array.isArray(prevQuiz.questions) ? prevQuiz.questions : [];
      
      // 🔒 SECURITY CHECK: CSV import can only add questions, never delete or replace
      // This maintains parity with backend 403 rules and prevents accidental "replace" refactors
      const currentCount = prevQs.length;
      const newCount = currentCount + parsedQuestions.length;
      
      // Safety check: ensure we're only appending (should always be true with +)
      if (newCount < currentCount) {
        setSaveMsg("🚫 CSV import can only add questions. Deleting is admin-only.");
        setTimeout(() => setSaveMsg(""), 5000);
        return prev; // Return unchanged lesson
      }
      
      return {
        ...prev,
        quiz: {
          ...prevQuiz,
          questions: [...prevQs, ...parsedQuestions]
        },
        // 🔒 INTENT ASSERTION FLAG: CSV import is append-only by design
        // Self-documents intent and makes future refactors obvious
        _csvImportIntent: "append_only" as const
      };
    });

    // Close preview and show success message
    setCsvImportData({
      parsedQuestions: [],
      previewVisible: false,
      rowsParsed: 0,
      rowsSkipped: 0
    });

    setSaveMsg(`✅ Successfully imported ${parsedQuestions.length} questions from CSV!`);
    setTimeout(() => setSaveMsg(""), 5000);
  };

  const cancelCSVImport = () => {
    setCsvImportData({
      parsedQuestions: [],
      previewVisible: false,
      rowsParsed: 0,
      rowsSkipped: 0
    });
  };

  // ✅ Structured parser for quiz bulk upload with MARKSCHEME support
  const handleSimpleQuizBulkUpload = () => {
    const text = (examBulkText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!text) return;

    // Split into question blocks by blank lines
    const blocks = text.split(/\n\s*\n+/g).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return;

    const newQs = blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

      let type: "mcq" | "short" | "exam" = "short";
      let questionLines: string[] = [];
      let correctAnswer = "";
      let explanation = "";
      let marks = 1;
      let tags: string[] = [];
      let options: string[] | undefined = undefined;
      let markScheme: string[] | undefined = undefined;

      const optionMap: Record<string, string> = {};

      for (const line of lines) {
        // Metadata
        if (/^TYPE\s*:/i.test(line)) {
          const v = line.replace(/^TYPE\s*:\s*/i, "").trim().toLowerCase();
          if (v === "mcq" || v === "short" || v === "exam") type = v as any;
          continue;
        }
        if (/^MARKS\s*:/i.test(line)) {
          const v = Number(line.replace(/^MARKS\s*:\s*/i, "").trim());
          if (Number.isFinite(v) && v > 0) marks = Math.round(v);
          continue;
        }
        if (/^TAGS\s*:/i.test(line)) {
          const raw = line.replace(/^TAGS\s*:\s*/i, "").trim();
          tags = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12);
          continue;
        }
        if (/^ANSWER\s*:/i.test(line)) {
          correctAnswer = line.replace(/^ANSWER\s*:\s*/i, "").trim();
          continue;
        }
        if (/^EXPLANATION\s*:/i.test(line)) {
          explanation = line.replace(/^EXPLANATION\s*:\s*/i, "").trim();
          continue;
        }
        // ✅ Added: MARKSCHEME support
        if (/^MARKSCHEME\s*:/i.test(line)) {
          const raw = line.replace(/^MARKSCHEME\s*:\s*/i, "").trim();
          const parts = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20);
          markScheme = parts.length ? parts : undefined;
          continue;
        }

        // MCQ options: A) ... or A. ...
        const optMatch = line.match(/^([A-D])[\)\.]\s*(.+)$/i);
        if (optMatch) {
          const k = optMatch[1].toUpperCase();
          optionMap[k] = optMatch[2].trim();
          continue;
        }

        // Otherwise assume it's part of the question stem
        questionLines.push(line);
      }

      // If options exist, set MCQ
      const optionKeys = Object.keys(optionMap);
      if (optionKeys.length) {
        type = "mcq";
        options = ["A", "B", "C", "D"].filter((k) => optionMap[k]).map((k) => `${k}) ${optionMap[k]}`);
        // If ANSWER: was "B", convert to the option text if possible
        if (correctAnswer && /^[A-D]$/i.test(correctAnswer) && optionMap[correctAnswer.toUpperCase()]) {
          correctAnswer = optionMap[correctAnswer.toUpperCase()];
        }
      }

      const question = questionLines.join("\n").trim();

      return {
        id: `q_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
        type,
        question: question || "(missing question)",
        options,
        correctAnswer: correctAnswer || "",
        markScheme, // ✅ Now includes markScheme array
        explanation,
        tags,
        difficulty: 1,
        marks,
      };
    });

    // ✅ Enhanced filter to clean up wrongly-imported metadata lines
    const filtered = newQs.filter((q) => {
      if (!q.question || q.question === "(missing question)") return false;

      // ❌ reject legacy junk accidentally imported as questions
      if (/^ANSWER\s*:/i.test(q.question)) return false;
      if (/^MARKS\s*:/i.test(q.question)) return false;
      if (/^TYPE\s*:/i.test(q.question)) return false;
      if (/^TAGS\s*:/i.test(q.question)) return false;
      if (/^MARKSCHEME\s*:/i.test(q.question)) return false;

      return true;
    });

    setLesson((prev: any) => {
      if (!prev) return prev;
      const prevQuiz = prev.quiz || { timeSeconds: 600, questions: [] };
      const prevQs = Array.isArray(prevQuiz.questions) ? prevQuiz.questions : [];
      
      // 🔒 SECURITY CHECK: Bulk upload can only add questions, never delete or replace
      const currentCount = prevQs.length;
      const newCount = currentCount + filtered.length;
      
      if (newCount < currentCount) {
        setSaveMsg("🚫 Bulk upload can only add questions. Deleting is admin-only.");
        setTimeout(() => setSaveMsg(""), 5000);
        return prev;
      }
      
      return {
        ...prev,
        quiz: {
          ...prevQuiz,
          questions: [...prevQs, ...filtered],
        },
        // 🔒 INTENT ASSERTION FLAG: Bulk upload is append-only
        _bulkUploadIntent: "append_only" as const
      };
    });

    setExamBulkText("");
  };

  const handleBulkUpload = async () => {
    if (!examBulkText.trim()) {
      alert("Please paste some exam questions in the text area");
      return;
    }

    const lines = examBulkText.split('\n').filter(line => line.trim());
    const newQuestions: QuizQuestion[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const hasOptions = trimmedLine.includes('A)') || trimmedLine.includes('a)') || 
                         trimmedLine.includes('1)') || trimmedLine.includes('1.');
      
      if (hasOptions) {
        const questionMatch = trimmedLine.match(/^([^A1a][^:]*):?(.*)/);
        if (questionMatch) {
          const questionText = questionMatch[0];
          newQuestions.push({
            id: generateRevisionId(),
            type: "mcq",
            question: questionText,
            options: ["", "", "", ""],
            correctAnswer: "",
            explanation: "",
            difficulty: 1
          });
        }
      } else {
        newQuestions.push({
          id: generateRevisionId(),
          type: "short",
          question: trimmedLine,
          correctAnswer: "",
          explanation: "",
          difficulty: 1
        });
      }
    }

    if (newQuestions.length === 0) {
      alert("No valid questions found in the text");
      return;
    }

    const confirmed = window.confirm(`Found ${newQuestions.length} questions. Add them to the lesson?`);
    if (!confirmed) return;

    const updatedQuizQuestions = [...quizQuestions, ...newQuestions];
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
      
      setExamBulkText("");
      alert(`Successfully added ${newQuestions.length} questions!`);
    }
  };

  const parseStructuredExamQuestions = (text: string): QuizQuestion[] => {
    const questions: QuizQuestion[] = [];
    const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
    
    for (const block of blocks) {
      const lines = block.split('\n').filter(line => line.trim());
      if (lines.length === 0) continue;
      
      const questionText = lines[0].trim();
      let options: string[] = [];
      let correctAnswer = "";
      let explanation = "";
      let markScheme: string[] | undefined = undefined;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.toLowerCase().startsWith('answer:') || 
            line.toLowerCase().startsWith('correct:')) {
          correctAnswer = line.substring(line.indexOf(':') + 1).trim();
        }
        else if (line.toLowerCase().startsWith('explanation:')) {
          explanation = line.substring(line.indexOf(':') + 1).trim();
        }
        else if (line.toLowerCase().startsWith('markscheme:')) {
          const raw = line.substring(line.indexOf(':') + 1).trim();
          const parts = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20);
          markScheme = parts.length ? parts : undefined;
        }
        else if (/^[A-Da-d][).]|^[1-4][).]/.test(line)) {
          options.push(line);
        }
      }
      
      let type: "mcq" | "short" | "exam" = "short";
      if (options.length >= 2) {
        type = "mcq";
      } else if (questionText.toLowerCase().includes('exam') || 
                 questionText.toLowerCase().includes('question') && 
                 questionText.length > 100) {
        type = "exam";
      }
      
      questions.push({
        id: generateRevisionId(),
        type,
        question: questionText,
        options: options.length > 0 ? options : undefined,
        correctAnswer,
        explanation,
        markScheme,
        difficulty: 1
      });
    }
    
    return questions;
  };

  const handleStructuredBulkUpload = async () => {
    if (!examBulkText.trim()) {
      alert("Please paste exam questions in the text area");
      return;
    }

    const newQuestions = parseStructuredExamQuestions(examBulkText);
    
    if (newQuestions.length === 0) {
      alert("No valid questions found. Please use this format:\n\nQuestion text\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nAnswer: A\nExplanation: Optional explanation\nMARKSCHEME: point 1, point 2, point 3");
      return;
    }

    const confirmed = window.confirm(`Found ${newQuestions.length} structured questions. Add them to the lesson?`);
    if (!confirmed) return;

    const updatedQuizQuestions = [...quizQuestions, ...newQuestions];
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
      
      setExamBulkText("");
      alert(`Successfully added ${newQuestions.length} structured questions!`);
    }
  };

  const uploadIntoBlock = async (
    file: File,
    pageId: string,
    blockIndex: number,
    getCurrentValue: () => string,
    setValue: (next: string) => void
  ) => {
    if (!file) return;
    const ok = file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!ok) {
      alert("Please upload an image (png/jpg/gif/webp) or video (mp4/webm/mov).");
      return;
    }

    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }

    const key = `${pageId}:${blockIndex}`;

    try {
      setUploadingKey(key);
      setUploadMsg("");

      const form = new FormData();
      form.append("file", file);
      const isVideo = file.type.startsWith("video/");
      const folder = `lesson-media/lesson_${safeStr(lesson?.id, "unknown_lesson")}/page_${pageId}/block_${blockIndex}`;
      const endpoint = isVideo ? "uploads/video" : `uploads/image?folder=${encodeURIComponent(folder)}`;
      if (!isVideo) form.append("folder", folder);

      const res = await api.post(endpoint, form);

      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      const absoluteUrl = toAbsoluteAssetUrl(url);
      const insert = buildMarkdownForFile(absoluteUrl, file);
      const textarea = blockTextareasRef.current[key];
      const current = getCurrentValue();

      if (!textarea) {
        setValue(current + insert);
        setUploadMsg("✅ Uploaded and inserted.");
        return;
      }

      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;

      const next = current.slice(0, start) + insert + current.slice(end);
      setValue(next);

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insert.length;
        textarea.setSelectionRange(pos, pos);
      });

      setUploadMsg("✅ Uploaded and inserted.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.msg ?? data.message ?? data.details)
          : undefined;
      const msg =
        typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
    } finally {
      setUploadingKey("");
    }
  };

  const uploadImageForSequenceStep = async (
    file: File,
    pageId: string,
    blockIndex: number,
    stepIndex: number,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image (png/jpg/gif/webp).");
      return;
    }
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }
    const key = `${pageId}:${blockIndex}:seq:${stepIndex}`;
    try {
      setUploadingKey(key);
      setUploadMsg("");
      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/lesson_${safeStr(lesson?.id, "unknown_lesson")}/page_${pageId}/block_${blockIndex}_step_${stepIndex}`;
      const endpoint = `uploads/image?folder=${encodeURIComponent(folder)}`;
      form.append("folder", folder);
      const res = await api.post(endpoint, form);
      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      onUrl(toAbsoluteAssetUrl(url));
      setUploadMsg("✅ Image uploaded.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.msg ?? data.message ?? data.details)
          : undefined;
      const msg = typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
    } finally {
      setUploadingKey("");
    }
  };

  const uploadImageForInteractiveDiagram = async (
    file: File,
    pageId: string,
    blockIndex: number,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image (png/jpg/gif/webp).");
      return;
    }
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }
    const key = `${pageId}:${blockIndex}:idiagram`;
    try {
      setUploadingKey(key);
      setUploadMsg("");
      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/lesson_${safeStr(lesson?.id, "unknown_lesson")}/page_${pageId}/block_${blockIndex}_interactivediagram`;
      const endpoint = `uploads/image?folder=${encodeURIComponent(folder)}`;
      form.append("folder", folder);
      const res = await api.post(endpoint, form);
      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      onUrl(toAbsoluteAssetUrl(url));
      setUploadMsg("✅ Image uploaded.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.msg ?? data.message ?? data.details)
          : undefined;
      const msg = typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
    } finally {
      setUploadingKey("");
    }
  };

  /** Lesson diagram block (type diagram) — JPG/PNG/WEBP only; same uploads pipeline as other block media */
  const isLessonDiagramUploadFile = (file: File): boolean => {
    const t = (file.type || "").toLowerCase();
    if (t === "image/jpeg" || t === "image/png" || t === "image/webp") return true;
    return /\.(jpe?g|png|webp)$/i.test(file.name || "");
  };

  const uploadImageForLessonDiagramBlock = async (
    file: File,
    pageId: string,
    blockIndex: number,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    if (!isLessonDiagramUploadFile(file)) {
      alert("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }
    const uploadKey = `${pageId}:${blockIndex}:diagram`;
    try {
      setUploadingKey(uploadKey);
      setUploadMsg("");
      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/lesson_${safeStr(lesson?.id, "unknown_lesson")}/page_${pageId}/block_${blockIndex}_diagram`;
      const endpoint = `uploads/image?folder=${encodeURIComponent(folder)}`;
      form.append("folder", folder);
      const res = await api.post(endpoint, form);
      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      onUrl(toAbsoluteAssetUrl(url));
      setUploadMsg("✅ Image uploaded.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.msg ?? data.message ?? data.details)
          : undefined;
      const msg = typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
    } finally {
      setUploadingKey("");
    }
  };

  const handleInjectTeacherBrainBriefs = async (ctx?: {
    pageId?: string;
    blockIndex?: number;
    blockType?: string;
  }) => {
    console.log("[TeacherBrainUI] handleInjectTeacherBrainBriefs start", {
      pageId: ctx?.pageId,
      blockIndex: ctx?.blockIndex,
      blockType: ctx?.blockType,
    });
    if (!lesson) return;
    const topic =
      safeStr(lesson.topic, "").trim() ||
      safeStr((lesson as { subTopic?: string }).subTopic, "").trim() ||
      safeStr(lesson.title, "").trim();
    const topicKey =
      topicKeyForBank ||
      safeStr((lesson as { topicKey?: string }).topicKey, "").trim() ||
      undefined;
    const subTopic = safeStr((lesson as { subTopic?: string }).subTopic, "").trim() || undefined;
    const subject = safeStr(lesson.subject, "");
    const examBoard = safeStr(lesson.examBoardName, "") || undefined;
    const tier = safeStr((lesson as { tier?: string }).tier, "") || undefined;
    console.log("[TeacherBrainUI] inject context", {
      topic,
      topicKey,
      subTopic,
      subject,
      examBoard,
      tier,
    });
    if (!topic) {
      setSaveMsg("Set a lesson topic before injecting Teacher Brain briefs.");
      setTimeout(() => setSaveMsg(""), 6000);
      return;
    }
    setTeacherBrainInjectLoading(true);
    try {
      if (ctx?.pageId != null && typeof ctx.blockIndex === "number") {
        const page = lesson.pages?.find((p) => String(p.pageId) === String(ctx.pageId));
        const block = page?.blocks?.[ctx.blockIndex] as LessonPageBlock | undefined;
        if (block && String(block.type).toLowerCase().includes("dragdrop")) {
          console.log("[TeacherBrainLayout] editor block before regenerate", {
            type: block.type,
            activityLayout: (block as { activityLayout?: string }).activityLayout,
            dragDropLayout: block.dragDropLayout,
            matchMode: block.matchMode,
            imageUrl: block.imageUrl,
            dropZones: block.dropZones,
          });
        }
      }
      const result = await injectTeacherBrainBriefs({
        pages: lesson.pages || [],
        topic,
        topicKey,
        subTopic,
        subject,
        examBoard,
        tier,
      });
      const injectionCount =
        result.teacherBrainInjection.injectionCount ??
        countTeacherBrainBriefsInPages(result.pages);
      const affectedTypes = (result.teacherBrainInjection.injections ?? [])
        .map((row) =>
          row && typeof row === "object" && "blockType" in row
            ? String((row as { blockType?: string }).blockType ?? "")
            : ""
        )
        .filter(Boolean);
      console.log("[TeacherBrainUI] injection result", {
        injectionCount,
        affectedBlockTypes: affectedTypes,
      });
      setLesson((prev) =>
        prev ? { ...prev, pages: result.pages as Lesson["pages"] } : prev
      );
      setTeacherBrainBriefRefreshKey((k) => k + 1);
      if (ctx?.pageId != null && typeof ctx.blockIndex === "number") {
        const page = (result.pages as Lesson["pages"])?.find(
          (p) => String(p.pageId) === String(ctx.pageId)
        );
        const block = page?.blocks?.[ctx.blockIndex] as { note?: string } | undefined;
        const hasBrief = String(block?.note ?? "").startsWith(
          "--- TEACHER BRAIN DESIGN BRIEF ---"
        );
        console.log("[TeacherBrainUI] block note after update", {
          pageId: ctx.pageId,
          blockIndex: ctx.blockIndex,
          hasTeacherBrainBrief: hasBrief,
        });
      }
      setSaveMsg(
        injectionCount > 0
          ? `Regenerated ${injectionCount} Teacher Brain design brief(s). Click Save Changes to persist.`
          : "No briefs were regenerated — check the lesson topic matches a supported profile (e.g. Metabolism)."
      );
      setTimeout(() => setSaveMsg(""), 9000);
    } catch (err) {
      console.error("[TeacherBrainUI] inject failed", err);
      setSaveMsg("Could not inject Teacher Brain briefs.");
      setTimeout(() => setSaveMsg(""), 6000);
    } finally {
      setTeacherBrainInjectLoading(false);
    }
  };

  /** dragDropMatch diagram mode — same pipeline as interactive diagram; distinct folder for assets */
  const uploadImageForDragDropMatch = async (
    file: File,
    pageId: string,
    blockIndex: number,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image (png/jpg/gif/webp).");
      return;
    }
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }
    const key = `${pageId}:${blockIndex}:ddm`;
    try {
      setUploadingKey(key);
      setUploadMsg("");
      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/lesson_${safeStr(lesson?.id, "unknown_lesson")}/page_${pageId}/block_${blockIndex}_dragdropmatch`;
      const endpoint = `uploads/image?folder=${encodeURIComponent(folder)}`;
      form.append("folder", folder);
      const res = await api.post(endpoint, form);
      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      onUrl(toAbsoluteAssetUrl(url));
      setUploadMsg("✅ Diagram image uploaded.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.msg ?? data.message ?? data.details)
          : undefined;
      const msg = typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
    } finally {
      setUploadingKey("");
    }
  };

  /** dragDropMatch pair answer thumbnail — same uploads/image pipeline as sequence steps; per-pair folder. */
  const uploadImageForDragDropMatchPairAnswer = async (
    file: File,
    pageId: string,
    blockIndex: number,
    pairIndex: number,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image (png/jpg/gif/webp).");
      return;
    }
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }
    const uploadKey = `${pageId}:${blockIndex}:ddm-pair:${pairIndex}`;
    try {
      setUploadingKey(uploadKey);
      setUploadMsg("");
      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/lesson_${safeStr(lesson?.id, "unknown_lesson")}/page_${pageId}/block_${blockIndex}_ddm_pair_${pairIndex}`;
      const endpoint = `uploads/image?folder=${encodeURIComponent(folder)}`;
      form.append("folder", folder);
      const res = await api.post(endpoint, form);
      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      onUrl(toAbsoluteAssetUrl(url));
      setUploadMsg("✅ Answer image uploaded.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.msg ?? data.message ?? data.details)
          : undefined;
      const msg = typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
    } finally {
      setUploadingKey("");
    }
  };

  const triggerBlockUpload = (pageId: string, blockIndex: number) => {
    const key = `${pageId}:${blockIndex}`;
    const input = fileInputRef.current[key];
    if (!input) return;
    input.value = "";
    input.click();
  };

  /** Full lesson PUT payload (pages + quiz) — shared by Save and Publish so publish validates the same snapshot. */
  const getLessonPersistPayload = (): Record<string, unknown> | null => {
    if (!lesson) return null;

    const sanitizedPages = (lesson.pages || []).map((p: any) => ({
        ...p,
        blocks: (p.blocks || []).map((b: any) => {
          {
            const ddmPersist = buildDragDropMatchBlockForPersist(b, {
              newId,
              logZoneBindings: logDragDropMatchZoneBindings,
            });
            if (ddmPersist) return ddmPersist;
          }
          if (normalizeBlockType(String(b?.type ?? "")) === "graph") {
            return graphBlockForPersist(b);
          }
          if (b.type === "checkpoint") {
            const opts = Array.isArray(b.options) ? b.options.map((o: string) => String(o ?? "").trim()) : [];
            const markSchemeBlk = checkpointMarkSchemeLines((b as LessonPageBlock).markScheme);
            const cpOut: Record<string, unknown> = {
              type: "checkpoint",
              prompt: String(b.prompt ?? "").trim(),
              questionType: b.questionType === "short" ? "short" : "mcq",
              options: opts,
              correctAnswer: String(b.correctAnswer ?? "").trim(),
              explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
              ...(markSchemeBlk.length ? { markScheme: markSchemeBlk } : {}),
            };
            if (typeof b.role === "string" && b.role.trim()) cpOut.role = b.role.trim();
            return cpOut;
          }
          if (b.type === "selfCheck") {
            const opts = Array.isArray(b.options) ? b.options.map((o: string) => String(o ?? "").trim()) : [];
            const markSchemeSc = checkpointMarkSchemeLines((b as LessonPageBlock).markScheme);
            const scOut: Record<string, unknown> = {
              type: "selfCheck",
              prompt: String(b.prompt ?? "").trim(),
              questionType: b.questionType === "short" ? "short" : "mcq",
              options: opts,
              correctAnswer: String(b.correctAnswer ?? "").trim(),
              explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
              ...(markSchemeSc && markSchemeSc.length ? { markScheme: markSchemeSc } : {}),
            };
            if (typeof b.role === "string" && b.role.trim()) scOut.role = b.role.trim();
            return scOut;
          }
          if (b.type === "pageQuiz") {
            const opts = Array.isArray(b.options) ? b.options.map((o: string) => String(o ?? "").trim()) : [];
            const pqOut: Record<string, unknown> = {
              type: "pageQuiz",
              question: String(b.question ?? b.prompt ?? "").trim(),
              questionType: b.questionType === "short" ? "short" : "mcq",
              options: opts,
              correctAnswer: String(b.correctAnswer ?? "").trim(),
              explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
            };
            if (typeof b.role === "string" && b.role.trim()) pqOut.role = b.role.trim();
            return pqOut;
          }
          if (b.type === "diagram") {
            return attachPersistedBlockNumber(diagramBlockForPersist(b), b);
          }
          if (b.type === "interactiveSequence") {
            const normalizedSeq = normalizeInteractiveSequenceBlockForEditor(
              b as Record<string, unknown>
            );
            const sequenceSteps = (
              Array.isArray(normalizedSeq.sequenceSteps) ? normalizedSeq.sequenceSteps : []
            )
              .map((s) => {
                const te = s.testExplanation != null ? String(s.testExplanation).trim() : "";
                return {
                  ...(s.id ? { id: s.id } : {}),
                  title: s.title,
                  description: s.description,
                  imageUrl: s.imageUrl,
                  caption: s.caption,
                  ...(te ? { testExplanation: te } : {}),
                };
              })
              .filter(
                (s) =>
                  s.title.length > 0 ||
                  s.description.length > 0 ||
                  s.imageUrl.length > 0 ||
                  s.caption.length > 0 ||
                  Boolean((s as { testExplanation?: string }).testExplanation)
              );
            const isOut: Record<string, unknown> = withPersistedBlockNote(
              {
                type: "interactiveSequence",
                title: typeof b.title === "string" ? b.title.trim() : "",
                intro: b.intro != null ? String(b.intro).trim() : "",
                sequenceSteps,
              },
              b
            );
            if (typeof b.role === "string" && b.role.trim()) isOut.role = b.role.trim();
            return isOut;
          }
          if (b.type === "interactiveDiagram") {
            const rawH = Array.isArray(b.hotspots) ? b.hotspots : [];
            const hotspots = rawH.map((h: any, i: number) => normalizeInteractiveDiagramHotspot(h, i));
            const idOut: Record<string, unknown> = withPersistedBlockNote(
              {
                type: "interactiveDiagram",
                title: typeof b.title === "string" ? b.title.trim() : "",
                intro: b.intro != null ? String(b.intro).trim() : "",
                imageUrl: b.imageUrl != null ? String(b.imageUrl).trim() : "",
                hotspots,
              },
              b
            );
            if (typeof b.role === "string" && b.role.trim()) idOut.role = b.role.trim();
            return idOut;
          }
          const contentOut: Record<string, unknown> = {
            type: toLegacyBlockType(b.type),
            content: sanitizeTeacherMarkdown(String(b.content || "")),
          };
          if (typeof b.title === "string" && b.title.trim()) contentOut.title = b.title.trim();
          if (typeof b.role === "string" && b.role.trim()) contentOut.role = b.role.trim();
          return contentOut;
        })
          .map((out: Record<string, unknown>, idx: number) =>
            attachLearningMetaForPersist(out, (p.blocks || [])[idx])
          ),
      }));

      // Build quiz.questions from pageQuiz blocks + existing end-of-lesson questions
      const pageQuizQuestions: QuizQuestion[] = [];
      for (const p of sanitizedPages) {
        const pageId = p.pageId;
        if (!pageId) continue;
        for (const b of p.blocks || []) {
          if (b.type !== "pageQuiz") continue;
          const qText = String(b.question ?? b.prompt ?? "").trim();
          if (!qText) continue;
          const correctAnswer = String(b.correctAnswer ?? "").trim();
          if (!correctAnswer) continue;
          const qt = b.questionType === "short" ? "short" : "mcq";
          const opts = Array.isArray(b.options) ? b.options.map((o: string) => String(o ?? "").trim()).filter(Boolean) : [];
          if (qt === "mcq" && opts.length < 2) continue;
          pageQuizQuestions.push({
            id: `pq_${pageId}_${pageQuizQuestions.length}_${Date.now()}`,
            type: qt as "mcq" | "short",
            question: qText,
            options: qt === "mcq" ? opts : undefined,
            correctAnswer,
            explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
            pageId,
          });
        }
      }
      const pageIdsInLesson = new Set(
        sanitizedPages.map((p: { pageId?: string }) => String(p.pageId || "").trim()).filter(Boolean)
      );
      const bankAttachedPageQuiz = (lesson.quiz?.questions || []).filter((q: QuizQuestion & { sourceQuestionId?: string; sourceType?: string }) => {
        const pid = String(q?.pageId ?? "").trim();
        if (!pid || pid === "END" || !pageIdsInLesson.has(pid)) return false;
        return Boolean(q.sourceQuestionId || q.sourceType === "topicQuizQuestion");
      });
      const endOfLessonQuestions = (lesson.quiz?.questions || []).filter(
        (q: QuizQuestion) => !q.pageId || String(q.pageId) === "END"
      );
      const mergedQuizQuestions = [...pageQuizQuestions, ...bankAttachedPageQuiz, ...endOfLessonQuestions];

    warnLearningMetaIfMissing(sanitizedPages, "edit lesson");

    return {
      title: lesson.title,
      description: lesson.description,
      subject: lesson.subject,
      level: lesson.level,
      topic: lesson.topic,
      topicKey: (() => {
        const topicNorm = normalizeLessonTopicSlugFromLesson(
          {
            ...lesson,
            specKey: (lesson as { specKey?: string }).specKey,
            canonicalTopicKey: (lesson as { canonicalTopicKey?: string }).canonicalTopicKey,
          },
          taxonomyUnits
        );
        if (topicNorm.namespaced) return topicNorm.namespaced;
        if (topicKeyForBank) return topicKeyForBank;
        return undefined;
      })(),
      specKey: (lesson as { specKey?: string }).specKey ?? undefined,
      mainTopic: (lesson as { mainTopic?: string }).mainTopic ?? undefined,
      subTopic: (lesson as { subTopic?: string }).subTopic ?? undefined,
      board: lesson.examBoardName || "",
      estimatedDuration: lesson.estimatedDuration,
      isFreePreview: !!lesson.isFreePreview,
      metadata: (lesson as { metadata?: Record<string, unknown> }).metadata,
      pages: sanitizedPages,
      quiz: {
        ...(lesson.quiz || {}),
        timeSeconds: lesson.quiz?.timeSeconds ?? 600,
        questions: mergedQuizQuestions,
      },
    };
  };

  const handleCurriculumCheck = async () => {
    if (!id || !lesson || !canRunCurriculumReview(lesson)) return;
    if (!curriculumAiReviewFeature) return;
    try {
      setCurriculumReviewLoading(true);
      const data = await requestCurriculumAiReview(id);
      const cr = data.curriculumAiReview;
      setLesson((prev) => (prev ? { ...prev, curriculumAiReview: cr } : null));
      setSaveMsg("✅ Curriculum review ready.");
      setTimeout(() => setSaveMsg(""), 4500);
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { msg?: string; code?: string } }; message?: string };
      if (ax?.response?.status === 409) {
        setSaveMsg("⏳ A curriculum review is already in progress.");
      } else {
        setSaveMsg(ax?.response?.data?.msg || ax?.message || "❌ Curriculum check failed.");
      }
      setTimeout(() => setSaveMsg(""), 6000);
    } finally {
      setCurriculumReviewLoading(false);
    }
  };

  const saveToBackend = async (): Promise<boolean> => {
    lastSaveFailureReasonRef.current = null;
    if (!lesson || !id) {
      lastSaveFailureReasonRef.current = "Lesson is not loaded or id is missing.";
      return false;
    }
    if (!isMongoObjectId(id)) {
      const msg =
        "This lesson is a legacy (Supabase) lesson. (UUID). Editing pages is currently supported for Mongo lessons.";
      setSaveMsg(msg);
      lastSaveFailureReasonRef.current = msg;
      return false;
    }

    try {
      setSaving(true);
      setSaveMsg("");

      const payload = getLessonPersistPayload();
      if (!payload) {
        const msg = "Could not build the save payload. Try reloading the lesson.";
        setSaveMsg(`❌ ${msg}`);
        lastSaveFailureReasonRef.current = msg;
        return false;
      }

      let saved = false;

      if (isAdmin) {
        try {
          await api.put(`/admin/lessons/${id}`, payload);
          saved = true;
        } catch {}
      }

      if (!saved) {
        await api.put(`/lessons/${id}`, payload);
      }

      setSaveMsg("✅ Saved!");
      const savedPages = Array.isArray(payload.pages) ? payload.pages : [];
      // Refetch is for editor UI only. Server already has persisted content for /generate-assets.
      // It must not flip save success — a failed/odd refetch used to make saveToBackend return false incorrectly.
      try {
        await fetchLessonSmart();
        if (savedPages.length > 0) {
          setLesson((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              pages: mergeSavedDiagramAuthoringInstructions(
                (prev.pages || []) as Array<{ pageId?: string; blocks?: unknown[] }>,
                savedPages as Array<{ pageId?: string; blocks?: unknown[] }>
              ) as typeof prev.pages,
            };
          });
        }
      } catch (refetchErr: unknown) {
        console.warn("[EditLesson] Refetch after save failed:", refetchErr);
        setSaveMsg("✅ Saved! (Could not reload the editor — refresh the page if content looks wrong.)");
      }
      if (curriculumAiReviewFeatureRef.current && id) {
        const pollId = id;
        void (async () => {
          const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
          let sawRunningOrQueued = false;
          const maxIterations = 24;
          for (let i = 0; i < maxIterations; i++) {
            await delay(i === 0 ? 1000 : 2000);
            try {
              const { curriculumAiReview } = await getCurriculumAiReview(pollId);
              setLesson((prev) =>
                prev && prev.id === pollId
                  ? { ...prev, curriculumAiReview: curriculumAiReview ?? undefined }
                  : null
              );
              const st = curriculumAiReview?.status;
              if (st === "running" || st === "queued") {
                sawRunningOrQueued = true;
                setSaveMsg("⏳ Curriculum review running…");
                continue;
              }
              if (st === "failed") {
                setSaveMsg("⚠️ Curriculum review failed. See details in the panel below.");
                setTimeout(() => setSaveMsg(""), 8000);
                return;
              }
              if (st === "completed") {
                if (sawRunningOrQueued) {
                  setSaveMsg("✅ Saved! Curriculum review updated.");
                  setTimeout(() => setSaveMsg(""), 6000);
                }
                return;
              }
              break;
            } catch {
              break;
            }
          }
          if (sawRunningOrQueued) {
            setSaveMsg("⏳ Curriculum review still running — refresh the panel or save again to update.");
            setTimeout(() => setSaveMsg(""), 6000);
          } else {
            setTimeout(() => setSaveMsg(""), 3000);
          }
        })();
      }
      return true;
    } catch (e: any) {
      console.error(e);
      const detail =
        (typeof e?.response?.data?.error === "string" && e.response.data.error) ||
        (typeof e?.response?.data?.msg === "string" && e.response.data.msg) ||
        (typeof e?.response?.data?.message === "string" && e.response.data.message) ||
        (typeof e?.message === "string" && e.message) ||
        "Save failed.";
      lastSaveFailureReasonRef.current = detail;
      setSaveMsg(`❌ ${detail}`);
      return false;
    } finally {
      setSaving(false);
      if (!curriculumAiReviewFeatureRef.current) {
        setTimeout(() => setSaveMsg(""), 2500);
      }
    }
  };

  const AI_ASSETS_PUBLISHED_MESSAGE =
    "AI assets can only be generated while the lesson is unpublished. Unpublish the lesson, then try again.";

  /** Saves the lesson, then generates draft topic-bank assets (flashcards + quiz; optional exam). Draft-only. */
  const handleGenerateAiLessonAssets = async () => {
    if (!id || !isMongoObjectId(id)) {
      setAiAssetsMessage("Cannot generate: lesson must be saved as a Mongo-backed lesson.");
      return;
    }
    if (lesson?.isPublished) {
      setAiAssetsMessage(AI_ASSETS_PUBLISHED_MESSAGE);
      return;
    }
    const topicNormForAssets = normalizeLessonTopicSlugFromLesson(
      {
        ...lesson,
        specKey: (lesson as { specKey?: string }).specKey,
        canonicalTopicKey: (lesson as { canonicalTopicKey?: string }).canonicalTopicKey,
      },
      taxonomyUnits
    );
    let effectiveTopicKey = topicNormForAssets.namespaced || topicKeyForBank;
    if (!effectiveTopicKey && lesson) {
      const specForResolve =
        (lesson as { specKey?: string }).specKey?.trim() || getSpecKeyFromLesson(lesson) || "";
      const lessonSubTopic = (lesson as { subTopic?: string }).subTopic;
      if (specForResolve) {
        effectiveTopicKey = await resolveTopicDisplayToKey(
          specForResolve,
          lesson.topic || lessonSubTopic || lesson.title || "",
          { subTopic: lessonSubTopic, title: lesson.title }
        );
      }
    }
    logTopicMappingDebug("generate-ai-assets", {
      specKey: (lesson as { specKey?: string }).specKey || getSpecKeyFromLesson(lesson),
      storedTopicKey: lesson?.topicKey || null,
      topicLabel: lesson?.topic || (lesson as { subTopic?: string }).subTopic || lesson?.title || null,
      normalizedTopicKey: topicNormForAssets.namespaced,
      taxonomyLookup: topicNormForAssets.slug,
      resolvedTopicKey: effectiveTopicKey,
    });
    if (!effectiveTopicKey) {
      setAiAssetsMessage(
        "Could not map this lesson to a syllabus sub-topic. Set Topic to a taxonomy label (e.g. Respiration for AQA GCSE Biology), save, or use Rebuild Graph — then try again."
      );
      return;
    }
    setAiAssetsMessage(null);
    setAiAssetsLoading(true);
    try {
      const saved = await saveToBackend();
      if (!saved) {
        const why = lastSaveFailureReasonRef.current?.trim();
        setAiAssetsMessage(
          why
            ? `Cannot generate yet: ${why}`
            : "Save failed or incomplete — fix errors, then click Generate AI assets again."
        );
        return;
      }
      const r = await generateLessonAssets(id, {
        generateFlashcards: true,
        generateQuizQuestions: true,
        generateExamQuestions: includeExamInAiAssets,
      });
      const g = r.generated;
      const st = r.examQuestionStats;
      const examLine =
        includeExamInAiAssets && st
          ? st.skippedInvalidCount > 0
            ? `${st.insertedCount} valid exam question${st.insertedCount === 1 ? "" : "s"}; ${st.skippedInvalidCount} skipped (failed exam quality rules).`
            : st.llmReturnedCount < st.requestedCount
              ? `${st.insertedCount} exam inserted (target ${st.requestedCount}; LLM returned ${st.llmReturnedCount})`
              : `${st.insertedCount} exam (target ${st.requestedCount})`
          : `${g.examQuestions} exam`;
      setAiAssetsMessage(
        `Drafts saved to your topic banks (not published): ${g.flashcards} flashcards, ${g.quizQuestions} quiz, ${examLine}.`
      );
      setAiReviewPanel((prev) => ({
        ...prev,
        lastRunAt: new Date().toISOString(),
        lessonUpdatedAtSnapshot: r.lessonUpdatedAtSnapshot ?? null,
        lastGenerated: g,
      }));
      await refreshAiLessonDraftCounts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setAiAssetsMessage(err?.response?.data?.error || err?.message || "Generation failed.");
    } finally {
      setAiAssetsLoading(false);
    }
  };

  function formatPublishOrSaveError(e: unknown): string {
    const err = e as {
      message?: string;
      data?: {
        error?: string;
        msg?: string;
        structureIssues?: string[];
        topIssues?: string[];
        topSuggestions?: string[];
      };
    };
    const base = err?.message || err?.data?.error || err?.data?.msg || "Request failed";
    const struct = err?.data?.structureIssues;
    if (Array.isArray(struct) && struct.length > 0) {
      return `${base}\n\n${struct.map((s) => `• ${s}`).join("\n")}`;
    }
    const top = err?.data?.topIssues;
    if (Array.isArray(top) && top.length > 0) {
      return `${base}\n\n${top.slice(0, 12).map((s) => `• ${s}`).join("\n")}`;
    }
    return base;
  }

  /** PR20: Compute local publish issues for gate modal (checkpoints, diagrams, practice, reviewed, structure). */
  function computeLocalPublishIssues(
    l: Lesson | null,
    attachedCount: number
  ): { issues: string[]; checkpointsCount: number; diagramsCount: number; practiceAttachedCount: number; notReviewed: boolean } {
    const pages = l?.pages ?? [];
    const checkpointsCount = countLessonCheckpoints(l);
    let diagramsCount = 0;
    for (const p of pages) {
      for (const b of p.blocks ?? []) {
        if (b?.type === "diagram") diagramsCount++;
      }
    }
    const practiceAttachedCount = attachedCount;
    const notReviewed = !l?.reviewedAt;
    const issues: string[] = [];
    if (checkpointsCount === 0) issues.push("No checkpoints");
    if (diagramsCount === 0) issues.push("No diagrams");
    if (practiceAttachedCount === 0) issues.push("No practice questions attached");
    if (notReviewed) issues.push("Lesson not marked as reviewed");
    // Contract structure validation
    issues.push(...validateLessonStructure(l));
    /** Phase 1: soft curriculum AI hints (same modal — “Publish anyway” still allowed). */
    if (curriculumAiReviewFeature && l && canRunCurriculumReview(l)) {
      const cr = l.curriculumAiReview;
      if (!cr || cr.status !== "completed" || !cr.result) {
        issues.push("Curriculum AI review not completed yet (recommended before publish)");
      } else {
        const m = Number((cr.result as { curriculumMatchScore?: number }).curriculumMatchScore);
        if (Number.isFinite(m) && m < CURRICULUM_PUBLISH_MIN_SCORE) {
          issues.push(
            `Curriculum match score (${m}) is below recommended (${CURRICULUM_PUBLISH_MIN_SCORE}) — you can still publish`
          );
        }
      }
    }
    return { issues, checkpointsCount, diagramsCount, practiceAttachedCount, notReviewed };
  }

  const handlePublishToggle = async (skipGate?: boolean) => {
    if (!lesson || !id || !isMongoObjectId(id)) return;

    const newStatus = !lesson.isPublished;

    /** PR-014.1: For generated content, run publish gate check first */
    const jobId = lesson.metadata?.generatedFrom?.jobId;
    if (newStatus && jobId && !skipGate) {
      try {
        const check = await getPublishGateCheck({ scope: "starterPack", jobId });
        if (!check.ok) {
          setPublishGateGeneratedResult(check);
          setPublishGateGeneratedOpen(true);
          return;
        }
      } catch (e) {
        console.warn("[EditLessonPage] Publish gate check failed:", e);
        // Proceed if check fails (network etc) — CTO could tighten
      }
    }

    /** PR20: Readiness gate — when publishing, if issues exist open modal unless skipGate */
    if (newStatus && !skipGate) {
      const { issues } = computeLocalPublishIssues(lesson, attachedExamQuestions.length);
      if (issues.length > 0) {
        setPublishGateIssues(issues);
        setPublishGateOpen(true);
        return;
      }
    }

    if (lesson?.createdFromTemplate && !lesson.isPublished) {
      const ok = window.confirm(
        "This lesson was created from a template.\n\nHave you reviewed and customised it before publishing?"
      );
      if (!ok) return;
    }

    try {
      setPublishing(true);
      setSaveMsg("");

      const persistPayload = getLessonPersistPayload();
      if (!persistPayload) {
        setSaveMsg("❌ Nothing to save.");
        return;
      }

      /**
       * Publish: save draft first, then PATCH publish (validation uses DB snapshot).
       * Unpublish: PATCH first (teacher cannot PUT while published), then save draft content.
       */
      let publishData: {
        publishedWithWarnings?: boolean;
        publishWarningSummary?: PublishWarningSummary;
        publishWarnings?: string[];
        msg?: string;
        curriculumReviewPublishWarning?: { message?: string; code?: string };
        publishedWithCurriculumHint?: boolean;
      } | null = null;

      if (newStatus) {
        let savedOk = false;
        if (isAdmin) {
          try {
            await api.put(`/admin/lessons/${id}`, persistPayload);
            savedOk = true;
          } catch {
            /* fall through to teacher route */
          }
        }
        if (!savedOk) {
          await api.put(`/lessons/${id}`, persistPayload);
        }
        const pubRes = await api.patch(`/lessons/${id}/publish`, { isPublished: true });
        publishData = pubRes.data;
      } else {
        await api.patch(`/lessons/${id}/publish`, { isPublished: false });
        let savedOk = false;
        if (isAdmin) {
          try {
            await api.put(`/admin/lessons/${id}`, persistPayload);
            savedOk = true;
          } catch {
            /* fall through */
          }
        }
        if (!savedOk) {
          await api.put(`/lessons/${id}`, persistPayload);
        }
      }

      if (newStatus && publishData?.publishedWithWarnings && publishData?.publishWarningSummary) {
        let msg = formatPublishWithQualityWarningsMessage(publishData.publishWarningSummary, {
          leadingSuccessEmoji: true,
        });
        if (publishData.curriculumReviewPublishWarning?.message) {
          msg += `\n\n${publishData.curriculumReviewPublishWarning.message}`;
        }
        setSaveMsg(msg);
        setTimeout(() => setSaveMsg(""), 16000);
      } else if (
        newStatus &&
        publishData?.publishedWithWarnings &&
        Array.isArray(publishData.publishWarnings) &&
        publishData.publishWarnings.length > 0
      ) {
        let msg = `✅ Lesson published successfully, with quality warnings.\n\n${publishData.publishWarnings.map((w) => `• ${w}`).join("\n")}`;
        if (publishData.curriculumReviewPublishWarning?.message) {
          msg += `\n\n${publishData.curriculumReviewPublishWarning.message}`;
        }
        setSaveMsg(msg);
        setTimeout(() => setSaveMsg(""), 16000);
      } else if (newStatus && publishData?.curriculumReviewPublishWarning?.message) {
        setSaveMsg(`✅ Lesson published.\n\n${publishData.curriculumReviewPublishWarning.message}`);
        setTimeout(() => setSaveMsg(""), 12000);
      } else {
        setSaveMsg(newStatus ? "✅ Lesson published!" : "✅ Lesson unpublished.");
        setTimeout(() => setSaveMsg(""), 2500);
      }
      setLesson((prev) => (prev ? { ...prev, isPublished: newStatus } : null));
      if (newStatus) setPostPublishClassroomModalOpen(true);
      setPublishGateOpen(false);
      await fetchLessonSmart();
    } catch (e: unknown) {
      console.error(e);
      const msg = formatPublishOrSaveError(e);
      setSaveMsg(msg);
      setTimeout(() => setSaveMsg(""), msg.includes("•") ? 12000 : 2500);
    } finally {
      setPublishing(false);
    }
  };

  const previewBox: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "2px solid rgba(0,0,0,0.14)",
    background: "white",
    marginTop: 10,
    minWidth: 0,
    maxWidth: "100%",
    boxSizing: "border-box",
  };

  const markdownComponents = {
    img: ({ ...props }: any) => {
      const rawSrc = safeStr(props.src, "");
      let decoded = rawSrc;
      try {
        if (rawSrc && rawSrc.includes("%")) decoded = decodeURIComponent(rawSrc);
      } catch {
        /* keep decoded as rawSrc */
      }
      const srcAbs = decoded ? (makeAbsoluteAssetUrl(decoded) ?? "") : "";
      const finalSrc = srcAbs || decoded || rawSrc;
      return (
        <img
          {...props}
          src={finalSrc}
          style={{
            maxWidth: "100%",
            height: "auto",
            borderRadius: 10,
            display: "block",
            margin: "12px auto",
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
          alt={props.alt || "Lesson image"}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      );
    },
    a: ({ ...props }: any) => {
      const href = safeStr(props.href, "");
      const childStr = typeof props.children === "string"
        ? props.children
        : (Array.isArray(props.children) && typeof props.children[0] === "string" ? props.children[0] : "");
      const isVideoLink = (childStr && String(childStr).startsWith("Video:")) && href;
      if (isVideoLink) {
        const srcAbs = href.startsWith("http") ? href : (makeAbsoluteAssetUrl(href) ?? href);
        return (
          <div style={{ margin: "12px 0", textAlign: "center" }}>
            <video
              controls
              src={srcAbs}
              style={{ width: "100%", maxWidth: 720, borderRadius: 12, background: "#000" }}
            />
            {childStr !== "Video:" && (
              <div style={{ marginTop: 6, fontSize: "0.9rem", color: "#6b7280" }}>
                {childStr.replace(/^Video:\s*/, "")}
              </div>
            )}
          </div>
        );
      }
      return (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {props.children}
        </a>
      );
    },
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lesson...</h2>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>{error || "Lesson not found"}</h2>
        <Link to={backHref} style={{ color: "#667eea", textDecoration: "none" }}>
          ← Back
        </Link>
      </div>
    );
  }

  if (isUuid(lesson.id)) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
        <Link to={backHref} style={{ color: "#667eea", textDecoration: "none" }}>
          ← Back
        </Link>

        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            border: "2px solid rgba(0,0,0,0.14)",
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Edit Lesson (Legacy)</h2>
          <p style={{ margin: 0, color: "rgba(0,0,0,0.75)" }}>
            This lesson is stored in the older Supabase system. The new Pages/Blocks editor is currently enabled for Mongo lessons.
            If you want, recreate this lesson using "Create Lesson" (Pages mode) and publish that version.
          </p>
        </div>
      </div>
    );
  }

  const pagesReady = hasStructuredPages && currentPage;

  const renderLessonActionsPanel = (cardClassName: string) => (
    <div className={cardClassName}>
      <div className="edit-lesson-lesson-actions-card__title">Lesson actions</div>

      {saving || (saveMsg && saveMsg.startsWith("✅")) ? (
        <span
          className="edit-lesson-save-state-indicator"
          data-state={saving ? "saving" : "saved"}
          aria-live="polite"
        >
          {saving ? "Saving..." : "Saved"}
        </span>
      ) : null}

      {uploadMsg ? (
        <div className="edit-lesson-lesson-actions-card__status edit-lesson-lesson-actions-card__status--ok">
          {uploadMsg}
        </div>
      ) : null}

      {saveMsg ? (
        <div
          className="edit-lesson-lesson-actions-card__status"
          style={{
            color: saveMsg.startsWith("✅")
              ? "#15803d"
              : saveMsg.startsWith("🚫") || saveMsg.startsWith("✋")
                ? "#b45309"
                : saveMsg.startsWith("⏳") || saveMsg.startsWith("⚠️")
                  ? "#92400e"
                  : "#b91c1c",
          }}
        >
          {saveMsg}
        </div>
      ) : null}

      <div className="edit-lesson-lesson-actions-card__stack">
        <button
          type="button"
          onClick={saveToBackend}
          disabled={saving}
          className="edit-lesson-lesson-actions-card__btn edit-lesson-lesson-actions-card__btn--primary"
          style={{
            border: "2px solid rgba(0,0,0,0.18)",
            background: saving ? "#e5e7eb" : "white",
            cursor: saving ? "not-allowed" : "pointer",
            color: "#111827",
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <button
          type="button"
          onClick={() => handlePublishToggle()}
          disabled={publishing}
          className="edit-lesson-lesson-actions-card__btn"
          style={{
            border: lesson.isPublished ? "2px solid rgba(239,68,68,0.5)" : "2px solid rgba(16,185,129,0.5)",
            background: publishing ? "#e5e7eb" : lesson.isPublished ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
            cursor: publishing ? "not-allowed" : "pointer",
            color: lesson.isPublished ? "#b91c1c" : "#15803d",
          }}
        >
          {publishing ? "Processing..." : lesson.isPublished ? "Unpublish Lesson" : "Publish Lesson"}
        </button>

        {lesson && isMongoObjectId(id || "") ? (
          <>
            <span className="edit-lesson-lesson-actions-card__ai-label">AI topic banks</span>
            <span className="edit-lesson-lesson-actions-card__ai-hint">
              Generate while lesson is draft/unpublished.
            </span>
            <button
              type="button"
              onClick={() => void handleGenerateAiLessonAssets()}
              disabled={aiAssetsLoading || saving || !!lesson?.isPublished}
              className="edit-lesson-lesson-actions-card__btn edit-lesson-lesson-actions-card__btn--ai"
              title={
                lesson?.isPublished
                  ? AI_ASSETS_PUBLISHED_MESSAGE
                  : !topicKeyForBank
                    ? "Topic mapping may be incomplete — generation will try to repair from Topic/Title on save."
                    : "Saves your lesson, then creates draft flashcards and quiz in your topic banks (optional exam)."
              }
              style={{
                background: aiAssetsLoading || saving || !!lesson?.isPublished ? "#d8b4fe" : "#7c3aed",
                cursor:
                  aiAssetsLoading || saving || !!lesson?.isPublished ? "not-allowed" : "pointer",
              }}
            >
              {aiAssetsLoading ? "Working…" : "Generate AI assets"}
            </button>
            <label className="edit-lesson-lesson-actions-card__checkbox">
              <input
                type="checkbox"
                checked={includeExamInAiAssets}
                onChange={(e) => setIncludeExamInAiAssets(e.target.checked)}
                disabled={aiAssetsLoading || saving || !!lesson?.isPublished}
              />
              Include exam drafts
            </label>
          </>
        ) : null}

        {curriculumAiReviewFeature && lesson && canRunCurriculumReview(lesson) ? (
          <button
            type="button"
            onClick={() => void handleCurriculumCheck()}
            disabled={
              curriculumReviewLoading ||
              lesson.curriculumAiReview?.status === "running" ||
              lesson.curriculumAiReview?.status === "queued"
            }
            className="edit-lesson-lesson-actions-card__btn"
            title="AI compares this draft to your spec/topic context. Nothing is changed automatically."
            style={{
              border: "2px solid rgba(99,102,241,0.45)",
              background:
                curriculumReviewLoading ||
                lesson.curriculumAiReview?.status === "running" ||
                lesson.curriculumAiReview?.status === "queued"
                  ? "#e5e7eb"
                  : "rgba(238,242,255,0.95)",
              cursor:
                curriculumReviewLoading ||
                lesson.curriculumAiReview?.status === "running" ||
                lesson.curriculumAiReview?.status === "queued"
                  ? "not-allowed"
                  : "pointer",
              color: "#3730a3",
              fontWeight: 800,
            }}
          >
            {curriculumReviewLoading ||
            lesson.curriculumAiReview?.status === "running" ||
            lesson.curriculumAiReview?.status === "queued"
              ? "Checking…"
              : lesson.curriculumAiReview?.status === "failed"
                ? "Retry curriculum check"
                : "Check against curriculum"}
          </button>
        ) : null}
      </div>

      {(aiAssetsMessage || hasAiLessonDraftReviewToolbar) ? (
        <div className="edit-lesson-lesson-actions-card__subpanel">
          {aiAssetsMessage ? <div>{aiAssetsMessage}</div> : null}
          {hasAiLessonDraftReviewToolbar && topicKeyForBank && id ? (
            <div className="edit-lesson-lesson-actions-card__draft-links">
              {aiReviewPanel.pendingDrafts.flashcards > 0 ? (
                <Link
                  to={buildAiLessonAssetBankReviewUrl("flashcards", {
                    topicKeySlug: topicKeyForBank.includes(":")
                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                      : topicKeyForBank,
                    specKey:
                      (lesson as { specKey?: string })?.specKey ||
                      topicKeyForBank.split(":")[0] ||
                      getStoredSpecKey(),
                    lessonId: id,
                  })}
                >
                  Review flashcard drafts
                </Link>
              ) : null}
              {aiReviewPanel.pendingDrafts.quizQuestions > 0 ? (
                <Link
                  to={buildAiLessonAssetBankReviewUrl("quizzes", {
                    topicKeySlug: topicKeyForBank.includes(":")
                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                      : topicKeyForBank,
                    specKey:
                      (lesson as { specKey?: string })?.specKey ||
                      topicKeyForBank.split(":")[0] ||
                      getStoredSpecKey(),
                    lessonId: id,
                  })}
                >
                  Review quiz drafts
                </Link>
              ) : null}
              {aiReviewPanel.pendingDrafts.examQuestions > 0 ? (
                <Link
                  to={buildAiLessonAssetExamReviewUrl({
                    topicKeySlug: topicKeyForBank.includes(":")
                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                      : topicKeyForBank,
                    specKey:
                      (lesson as { specKey?: string })?.specKey ||
                      topicKeyForBank.split(":")[0] ||
                      getStoredSpecKey(),
                    lessonId: id,
                  })}
                >
                  Review exam drafts
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  /** Wide layout only: actions sit in margin left of the bordered editor frame, not inside the left sidebar. */
  const showOutsideActionsRail = layoutBreakpoint === "wide";

  const renderTopActionRow = () => (
    <div className="edit-lesson-top-action-row">
      <Link to={backHref} style={{ color: "#667eea", textDecoration: "none" }}>
        ← Back
      </Link>

      <div className="edit-lesson-top-action-row__actions">
        {uploadMsg ? <span style={{ fontWeight: 900, color: "#15803d" }}>{uploadMsg}</span> : null}

        {saveMsg ? (
          <span
            style={{
              fontWeight: 800,
              color: saveMsg.startsWith("✅")
                ? "#15803d"
                : saveMsg.startsWith("🚫") || saveMsg.startsWith("✋")
                  ? "#b45309"
                  : saveMsg.startsWith("⏳") || saveMsg.startsWith("⚠️")
                    ? "#92400e"
                    : "#b91c1c",
            }}
          >
            {saveMsg}
          </span>
        ) : null}

        <button
          type="button"
          onClick={() => handlePublishToggle()}
          disabled={publishing}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: lesson.isPublished ? "2px solid rgba(239,68,68,0.5)" : "2px solid rgba(16,185,129,0.5)",
            background: publishing ? "#e5e7eb" : lesson.isPublished ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)",
            cursor: publishing ? "not-allowed" : "pointer",
            fontWeight: 900,
            color: lesson.isPublished ? "#b91c1c" : "#15803d",
          }}
        >
          {publishing ? "Processing..." : lesson.isPublished ? "Unpublish Lesson" : "Publish Lesson"}
        </button>

        <button
          type="button"
          onClick={saveToBackend}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "2px solid rgba(0,0,0,0.18)",
            background: saving ? "#e5e7eb" : "white",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 900,
          }}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {lesson && isMongoObjectId(id || "") ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              padding: "8px 12px",
              borderRadius: 10,
              border: "2px solid rgba(124,58,237,0.35)",
              background: "#f5f3ff",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 13, color: "#5b21b6" }}>AI topic banks</span>
            <span style={{ fontSize: 12, color: "#6d28d9" }}>
              Generate while lesson is draft/unpublished.
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4c1d95", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={includeExamInAiAssets}
                onChange={(e) => setIncludeExamInAiAssets(e.target.checked)}
                disabled={aiAssetsLoading || saving || !!lesson?.isPublished}
              />
              Include exam drafts
            </label>
            <button
              type="button"
              onClick={() => void handleGenerateAiLessonAssets()}
              disabled={aiAssetsLoading || saving || !!lesson?.isPublished}
              title={
                lesson?.isPublished
                  ? AI_ASSETS_PUBLISHED_MESSAGE
                  : !topicKeyForBank
                    ? "Topic mapping may be incomplete — generation will try to repair from Topic/Title on save."
                    : "Saves your lesson, then creates draft flashcards and quiz in your topic banks (optional exam)."
              }
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "none",
                background: aiAssetsLoading || saving || !!lesson?.isPublished ? "#d8b4fe" : "#7c3aed",
                color: "#fff",
                cursor: aiAssetsLoading || saving || !!lesson?.isPublished ? "not-allowed" : "pointer",
                fontWeight: 900,
                fontSize: 14,
              }}
            >
              {aiAssetsLoading ? "Working…" : "Generate AI assets"}
            </button>
          </div>
        ) : null}

        {curriculumAiReviewFeature && lesson && canRunCurriculumReview(lesson) ? (
          <button
            type="button"
            onClick={() => void handleCurriculumCheck()}
            disabled={
              curriculumReviewLoading ||
              lesson.curriculumAiReview?.status === "running" ||
              lesson.curriculumAiReview?.status === "queued"
            }
            title="AI compares this draft to your spec/topic context. Nothing is changed automatically."
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "2px solid rgba(99,102,241,0.45)",
              background:
                curriculumReviewLoading ||
                lesson.curriculumAiReview?.status === "running" ||
                lesson.curriculumAiReview?.status === "queued"
                  ? "#e5e7eb"
                  : "#eef2ff",
              cursor:
                curriculumReviewLoading ||
                lesson.curriculumAiReview?.status === "running" ||
                lesson.curriculumAiReview?.status === "queued"
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 800,
              color: "#3730a3",
            }}
          >
            {curriculumReviewLoading ||
            lesson.curriculumAiReview?.status === "running" ||
            lesson.curriculumAiReview?.status === "queued"
              ? "Checking…"
              : lesson.curriculumAiReview?.status === "failed"
                ? "Retry curriculum check"
                : "Check against curriculum"}
          </button>
        ) : null}
      </div>

      {(aiAssetsMessage || hasAiLessonDraftReviewToolbar) ? (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            fontSize: 13,
            color: "#5b21b6",
            background: "#faf5ff",
            borderRadius: 10,
            border: "1px solid #e9d5ff",
            maxWidth: 720,
            width: "100%",
          }}
        >
          {aiAssetsMessage ? <div>{aiAssetsMessage}</div> : null}
          {hasAiLessonDraftReviewToolbar && topicKeyForBank && id ? (
            <div style={{ marginTop: aiAssetsMessage ? 10 : 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {aiReviewPanel.pendingDrafts.flashcards > 0 ? (
                <Link
                  to={buildAiLessonAssetBankReviewUrl("flashcards", {
                    topicKeySlug: topicKeyForBank.includes(":")
                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                      : topicKeyForBank,
                    specKey:
                      (lesson as { specKey?: string })?.specKey ||
                      topicKeyForBank.split(":")[0] ||
                      getStoredSpecKey(),
                    lessonId: id,
                  })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "#7c3aed",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  Review flashcard drafts
                </Link>
              ) : null}
              {aiReviewPanel.pendingDrafts.quizQuestions > 0 ? (
                <Link
                  to={buildAiLessonAssetBankReviewUrl("quizzes", {
                    topicKeySlug: topicKeyForBank.includes(":")
                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                      : topicKeyForBank,
                    specKey:
                      (lesson as { specKey?: string })?.specKey ||
                      topicKeyForBank.split(":")[0] ||
                      getStoredSpecKey(),
                    lessonId: id,
                  })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "#7c3aed",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  Review quiz drafts
                </Link>
              ) : null}
              {aiReviewPanel.pendingDrafts.examQuestions > 0 ? (
                <Link
                  to={buildAiLessonAssetExamReviewUrl({
                    topicKeySlug: topicKeyForBank.includes(":")
                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                      : topicKeyForBank,
                    specKey:
                      (lesson as { specKey?: string })?.specKey ||
                      topicKeyForBank.split(":")[0] ||
                      getStoredSpecKey(),
                    lessonId: id,
                  })}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "#7c3aed",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: "none",
                  }}
                >
                  Review exam drafts
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      data-lesson-editor="true"
      style={{
        padding: "8px 0",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {generationWarning && (
        <Toast
          message={generationWarning}
          type="warning"
          duration={6000}
          onClose={() => setGenerationWarning(null)}
        />
      )}
      {attachPageQuizToast && (
        <Toast
          message={attachPageQuizToast}
          type="success"
          duration={4000}
          onClose={() => setAttachPageQuizToast(null)}
        />
      )}
      {graphRebuildToast && (
        <Toast
          message={graphRebuildToast}
          type="success"
          duration={2500}
          onClose={() => setGraphRebuildToast(null)}
        />
      )}
      {selfCheckImportToast && (
        <Toast
          message={selfCheckImportToast.message}
          type={selfCheckImportToast.type}
          duration={6000}
          onClose={() => setSelfCheckImportToast(null)}
        />
      )}
    <div
      className="edit-lesson-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%)",
        padding: "12px 0",
        boxSizing: "border-box",
      }}
    >
        <div
          ref={editorLayoutShellRef}
          className="edit-lesson-editor-column"
        >
        {lesson?.createdFromTemplate && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontWeight: 600,
            }}
          >
            ⚠️ This lesson was created from a template. Review and customise before publishing.
          </div>
        )}

        {showOutsideActionsRail ? (
          <div className="edit-lesson-page-top-nav" style={{ marginBottom: 12 }}>
            <Link to={backHref} className="edit-lesson-page-top-nav__back">
              ← Back
            </Link>
          </div>
        ) : (
          renderTopActionRow()
        )}

        <div
          className={
            showOutsideActionsRail
              ? "edit-lesson-frame-row edit-lesson-frame-row--with-outside-rail"
              : "edit-lesson-frame-row"
          }
        >
          {showOutsideActionsRail ? (
            <aside className="edit-lesson-outside-actions-rail" aria-label="Lesson actions">
              {renderLessonActionsPanel("edit-lesson-lesson-actions-card")}
            </aside>
          ) : null}

        <div
          className="edit-lesson-layout-shell"
          style={{
            border: "4px solid rgba(17,24,39,0.35)",
            borderRadius: 18,
            background: "rgba(255,255,255,0.78)",
            boxShadow: "0 18px 46px rgba(0,0,0,0.14)",
            padding: 16,
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          {layoutBreakpoint === "narrow" && (
            <div
              role="tablist"
              aria-label="Editor or preview"
              style={{
                display: "flex",
                gap: 8,
                marginBottom: 14,
                padding: 4,
                borderRadius: 12,
                background: "rgba(15,23,42,0.06)",
                border: "1px solid rgba(15,23,42,0.12)",
              }}
            >
              {(["edit", "preview"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={mobileEditorTab === tab}
                  onClick={() => setMobileEditorTab(tab)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: mobileEditorTab === tab ? "2px solid rgba(59,130,246,0.45)" : "2px solid transparent",
                    background: mobileEditorTab === tab ? "white" : "transparent",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    color: mobileEditorTab === tab ? "#1d4ed8" : "#64748b",
                  }}
                >
                  {tab === "edit" ? "Edit" : "Preview"}
                </button>
              ))}
            </div>
          )}
          <div
            data-col="wrapper"
            className={`edit-lesson-layout-grid edit-lesson-layout-grid--${
              layoutBreakpoint === "wide" ? "wide" : layoutBreakpoint === "medium" ? "medium" : "narrow"
            }`}
            style={{
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
            }}
          >
            {/* LEFT RAIL: Teacher guide + Pages + Readiness + Practice questions (in lesson) */}
            <div
              data-col="left"
              className="edit-lesson-left-rail"
              style={{
                display:
                  layoutBreakpoint === "narrow" && mobileEditorTab === "preview" ? "none" : "flex",
                flexDirection: "column",
                gap: 16,
                minWidth: 0,
                maxWidth: "100%",
              }}
            >
              {/* Card 1: Teacher editor guide */}
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                  border: "2px solid rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>
                  {isAdmin ? "Admin editor" : "Teacher editor"}
                </div>
                <HowToCreateLessonCallout />
                <div style={{ color: "#6b7280", fontSize: "0.92rem", marginTop: 10 }}>
                  Edit pages/blocks. Use "Upload image / video" inside blocks to insert media exactly where your cursor is.
                </div>
              </div>

              {/* Curriculum AI review (draft; opt-in on server) */}
              {curriculumAiReviewFeature && lesson && canRunCurriculumReview(lesson) ? (
                <div
                  id="curriculum-ai-review"
                  style={{
                    background: "white",
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                    border: "2px solid rgba(99,102,241,0.22)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6, color: "#1e1b4b" }}>
                    Curriculum alignment (AI)
                  </div>
                  <p style={{ color: "#64748b", fontSize: "0.88rem", margin: "0 0 10px" }}>
                    Suggestions only — your lesson text is not changed. Apply edits yourself when ready.
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: "0 0 10px", fontStyle: "italic" }}>
                    Tip: run a curriculum check before publish if you can — publishing stays available either way.
                  </p>
                  {lesson.curriculumAiReview?.status === "failed" && lesson.curriculumAiReview.lastError ? (
                    <div
                      role="alert"
                      style={{
                        fontSize: "0.88rem",
                        color: "#b91c1c",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        padding: "8px 10px",
                        borderRadius: 8,
                        marginBottom: 10,
                      }}
                    >
                      {lesson.curriculumAiReview.lastError}
                    </div>
                  ) : null}
                  {(lesson.curriculumAiReview?.status === "running" ||
                    lesson.curriculumAiReview?.status === "queued") && (
                    <p style={{ fontSize: "0.9rem", color: "#4f46e5", marginBottom: 8 }}>
                      Review in progress… You can keep editing; refresh this page or save again to update status.
                    </p>
                  )}
                  {lesson.curriculumAiReview?.status === "completed" && lesson.curriculumAiReview.result ? (
                    <div style={{ fontSize: "0.88rem", color: "#334155" }}>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                        <span>
                          <strong>Spec match:</strong>{" "}
                          {lesson.curriculumAiReview.result.curriculumMatchScore ?? "—"}%
                        </span>
                        <span>
                          <strong>Lesson quality:</strong>{" "}
                          {lesson.curriculumAiReview.result.lessonQualityScore ?? "—"}%
                        </span>
                        {lesson.curriculumAiReview.generatedAt ? (
                          <span style={{ color: "#94a3b8" }}>
                            {new Date(lesson.curriculumAiReview.generatedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      {Array.isArray(lesson.curriculumAiReview.result.issues) &&
                      lesson.curriculumAiReview.result.issues.length > 0 ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Issues</summary>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                            {lesson.curriculumAiReview.result.issues.map((t: string, i: number) => (
                              <li key={`iss-${i}`}>{t}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      {Array.isArray(lesson.curriculumAiReview.result.warnings) &&
                      lesson.curriculumAiReview.result.warnings.length > 0 ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Warnings</summary>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                            {lesson.curriculumAiReview.result.warnings.map((t: string, i: number) => (
                              <li key={`warn-${i}`}>{t}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      {Array.isArray(lesson.curriculumAiReview.result.missingCoverage) &&
                      lesson.curriculumAiReview.result.missingCoverage.length > 0 ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Missing coverage</summary>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                            {lesson.curriculumAiReview.result.missingCoverage.map((t: string, i: number) => (
                              <li key={`miss-${i}`}>{t}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                      {Array.isArray(lesson.curriculumAiReview.result.terminologyFixes) &&
                      lesson.curriculumAiReview.result.terminologyFixes.length > 0 ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Terminology</summary>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                            {lesson.curriculumAiReview.result.terminologyFixes.map(
                              (x: { from: string; to: string; note: string }, i: number) => (
                                <li key={`term-${i}`}>
                                  <em>{x.from}</em> → <strong>{x.to}</strong>
                                  {x.note ? ` — ${x.note}` : ""}
                                </li>
                              )
                            )}
                          </ul>
                        </details>
                      ) : null}
                      {Array.isArray(lesson.curriculumAiReview.result.suggestedRewrites) &&
                      lesson.curriculumAiReview.result.suggestedRewrites.length > 0 ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Suggested rewrites</summary>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, listStyle: "none" }}>
                            {lesson.curriculumAiReview.result.suggestedRewrites.map(
                              (
                                x: {
                                  section: string;
                                  originalSnippet: string;
                                  suggestion: string;
                                  note: string;
                                },
                                i: number
                              ) => (
                                <li
                                  key={`rw-${i}`}
                                  style={{
                                    marginBottom: 10,
                                    borderLeft: "3px solid #c7d2fe",
                                    paddingLeft: 10,
                                  }}
                                >
                                  {x.section ? <div style={{ fontWeight: 600 }}>{x.section}</div> : null}
                                  {x.originalSnippet ? (
                                    <div style={{ color: "#64748b", whiteSpace: "pre-wrap" }}>
                                      {x.originalSnippet}
                                    </div>
                                  ) : null}
                                  {x.suggestion ? (
                                    <div style={{ whiteSpace: "pre-wrap" }}>{x.suggestion}</div>
                                  ) : null}
                                  {x.note ? <div style={{ color: "#94a3b8" }}>{x.note}</div> : null}
                                </li>
                              )
                            )}
                          </ul>
                        </details>
                      ) : null}
                      {(Array.isArray(lesson.curriculumAiReview.result.suggestedObjectives) &&
                        lesson.curriculumAiReview.result.suggestedObjectives.length > 0) ||
                      (Array.isArray(lesson.curriculumAiReview.result.suggestedPriorKnowledge) &&
                        lesson.curriculumAiReview.result.suggestedPriorKnowledge.length > 0) ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                            Objectives / prior knowledge
                          </summary>
                          {Array.isArray(lesson.curriculumAiReview.result.suggestedObjectives) &&
                          lesson.curriculumAiReview.result.suggestedObjectives.length > 0 ? (
                            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                              {lesson.curriculumAiReview.result.suggestedObjectives.map((t: string, i: number) => (
                                <li key={`obj-${i}`}>{t}</li>
                              ))}
                            </ul>
                          ) : null}
                          {Array.isArray(lesson.curriculumAiReview.result.suggestedPriorKnowledge) &&
                          lesson.curriculumAiReview.result.suggestedPriorKnowledge.length > 0 ? (
                            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                              {lesson.curriculumAiReview.result.suggestedPriorKnowledge.map((t: string, i: number) => (
                                <li key={`pk-${i}`}>{t}</li>
                              ))}
                            </ul>
                          ) : null}
                        </details>
                      ) : null}
                      {Array.isArray(lesson.curriculumAiReview.result.suggestedKeywords) &&
                      lesson.curriculumAiReview.result.suggestedKeywords.length > 0 ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Keywords to consider</summary>
                          <p style={{ margin: "6px 0 0" }}>
                            {lesson.curriculumAiReview.result.suggestedKeywords.join(", ")}
                          </p>
                        </details>
                      ) : null}
                      {(Array.isArray(lesson.curriculumAiReview.result.examAlignmentNotes) &&
                        lesson.curriculumAiReview.result.examAlignmentNotes.length > 0) ||
                      (Array.isArray(lesson.curriculumAiReview.result.checkpointAlignmentNotes) &&
                        lesson.curriculumAiReview.result.checkpointAlignmentNotes.length > 0) ? (
                        <details style={{ marginBottom: 8 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Exam / checkpoint notes</summary>
                          {Array.isArray(lesson.curriculumAiReview.result.examAlignmentNotes) &&
                          lesson.curriculumAiReview.result.examAlignmentNotes.length > 0 ? (
                            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                              {lesson.curriculumAiReview.result.examAlignmentNotes.map((t: string, i: number) => (
                                <li key={`ex-${i}`}>{t}</li>
                              ))}
                            </ul>
                          ) : null}
                          {Array.isArray(lesson.curriculumAiReview.result.checkpointAlignmentNotes) &&
                          lesson.curriculumAiReview.result.checkpointAlignmentNotes.length > 0 ? (
                            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                              {lesson.curriculumAiReview.result.checkpointAlignmentNotes.map((t: string, i: number) => (
                                <li key={`ck-${i}`}>{t}</li>
                              ))}
                            </ul>
                          ) : null}
                        </details>
                      ) : null}
                    </div>
                  ) : lesson.curriculumAiReview?.status === "completed" && !lesson.curriculumAiReview.result ? (
                    <p style={{ fontSize: "0.88rem", color: "#64748b" }}>No structured result stored.</p>
                  ) : null}
                </div>
              ) : null}

              {/* Card 2: Pages */}
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                  border: "2px solid rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>Pages</div>
                <button
                  onClick={addPage}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "2px solid rgba(0,0,0,0.16)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                    marginBottom: 10,
                  }}
                >
                  + Add page
                </button>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(orderedPages || []).map((p, idx) => {
                    const isCurrent = pagesReady ? idx === currentPageIndex : false;
                    const issueCount = reportsByPage.get(p.pageId) ?? 0;
                    return (
                      <div
                        key={p.pageId || idx}
                        style={{
                          border: "2px solid rgba(0,0,0,0.14)",
                          borderRadius: 12,
                          padding: 10,
                          background: isCurrent ? "#eef2ff" : "white",
                        }}
                      >
                        <button
                          onClick={() => goToPage(p)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontWeight: 900,
                            color: "#111827",
                            padding: 0,
                            marginBottom: 6,
                          }}
                        >
                          {p.title || `Page ${p.order}`}
                          {issueCount > 0 && (
                            <span
                              style={{
                                marginLeft: 6,
                                padding: "2px 6px",
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                            >
                              {issueCount}
                            </span>
                          )}
                        </button>
                        <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
                          <button onClick={() => movePage(p.pageId, -1)} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "2px solid rgba(0,0,0,0.12)", background: "white", cursor: "pointer", fontWeight: 800 }}>↑</button>
                          <button onClick={() => movePage(p.pageId, 1)} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "2px solid rgba(0,0,0,0.12)", background: "white", cursor: "pointer", fontWeight: 800 }}>↓</button>
                          <button onClick={() => removePage(p.pageId)} style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "2px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.06)", cursor: "pointer", fontWeight: 900, color: "#b91c1c" }}>🗑</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 3: Readiness — moved from center */}
              {(() => {
                const evalReadiness = lesson
                  ? evaluateLessonReadiness(lesson, { resolvedTopicKey: topicKeyForBank })
                  : null;
                const topicCheck = evalReadiness?.checks.find((c) => c.key === "topic");
                const statusLabel = evalReadiness?.classroomReady ? "Classroom-ready" : evalReadiness?.minimumPublishable ? "Ready to publish" : "Needs review";
                const statusBg = evalReadiness?.classroomReady ? "#c6f6d5" : evalReadiness?.minimumPublishable ? "#fef3c7" : "#e5e7eb";
                const statusColor = evalReadiness?.classroomReady ? "#22543d" : evalReadiness?.minimumPublishable ? "#92400e" : "#4b5563";
                const c = evalReadiness?.counts ?? { pages: 0, diagrams: 0, checkpoints: 0, quizQuestions: 0, flashcards: 0, practiceAttached: 0, misconceptions: 0 };
                const isReviewed = !!lesson?.reviewedAt || (lesson?.readiness as any)?.signals?.isReviewed;
                const teacherBrainBriefCount = lesson?.pages
                  ? countTeacherBrainBriefsInPages(lesson.pages)
                  : 0;
                const teacherBrainEligible = lesson?.pages
                  ? countTeacherBrainEligibleActivityBlocks(lesson.pages)
                  : 0;
                return (
                  <div style={{ background: "white", borderRadius: 14, padding: 14, boxShadow: "0 10px 22px rgba(0,0,0,0.08)", border: "2px solid rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontWeight: 900 }}>Readiness</span>
                      <a href="/docs/TEACHER_LESSON_GUIDES_INDEX.md" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#64748b" }}>What is this?</a>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold", background: statusBg, color: statusColor }}>{statusLabel}</span>
                    </div>
                    <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                      <li>Pages: {c.pages}</li>
                      <li>Checkpoints: {c.checkpoints}</li>
                      <li>Diagrams: {c.diagrams}</li>
                      <li>Quiz: {c.quizQuestions}</li>
                      <li>Flashcards: {c.flashcards}</li>
                      <li>Practice: {c.practiceAttached}</li>
                      <li>Reviewed: {isReviewed ? "Yes" : "No"}</li>
                      {teacherBrainEligible > 0 ? (
                        <li style={{ color: teacherBrainBriefCount > 0 ? "#15803d" : "#7c3aed" }}>
                          Teacher Brain briefs: {teacherBrainBriefCount} / {teacherBrainEligible} activity blocks
                        </li>
                      ) : null}
                      {topicCheck && (
                        <li style={{ color: topicCheck.pass ? "#15803d" : "#b91c1c" }}>
                          {topicCheck.pass ? topicCheck.label : TAXONOMY_TOPIC_UNMAPPED_LABEL}
                        </li>
                      )}
                    </ul>
                    {teacherBrainEligible > 0 && teacherBrainBriefCount < teacherBrainEligible ? (
                      <button
                        type="button"
                        disabled={teacherBrainInjectLoading}
                        onClick={() => void handleInjectTeacherBrainBriefs()}
                        style={{
                          marginBottom: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "2px solid rgba(124, 58, 237, 0.5)",
                          background: "rgba(237, 233, 254, 0.9)",
                          color: "#5b21b6",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: teacherBrainInjectLoading ? "wait" : "pointer",
                          width: "100%",
                        }}
                      >
                        {teacherBrainInjectLoading
                          ? "Injecting briefs…"
                          : "Inject Teacher Brain briefs"}
                      </button>
                    ) : null}
                    {id && (
                      <div style={{ marginTop: 8, fontSize: 12 }}>
                        <Link to={`/teacher/misconceptions?lessonId=${id}`} style={{ color: "#2563eb", textDecoration: "none", marginRight: 12 }}>View misconceptions →</Link>
                        <Link to={`/teacher/reteach-plans?lessonId=${id}`} style={{ color: "#2563eb", textDecoration: "none" }}>View reteach plan →</Link>
                      </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={reviewLoading}
                        onClick={async () => {
                          if (!id) return;
                          setReviewLoading(true);
                          try {
                            const res = await api.post(`/lessons/${id}/review`, { reviewed: !isReviewed });
                            const data = res?.data;
                            setLesson((prev) => (prev ? { ...prev, readiness: data?.readiness ?? prev.readiness, reviewedAt: data?.reviewedAt !== undefined ? data.reviewedAt : prev.reviewedAt, reviewedBy: data?.reviewedBy !== undefined ? data.reviewedBy : prev.reviewedBy } : prev));
                          } finally {
                            setReviewLoading(false);
                          }
                        }}
                        style={{ padding: "8px 14px", borderRadius: 8, border: isReviewed ? "2px solid #94a3b8" : "2px solid #22c55e", background: isReviewed ? "#f1f5f9" : "rgba(34,197,94,0.12)", cursor: reviewLoading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13 }}
                      >
                        {reviewLoading ? "Updating…" : isReviewed ? "Unmark review" : "Mark as reviewed"}
                      </button>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={makeClassroomReadyLoading}
                        onClick={async () => {
                          if (!id) return;
                          setMakeClassroomReadyError(null);
                          setMakeClassroomReadyLoading(true);
                          try {
                            const res = await api.post<{ ok: boolean; attach?: { added: number; addedIds?: string[] }; diagram?: { status: string }; plan?: { status: string }; review?: { status: string }; readiness?: { status: string; signals?: Record<string, unknown> } }>(`/reports/lessons/${id}/make-classroom-ready`, { days: 7, attachPractice: true, attachLimit: 10, ensureDiagram: true, regeneratePlan: true, planLimit: 10, markReviewed: true, ...(topicKeyForBank ? { topicKey: topicKeyForBank } : {}) });
                            const d = res?.data;
                            if (!d?.ok) { setMakeClassroomReadyError("Request failed"); return; }
                            if (d?.attach?.addedIds?.length) {
                              setAttachedExamQuestions((prev) => {
                                const ids = new Set(d.attach!.addedIds!);
                                const existing = new Set(prev.map((q) => q._id));
                                return [...prev, ...d.attach!.addedIds!.filter((id) => !existing.has(id)).map((id) => ({ _id: id, question: "", type: "mcq" as const }))];
                              });
                            }
                            const listRes = await api.get(`/lessons/${id}/exam-questions`);
                            setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                            setLesson((prev) => (prev && d?.readiness ? { ...prev, readiness: d.readiness as Lesson["readiness"], reviewedAt: d.review?.status === "MARKED" || d.review?.status === "ALREADY_REVIEWED" ? new Date().toISOString() : prev.reviewedAt } as Lesson : prev));
                            await fetchLessonSmart();
                            const baseMsg = `Done: +${d?.attach?.added ?? 0} practice · diagram · plan · reviewed`;
                            setSaveMsg(d?.readiness?.status === "READY" ? `${baseMsg}. Ready. Open Classroom mode.` : baseMsg);
                            setTimeout(() => setSaveMsg(""), 4000);
                          } catch (e: any) {
                            setMakeClassroomReadyError(e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? "Make classroom-ready failed");
                          } finally {
                            setMakeClassroomReadyLoading(false);
                          }
                        }}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #059669", background: makeClassroomReadyLoading ? "#e5e7eb" : "rgba(5,150,105,0.12)", cursor: makeClassroomReadyLoading ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13, color: "#047857" }}
                      >
                        {makeClassroomReadyLoading ? "Preparing…" : "Make classroom-ready"}
                      </button>
                    </div>
                    {makeClassroomReadyError && <div style={{ marginTop: 6, fontSize: 13, color: "#b91c1c" }}>{makeClassroomReadyError}</div>}
                  </div>
                );
              })()}

              <div style={{ marginTop: 12 }}>
                <TeacherCoverageReviewPanel
                  lessonId={id}
                  refreshKey={coverageReviewRefreshKey}
                />
              </div>

              <LearningIntelligenceSummaryPanel pages={lesson?.pages ?? []} />

              {/* Card 4: Practice questions (in this lesson) — Lane A */}
              <div id="edit-lesson-practice-lane" style={{ background: "white", borderRadius: 14, padding: 14, boxShadow: "0 10px 22px rgba(0,0,0,0.08)", border: "2px solid rgba(0,0,0,0.08)" }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Practice questions (in this lesson)</div>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>These appear as the practice questions for students. Only questions for the selected sub-topic will be attached.</p>
                <button
                  type="button"
                  onClick={() => { setAddFromBankModalOpen(true); setBankTopicKey(""); setBankQuestions([]); setSelectedBankQuestionIds(new Set()); }}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.08)", cursor: "pointer", fontWeight: 700 }}
                >
                  Add from Question Bank
                </button>
                <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={autoAttachLoading}
                    onClick={async () => {
                      if (!id) return;
                      setAutoAttachMessage(null);
                      setAutoAttachLoading(true);
                      try {
                        const res = await api.post(`/lessons/${id}/exam-questions/attach-by-topic`, {
                          limit: autoAttachLimit,
                          ...(topicKeyForBank ? { topicKey: topicKeyForBank } : {}),
                        });
                        const data = res?.data;
                        const added = data?.added ?? 0;
                        const topicName = data?.topic ?? lesson?.topic ?? "topic";
                        if (added > 0) {
                          const listRes = await api.get(`/lessons/${id}/exam-questions`);
                          setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                        }
                        const msg = data?.warning ?? (added > 0 ? `Added ${added} question${added !== 1 ? "s" : ""} for ${topicName}` : "No new questions to add.");
                        setAutoAttachMessage(msg);
                      } catch (err: any) {
                        setAutoAttachMessage(err?.response?.data?.msg ?? err?.response?.data?.error ?? "Failed to attach.");
                      } finally {
                        setAutoAttachLoading(false);
                        setTimeout(() => setAutoAttachMessage(null), 5000);
                      }
                    }}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.08)", cursor: autoAttachLoading ? "not-allowed" : "pointer", fontWeight: 700, opacity: autoAttachLoading ? 0.7 : 1 }}
                  >
                    {autoAttachLoading ? "Attaching…" : `Auto-attach (Top ${autoAttachLimit})`}
                  </button>
                  <select value={autoAttachLimit} onChange={(e) => setAutoAttachLimit(Number(e.target.value))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600 }}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                  </select>
                </span>
                {autoAttachMessage && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      borderRadius: 8,
                      fontSize: 13,
                      background: autoAttachMessage.startsWith("Added")
                        ? "#dcfce7"
                        : autoAttachMessage.includes("limited") || autoAttachMessage.includes("exact-match")
                          ? "#fef3c7"
                          : "#fee2e2",
                      color: autoAttachMessage.startsWith("Added") ? "#166534" : autoAttachMessage.includes("limited") || autoAttachMessage.includes("exact-match") ? "#92400e" : "#b91c1c",
                    }}
                  >
                    {autoAttachMessage}
                  </div>
                )}
                {attachedExamQuestions.length > 0 && (
                  <ul style={{ marginTop: 12, paddingLeft: 20, listStyle: "disc" }}>
                    {attachedExamQuestions.map((q) => (
                      <li key={q._id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <span style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }} title={q.question}>{q.question?.slice(0, 60)}{(q.question?.length ?? 0) > 60 ? "…" : ""} {q.marks != null ? `(${q.marks} marks)` : ""}</span>
                        <button type="button" onClick={() => api.delete(`/lessons/${id}/exam-questions/${q._id}`).then(() => setAttachedExamQuestions((prev) => prev.filter((x) => x._id !== q._id))).catch(() => {})} style={{ padding: "4px 8px", fontSize: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, cursor: "pointer", flexShrink: 0 }}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* CENTER: Lesson details + Description + Editing blocks */}
            <div
              data-col="center"
              className="edit-lesson-main-column"
              style={{
                minWidth: 0,
                maxWidth: "100%",
                width: "100%",
                display:
                  layoutBreakpoint === "narrow" && mobileEditorTab === "preview" ? "none" : undefined,
              }}
              role="main"
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                  border: "2px solid rgba(0,0,0,0.16)",
                  minWidth: 0,
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>
                  Revision Lesson Details
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Title</div>
                    <input
                      ref={titleRef}
                      value={lesson.title}
                      onChange={(e) => updateLessonField("title", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Exam board</div>
                    <input
                      value={lesson.examBoardName ?? ""}
                      onChange={(e) =>
                        updateLessonField("examBoardName", e.target.value || null)
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Subject</div>
                    <input
                      value={lesson.subject}
                      onChange={(e) => updateLessonField("subject", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Level</div>
                    <input
                      value={lesson.level}
                      onChange={(e) => updateLessonField("level", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Topic</div>
                    <input
                      value={lesson.topic}
                      onChange={(e) => updateLessonField("topic", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  {topicKeyForBank ? (
                    <>
                    <div style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #86efac", fontSize: 13 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6, color: "#166534" }}>Syllabus mapping</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", color: "#15803d" }}>
                        <span><strong>Subject:</strong> {lesson.subject || "—"}</span>
                        <span><strong>Spec:</strong> {(lesson as { specKey?: string }).specKey || topicKeyForBank?.split(":")[0] || "—"}</span>
                        <span><strong>Main topic:</strong> {(lesson as { mainTopic?: string }).mainTopic || "—"}</span>
                        <span><strong>Sub-topic:</strong> {(lesson as { subTopic?: string }).subTopic || lesson.topic || "—"}</span>
                      </div>
                    </div>
                    {/* Content graph: linked topic counts + health */}
                    {graphLoading && (
                      <div style={{ gridColumn: "1 / -1", padding: "8px 12px", borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 12, color: "#64748b" }}>
                        Loading content graph…
                      </div>
                    )}
                    {!graphLoading && (graphError || lessonGraph || topicCoverage) && (
                      <div style={{ gridColumn: "1 / -1", padding: "8px 12px", borderRadius: 8, background: graphError || (lessonGraph && !lessonGraph.lessonNode) ? "#fef2f2" : "#f0f9ff", border: `1px solid ${graphError ? "#fecaca" : "#bae6fd"}`, fontSize: 12, color: graphError ? "#b91c1c" : "#0369a1", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <span>
                          {graphError ? (
                            <>Content graph: {graphError}. Unresolved mapping or API error.</>
                          ) : lessonGraph && !lessonGraph.lessonNode ? (
                            <>Lesson not in content graph. Run rebuild to link.</>
                          ) : topicCoverage ? (
                            <>Topic has {topicCoverage.flashcardCount} flashcards, {topicCoverage.quizCount} quizzes, {topicCoverage.examQuestionCount} exam questions linked.</>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          onClick={handleRebuildLessonGraph}
                          disabled={graphRebuilding}
                          style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd", borderRadius: 6, cursor: graphRebuilding ? "not-allowed" : "pointer" }}
                        >
                          {graphRebuilding ? "Rebuilding…" : "Rebuild Graph"}
                        </button>
                      </div>
                    )}
                    </>
                  ) : (
                    <div style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, background: "#fef3c7", border: "1px solid #fcd34d", fontSize: 13, color: "#92400e" }}>
                      <strong>This lesson needs a syllabus topic.</strong> Set Subject, Level, and Topic to match a taxonomy sub-topic (e.g. "Cell structure" for AQA GCSE Biology). Flashcards, practice, and bank import require a valid mapping.
                    </div>
                  )}

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      Estimated duration (mins)
                    </div>
                    <input
                      type="number"
                      value={lesson.estimatedDuration}
                      onChange={(e) =>
                        updateLessonField("estimatedDuration", Number(e.target.value || 0))
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>
                        Short lesson summary (max {LESSON_DESCRIPTION_MAX_LENGTH} characters)
                      </div>
                      <LessonAutoTextarea
                        editorVariant="plain"
                        value={lesson.description}
                        onChange={(v) => updateLessonField("description", v)}
                        minHeightPx={160}
                        showExpandButton
                        maxLength={LESSON_DESCRIPTION_MAX_LENGTH}
                        style={{ fontSize: "0.9375rem" }}
                      />
                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                        aria-live="polite"
                      >
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          Lesson objective — what students will learn in this lesson.
                        </span>
                        <span
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color:
                              lesson.description.length >= LESSON_DESCRIPTION_MAX_LENGTH
                                ? "#b45309"
                                : lesson.description.length >= LESSON_DESCRIPTION_MAX_LENGTH * 0.9
                                  ? "#b45309"
                                  : "#64748b",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {lesson.description.length} / {LESSON_DESCRIPTION_MAX_LENGTH} characters
                        </span>
                      </div>
                      {lesson.description.length >= LESSON_DESCRIPTION_MAX_LENGTH ? (
                        <div
                          role="status"
                          style={{
                            marginTop: 6,
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "#b45309",
                          }}
                        >
                          Character limit reached
                        </div>
                      ) : null}
                    </label>
                  </div>

                </div>
              </div>

              {!pagesReady ? (
                <div
                  style={{
                    marginTop: 14,
                    background: "white",
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                    border: "2px solid rgba(0,0,0,0.16)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>No pages yet</div>
                  <div style={{ color: "#6b7280" }}>
                    Click "Add page" on the left to start.
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      background: "white",
                      borderRadius: 14,
                      padding: 14,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                      border: "2px solid rgba(0,0,0,0.16)",
                    }}
                  >
                    {currentPage && (reportsByPageOnly.get(currentPage.pageId) ?? []).length > 0 && (() => {
                      const pageReports = reportsByPageOnly.get(currentPage.pageId) ?? [];
                      const pk = `${currentPage.pageId}-page`;
                      return (
                        <div
                          style={{
                            marginBottom: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "#fef3c7",
                            border: "1px solid #f59e0b",
                            fontSize: 13,
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "#92400e" }}>
                            Issue reported on this page{pageReports.length > 1 ? ` (${pageReports.length})` : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedReportsKey(expandedReportsKey === pk ? null : pk)}
                            style={{
                              marginTop: 4,
                              background: "none",
                              border: "none",
                              color: "#b45309",
                              cursor: "pointer",
                              fontSize: 12,
                              textDecoration: "underline",
                              padding: 0,
                            }}
                          >
                            {expandedReportsKey === pk ? "Hide reports" : "View reports"}
                          </button>
                          {expandedReportsKey === pk && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#78350f" }}>
                              {pageReports.map((rep, ri) => (
                                <div key={rep.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: ri < pageReports.length - 1 ? "1px solid #fcd34d" : "none" }}>
                                  <div>
                                    <strong>{rep.reportTypeLabel}</strong>
                                    {(() => {
                                      const p = REPORT_PRIORITY[rep.reportType];
                                      if (!p) return null;
                                      const s = p === "high" ? { bg: "#fef2f2", color: "#b91c1c" } : p === "low" ? { bg: "#f0fdf4", color: "#15803d" } : { bg: "#fef3c7", color: "#92400e" };
                                      return (
                                        <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>
                                          {p}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div>{rep.description}</div>
                                  {rep.suggestedFix && <div style={{ marginTop: 4, fontStyle: "italic" }}>Suggested: {rep.suggestedFix}</div>}
                                  <button
                                    type="button"
                                    onClick={() => handleResolveReport(rep.id)}
                                    disabled={resolvingReportId === rep.id}
                                    style={{
                                      marginTop: 6,
                                      padding: "4px 10px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      borderRadius: 6,
                                      border: "1px solid #059669",
                                      background: "#ecfdf5",
                                      color: "#059669",
                                      cursor: resolvingReportId === rep.id ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {resolvingReportId === rep.id ? "Resolving…" : "Mark resolved"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900, color: "#111827" }}>
                        Editing: {currentPage?.title || `Page ${currentPage?.order}`}
                      </div>

                      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {/* PR-EDITOR-GUARD-1: Don't allow adding checkpoint block when page.checkpoint is used */}
                        {(() => {
                          const hasPageCheckpoint = Boolean(
                            currentPage?.checkpoint?.question?.trim() &&
                            Array.isArray(currentPage?.checkpoint?.options) &&
                            (currentPage!.checkpoint!.options!.filter((o: any) => String(o ?? "").trim()).length >= 2)
                          );
                          return (
                            <AddBlockByRoleSelect
                              placeholderLabel="+ Add block by role…"
                              disableCheckpointBlocks={hasPageCheckpoint}
                              selectStyle={{
                                padding: "8px 14px",
                                fontSize: 13,
                                fontWeight: 600,
                                borderRadius: 8,
                                border: "2px solid rgba(0,0,0,0.14)",
                                minWidth: 0,
                                maxWidth: "100%",
                                background: "white",
                              }}
                              onChoose={(opt) => {
                                if (opt.type === "checkpoint" && hasPageCheckpoint) return;
                                if (isInteractiveCreationType(opt.type)) {
                                  setInteractiveBlockCreation({ pageId: currentPage!.pageId, option: opt });
                                  return;
                                }
                                addBlock(currentPage!.pageId, opt.type, {
                                  role: opt.role,
                                  title: opt.title,
                                });
                              }}
                            />
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => {
                            setAttachPageQuizModalMode("published");
                            setAttachPageQuizModalOpen(true);
                          }}
                          disabled={!topicKeyForBank}
                          title={!topicKeyForBank ? "This lesson needs a valid syllabus topic before quiz questions can be attached." : "Attach published quiz questions from the Topic Quiz Bank to this page."}
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "1px solid #2563eb",
                            borderRadius: 8,
                            background: "#eff6ff",
                            color: "#2563eb",
                            cursor: topicKeyForBank ? "pointer" : "not-allowed",
                            opacity: topicKeyForBank ? 1 : 0.6,
                          }}
                        >
                          Attach Quiz Page From Question Bank
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAttachPageQuizModalMode("aiDrafts");
                            setAttachPageQuizModalOpen(true);
                          }}
                          disabled={!topicKeyForBank || !id}
                          title={
                            !topicKeyForBank
                              ? "Map a syllabus subtopic first."
                              : !id
                                ? "Save the lesson first."
                                : "Attach AI-generated quiz drafts from your Topic Quiz Bank to this page (no publish required)."
                          }
                          style={{
                            padding: "8px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "1px solid #7c3aed",
                            borderRadius: 8,
                            background: "rgba(245,243,255,0.95)",
                            color: "#5b21b6",
                            cursor: topicKeyForBank && id ? "pointer" : "not-allowed",
                            opacity: topicKeyForBank && id ? 1 : 0.6,
                          }}
                        >
                          Attach AI quiz drafts
                        </button>
                      </div>
                    </div>
                    {topicKeyForBank && (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                        Published bank: attach reviewed MCQs. AI drafts: attach generated drafts to this page without publishing bank rows.
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                        marginTop: 12,
                        minWidth: 0,
                      }}
                    >
                      <label style={{ display: "block" }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Page title</div>
                        <input
                          value={safeStr(currentPage?.title, "")}
                          onChange={(e) =>
                            updatePage(currentPage!.pageId, { title: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "2px solid rgba(0,0,0,0.14)",
                          }}
                        />
                      </label>

                      <label style={{ display: "block" }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Page type</div>
                        <select
                          value={safeStr(currentPage?.pageType, "")}
                          onChange={(e) =>
                            updatePage(currentPage!.pageId, { pageType: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "2px solid rgba(0,0,0,0.14)",
                          }}
                        >
                          <option value="">Select…</option>
                          {PAGE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {currentPage &&
                            safeStr(currentPage.pageType, "").trim() &&
                            !PAGE_TYPE_OPTIONS.includes(safeStr(currentPage.pageType, "")) && (
                              <option value={safeStr(currentPage.pageType, "")}>
                                {safeStr(currentPage.pageType, "")}
                              </option>
                            )}
                        </select>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                          Optional: helps organise pages (e.g. Explanation, Checkpoint, Misconceptions).
                        </div>
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    {(currentPage?.blocks || []).map((b, idx) => {
                      if (!b) return null;
                      const blockType = blockLooksLikeInteractiveSequence(
                        b as unknown as Record<string, unknown>
                      )
                        ? "interactiveSequence"
                        : normalizeBlockType(b.type);
                      const key = `${currentPage!.pageId}:${idx}`;
                      const isUploading = uploadingKey === key;
                      const isCheckpoint = blockType === "checkpoint";
                      const isSelfCheck = blockType === "selfCheck";
                      const isDiagram = blockType === "diagram";
                      const isInteractiveSequence = blockType === "interactiveSequence";
                      const isInteractiveDiagram = blockType === "interactiveDiagram";
                      const isDragDropMatch = blockType === "dragDropMatch";
                      const isGraph = blockType === "graph";
                      const cp = isCheckpoint || isSelfCheck ? b : null;
                      const d = isDiagram ? b : null;
                      const opts = (cp?.options ?? ["", "", "", ""]).slice(0, 6);
                      const cpWarnings: string[] = [];
                      const hasPageCheckpointContent = Boolean(
                        currentPage?.checkpoint?.question?.trim() &&
                        Array.isArray(currentPage?.checkpoint?.options) &&
                        (currentPage!.checkpoint!.options!.filter((o: any) => String(o ?? "").trim()).length >= 2)
                      );
                      if ((isCheckpoint || isSelfCheck) && cp) {
                        if (isCheckpoint && hasPageCheckpointContent) {
                          cpWarnings.push(
                            "This checkpoint will not appear to students because this page already has a page-level checkpoint. Page-level checkpoints take precedence."
                          );
                        }
                        if (!(String(cp.prompt ?? "").trim())) cpWarnings.push("Prompt is required.");
                        if (cp.questionType === "mcq") {
                          const filled = (cp.options ?? []).filter((o) => String(o ?? "").trim()).length;
                          if (filled < 2) cpWarnings.push("MCQ needs at least 2 options.");
                          if (!(String(cp.correctAnswer ?? "").trim())) cpWarnings.push("Correct answer is required.");
                        } else {
                          if (!(String(cp.correctAnswer ?? "").trim())) cpWarnings.push("Correct answer is required.");
                        }
                      }

                      const blockReportKey =
                        isCheckpoint
                          ? `${currentPage!.pageId}-checkpoint`
                          : isSelfCheck
                            ? `${currentPage!.pageId}-selfcheck-${idx}`
                            : `${currentPage!.pageId}-${idx}`;
                      const blockReports = reportsByBlock.get(blockReportKey) ?? [];

                      return (
                        <div
                          key={key}
                          style={getBlockStyle(blockType)}
                          onFocusCapture={() => setPreviewFocusBlockIdx(idx)}
                        >
                          {blockReports.length > 0 && (
                            <div
                              style={{
                                marginBottom: 10,
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: "#fef3c7",
                                border: "1px solid #f59e0b",
                                fontSize: 13,
                              }}
                            >
                              <div style={{ fontWeight: 600, color: "#92400e" }}>
                                Issue reported on this block{blockReports.length > 1 ? ` (${blockReports.length})` : ""}
                              </div>
                              <button
                                type="button"
                                onClick={() => setExpandedReportsKey(expandedReportsKey === blockReportKey ? null : blockReportKey)}
                                style={{
                                  marginTop: 4,
                                  background: "none",
                                  border: "none",
                                  color: "#b45309",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  textDecoration: "underline",
                                  padding: 0,
                                }}
                              >
                                {expandedReportsKey === blockReportKey ? "Hide reports" : "View reports"}
                              </button>
                              {expandedReportsKey === blockReportKey && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "#78350f" }}>
                                  {blockReports.map((rep, ri) => (
                                    <div key={rep.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: ri < blockReports.length - 1 ? "1px solid #fcd34d" : "none" }}>
                                      <div>
                                        <strong>{rep.reportTypeLabel}</strong>
                                        {(() => {
                                          const p = REPORT_PRIORITY[rep.reportType];
                                          if (!p) return null;
                                          const s = p === "high" ? { bg: "#fef2f2", color: "#b91c1c" } : p === "low" ? { bg: "#f0fdf4", color: "#15803d" } : { bg: "#fef3c7", color: "#92400e" };
                                          return (
                                            <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>
                                              {p}
                                            </span>
                                          );
                                        })()}
                                      </div>
                                      <div>{rep.description}</div>
                                      {rep.suggestedFix && <div style={{ marginTop: 4, fontStyle: "italic" }}>Suggested: {rep.suggestedFix}</div>}
                                      <button
                                        type="button"
                                        onClick={() => handleResolveReport(rep.id)}
                                        disabled={resolvingReportId === rep.id}
                                        style={{
                                          marginTop: 6,
                                          padding: "4px 10px",
                                          fontSize: 11,
                                          fontWeight: 600,
                                          borderRadius: 6,
                                          border: "1px solid #059669",
                                          background: "#ecfdf5",
                                          color: "#059669",
                                          cursor: resolvingReportId === rep.id ? "not-allowed" : "pointer",
                                        }}
                                      >
                                        {resolvingReportId === rep.id ? "Resolving…" : "Mark resolved"}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            {blockType !== "text" && (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                                <div style={{ fontWeight: 900 }}>{lessonBlockDisplayLabel(blockType, idx, (b as { title?: string }).title)}</div>
                                {BLOCK_META[blockType].subtitle ? (
                                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, lineHeight: 1.35 }}>
                                    {BLOCK_META[blockType].subtitle}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                onClick={() => moveBlock(currentPage!.pageId, idx, -1)}
                                disabled={idx === 0}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(0,0,0,0.14)",
                                  background: "white",
                                  cursor: idx === 0 ? "not-allowed" : "pointer",
                                  fontWeight: 900,
                                  opacity: idx === 0 ? 0.5 : 1,
                                }}
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveBlock(currentPage!.pageId, idx, 1)}
                                disabled={idx === (currentPage?.blocks?.length || 0) - 1}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(0,0,0,0.14)",
                                  background: "white",
                                  cursor:
                                    idx === (currentPage?.blocks?.length || 0) - 1
                                      ? "not-allowed"
                                      : "pointer",
                                  fontWeight: 900,
                                  opacity:
                                    idx === (currentPage?.blocks?.length || 0) - 1 ? 0.5 : 1,
                                }}
                              >
                                ↓
                              </button>

                              <AddBlockByRoleSelect
                                compact
                                placeholderLabel="+ Add below"
                                disableCheckpointBlocks={hasPageCheckpointContent}
                                onChoose={(opt) => {
                                  if (opt.type === "checkpoint" && hasPageCheckpointContent) return;
                                  if (isInteractiveCreationType(opt.type)) {
                                    setInteractiveBlockCreation({
                                      pageId: currentPage!.pageId,
                                      insertAt: idx + 1,
                                      option: opt,
                                    });
                                    return;
                                  }
                                  addBlock(currentPage!.pageId, opt.type, {
                                    role: opt.role,
                                    title: opt.title,
                                    insertAt: idx + 1,
                                  });
                                }}
                              />

                              {!isCheckpoint &&
                                !isSelfCheck &&
                                !isDiagram &&
                                !isInteractiveSequence &&
                                !isInteractiveDiagram &&
                                !isDragDropMatch &&
                                !isGraph && (
                                <button
                                  onClick={() => triggerBlockUpload(currentPage!.pageId, idx)}
                                  disabled={isUploading}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                    background: "white",
                                    cursor: isUploading ? "not-allowed" : "pointer",
                                    fontWeight: 900,
                                  }}
                                >
                                  {isUploading ? "Uploading..." : "Upload image / video"}
                                </button>
                              )}

                              <button
                                onClick={() => removeBlock(currentPage!.pageId, idx)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(239,68,68,0.35)",
                                  background: "rgba(239,68,68,0.06)",
                                  cursor: "pointer",
                                  fontWeight: 900,
                                  color: "#b91c1c",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          {(isCheckpoint || isSelfCheck) && cp ? (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                              {cpWarnings.length > 0 && (
                                <div style={{ color: "#b45309", fontSize: 13, fontWeight: 600 }}>
                                  {cpWarnings.join(" ")}
                                </div>
                              )}
                              {isSelfCheck ? (
                                <div style={{ marginBottom: 10 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setGeneratorMcqSelfCheckImportError(null);
                                      setGeneratorMcqSelfCheckImportOpen({
                                        pageId: currentPage!.pageId,
                                        idx,
                                      });
                                      setGeneratorMcqSelfCheckImportText("");
                                    }}
                                    style={{
                                      padding: "8px 14px",
                                      borderRadius: 8,
                                      border: "2px solid rgba(59,130,246,0.35)",
                                      background: "rgba(219,234,254,0.45)",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                      fontSize: "0.875rem",
                                      color: "#1d4ed8",
                                    }}
                                  >
                                    Import MCQ from generator
                                  </button>
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "#64748b",
                                      marginTop: 6,
                                      lineHeight: 1.4,
                                    }}
                                  >
                                    Opens a dialog to paste CHECKPOINT text — nothing is auto-imported from the
                                    clipboard.
                                  </div>
                                </div>
                              ) : null}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Prompt</div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={cp.prompt ?? ""}
                                  onChange={(v) =>
                                    updateBlock(currentPage!.pageId, idx, { prompt: v })
                                  }
                                  placeholder="Question or instruction..."
                                  minHeightPx={144}
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Question type</div>
                                <select
                                  value={cp.questionType ?? "mcq"}
                                  onChange={(e) =>
                                    updateBlock(currentPage!.pageId, idx, {
                                      questionType: e.target.value === "short" ? "short" : "mcq",
                                      ...(e.target.value === "short" ? { options: undefined } : { options: opts.length ? opts : ["", "", "", ""] }),
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                >
                                  <option value="mcq">Multiple choice (MCQ)</option>
                                  <option value="short">Short answer</option>
                                </select>
                              </label>
                              {cp.questionType === "short" ? (
                                <label style={{ display: "block" }}>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Correct answer</div>
                                  <input
                                    type="text"
                                    value={cp.correctAnswer ?? ""}
                                    onChange={(e) =>
                                      updateBlock(currentPage!.pageId, idx, { correctAnswer: e.target.value })
                                    }
                                    placeholder="Expected short answer"
                                    style={{
                                      width: "100%",
                                      padding: "10px 12px",
                                      borderRadius: 10,
                                      border: "2px solid rgba(0,0,0,0.14)",
                                    }}
                                  />
                                </label>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Options (correct answer)</div>
                                  {(cp.options ?? ["", "", "", ""]).map((opt, oi) => {
                                    const isCorrectRow = isEditLessonMcqOptionCorrect(
                                      opt,
                                      cp.correctAnswer
                                    );
                                    return (
                                    <div key={oi} style={editLessonMcqOptionRowStyle(isCorrectRow)}>
                                      <input
                                        type="radio"
                                        name={`${key}-correct`}
                                        checked={isCorrectRow}
                                        onChange={() =>
                                          updateBlock(currentPage!.pageId, idx, {
                                            correctAnswer: String(opt ?? "").trim(),
                                          })
                                        }
                                        style={EDIT_LESSON_MCQ_RADIO_STYLE}
                                        aria-label={`Mark option ${oi + 1} as correct`}
                                      />
                                      <input
                                        type="text"
                                        value={opt ?? ""}
                                        onChange={(e) => {
                                          updateBlock(
                                            currentPage!.pageId,
                                            idx,
                                            patchMcqOptionText(
                                              cp.options ?? ["", "", "", ""],
                                              oi,
                                              e.target.value,
                                              cp.correctAnswer ?? ""
                                            )
                                          );
                                        }}
                                        placeholder={`Option ${oi + 1}`}
                                        style={EDIT_LESSON_MCQ_TEXT_INPUT_STYLE}
                                        aria-label={`Option ${oi + 1} text`}
                                      />
                                    </div>
                                    );
                                  })}
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {(cp.options ?? []).length < 6 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateBlock(
                                            currentPage!.pageId,
                                            idx,
                                            patchMcqAddOption(cp.options ?? ["", "", "", ""])
                                          );
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(59,130,246,0.35)",
                                          background: "rgba(59,130,246,0.08)",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                        }}
                                      >
                                        + option
                                      </button>
                                    )}
                                    {(cp.options ?? []).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateBlock(
                                            currentPage!.pageId,
                                            idx,
                                            patchMcqRemoveOption(
                                              cp.options ?? ["", "", "", ""],
                                              cp.correctAnswer ?? ""
                                            )
                                          );
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(0,0,0,0.2)",
                                          background: "white",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                        }}
                                      >
                                        Remove option
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Explanation (optional)</div>
                                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                  Shown after students check or reveal the answer
                                </div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={cp.explanation ?? ""}
                                  onChange={(v) =>
                                    updateBlock(currentPage!.pageId, idx, { explanation: v })
                                  }
                                  placeholder="Why this answer is correct..."
                                  minHeightPx={300}
                                  showExpandButton
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Mark scheme (optional)</div>
                                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                  One point per line — appended to the explanation for students when present.
                                </div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={checkpointMarkSchemeEditorText(cp.markScheme)}
                                  onChange={(v) =>
                                    updateBlock(currentPage!.pageId, idx, {
                                      markScheme: v
                                        .split("\n")
                                        .map((line) => line.trim())
                                        .filter(Boolean)
                                        .slice(0, 20),
                                    })
                                  }
                                  minHeightPx={96}
                                  style={{ fontSize: "0.875rem" }}
                                />
                              </label>
                            </div>
                          ) : isDiagram && d ? (
                            <div
                              ref={(el) => {
                                const diagramKey = `${currentPage!.pageId}-${idx}`;
                                diagramBlockContainerRef.current[diagramKey] = el;
                              }}
                              style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}
                            >
                              <TeacherBrainDesignBriefPanel
                                blockType={blockType}
                                note={(b as LessonPageBlock).note}
                                onNoteChange={(note) => updateBlock(currentPage!.pageId, idx, { note })}
                                onRequestInject={() =>
                                  void handleInjectTeacherBrainBriefs({
                                    pageId: currentPage!.pageId,
                                    blockIndex: idx,
                                    blockType,
                                  })
                                }
                                injectLoading={teacherBrainInjectLoading}
                                refreshKey={teacherBrainBriefRefreshKey}
                              />
                              {diagramBriefFromBlockEnabled && lesson ? (
                                <GenerateDiagramBriefPanel
                                  block={b as unknown as Record<string, unknown>}
                                  lesson={{
                                    subject: lesson.subject,
                                    board: lesson.examBoardName,
                                    tier: lesson.tier || lesson.level,
                                    topic: lesson.topic,
                                    subTopic: lesson.subTopic,
                                    level: lesson.level,
                                  }}
                                  page={{ title: currentPage?.title }}
                                />
                              ) : null}
                              {!hasTeacherBrainDesignBrief((b as LessonPageBlock).note) ? (
                                <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                                  {d.note ?? "Move labels and adjust as needed."}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  const diagramKey = `${currentPage!.pageId}-${idx}`;
                                  diagramBlockContainerRef.current[diagramKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                style={{
                                  alignSelf: "flex-start",
                                  padding: "8px 14px",
                                  borderRadius: 8,
                                  border: "2px solid #2563eb",
                                  background: "rgba(37,99,235,0.08)",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                  fontSize: 13,
                                  cursor: "pointer",
                                }}
                              >
                                Edit diagram
                              </button>
                              {(() => {
                                const diagramSrc = d.imageUrl ? makeAbsoluteAssetUrl(d.imageUrl) : null;
                                const diagramAlt = d.alt ?? (d.caption || "Diagram");
                                return (
                                (d.source === "ai_fallback" && Array.isArray(d.elements) && d.elements.length > 0) ? (
                                <div
                                  ref={(el) => {
                                    const diagramKey = `${currentPage!.pageId}-${idx}-fb`;
                                    if (!fallbackContainerRef.current) fallbackContainerRef.current = {};
                                    fallbackContainerRef.current[diagramKey] = el;
                                  }}
                                  style={{ position: "relative", width: "100%", maxWidth: 520, marginTop: 8, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}
                                  onPointerMove={(e) => {
                                    const state = fallbackDragRef.current;
                                    if (!state) return;
                                    const key = `${state.pageId}-${state.blockIdx}-fb`;
                                    const container = fallbackContainerRef.current?.[key];
                                    if (!container) return;
                                    const rect = container.getBoundingClientRect();
                                    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                                    const page = lesson?.pages?.find((p) => p.pageId === state.pageId);
                                    const block = page?.blocks?.[state.blockIdx];
                                    const elements = Array.isArray(block?.elements) ? block.elements : [];
                                    const next = elements.map((el) =>
                                      el.id === state.elementId ? { ...el, x: nx, y: ny } : el
                                    );
                                    updateBlock(state.pageId, state.blockIdx, { elements: next });
                                  }}
                                  onPointerUp={() => { fallbackDragRef.current = null; }}
                                  onPointerLeave={() => { fallbackDragRef.current = null; }}
                                >
                                  <svg viewBox="0 0 400 300" style={{ width: "100%", height: "auto", display: "block", background: "#f8fafc" }}>
                                    <ellipse cx={200} cy={150} rx={175} ry={115} fill="none" stroke="#334155" strokeWidth={2} />
                                    <circle cx={200} cy={95} r={28} fill="#e2e8f0" stroke="#64748b" strokeWidth={1.5} />
                                    {d.elements.map((el) => {
                                      const x = (el.x ?? 0.5) * 400;
                                      const y = (el.y ?? 0.5) * 300;
                                      return (
                                        <g key={el.id}>
                                          <line x1={x} y1={y} x2={x} y2={Math.max(0, y - 18)} stroke="#475569" strokeWidth={1.5} opacity={0.7} />
                                          <text x={x} y={y - 8} textAnchor="middle" fontSize={12} fill="#1e293b" fontWeight={500}>{el.label}</text>
                                        </g>
                                      );
                                    })}
                                  </svg>
                                  {d.elements.map((el) => (
                                    <div
                                      key={el.id}
                                      onPointerDown={(e) => {
                                        e.preventDefault();
                                        fallbackDragRef.current = { pageId: currentPage!.pageId, blockIdx: idx, elementId: el.id };
                                        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                                      }}
                                      style={{
                                        position: "absolute",
                                        left: `${((el.x ?? 0.5) * 100).toFixed(2)}%`,
                                        top: `${((el.y ?? 0.5) * 100).toFixed(2)}%`,
                                        transform: "translate(-50%, -50%)",
                                        padding: "4px 8px",
                                        borderRadius: 6,
                                        border: "1px solid #94a3b8",
                                        background: "#fff",
                                        fontSize: 12,
                                        cursor: "grab",
                                        userSelect: "none",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                                      }}
                                    >
                                      {el.label}
                                    </div>
                                  ))}
                                </div>
                              ) : (d.visualId || d.imageUrl) ? (
                                <>
                                  {/* PR11.1: diagram preview canvas (annotated/step) — works for both visualId and imageUrl */}
                                  {(d.mode === "annotated" || d.mode === "step") && (() => {
                                    const diagramKey = `${currentPage!.pageId}-${idx}`;
                                    const rawUrl = d.visualId ? (diagramPreviewUrls[String(d.visualId)] ?? "") : "";
                                    const baseOrigin = (api as any)?.defaults?.baseURL
                                      ? String((api as any).defaults.baseURL).replace(/\/api\/?$/i, "").replace(/\/+$/, "")
                                      : window.location.origin;
                                    const diagramUrl = d.visualId
                                      ? (rawUrl ? (rawUrl.startsWith("http") ? rawUrl : baseOrigin + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl)) : "")
                                      : (diagramSrc ?? "");
                                    return (
                                      <div style={{ marginTop: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                          <button
                                            type="button"
                                            onClick={() => setPlaceMode((v) => !v)}
                                            style={{
                                              padding: "6px 10px",
                                              borderRadius: 6,
                                              border: placeMode ? "2px solid #2563eb" : "1px solid #d1d5db",
                                              background: placeMode ? "#eff6ff" : "#fff",
                                              cursor: "pointer",
                                              fontSize: 12,
                                              fontWeight: 600,
                                            }}
                                          >
                                            Place labels: {placeMode ? "ON" : "OFF"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const anns = Array.isArray(d.annotations) ? d.annotations : [];
                                              if (anns.length < 2) return;
                                              const next = autoSpreadAnnotations(anns);
                                              updateBlock(currentPage!.pageId, idx, { annotations: next });
                                            }}
                                            disabled={(d.annotations ?? []).length < 2}
                                            style={{
                                              padding: "6px 10px",
                                              borderRadius: 6,
                                              border: "1px solid #22c55e",
                                              background: "rgba(34,197,94,0.1)",
                                              cursor: (d.annotations ?? []).length >= 2 ? "pointer" : "not-allowed",
                                              fontSize: 12,
                                              fontWeight: 600,
                                            }}
                                          >
                                            Auto-spread labels
                                          </button>
                                          {placeMode && !selectedAnnotationId && (
                                            <span style={{ fontSize: 12, color: "#64748b" }}>Select a label first.</span>
                                          )}
                                        </div>
                                        {(d.annotations ?? []).length > 0 && selectedAnnotationId && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                                            <span style={{ fontSize: 12, color: "#64748b" }}>Nudge:</span>
                                            <select
                                              value={nudgeStepPct}
                                              onChange={(e) => setNudgeStepPct(Number(e.target.value))}
                                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 }}
                                            >
                                              <option value={1}>1%</option>
                                              <option value={2}>2%</option>
                                              <option value={5}>5%</option>
                                            </select>
                                            {([["⬆", 0, -1], ["⬇", 0, 1], ["⬅", -1, 0], ["➡", 1, 0]] as const).map(([label, dx, dy]) => (
                                              <button
                                                key={label}
                                                type="button"
                                                onClick={() => {
                                                  const sel = (d.annotations ?? []).find((a) => a.id === selectedAnnotationId);
                                                  if (!sel) return;
                                                  const step = nudgeStepPct / 100;
                                                  updateDiagramAnnotation(currentPage!.pageId, idx, selectedAnnotationId, {
                                                    x: clamp((sel.x ?? 0.5) + dx * step, 0, 1),
                                                    y: clamp((sel.y ?? 0.5) + dy * step, 0, 1),
                                                  });
                                                }}
                                                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14 }}
                                              >
                                                {label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        <div
                                          ref={(el) => { diagramRef.current[diagramKey] = el; }}
                                          tabIndex={0}
                                          role="group"
                                          aria-label="Diagram label preview"
                                          style={{
                                            position: "relative",
                                            width: "100%",
                                            maxWidth: 520,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            border: "1px solid #e5e7eb",
                                            marginTop: 4,
                                            touchAction: "none",
                                            outline: "none",
                                            cursor: connectorPickTarget && connectorPickTarget.pageId === currentPage!.pageId && connectorPickTarget.blockIndex === idx ? "crosshair" : undefined,
                                          }}
                                          onClick={(e) => {
                                            const el = diagramRef.current[diagramKey];
                                            if (!el) return;
                                            const { x, y } = getNormalizedPointFromEvent(e.nativeEvent, el);
                                            const pick = connectorPickTarget && connectorPickTarget.pageId === currentPage!.pageId && connectorPickTarget.blockIndex === idx;
                                            if (pick) {
                                              const conns = (d.connectors ?? []).filter((c) => c.labelId !== connectorPickTarget.labelId);
                                              conns.push({ id: newId(), labelId: connectorPickTarget.labelId, x, y });
                                              updateBlock(currentPage!.pageId, idx, { connectors: conns });
                                              setConnectorPickTarget(null);
                                              return;
                                            }
                                            if (!placeMode || !selectedAnnotationId) return;
                                            updateDiagramAnnotation(currentPage!.pageId, idx, selectedAnnotationId, { x, y });
                                          }}
                                          onKeyDown={(e) => {
                                            if (selectedAnnotationId == null) return;
                                            const sel = (d.annotations ?? []).find((a) => a.id === selectedAnnotationId);
                                            if (!sel) return;
                                            const step = (e.shiftKey ? 2 : 1) * (nudgeStepPct / 100);
                                            let dx = 0;
                                            let dy = 0;
                                            if (e.key === "ArrowUp") { dy = -step; e.preventDefault(); }
                                            if (e.key === "ArrowDown") { dy = step; e.preventDefault(); }
                                            if (e.key === "ArrowLeft") { dx = -step; e.preventDefault(); }
                                            if (e.key === "ArrowRight") { dx = step; e.preventDefault(); }
                                            if (dx !== 0 || dy !== 0)
                                              updateDiagramAnnotation(currentPage!.pageId, idx, selectedAnnotationId, {
                                                x: clamp((sel.x ?? 0.5) + dx, 0, 1),
                                                y: clamp((sel.y ?? 0.5) + dy, 0, 1),
                                              });
                                          }}
                                        >
                                          {diagramUrl ? (
                                            <>
                                              <img src={diagramUrl} alt="Diagram preview" style={{ width: "100%", height: "auto", display: "block" }} />
                                              <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
                                                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
                                                  {(d.annotations ?? []).map((a) => {
                                                    const x = (a.x ?? 0.5);
                                                    const y = (a.y ?? 0.5);
                                                    const y2 = clamp(y - 0.035, 0, 1);
                                                    return (
                                                      <line
                                                        key={a.id}
                                                        x1={`${x * 100}%`}
                                                        y1={`${y * 100}%`}
                                                        x2={`${x * 100}%`}
                                                        y2={`${y2 * 100}%`}
                                                        stroke="#111827"
                                                        strokeWidth="2"
                                                        opacity="0.55"
                                                      />
                                                    );
                                                  })}
                                                  {(d.connectors ?? []).map((c) => {
                                                    const ann = (d.annotations ?? []).find((a) => a.id === c.labelId);
                                                    if (!ann) return null;
                                                    const x1 = (ann.x ?? 0.5);
                                                    const y1 = (ann.y ?? 0.5);
                                                    return (
                                                      <line
                                                        key={c.id}
                                                        x1={`${x1 * 100}%`}
                                                        y1={`${y1 * 100}%`}
                                                        x2={`${(c.x ?? 0.5) * 100}%`}
                                                        y2={`${(c.y ?? 0.5) * 100}%`}
                                                        stroke="#64748b"
                                                        strokeWidth="1.5"
                                                        opacity="0.8"
                                                      />
                                                    );
                                                  })}
                                                </svg>
                                                {(d.annotations ?? []).map((ann) => (
                                                  <div
                                                    key={`pin-${ann.id}`}
                                                    style={{
                                                      position: "absolute",
                                                      left: `${((ann.x ?? 0.5) * 100)}%`,
                                                      top: `${((ann.y ?? 0.5) * 100)}%`,
                                                      transform: "translate(-50%, -50%)",
                                                      width: 10,
                                                      height: 10,
                                                      borderRadius: 999,
                                                      background: "#111827",
                                                      border: "2px solid #fff",
                                                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                                                    }}
                                                  />
                                                ))}
                                              </div>
                                              {(d.annotations ?? []).map((ann) => (
                                                <div
                                                  key={ann.id}
                                                  onPointerDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    draggingIdRef.current = ann.id;
                                                    draggingPageIdRef.current = currentPage!.pageId;
                                                    draggingBlockIndexRef.current = idx;
                                                    setSelectedAnnotationId(ann.id);
                                                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                                                  }}
                                                  onPointerMove={(e) => {
                                                    if (draggingIdRef.current !== ann.id) return;
                                                    const container = diagramRef.current[diagramKey];
                                                    if (!container) return;
                                                    const { x, y } = getNormalizedPointFromEvent(e.nativeEvent, container);
                                                    const pageId = draggingPageIdRef.current;
                                                    const blockIdx = draggingBlockIndexRef.current;
                                                    if (pageId != null && blockIdx != null) updateDiagramAnnotation(pageId, blockIdx, ann.id, { x, y });
                                                  }}
                                                  onPointerUp={(e) => {
                                                    if (draggingIdRef.current === ann.id) draggingIdRef.current = null;
                                                  }}
                                                  onPointerCancel={(e) => {
                                                    if (draggingIdRef.current === ann.id) draggingIdRef.current = null;
                                                  }}
                                                  style={{
                                                    position: "absolute",
                                                    left: `${((ann.x ?? 0.5) * 100)}%`,
                                                    top: `${((ann.y ?? 0.5) * 100)}%`,
                                                    transform: "translate(-50%, -50%)",
                                                    padding: "4px 8px",
                                                    borderRadius: 999,
                                                    border: ann.id === selectedAnnotationId ? "2px solid #2563eb" : "1px solid #d1d5db",
                                                    background: ann.id === selectedAnnotationId ? "#eff6ff" : "#fff",
                                                    fontSize: 12,
                                                    cursor: draggingIdRef.current === ann.id ? "grabbing" : "grab",
                                                    userSelect: "none",
                                                    boxShadow: draggingIdRef.current === ann.id ? "0 4px 10px rgba(0,0,0,0.12)" : "none",
                                                    whiteSpace: "nowrap",
                                                    maxWidth: 200,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                  }}
                                                >
                                                  {(ann.text ?? "").trim() ? ann.text.trim() : "Label"}
                                                </div>
                                              ))}
                                            </>
                                          ) : (
                                            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading diagram…</div>
                                          )}
                                        </div>
                                        <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#64748b" }}>
                                          Drag labels on the diagram to position them. Nudge with arrows or buttons. Saved with the lesson.
                                        </p>
                                      </div>
                                    );
                                  })()}
                                  {((d.mode !== "annotated" && d.mode !== "step") || (!d.visualId && !d.imageUrl)) && (
                                    <div style={{ padding: 16, borderRadius: 10, background: "#f1f5f9", border: "2px dashed rgba(34,197,94,0.3)", textAlign: "center", color: "#64748b", fontSize: 14 }}>
                                      {d.visualId ? <span>Diagram: {String(d.visualId)}</span> : diagramSrc ? (
                                        <div className="lesson-editor-diagram-preview-frame" style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, maxWidth: 720, margin: "0 auto" }}>
                                          <img src={diagramSrc} alt={diagramAlt} style={{ width: "100%", height: "auto", borderRadius: 12 }} />
                                        </div>
                                      ) : (
                                        <span>No diagram selected</span>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : diagramSrc ? (
                                <div className="lesson-editor-diagram-preview-frame" style={{ marginTop: 8, border: "1px solid #e5e7eb", borderRadius: 12, padding: 12, maxWidth: 520 }}>
                                  <img
                                    src={diagramSrc}
                                    alt={diagramAlt}
                                    style={{ width: "100%", maxWidth: 720, height: "auto", borderRadius: 12 }}
                                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                                  />
                                </div>
                              ) : (
                                <div style={{ padding: 16, borderRadius: 10, background: "#f1f5f9", border: "2px dashed rgba(34,197,94,0.3)", textAlign: "center", color: "#64748b", fontSize: 14 }}>
                                  <span>No diagram selected</span>
                                </div>
                              ));
                            })()}
                              {/* PR11: diagram mode */}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Mode</div>
                                <select
                                  value={d.mode === "annotated" || d.mode === "step" ? d.mode : "static"}
                                  onChange={(e) => {
                                    const v = e.target.value as "static" | "annotated" | "step";
                                    updateBlock(currentPage!.pageId, idx, {
                                      mode: v,
                                      annotations: v !== "static" ? (d.annotations ?? []) : [],
                                      steps: v === "step" ? (d.steps ?? []) : [],
                                    });
                                  }}
                                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.14)" }}
                                >
                                  <option value="static">Static</option>
                                  <option value="annotated">Annotated</option>
                                  <option value="step">Step-by-step</option>
                                </select>
                              </label>
                              {/* PR21: Apply tier defaults — recovery path for mode/steps */}
                              <button
                                type="button"
                                onClick={() => {
                                  const annotations = Array.isArray(d.annotations) ? [...d.annotations] : [];
                                  const isHigher = (lesson?.tier ?? "").toLowerCase() === "higher";
                                  if (isHigher) {
                                    const existing = Array.isArray(d.steps) ? d.steps : [];
                                    const steps = [
                                      existing[0] ?? { id: newId(), title: "Step 1", showAnnotationIds: [] as string[] },
                                      existing[1] ?? { id: newId(), title: "Step 2", showAnnotationIds: [] as string[] },
                                      existing[2] ?? { id: newId(), title: "Step 3", showAnnotationIds: [] as string[] },
                                    ].map((s) => ({
                                      id: typeof s.id === "string" ? s.id : newId(),
                                      title: typeof s.title === "string" ? s.title : "Step",
                                      showAnnotationIds: Array.isArray(s.showAnnotationIds) ? s.showAnnotationIds : [],
                                    }));
                                    updateBlock(currentPage!.pageId, idx, { mode: "step", annotations, steps });
                                  } else {
                                    updateBlock(currentPage!.pageId, idx, { mode: "annotated", annotations, steps: [] });
                                  }
                                }}
                                style={{
                                  marginTop: 8,
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: "2px solid #94a3b8",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Apply tier defaults
                              </button>
                              {(d.mode === "annotated" || d.mode === "step") && (
                                <>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Annotations</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const anns = Array.isArray(d.annotations) ? [...d.annotations] : [];
                                      anns.push({ id: newId(), kind: "label" as const, text: "", x: 0.5, y: 0.5, align: "center" as const });
                                      updateBlock(currentPage!.pageId, idx, { annotations: anns });
                                    }}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "2px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)", cursor: "pointer", fontWeight: 700, marginBottom: 8 }}
                                  >
                                    + Add label
                                  </button>
                                  {(d.annotations ?? []).map((a, ai) => (
                                    <div
                                      key={a.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedAnnotationId(a.id)}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedAnnotationId(a.id); }}
                                      style={{
                                        marginBottom: 12,
                                        padding: 10,
                                        background: a.id === selectedAnnotationId ? "#eff6ff" : "#f8fafc",
                                        borderRadius: 8,
                                        border: a.id === selectedAnnotationId ? "2px solid #2563eb" : "1px solid #e2e8f0",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="text"
                                        value={a.text ?? ""}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                          const next = [...(d.annotations ?? [])];
                                          if (next[ai]) next[ai] = { ...next[ai], text: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { annotations: next });
                                        }}
                                        placeholder="Label text"
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 6 }}
                                      />
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }} onClick={(e) => e.stopPropagation()}>
                                        <span style={{ fontSize: 12, color: "#64748b" }}>X %</span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={Math.round((a.x ?? 0.5) * 100)}
                                          onChange={(e) => {
                                            const v = clamp(Number(e.target.value) || 0, 0, 100) / 100;
                                            updateDiagramAnnotation(currentPage!.pageId, idx, a.id, { x: v });
                                          }}
                                          style={{ width: 56, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                        <span style={{ fontSize: 12, color: "#64748b" }}>Y %</span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={Math.round((a.y ?? 0.5) * 100)}
                                          onChange={(e) => {
                                            const v = clamp(Number(e.target.value) || 0, 0, 100) / 100;
                                            updateDiagramAnnotation(currentPage!.pageId, idx, a.id, { y: v });
                                          }}
                                          style={{ width: 56, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                        {(d.connectors ?? []).find((c) => c.labelId === a.id) ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const next = (d.connectors ?? []).filter((c) => c.labelId !== a.id);
                                              updateBlock(currentPage!.pageId, idx, { connectors: next });
                                              setConnectorPickTarget(null);
                                            }}
                                            style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #94a3b8", background: "#f1f5f9", color: "#475569", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                          >
                                            Remove line
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setConnectorPickTarget(connectorPickTarget?.labelId === a.id ? null : { pageId: currentPage!.pageId, blockIndex: idx, labelId: a.id });
                                            }}
                                            style={{
                                              padding: "4px 10px",
                                              borderRadius: 6,
                                              border: connectorPickTarget?.labelId === a.id ? "2px solid #2563eb" : "1px solid #94a3b8",
                                              background: connectorPickTarget?.labelId === a.id ? "#eff6ff" : "#f8fafc",
                                              color: "#475569",
                                              cursor: "pointer",
                                              fontSize: 12,
                                              fontWeight: 600,
                                            }}
                                          >
                                            {connectorPickTarget?.labelId === a.id ? "Click diagram to place line" : "Add line"}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const next = (d.annotations ?? []).filter((_, i) => i !== ai);
                                            const nextConnectors = (d.connectors ?? []).filter((c) => c.labelId !== a.id);
                                            updateBlock(currentPage!.pageId, idx, { annotations: next, connectors: nextConnectors });
                                            if (selectedAnnotationId === a.id) setSelectedAnnotationId(null);
                                            if (connectorPickTarget?.labelId === a.id) setConnectorPickTarget(null);
                                          }}
                                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #f87171", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                              {d.mode === "step" && (
                                <>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Steps</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const st = Array.isArray(d.steps) ? [...d.steps] : [];
                                      st.push({ id: newId(), title: "", showAnnotationIds: [] });
                                      updateBlock(currentPage!.pageId, idx, { steps: st });
                                    }}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "2px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.08)", cursor: "pointer", fontWeight: 700, marginBottom: 8 }}
                                  >
                                    + Add step
                                  </button>
                                  {(d.steps ?? []).map((s, si) => (
                                    <div key={s.id} style={{ marginBottom: 12, padding: 10, background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                                      <input
                                        type="text"
                                        value={s.title ?? ""}
                                        onChange={(e) => {
                                          const next = [...(d.steps ?? [])];
                                          if (next[si]) next[si] = { ...next[si], title: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { steps: next });
                                        }}
                                        placeholder="Step title"
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #93c5fd", marginBottom: 8 }}
                                      />
                                      <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 4 }}>Show annotations:</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {(d.annotations ?? []).map((ann) => {
                                          const showIds = s.showAnnotationIds ?? [];
                                          const checked = showIds.includes(ann.id);
                                          return (
                                            <label key={ann.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                  const next = [...(d.steps ?? [])];
                                                  const nextShow = checked ? showIds.filter((id) => id !== ann.id) : [...showIds, ann.id];
                                                  if (next[si]) next[si] = { ...next[si], showAnnotationIds: nextShow };
                                                  updateBlock(currentPage!.pageId, idx, { steps: next });
                                                }}
                                              />
                                              <span>{ann.text?.trim() || ann.id.slice(0, 8)}</span>
                                            </label>
                                          );
                                        })}
                                        {(d.annotations ?? []).length === 0 && <span style={{ color: "#64748b" }}>Add annotations above first.</span>}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (d.steps ?? []).filter((_, i) => i !== si);
                                          updateBlock(currentPage!.pageId, idx, { steps: next });
                                        }}
                                        style={{ marginTop: 6, padding: "4px 10px", borderRadius: 6, border: "1px solid #f87171", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                      >
                                        Remove step
                                      </button>
                                    </div>
                                  ))}
                                </>
                              )}
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                                <label style={{ display: "block", marginBottom: 10 }}>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Diagram title</div>
                                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#6b7280" }}>
                                    Shown above the image for students — e.g. &quot;Structure of a leaf cell&quot;.
                                  </p>
                                  <LessonAutoTextarea
                                    editorVariant="plain"
                                    value={d.title ?? ""}
                                    onChange={(v) => updateBlock(currentPage!.pageId, idx, { title: v })}
                                    placeholder="What is this diagram about?"
                                    minHeightPx={56}
                                    style={{ fontSize: "0.9375rem" }}
                                  />
                                </label>
                                {diagramInstructionsHiddenFromStudents(d) ? (
                                  <div
                                    role="status"
                                    style={{
                                      marginBottom: 10,
                                      padding: "10px 12px",
                                      borderRadius: 8,
                                      border: "1px solid #fcd34d",
                                      background: "#fffbeb",
                                      color: "#92400e",
                                      fontSize: 12,
                                      lineHeight: 1.45,
                                    }}
                                  >
                                    This long diagram text may be hidden from student view. Add &quot;Task:&quot; or
                                    &quot;Instruction:&quot; to make student-facing instructions appear.
                                  </div>
                                ) : null}
                                <label style={{ display: "block", marginBottom: 10 }}>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Diagram instructions / subtitle</div>
                                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#6b7280" }}>
                                    Teacher explanation shown below the diagram — what to look for and how to read the image.
                                  </p>
                                  <LessonAutoTextarea
                                    editorVariant="plain"
                                    value={d.subtitle ?? ""}
                                    onChange={(v) => updateBlock(currentPage!.pageId, idx, { subtitle: v })}
                                    placeholder="Study the reflex arc shown in the diagram. Follow the pathway of an electrical impulse from stimulus to response."
                                    minHeightPx={72}
                                    style={{ fontSize: "0.9375rem" }}
                                  />
                                </label>
                                <label style={{ display: "block", marginBottom: 10 }}>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Student task</div>
                                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#6b7280" }}>
                                    Questions or activities for students — numbered steps, challenges, or exam-style prompts.
                                  </p>
                                  <LessonAutoTextarea
                                    editorVariant="plain"
                                    value={d.studentTask ?? ""}
                                    onChange={(v) => updateBlock(currentPage!.pageId, idx, { studentTask: v })}
                                    placeholder={"Task\n\n1. Name the five stages of the reflex arc.\n2. Describe the pathway from receptor to effector.\n3. Explain the role of each neurone."}
                                    minHeightPx={96}
                                    style={{ fontSize: "0.9375rem" }}
                                  />
                                </label>
                                <label style={{ display: "block", marginBottom: 10 }}>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Caption / source note (optional)</div>
                                  <p style={{ margin: "0 0 6px", fontSize: 11, color: "#6b7280" }}>
                                    Small text below the task — source, credit, or brief figure note.
                                  </p>
                                  <LessonAutoTextarea
                                    editorVariant="plain"
                                    value={d.caption ?? ""}
                                    onChange={(v) => updateBlock(currentPage!.pageId, idx, { caption: v })}
                                    placeholder="e.g. GCSE AQA Biology Higher Tier: Reflex Arc and Nervous System."
                                    minHeightPx={56}
                                    style={{ fontSize: "0.9375rem" }}
                                  />
                                </label>
                                <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#374151" }}>Add diagram</p>
                                {diagramAssetLibraryEnabled && d.diagramAssetId ? (
                                  <p style={{ margin: "0 0 8px", fontSize: 12, color: "#166534" }}>
                                    Linked to Diagram Library asset.
                                  </p>
                                ) : null}
                                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#6b7280" }}>Recommended: upload your own image (you must have rights to use it). AI is instructed to create original work only; do not use AI output if it resembles existing diagrams.</p>
                                <input
                                  ref={(el) => {
                                    fileInputRef.current[`${key}:diagram`] = el;
                                  }}
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    uploadImageForLessonDiagramBlock(f, currentPage!.pageId, idx, (url) =>
                                      updateBlock(currentPage!.pageId, idx, {
                                        visualId: undefined,
                                        diagramAssetId: undefined,
                                        imageUrl: url,
                                        imageSource: "upload",
                                        source: undefined,
                                        elements: undefined,
                                      })
                                    );
                                    e.target.value = "";
                                  }}
                                />
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                {diagramAssetLibraryEnabled ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDiagramAssetLibraryTarget({
                                        pageId: currentPage!.pageId,
                                        blockIndex: idx,
                                      })
                                    }
                                    style={{
                                      padding: "8px 14px",
                                      borderRadius: 10,
                                      border: "2px solid rgba(124,58,237,0.4)",
                                      background: "rgba(124,58,237,0.08)",
                                      color: "#5b21b6",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                      fontSize: 13,
                                    }}
                                  >
                                    Choose from Diagram Library
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = fileInputRef.current[`${key}:diagram`];
                                    if (input) {
                                      input.value = "";
                                      input.click();
                                    }
                                  }}
                                  disabled={uploadingKey === `${key}:diagram`}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(220,38,38,0.35)",
                                    background: "rgba(254,242,242,0.6)",
                                    color: "#991b1b",
                                    cursor: uploadingKey === `${key}:diagram` ? "not-allowed" : "pointer",
                                    fontWeight: 700,
                                    fontSize: 13,
                                  }}
                                  title="JPG, PNG, or WEBP from your computer"
                                >
                                  {uploadingKey === `${key}:diagram` ? "Uploading…" : "Upload image"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDiagramPickerTarget({ pageId: currentPage!.pageId, blockIndex: idx })}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(34,197,94,0.35)",
                                    background: "rgba(34,197,94,0.08)",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                  }}
                                >
                                  Replace diagram
                                </button>
                                <button
                                  type="button"
                                  disabled={!!generateDiagramLoading || !id}
                                  onClick={async () => {
                                    if (!id || !currentPage) return;
                                    const blockKey = `${currentPage.pageId}-${idx}`;
                                    setGenerateDiagramLoading(blockKey);
                                    setGenerateDiagramError(null);
                                    try {
                                      const res = await api.post("/ai/generate-diagram", {
                                        lessonId: id,
                                        pageIndex: currentPageIndex,
                                        blockIndex: idx,
                                        purpose: (d.caption?.trim()) || undefined,
                                        runAlignmentCheck: false,
                                      });
                                      if (res.data?.success && res.data?.imageUrl) {
                                        const userCaption = d.caption?.trim();
                                        updateBlock(currentPage.pageId, idx, {
                                          visualId: undefined,
                                          diagramAssetId: undefined,
                                          imageUrl: res.data.imageUrl,
                                          imageSource: res.data.imageSource ?? "ai",
                                          alt: res.data.altText ?? userCaption ?? undefined,
                                          caption: userCaption ? userCaption : (res.data.altText ?? ""),
                                        });
                                      }
                                    } catch (e: unknown) {
                                      const msg = (e as { response?: { data?: { error?: string }; status?: number } })?.response?.data?.error ?? (e as Error)?.message ?? "Generation failed";
                                      setGenerateDiagramError(msg);
                                    } finally {
                                      setGenerateDiagramLoading(null);
                                    }
                                  }}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(59,130,246,0.5)",
                                    background: "rgba(59,130,246,0.1)",
                                    color: "#1d4ed8",
                                    cursor: generateDiagramLoading || !id ? "not-allowed" : "pointer",
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}
                                  title="AI often adds incorrect labels; use Replace diagram for accurate diagrams."
                                >
                                  {generateDiagramLoading === `${currentPage!.pageId}-${idx}` ? "Generating…" : "Try AI"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateBlock(currentPage!.pageId, idx, {
                                      visualId: undefined,
                                      diagramAssetId: undefined,
                                      imageUrl: undefined,
                                      imageSource: undefined,
                                      alt: undefined,
                                      annotations: [],
                                    });
                                  }}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(239,68,68,0.35)",
                                    background: "rgba(239,68,68,0.08)",
                                    color: "#b91c1c",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}
                                >
                                  Clear diagram
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const diagramKey = `${currentPage!.pageId}-${idx}`;
                                    diagramBlockContainerRef.current[diagramKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid #64748b",
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}
                                >
                                  Done
                                </button>
                                </div>
                              </div>
                              {generateDiagramError && (
                                <div style={{ marginTop: 8, fontSize: 13, color: "#b91c1c" }}>{generateDiagramError}</div>
                              )}
                            </div>
                          ) : isInteractiveSequence ? (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                              <TeacherBrainDesignBriefPanel
                                blockType={blockType}
                                note={(b as LessonPageBlock).note}
                                onNoteChange={(note) => updateBlock(currentPage!.pageId, idx, { note })}
                                onRequestInject={() =>
                                  void handleInjectTeacherBrainBriefs({
                                    pageId: currentPage!.pageId,
                                    blockIndex: idx,
                                    blockType,
                                  })
                                }
                                injectLoading={teacherBrainInjectLoading}
                                refreshKey={teacherBrainBriefRefreshKey}
                              />
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Activity title</div>
                                <input
                                  value={safeStr((b as LessonPageBlock).title, "")}
                                  onChange={(e) => updateBlock(currentPage!.pageId, idx, { title: e.target.value })}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                  placeholder="e.g. Mitosis – interactive activity"
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Intro</div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={safeStr((b as LessonPageBlock).intro, "")}
                                  onChange={(v) => updateBlock(currentPage!.pageId, idx, { intro: v })}
                                  placeholder="Short introduction for students…"
                                  minHeightPx={80}
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                                Step images are optional, but recommended. Upload one image per step for best
                                results.
                              </p>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const tmpl = INTERACTIVE_SEQUENCE_TEMPLATE_MITOSIS;
                                    const cur = (b as LessonPageBlock).sequenceSteps ?? [];
                                    const hasContent = cur.some(
                                      (row) =>
                                        String(row?.title ?? "").trim() ||
                                        String(row?.description ?? "").trim() ||
                                        String(row?.imageUrl ?? "").trim()
                                    );
                                    if (hasContent) {
                                      if (
                                        !window.confirm(
                                          "Replace current steps with the mitosis sequence template? This overwrites titles, intro text, step explanations, and loads the default LetsRevise mitosis diagrams and optional Test me key ideas."
                                        )
                                      ) {
                                        return;
                                      }
                                    }
                                    updateBlock(currentPage!.pageId, idx, {
                                      title: tmpl.title,
                                      intro: tmpl.intro,
                                      sequenceSteps: tmpl.sequenceSteps.map((row) => ({
                                        ...(row.id ? { id: row.id } : {}),
                                        title: row.title,
                                        description: row.description,
                                        imageUrl: row.imageUrl ?? "",
                                        caption: row.caption ?? "",
                                        ...(typeof row.testExplanation === "string" && row.testExplanation.trim()
                                          ? { testExplanation: row.testExplanation.trim() }
                                          : {}),
                                      })),
                                    });
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "2px solid rgba(124, 58, 237, 0.38)",
                                    background: "rgba(124, 58, 237, 0.08)",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                    fontSize: 13,
                                    color: "#5b21b6",
                                  }}
                                >
                                  {INTERACTIVE_SEQUENCE_TEMPLATE_MITOSIS.label}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cur = Array.isArray((b as LessonPageBlock).sequenceSteps)
                                      ? [...((b as LessonPageBlock).sequenceSteps as NonNullable<LessonPageBlock["sequenceSteps"]>)]
                                      : [];
                                    cur.push(
                                      createInteractiveSequenceStepEntry(b as LessonPageBlock, cur)
                                    );
                                    updateBlock(currentPage!.pageId, idx, { sequenceSteps: cur });
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "2px solid rgba(99,102,241,0.35)",
                                    background: "rgba(99,102,241,0.08)",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                  }}
                                >
                                  + Add step
                                </button>
                              </div>
                              {(Array.isArray((b as LessonPageBlock).sequenceSteps)
                                ? (b as LessonPageBlock).sequenceSteps!
                                : []
                              ).map((step, si) => {
                                const stepKey = `${key}:seq:${si}`;
                                const stepUploading = uploadingKey === stepKey;
                                const seqLen = ((b as LessonPageBlock).sequenceSteps ?? []).length;
                                const stepDescRaw = String(step.description ?? "");
                                const stepExplanationMain = stripSequenceStepImagePromptFromDescription(stepDescRaw);
                                const stepImagePrompt = extractSequenceStepImagePromptFromDescription(stepDescRaw);
                                return (
                                  <div
                                    key={si}
                                    style={{
                                      padding: 12,
                                      borderRadius: 10,
                                      border: "1px solid #e2e8f0",
                                      background: "#fafafa",
                                    }}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                        marginBottom: 8,
                                      }}
                                    >
                                      <div style={{ fontWeight: 800, color: "#3730a3" }}>Step {si + 1}</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                        <button
                                          type="button"
                                          title="Move step up"
                                          disabled={si === 0}
                                          onClick={() => {
                                            if (si <= 0) return;
                                            const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                            const t = steps[si - 1];
                                            steps[si - 1] = steps[si]!;
                                            steps[si] = t!;
                                            updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                          }}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "5px 10px",
                                            borderRadius: 6,
                                            border: "1px solid #c4b5fd",
                                            background: si === 0 ? "#f1f5f9" : "white",
                                            color: si === 0 ? "#94a3b8" : "#5b21b6",
                                            cursor: si === 0 ? "not-allowed" : "pointer",
                                            fontWeight: 700,
                                            fontSize: 12,
                                          }}
                                        >
                                          <span aria-hidden>↑</span>
                                          <span>Move up</span>
                                        </button>
                                        <button
                                          type="button"
                                          title="Move step down"
                                          disabled={si >= seqLen - 1}
                                          onClick={() => {
                                            if (si >= seqLen - 1) return;
                                            const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                            const t = steps[si + 1];
                                            steps[si + 1] = steps[si]!;
                                            steps[si] = t!;
                                            updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                          }}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 4,
                                            padding: "5px 10px",
                                            borderRadius: 6,
                                            border: "1px solid #c4b5fd",
                                            background: si >= seqLen - 1 ? "#f1f5f9" : "white",
                                            color: si >= seqLen - 1 ? "#94a3b8" : "#5b21b6",
                                            cursor: si >= seqLen - 1 ? "not-allowed" : "pointer",
                                            fontWeight: 700,
                                            fontSize: 12,
                                          }}
                                        >
                                          <span aria-hidden>↓</span>
                                          <span>Move down</span>
                                        </button>
                                      </div>
                                    </div>
                                    <input
                                      ref={(el) => {
                                        fileInputRef.current[stepKey] = el;
                                      }}
                                      type="file"
                                      accept="image/*"
                                      style={{ display: "none" }}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (!f) return;
                                        uploadImageForSequenceStep(
                                          f,
                                          currentPage!.pageId,
                                          idx,
                                          si,
                                          (url) => {
                                            const steps = [
                                              ...((b as LessonPageBlock).sequenceSteps ?? [
                                                {
                                                  title: "",
                                                  description: "",
                                                  imageUrl: "",
                                                  caption: "",
                                                  testExplanation: "",
                                                },
                                              ]),
                                            ];
                                            if (steps[si])
                                              steps[si] = { ...steps[si], imageUrl: url };
                                            updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                          }
                                        );
                                        e.target.value = "";
                                      }}
                                    />
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Step title</div>
                                      <input
                                        value={step.title ?? ""}
                                        onChange={(e) => {
                                          const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                          if (steps[si]) steps[si] = { ...steps[si], title: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "8px 10px",
                                          borderRadius: 8,
                                          border: "1px solid #cbd5e1",
                                        }}
                                      />
                                    </label>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Explanation</div>
                                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                        Shown to students as the main step explanation.
                                      </div>
                                      <LessonAutoTextarea
                                        editorVariant="plain"
                                        value={stepExplanationMain}
                                        onChange={(v) => {
                                          const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                          if (steps[si]) {
                                            const ip = extractSequenceStepImagePromptFromDescription(
                                              String(steps[si]?.description ?? "")
                                            );
                                            steps[si] = {
                                              ...steps[si],
                                              description: mergeSequenceStepDescriptionAndImagePrompt(v, ip),
                                            };
                                          }
                                          updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                        }}
                                        placeholder="What happens in this step…"
                                        minHeightPx={80}
                                        style={{ fontSize: "0.875rem" }}
                                      />
                                    </label>
                                    {!String(step.imageUrl ?? "").trim() ? (
                                      <p
                                        style={{
                                          margin: "0 0 10px",
                                          padding: "10px 12px",
                                          borderRadius: 8,
                                          border: "1px dashed #a78bfa",
                                          background: "#faf5ff",
                                          color: "#6d28d9",
                                          fontSize: 13,
                                          fontWeight: 600,
                                        }}
                                      >
                                        Add an image for this step
                                      </p>
                                    ) : null}
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                        Image URL (optional — or upload)
                                      </div>
                                      <input
                                        value={step.imageUrl ?? ""}
                                        onChange={(e) => {
                                          const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                          if (steps[si]) steps[si] = { ...steps[si], imageUrl: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "8px 10px",
                                          borderRadius: 8,
                                          border: "1px solid #cbd5e1",
                                        }}
                                        placeholder="https://… or path from upload"
                                      />
                                    </label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const input = fileInputRef.current[stepKey];
                                          if (input) {
                                            input.value = "";
                                            input.click();
                                          }
                                        }}
                                        disabled={stepUploading}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(99,102,241,0.35)",
                                          background: "white",
                                          cursor: stepUploading ? "not-allowed" : "pointer",
                                          fontWeight: 700,
                                          fontSize: 13,
                                        }}
                                      >
                                        {stepUploading ? "Uploading…" : "Upload image"}
                                      </button>
                                    </div>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                        Image prompt (optional)
                                      </div>
                                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                        Teacher-only image generation idea. Not shown to students.
                                      </div>
                                      <LessonAutoTextarea
                                        editorVariant="plain"
                                        value={stepImagePrompt}
                                        onChange={(v) => {
                                          const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                          if (steps[si]) {
                                            const main = stripSequenceStepImagePromptFromDescription(
                                              String(steps[si]?.description ?? "")
                                            );
                                            steps[si] = {
                                              ...steps[si],
                                              description: mergeSequenceStepDescriptionAndImagePrompt(main, v),
                                            };
                                          }
                                          updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                        }}
                                        placeholder="e.g. Simple diagram: virus particle binding to a host cell receptor"
                                        minHeightPx={56}
                                        style={{ fontSize: "0.875rem" }}
                                      />
                                    </label>
                                    <div
                                      style={{
                                        marginTop: 12,
                                        padding: "14px 14px 16px",
                                        borderRadius: 12,
                                        border: "2px solid #a78bfa",
                                        background: "linear-gradient(180deg,#faf5ff 0%,#ffffff 52%)",
                                        boxShadow: "0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 18px rgba(91,33,182,0.09)",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontWeight: 900,
                                          fontSize: 13,
                                          color: "#5b21b6",
                                          marginBottom: 10,
                                          letterSpacing: "0.02em",
                                        }}
                                      >
                                        Test me · reveal feedback (students)
                                      </div>
                                      <label style={{ display: "block", marginBottom: 10 }}>
                                        <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
                                          Test me answer / key idea
                                        </div>
                                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                          Optional. Shown when students choose “Reveal answer / key idea”.
                                        </div>
                                        <textarea
                                          value={step.caption ?? ""}
                                          rows={4}
                                          onChange={(e) => {
                                            const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                            const v = e.target.value;
                                            if (steps[si]) steps[si] = { ...steps[si], caption: v };
                                            updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                          }}
                                          placeholder="Answer or key idea (leave blank for no reveal on this step)"
                                          spellCheck={true}
                                          style={{
                                            width: "100%",
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            border: "2px solid rgba(124,58,237,0.45)",
                                            fontSize: "0.9375rem",
                                            fontFamily: "inherit",
                                            lineHeight: 1.55,
                                            resize: "vertical",
                                            minHeight: 96,
                                            boxSizing: "border-box",
                                          }}
                                        />
                                      </label>
                                      <div
                                        style={{
                                          paddingTop: 12,
                                          marginTop: 4,
                                          borderTop: "2px dashed rgba(91,33,182,0.28)",
                                        }}
                                      >
                                        <label style={{ display: "block", marginBottom: 0 }}>
                                          <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
                                            Test me explanation (optional)
                                          </div>
                                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                            Shown together with the key idea after reveal.
                                          </div>
                                          <textarea
                                            value={step.testExplanation ?? ""}
                                            rows={5}
                                            onChange={(e) => {
                                              const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                              const v = e.target.value;
                                              if (steps[si]) steps[si] = { ...steps[si], testExplanation: v };
                                              updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                            }}
                                            placeholder="Extra explanation after reveal (optional)"
                                            spellCheck={true}
                                            style={{
                                              width: "100%",
                                              padding: "10px 12px",
                                              borderRadius: 10,
                                              border: "2px solid rgba(91,33,182,0.55)",
                                              fontSize: "0.9375rem",
                                              fontFamily: "inherit",
                                              lineHeight: 1.55,
                                              resize: "vertical",
                                              minHeight: 120,
                                              boxSizing: "border-box",
                                              background: "#fff",
                                            }}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                    <div
                                      style={{
                                        marginTop: 10,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        alignItems: "center",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                          steps.splice(si + 1, 0, {
                                            id: newId(),
                                            title: "",
                                            description: "",
                                            imageUrl: "",
                                            caption: "",
                                            testExplanation: "",
                                          });
                                          updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                        }}
                                        style={{
                                          padding: "5px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(34,197,94,0.4)",
                                          background: "rgba(220,252,231,0.5)",
                                          color: "#166534",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                          fontSize: 12,
                                        }}
                                      >
                                        + Insert step below
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const steps = [...((b as LessonPageBlock).sequenceSteps ?? [])];
                                          if (steps.length <= 1) return;
                                          steps.splice(si, 1);
                                          updateBlock(currentPage!.pageId, idx, { sequenceSteps: steps });
                                        }}
                                        disabled={((b as LessonPageBlock).sequenceSteps?.length ?? 0) <= 1}
                                        style={{
                                          padding: "4px 10px",
                                          borderRadius: 6,
                                          border: "1px solid #f87171",
                                          background: "#fef2f2",
                                          color: "#b91c1c",
                                          cursor:
                                            ((b as LessonPageBlock).sequenceSteps?.length ?? 0) <= 1
                                              ? "not-allowed"
                                              : "pointer",
                                          fontSize: 12,
                                          fontWeight: 600,
                                          opacity: ((b as LessonPageBlock).sequenceSteps?.length ?? 0) <= 1 ? 0.5 : 1,
                                        }}
                                      >
                                        Remove step
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : isInteractiveDiagram ? (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                              <TeacherBrainDesignBriefPanel
                                blockType={blockType}
                                note={(b as LessonPageBlock).note}
                                onNoteChange={(note) => updateBlock(currentPage!.pageId, idx, { note })}
                                onRequestInject={() =>
                                  void handleInjectTeacherBrainBriefs({
                                    pageId: currentPage!.pageId,
                                    blockIndex: idx,
                                    blockType,
                                  })
                                }
                                injectLoading={teacherBrainInjectLoading}
                                refreshKey={teacherBrainBriefRefreshKey}
                              />
                              {diagramBriefFromBlockEnabled && lesson ? (
                                <GenerateDiagramBriefPanel
                                  block={b as unknown as Record<string, unknown>}
                                  lesson={{
                                    subject: lesson.subject,
                                    board: lesson.examBoardName,
                                    tier: lesson.tier || lesson.level,
                                    topic: lesson.topic,
                                    subTopic: lesson.subTopic,
                                    level: lesson.level,
                                  }}
                                  page={{ title: currentPage?.title }}
                                />
                              ) : null}
                              <div
                                data-testid="interactive-diagram-step-1-upload"
                                style={{
                                  padding: 14,
                                  borderRadius: 12,
                                  border: "2px solid rgba(220, 38, 38, 0.25)",
                                  background: "linear-gradient(180deg, rgba(254, 242, 242, 0.65) 0%, #ffffff 100%)",
                                }}
                              >
                                <div style={{ fontWeight: 900, fontSize: 15, color: "#991b1b", marginBottom: 10 }}>
                                  Step 1 — Upload Activity Image
                                </div>
                                <input
                                  ref={(el) => {
                                    fileInputRef.current[`${key}:idiagram`] = el;
                                  }}
                                  type="file"
                                  accept="image/*"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    uploadImageForInteractiveDiagram(
                                      f,
                                      currentPage!.pageId,
                                      idx,
                                      (url) => updateBlock(currentPage!.pageId, idx, { imageUrl: url })
                                    );
                                    e.target.value = "";
                                  }}
                                />
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const input = fileInputRef.current[`${key}:idiagram`];
                                      if (input) {
                                        input.value = "";
                                        input.click();
                                      }
                                    }}
                                    disabled={uploadingKey === `${key}:idiagram`}
                                    style={{
                                      padding: "8px 14px",
                                      borderRadius: 8,
                                      border: "2px solid rgba(220,38,38,0.35)",
                                      background: "rgba(254,242,242,0.6)",
                                      cursor: uploadingKey === `${key}:idiagram` ? "not-allowed" : "pointer",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {uploadingKey === `${key}:idiagram` ? "Uploading…" : "Upload image"}
                                  </button>
                                </div>
                                <label style={{ display: "block", marginTop: 10 }}>
                                  <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 12 }}>Image URL (optional)</div>
                                  <input
                                    value={safeStr((b as LessonPageBlock).imageUrl, "")}
                                    onChange={(e) => updateBlock(currentPage!.pageId, idx, { imageUrl: e.target.value })}
                                    style={{
                                      width: "100%",
                                      padding: "8px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #cbd5e1",
                                      boxSizing: "border-box",
                                    }}
                                    placeholder="https://… or from upload"
                                  />
                                </label>
                              </div>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Title</div>
                                <input
                                  value={safeStr((b as LessonPageBlock).title, "")}
                                  onChange={(e) => updateBlock(currentPage!.pageId, idx, { title: e.target.value })}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                  placeholder="e.g. Parts of a microscope"
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Instructions</div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={safeStr((b as LessonPageBlock).intro, "")}
                                  onChange={(v) => updateBlock(currentPage!.pageId, idx, { intro: v })}
                                  placeholder="e.g. Click each letter to learn what it does."
                                  minHeightPx={80}
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const h = (b as LessonPageBlock).hotspots ?? [];
                                    updateBlock(currentPage!.pageId, idx, {
                                      hotspots: [
                                        ...h,
                                        createInteractiveDiagramHotspotEntry(b as LessonPageBlock, h),
                                      ],
                                    });
                                  }}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 8,
                                    border: "2px solid #94a3b8",
                                    background: "#f1f5f9",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                  }}
                                >
                                  + Add hotspot
                                </button>
                                {((b as LessonPageBlock).hotspots ?? []).length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm("Clear all hotspot positions? Labels and explanations will be kept.")) {
                                        return;
                                      }
                                      const list = ((b as LessonPageBlock).hotspots ?? []).map((hot) => {
                                        const h = hot as {
                                          id: string;
                                          label: string;
                                          description: string;
                                          explanation?: string;
                                          x?: number;
                                          y?: number;
                                        };
                                        const { x: _x, y: _y, ...rest } = h;
                                        return { ...rest };
                                      });
                                      setInteractiveDiagramPlacingId((p) => ({ ...p, [key]: null }));
                                      updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                    }}
                                    style={{
                                      padding: "8px 14px",
                                      borderRadius: 8,
                                      border: "2px solid rgba(180, 83, 9, 0.45)",
                                      background: "rgba(255, 251, 235, 0.95)",
                                      color: "#92400e",
                                      cursor: "pointer",
                                      fontWeight: 700,
                                    }}
                                  >
                                    Clear hotspot positions
                                  </button>
                                ) : null}
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    minWidth: 200,
                                    flex: "1 1 220px",
                                  }}
                                >
                                  <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>Template</div>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                    <select
                                      aria-label="Interactive diagram template"
                                      value={interactiveDiagramTemplateSelect[key] ?? ""}
                                      onChange={(e) =>
                                        setInteractiveDiagramTemplateSelect((prev) => ({
                                          ...prev,
                                          [key]: e.target.value,
                                        }))
                                      }
                                      style={{
                                        padding: "8px 10px",
                                        borderRadius: 8,
                                        border: "1px solid #cbd5e1",
                                        minWidth: 0,
                                        flex: "1 1 160px",
                                        fontSize: 14,
                                        background: "#fff",
                                      }}
                                    >
                                      <option value="">Choose template…</option>
                                      {INTERACTIVE_DIAGRAM_TEMPLATES.map((t) => (
                                        <option key={t.id} value={t.id}>
                                          {t.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const selId = interactiveDiagramTemplateSelect[key] ?? "";
                                        const tmpl = INTERACTIVE_DIAGRAM_TEMPLATES.find((t) => t.id === selId);
                                        if (!tmpl) {
                                          setSaveMsg("Choose a template first.");
                                          setTimeout(() => setSaveMsg(""), 5000);
                                          return;
                                        }
                                        const currentHotspots = (b as LessonPageBlock).hotspots ?? [];
                                        if (currentHotspots.length > 0) {
                                          if (!window.confirm("This will replace existing hotspots. Continue?")) {
                                            return;
                                          }
                                        }
                                        const existingImageUrl = safeStr(
                                          (b as LessonPageBlock).imageUrl,
                                          ""
                                        ).trim();
                                        setInteractiveDiagramPlacingId((p) => ({ ...p, [key]: null }));
                                        const patch: Partial<LessonPageBlock> = {
                                          title: tmpl.title,
                                          intro: tmpl.intro,
                                        };
                                        if (existingImageUrl) {
                                          patch.hotspots = tmpl.hotspots.map((row) => ({
                                            id: row.id?.trim() || newId(),
                                            label: row.label,
                                            description: row.description,
                                            explanation: row.description,
                                            ...(row.test ? { test: row.test } : {}),
                                          }));
                                        } else if (tmpl.imageUrl) {
                                          patch.imageUrl = tmpl.imageUrl;
                                          patch.hotspots = tmpl.hotspots.map((row) => ({
                                            id: row.id?.trim() || newId(),
                                            x: row.x,
                                            y: row.y,
                                            label: row.label,
                                            description: row.description,
                                            explanation: row.description,
                                            ...(row.test ? { test: row.test } : {}),
                                          }));
                                        } else {
                                          patch.hotspots = tmpl.hotspots.map((row) => ({
                                            id: row.id?.trim() || newId(),
                                            label: row.label,
                                            description: row.description,
                                            explanation: row.description,
                                            ...(row.test ? { test: row.test } : {}),
                                          }));
                                        }
                                        updateBlock(currentPage!.pageId, idx, patch);
                                        const appliedTemplateImage = !existingImageUrl && Boolean(tmpl.imageUrl);
                                        setInteractiveDiagramTemplateHint((prev) => ({
                                          ...prev,
                                          [key]: existingImageUrl
                                            ? "Template applied. Choose each hotspot below, then click the image to place it."
                                            : appliedTemplateImage
                                              ? "Template applied with matching image. Adjust hotspot positions if needed."
                                              : "Template applied. Upload or choose the matching image, then adjust hotspot positions if needed.",
                                        }));
                                        setTimeout(() => {
                                          setInteractiveDiagramTemplateHint((prev) => {
                                            const next = { ...prev };
                                            delete next[key];
                                            return next;
                                          });
                                        }, 12000);
                                      }}
                                      style={{
                                        padding: "8px 14px",
                                        borderRadius: 8,
                                        border: "2px solid #86efac",
                                        background: "rgba(22, 163, 74, 0.08)",
                                        color: "#14532d",
                                        cursor: "pointer",
                                        fontWeight: 700,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      Apply template
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {interactiveDiagramTemplateHint[key] ? (
                                <p
                                  style={{
                                    margin: "4px 0 0 0",
                                    fontSize: 13,
                                    lineHeight: 1.45,
                                    color: "#0f766e",
                                    fontWeight: 600,
                                  }}
                                >
                                  {interactiveDiagramTemplateHint[key]}
                                </p>
                              ) : null}
                              {(() => {
                                const idgHotspots = Array.isArray((b as LessonPageBlock).hotspots)
                                  ? (b as LessonPageBlock).hotspots!
                                  : [];
                                const previewHotspots = idgHotspots.map((h, hi) =>
                                  normalizeInteractiveDiagramHotspot(h, hi)
                                );
                                const editorDiagramHotspots: PlacedInteractiveDiagramHotspot[] =
                                  previewHotspots.filter((h): h is PlacedInteractiveDiagramHotspot =>
                                    typeof h.x === "number" &&
                                    Number.isFinite(h.x) &&
                                    typeof h.y === "number" &&
                                    Number.isFinite(h.y)
                                  );
                                const src = (b as LessonPageBlock).imageUrl
                                  ? makeAbsoluteAssetUrl(String((b as LessonPageBlock).imageUrl)) ?? ""
                                  : "";
                                const placeTargetId = interactiveDiagramPlacingId[key] ?? null;
                                const placingHi =
                                  placeTargetId != null
                                    ? idgHotspots.findIndex((h, i) => String(h.id ?? i) === placeTargetId)
                                    : -1;
                                return (
                                  <>
                                    <div
                                      style={{
                                        marginTop: 12,
                                        marginBottom: 16,
                                        padding: 14,
                                        borderRadius: 12,
                                        border: "1px solid #bfdbfe",
                                        background: "linear-gradient(180deg, rgba(239,246,255,0.9) 0%, #ffffff 100%)",
                                      }}
                                    >
                                      <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                                        Student preview
                                      </div>
                                      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.45 }}>
                                        Same layout as the lesson: tap A/B/C… on the diagram, then read Answer and
                                        Explanation. Use <strong>Test me on this</strong> when a hotspot is placed.
                                      </p>
                                      <div
                                        style={{
                                          borderRadius: 12,
                                          border: "1px solid #e2e8f0",
                                          overflow: "hidden",
                                          background: "#fff",
                                          maxWidth: 960,
                                        }}
                                      >
                                        <InteractiveDiagramBlock
                                          blockTitle={safeStr((b as LessonPageBlock).title, "")}
                                          intro={safeStr((b as LessonPageBlock).intro, "")}
                                          imageUrl={String((b as LessonPageBlock).imageUrl ?? "")}
                                          hotspots={previewHotspots}
                                          resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                                          lessonTitle={lesson?.title}
                                          level={lesson?.level != null ? String(lesson.level) : undefined}
                                          subject={lesson?.subject != null ? String(lesson.subject) : undefined}
                                        />
                                      </div>
                                    </div>
                                    {!src ? (
                                      <p
                                        style={{
                                          margin: "0 0 12px 0",
                                          fontSize: 14,
                                          lineHeight: 1.55,
                                          color: "#475569",
                                          padding: "10px 12px",
                                          borderRadius: 10,
                                          background: "rgba(241, 245, 249, 0.9)",
                                          border: "1px solid #e2e8f0",
                                        }}
                                      >
                                        <strong>Tip:</strong> Upload an image or paste a URL to unlock{" "}
                                        <strong>Place hotspots on diagram</strong>. Use{" "}
                                        <strong>Place this hotspot</strong> in Hotspot editor, then click the placement
                                        image — or click the image to add a new hotspot. <strong>+ Add hotspot</strong>{" "}
                                        adds an unplaced label you can position later.
                                      </p>
                                    ) : (
                                      <div style={{ marginBottom: 16 }}>
                                        <div
                                          style={{
                                            fontWeight: 900,
                                            fontSize: 14,
                                            color: "#0f172a",
                                            marginBottom: 8,
                                          }}
                                        >
                                          Place hotspots on diagram
                                        </div>
                                        <p
                                          style={{
                                            margin: "0 0 10px 0",
                                            fontSize: 14,
                                            lineHeight: 1.55,
                                            color: "#0f172a",
                                            fontWeight: 600,
                                            padding: "10px 12px",
                                            borderRadius: 10,
                                            background: "rgba(219, 234, 254, 0.5)",
                                            border: "1px solid #bfdbfe",
                                          }}
                                        >
                                          {placeTargetId ? (
                                            <>
                                              <strong>Click the image</strong> to place hotspot{" "}
                                              <strong>{getHotspotLetter(placingHi)}</strong>
                                              , or pick another row in Hotspot editor.
                                            </>
                                          ) : (
                                            <>
                                              Click the image to add a hotspot, or use{" "}
                                              <strong>Place this hotspot</strong> in Hotspot editor, then click the
                                              image to position that label.
                                            </>
                                          )}
                                        </p>
                                        <div
                                          style={{
                                            width: "100%",
                                            maxWidth: 960,
                                            borderRadius: 12,
                                            overflow: "hidden",
                                            border: "1px solid #e2e8f0",
                                            lineHeight: 0,
                                            boxShadow: "0 2px 12px rgba(15, 23, 42, 0.06)",
                                          }}
                                        >
                                          <InteractiveDiagramBlock
                                            viewMode="editorImageOnly"
                                            blockTitle=""
                                            intro=""
                                            imageUrl={String((b as LessonPageBlock).imageUrl ?? "")}
                                            hotspots={editorDiagramHotspots}
                                            resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                                            onImageClickToPlace={(x, y) => {
                                              const hlist = (b as LessonPageBlock).hotspots ?? [];
                                              const placing = interactiveDiagramPlacingId[key] ?? null;
                                              if (placing) {
                                                const list = hlist.map((hot) => {
                                                  if (String(hot.id ?? "") !== placing) return hot;
                                                  return { ...hot, x, y };
                                                });
                                                setInteractiveDiagramPlacingId((p) => ({ ...p, [key]: null }));
                                                updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                                return;
                                              }
                                              updateBlock(currentPage!.pageId, idx, {
                                                hotspots: [
                                                  ...hlist,
                                                  createInteractiveDiagramHotspotEntry(
                                                    b as LessonPageBlock,
                                                    hlist,
                                                    { x, y }
                                                  ),
                                                ],
                                              });
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                              <div
                                style={{
                                  fontWeight: 900,
                                  fontSize: 15,
                                  color: "#0f172a",
                                  marginBottom: 10,
                                  paddingBottom: 6,
                                  borderBottom: "2px solid #fecaca",
                                }}
                              >
                                Hotspot editor
                              </div>
                              {((b as LessonPageBlock).hotspots ?? []).map((hot, hi) => {
                                const placed = isInteractiveDiagramHotspotPlaced(hot);
                                const hid = String(hot.id ?? hi);
                                const isPlacing = (interactiveDiagramPlacingId[key] ?? null) === hid;
                                return (
                                  <div
                                    key={hot.id || hi}
                                    style={{
                                      padding: 12,
                                      borderRadius: 10,
                                      border: isPlacing ? "2px solid #3b82f6" : "1px solid #fecaca",
                                      background: isPlacing ? "rgba(219, 234, 254, 0.35)" : "#fffbeb",
                                    }}
                                  >
                                    <div style={{ fontWeight: 800, marginBottom: 6, color: "#991b1b" }}>
                                      Hotspot {getHotspotLetter(hi)}
                                      {placed ? (
                                        <span style={{ fontWeight: 600, color: "#166534", marginLeft: 8 }}>
                                          Placed: {Math.round((hot as { x: number }).x)}%,{" "}
                                          {Math.round((hot as { y: number }).y)}%
                                        </span>
                                      ) : (
                                        <span style={{ fontWeight: 600, color: "#9a3412", marginLeft: 8 }}>Unplaced</span>
                                      )}
                                    </div>
                                    <div style={{ marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                      {isPlacing ? (
                                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>
                                          Click image to place…
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInteractiveDiagramPlacingId((p) => ({ ...p, [key]: hid }));
                                          }}
                                          style={{
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            border: "1px solid #3b82f6",
                                            background: "#eff6ff",
                                            color: "#1d4ed8",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: 13,
                                          }}
                                        >
                                          Place this hotspot
                                        </button>
                                      )}
                                      {isPlacing ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setInteractiveDiagramPlacingId((p) => ({ ...p, [key]: null }));
                                          }}
                                          style={{
                                            padding: "6px 10px",
                                            borderRadius: 8,
                                            border: "1px solid #94a3b8",
                                            background: "#f1f5f9",
                                            cursor: "pointer",
                                            fontSize: 12,
                                            fontWeight: 600,
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      ) : null}
                                    </div>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, fontSize: 12 }}>Label</div>
                                      <input
                                        value={hot.label ?? ""}
                                        onChange={(e) => {
                                          const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                          if (list[hi]) list[hi] = { ...list[hi], label: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                        }}
                                        style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                      />
                                    </label>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Explanation</div>
                                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                        Explain why this label is correct. Shown after reveal.
                                      </div>
                                      <LessonAutoTextarea
                                        editorVariant="plain"
                                        value={resolveInteractiveDiagramHotspotExplanation(hot)}
                                        onChange={(v) => {
                                          const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                          if (list[hi])
                                            list[hi] = { ...list[hi], explanation: v, description: v };
                                          updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                        }}
                                        minHeightPx={72}
                                        style={{ fontSize: "0.875rem" }}
                                      />
                                    </label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                      <label style={{ display: "block", fontSize: 12 }}>
                                        X (%)
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={
                                            typeof (hot as { x?: number }).x === "number" && Number.isFinite((hot as { x: number }).x)
                                              ? (hot as { x: number }).x
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                            if (!list[hi]) return;
                                            const v = e.target.value.trim();
                                            if (v === "") {
                                              const { x, y, ...rest } = list[hi] as {
                                                x?: number;
                                                y?: number;
                                                id: string;
                                                label: string;
                                                description: string;
                                              };
                                              list[hi] = { ...rest };
                                              updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                              return;
                                            }
                                            const x = Math.max(0, Math.min(100, Number(v) || 0));
                                            const curY = (list[hi] as { y?: number }).y;
                                            if (typeof curY === "number" && Number.isFinite(curY)) {
                                              list[hi] = { ...list[hi], x, y: Math.max(0, Math.min(100, curY)) };
                                            } else {
                                              list[hi] = { ...list[hi], x };
                                            }
                                            updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                          }}
                                          placeholder="—"
                                          style={{ width: "100%", marginTop: 4, padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                      </label>
                                      <label style={{ display: "block", fontSize: 12 }}>
                                        Y (%)
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={
                                            typeof (hot as { y?: number }).y === "number" && Number.isFinite((hot as { y: number }).y)
                                              ? (hot as { y: number }).y
                                              : ""
                                          }
                                          onChange={(e) => {
                                            const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                            if (!list[hi]) return;
                                            const v = e.target.value.trim();
                                            if (v === "") {
                                              const { x, y, ...rest } = list[hi] as {
                                                x?: number;
                                                y?: number;
                                                id: string;
                                                label: string;
                                                description: string;
                                              };
                                              list[hi] = { ...rest };
                                              updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                              return;
                                            }
                                            const y = Math.max(0, Math.min(100, Number(v) || 0));
                                            const curX = (list[hi] as { x?: number }).x;
                                            if (typeof curX === "number" && Number.isFinite(curX)) {
                                              list[hi] = { ...list[hi], y, x: Math.max(0, Math.min(100, curX)) };
                                            } else {
                                              list[hi] = { ...list[hi], y };
                                            }
                                            updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                          }}
                                          placeholder="—"
                                          style={{ width: "100%", marginTop: 4, padding: 6, borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                      </label>
                                    </div>
                                    <p style={{ fontSize: 11, color: "#64748b", margin: "0 0 8px 0" }}>
                                      Set both X and Y to place via numbers, or clear one to mark unplaced.
                                    </p>
                                    <div
                                      style={{
                                        marginBottom: 10,
                                        padding: 10,
                                        borderRadius: 8,
                                        border: "1px solid #e9d5ff",
                                        background: "#faf5ff",
                                      }}
                                    >
                                      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6, color: "#581c87" }}>
                                        Optional “Test me” MCQ (this hotspot)
                                      </div>
                                      {!(
                                        (hot as { test?: unknown }).test != null &&
                                        typeof (hot as { test?: unknown }).test === "object"
                                      ) ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                            if (!list[hi]) return;
                                            list[hi] = {
                                              ...list[hi],
                                              test: {
                                                question: "",
                                                options: ["", "", "", ""],
                                                correctIndex: 0,
                                              },
                                            };
                                            updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                          }}
                                          style={{
                                            padding: "6px 12px",
                                            borderRadius: 8,
                                            border: "1px solid #9333ea",
                                            background: "#f3e8ff",
                                            color: "#6b21a8",
                                            cursor: "pointer",
                                            fontWeight: 700,
                                            fontSize: 13,
                                          }}
                                        >
                                          Add MCQ (needs 4 options + correct choice to save)
                                        </button>
                                      ) : (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                          <label style={{ display: "block", fontSize: 12 }}>
                                            Question
                                            <input
                                              value={
                                                typeof (hot as { test?: { question?: string } }).test?.question ===
                                                "string"
                                                  ? String((hot as { test: { question?: string } }).test.question)
                                                  : ""
                                              }
                                              onChange={(e) => {
                                                const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                                const cur = list[hi] as { test?: Record<string, unknown> };
                                                const prev = (cur?.test ?? {}) as Record<string, unknown>;
                                                const opts = Array.isArray(prev.options)
                                                  ? [...(prev.options as string[])]
                                                  : ["", "", "", ""];
                                                while (opts.length < 4) opts.push("");
                                                list[hi] = {
                                                  ...list[hi],
                                                  test: hotspotTestPayloadFromPrev(prev, opts, {
                                                    question: e.target.value,
                                                  }),
                                                };
                                                updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                              }}
                                              style={{
                                                width: "100%",
                                                marginTop: 4,
                                                padding: 8,
                                                borderRadius: 6,
                                                border: "1px solid #cbd5e1",
                                              }}
                                            />
                                          </label>
                                          {[0, 1, 2, 3].map((oi) => (
                                            <label key={oi} style={{ display: "block", fontSize: 12 }}>
                                              Option {oi + 1}
                                              <input
                                                value={
                                                  Array.isArray((hot as { test?: { options?: string[] } }).test?.options)
                                                    ? String(
                                                        (hot as { test: { options?: string[] } }).test.options?.[oi] ??
                                                          ""
                                                      )
                                                    : ""
                                                }
                                                onChange={(e) => {
                                                  const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                                  const cur = list[hi] as { test?: Record<string, unknown> };
                                                  const prev = (cur?.test ?? {}) as Record<string, unknown>;
                                                  const opts = Array.isArray(prev.options)
                                                    ? [...(prev.options as string[])]
                                                    : ["", "", "", ""];
                                                  while (opts.length < 4) opts.push("");
                                                  opts[oi] = e.target.value;
                                                  list[hi] = {
                                                    ...list[hi],
                                                    test: hotspotTestPayloadFromPrev(prev, opts, {}),
                                                  };
                                                  updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                                }}
                                                style={{
                                                  width: "100%",
                                                  marginTop: 4,
                                                  padding: 8,
                                                  borderRadius: 6,
                                                  border: "1px solid #cbd5e1",
                                                }}
                                              />
                                            </label>
                                          ))}
                                          <label style={{ display: "block", fontSize: 12 }}>
                                            Correct option
                                            <select
                                              value={
                                                typeof (hot as { test?: { correctIndex?: unknown } }).test
                                                  ?.correctIndex === "number"
                                                  ? Math.max(
                                                      0,
                                                      Math.min(
                                                        3,
                                                        Math.round(
                                                          Number(
                                                            (hot as { test: { correctIndex: number } }).test
                                                              .correctIndex
                                                          )
                                                        )
                                                      )
                                                    )
                                                  : 0
                                              }
                                              onChange={(e) => {
                                                const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                                const cur = list[hi] as { test?: Record<string, unknown> };
                                                const prev = (cur?.test ?? {}) as Record<string, unknown>;
                                                const opts = Array.isArray(prev.options)
                                                  ? [...(prev.options as string[])]
                                                  : ["", "", "", ""];
                                                while (opts.length < 4) opts.push("");
                                                list[hi] = {
                                                  ...list[hi],
                                                  test: hotspotTestPayloadFromPrev(prev, opts, {
                                                    correctIndex: Math.max(0, Math.min(3, parseInt(e.target.value, 10) || 0)),
                                                  }),
                                                };
                                                updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                              }}
                                              style={{
                                                width: "100%",
                                                marginTop: 4,
                                                padding: 8,
                                                borderRadius: 6,
                                                border: "1px solid #cbd5e1",
                                              }}
                                            >
                                              <option value={0}>Option 1</option>
                                              <option value={1}>Option 2</option>
                                              <option value={2}>Option 3</option>
                                              <option value={3}>Option 4</option>
                                            </select>
                                          </label>
                                          <label style={{ display: "block", fontSize: 12 }}>
                                            Explanation (optional)
                                            <input
                                              value={
                                                typeof (hot as { test?: { explanation?: string } }).test
                                                  ?.explanation === "string"
                                                  ? String((hot as { test: { explanation?: string } }).test.explanation)
                                                  : ""
                                              }
                                              onChange={(e) => {
                                                const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                                const cur = list[hi] as { test?: Record<string, unknown> };
                                                const prev = (cur?.test ?? {}) as Record<string, unknown>;
                                                const opts = Array.isArray(prev.options)
                                                  ? [...(prev.options as string[])]
                                                  : ["", "", "", ""];
                                                while (opts.length < 4) opts.push("");
                                                list[hi] = {
                                                  ...list[hi],
                                                  test: hotspotTestPayloadFromPrev(prev, opts, {
                                                    explanation: e.target.value,
                                                  }),
                                                };
                                                updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                              }}
                                              style={{
                                                width: "100%",
                                                marginTop: 4,
                                                padding: 8,
                                                borderRadius: 6,
                                                border: "1px solid #cbd5e1",
                                              }}
                                            />
                                          </label>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const list = [...((b as LessonPageBlock).hotspots ?? [])];
                                              const row = list[hi] as { test?: unknown; [k: string]: unknown };
                                              const { test: _t, ...rest } = row;
                                              list[hi] = rest as (typeof list)[number];
                                              updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                            }}
                                            style={{
                                              alignSelf: "flex-start",
                                              padding: "4px 10px",
                                              borderRadius: 6,
                                              border: "1px solid #94a3b8",
                                              background: "#f1f5f9",
                                              cursor: "pointer",
                                              fontSize: 12,
                                              fontWeight: 600,
                                            }}
                                          >
                                            Remove MCQ
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInteractiveDiagramPlacingId((p) => {
                                          const next = { ...p };
                                          if (next[key] === hid) next[key] = null;
                                          return next;
                                        });
                                        const list = ((b as LessonPageBlock).hotspots ?? []).filter((_, i) => i !== hi);
                                        updateBlock(currentPage!.pageId, idx, { hotspots: list });
                                      }}
                                      style={{
                                        marginTop: 0,
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #f87171",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                      }}
                                    >
                                      Delete hotspot
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : isDragDropMatch ? (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                              <TeacherBrainDesignBriefPanel
                                blockType={blockType}
                                note={(b as LessonPageBlock).note}
                                onNoteChange={(note) => updateBlock(currentPage!.pageId, idx, { note })}
                                onRequestInject={() =>
                                  void handleInjectTeacherBrainBriefs({
                                    pageId: currentPage!.pageId,
                                    blockIndex: idx,
                                    blockType,
                                  })
                                }
                                injectLoading={teacherBrainInjectLoading}
                                refreshKey={teacherBrainBriefRefreshKey}
                              />
                              {diagramBriefFromBlockEnabled && lesson ? (
                                <GenerateDiagramBriefPanel
                                  block={b as unknown as Record<string, unknown>}
                                  lesson={{
                                    subject: lesson.subject,
                                    board: lesson.examBoardName,
                                    tier: lesson.tier || lesson.level,
                                    topic: lesson.topic,
                                    subTopic: lesson.subTopic,
                                    level: lesson.level,
                                  }}
                                  page={{ title: currentPage?.title }}
                                />
                              ) : null}
                              <DragDropMatchDiagramAuthoring
                                blk={b as LessonPageBlock}
                                newId={newId}
                                onPatch={(patch) =>
                                  updateBlock(
                                    currentPage!.pageId,
                                    idx,
                                    coalesceDragDropMatchBlockPatch(b, patch as Record<string, unknown>)
                                  )
                                }
                                placingZoneId={dragDropDiagramPlacingId[key] ?? null}
                                onPlacingZoneId={(id) =>
                                  setDragDropDiagramPlacingId((p) => ({ ...p, [key]: id }))
                                }
                                resolveImageUrlForPreview={(u) => makeAbsoluteAssetUrl(u) ?? u}
                                safeStr={safeStr}
                                onDiagramImageFile={(file) =>
                                  uploadImageForDragDropMatch(file, currentPage!.pageId, idx, (url) =>
                                    updateBlock(
                                      currentPage!.pageId,
                                      idx,
                                      coalesceDragDropMatchBlockPatch(b, { imageUrl: url })
                                    )
                                  )
                                }
                                diagramImageUploading={uploadingKey === `${currentPage!.pageId}:${idx}:ddm`}
                                onPairTargetImageFile={(file, pi) =>
                                  uploadImageForDragDropMatchPairAnswer(
                                    file,
                                    currentPage!.pageId,
                                    idx,
                                    pi,
                                    (url) => {
                                      const pairsList = Array.isArray((b as LessonPageBlock).pairs)
                                        ? [...((b as LessonPageBlock).pairs as NonNullable<LessonPageBlock["pairs"]>)]
                                        : [];
                                      if (pairsList[pi]) {
                                        pairsList[pi] = {
                                          ...pairsList[pi],
                                          imageUrl: url,
                                          answerImageUrl: undefined,
                                        };
                                      }
                                      updateBlock(currentPage!.pageId, idx, { pairs: pairsList });
                                    }
                                  )
                                }
                                isPairTargetImageUploading={(pi) => uploadingKey === `${key}:ddm-pair:${pi}`}
                              />
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Title</div>
                                <input
                                  value={safeStr((b as LessonPageBlock).title, "")}
                                  onChange={(e) => updateBlock(currentPage!.pageId, idx, { title: e.target.value })}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                  placeholder="e.g. Match organelles to their functions"
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Intro</div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={safeStr((b as LessonPageBlock).intro, "")}
                                  onChange={(v) => updateBlock(currentPage!.pageId, idx, { intro: v })}
                                  placeholder="Short introduction for students…"
                                  minHeightPx={80}
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Instructions</div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={safeStr((b as LessonPageBlock).instructions, "")}
                                  onChange={(v) => updateBlock(currentPage!.pageId, idx, { instructions: v })}
                                  placeholder="What students should do…"
                                  minHeightPx={72}
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                  AI topic or prompt (optional)
                                </div>
                                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.45 }}>
                                  If this has <strong>8+ characters</strong>, &quot;Generate pairs with AI&quot; builds{" "}
                                  <strong>4–6</strong> GCSE-style pairs from this text alone. Otherwise AI uses the
                                  lesson title, page title, intro, and instructions above (up to 8 pairs).
                                </div>
                                <textarea
                                  value={dragDropAiTopicPrompt[key] ?? ""}
                                  onChange={(e) =>
                                    setDragDropAiTopicPrompt((prev) => ({ ...prev, [key]: e.target.value }))
                                  }
                                  rows={3}
                                  placeholder="e.g. Enzymes — lock and key, active site, denaturation, optimum temperature…"
                                  style={{
                                    width: "100%",
                                    boxSizing: "border-box",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(148,163,184,0.45)",
                                    fontSize: "0.875rem",
                                    fontFamily: "inherit",
                                    lineHeight: 1.45,
                                  }}
                                />
                              </label>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                {(() => {
                                  const ddmMode = dragDropMatchModeFromBlockForProps(b as LessonPageBlock);
                                  const ttiMode = ddmMode === "text-to-image";
                                  const pairCap = ttiMode ? TEXT_TO_IMAGE_PAIR_LIMIT : 20;
                                  const curPairs = Array.isArray((b as LessonPageBlock).pairs)
                                    ? ((b as LessonPageBlock).pairs as NonNullable<LessonPageBlock["pairs"]>)
                                    : [];
                                  const atPairCap = curPairs.length >= pairCap;
                                  return (
                                    <>
                                <button
                                  type="button"
                                  disabled={atPairCap}
                                  onClick={() => {
                                    const cur = [...curPairs];
                                    cur.push({
                                      id: newId(),
                                      prompt: "",
                                      answer: "",
                                      explanation: "",
                                    });
                                    updateBlock(currentPage!.pageId, idx, { pairs: cur });
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "2px solid rgba(14,165,233,0.45)",
                                    background: "rgba(224,242,254,0.5)",
                                    cursor: atPairCap ? "not-allowed" : "pointer",
                                    fontWeight: 700,
                                    opacity: atPairCap ? 0.55 : 1,
                                  }}
                                >
                                  + Add pair
                                </button>
                                    </>
                                  );
                                })()}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!window.confirm("This will replace existing pairs. Continue?")) return;
                                    updateBlock(currentPage!.pageId, idx, {
                                      pairs: CELL_ORGANELLES_DRAG_DROP_TEMPLATE.map((row) => ({
                                        id: newId(),
                                        prompt: row.prompt,
                                        answer: row.answer,
                                        explanation: row.explanation,
                                      })),
                                    });
                                  }}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 8,
                                    border: "2px solid rgba(59,130,246,0.35)",
                                    background: "rgba(59,130,246,0.08)",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                  }}
                                >
                                  Use cell organelles template
                                </button>
                                {(() => {
                                  const dndAi = dragDropPairAiUi[key] ?? { loading: false, message: null };
                                  const dndTopic = String(dragDropAiTopicPrompt[key] ?? "").trim();
                                  const useTopicMode = dndTopic.length >= 8;
                                  const dndContextText = [
                                    lesson ? safeStr(lesson.title, "") : "",
                                    currentPage ? safeStr(currentPage.title, "") : "",
                                    safeStr((b as LessonPageBlock).intro, ""),
                                    safeStr((b as LessonPageBlock).instructions, ""),
                                  ]
                                    .map((s) => String(s).trim())
                                    .filter((s) => s.length > 0)
                                    .join("\n\n");
                                  const dndAiDisabled =
                                    dndAi.loading || (!useTopicMode && dndContextText.length < 12);
                                  return (
                                    <>
                                      <button
                                        type="button"
                                        disabled={dndAiDisabled}
                                        onClick={async () => {
                                          if (!window.confirm("Replace existing pairs with AI-generated ones?")) return;
                                          setDragDropPairAiUi((prev) => ({
                                            ...prev,
                                            [key]: { loading: true, message: null },
                                          }));
                                          try {
                                            const aiPairs = await generateDragDropPairsFromText({
                                              lessonTitle: lesson ? safeStr(lesson.title, "") : undefined,
                                              pageTitle: currentPage ? safeStr(currentPage.title, "") : undefined,
                                              subject: lesson ? safeStr(lesson.subject, "") : undefined,
                                              level: lesson ? safeStr(lesson.level, "") : undefined,
                                              text: useTopicMode ? dndTopic : dndContextText,
                                              source: useTopicMode ? "topic" : "lessonExcerpt",
                                            });
                                            if (aiPairs.length === 0) {
                                              setDragDropPairAiUi((prev) => ({
                                                ...prev,
                                                [key]: { loading: false, message: "empty" },
                                              }));
                                              return;
                                            }
                                            const ddmMode = dragDropMatchModeFromBlockForProps(b as LessonPageBlock);
                                            const pairCap =
                                              ddmMode === "text-to-image" ? TEXT_TO_IMAGE_PAIR_LIMIT : 20;
                                            const newPairs = aiPairs.slice(0, pairCap).map((p) => ({
                                              id: newId(),
                                              prompt: p.prompt,
                                              answer: p.answer,
                                              explanation: p.explanation || "",
                                            }));
                                            updateBlock(currentPage!.pageId, idx, { pairs: newPairs });
                                            setDragDropPairAiUi((prev) => ({
                                              ...prev,
                                              [key]: { loading: false, message: null },
                                            }));
                                          } catch {
                                            setDragDropPairAiUi((prev) => ({
                                              ...prev,
                                              [key]: { loading: false, message: "error" },
                                            }));
                                          }
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(124,58,237,0.4)",
                                          background: "rgba(243,232,255,0.75)",
                                          cursor: dndAiDisabled ? "not-allowed" : "pointer",
                                          fontWeight: 700,
                                          opacity: dndAiDisabled ? 0.55 : 1,
                                        }}
                                      >
                                        {dndAi.loading ? "Generating…" : "Generate pairs with AI"}
                                      </button>
                                      {dndAi.message === "error" ? (
                                        <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
                                          Could not generate pairs. Try again.
                                        </span>
                                      ) : dndAi.message === "empty" ? (
                                        <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>
                                          No suitable pairs generated.
                                        </span>
                                      ) : null}
                                    </>
                                  );
                                })()}
                              </div>
                              {(Array.isArray((b as LessonPageBlock).pairs)
                                ? (b as LessonPageBlock).pairs!
                                : []
                              ).map((pair, pi) => {
                                const pairsList = (Array.isArray((b as LessonPageBlock).pairs)
                                  ? (b as LessonPageBlock).pairs!
                                  : []) as NonNullable<LessonPageBlock["pairs"]>;
                                const ddmPairLabels = dragDropPairEditorLabels(
                                  resolveDragDropMatchModeForUi((b as LessonPageBlock).matchMode, {
                                    imageUrl: (b as LessonPageBlock).imageUrl,
                                    dropZones: (b as LessonPageBlock).dropZones,
                                  })
                                );
                                const ddmTtiMode = ddmPairLabels.prompt === "Draggable text";
                                return (
                                  <div
                                    key={pair.id || `pair-${pi}`}
                                    style={{
                                      padding: 12,
                                      borderRadius: 10,
                                      border: "1px solid #e2e8f0",
                                      background: "#fafafa",
                                    }}
                                  >
                                    <div style={{ fontWeight: 800, marginBottom: 8, color: "#0369a1" }}>
                                      Pair {pi + 1}
                                    </div>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{ddmPairLabels.prompt}</div>
                                      <input
                                        value={pair.prompt ?? ""}
                                        onChange={(e) => {
                                          const next = [...pairsList];
                                          if (next[pi]) next[pi] = { ...next[pi], prompt: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { pairs: next });
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "8px 10px",
                                          borderRadius: 8,
                                          border: "1px solid #cbd5e1",
                                        }}
                                      />
                                    </label>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{ddmPairLabels.answer}</div>
                                      <input
                                        value={pair.answer ?? ""}
                                        onChange={(e) => {
                                          const next = [...pairsList];
                                          if (next[pi]) next[pi] = { ...next[pi], answer: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { pairs: next });
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "8px 10px",
                                          borderRadius: 8,
                                          border: "1px solid #cbd5e1",
                                        }}
                                      />
                                    </label>
                                    {!ddmTtiMode
                                      ? (() => {
                                      const ddmPairKey = `${key}:ddm-pair:${pi}`;
                                      const pairImgUploading = uploadingKey === ddmPairKey;
                                      const rawPairImg = String(pair.answerImageUrl ?? "").trim();
                                      const pairImgSrc =
                                        rawPairImg && hasRenderableLessonImageSrc(rawPairImg)
                                          ? makeAbsoluteAssetUrl(rawPairImg) ?? rawPairImg
                                          : "";
                                      return (
                                        <div style={{ marginBottom: 8 }}>
                                          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                            {ddmPairLabels.image}
                                          </div>
                                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                                            Paste a URL or upload — same storage as diagram / sequence images (
                                            <code style={{ fontSize: 11 }}>lesson-media/lesson_…</code>).
                                          </div>
                                          <input
                                            ref={(el) => {
                                              fileInputRef.current[ddmPairKey] = el;
                                            }}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                                onChange={(e) => {
                                                  const f = e.target.files?.[0];
                                                  if (!f) return;
                                                  uploadImageForDragDropMatchPairAnswer(
                                                    f,
                                                    currentPage!.pageId,
                                                    idx,
                                                    pi,
                                                    (url) => {
                                                      const next = [...pairsList];
                                                      if (next[pi]) {
                                                        next[pi] = { ...next[pi], answerImageUrl: url };
                                                      }
                                                      updateBlock(currentPage!.pageId, idx, { pairs: next });
                                                    }
                                                  );
                                                  e.target.value = "";
                                                }}
                                          />
                                          <div
                                            style={{
                                              display: "flex",
                                              flexWrap: "wrap",
                                              gap: 8,
                                              alignItems: "stretch",
                                              marginBottom: rawPairImg ? 8 : 0,
                                            }}
                                          >
                                            <label style={{ flex: "1 1 220px", minWidth: 0, margin: 0 }}>
                                              <span style={{ display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
                                                Image URL
                                              </span>
                                              <input
                                                value={String(pair.answerImageUrl ?? "")}
                                                onChange={(e) => {
                                                  const next = [...pairsList];
                                                  if (next[pi]) {
                                                    next[pi] = { ...next[pi], answerImageUrl: e.target.value };
                                                  }
                                                  updateBlock(currentPage!.pageId, idx, { pairs: next });
                                                }}
                                                placeholder="https://… or path after upload"
                                                style={{
                                                  width: "100%",
                                                  padding: "8px 10px",
                                                  borderRadius: 8,
                                                  border: "1px solid #cbd5e1",
                                                  boxSizing: "border-box",
                                                }}
                                              />
                                            </label>
                                            <div
                                              style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "flex-end",
                                                flex: "0 0 auto",
                                              }}
                                            >
                                              <span style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, opacity: 0 }}>
                                                &nbsp;
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const input = fileInputRef.current[ddmPairKey];
                                                  if (input) {
                                                    input.value = "";
                                                    input.click();
                                                  }
                                                }}
                                                disabled={pairImgUploading}
                                                style={{
                                                  padding: "8px 14px",
                                                  borderRadius: 8,
                                                  border: "2px solid rgba(99,102,241,0.35)",
                                                  background: "white",
                                                  cursor: pairImgUploading ? "not-allowed" : "pointer",
                                                  fontWeight: 700,
                                                  fontSize: 13,
                                                  whiteSpace: "nowrap",
                                                }}
                                              >
                                                {pairImgUploading ? "Uploading…" : "Upload image"}
                                              </button>
                                            </div>
                                          </div>
                                          {rawPairImg && pairImgSrc ? (
                                            <div
                                              style={{
                                                display: "flex",
                                                flexWrap: "wrap",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: 10,
                                                borderRadius: 10,
                                                border: "1px solid #e2e8f0",
                                                background: "#fff",
                                              }}
                                            >
                                              <img
                                                src={pairImgSrc}
                                                alt=""
                                                style={{
                                                  width: 72,
                                                  height: 72,
                                                  objectFit: "contain",
                                                  borderRadius: 8,
                                                  border: "1px solid #cbd5e1",
                                                  background: "#f8fafc",
                                                }}
                                              />
                                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
                                                  Preview — upload again to replace
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const next = [...pairsList];
                                                    if (next[pi]) {
                                                      next[pi] = { ...next[pi], answerImageUrl: "" };
                                                    }
                                                    updateBlock(currentPage!.pageId, idx, { pairs: next });
                                                  }}
                                                  style={{
                                                    alignSelf: "flex-start",
                                                    padding: "6px 12px",
                                                    borderRadius: 8,
                                                    border: "1px solid #f87171",
                                                    background: "#fef2f2",
                                                    color: "#b91c1c",
                                                    fontWeight: 700,
                                                    fontSize: 12,
                                                    cursor: "pointer",
                                                  }}
                                                >
                                                  Clear image
                                                </button>
                                              </div>
                                            </div>
                                          ) : null}
                                        </div>
                                      );
                                    })()
                                      : null}
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Explanation (optional)</div>
                                      <LessonAutoTextarea
                                        editorVariant="plain"
                                        value={pair.explanation ?? ""}
                                        onChange={(v) => {
                                          const next = [...pairsList];
                                          if (next[pi]) next[pi] = { ...next[pi], explanation: v };
                                          updateBlock(currentPage!.pageId, idx, { pairs: next });
                                        }}
                                        placeholder="Shown after checking…"
                                        minHeightPx={72}
                                        style={{ fontSize: "0.875rem" }}
                                      />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (pairsList.length <= 1) return;
                                        const next = pairsList.filter((_, i) => i !== pi);
                                        updateBlock(currentPage!.pageId, idx, { pairs: next });
                                      }}
                                      disabled={pairsList.length <= 1}
                                      style={{
                                        marginTop: 4,
                                        padding: "4px 10px",
                                        borderRadius: 6,
                                        border: "1px solid #f87171",
                                        background: "#fef2f2",
                                        color: "#b91c1c",
                                        cursor: pairsList.length <= 1 ? "not-allowed" : "pointer",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        opacity: pairsList.length <= 1 ? 0.5 : 1,
                                      }}
                                    >
                                      Delete pair
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : isGraph ? (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Title</div>
                                <input
                                  value={safeStr((b as LessonPageBlock).title, "")}
                                  onChange={(e) => updateBlock(currentPage!.pageId, idx, { title: e.target.value })}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                  placeholder="e.g. Limiting factors in photosynthesis"
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Intro</div>
                                <LessonAutoTextarea
                                  editorVariant="plain"
                                  value={safeStr((b as LessonPageBlock).intro, "")}
                                  onChange={(v) => updateBlock(currentPage!.pageId, idx, { intro: v })}
                                  placeholder="Brief context before the graph…"
                                  minHeightPx={80}
                                  style={{ fontSize: "0.9375rem" }}
                                />
                              </label>
                              <GraphBlockAuthoring
                                blk={b as import("../components/lesson/GraphBlockAuthoring").GraphBlockAuthoringBlock}
                                onPatch={(patch) =>
                                  updateBlock(
                                    currentPage!.pageId,
                                    idx,
                                    patch as unknown as Partial<LessonPageBlock>
                                  )
                                }
                                lessonTitle={safeStr(lesson?.title, "")}
                                pageTitle={safeStr(currentPage?.title, "")}
                                subject={safeStr(lesson?.subject, "")}
                                level={safeStr(lesson?.level, "")}
                              />
                            </div>
                          ) : (
                            <>
                          <input
                            ref={(el) => {
                              fileInputRef.current[key] = el;
                            }}
                            type="file"
                            accept="image/*,video/mp4,video/webm,video/quicktime"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;

                              uploadIntoBlock(
                                f,
                                currentPage!.pageId,
                                idx,
                                () => safeStr(currentPage?.blocks?.[idx]?.content, ""),
                                (next) =>
                                  updateBlock(currentPage!.pageId, idx, { content: next })
                              );
                            }}
                          />

                          <LessonBlockContentTextarea
                            sizeVariant={blockEditorSizeVariant(blockType)}
                            assignTextareaRef={(el) => {
                              blockTextareasRef.current[key] = el;
                            }}
                            getTextarea={() => blockTextareasRef.current[key] ?? null}
                            value={safeStr(b.content, "")}
                            onChange={(next) =>
                              updateBlock(currentPage!.pageId, idx, { content: next })
                            }
                            onKeyTermClick={() => {
                              const el = blockTextareasRef.current[key];
                              const full = safeStr(b.content, "");
                              let initialTerm = "";
                              let blockContext = full;
                              let selectionStart = 0;
                              let selectionEnd = 0;
                              if (el) {
                                const start = el.selectionStart ?? 0;
                                const end = el.selectionEnd ?? 0;
                                selectionStart = start;
                                selectionEnd = end;
                                if (end > start) {
                                  initialTerm = el.value.slice(start, end).trim();
                                }
                                const lo = Math.min(start, end);
                                const hi = Math.max(start, end);
                                const rad = 220;
                                const s = Math.max(0, lo - rad);
                                const e2 = Math.min(full.length, hi + rad);
                                blockContext =
                                  (s > 0 ? "…" : "") + full.slice(s, e2).trim() + (e2 < full.length ? "…" : "");
                              }
                              setAddKeyTermDialog({
                                pageId: currentPage!.pageId,
                                pageTitle: safeStr(currentPage!.title, ""),
                                initialTerm,
                                blockContext: blockContext || full.slice(0, 2000),
                                blockIndex: idx,
                                selectionStart,
                                selectionEnd,
                              });
                            }}
                            onSuggestKeyTermsClick={() => {
                              setSuggestKeyTermsDialog({
                                pageId: currentPage!.pageId,
                                blockIndex: idx,
                                pageTitle: safeStr(currentPage!.title, ""),
                                textareaKey: key,
                              });
                            }}
                            onPaste={(e) => {
                              const insert = getLessonPasteInsertText(e.clipboardData);
                              if (!insert?.text?.trim()) return;

                              const text = insert.text;
                              const el = e.currentTarget;
                              const start = el.selectionStart ?? el.value.length;
                              const end = el.selectionEnd ?? el.value.length;
                              const before = el.value.slice(0, start);
                              const after = el.value.slice(end);
                              const combinedTrim = (before + text + after).trim();

                              let structured = tryParseFlexibleCheckpointMcq(text.trim());
                              if (
                                !structured &&
                                lessonCheckpointWholeCellPaste(el, start, end, before, after)
                              ) {
                                structured = tryParseFlexibleCheckpointMcq(combinedTrim);
                              }
                              const blockLegacy = normalizeBlockType(String((b as { type?: unknown }).type ?? "text"));
                              const pid = currentPage!.pageId;
                              const pgBlocksAny = Array.isArray(currentPage?.blocks) ? currentPage!.blocks! : [];

                              if (
                                structured &&
                                blockLegacy === "text" &&
                                lessonCheckpointWholeCellPaste(el, start, end, before, after)
                              ) {
                                e.preventDefault();
                                const prevCpBlock = pgBlocksAny.slice(0, idx).some((xb: { type?: unknown }) => {
                                  const t = normalizeBlockType(String(xb?.type ?? "text"));
                                  return t === "checkpoint";
                                });
                                const optsFour = coerceLessonMcqOptionsFour(structured.options);
                                const opts = [...optsFour];
                                const parsedMarkScheme = markSchemeFromFlexibleCheckpointParse(structured);
                                const clearInteractive: Partial<LessonPageBlock> = {
                                  pairs: [],
                                  sequenceSteps: [],
                                  intro: "",
                                  instructions: "",
                                  imageUrl: "",
                                  hotspots: [],
                                  title: "",
                                };
                                const cpPg = currentPage?.checkpoint;

                                if (!prevCpBlock) {
                                  updateBlock(pid, idx, {
                                    ...clearInteractive,
                                    type: "checkpoint",
                                    content: "",
                                    prompt: structured.prompt,
                                    questionType: "mcq",
                                    options: opts,
                                    correctAnswer: structured.correctAnswer,
                                    explanation: structured.explanation || "",
                                    role: "quickCheck",
                                    ...(parsedMarkScheme?.length
                                      ? { markScheme: parsedMarkScheme }
                                      : { markScheme: [] }),
                                  });
                                  updateCheckpoint(pid, {
                                    question: structured.prompt,
                                    options: opts,
                                    answer: structured.correctAnswer,
                                    explanation: structured.explanation || "",
                                    ...(parsedMarkScheme?.length
                                      ? { markScheme: parsedMarkScheme }
                                      : Array.isArray(cpPg?.markScheme) && cpPg!.markScheme!.length
                                        ? { markScheme: [...cpPg!.markScheme!] }
                                        : {}),
                                  });
                                } else {
                                  updateBlock(pid, idx, {
                                    ...clearInteractive,
                                    type: "selfCheck",
                                    content: "",
                                    prompt: structured.prompt,
                                    questionType: "mcq",
                                    options: opts,
                                    correctAnswer: structured.correctAnswer,
                                    explanation: structured.explanation || "",
                                    role: "selfCheck",
                                    ...(parsedMarkScheme?.length
                                      ? { markScheme: parsedMarkScheme }
                                      : {}),
                                  });
                                }
                                setTimeout(() => {
                                  try {
                                    el.focus();
                                    el.setSelectionRange(0, 0);
                                  } catch {}
                                }, 0);
                                return;
                              }

                              e.preventDefault();

                              const nextValue = collapseExactDuplicatePaste(
                                before + text + after
                              );

                              updateBlock(pid, idx, { content: nextValue });

                              setTimeout(() => {
                                try {
                                  el.focus();
                                  const pos = start + text.length;
                                  el.setSelectionRange(pos, pos);
                                } catch {}
                              }, 0);
                            }}
                            placeholder="Write here — toolbar for format, colours, markers (Alt+1 💡 · Alt+2 ⚠️ · Alt+3 🔍 · Alt+4 🔑)."
                            style={{ marginTop: 10 }}
                          />
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      background: "white",
                      borderRadius: 14,
                      padding: 14,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                      border: "2px solid rgba(0,0,0,0.16)",
                    }}
                  >
                    {currentPage && (() => {
                      const cpKey = `${currentPage.pageId}-checkpoint`;
                      const cpReports = reportsByBlock.get(cpKey) ?? [];
                      return cpReports.length > 0 ? (
                        <div
                          style={{
                            marginBottom: 10,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background: "#fef3c7",
                            border: "1px solid #f59e0b",
                            fontSize: 13,
                          }}
                        >
                          <div style={{ fontWeight: 600, color: "#92400e" }}>
                            Issue reported on this block{cpReports.length > 1 ? ` (${cpReports.length})` : ""}
                          </div>
                          <button
                            type="button"
                            onClick={() => setExpandedReportsKey(expandedReportsKey === cpKey ? null : cpKey)}
                            style={{
                              marginTop: 4,
                              background: "none",
                              border: "none",
                              color: "#b45309",
                              cursor: "pointer",
                              fontSize: 12,
                              textDecoration: "underline",
                              padding: 0,
                            }}
                          >
                            {expandedReportsKey === cpKey ? "Hide reports" : "View reports"}
                          </button>
                          {expandedReportsKey === cpKey && (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#78350f" }}>
                              {cpReports.map((rep, ri) => (
                                <div key={rep.id} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: ri < cpReports.length - 1 ? "1px solid #fcd34d" : "none" }}>
                                  <div>
                                    <strong>{rep.reportTypeLabel}</strong>
                                    {(() => {
                                      const p = REPORT_PRIORITY[rep.reportType];
                                      if (!p) return null;
                                      const s = p === "high" ? { bg: "#fef2f2", color: "#b91c1c" } : p === "low" ? { bg: "#f0fdf4", color: "#15803d" } : { bg: "#fef3c7", color: "#92400e" };
                                      return (
                                        <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: s.bg, color: s.color }}>
                                          {p}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div>{rep.description}</div>
                                  {rep.suggestedFix && <div style={{ marginTop: 4, fontStyle: "italic" }}>Suggested: {rep.suggestedFix}</div>}
                                  <button
                                    type="button"
                                    onClick={() => handleResolveReport(rep.id)}
                                    disabled={resolvingReportId === rep.id}
                                    style={{
                                      marginTop: 6,
                                      padding: "4px 10px",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      borderRadius: 6,
                                      border: "1px solid #059669",
                                      background: "#ecfdf5",
                                      color: "#059669",
                                      cursor: resolvingReportId === rep.id ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {resolvingReportId === rep.id ? "Resolving…" : "Mark resolved"}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>Checkpoint</div>

                    <label style={{ display: "block" }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Question</div>
                      <input
                        value={safeStr(currentPage?.checkpoint?.question, "")}
                        onChange={(e) =>
                          updateCheckpoint(currentPage!.pageId, { question: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "2px solid rgba(0,0,0,0.14)",
                        }}
                      />
                    </label>

                    <div
                      style={{
                        marginTop: 10,
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <label key={i} style={{ display: "block" }}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>Option {i + 1}</div>
                          <input
                            value={safeStr(currentPage?.checkpoint?.options?.[i], "")}
                            onChange={(e) =>
                              updateCheckpointOption(currentPage!.pageId, i, e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: "2px solid rgba(0,0,0,0.14)",
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Correct answer (must match an option)</div>
                      <input
                        value={safeStr(currentPage?.checkpoint?.answer, "")}
                        onChange={(e) =>
                          updateCheckpoint(currentPage!.pageId, { answer: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "2px solid rgba(0,0,0,0.14)",
                        }}
                      />
                    </label>
                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Explanation (optional)</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                        Shown after students check or reveal the answer
                      </div>
                      <LessonAutoTextarea
                        editorVariant="plain"
                        value={safeStr(currentPage?.checkpoint?.explanation, "")}
                        onChange={(v) => updateCheckpoint(currentPage!.pageId, { explanation: v })}
                        minHeightPx={80}
                        style={{ fontSize: "0.875rem" }}
                      />
                    </label>
                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Mark scheme (optional)</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>
                        One point per line — appended to the explanation for students when present.
                      </div>
                      <LessonAutoTextarea
                        editorVariant="plain"
                        value={(currentPage?.checkpoint?.markScheme ?? []).join("\n")}
                        onChange={(v) =>
                          updateCheckpoint(currentPage!.pageId, {
                            markScheme: v
                              .split("\n")
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .slice(0, 20),
                          })
                        }
                        minHeightPx={72}
                        style={{ fontSize: "0.875rem" }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <aside
              id="edit-lesson-preview"
              data-col="right"
              className="lesson-editor-preview-sticky edit-lesson-preview-aside edit-lesson-preview-rail"
              style={{
                width: "100%",
                maxWidth: "100%",
                minWidth: 0,
                boxSizing: "border-box",
                display:
                  layoutBreakpoint === "narrow" && mobileEditorTab === "edit" ? "none" : undefined,
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                  border: "2px solid rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>
                  Preview
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.92rem" }}>
                  {previewFocusBlockIdx != null
                    ? "Showing the block you’re editing. Use “Full page” to see the whole page."
                    : "This is how the current page will render."}
                </div>
                {pagesReady && previewFocusBlockIdx != null && (
                  <button
                    type="button"
                    onClick={() => setPreviewFocusBlockIdx(null)}
                    style={{
                      marginTop: 10,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      fontWeight: 700,
                      fontSize: "0.8125rem",
                      cursor: "pointer",
                      color: "#334155",
                    }}
                  >
                    Full page preview
                  </button>
                )}
              </div>

              {pagesReady ? (
                <div style={previewBox}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    {currentPage?.title || `Page ${currentPage?.order}`}
                  </div>

                  {(currentPage?.blocks || [])
                    .map((b, origIdx) => ({ b, origIdx }))
                    .filter((x) => Boolean(x.b))
                    .filter(({ b }) => {
                      const raw = safeStr(b.content, "").trim();
                      if (!raw) return true;
                      const content = raw.replace(/\*+/g, "").trim();
                      return !/^Animal and plant cell structure\s*\(GCSE\)\s*$/i.test(content);
                    })
                    .filter(({ origIdx }) =>
                      previewFocusBlockIdx == null ? true : origIdx === previewFocusBlockIdx
                    )
                    .map(({ b, origIdx: idx }) => {
                    const blockType = normalizeBlockType(b?.type);
                    const blockContent = safeStr(b.content, "");
                    const linked =
                      previewFocusBlockIdx != null && idx === previewFocusBlockIdx;
                    if (blockType === "checkpoint") {
                      const cb = b as {
                        prompt?: string;
                        options?: unknown;
                        correctAnswer?: string;
                        explanation?: string;
                        markScheme?: string[];
                      };
                      const cpPg = currentPage?.checkpoint;
                      const q = safeStr(cb.prompt ?? cpPg?.question, "");
                      const optsB = [...coerceLessonMcqOptionsFour(cb.options)];
                      const optsCp = [...coerceLessonMcqOptionsFour(cpPg?.options)];
                      const useOpts = optsB.filter(Boolean).length >= 2 ? optsB : optsCp;
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <CheckpointCard
                            question={q}
                            options={useOpts}
                            answer={safeStr(cb.correctAnswer ?? cpPg?.answer, "")}
                            explanation={
                              safeStr(cb.explanation ?? cpPg?.explanation, "") || undefined
                            }
                            markScheme={
                              Array.isArray(cb.markScheme)
                                ? cb.markScheme
                                : Array.isArray(cpPg?.markScheme)
                                  ? cpPg.markScheme
                                  : undefined
                            }
                          />
                        </div>
                      );
                    }
                    if (blockType === "selfCheck") {
                      const sb = b as {
                        prompt?: string;
                        questionType?: string;
                        options?: string[];
                        correctAnswer?: string;
                        explanation?: string;
                        markScheme?: string[];
                      };
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <InlineSelfCheckBlock
                            prompt={safeStr(sb.prompt, "")}
                            questionType={sb.questionType === "short" ? "short" : "mcq"}
                            options={Array.isArray(sb.options) ? sb.options : []}
                            correctAnswer={safeStr(sb.correctAnswer, "")}
                            explanation={mergeCheckpointExplanationParts({
                              explanation: sb.explanation != null ? String(sb.explanation) : undefined,
                              markScheme: Array.isArray(sb.markScheme) ? sb.markScheme : undefined,
                            })}
                          />
                        </div>
                      );
                    }
                    if (blockType === "interactiveSequence") {
                      const isq = b as {
                        title?: string;
                        intro?: string;
                        sequenceSteps?: Array<{
                          title?: string;
                          description?: string;
                          imageUrl?: string;
                          caption?: string;
                          testExplanation?: string;
                        }>;
                        steps?: Array<{
                          title?: string;
                          description?: string;
                          imageUrl?: string;
                          caption?: string;
                          testExplanation?: string;
                        }>;
                      };
                      const rawSteps = Array.isArray(isq.sequenceSteps)
                        ? isq.sequenceSteps
                        : Array.isArray(isq.steps)
                          ? isq.steps
                          : [];
                      const steps = rawSteps.map((s: any) => {
                        const sid = typeof s?.id === "string" ? String(s.id).trim() : "";
                        const te =
                          typeof s?.testExplanation === "string" ? String(s.testExplanation).trim() : "";
                        return {
                          ...(sid ? { id: sid.slice(0, 64) } : {}),
                          title: String(s?.title ?? ""),
                          description: String(s?.description ?? ""),
                          imageUrl: String(s?.imageUrl ?? ""),
                          caption: String(s?.caption ?? ""),
                          ...(te ? { testExplanation: te } : {}),
                        };
                      });
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <InteractiveSequenceBlock
                            blockTitle={safeStr(isq.title, "")}
                            intro={safeStr(isq.intro, "")}
                            steps={steps}
                            resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                          />
                        </div>
                      );
                    }
                    if (blockType === "interactiveDiagram") {
                      const idg = b as {
                        title?: string;
                        intro?: string;
                        imageUrl?: string;
                        hotspots?: Array<{
                          id?: string;
                          x?: number;
                          y?: number;
                          label?: string;
                          description?: string;
                          explanation?: string;
                        }>;
                      };
                      const hs = (Array.isArray(idg.hotspots) ? idg.hotspots : []).map((h, i) =>
                        normalizeInteractiveDiagramHotspot(h, i)
                      );
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <InteractiveDiagramBlock
                            blockTitle={safeStr(idg.title, "")}
                            intro={safeStr(idg.intro, "")}
                            imageUrl={String(idg.imageUrl ?? "")}
                            hotspots={hs}
                            resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                          />
                        </div>
                      );
                    }
                    if (blockType === "graph") {
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <GraphBlock block={b} showAnswers />
                        </div>
                      );
                    }
                    if (blockType === "diagram") {
                      if (process.env.NODE_ENV !== "production") {
                        console.log("[EditLessonPage.preview.diagram]", {
                          idx,
                          component: "LessonDiagramBlockDisplay",
                          subtitle:
                            typeof b.subtitle === "string" ? b.subtitle.slice(0, 80) : b.subtitle ?? "MISSING",
                          studentTask:
                            typeof b.studentTask === "string"
                              ? b.studentTask.slice(0, 80)
                              : b.studentTask ?? "MISSING",
                          caption:
                            typeof b.caption === "string" ? b.caption.slice(0, 80) : b.caption ?? "MISSING",
                        });
                      }
                      const d = b as LessonPageBlock;
                      const img = diagramImageUrlForPreview(d.imageUrl);
                      const imgSrc = img ? toAbsoluteAssetUrl(img) ?? img : "";
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <LessonDiagramBlockDisplay block={d}>
                            {imgSrc && hasRenderableLessonImageSrc(imgSrc) ? (
                              <LessonImageFrame variant="secondary" lightboxSrc={imgSrc}>
                                <img
                                  src={imgSrc}
                                  alt={d.caption || d.title || "Diagram"}
                                  style={lessonImageFrameImgStyle}
                                  onError={hideBrokenLessonImage}
                                />
                              </LessonImageFrame>
                            ) : (
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: "0.75rem",
                                  color: "#94a3b8",
                                  fontStyle: "italic",
                                }}
                              >
                                Diagram image not set
                              </p>
                            )}
                          </LessonDiagramBlockDisplay>
                        </div>
                      );
                    }
                    if (blockType === "dragDropMatch") {
                      const ddm = b as {
                        title?: string;
                        intro?: string;
                        instructions?: string;
                        pairs?: Array<{
                          id?: string;
                          prompt?: string;
                          answer?: string;
                          explanation?: string;
                          answerImageUrl?: string;
                        }>;
                      };
                      const previewPairsRaw = Array.isArray(ddm.pairs) ? ddm.pairs : [];
                      if (
                        typeof window !== "undefined" &&
                        window.localStorage?.getItem("DDM_PAIR_IMG_DEBUG") === "1"
                      ) {
                        console.log(
                          "[EditLessonPage][DDM preview] pairs before DragDropMatchBlock",
                          previewPairsRaw.map((p) => {
                            const normalized = readDragDropPairAnswerImageUrl(p) ?? "";
                            const resolved = normalized
                              ? String(makeAbsoluteAssetUrl(normalized) ?? normalized).trim()
                              : "";
                            return {
                              answer: (p as { answer?: unknown })?.answer,
                              answerImageUrl: (p as { answerImageUrl?: unknown })?.answerImageUrl,
                              answer_image_url: (p as { answer_image_url?: unknown })?.answer_image_url,
                              normalized: normalized || undefined,
                              resolvedSrc: resolved || undefined,
                              okRaw: hasRenderableLessonImageSrc(normalized),
                              okResolved: hasRenderableLessonImageSrc(resolved),
                            };
                          })
                        );
                      }
                      return (
                        <div
                          key={`${currentPage!.pageId}_prev_${idx}`}
                          style={{
                            marginBottom: 12,
                            ...(linked
                              ? {
                                  outline: "2px solid rgba(59,130,246,0.45)",
                                  outlineOffset: 4,
                                  borderRadius: 10,
                                }
                              : {}),
                          }}
                        >
                          <DragDropMatchBlock
                            resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                            block={{
                              title: safeStr(ddm.title, ""),
                              intro: safeStr(ddm.intro, ""),
                              instructions: safeStr(ddm.instructions, ""),
                              ...(() => {
                                const mm = dragDropMatchModeFromBlockForProps(ddm);
                                return mm ? { matchMode: mm } : {};
                              })(),
                              ...((() => {
                                const ddmMm = dragDropMatchModeFromBlockForProps(ddm);
                                return (
                                  (ddmMm === "diagram" || ddmMm === "text-to-image") &&
                                  (ddm as LessonPageBlock).imageUrl != null &&
                                  String((ddm as LessonPageBlock).imageUrl).trim()
                                );
                              })()
                                ? { imageUrl: String((ddm as LessonPageBlock).imageUrl).trim() }
                                : {}),
                              pairs: previewPairsRaw.map((p, i) => mapDragDropPairForBlockRender(p, i)),
                              ...(dragDropMatchModeFromBlockForProps(ddm) === "diagram" &&
                              Array.isArray((ddm as LessonPageBlock).dropZones)
                                ? {
                                    dropZones: (ddm as LessonPageBlock).dropZones!.map((z, i) => {
                                      const x = coerceDiagramZonePct(z?.x);
                                      const y = coerceDiagramZonePct(z?.y);
                                      return {
                                        id: String(z?.id ?? "").trim() || `dz${i}`,
                                        ...(x !== undefined ? { x } : {}),
                                        ...(y !== undefined ? { y } : {}),
                                        correctPairId: String(z?.correctPairId ?? "").trim(),
                                        ...(z?.explanation != null && String(z.explanation).trim()
                                          ? { explanation: String(z.explanation).trim() }
                                          : {}),
                                      };
                                    }),
                                  }
                                : {}),
                            }}
                          />
                        </div>
                      );
                    }
                    return (
                      <div
                        key={`${currentPage!.pageId}_prev_${idx}`}
                        style={{
                          marginBottom: 12,
                          ...(linked
                            ? {
                                outline: "2px solid rgba(59,130,246,0.45)",
                                outlineOffset: 4,
                                borderRadius: 10,
                              }
                            : {}),
                        }}
                      >
                        <div className="lesson-content" style={getBlockStyle(blockType)}>
                          <LessonRenderer
                            key={`preview-lr-${currentPage!.pageId}-${idx}-${blockContent.length}`}
                            text={blockContent}
                            markdownComponents={markdownComponents as any}
                            urlTransform={(url: string) => {
                              try {
                                const decoded = url?.includes("%") ? decodeURIComponent(url) : (url ?? "");
                                const abs = makeAbsoluteAssetUrl(decoded);
                                if (abs) return abs;
                                return defaultUrlTransform(url ?? "");
                              } catch {
                                return defaultUrlTransform(url ?? "");
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const cp = currentPage?.checkpoint;
                    if (!cp?.question?.trim()) return null;
                    const opts = Array.isArray(cp.options)
                      ? cp.options.map((o) => String(o ?? "").trim()).filter((o) => o.length > 0)
                      : [];
                    if (opts.length < 2) return null;
                    return (
                      <div
                        key={`${currentPage!.pageId}-page-cp-preview`}
                        style={{ marginTop: 12, marginBottom: 4 }}
                      >
                        <CheckpointCard
                          question={safeStr(cp.question, "")}
                          options={opts}
                          answer={safeStr(cp.answer, "")}
                          explanation={safeStr(cp.explanation, "") || undefined}
                          markScheme={Array.isArray(cp.markScheme) ? cp.markScheme : undefined}
                        />
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={previewBox}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>No page selected</div>
                  <div style={{ color: "#6b7280" }}>Add/select a page to see preview.</div>
                </div>
              )}
            </aside>
          </div>

          <div
            id="revision-materials"
            style={{
            marginTop: "30px",
            background: "white",
            borderRadius: "14px",
            padding: "20px",
            boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
            border: "2px solid rgba(0,0,0,0.16)"
          }}
          >
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h2 style={{ margin: 0 }}>Revision Materials</h2>
              
              <button
                onClick={handleAIGenerate}
                disabled={isGenerating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.7 : 1,
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {isGenerating ? 'Generating...' : '✨ Generate with AI'}
              </button>
            </div>

            {(revisionValidationCounts.quizIssues > 0 || revisionValidationCounts.flashcardIssues > 0) && !issuesCalloutDismissed && (
              <div style={{ marginBottom: 12, padding: "14px 18px", background: "#fef3c7", borderRadius: 8, border: "1px solid #f59e0b", fontSize: 13, color: "#92400e" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                  <strong style={{ fontSize: 14 }}>Issues to fix</strong>
                  <button
                    type="button"
                    onClick={() => setIssuesCalloutDismissed(true)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "0 4px", color: "#92400e", fontSize: 18, lineHeight: 1 }}
                    aria-label="Hide issues"
                  >
                    ×
                  </button>
                </div>

                {/* Quiz questions — How to fix + Where to fix */}
                {revisionValidationCounts.quizIssues > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <strong>Quiz questions ({revisionValidationCounts.quizIssues} need fixes)</strong>
                    <div style={{ marginTop: 6, marginBottom: 8 }}>
                      <strong>How to fix:</strong>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                        <li>MCQ: Add at least 2 answer options, then select which option is correct.</li>
                        <li>Short/Exam: Add a model answer students can compare against.</li>
                        <li>Open the Quiz Bank for this topic, fix the highlighted question(s), then save.</li>
                      </ul>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <strong>Where to fix:</strong> Quiz questions are edited in the Topic Quiz Bank.
                      {topicKeyForBank ? (
                        <>
                          <br />
                          <Link
                            to={`/teacher/topic-banks/quizzes?topicKey=${encodeURIComponent(topicKeyForBank)}`}
                            style={{ display: "inline-block", marginTop: 6, padding: "6px 12px", background: "#f59e0b", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                          >
                            Open Quiz Bank →
                          </Link>
                          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#78716c" }}>Opens the Quiz Bank with this lesson&apos;s topic pre-selected.</span>
                        </>
                      ) : (
                        <>
                          <br />
                          <Link
                            to="/teacher/topic-banks/quizzes"
                            style={{ display: "inline-block", marginTop: 6, padding: "6px 12px", background: "#f59e0b", color: "#fff", borderRadius: 6, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
                          >
                            Open Quiz Bank →
                          </Link>
                          <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#78716c" }}>Select this lesson&apos;s topic to fix questions.</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Flashcards — How to fix + Where to fix */}
                {revisionValidationCounts.flashcardIssues > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Flashcards ({revisionValidationCounts.flashcardIssues} need fixes)</strong>
                    <div style={{ marginTop: 6, marginBottom: 8 }}>
                      <strong>How to fix:</strong>
                      <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
                        <li>Open the Flashcards section below.</li>
                        <li>For each card with issues, fill in Front (question) and Back (answer).</li>
                        <li>Click &quot;Save flashcards&quot; when done.</li>
                      </ul>
                    </div>
                    <div>
                      <strong>Where to fix:</strong>
                      <button
                        type="button"
                        onClick={() => {
                          setIsFlashcardsCollapsed(false);
                          setFilterFlashcardsBrokenOnly(true);
                          setTimeout(() => {
                            flashcardsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 100);
                        }}
                        style={{
                          display: "inline-block",
                          marginTop: 6,
                          padding: "6px 12px",
                          background: "#f59e0b",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600
                        }}
                      >
                        Jump to Flashcards →
                      </button>
                      <span style={{ display: "block", marginTop: 4, fontSize: 12, color: "#78716c" }}>Fix by filling Front (question) and Back (answer), then Save.</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div
              ref={flashcardsSectionRef}
              id="revision-materials-flashcards"
              style={{
              marginBottom: "30px",
              background: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsFlashcardsCollapsed(!isFlashcardsCollapsed)}
                style={{
                  padding: "15px 20px",
                  background: "#e2e8f0",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <h3 style={{ margin: 0, color: "#1e293b" }}>
                  Flashcards (SS2/SS3)
                </h3>
                <span style={{ fontSize: "20px" }}>
                  {isFlashcardsCollapsed ? "▶" : "▼"}
                </span>
              </div>
              
              {!isFlashcardsCollapsed && (
                <div style={{ padding: "20px" }}>
                    <>
                      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!id) return;
                            setSeedFlashcardsError(null);
                            setSeedFlashcardsSuccess(null);
                            setSyncFlashcardsSuccess(null);
                            setSyncFlashcardsError(null);
                            setSeedFlashcardsLoading(true);
                            try {
                              const result = await generateFlashcardsFromTopic(id, topicKeyForBank);
                              await fetchLessonSmart();
                              const count = result.addedCount ?? result.added ?? result.flashcardsCount ?? 0;
                              setSeedFlashcardsSuccess(
                                count > 0 ? `Added ${count} flashcards from topic bank.` : "No flashcards found for this exact topic."
                              );
                            } catch (e: any) {
                              setSeedFlashcardsError(e?.response?.data?.msg || e?.message || "Failed to generate from topic bank");
                            } finally {
                              setSeedFlashcardsLoading(false);
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "1px solid #2563eb",
                            background: "#eff6ff",
                            color: "#2563eb",
                            fontWeight: 600,
                            cursor: seedFlashcardsLoading || !id || !topicKeyForBank ? "not-allowed" : "pointer",
                          }}
                          disabled={seedFlashcardsLoading || !id || !topicKeyForBank}
                          title={!topicKeyForBank ? "This lesson isn't mapped to a syllabus subtopic yet." : undefined}
                        >
                          {seedFlashcardsLoading ? "Loading…" : "Generate Flashcards from Topic Bank"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!id) return;
                            setSyncFlashcardsError(null);
                            setSyncFlashcardsSuccess(null);
                            setSeedFlashcardsSuccess(null);
                            setSeedFlashcardsError(null);
                            setSyncFlashcardsLoading(true);
                            try {
                              const result = await syncFlashcardsFromTopicBank(id, topicKeyForBank);
                              const nextFlashcards = result.flashcards ?? (result.lesson as any)?.flashcards;
                              const safeFlashcards = Array.isArray(nextFlashcards) ? nextFlashcards : undefined;
                              // CRITICAL: Only patch lesson.flashcards. Never setLesson(res.lesson) — that would replace
                              // the whole lesson and can omit pages/blocks, breaking LessonBlocks and causing .style crash.
                              setLesson((prev) => {
                                if (!prev) return prev;
                                return {
                                  ...prev,
                                  flashcards: safeFlashcards ?? prev.flashcards,
                                };
                              });
                              if (safeFlashcards != null) setFlashcardsSyncKey((k) => k + 1);
                              await fetchLessonSmart();
                              const added = result.added ?? 0;
                              const updated = result.updated ?? 0;
                              const count = result.syncedCount ?? (added + updated);
                              const topicBankCount = result.topicBankCount ?? 0;
                              if (process.env.NODE_ENV !== "production") {
                                const sampleIds = (result.flashcards ?? [])
                                  .slice(0, 5)
                                  .map((c: any) => c.topicBankId ?? c.id);
                                console.log("[Sync from Topic Bank] updated:", updated, "added:", added, "syncedCount:", count, "topicBankCount:", topicBankCount, "sampleIds:", sampleIds);
                              }
                              let msg: string;
                              if (count > 0) msg = `Updated ${updated}, added ${added} from topic bank.`;
                              else if (topicBankCount === 0) msg = "No flashcards found for this exact topic.";
                              else msg = "Already up to date.";
                              setSyncFlashcardsSuccess(msg);
                            } catch (e: any) {
                              setSyncFlashcardsError(e?.response?.data?.msg || e?.message || "Failed to sync from topic bank");
                            } finally {
                              setSyncFlashcardsLoading(false);
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "1px solid #059669",
                            background: "#ecfdf5",
                            color: "#059669",
                            fontWeight: 600,
                            cursor: syncFlashcardsLoading || !id || !topicKeyForBank ? "not-allowed" : "pointer",
                          }}
                          disabled={syncFlashcardsLoading || !id || !topicKeyForBank}
                          title={!topicKeyForBank ? "This lesson isn't mapped to a syllabus subtopic yet." : "Updates this lesson with the latest published topic-bank flashcards."}
                        >
                          {syncFlashcardsLoading ? "Syncing…" : "Sync from Topic Bank"}
                        </button>
                        <Link to={topicKeyForBank ? `/teacher/topic-banks/flashcards?topicKey=${encodeURIComponent(topicKeyForBank)}` : "/teacher/topic-banks/flashcards"} style={{ fontSize: 14, color: "#2563eb", fontWeight: 600 }}>
                          Edit flashcards in Topic Bank →
                        </Link>
                        <span style={{ fontSize: 13, color: "#64748b", maxWidth: 420 }}>
                          Draft flashcards/quiz from lesson pages: use <strong>Generate AI assets</strong> in the toolbar above.
                        </span>
                        {topicKeyForBank && id && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "10px 12px",
                              borderRadius: 8,
                              border: "1px solid #e9d5ff",
                              background: "#faf5ff",
                              fontSize: 13,
                              color: "#4c1d95",
                              maxWidth: 560,
                            }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>AI topic-bank drafts (this lesson)</div>
                            {aiReviewPanel.lastRunAt && (
                              <div style={{ marginBottom: 4 }}>
                                Last run:{" "}
                                {new Date(aiReviewPanel.lastRunAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                                {aiReviewPanel.lessonUpdatedAtSnapshot && (
                                  <>
                                    {" · "}
                                    Lesson snapshot:{" "}
                                    {new Date(aiReviewPanel.lessonUpdatedAtSnapshot).toLocaleString(undefined, {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}
                                  </>
                                )}
                              </div>
                            )}
                            {aiReviewPanel.lastGenerated && (
                              <div style={{ marginBottom: 4 }}>
                                Last generated: {aiReviewPanel.lastGenerated.flashcards} flashcards,{" "}
                                {aiReviewPanel.lastGenerated.quizQuestions} quiz, {aiReviewPanel.lastGenerated.examQuestions}{" "}
                                exam
                              </div>
                            )}
                            <div style={{ marginBottom: 8 }}>
                              Pending drafts (AI, this lesson):{" "}
                              <strong>{aiReviewPanel.pendingDrafts.flashcards}</strong> flashcards,{" "}
                              <strong>{aiReviewPanel.pendingDrafts.quizQuestions}</strong> quiz,{" "}
                              <strong>{aiReviewPanel.pendingDrafts.examQuestions}</strong> exam
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {aiReviewPanel.pendingDrafts.flashcards > 0 ? (
                              <Link
                                to={buildAiLessonAssetBankReviewUrl("flashcards", {
                                  topicKeySlug: topicKeyForBank.includes(":")
                                    ? topicKeyForBank.split(":")[1] || topicKeyForBank
                                    : topicKeyForBank,
                                  specKey:
                                    (lesson as { specKey?: string })?.specKey || topicKeyForBank.split(":")[0] || getStoredSpecKey(),
                                  lessonId: id,
                                })}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  background: "#7c3aed",
                                  color: "#fff",
                                  fontWeight: 600,
                                  fontSize: 13,
                                  textDecoration: "none",
                                }}
                              >
                                Review flashcard drafts
                              </Link>
                              ) : null}
                              {aiReviewPanel.pendingDrafts.quizQuestions > 0 ? (
                              <Link
                                to={buildAiLessonAssetBankReviewUrl("quizzes", {
                                  topicKeySlug: topicKeyForBank.includes(":")
                                    ? topicKeyForBank.split(":")[1] || topicKeyForBank
                                    : topicKeyForBank,
                                  specKey:
                                    (lesson as { specKey?: string })?.specKey || topicKeyForBank.split(":")[0] || getStoredSpecKey(),
                                  lessonId: id,
                                })}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 6,
                                  background: "#7c3aed",
                                  color: "#fff",
                                  fontWeight: 600,
                                  fontSize: 13,
                                  textDecoration: "none",
                                }}
                              >
                                Review quiz drafts
                              </Link>
                              ) : null}
                              {aiReviewPanel.pendingDrafts.examQuestions > 0 ? (
                                <Link
                                  to={buildAiLessonAssetExamReviewUrl({
                                    topicKeySlug: topicKeyForBank.includes(":")
                                      ? topicKeyForBank.split(":")[1] || topicKeyForBank
                                      : topicKeyForBank,
                                    specKey:
                                      (lesson as { specKey?: string })?.specKey ||
                                      topicKeyForBank.split(":")[0] ||
                                      getStoredSpecKey(),
                                    lessonId: id,
                                  })}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    background: "#7c3aed",
                                    color: "#fff",
                                    fontWeight: 600,
                                    fontSize: 13,
                                    textDecoration: "none",
                                  }}
                                >
                                  Review exam drafts
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        )}
                        {seedFlashcardsError && (
                          <span style={{ color: "#dc2626", fontSize: 14 }}>{seedFlashcardsError}</span>
                        )}
                        {seedFlashcardsSuccess && (
                          <span style={{ color: "#059669", fontSize: 14 }}>{seedFlashcardsSuccess}</span>
                        )}
                        {syncFlashcardsError && (
                          <span style={{ color: "#dc2626", fontSize: 14 }}>{syncFlashcardsError}</span>
                        )}
                        {syncFlashcardsSuccess && (
                          <span style={{ color: "#059669", fontSize: 14 }}>{syncFlashcardsSuccess}</span>
                        )}
                      </div>
                      <FlashcardsEditor
                        key={`flashcards-${id}-${flashcardsSyncKey}`}
                        lessonId={id || ""}
                        initialCards={lesson?.flashcards || []}
                        topicKeyForBank={topicKeyForBank}
                        lessonTopicKey={lesson?.topicKey ?? lesson?.topic ?? null}
                        onSaved={() => fetchLessonSmart()}
                        isAdmin={isAdmin}
                        filterBrokenOnly={filterFlashcardsBrokenOnly}
                        onFilterBrokenChange={setFilterFlashcardsBrokenOnly}
                        readOnlyFromBank={true}
                      />
                    </>
                </div>
              )}
            </div>

          </div>
        </div>
        </div>
      </div>

      {generatorMcqSelfCheckImportOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 20,
          }}
          role="presentation"
          onClick={() => {
            setGeneratorMcqSelfCheckImportOpen(null);
            setGeneratorMcqSelfCheckImportText("");
            setGeneratorMcqSelfCheckImportError(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="generator-mcq-import-title"
            style={{
              background: "white",
              borderRadius: 14,
              padding: 20,
              maxWidth: 560,
              width: "100%",
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div id="generator-mcq-import-title" style={{ fontWeight: 900, marginBottom: 8 }}>
              Import MCQ from generator
            </div>
            <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
              Paste a CHECKPOINT block (Question, Options 1–4, Answer, optional Explanation). Leading lines like
              CHECKPOINT, numbered CHECKPOINT, or **⚡ CHECKPOINT** are recognised.
            </div>
            <textarea
              value={generatorMcqSelfCheckImportText}
              onChange={(e) => setGeneratorMcqSelfCheckImportText(e.target.value)}
              placeholder="Paste CHECKPOINT …"
              rows={14}
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                borderRadius: 10,
                border: "2px solid rgba(0,0,0,0.14)",
                fontSize: "0.875rem",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                lineHeight: 1.5,
                resize: "vertical",
                minHeight: 200,
              }}
            />
            {generatorMcqSelfCheckImportError ? (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "#b45309" }}>
                {generatorMcqSelfCheckImportError}
              </div>
            ) : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setGeneratorMcqSelfCheckImportOpen(null);
                  setGeneratorMcqSelfCheckImportText("");
                  setGeneratorMcqSelfCheckImportError(null);
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  background: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneratorMcqSelfCheckImportError(null);
                  const tgt = generatorMcqSelfCheckImportOpen;
                  if (!tgt) return;

                  const importText = generatorMcqSelfCheckImportText;
                  console.log("RAW IMPORT TEXT", importText);

                  const parsed = parseGeneratorMcqForSelfCheckImport(importText);
                  console.log("PARSED IMPORT", parsed);

                  if (parsed.ok === false) {
                    setGeneratorMcqSelfCheckImportError(parsed.error);
                    setSelfCheckImportToast({ message: parsed.error, type: "error" });
                    return;
                  }

                  if (!lesson?.pages?.length) {
                    const msg = "Lesson is not loaded; cannot apply import.";
                    setGeneratorMcqSelfCheckImportError(msg);
                    setSelfCheckImportToast({ message: msg, type: "error" });
                    return;
                  }

                  const pageIndex = lesson.pages.findIndex((p) => String(p.pageId) === String(tgt.pageId));
                  const pb = pageIndex >= 0 ? lesson.pages[pageIndex]?.blocks : undefined;
                  const blockBefore =
                    Array.isArray(pb) && tgt.idx >= 0 && tgt.idx < pb.length ? pb[tgt.idx] : undefined;

                  console.log("UPDATING BLOCK", { pageIndex, blockIndex: tgt.idx, blockBefore });

                  if (pageIndex < 0 || !Array.isArray(pb) || tgt.idx < 0 || tgt.idx >= pb.length) {
                    const msg =
                      "Could not find that page/block in lesson state — refresh the page and try Import again.";
                    setGeneratorMcqSelfCheckImportError(msg);
                    setSelfCheckImportToast({ message: msg, type: "error" });
                    return;
                  }

                  const blkTypeRaw = blockBefore != null && typeof blockBefore === "object" ? String((blockBefore as { type?: unknown }).type ?? "") : "";
                  if (normalizeBlockType(blkTypeRaw) !== "selfCheck") {
                    const msg = `Import only updates Self-check blocks (this block is "${blkTypeRaw || "unknown"}").`;
                    setGeneratorMcqSelfCheckImportError(msg);
                    setSelfCheckImportToast({ message: msg, type: "error" });
                    return;
                  }

                  const patch: Partial<LessonPageBlock> = {
                    prompt: parsed.prompt,
                    /** Keep in sync with Mongoose LessonPageBlockSchema.question (some pipelines still write here). */
                    question: parsed.prompt,
                    questionType: "mcq",
                    options: parsed.options,
                    correctAnswer: parsed.correctAnswer,
                    explanation: parsed.explanation,
                  };

                  updateBlock(tgt.pageId, tgt.idx, patch, {
                    onApplied: ({ nextBlock }) => {
                      console.log("BLOCK AFTER IMPORT", nextBlock);
                    },
                  });

                  setGeneratorMcqSelfCheckImportOpen(null);
                  setGeneratorMcqSelfCheckImportText("");
                  setSelfCheckImportToast(
                    parsed.answerMismatchWarning
                      ? {
                          message: `${parsed.answerMismatchWarning} Notes were appended to Explanation.`,
                          type: "warning",
                        }
                      : { message: "Imported MCQ into this Self-check.", type: "success" }
                  );
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "2px solid #2563eb",
                  background: "rgba(37,99,235,0.1)",
                  color: "#1d4ed8",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}

      {addFromBankModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: 20,
          }}
          onClick={() => setAddFromBankModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 20,
              maxWidth: 520,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Add from Question Bank</div>
            <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 10 }}>Only questions for the selected sub-topic will be shown.</div>
            <div style={{ marginBottom: 10 }}>
              <SpecSelector value={specKey} onChange={onSpecChange} />
            </div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Topic</label>
            <select
              value={bankTopicKey}
              onChange={(e) => setBankTopicKey(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "2px solid #e2e8f0", marginBottom: 14 }}
            >
              <option value="">— Select topic —</option>
              {taxonomyUnits.map((u) => (
                <optgroup key={u.unit} label={u.unit}>
                  {(u.topics || []).map((t) => (
                    <option key={t.key} value={t.key}>{t.topic}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {bankTopicKey && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Questions</div>
                <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                  {bankQuestions.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>No questions with this topic.</div>
                  ) : (
                    bankQuestions.map((q) => (
                      <label
                        key={q._id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "8px 0",
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBankQuestionIds.has(q._id)}
                          onChange={(e) => {
                            setSelectedBankQuestionIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(q._id);
                              else next.delete(q._id);
                              return next;
                            });
                          }}
                        />
                        <span style={{ fontSize: 13, color: "#374151" }}>
                          {q.question?.slice(0, 80)}{(q.question?.length ?? 0) > 80 ? "…" : ""} {q.marks != null ? `(${q.marks})` : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!id || selectedBankQuestionIds.size === 0) return;
                      api.post(`/lessons/${id}/exam-questions`, { questionIds: Array.from(selectedBankQuestionIds) }).then((res: any) => {
                        const added = res?.data?.added ?? 0;
                        if (added > 0) {
                          api.get(`/lessons/${id}/exam-questions`).then((r: any) => {
                            setAttachedExamQuestions(Array.isArray(r?.data?.questions) ? r.data.questions : []);
                          });
                        }
                        setAddFromBankModalOpen(false);
                      }).catch(() => {});
                    }}
                    disabled={selectedBankQuestionIds.size === 0}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: selectedBankQuestionIds.size > 0 ? "#4f46e5" : "#e5e7eb",
                      color: selectedBankQuestionIds.size > 0 ? "white" : "#9ca3af",
                      fontWeight: 700,
                      cursor: selectedBankQuestionIds.size > 0 ? "pointer" : "not-allowed",
                    }}
                  >
                    Attach to lesson
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddFromBankModalOpen(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "2px solid #e2e8f0",
                      background: "white",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AttachPaperModal
        open={attachPaperModalOpen}
        onClose={() => setAttachPaperModalOpen(false)}
        lessonId={id ?? ""}
        lessonContext={{
          subject: lesson?.subject,
          examBoard: lesson?.examBoardName ?? (lesson as any)?.examBoard ?? undefined,
          level: lesson?.level,
          topicKey: lesson?.topicKey ?? undefined,
        }}
        attachedIds={lesson?.assessmentPaperIds ?? []}
        api={api}
        onAttachSuccess={async () => {
          await fetchLessonSmart();
        }}
      />

      <AttachPageQuizModal
        open={attachPageQuizModalOpen}
        onClose={() => setAttachPageQuizModalOpen(false)}
        lessonId={id ?? ""}
        topicKey={topicKeyForBank ?? ""}
        specKey={
          (lesson as { specKey?: string })?.specKey?.trim() ||
          (topicKeyForBank?.includes(":") ? topicKeyForBank.split(":")[0] : undefined) ||
          getStoredSpecKey()
        }
        mode={attachPageQuizModalMode}
        pageId={currentPage?.pageId ?? ""}
        pageTitle={currentPage?.title}
        alreadyAttachedSourceIds={
          (lesson?.quiz?.questions ?? [])
            .filter((q: any) => String(q?.pageId || "") === String(currentPage?.pageId || "") && (q?.sourceQuestionId || q?.sourceType === "topicQuizQuestion"))
            .map((q: any) => String(q?.sourceQuestionId || q?.id || ""))
            .filter(Boolean)
        }
        onAttachSuccess={(updatedLesson, result) => {
          setLesson(updatedLesson);
          setAttachPageQuizModalOpen(false);
          if (result) {
            const { addedCount, alreadyExisted } = result;
            if (addedCount > 0 && alreadyExisted > 0) {
              setAttachPageQuizToast(`${addedCount} new question${addedCount !== 1 ? "s" : ""} attached. ${alreadyExisted} already existed.`);
            } else if (addedCount > 0) {
              setAttachPageQuizToast(`${addedCount} question${addedCount !== 1 ? "s" : ""} attached to this page.`);
            } else if (alreadyExisted > 0) {
              setAttachPageQuizToast("All selected questions were already on this page.");
            }
          }
        }}
      />

      {addKeyTermDialog && lesson ? (
        <AddKeyTermDialog
          open
          onClose={() => setAddKeyTermDialog(null)}
          initialTerm={addKeyTermDialog.initialTerm}
          blockContext={addKeyTermDialog.blockContext}
          pageTitle={addKeyTermDialog.pageTitle}
          lessonTitle={lesson.title}
          subject={lesson.subject}
          level={lesson.level}
          examBoardName={lesson.examBoardName}
          topic={lesson.topic}
          onAdd={(te, de) => {
            const d = addKeyTermDialog;
            if (!d) return;
            const hasRange =
              d.selectionStart !== d.selectionEnd &&
              Math.min(d.selectionStart, d.selectionEnd) < Math.max(d.selectionStart, d.selectionEnd);
            addPageKeyTermWithOptionalInline(
              d.pageId,
              te,
              de,
              hasRange
                ? { blockIndex: d.blockIndex, selectionStart: d.selectionStart, selectionEnd: d.selectionEnd }
                : null
            );
          }}
        />
      ) : null}

      {suggestKeyTermsDialog && lesson ? (
        <SuggestKeyTermsDialog
          open
          onClose={() => setSuggestKeyTermsDialog(null)}
          lessonTitle={lesson.title}
          subject={lesson.subject}
          level={lesson.level}
          examBoardName={lesson.examBoardName}
          topic={lesson.topic}
          pageTitle={suggestKeyTermsDialog.pageTitle}
          getBlockText={() => {
            const el = blockTextareasRef.current[suggestKeyTermsDialog.textareaKey];
            if (el) return el.value;
            const p = lesson.pages?.find(
              (pg) => String(pg.pageId) === String(suggestKeyTermsDialog.pageId)
            );
            return String(p?.blocks?.[suggestKeyTermsDialog.blockIndex]?.content ?? "");
          }}
          onAddSelected={(items) => {
            const d = suggestKeyTermsDialog;
            if (!d) return;
            applyBulkSuggestedKeyTerms(d.pageId, d.blockIndex, items);
          }}
        />
      ) : null}

      {diagramAssetLibraryEnabled && diagramAssetLibraryTarget ? (
        <DiagramAssetLibraryPanel
          open={Boolean(diagramAssetLibraryTarget)}
          onClose={() => setDiagramAssetLibraryTarget(null)}
          defaults={{
            subject: lesson?.subject,
            topic: lesson?.topic,
            examBoard: lesson?.examBoardName ?? undefined,
            tier: lesson?.tier,
          }}
          onAttach={(asset: DiagramAssetRecord) => {
            const target = diagramAssetLibraryTarget;
            if (!target) return;
            const page = lesson?.pages?.find((p) => String(p.pageId) === String(target.pageId));
            const block = page?.blocks?.[target.blockIndex] as LessonPageBlock | undefined;
            const captionTrim = typeof block?.caption === "string" ? block.caption.trim() : "";
            const titleTrim = typeof block?.title === "string" ? block.title.trim() : "";
            updateBlock(target.pageId, target.blockIndex, {
              diagramAssetId: asset.id,
              imageUrl: asset.imageUrl,
              imageSource: "diagram-asset",
              visualId: undefined,
              alt: asset.title,
              caption: captionTrim || asset.title,
              title: titleTrim || asset.title,
              source: undefined,
              elements: undefined,
            });
            setDiagramAssetLibraryTarget(null);
          }}
        />
      ) : null}

      {diagramPickerTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setDiagramPickerTarget(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 20,
              maxWidth: 420,
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Choose diagram</div>
            {visualsList.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 14 }}>Loading…</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {visualsList.map((v) => (
                  <li key={v._id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (diagramPickerTarget)
                          updateBlock(diagramPickerTarget.pageId, diagramPickerTarget.blockIndex, {
                            visualId: v._id,
                          });
                        setDiagramPickerTarget(null);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        textAlign: "left",
                        borderRadius: 8,
                        border: "2px solid #e2e8f0",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {v.conceptKey}
                      {v.topic ? ` — ${v.topic}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setDiagramPickerTarget(null)}
              style={{
                marginTop: 14,
                padding: "8px 14px",
                borderRadius: 8,
                border: "2px solid #e2e8f0",
                background: "#f1f5f9",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PR-014.1: Generated content publish gate modal */}
      {publishGateGeneratedOpen && publishGateGeneratedResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 20,
          }}
          onClick={() => setPublishGateGeneratedOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 24,
              maxWidth: 480,
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 18 }}>Fix issues before publishing</div>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#374151" }}>
              This lesson was generated. Resolve the blocking issues below, then try again.
            </p>
            {publishGateGeneratedResult.issues
              .filter((i) => i.level === "block")
              .map((issue, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "#fee2e2",
                    borderRadius: 8,
                    marginBottom: 8,
                    fontSize: 13,
                  }}
                >
                  <span>{issue.message}</span>
                  {issue.fixPath && (
                    <button
                      type="button"
                      onClick={() => {
                        setPublishGateGeneratedOpen(false);
                        navigate(issue.fixPath);
                      }}
                      style={{
                        marginLeft: 12,
                        padding: "4px 12px",
                        background: "#374151",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 12,
                      }}
                    >
                      Fix
                    </button>
                  )}
                </div>
              ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={() => setPublishGateGeneratedOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PR20: Publish readiness gate modal */}
      {publishGateOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 20,
          }}
          onClick={() => setPublishGateOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 24,
              maxWidth: 440,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 18 }}>This lesson isn't classroom-ready yet</div>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151", fontWeight: 600 }}>What's missing?</p>
            <ul style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 14, color: "#4b5563" }}>
              {publishGateIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={makeClassroomReadyLoading || !id}
                onClick={async () => {
                  if (!id) return;
                  setMakeClassroomReadyError(null);
                  setMakeClassroomReadyLoading(true);
                  try {
                    const res = await api.post<{
                      ok: boolean;
                      attach?: { added: number; addedIds?: string[] };
                      diagram?: { status: string };
                      plan?: { status: string };
                      review?: { status: string };
                      readiness?: { status: string; signals?: Record<string, unknown> };
                    }>(`/reports/lessons/${id}/make-classroom-ready`, {
                      days: 7,
                      attachPractice: true,
                      attachLimit: 10,
                      ensureDiagram: true,
                      regeneratePlan: true,
                      planLimit: 10,
                      markReviewed: true,
                    });
                    const d = res?.data;
                    if (d?.ok) {
                      const listRes = await api.get(`/lessons/${id}/exam-questions`);
                      setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                      setLesson((prev) =>
                        prev && d?.readiness
                          ? ({ ...prev, readiness: d.readiness as Lesson["readiness"], reviewedAt: d.review?.status === "MARKED" || d.review?.status === "ALREADY_REVIEWED" ? new Date().toISOString() : prev.reviewedAt } as Lesson)
                          : prev
                      );
                      await fetchLessonSmart();
                      const sig = d?.readiness?.signals ?? {};
                      const nextIssues: string[] = [];
                      if ((sig.checkpointCount ?? 0) === 0) nextIssues.push("No checkpoints");
                      if ((sig.diagramCount ?? 0) === 0) nextIssues.push("No diagrams");
                      if ((sig.practiceCount ?? 0) === 0) nextIssues.push("No practice questions attached");
                      if (!sig.isReviewed) nextIssues.push("Lesson not marked as reviewed");
                      setPublishGateIssues(nextIssues);
                      if (nextIssues.length === 0) {
                        setPublishGateOpen(false);
                        setSaveMsg("Ready. Open Classroom mode to start collecting attempts. Or click Publish Lesson when you're ready.");
                        setTimeout(() => setSaveMsg(""), 4000);
                      }
                    }
                  } catch (e: any) {
                    setMakeClassroomReadyError(e?.response?.data?.error ?? e?.message ?? "Failed");
                  } finally {
                    setMakeClassroomReadyLoading(false);
                  }
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #059669",
                  background: "rgba(5,150,105,0.12)",
                  color: "#047857",
                  fontWeight: 700,
                  cursor: makeClassroomReadyLoading ? "not-allowed" : "pointer",
                }}
              >
                {makeClassroomReadyLoading ? "Preparing…" : "Make classroom-ready"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPublishGateOpen(false);
                  await handlePublishToggle(true);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #94a3b8",
                  background: "#f1f5f9",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Publish anyway
              </button>
              <button
                type="button"
                onClick={() => setPublishGateOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  background: "#f8fafc",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            {makeClassroomReadyError && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{makeClassroomReadyError}</div>
            )}
          </div>
        </div>
      )}

      {/* PR20: Post-publish "Start classroom mode" CTA */}
      {postPublishClassroomModalOpen && id && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 20,
          }}
          onClick={() => setPostPublishClassroomModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 24,
              maxWidth: 380,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 18 }}>Published.</div>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151" }}>Open Student View?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPostPublishClassroomModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  background: "#f8fafc",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPostPublishClassroomModalOpen(false);
                  navigate(`/teacher/classroom/${id}`);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #2563eb",
                  background: "rgba(37,99,235,0.12)",
                  color: "#2563eb",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Open Student View
              </button>
            </div>
          </div>
        </div>
      )}

      {interactiveBlockCreation ? (
        <InteractiveBlockCreationDialog
          open
          blockType={
            interactiveBlockCreation.option.type as
              | "interactiveSequence"
              | "interactiveDiagram"
              | "dragDropMatch"
          }
          lessonTitle={lesson?.title}
          pageTitle={
            lesson?.pages?.find((p) => String(p.pageId) === String(interactiveBlockCreation.pageId))?.title
          }
          subject={lesson?.subject}
          level={lesson?.level}
          onCancel={() => setInteractiveBlockCreation(null)}
          onConfirm={(raw) => {
            const ctx = interactiveBlockCreation;
            if (!ctx) return;
            insertPreparedLessonBlockEdit(ctx.pageId, raw, {
              insertAt: ctx.insertAt,
              role: ctx.option.role,
              title: ctx.option.title,
            });
            setInteractiveBlockCreation(null);
          }}
        />
      ) : null}

    </div>
    </div>
  );
};

export default EditLessonPage;
