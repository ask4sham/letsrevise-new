// frontend/src/pages/LessonViewPage.tsx
import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams, Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { LessonMarkdown } from "../components/lesson/LessonMarkdown";
import {
  createLessonMarkdownViewComponents,
  lessonMarkdownUrlTransform,
} from "../components/lesson/lessonMarkdownViewComponents";
import { hasRenderableLessonImageSrc } from "../constants/lessonImageDisplay";
import { hideBrokenLessonImage, LessonImageFrame, lessonImageFrameImgStyle } from "../components/lesson/LessonImageFrame";
import { LessonDiagramFrame } from "../components/lesson/LessonDiagramFrame";
import { LessonImageLightboxProvider } from "../components/lesson/LessonImageLightbox";
import {
  LessonStudentBlockRenderer,
  isV12StudentLessonPresentation,
} from "../components/lesson/student";
import { chunkBlocksForTeachingLayout } from "../components/lesson/student/chunkLessonSegments";
import { LessonStudentChunk } from "../components/lesson/student/LessonStudentChunk";
import "../components/lesson/student/lessonStudentView.css";
import axios from "axios";
import {
  getApiClientErrorMessage,
  getAxiosErrorMessage,
  getErrorMessageFromData,
} from "../utils/apiErrorMessage";
import { apiUrl } from "../utils/apiBaseUrl";
import { supabase } from "../lib/supabaseClient";
import api, { getVisual, getVisualById } from "../services/api";

import { ReviewList, ReviewForm } from "../components/reviews";
import FlashcardsView from "../components/revision/FlashcardsView";
import { QuizView } from "../components/revision/QuizView";
import { Section } from "../components/lesson/Section";
import { LessonCheckpoint } from "../components/lesson/LessonCheckpoint";
import { InlineSelfCheckBlock } from "../components/lesson/InlineSelfCheckBlock";
import { InteractiveSequenceBlock } from "../components/lesson/InteractiveSequenceBlock";
import { InteractiveDiagramBlock } from "../components/lesson/InteractiveDiagramBlock";
import { DragDropMatchBlock } from "../components/lesson/DragDropMatchBlock";
import { SubscribeCTA } from "../components/SubscribeCTA";
import { fetchLessonById } from "../api/lessons";
import { copyBankToLesson } from "../api/flashcardBank";
import { isLessonError } from "../utils/typeGuards";
import { logPaywallEvent } from "../utils/events";
import { logAttempt } from "../utils/attempts";
import { makeAbsoluteAssetUrl, preprocessMarkdownAssetUrls } from "../utils/assetUrl";
import { mergeCheckpointExplanationParts } from "../utils/checkpointFeedback";
import { normalizeInteractiveDiagramHotspot } from "../utils/interactiveDiagramHotspots";
import { resolveLessonDisplayBlockType } from "../types/lessonBlocks";
import { SummariseLesson } from "../components/ai/SummariseLesson";
import { AskAiPanel } from "../components/ai/AskAiPanel";
import { AskAiStudentPanel } from "../components/ai/AskAiStudentPanel";
import { TopicSummaryStudentModal } from "../components/ai/TopicSummaryStudentModal";
import { StudyPlanPanel } from "../components/ai/StudyPlanPanel";
import { postLessonView } from "../api/studyCoach";
import { LessonPrevNextBar } from "../components/lesson/LessonPrevNextBar";
import { ReportIssueModal } from "../components/lesson/ReportIssueModal";
import { AdaptiveFeedbackCard } from "../components/lesson/AdaptiveFeedbackCard";
import {
  getSpecKeyFromLesson,
  resolveLessonTopicKeyForBank,
  resolveLessonTopicKeyForBankFromLesson,
} from "../utils/resolveLessonTopicKey";
import { recordMastery, getMastery } from "../api/mastery";
import type { SpecKey } from "../api/taxonomy";
import { useCurrentUser, type CurrentUser } from "../hooks/useCurrentUser";
import { updateUser } from "../utils/authStorage";
import { getUserDisplayName } from "../utils/userDisplayName";
import { normalizeQuizQuestion } from "../utils/normalizeQuizQuestion";
import { hasFullLessonAccess as computeFullLessonAccess } from "../utils/lessonAccess";
import Toast from "../components/Toast";
import {
  KeywordHighlightOnceProvider,
  mergeContentKeywordLists,
  mergeLessonMarkdownComponentsWithKeywordHighlight,
  normalizeContentKeywords,
} from "../components/lesson/student/contentKeywordHighlight";
import { KeywordGlossaryProvider } from "../components/lesson/student/keywordGlossaryContext";
import type { GlossaryFlashcardLite } from "../components/lesson/student/keywordGlossaryFlashcards";

/** PR11: diagram annotation overlay */
interface DiagramAnnotation {
  id: string;
  kind?: "label" | "callout";
  text?: string;
  x?: number;
  y?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

/** PR11: diagram step (reveal annotations) */
interface DiagramStep {
  id: string;
  title?: string;
  showAnnotationIds?: string[];
}

interface LessonPageBlock {
  type:
    | "text"
    | "keyIdea"
    | "examTip"
    | "commonMistake"
    | "stretch"
    | "checkpoint"
    | "selfCheck"
    | "diagram"
    | "keyWords"
    | "pageQuiz"
    | "interactiveSequence"
    | "interactiveDiagram"
    | "dragDropMatch";
  content?: string;
  /** Block heading (e.g. interactive sequence activity title) */
  title?: string;
  /** type === "interactiveSequence" | "interactiveDiagram" */
  intro?: string;
  /** type === "dragDropMatch" */
  instructions?: string;
  pairs?: Array<{ id: string; prompt: string; answer: string; explanation?: string }>;
  sequenceSteps?: Array<{ title: string; description: string; imageUrl: string; caption: string }>;
  /** type === "interactiveDiagram" — x/y as % 0–100 */
  hotspots?: Array<{ id: string; x: number; y: number; label: string; description: string }>;
  prompt?: string;
  questionType?: "mcq" | "short";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  visualId?: string;
  caption?: string;
  /** PR11 */
  mode?: "static" | "annotated" | "step";
  annotations?: DiagramAnnotation[];
  steps?: DiagramStep[];
  /** AI-generated diagram image (when no VisualModel) */
  imageUrl?: string;
  imageSource?: string;
  alt?: string;
  /** Student diagram shell: standard (default) vs featured (key visuals) */
  diagramVariant?: "standard" | "featured";
}

interface LessonPageHero {
  type: "none" | "image" | "video" | "animation";
  src: any; // can be string OR {url} depending on what editor saved
  caption?: string;
}

interface LessonPage {
  pageId: string;
  title: string;
  order: number;
  pageType?: string;
  hero?: LessonPageHero;
  blocks?: LessonPageBlock[];
  /** Optional; Mixed on backend — e.g. contentKeywords for student keyword highlights */
  metadata?: {
    contentKeywords?: Array<{
      term: string;
      type?: string;
      definition?: string;
      specKey?: string;
      topicKey?: string;
      flashcardIds?: string[];
    }>;
    [key: string]: unknown;
  };
  checkpoint?: {
    question?: string;
    options?: string[];
    answer?: string;
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

  // UI label remains "Exam board"
  examBoardName: string | null;

  teacherName: string;
  teacherId: string;

  estimatedDuration: number;

  isPublished: boolean;
  views: number;

  averageRating: number;
  totalRatings: number;

  createdAt: string;

  // ✅ NEW
  pages?: LessonPage[];
  
  // ✅ Phase C3: Preview mode flag from backend
  isFreePreview?: boolean;
  
  // ✅ ADDED: Revision fields
  flashcards?: Array<{
    id: string;
    front: string;
    back: string;
    tags?: string[];
    difficulty?: number; // This is number (not 1|2|3)
  }>;
  quiz?: {
    timeSeconds?: number;
    questions?: Array<{
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
    }>;
  };
  /** Lesson Integrity: topicKey for bank linkage (from backend) */
  topicKey?: string;
  /** Assessment questions (from topic bank snapshot) */
  assessment?: { questions?: Array<unknown> };
  /** Lesson↔AssessmentPaper: IDs of attached assessment papers */
  assessmentPaperIds?: string[];
  /** Past papers (from topic bank snapshot) */
  pastPapers?: Array<unknown>;
  /** Optional Mixed payload — e.g. contentKeywords for student keyword highlights */
  metadata?: {
    contentKeywords?: Array<{
      term: string;
      type?: string;
      definition?: string;
      specKey?: string;
      topicKey?: string;
      flashcardIds?: string[];
    }>;
    [key: string]: unknown;
  };
}

// ✅ Define a type for the flashcards with proper difficulty
type FlashcardData = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: number; // Allow any number for now
};

interface User {
  _id: string;
  userType: string;
  purchasedLessons: Array<{
    lessonId: string;
    purchasedAt: string;
  }>;
  // ✅ optional (some user shapes include this; we keep it safe)
  level?: string;
  stage?: string;
  educationLevel?: string;
  academicLevel?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
}

type ExamBoardRow = { name: string };

/** PR3b: Practice endpoint response item (exam question lite). */
interface PracticeQuestionLite {
  id: string;
  question: string;
  type: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  markScheme?: string[];
  topicKey?: string;
  topic?: string;
}

/** Published exam bank row from GET /api/exam-questions/for-topic (lesson Exam Practice). */
interface ExamPracticeQuestionLite {
  _id: string;
  question: string;
  type?: string;
  marks?: number;
  markScheme?: string[];
  correctAnswer?: string | null;
  /** Optional stem image from Exam Question Bank upload */
  imageUrl?: string | null;
  metadata?: { modelAnswer?: string; [key: string]: unknown };
}

function getBoardName(
  exam_board: ExamBoardRow[] | ExamBoardRow | null | undefined
): string | null {
  if (Array.isArray(exam_board)) return exam_board[0]?.name ?? null;
  if (exam_board && typeof exam_board === "object" && "name" in exam_board) {
    return (exam_board as ExamBoardRow).name ?? null;
  }
  return null;
}

// ✅ Mongo ObjectId is 24 hex chars. Supabase UUID is different.
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

function sortPages(pages: LessonPage[]) {
  return [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function normalizeHeroSrc(hero?: LessonPageHero): string {
  if (!hero) return "";
  const raw = (hero as any).src;

  // common shapes:
  // - "https://..."
  // - { url: "https://..." }
  // - { src: "https://..." }
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const url = safeStr((raw as any).url, "") || safeStr((raw as any).src, "");
    return url.trim();
  }

  return "";
}

// ============================
// Level normalization + access gate
// ============================

function normalizeLevelForCompare(levelRaw: string) {
  const s = safeStr(levelRaw, "").toLowerCase().trim();
  if (!s) return "";

  // common variants we might see in data
  if (
    s.includes("ks3") ||
    s.includes("key stage 3") ||
    s.includes("key stage three")
  )
    return "ks3";
  if (s.includes("gcse")) return "gcse";
  if (s.includes("a level") || s.includes("alevel") || s.includes("a-level"))
    return "a-level";

  // fallback: return cleaned string
  return s.replace(/\s+/g, " ").trim();
}

function getUserLevel(u: CurrentUser | null): string {
  if (!u) return "";
  const candidate =
    safeStr(u.level, "") ||
    safeStr(u.stage, "") ||
    safeStr(u.educationLevel, "") ||
    safeStr(u.academicLevel, "");
  return normalizeLevelForCompare(candidate);
}

// ============================
// Style-only constants
// ============================
const BASE_FONT_SIZE = 25; // ✅ CHANGED: 15 → 25 (+10px)

// ============================
// Visual types (backend response)
// ============================
type VisualVariant =
  | {
      level: string;
      type: "staticDiagram";
      src: string;
      labels?: string[];
      caption?: string;
    }
  | {
      level: string;
      type: "stepAnimation";
      src: string;
      steps: Array<{
        title?: string;
        text?: string;
        caption?: string;
        image?: string; // optional (if you add later)
        svg?: string; // optional (inline svg string if you add later)
      }>;
    };

type VisualResponse = {
  conceptKey: string;
  subject: string;
  topic: string;
  level: string;
  visual: VisualVariant;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Resolve URL for DiagramBlockContent (shared makeAbsoluteAssetUrl returns string | null; we pass string)
const resolveAssetUrl = (url: string) => makeAbsoluteAssetUrl(url) ?? "";

function DiagramBlockContent({
  visualId,
  caption,
  level,
  mode: blockMode,
  annotations = [],
  steps = [],
  makeAbsoluteAssetUrl: resolveUrl,
  variant = "standard",
}: {
  visualId: string;
  caption: string;
  level: string;
  mode?: "static" | "annotated" | "step";
  annotations?: DiagramAnnotation[];
  steps?: DiagramStep[];
  makeAbsoluteAssetUrl: (url: string) => string;
  variant?: "standard" | "featured";
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!visualId);
  const [error, setError] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const mode = blockMode === "annotated" || blockMode === "step" ? blockMode : "static";
  const hasSteps = mode === "step" && Array.isArray(steps) && steps.length > 0;
  const currentStep = hasSteps ? steps[Math.max(0, Math.min(stepIndex, steps.length - 1))] : null;
  const showIds = currentStep?.showAnnotationIds ?? [];
  const visibleAnnotations =
    mode === "step" && showIds.length >= 0
      ? (annotations ?? []).filter((a) => showIds.includes(a.id))
      : (annotations ?? []);
  const showOverlay = mode !== "static" && visibleAnnotations.length > 0;

  useEffect(() => {
    if (!visualId || !visualId.trim()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    getVisualById(visualId, level)
      .then((res: any) => {
        if (cancelled) return;
        const v = res?.data?.visual;
        const url = v && typeof v.src === "string" ? v.src : "";
        setSrc(url ? resolveUrl(url) : null);
        setError(!url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visualId, level, resolveUrl]);

  if (!visualId || !visualId.trim()) return null;

  if (loading) {
    return (
      <LessonDiagramFrame variant={variant}>
        <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading diagram…</div>
      </LessonDiagramFrame>
    );
  }
  if (error || !src || !hasRenderableLessonImageSrc(src)) {
    return (
      <LessonDiagramFrame variant={variant}>
        <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Diagram unavailable</div>
      </LessonDiagramFrame>
    );
  }

  return (
    <LessonDiagramFrame variant={variant} caption={caption}>
      <LessonImageFrame variant="primary" lightboxSrc={src}>
        {showOverlay ? (
          <div
            className="lesson-image-card__diagram-overlay-host"
            style={{ position: "relative", display: "block", width: "100%" }}
          >
            <img
              src={src}
              alt={caption || "Diagram"}
              style={{
                ...lessonImageFrameImgStyle,
                borderRadius: 10,
              }}
              onError={hideBrokenLessonImage}
            />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              borderRadius: 10,
            }}
          >
            {/* PR11.2: leader lines (vertical tick from pin toward label) */}
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
              {visibleAnnotations.map((a) => {
                const x = typeof a.x === "number" ? a.x : 0.5;
                const y = typeof a.y === "number" ? a.y : 0.5;
                const y2 = Math.max(0, Math.min(1, y - 0.035));
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
            </svg>
            {/* PR11.2: pin dots at anchor */}
            {visibleAnnotations.map((a) => {
              const x = typeof a.x === "number" ? a.x : 0.5;
              const y = typeof a.y === "number" ? a.y : 0.5;
              return (
                <div
                  key={`pin-${a.id}`}
                  style={{
                    position: "absolute",
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "#111827",
                    border: "2px solid #fff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                  }}
                />
              );
            })}
            {visibleAnnotations.map((a) => {
              const x = typeof a.x === "number" ? a.x : 0.5;
              const y = typeof a.y === "number" ? a.y : 0.5;
              const translateX = a.align === "left" ? "0" : a.align === "right" ? "100%" : "50%";
              const text = (a.text ?? "").trim() || "";
              return (
                <div
                  key={a.id}
                  style={{
                    position: "absolute",
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    transform: `translate(-${translateX}, -50%)`,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: (a.color && a.color.trim()) ? a.color : "rgba(34,197,94,0.9)",
                    color: "#fff",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    maxWidth: "90%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {text}
                </div>
              );
            })}
          </div>
        </div>
        ) : (
          <img
            src={src}
            alt={caption || "Diagram"}
            onError={hideBrokenLessonImage}
          />
        )}
      </LessonImageFrame>
      {hasSteps && steps.length > 1 && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            Step {stepIndex + 1} / {steps.length}
          </span>
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              background: "#fff",
              cursor: stepIndex === 0 ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: stepIndex === 0 ? 0.6 : 1,
            }}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={stepIndex >= steps.length - 1}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #22c55e",
              background: "rgba(34,197,94,0.1)",
              cursor: stepIndex >= steps.length - 1 ? "not-allowed" : "pointer",
              fontWeight: 600,
              opacity: stepIndex >= steps.length - 1 ? 0.6 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </LessonDiagramFrame>
  );
}

// PR3b: Practice question components (entitled-only section; always show explanation after check)
function PracticeMCQQuestion({
  q,
  lessonId,
  hideExplanationLabel,
}: {
  q: PracticeQuestionLite;
  lessonId?: string;
  /** V12: no "Explanation:" scaffold — content only */
  hideExplanationLabel?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [recorded, setRecorded] = useState(false);
  const options = Array.isArray(q.options) ? q.options : [];
  const correctAnswer = (q.correctAnswer != null ? String(q.correctAnswer) : "").trim();
  const isCorrect = checked && selected !== null && correctAnswer !== "" && selected.trim() === correctAnswer;
  const name = `practice-mcq-${q.id}`;

  const getOptionBg = (opt: string) => {
    const optTrim = String(opt ?? "").trim();
    const isCorrectOpt = correctAnswer !== "" && optTrim === correctAnswer;
    if (!checked) return "white";
    if (isCorrectOpt) return "#dcfce7";
    if (selected !== null && selected.trim() === optTrim && !isCorrect) return "#fee2e2";
    return "white";
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, i) => (
          <div
            key={i}
            className="lr-mcq-option"
            role="button"
            tabIndex={0}
            style={{ background: getOptionBg(opt), cursor: checked ? "default" : "pointer" }}
            onClick={() => {
              if (!checked) setSelected(String(opt ?? "").trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!checked) setSelected(String(opt ?? "").trim());
              }
            }}
          >
            <div className="lr-mcq-text" style={{ color: "#374151" }}>
              {opt}
            </div>
            <div className="lr-mcq-radio">
              <input
                type="radio"
                name={name}
                value={String(opt ?? "")}
                checked={selected !== null && String(selected).trim() === String(opt ?? "").trim()}
                onChange={() => { if (!checked) setSelected(String(opt ?? "").trim()); }}
                disabled={checked}
              />
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!checked ? (
          <button
            type="button"
            disabled={selected === null}
            onClick={() => setChecked(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "2px solid rgba(59,130,246,0.4)",
              background: selected !== null ? "rgba(59,130,246,0.12)" : "#f1f5f9",
              cursor: selected !== null ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            Check answer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 2 }}>
              {isCorrect ? (
                <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ Correct</span>
              ) : (
                <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ Not quite</span>
              )}
            </div>
            {!recorded && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#374151" }}>Confidence?</span>
                {([1, 2, 3] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      const conf = c as 1 | 2 | 3;
                      setConfidence(conf);
                      if (lessonId && q.id) {
                        logAttempt({
                          lessonId,
                          source: "practice",
                          questionId: q.id,
                          questionType: "mcq",
                          selected: selected ?? "",
                          isCorrect,
                          confidence: conf,
                        });
                      }
                      setRecorded(true);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `2px solid ${confidence === c ? "rgba(59,130,246,0.8)" : "rgba(0,0,0,0.14)"}`,
                      background: confidence === c ? "rgba(59,130,246,0.12)" : "white",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {c === 1 ? "Low (1)" : c === 2 ? "Medium (2)" : "High (3)"}
                  </button>
                ))}
              </div>
            )}
            {recorded && <div style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>Recorded. Thanks.</div>}
            {q.explanation ? (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                {!hideExplanationLabel ? (
                  <strong style={{ color: "#374151" }}>Explanation:</strong>
                ) : null}
                <div
                  style={{
                    marginTop: hideExplanationLabel ? 0 : 4,
                    color: "#4b5563",
                    fontSize: BASE_FONT_SIZE,
                  }}
                >
                  {q.explanation}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => { setSelected(null); setChecked(false); setConfidence(null); setRecorded(false); }}
              style={{
                marginTop: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "2px solid rgba(0,0,0,0.14)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PracticeShortQuestion({
  q,
  lessonId,
  hideExplanationLabel,
}: {
  q: PracticeQuestionLite;
  lessonId?: string;
  hideExplanationLabel?: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [selfMarked, setSelfMarked] = useState<boolean | null>(null);
  const [confidence, setConfidence] = useState<1 | 2 | 3 | null>(null);
  const [recorded, setRecorded] = useState(false);
  const hasAnswer = answer.trim() !== "";

  useEffect(() => {
    if (!lessonId || !q.id || selfMarked === null || confidence === null || recorded) return;
    logAttempt({
      lessonId,
      source: "practice",
      questionId: q.id,
      questionType: "short",
      answerText: answer.trim(),
      isCorrect: selfMarked,
      confidence,
    });
    setRecorded(true);
  }, [lessonId, q.id, selfMarked, confidence, recorded, answer]);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginTop: 8 }}>
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Your answer..."
          disabled={checked}
          style={{
            width: "100%",
            maxWidth: 500,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            fontSize: BASE_FONT_SIZE,
          }}
        />
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {!checked ? (
          <button
            type="button"
            disabled={!hasAnswer}
            onClick={() => setChecked(true)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "2px solid rgba(59,130,246,0.4)",
              background: hasAnswer ? "rgba(59,130,246,0.12)" : "#f1f5f9",
              cursor: hasAnswer ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            Check answer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 2, color: "#374151", fontSize: "0.95rem" }}>
              Compare your answer to the model answer below.
            </div>
            <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <strong style={{ color: "#374151" }}>Model answer:</strong>
              <div style={{ marginTop: 6, color: "#4b5563", fontSize: BASE_FONT_SIZE }}>
                {q.correctAnswer != null ? String(q.correctAnswer).trim() : "—"}
              </div>
            </div>
            {selfMarked === null ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "#374151" }}>Was your answer correct?</span>
                <button
                  type="button"
                  onClick={() => setSelfMarked(true)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #22c55e", background: "rgba(34,197,94,0.1)", color: "#15803d", cursor: "pointer", fontWeight: 700 }}
                >
                  I was correct
                </button>
                <button
                  type="button"
                  onClick={() => setSelfMarked(false)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #dc2626", background: "rgba(220,38,38,0.1)", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}
                >
                  I was incorrect
                </button>
              </div>
            ) : !recorded ? (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, color: "#374151" }}>Confidence?</span>
                {([1, 2, 3] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setConfidence(c)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: `2px solid ${confidence === c ? "rgba(59,130,246,0.8)" : "rgba(0,0,0,0.14)"}`,
                      background: confidence === c ? "rgba(59,130,246,0.12)" : "white",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {c === 1 ? "Low (1)" : c === 2 ? "Medium (2)" : "High (3)"}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}>Recorded. Thanks.</div>
            )}
            {q.explanation ? (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}>
                {!hideExplanationLabel ? (
                  <strong style={{ color: "#374151" }}>Explanation:</strong>
                ) : null}
                <div
                  style={{
                    marginTop: hideExplanationLabel ? 0 : 4,
                    color: "#4b5563",
                    fontSize: BASE_FONT_SIZE,
                  }}
                >
                  {q.explanation}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => { setAnswer(""); setChecked(false); setSelfMarked(null); setConfidence(null); setRecorded(false); }}
              style={{
                marginTop: 12,
                padding: "8px 14px",
                borderRadius: 8,
                border: "2px solid rgba(0,0,0,0.14)",
                background: "white",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const PRACTICE_DISPLAY_LIMIT = 10;

function PracticeSection({
  practiceLoading,
  practiceError,
  practiceQuestions,
  practiceAllowed,
  lessonId,
  practiceSource,
  topicKey,
  onTryAnotherSet,
  onLoadBankOnly,
  hidePracticeStructuralLabels,
}: {
  practiceLoading: boolean;
  practiceError: string | null;
  practiceQuestions: PracticeQuestionLite[];
  practiceAllowed: boolean | undefined;
  lessonId: string | undefined;
  practiceSource?: "attached" | "bank" | "embeddedAssessment" | null;
  topicKey?: string;
  onTryAnotherSet?: () => void;
  onLoadBankOnly?: () => void;
  /** V12 student lesson: no visible "Explanation:" prefix on practice items */
  hidePracticeStructuralLabels?: boolean;
}) {
  const displayQuestions = practiceQuestions.slice(0, PRACTICE_DISPLAY_LIMIT);
  const hasMore = practiceQuestions.length > PRACTICE_DISPLAY_LIMIT;
  const canTryAnother = practiceSource === "bank" && practiceQuestions.length > 0 && typeof onTryAnotherSet === "function";
  const isEmptyAttached = practiceSource === "attached" && practiceQuestions.length === 0;
  const isEmptyBank = practiceSource === "bank" && practiceQuestions.length === 0;
  const isEmptyEmbedded = practiceSource === "embeddedAssessment" && practiceQuestions.length === 0;
  const browseUrl = topicKey ? `/browse-lessons?topicKey=${encodeURIComponent(topicKey)}` : "/browse-lessons";

  const rightLabel =
    practiceSource === "attached"
      ? "From lesson"
      : practiceSource === "bank"
        ? "From question bank"
        : practiceSource === "embeddedAssessment"
          ? "Quick check"
          : null;

  return (
    <Section
      title="Practice Questions"
      id="practice"
      right={rightLabel ? <span style={{ fontSize: 12, color: "#6b7280" }}>{rightLabel}</span> : undefined}
      variant="plain"
    >
      <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#6b7280" }}>Practice questions help students reinforce what they learned in the lesson.</p>
      {practiceLoading && (
        <p style={{ color: "#6b7280", margin: 0 }}>Loading practice questions…</p>
      )}
      {practiceError && (
        <p style={{ color: "#dc2626", margin: 0 }}>{practiceError}</p>
      )}
      {!practiceLoading && !practiceError && practiceAllowed !== true && (
        <>
          <p style={{ color: "#4b5563", margin: 0, marginBottom: 12 }}>
            Practice questions are available with an active subscription.
          </p>
          <SubscribeCTA lessonId={lessonId} />
        </>
      )}
      {!practiceLoading && !practiceError && practiceAllowed === true && (
        <>
          {isEmptyAttached ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <p style={{ fontWeight: 600, color: "#374151", margin: "0 0 8px 0" }}>No practice questions yet</p>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0", fontSize: 14 }}>
                This lesson doesn&apos;t have any attached practice questions. You can practise a set from the question bank instead.
              </p>
              {typeof onLoadBankOnly === "function" && (
                <button
                  type="button"
                  onClick={onLoadBankOnly}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Try question bank set
                </button>
              )}
            </div>
          ) : isEmptyEmbedded ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <p style={{ fontWeight: 600, color: "#374151", margin: "0 0 8px 0" }}>No quick check questions</p>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0", fontSize: 14 }}>
                This lesson doesn&apos;t have a quick check set.
              </p>
            </div>
          ) : isEmptyBank ? (
            <div style={{ padding: 16, textAlign: "center" }}>
              <p style={{ fontWeight: 600, color: "#374151", margin: "0 0 8px 0" }}>No practice questions available</p>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0", fontSize: 14 }}>
                There aren&apos;t any published question bank items for this topic yet.
              </p>
              <Link
                to={browseUrl}
                style={{
                  display: "inline-block",
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid #2563eb",
                  background: "#eff6ff",
                  color: "#2563eb",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                Browse lessons
              </Link>
            </div>
          ) : (
            <>
              {displayQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fafafa",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: "#374151" }}>Q{idx + 1}</span>
                    {q.marks != null && (
                      <span style={{ fontSize: 13, color: "#6b7280" }}>({q.marks} {q.marks === 1 ? "mark" : "marks"})</span>
                    )}
                  </div>
                  <div style={{ color: "#1f2937", marginBottom: 12 }}>{q.question}</div>
                  {(q.type === "mcq" || (Array.isArray(q.options) && q.options.length > 0)) ? (
                    <PracticeMCQQuestion
                      q={q}
                      lessonId={lessonId}
                      hideExplanationLabel={hidePracticeStructuralLabels}
                    />
                  ) : (
                    <PracticeShortQuestion
                      q={q}
                      lessonId={lessonId}
                      hideExplanationLabel={hidePracticeStructuralLabels}
                    />
                  )}
                </div>
              ))}
              {hasMore && (
                <p style={{ color: "#6b7280", marginTop: 8 }}>
                  Showing first {PRACTICE_DISPLAY_LIMIT} of {practiceQuestions.length} questions.
                </p>
              )}
              {canTryAnother && (
                <button
                  type="button"
                  onClick={onTryAnotherSet}
                  style={{
                    marginTop: 12,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #2563eb",
                    background: "#eff6ff",
                    color: "#2563eb",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Try another set
                </button>
              )}
            </>
          )}
        </>
      )}
    </Section>
  );
}

const EXAM_PRACTICE_DISPLAY_LIMIT = 8;

function ExamPracticeSection({
  loading,
  error,
  questions,
  practiceAllowed,
  lessonId,
}: {
  loading: boolean;
  error: string | null;
  questions: ExamPracticeQuestionLite[];
  practiceAllowed: boolean | undefined;
  lessonId: string | undefined;
}) {
  const [showMarkSchemeById, setShowMarkSchemeById] = useState<Record<string, boolean>>({});
  const [draftById, setDraftById] = useState<Record<string, string>>({});
  const display = questions.slice(0, EXAM_PRACTICE_DISPLAY_LIMIT);

  return (
    <Section title="Exam Practice" id="exam-practice" variant="plain">
      <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#6b7280" }}>
        Longer exam-style questions for this topic (from the Exam Question Bank). Write your answer, then reveal the mark scheme when you&apos;re ready.
      </p>
      {loading && <p style={{ color: "#6b7280", margin: 0 }}>Loading exam practice…</p>}
      {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
      {!loading && !error && practiceAllowed !== true && (
        <>
          <p style={{ color: "#4b5563", margin: 0, marginBottom: 12 }}>
            Exam practice is available with an active subscription.
          </p>
          <SubscribeCTA lessonId={lessonId} />
        </>
      )}
      {!loading && !error && practiceAllowed === true && (
        <>
          {display.length === 0 ? (
            <p style={{ color: "#6b7280", margin: 0, fontSize: 14 }}>
              No published exam questions for this subtopic yet.
            </p>
          ) : (
            display.map((q, idx) => {
              const key = q._id;
              const show = !!showMarkSchemeById[key];
              const model =
                (typeof q.metadata?.modelAnswer === "string" && q.metadata.modelAnswer.trim()) ||
                (typeof q.correctAnswer === "string" ? q.correctAnswer.trim() : "") ||
                "";
              return (
                <div
                  key={key}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    border: "1px solid #e8e0f5",
                    background: "#fafbff",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "#374151" }}>Exam Q{idx + 1}</span>
                    {q.marks != null && (
                      <span style={{ fontSize: 13, color: "#6b7280" }}>
                        ({q.marks} {q.marks === 1 ? "mark" : "marks"})
                      </span>
                    )}
                  </div>
                  {q.imageUrl && String(q.imageUrl).trim() ? (
                    <div style={{ marginBottom: 12 }}>
                      <img
                        src={makeAbsoluteAssetUrl(String(q.imageUrl).trim())}
                        alt=""
                        style={{
                          maxWidth: "100%",
                          height: "auto",
                          borderRadius: 8,
                          border: "1px solid #e5e7eb",
                          display: "block",
                        }}
                      />
                    </div>
                  ) : null}
                  <div style={{ color: "#1f2937", marginBottom: 12, whiteSpace: "pre-wrap" }}>{q.question}</div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Your answer
                  </label>
                  <textarea
                    value={draftById[key] ?? ""}
                    onChange={(e) => setDraftById((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={5}
                    placeholder="Write your answer here…"
                    style={{
                      width: "100%",
                      maxWidth: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #d1d5db",
                      fontSize: 14,
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowMarkSchemeById((prev) => ({ ...prev, [key]: !prev[key] }))}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: "1px solid #7c3aed",
                        background: show ? "#f5f3ff" : "white",
                        color: "#5b21b6",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      {show ? "Hide mark scheme" : "Show mark scheme"}
                    </button>
                  </div>
                  {show && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 8,
                        background: "#f3f4f6",
                        border: "1px solid #e5e7eb",
                        fontSize: 14,
                        color: "#1f2937",
                      }}
                    >
                      {Array.isArray(q.markScheme) && q.markScheme.length > 0 && (
                        <ul style={{ margin: "0 0 12px 0", paddingLeft: 20 }}>
                          {q.markScheme.map((line, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                              {line}
                            </li>
                          ))}
                        </ul>
                      )}
                      {model ? (
                        <div>
                          <strong style={{ display: "block", marginBottom: 6 }}>Model answer</strong>
                          <div style={{ whiteSpace: "pre-wrap" }}>{model}</div>
                        </div>
                      ) : (
                        !q.markScheme?.length && <span style={{ color: "#6b7280" }}>No mark scheme available.</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </Section>
  );
}

/** Single switch: when false, hero caption (page kicker) never renders in student view. Also gates kicker-like blocks. */
const SHOW_PAGE_KICKER = false;

/** True if block looks like a page kicker/topic line (e.g. "Topic name (GCSE)") — single line, ends with (GCSE)/(A-Level), short. */
function isKickerLikeBlock(b: { type: string; content?: string }): boolean {
  if (b.type !== "text" && b.type !== "keyIdea") return false;
  const raw = (b.content != null ? String(b.content) : "").trim();
  const content = raw.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
  if (content.length > 100) return false;
  return /^.+\s*\((GCSE|A-Level)\)\s*$/i.test(content) || /^.+\s*\((?:Foundation|Higher)\)\s*$/i.test(content);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type LessonTitleDisplayParts =
  | { kind: "split"; prefix: string; mainTitle: string }
  | { kind: "single" };

/**
 * Display-only: split first line = exam board + level, second = lesson title with any leading
 * board+level text removed. Does not read or write stored data beyond input fields.
 */
function getLessonTitleDisplayParts(lesson: {
  title: string;
  examBoardName: string | null;
  level: string;
}): LessonTitleDisplayParts {
  const title = (lesson.title || "").trim();
  const board = (lesson.examBoardName && String(lesson.examBoardName).trim()) || "";
  const level = (lesson.level && String(lesson.level).trim()) || "";
  if (!board || !level || !title) {
    return { kind: "single" };
  }
  const boardClean = board.replace(/[\s-]+$/g, "");
  const prefix = `${boardClean}-${level}`;

  const b = escapeRegExp(boardClean);
  const l = escapeRegExp(level);
  const reStrip = new RegExp(`^\\s*${b}(?:\\s*[-–—]\\s*|\\s+)${l}\\s*`, "i");
  let mainTitle = title.replace(reStrip, "").trim();
  if (!mainTitle) {
    mainTitle = title;
  }
  return { kind: "split", prefix, mainTitle };
}

const LessonViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const { user, refresh, token } = useCurrentUser({ watchLocation: true });

  // PR-024.1: Student topic summary modal
  const [showTopicSummaryModal, setShowTopicSummaryModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** PR-LESSON-VIEW-FIX-1: Store API error details for teacher/dev debug display */
  const [loadErrorDetails, setLoadErrorDetails] = useState<{ status?: number; reason?: string; error?: string } | null>(null);

  // Phase B: entitlement UI state
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [accessDecision, setAccessDecision] = useState<{ allowed?: boolean; reason?: string } | null>(null);
  const loggedPreviewRef = useRef<string | null>(null);
  const lessonViewProgressLoggedRef = useRef<string | null>(null);
  /** Preview entry lock: suppresses quiz/practice auto-scroll during initial load (SS2 fix) */
  const previewLockRef = useRef(false);
  /** Stays true for ~400ms after preview entry so child components (AskAiPanel) keep suppressAutoScroll */
  const [previewEntrySuppressScroll, setPreviewEntrySuppressScroll] = useState(false);
  /** Suppress AskAi scrollIntoView on mount/lesson change — prevents page landing in middle (root cause fix) */
  const [suppressAskAiScrollOnMount, setSuppressAskAiScrollOnMount] = useState(true);
  /** Skip #practice / #block-N scroll on initial mount — force top on first load */
  const skipHashScrollOnMountRef = useRef(true);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // ✅ AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  /** PR: success/conflict toast for Generate revision with AI */
  const [aiToast, setAiToast] = useState<{ message: string; type: "success" | "error" | "info" | "warning" } | null>(null);
  /** Report Issue modal — blockId when triggered from a specific block */
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportBlockId, setReportBlockId] = useState<string | null>(null);
  // PR-F1: Load flashcards from bank (teacher, when lesson has none)
  const [loadFromBankLoading, setLoadFromBankLoading] = useState(false);
  const [loadFromBankError, setLoadFromBankError] = useState<string | null>(null);

  // PR-FE-FLASHCARDS-COLLAPSE-1: flashcards section collapsed by default, expand on click
  const [showFlashcards, setShowFlashcards] = useState(false);
  const flashcardsViewerRef = useRef<HTMLDivElement>(null);

  /** Mobile/tablet: matchMedia + innerWidth fallback for reliable real-phone detection below 768px */
  const MOBILE_BREAKPOINT = "(max-width: 767px)";
  const isMobileViewport = () => {
    if (typeof window === "undefined") return false;
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    if (mql.matches) return true;
    return window.innerWidth <= 768;
  };
  const [layoutStacked, setLayoutStacked] = useState(() => isMobileViewport());
  const [showMobilePagesDrawer, setShowMobilePagesDrawer] = useState(false);
  useEffect(() => {
    const check = () => setLayoutStacked(isMobileViewport());
    check();
    const mql = window.matchMedia(MOBILE_BREAKPOINT);
    mql.addEventListener("change", check);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    if (typeof (window as any).visualViewport !== "undefined") {
      (window as any).visualViewport.addEventListener("resize", check);
    }
    return () => {
      mql.removeEventListener("change", check);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      if (typeof (window as any).visualViewport !== "undefined") {
        (window as any).visualViewport.removeEventListener("resize", check);
      }
    };
  }, []);

  /** Debug: ?layoutDebug=1 shows layout values (for real-phone diagnosis) */
  const layoutDebug = searchParams.get("layoutDebug") === "1";
  const layoutDebugValues = layoutDebug && typeof window !== "undefined"
    ? {
        layoutStacked,
        innerWidth: window.innerWidth,
        visualViewportWidth: (window as any).visualViewport?.width,
        matchMedia: window.matchMedia(MOBILE_BREAKPOINT).matches,
      }
    : null;

  useEffect(() => {
    if (previewLockRef.current) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[LessonViewPage] blocked flashcards scroll (preview lock active)");
      }
      return;
    }
    if (showFlashcards && flashcardsViewerRef.current) {
      flashcardsViewerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showFlashcards]);

  // PR-FE-REVIEWS-COLLAPSE-1: Student Reviews collapsed by default, expand on pill click
  const [showReviews, setShowReviews] = useState(false);
  const reviewsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (previewLockRef.current) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[LessonViewPage] blocked reviews scroll (preview lock active)");
      }
      return;
    }
    if (showReviews && reviewsRef.current) {
      reviewsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showReviews]);

  // PR — Adaptive Testing Loop: topic mastery for adaptive feedback
  const [masteryData, setMasteryData] = useState<{ attempts: number; correct: number; masteryScore: number } | null>(null);


  // ✅ Only enable legacy reviews when lessonId is a Mongo ObjectId.
  const reviewsEnabled = isMongoObjectId(id);
  // Single source of truth for green CTA: "Rajiv – review the lesson" (never #NAME or placeholders)
  const rawFirstName =
    user?.firstName?.trim() ||
    (user as any)?.name?.split?.(" ")?.[0]?.trim() ||
    getUserDisplayName(user ?? undefined) ||
    "";
  const firstName = rawFirstName && !/^#NAME$/i.test(rawFirstName) ? rawFirstName : "";
  const reviewCtaLabel = firstName ? `${firstName} – review the lesson` : "Review the lesson";

  // ============================
  // Visuals (concept diagrams / animations)
  // ============================
  const [visualData, setVisualData] = useState<VisualResponse | null>(null);

  // Page → visual step mapping (auto)
  const [visualStepIndex, setVisualStepIndex] = useState(0);
  // ✅ Student toggle: show/hide "Deeper knowledge" (stretch) blocks
  const [showDeeperKnowledge, setShowDeeperKnowledge] = useState(false);

  const [curriculumConfidence, setCurriculumConfidence] = useState<unknown>(null);

  // PR3b: Practice questions (attached exam questions) — entitled only
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestionLite[]>([]);
  const [practiceAllowed, setPracticeAllowed] = useState<boolean | undefined>(undefined);
  const [practiceReason, setPracticeReason] = useState<string | null>(null);
  const [practiceSource, setPracticeSource] = useState<"attached" | "bank" | null>(null);
  const [practiceSeedCounter, setPracticeSeedCounter] = useState(0);

  const [examPracticeLoading, setExamPracticeLoading] = useState(false);
  const [examPracticeError, setExamPracticeError] = useState<string | null>(null);
  const [examPracticeQuestions, setExamPracticeQuestions] = useState<ExamPracticeQuestionLite[]>([]);

  // PR-DECLUTTER: Single practice source (examQuestions preferred; embedded assessment fallback). Targeted practice section removed.

  // PR15: Student next steps (entitled only, from reteach plan)
  const [nextStepsLoading, setNextStepsLoading] = useState(false);
  const [nextSteps, setNextSteps] = useState<{ studentSummary: string; updatedAt: string | null } | null>(null);

  // Lesson↔AssessmentPaper: summaries of attached papers (for student view)
  const [attachedPapersSummaries, setAttachedPapersSummaries] = useState<Array<{ _id: string; title: string; kind: string; questionCount: number; timeSeconds?: number }>>([]);

  const pageParam = useMemo(() => searchParams.get("page") || "", [searchParams]);

  // Force scroll to top on mount and on lesson/page change (fix: page lands in middle/Quiz after refresh)
  useEffect(() => {
    skipHashScrollOnMountRef.current = true;
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    // Clear hash from URL to prevent browser from scrolling to #quiz, #practice, etc. on load
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const t1 = setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 300);
    const t2 = setTimeout(() => { skipHashScrollOnMountRef.current = false; }, 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.history.scrollRestoration = prevRestoration;
    };
  }, [id, pageParam]);

  // Also scroll to top when lesson content finishes loading (catches late renders)
  useEffect(() => {
    if (!lesson) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    const t = setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 100);
    return () => clearTimeout(t);
  }, [lesson?.id]);

  const hasStructuredPages = useMemo(
    () =>
      Boolean(
        lesson?.pages && Array.isArray(lesson.pages) && lesson.pages.length > 0
      ),
    [lesson]
  );

  const orderedPages = useMemo(() => {
    if (!lesson?.pages || !Array.isArray(lesson.pages)) return [];
    return sortPages(lesson.pages);
  }, [lesson]);

  const rawPageIndex = useMemo(() => {
    if (!hasStructuredPages) return 0;
    if (!pageParam) return 0;

    // PR-006: Support numeric page index for citation deep links (?page=0)
    const numIdx = parseInt(pageParam, 10);
    if (!isNaN(numIdx) && numIdx >= 0 && numIdx < orderedPages.length) return numIdx;

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

  // entry=preview: force content-first render (page 1) — overrides URL until we clean it
  const entry = searchParams.get("entry") ?? "";
  const hasExplicitTarget =
    (location.hash || "").trim() !== "" ||
    searchParams.has("openPractice") ||
    searchParams.has("openQuiz") ||
    searchParams.get("openTopicSummary") === "1" ||
    searchParams.has("scrollTo");
  const isPreviewEntry = entry === "preview" && !hasExplicitTarget;
  const currentPageIndex = isPreviewEntry ? 0 : rawPageIndex;
  const currentPage = useMemo(() => {
    if (!hasStructuredPages) return null;
    return orderedPages[currentPageIndex] || null;
  }, [hasStructuredPages, orderedPages, currentPageIndex]);

  // ✅ SINGLE SOURCE OF TRUTH: Quiz questions
  const quizQuestions = useMemo(() => {
    if (!lesson) return [];
    // Use lesson.quiz?.questions if it exists and is an array
    if (lesson.quiz?.questions && Array.isArray(lesson.quiz.questions)) {
      return lesson.quiz.questions;
    }
    // Fallback to empty array
    return [];
  }, [lesson]);

  // Page-aware quiz: questions for current page only (structured view)
  const totalPages = orderedPages.length;
  const isSinglePage = totalPages <= 1;
  const pageQuizQuestions = useMemo(() => {
    if (!hasStructuredPages || !currentPage) return [];
    const pageId = String(currentPage.pageId || "");
    const withPageId = quizQuestions.filter((q: any) => String(q?.pageId || "") === pageId);
    // Single-page fallback: show questions with no pageId in Page Quiz (legacy/auto-attached)
    if (isSinglePage && withPageId.length === 0) {
      return quizQuestions.filter((q: any) => {
        const pid = String(q?.pageId ?? "").trim();
        return !pid || pid === "END";
      });
    }
    return withPageId;
  }, [hasStructuredPages, currentPage, quizQuestions, isSinglePage, orderedPages.length]);

  // End of lesson: questions with no pageId or pageId === "END"
  // When single page, all such questions are shown in Page Quiz instead, so this stays empty.
  const endOfLessonQuizQuestions = useMemo(() => {
    if (isSinglePage) return [];
    return quizQuestions.filter((q: any) => {
      const pid = String(q?.pageId ?? "").trim();
      return !pid || pid === "END";
    });
  }, [quizQuestions, isSinglePage]);

  // ✅ SINGLE SOURCE OF TRUTH: Flashcards
  const flashcards = useMemo(() => {
    if (!lesson) return [];
    // Use lesson.flashcards if it exists and is an array
    if (lesson.flashcards && Array.isArray(lesson.flashcards)) {
      return lesson.flashcards;
    }
    // Fallback to empty array
    return [];
  }, [lesson]);

  /** Normalised for keyword glossary popover (ids + strings). */
  const glossaryFlashcardsForLesson = useMemo((): GlossaryFlashcardLite[] => {
    if (!flashcards.length) return [];
    return flashcards.map((c: any, i: number) => ({
      id: String(c?.id ?? c?._id ?? `fc-${i}`),
      front: String(c?.front ?? ""),
      back: String(c?.back ?? ""),
      tags: Array.isArray(c?.tags) ? c.tags : undefined,
    }));
  }, [flashcards]);

  // PR-STUDENT-LESSON-NAV-1: specKey for LessonPrevNextBar (taxonomy ordering). Prefer API specKey; else shared util (allows empty exam board like topic picker).
  const specKey = useMemo((): SpecKey | null => {
    if (!lesson) return null;
    const explicit = (lesson as { specKey?: string }).specKey;
    if (typeof explicit === "string" && explicit.trim()) return explicit.trim() as SpecKey;
    return getSpecKeyFromLesson(lesson) as SpecKey | null;
  }, [lesson]);

  // PR-CONTENT-TARGETING-1: namespaced topicKeyForBank — URL topicKey, lesson.topicKey/topicSlug, or slugified lesson.topic (same as bank resolution).
  const topicKeyForBank = useMemo(
    () => resolveLessonTopicKeyForBankFromLesson(lesson, searchParams.get("topicKey")?.trim() || null),
    [lesson, searchParams]
  );

  /**
   * Topic key for student AI tutor + topic summary: prefer bank resolution, then lesson.topicKey,
   * then slug from lesson.topic / lesson.title so the tutor can show whenever specKey exists
   * (parity with “Today’s study plan”, selling point on production).
   */
  const studentTutorTopicKey = useMemo(() => {
    if (topicKeyForBank) return topicKeyForBank;
    const raw = (lesson as { topicKey?: string })?.topicKey?.trim();
    if (raw) {
      if (raw.includes(":")) return raw;
      if (specKey) return resolveLessonTopicKeyForBank({ specKey, topicKeyCandidate: raw }) || raw;
      return raw;
    }
    if (!specKey || !lesson) return null;
    const topicSlug =
      typeof lesson.topic === "string" && lesson.topic.trim()
        ? lesson.topic.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").slice(0, 80)
        : "";
    const titleSlug =
      typeof lesson.title === "string" && lesson.title.trim()
        ? lesson.title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "").slice(0, 80)
        : "";
    const candidate = topicSlug || titleSlug || "lesson";
    return resolveLessonTopicKeyForBank({ specKey, topicKeyCandidate: candidate });
  }, [topicKeyForBank, lesson, specKey]);

  // PR — Adaptive Testing Loop: handleQuestionAnswered and fetch mastery (must be after topicKeyForBank, hasStructuredPages, currentPage, etc.)
  const handleQuestionAnswered = useCallback(
    async (correct: boolean) => {
      const tk = topicKeyForBank;
      if (!tk || user?.userType !== "student") return;
      try {
        const res = await recordMastery(tk, correct);
        setMasteryData({ attempts: res.attempts, correct: res.correct, masteryScore: res.masteryScore });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[LessonViewPage] recordMastery failed:", e);
        }
      }
    },
    [topicKeyForBank, user?.userType]
  );

  // Fetch initial mastery when student reaches last page (structured) or on legacy single-page view
  useEffect(() => {
    if (user?.userType !== "student" || !topicKeyForBank) return;
    const isStructuredLastPage =
      hasStructuredPages &&
      currentPage &&
      orderedPages.length > 0 &&
      (orderedPages.length <= 1 || currentPageIndex === orderedPages.length - 1);
    const isLegacySinglePage = !hasStructuredPages;
    if (!isStructuredLastPage && !isLegacySinglePage) return;
    getMastery(topicKeyForBank)
      .then((res) => setMasteryData({ attempts: res.attempts, correct: res.correct, masteryScore: res.masteryScore }))
      .catch(() => {});
  }, [user?.userType, topicKeyForBank, hasStructuredPages, currentPage, orderedPages.length, currentPageIndex]);

  useEffect(() => {
    fetchLessonSmart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/curriculum-confidence/${id}`)
      .then((res) => setCurriculumConfidence(res.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    console.log("Curriculum confidence:", curriculumConfidence);
  }, [curriculumConfidence]);

  // ✅ Paywall event: log FREE_PREVIEW_VIEW once per lesson view (no double log on rerenders)
  useEffect(() => {
    if (accessDecision?.reason === "FREE_PREVIEW" && id && loggedPreviewRef.current !== id) {
      loggedPreviewRef.current = id;
      void logPaywallEvent("FREE_PREVIEW_VIEW", { lessonId: id });
    }
  }, [accessDecision?.reason, id]);

  // Set preview lock when entering via Preview Lesson (before any scroll effects run)
  useEffect(() => {
    if (isPreviewEntry && !hasExplicitTarget) {
      previewLockRef.current = true;
    }
  }, [isPreviewEntry, hasExplicitTarget]);

  // Scroll to #practice when arriving via /lesson/:id#practice (explicit deep link only)
  useEffect(() => {
    if (previewLockRef.current && !hasExplicitTarget) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[LessonViewPage] blocked #practice scroll (preview lock active)");
      }
      return;
    }
    if (skipHashScrollOnMountRef.current) return; // Disable on initial mount — force top on first load
    if (location.hash === "#practice") {
      if (process.env.NODE_ENV !== "production") {
        console.log("[LessonViewPage] auto-scroll trigger", { reason: "practice", hash: location.hash });
      }
      setTimeout(() => {
        const el = document.getElementById("practice");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [location.hash, id, hasExplicitTarget]);

  // entry=preview: dashboard View/Preview Lesson — force top-of-content (SS2 fix)
  // Run ONCE after lesson + page are ready, then release lock after settle
  useEffect(() => {
    if (!id || !isPreviewEntry || hasExplicitTarget) return;
    if (!lesson) return;
    // For structured pages, wait for currentPage; for legacy, lesson is enough
    if (hasStructuredPages && !currentPage) return;

    // Disable browser scroll restoration so we control position
    const prevRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    // Force first page when structured pages exist, then clean entry from URL
    const next = new URLSearchParams(searchParams);
    if (orderedPages.length > 0) {
      next.set("page", String(orderedPages[0].pageId));
    }
    next.delete("entry");
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }

    // Scroll to top after layout paints (requestAnimationFrame)
    if (process.env.NODE_ENV !== "production") {
      console.log("[LessonViewPage] PREVIEW_RESET scrollTo top", {
        lessonId: id,
        pageId: currentPage?.pageId,
        entry: searchParams.get("entry"),
        hash: location.hash,
      });
    }
    setPreviewEntrySuppressScroll(true);

    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("[LessonViewPage] preview entry reset applied", {
        entry,
        hasExplicitTarget,
        pageId: orderedPages[0]?.pageId ?? null,
        lessonId: id,
      });
    }

    // Delayed scroll-to-top to counteract any late scroll (e.g. AskAi loadConversation)
    const t2 = setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 300);

    // Release the lock after async loads settle (AskAi loadConversation can take 200–800ms)
    const t = setTimeout(() => {
      previewLockRef.current = false;
      setPreviewEntrySuppressScroll(false);
      window.history.scrollRestoration = prevRestoration;
    }, 1200);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [id, isPreviewEntry, hasExplicitTarget, lesson?.id, currentPage?.pageId, hasStructuredPages, orderedPages, searchParams, setSearchParams]);

  // PR-037: openTopicSummary=1 — open TopicSummaryStudentModal on mount, then clear param
  useEffect(() => {
    if (searchParams.get("openTopicSummary") !== "1") return;
    const isStudentUser = (user?.userType ?? "").toString().toLowerCase() === "student";
    if (!isStudentUser || !specKey) return;
    const tk = studentTutorTopicKey;
    if (!tk) return;
    setShowTopicSummaryModal(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openTopicSummary");
    setSearchParams(next, { replace: true });
  }, [searchParams, user?.userType, specKey, studentTutorTopicKey]);

  // PR-038: record lesson view for StudentTopicProgress (once per session per lesson)
  useEffect(() => {
    const isStudentUser = (user?.userType ?? "").toString().toLowerCase() === "student";
    if (!isStudentUser || !specKey || !id) return;
    const tk = studentTutorTopicKey;
    if (!tk) return;
    const sessionKey = `${id}:${specKey}:${tk}`;
    if (lessonViewProgressLoggedRef.current === sessionKey) return;
    lessonViewProgressLoggedRef.current = sessionKey;
    postLessonView(specKey, tk, id).catch(() => {});
  }, [id, specKey, studentTutorTopicKey, user?.userType]);

  // PR3b + PR-PRACTICE-1: Fetch practice questions with limit, seed, source
  const practiceSeed = useMemo(() => {
    if (!id) return "";
    const today = new Date().toISOString().slice(0, 10);
    const uid = user?._id ?? (user as { id?: string })?.id ?? "anon";
    const base = `${id}:${uid}:${today}`;
    return practiceSeedCounter > 0 ? `${base}:${practiceSeedCounter}` : base;
  }, [id, user, practiceSeedCounter]);

  useEffect(() => {
    if (!id || !accessDecision) return;
    if (accessDecision.allowed !== true) {
      setPracticeAllowed(false);
      setPracticeReason(accessDecision.reason ?? null);
      setPracticeQuestions([]);
      setPracticeSource(null);
      setPracticeError(null);
      return;
    }
    setPracticeLoading(true);
    setPracticeError(null);
    api
      .get(`/lessons/${id}/practice`, {
        params: {
          limit: 10,
          seed: practiceSeed,
          ...(topicKeyForBank ? { topicKey: topicKeyForBank } : {}),
        },
      })
      .then((res) => {
        const data = res?.data;
        setPracticeAllowed(!!data?.allowed);
        setPracticeReason(data?.reason ?? null);
        setPracticeQuestions(Array.isArray(data?.questions) ? data.questions : []);
        setPracticeSource(data?.source ?? null);
      })
      .catch((err) => {
        if (err?.response?.status === 402) {
          setPracticeAllowed(false);
          setPracticeReason("NOT_ENTITLED");
          setPracticeQuestions([]);
          setPracticeSource(null);
        } else {
          setPracticeError("Failed to load practice questions.");
        }
      })
      .finally(() => setPracticeLoading(false));
  }, [id, accessDecision?.allowed, accessDecision?.reason, practiceSeed, topicKeyForBank]);

  // Exam Question Bank — published items for this lesson topic (students only; separate from quiz / practice endpoint)
  useEffect(() => {
    const isStudentUser = (user?.userType ?? "").toString().toLowerCase() === "student";
    if (!isStudentUser || !id || accessDecision?.allowed !== true || !specKey || !topicKeyForBank) {
      setExamPracticeQuestions([]);
      setExamPracticeError(null);
      setExamPracticeLoading(false);
      return;
    }
    let cancelled = false;
    setExamPracticeLoading(true);
    setExamPracticeError(null);
    api
      .get("/exam-questions/for-topic", {
        params: { specKey, topicKey: topicKeyForBank, limit: EXAM_PRACTICE_DISPLAY_LIMIT },
      })
      .then((res) => {
        if (cancelled) return;
        const qs = res?.data?.questions;
        setExamPracticeQuestions(Array.isArray(qs) ? qs : []);
      })
      .catch(() => {
        if (!cancelled) setExamPracticeError("Failed to load exam practice questions.");
      })
      .finally(() => {
        if (!cancelled) setExamPracticeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, accessDecision?.allowed, specKey, topicKeyForBank, user?.userType]);

  // Fetch summaries of attached assessment papers when lesson.assessmentPaperIds changes
  useEffect(() => {
    const ids = lesson?.assessmentPaperIds;
    if (!ids?.length) {
      setAttachedPapersSummaries([]);
      return;
    }
    let cancelled = false;
    Promise.all(ids.map((paperId: string) => api.get(`/assessment-papers/${paperId}`).then((r: any) => r.data?.paper ?? r.data)))
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
            }))
        );
      })
      .catch(() => {
        if (!cancelled) setAttachedPapersSummaries([]);
      });
    return () => { cancelled = true; };
  }, [lesson?.assessmentPaperIds]);

  const loadBankOnly = useCallback(async () => {
    if (!id || accessDecision?.allowed !== true) return;
    setPracticeLoading(true);
    setPracticeError(null);
    try {
      const bankSeed = `${practiceSeed}:bank`;
      const res = await api.get(`/lessons/${id}/practice`, {
        params: {
          limit: 10,
          seed: bankSeed,
          mode: "bank-only",
          ...(topicKeyForBank ? { topicKey: topicKeyForBank } : {}),
        },
      });
      const data = res?.data;
      setPracticeAllowed(!!data?.allowed);
      setPracticeQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setPracticeSource(data?.source ?? "bank");
    } catch (err: any) {
      if (err?.response?.status === 402) {
        setPracticeAllowed(false);
        setPracticeQuestions([]);
        setPracticeSource(null);
      } else {
        setPracticeError("Failed to load practice questions.");
      }
    } finally {
      setPracticeLoading(false);
    }
  }, [id, accessDecision?.allowed, practiceSeed, topicKeyForBank]);

  // PR-DECLUTTER: Single practice section — prefer practice API (examQuestions/bank), else embedded assessment. Never show both.
  const effectivePractice = useMemo(() => {
    if (Array.isArray(practiceQuestions) && practiceQuestions.length > 0) {
      return { questions: practiceQuestions, source: practiceSource ?? "attached" };
    }
    const embedded = (lesson as { assessment?: { questions?: any[] } })?.assessment?.questions;
    if (Array.isArray(embedded) && embedded.length > 0) {
      const mapped: PracticeQuestionLite[] = embedded.map((q: any, idx: number) => ({
        id: q.id || `emb-${idx}`,
        question: q.question != null ? String(q.question) : "",
        type: q.type || "short",
        marks: typeof q.marks === "number" ? q.marks : 1,
        options: Array.isArray(q.options) ? q.options : undefined,
        correctAnswer: q.correctAnswer != null ? String(q.correctAnswer) : undefined,
        explanation: q.explanation != null ? String(q.explanation) : undefined,
        markScheme: Array.isArray(q.markScheme) ? q.markScheme : undefined,
        topicKey: q.topicKey,
        topic: q.topic,
      }));
      return { questions: mapped, source: "embeddedAssessment" as const };
    }
    return { questions: [] as PracticeQuestionLite[], source: null as "attached" | "bank" | "embeddedAssessment" | null };
  }, [practiceQuestions, practiceSource, lesson]);

  // PR15: Fetch next steps when entitled (student-safe summary only)
  useEffect(() => {
    if (!id || !accessDecision || accessDecision.allowed !== true) {
      setNextSteps(null);
      return;
    }
    setNextStepsLoading(true);
    api
      .get<{ ok: boolean; allowed: boolean; lessonId?: string; nextSteps?: { studentSummary: string; updatedAt: string | null } | null }>(`/lessons/${id}/next-steps`)
      .then((res) => {
        const data = res?.data;
        if (data?.allowed === true && data?.nextSteps?.studentSummary != null) {
          setNextSteps({
            studentSummary: String(data.nextSteps.studentSummary).trim(),
            updatedAt: data.nextSteps.updatedAt ?? null,
          });
        } else {
          setNextSteps(null);
        }
      })
      .catch(() => setNextSteps(null))
      .finally(() => setNextStepsLoading(false));
  }, [id, accessDecision?.allowed]);

  // ✅ Visual fetch (optional, silent fail)
  useEffect(() => {
    const loadVisual = async () => {
      try {
        if (!lesson) return;

        // MVP mapping: conceptKey is the topic lowercased (works for "Photosynthesis")
        const conceptKey = safeStr(lesson.topic, "").toLowerCase().trim();
        if (!conceptKey) return;

        const level = safeStr(lesson.level, "").trim();
        if (!level) return;

        const res = await getVisual(conceptKey, level);
        const payload = (res as any)?.data || null;
        setVisualData(payload);

        // reset step index when a new visual loads
        setVisualStepIndex(0);
      } catch {
        setVisualData(null);
        setVisualStepIndex(0);
      }
    };

    loadVisual();
  }, [lesson]);

  // ✅ Page → Visual auto-map (best for learning)
  useEffect(() => {
    if (!visualData?.visual) return;

    if (visualData.visual.type === "stepAnimation") {
      const steps = Array.isArray((visualData.visual as any).steps)
        ? (visualData.visual as any).steps
        : [];
      if (steps.length === 0) return;

      // ✅ Only auto-map when the page actually has a matching step.
      // If page index is beyond available steps, disable the visual.
      if (currentPageIndex >= steps.length) {
        setVisualStepIndex(-1);
        // Guarded console.warn
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[LessonViewPage] No visual step mapped for this page index:",
            currentPageIndex
          );
        }
        return;
      }

      setVisualStepIndex(currentPageIndex);
    }
  }, [currentPageIndex, visualData]);

  // PR-006: Scroll to block when citation deep link has #block-N
  useEffect(() => {
    if (previewLockRef.current && !hasExplicitTarget) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[LessonViewPage] blocked #block-N scroll (preview lock active)");
      }
      return;
    }
    if (skipHashScrollOnMountRef.current) return; // Disable on initial mount — force top on first load
    const hash = location.hash || (typeof window !== "undefined" ? window.location.hash : "");
    const m = hash && /^#block-(\d+)$/.exec(hash);
    if (!m || !hasStructuredPages) return;
    if (process.env.NODE_ENV !== "production") {
      console.log("[LessonViewPage] auto-scroll trigger", { reason: "block", hash });
    }
    const blockId = `block-${m[1]}`;
    const el = document.getElementById(blockId);
    if (el) {
      const t = setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [currentPageIndex, hasStructuredPages, location.hash, hasExplicitTarget]);

  // ✅ Gate: students can only view lessons that match their level (if user level is known)
  useEffect(() => {
    if (!lesson || !user) return;
    if (safeStr(user.userType, "").toLowerCase() !== "student") return;

    const userLevel = getUserLevel(user);
    if (!userLevel) return; // if we don't know, don't block

    const lessonLevel = normalizeLevelForCompare(lesson.level);
    if (!lessonLevel) return;

    if (userLevel !== lessonLevel) {
      setError("This lesson is not available for your level.");
      setLesson(null);
    }
  }, [lesson, user]);

  /**
   * SMART loader:
   * - Mongo ObjectId => fetch from backend (Mongo)
   * - UUID (legacy Supabase) => blocked (legacy slate is being cleared)
   */
  const fetchLessonSmart = async () => {
    try {
      setLoading(true);
      setError("");
      setLoadErrorDetails(null);
      setLesson(null);
       // Reset entitlement flags before each load
      setSubscriptionRequired(false);
      setPreviewMode(false);
      setAccessDecision(null);

      if (!id) {
        setError("Lesson id missing");
        return;
      }

      if (isMongoObjectId(id)) {
        await fetchLessonFromBackend(id);
        return;
      }

      if (isUuid(id)) {
        // ✅ slate wipe: do not load legacy lessons anymore
        setError("This legacy lesson is no longer available.");
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

  /**
   * ✅ Mongo backend lesson fetch (new system)
   * GET /api/lessons/:id — uses fetchLessonById for 401/402/403 handling.
   */
  const fetchLessonFromBackend = async (lessonId: string) => {
    try {
      const result = await fetchLessonById(lessonId);

      if (isLessonError(result)) {
        const { status, reason, error } = result.apiError;

        // ✅ 402 NOT_ENTITLED → Subscribe CTA (pricing from /api/pricing)
        if (status === 402 && reason === "NOT_ENTITLED") {
          void logPaywallEvent("PAYWALL_NOT_ENTITLED", { lessonId });
          setSubscriptionRequired(true);
          setError("");
          setLesson(null);
          return;
        }

        // Legacy: 403 "Subscription required" (backend used to return this)
        if (status === 403 && (error === "Subscription required" || reason === "NOT_ENTITLED")) {
          void logPaywallEvent("PAYWALL_NOT_ENTITLED", { lessonId });
          setSubscriptionRequired(true);
          setError("");
          setLesson(null);
          return;
        }

        if (status === 403) {
          setError(error || "You don't have access to this content.");
          setLesson(null);
          return;
        }

        // PR-LESSON-VIEW-FIX-1: 404 = access denied (no existence leak)
        if (status === 404) {
          setError("Lesson not found");
          setLesson(null);
          return;
        }

        if (status === 401) {
          setError("Please sign in to view this lesson.");
          setLesson(null);
          return;
        }

        setError(error || "Failed to load lesson");
        setLesson(null);
        return;
      }

      const data = result.data;
      if (!data) {
        setError("Lesson not found");
        return;
      }

      // ✅ Only published lessons should be visible to students.
      const isStudent = safeStr(user?.userType, "").toLowerCase() === "student";
      if (isStudent && Boolean((data as any).isPublished) !== true) {
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

      const quizData = data.quiz || {};

      // GET /api/lessons/:id includes lesson-level Mixed `metadata` (e.g. contentKeywords) — must
      // keep it here or mergeContentKeywordLists in lessonHighlightKeywords never sees lesson terms.
      const apiLessonMetadata = (data as { metadata?: unknown }).metadata;
      const lessonMetadataFromApi =
        apiLessonMetadata != null && typeof apiLessonMetadata === "object" && !Array.isArray(apiLessonMetadata)
          ? (apiLessonMetadata as Lesson["metadata"])
          : undefined;
      
      const mapped: Lesson = {
        id: safeStr(data._id || data.id || lessonId, lessonId),
        title: safeStr(data.title, "Untitled Lesson"),
        description,
        content: rawNotes.trim() ? rawNotes : "No lesson content yet.",
        subject: safeStr(data.subject, "Not set"),
        level: safeStr(data.level, "Not set"),
        topic: safeStr(data.topic, "Not set"),
        examBoardName: (data.examBoard ?? data.board) ? safeStr((data.examBoard ?? data.board) as string, "") : null,
        teacherName: safeStr(data.teacherName, "Teacher"),
        teacherId: safeStr(data.teacherId, ""),
        estimatedDuration: Number.isFinite(Number(data.estimatedDuration))
          ? Number(data.estimatedDuration)
          : 0,
        isPublished: Boolean(data.isPublished),
        views: Number.isFinite(Number(data.views)) ? Number(data.views) : 0,
        averageRating: Number.isFinite(Number(data.averageRating))
          ? Number(data.averageRating)
          : 0,
        totalRatings: Number.isFinite(Number(data.totalRatings))
          ? Number(data.totalRatings)
          : 0,
        createdAt: safeStr(data.createdAt, new Date().toISOString()),
        pages: Array.isArray(data.pages) ? data.pages : [],
        isFreePreview: Boolean(data.isFreePreview),
        // ✅ ADDED: Revision data with proper array validation
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
        // ✅ FIXED: Ensure quiz.questions is always an array
        quiz: {
          timeSeconds: quizData.timeSeconds || 600,
          questions: Array.isArray(quizData.questions) ? quizData.questions : []
        },
        topicKey: typeof data.topicKey === "string" ? data.topicKey : undefined,
        assessment: data.assessment,
        assessmentPaperIds: Array.isArray(data.assessmentPaperIds)
          ? data.assessmentPaperIds.map((id: any) => String(id))
          : [],
        pastPapers: Array.isArray(data.pastPapers) ? data.pastPapers : undefined,
        ...(lessonMetadataFromApi ? { metadata: lessonMetadataFromApi } : {}),
      };

      // Phase C3: Detect preview mode from backend flag (or accessDecision)
      const previewFromBackend =
        Array.isArray(mapped.pages) &&
        mapped.pages.length === 1 &&
        Boolean(mapped.isFreePreview);
      const previewFromDecision = result.accessDecision?.reason === "FREE_PREVIEW";

      setPreviewMode(Boolean(previewFromBackend || previewFromDecision));
      setAccessDecision(result.accessDecision || null);

      setLesson(mapped);

      // If lesson has pages but no URL param, ensure URL points to page 1 (stable deep-link)
      // When entry=preview, always force first page (content-first from dashboard)
      if (mapped.pages && mapped.pages.length > 0) {
        const ordered = sortPages(mapped.pages);
        const first = ordered[0];
        const current = searchParams.get("page");
        const isPreview = searchParams.get("entry") === "preview";
        if (first?.pageId && (!current || isPreview)) {
          const next = new URLSearchParams(searchParams);
          next.set("page", String(first.pageId));
          setSearchParams(next, { replace: true });
        }
      }
    } catch (err: any) {
      console.error("Backend lesson fetch error:", err);
      setLoadErrorDetails({ error: err?.message });
      setError(err?.message || "Failed to load lesson");
      setLesson(null);
    }
  };

  // NOTE: legacy supabase fetch kept (unused) only to avoid breaking imports/refs if you reuse later.
  // We do NOT call it anymore as part of the "wipe legacy slate clean" plan.
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
        isPublished: Boolean((data as any)?.is_published),
        views: 0,
        averageRating: 0,
        totalRatings: 0,
        createdAt: safeStr((data as any)?.created_at, new Date().toISOString()),
        pages: [],
      };

      setLesson(mapped);
    } catch (err: any) {
      console.error("Error fetching lesson from Supabase:", err);
      setError("Failed to load lesson");
    }
  };

  const hasPurchasedLesson = () => {
    if (!user || !lesson) return false;
    if (user.userType !== "student") return false;

    return user.purchasedLessons?.some(
      (purchase) => String(purchase.lessonId) === String(lesson.id)
    );
  };

  const handleReviewSubmitted = () => {
    setReviewSubmitted(true);
    setShowReviewForm(false);
    fetchLessonSmart();
  };

  // PR-CONTENT-TARGETING-1: AI generation only when topicKeyForBank is valid; pass it in body
  // After generate-revision creates a draft, auto-apply so flashcards appear in student view
  const handleAIGenerate = async () => {
    if (!lesson || !lesson.id || !topicKeyForBank) return;
    setIsGenerating(true);
    setAiToast(null);
    try {
      await api.post(`/lessons/${lesson.id}/generate-revision`, { topicKey: topicKeyForBank });
      let applied = false;
      let applyData: { flashcardsCount?: number; quizQuestionsCount?: number } | undefined;
      try {
        const res = await api.post(`/lessons/${lesson.id}/revision-draft/apply`);
        applied = true;
        applyData = res?.data?.lesson;
      } catch (applyErr: any) {
        if (applyErr?.response?.status === 409) {
          setAiToast({
            message: "Revision materials were generated, but this lesson could not be updated automatically. Open Edit Lesson to review or apply them.",
            type: "info",
          });
        } else {
          throw applyErr;
        }
      }
      await fetchLessonSmart();
      if (applied && applyData) {
        const fc = applyData.flashcardsCount ?? 0;
        const qc = applyData.quizQuestionsCount ?? 0;
        const successMsg = fc > 0 && qc > 0
          ? "Revision materials added to this lesson."
          : "Flashcards added to this lesson.";
        setAiToast({ message: successMsg, type: "success" });
        if (fc > 0) setShowFlashcards(true);
      }
    } catch (error) {
      console.error("AI generation error:", error);
      setAiToast({ message: "Error generating revision content", type: "error" });
    } finally {
      setIsGenerating(false);
    }
  };

  // PR-F1: Load flashcards from bank into this lesson (teacher only, when lesson has none)
  const handleLoadFromBank = async () => {
    if (!id || !topicKeyForBank) return;
    setLoadFromBankError(null);
    setLoadFromBankLoading(true);
    try {
      await copyBankToLesson(topicKeyForBank, id);
      await fetchLessonSmart();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Failed to load from bank";
      setLoadFromBankError(msg);
    } finally {
      setLoadFromBankLoading(false);
    }
  };

  // ============================
  // Structured pages UI helpers
  // ============================

  const goToPage = (p: LessonPage) => {
    if (!p?.pageId) return;
    setSearchParams({ page: String(p.pageId) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevPage =
    currentPageIndex > 0 ? orderedPages[currentPageIndex - 1] : null;
  const nextPage =
    currentPageIndex < orderedPages.length - 1
      ? orderedPages[currentPageIndex + 1]
      : null;

  const markdownComponents = useMemo(
    () => createLessonMarkdownViewComponents(safeStr),
    []
  );

  const lessonHighlightKeywords = useMemo(() => {
    const lessonKw = normalizeContentKeywords((lesson as { metadata?: { contentKeywords?: unknown } })?.metadata?.contentKeywords);
    const pageKw = normalizeContentKeywords(
      (currentPage as { metadata?: { contentKeywords?: unknown } } | null)?.metadata?.contentKeywords
    );
    const merged = mergeContentKeywordLists(lessonKw, pageKw);
    if (
      process.env.NODE_ENV === "development" &&
      typeof window !== "undefined" &&
      (window as { __LR_DEBUG_STUDENT_KEYWORDS__?: boolean }).__LR_DEBUG_STUDENT_KEYWORDS__ === true
    ) {
      // eslint-disable-next-line no-console
      console.log("[LessonViewPage] student keyword trace", {
        currentPageId: (currentPage as { pageId?: string } | null)?.pageId ?? null,
        currentPageTitle: (currentPage as { title?: string } | null)?.title ?? null,
        lessonMetadataKeys: lesson ? Object.keys((lesson as { metadata?: object }).metadata ?? {}) : [],
        pageMetadataKeys: (currentPage as { metadata?: object } | null)?.metadata
          ? Object.keys((currentPage as { metadata: object }).metadata)
          : [],
        lessonContentKeywordsCount: lessonKw.length,
        pageContentKeywordsCount: pageKw.length,
        mergedCount: merged.length,
        terms: merged.map((k) => k.term),
      });
    }
    return merged;
  }, [lesson, currentPage]);

  const lessonViewMarkdownComponents = useMemo(
    () =>
      mergeLessonMarkdownComponentsWithKeywordHighlight(markdownComponents, lessonHighlightKeywords, {
        autoTextKeywordHighlights: false,
      }),
    [markdownComponents, lessonHighlightKeywords]
  );

  /** Strip [Video: caption](url) from content — used only for description/top box and keyword parsing */
  const stripVideoMarkdown = (content: string): string => {
    if (!content || typeof content !== "string") return content;
    return content.replace(/\[Video:[^\]]*\]\([^)]*\)/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  };

  /** Strip media from Description — top box is plain text only; video/images render in blocks */
  const stripMediaFromDescription = (content = ""): string => {
    return String(content)
      .replace(/\[Video:[^\]]*\]\([^)]+\)/gi, "")
      .replace(/!\[[^\]]*\]\([^)]+\)/gi, "")
      .replace(/\/uploads\/videos\/[^\s)]+/gi, "")
      .replace(/<video[\s\S]*?<\/video>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .trim();
  };

  /** PR-UX-LESSON-4: Detect comma-separated keywords list for "Key words" callout. TODO: Long-term: migrate keywords blocks to structured type: keyWords. */
  const maybeParseKeywordsFromText = (blockText: string): string[] | null => {
    const t = String(blockText ?? "").trim();
    if (t.length === 0 || t.length > 250) return null;
    if (!t.includes(",")) return null;
    if (/[.!?]/.test(t)) return null; // sentence punctuation → not keywords
    const items = t
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const seen = new Set<string>();
    const deduped = items.filter((s) => {
      const lower = s.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
    return deduped.length >= 2 ? deduped : null; // 1 item looks weird as a callout; render as normal text
  };

  const renderCallout = (
    kind: LessonPageBlock["type"] | "keyWords",
    text: string,
    idx: number
  ) => {
    const base: React.CSSProperties = {
      padding: "14px",
      borderRadius: "12px",
      margin: "14px 0",
      lineHeight: 1.8,
      background: "white",
      textAlign: "left",
      fontSize: BASE_FONT_SIZE,
    };

    const cleanedText = stripVideoMarkdown(text);

    if (kind === "pageQuiz") {
      return (
        <div
          key={idx}
          className="lesson-content"
          style={{
            ...base,
            padding: "12px 14px",
            background: "#fbfbfc",
            border: "2px solid rgba(0,0,0,0.10)",
            boxShadow: "0 0 0 2px rgba(0,0,0,0.03)",
          }}
        >
          <LessonMarkdown className="lesson-md-body" components={markdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
            {preprocessMarkdownAssetUrls(text)}
          </LessonMarkdown>
        </div>
      );
    }

    if (kind === "keyIdea") {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "#f0fff4",
            border: "2px solid rgba(34,197,94,0.40)",
            boxShadow: "0 0 0 2px rgba(34,197,94,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#065f46" }}>
            🔑 Key Idea(s)
          </div>
          <div className="lesson-content">
            <LessonMarkdown className="lesson-md-body" components={lessonViewMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
              {preprocessMarkdownAssetUrls(text)}
            </LessonMarkdown>
          </div>
        </div>
      );
    }
    if (kind === "examTip") {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "#eef2ff",
            border: "2px solid rgba(99,102,241,0.40)",
            boxShadow: "0 0 0 2px rgba(99,102,241,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#3730a3" }}>
            🧠 Exam insight
          </div>
          <div className="lesson-content">
            <LessonMarkdown className="lesson-md-body" components={lessonViewMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
              {preprocessMarkdownAssetUrls(text)}
            </LessonMarkdown>
          </div>
        </div>
      );
    }
    if (kind === "commonMistake") {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "#fff7ed",
            border: "2px solid rgba(249,115,22,0.45)",
            boxShadow: "0 0 0 2px rgba(249,115,22,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#9a3412" }}>
            ⚠️ Common mistake(s)
          </div>
          <div className="lesson-content">
            <LessonMarkdown className="lesson-md-body" components={lessonViewMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
              {preprocessMarkdownAssetUrls(text)}
            </LessonMarkdown>
          </div>
        </div>
      );
    }
    if (kind === "stretch") {
      return (
        <div
          key={idx}
          style={{
            padding: 14,
            borderRadius: 14,
            marginBottom: 12,
            border: "2px solid rgba(124,58,237,0.35)",
            background: "rgba(124,58,237,0.08)",
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#5b21b6" }}>
            🔍 Deeper knowledge (stretch)
          </div>
          <div className="lesson-content">
            <LessonMarkdown className="lesson-md-body" components={lessonViewMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
              {preprocessMarkdownAssetUrls(text)}
            </LessonMarkdown>
          </div>
        </div>
      );
    }

    // PR-UX-LESSON-4: Key words callout — explicit keyWords block or text that looks like comma-separated keywords
    const keywords = kind === "keyWords" || kind === "text" ? maybeParseKeywordsFromText(cleanedText) : null;
    if (keywords && keywords.length > 0) {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "rgba(139,92,246,0.06)",
            border: "2px solid rgba(139,92,246,0.30)",
            boxShadow: "0 0 0 2px rgba(139,92,246,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8, color: "#5b21b6" }}>
            🔑 Key words
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            {keywords.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      );
    }

    // ✅ TEXT BLOCK:
    // - Markdown supports images inline: ![caption](url)
    // - Video markdown [Video: caption](url) renders via custom link component
    return (
      <div
        key={idx}
        className="lesson-content"
        style={{
          ...base,
          padding: "12px 14px",
          background: "#fbfbfc",
          border: "2px solid rgba(0,0,0,0.10)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.03)",
        }}
      >
        <LessonMarkdown className="lesson-md-body" components={lessonViewMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
          {preprocessMarkdownAssetUrls(text)}
        </LessonMarkdown>
      </div>
    );
  };

  const renderDiagramBlock = (block: LessonPageBlock, idx: number) => {
    const caption = block.caption ?? "";
    const diagramVariant = block.diagramVariant === "featured" ? "featured" : "standard";
    const rawDiagramUrl = block.imageUrl != null ? String(block.imageUrl) : "";
    if (hasRenderableLessonImageSrc(rawDiagramUrl)) {
      const src = String(block.imageUrl).startsWith("http")
        ? String(block.imageUrl)
        : (makeAbsoluteAssetUrl(String(block.imageUrl)) ?? "");
      if (hasRenderableLessonImageSrc(src)) {
        return (
          <LessonDiagramFrame
            key={`diagram-${idx}-img`}
            variant={diagramVariant}
            caption={caption || undefined}
          >
            <LessonImageFrame variant="primary" lightboxSrc={src}>
              <img
                src={src}
                alt={block.alt ?? (caption || "Diagram")}
                onError={hideBrokenLessonImage}
              />
            </LessonImageFrame>
          </LessonDiagramFrame>
        );
      }
    }
    const visualId = block.visualId ?? "";
    const level = lesson?.level ?? "GCSE";
    const mode = block.mode === "annotated" || block.mode === "step" ? block.mode : "static";
    const annotations = Array.isArray(block.annotations) ? block.annotations : [];
    const steps = Array.isArray(block.steps) ? block.steps : [];
    return (
      <DiagramBlockContent
        key={`diagram-${idx}-${visualId}`}
        visualId={visualId}
        caption={caption}
        level={level}
        mode={mode}
        annotations={annotations}
        steps={steps}
        makeAbsoluteAssetUrl={resolveAssetUrl}
        variant={diagramVariant}
      />
    );
  };

  const renderHero = (hero?: LessonPageHero) => {
    const h = hero || { type: "none", src: "", caption: "" };
    const rawSrc = normalizeHeroSrc(h);
    if (!hasRenderableLessonImageSrc(rawSrc)) return null;

    // Resolve to absolute URL so videos/images load from backend (/uploads, /visuals, /content)
    const src = rawSrc ? (makeAbsoluteAssetUrl(rawSrc) ?? rawSrc) : "";
    if (!hasRenderableLessonImageSrc(src)) return null;

    // ✅ If there is no valid src, do NOT render the hero at all (prevents broken image icon)
    if (!h || h.type === "none" || !src) return null;

    // ✅ Top title/topic page section must be text-only — do NOT render video/animation here.
    // Video belongs only in the dedicated lower lesson block (block content with [Video:...](url)).
    if (h.type === "video" || h.type === "animation") return null;

    // Page kicker/subtitle: hero caption — only render when SHOW_PAGE_KICKER is true (caption never renders otherwise)
    if (process.env.NODE_ENV !== "production" && h?.caption?.trim()) {
      console.log("[page-kicker]", { value: h.caption, source: "currentPage.hero.caption", currentPage: hero ? { caption: (hero as any).caption } : null });
    }
    const renderCaption = SHOW_PAGE_KICKER && Boolean(h?.caption?.trim());

    if (h.type === "image") {
      return (
        <div
          className={v12StudentPresentation ? "lesson-student-hero-slot" : undefined}
          style={{ marginBottom: 16 }}
        >
          <LessonImageFrame variant="primary" lightboxSrc={src}>
            <img src={src} alt={h.caption || "Lesson visual"} onError={hideBrokenLessonImage} />
            {renderCaption && h.caption?.trim() ? (
              <p className="lesson-image-caption" data-testid="page-kicker">
                {h.caption}
              </p>
            ) : null}
          </LessonImageFrame>
        </div>
      );
    }

    return null;
  };

  const renderVisualBox = () => {
    if (!visualData?.visual) return null;

    const wrapperLegacy: React.CSSProperties = {
      margin: "14px 0",
      padding: 14,
      borderRadius: 14,
      border: "2px solid rgba(0,0,0,0.10)",
      background: "#ffffff",
      textAlign: "left",
    };
    const wrapper: React.CSSProperties = v12StudentPresentation
      ? {
          margin: "16px 0 20px",
          padding: 20,
          borderRadius: 18,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
          textAlign: "left",
        }
      : wrapperLegacy;

    const headerRow: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10,
    };

    const badge: React.CSSProperties = {
      fontWeight: 950 as any,
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
    };

    // -------- static diagram --------
    if (visualData.visual.type === "staticDiagram") {
      const rawStaticSrc = (visualData.visual as any).src;
      const rawStr = typeof rawStaticSrc === "string" ? rawStaticSrc : "";
      if (!hasRenderableLessonImageSrc(rawStr)) return null;
      const srcAbs = makeAbsoluteAssetUrl(rawStaticSrc);
      if (!srcAbs || !hasRenderableLessonImageSrc(srcAbs)) return null;

      return (
        <div
          className={v12StudentPresentation ? "lesson-student-visual-slot" : undefined}
          style={wrapper}
        >
          <div style={headerRow}>
            <div style={badge}>📌 Visual</div>
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              (Auto-maps to the current page)
            </div>
          </div>

          <LessonImageFrame variant="primary" lightboxSrc={srcAbs}>
            <img
              src={srcAbs}
              alt={`${lesson?.topic || "Lesson"} diagram`}
              onError={hideBrokenLessonImage}
            />
          </LessonImageFrame>

          {Array.isArray((visualData.visual as any).labels) &&
          (visualData.visual as any).labels.length > 0 ? (
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: "0.95rem" }}>
              Labels: {(visualData.visual as any).labels.join(", ")}
            </div>
          ) : null}
        </div>
      );
    }

        // -------- step animation (page → step) --------
    if (visualData.visual.type === "stepAnimation") {
      const steps = Array.isArray((visualData.visual as any).steps)
        ? ((visualData.visual as any).steps as any[])
        : [];

      // 1) guards
      if (steps.length === 0) return null;
      if (visualStepIndex < 0) return null;

      const step = steps[visualStepIndex];
      if (!step) return null;

      // 2) compute once
      const title = safeStr(step.title, `Step ${visualStepIndex + 1}`);
      const text =
        safeStr(step.text, "") || safeStr((step as any).description, "");
      const caption = safeStr(step.caption, "");

      // 3) navigation state
      const canPrev = visualStepIndex > 0;
      const canNext = visualStepIndex < steps.length - 1;

      const hasSvgInline =
        typeof step.svg === "string" && step.svg.trim().startsWith("<svg");

      // 4) derived image path MUST use visualStepIndex + 1 (not idx)
      const derived = `/visuals/${visualData.conceptKey}/step-${
        visualStepIndex + 1
      }.png`;
      const src = makeAbsoluteAssetUrl(step.image || derived) ?? "";

      return (
        <div
          className={v12StudentPresentation ? "lesson-student-visual-slot" : undefined}
          style={wrapper}
        >
          <div style={headerRow}>
            <div style={badge}>📌 Visual</div>
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              Step {visualStepIndex + 1} of {steps.length}
            </div>
          </div>

          <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>
            {title}
          </div>

          {hasRenderableLessonImageSrc(src) ? (
            <LessonImageFrame variant="primary" lightboxSrc={src}>
              <img src={src} alt={title} onError={hideBrokenLessonImage} />
            </LessonImageFrame>
          ) : null}

          {hasSvgInline ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                padding: 10,
                marginBottom: 10,
                overflow: "auto",
              }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: step.svg }}
            />
          ) : null}

          {text ? (
            <div style={{ color: "#111827", lineHeight: 1.8, marginBottom: 10 }}>
              {text}
            </div>
          ) : null}

          {caption ? (
            <div
              style={{
                color: "#6b7280",
                fontSize: "0.95rem",
                marginBottom: 10,
              }}
            >
              {caption}
            </div>
          ) : (
            <div
              style={{
                color: "#6b7280",
                fontSize: "0.95rem",
                marginBottom: 10,
              }}
            >
              (This visual auto-maps to the current page.)
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              disabled={!canPrev}
              onClick={() =>
                setVisualStepIndex((p) => clamp(p - 1, 0, steps.length - 1))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "2px solid rgba(0,0,0,0.18)",
                background: canPrev ? "white" : "#f3f4f6",
                cursor: canPrev ? "pointer" : "not-allowed",
                fontWeight: 850,
              }}
            >
              ← Prev step
            </button>

            <button
              disabled={!canNext}
              onClick={() =>
                setVisualStepIndex((p) => clamp(p + 1, 0, steps.length - 1))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: canNext ? "#48bb78" : "#9ca3af",
                cursor: canNext ? "pointer" : "not-allowed",
                color: "white",
                fontWeight: 950 as any,
              }}
            >
              Next step →
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================
  // Render states
  // ============================

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lesson...</h2>
      </div>
    );
  }

  if (subscriptionRequired) {
    return (
      <div style={{ maxWidth: 720, margin: "24px auto", padding: 12 }}>
        <h2 style={{ marginBottom: 8 }}>This lesson is locked</h2>
        <p style={{ marginBottom: 12 }}>
          Subscribe to access all lessons.
        </p>
        <SubscribeCTA lessonId={id || undefined} />
        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "white",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    const showDebugError =
      (user?.userType === "teacher" || user?.userType === "admin" || (user as any)?.isAdmin === true) ||
      process.env.NODE_ENV !== "production" ||
      process.env.REACT_APP_DEV_TOOLS === "1";
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>{error || "Lesson not found"}</h2>
        {showDebugError && loadErrorDetails && (
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>
            Load failed ({loadErrorDetails.status ?? "?"}): {loadErrorDetails.reason ?? loadErrorDetails.error ?? "unknown"}
          </p>
        )}
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ============================
  // ✅ Check if user is teacher or admin
  // ============================
  const isStudent = user?.userType === "student";
  /**
   * V12 learner presentation must run for every viewer of lesson content (students, teachers/admins
   * previewing, parents, guests). Gating only on `isStudent` left teachers on the legacy path
   * (`renderCallout` + hardcoded “Key Idea(s)” / “Exam insight” labels + boxed SS1 styles).
   */
  const v12LearnerPresentation =
    user == null ||
    !String(user?.userType ?? "").trim() ||
    user?.userType === "student" ||
    user?.userType === "teacher" ||
    user?.userType === "admin" ||
    user?.userType === "parent" ||
    (user as { isAdmin?: boolean })?.isAdmin === true;
  const v12StudentPresentation = isV12StudentLessonPresentation(v12LearnerPresentation);

  const isTeacherOrAdmin =
    user?.userType === "admin" ||
    user?.userType === "teacher" ||
    (user as any)?.isAdmin === true;

  // Single source of truth: backend accessDecision.allowed; fallbacks only if backend missing (see lessonAccess.ts).
  const hasFullLessonAccess = computeFullLessonAccess(accessDecision, user);

  // Dev-only: render flags for preview entry debugging
  if (process.env.NODE_ENV !== "production" && lesson && (isPreviewEntry || entry === "preview")) {
    console.log("[LessonViewPage] render flags", {
      entry,
      isPreviewEntry,
      hasExplicitTarget,
      currentPageIndex,
      pageId: currentPage?.pageId ?? null,
      lessonId: id,
    });
  }

  // ============================
  // ✅ New Student View (Pages)
  // ============================
  if (hasStructuredPages && currentPage) {
    const progressCount = Math.min(currentPageIndex + 1, orderedPages.length);
    const progressPct =
      orderedPages.length > 0
        ? Math.round((progressCount / orderedPages.length) * 100)
        : 0;

    // PR-UX-REVIEWS-1: Show Student Reviews only on last page
    const totalPages = orderedPages.length;
    const isSinglePage = totalPages <= 1;
    const isLastPage = isSinglePage || currentPageIndex === totalPages - 1;

    const lessonTitleDisplay = getLessonTitleDisplayParts(lesson);

    // PR-UX-LESSON-3: Single checkpoint per page — prefer page.checkpoint, else first valid block
    const pageCp = currentPage.checkpoint;
    const hasPageCheckpoint =
      Boolean(pageCp?.question && Array.isArray(pageCp?.options)) &&
      (pageCp!.options!.filter((o: any) => o != null && String(o).trim()).length >= 2);
    const blocks = currentPage.blocks || [];
    const blockRenderList = blocks
      .map((b, idx) => ({ block: b, idx }))
      .filter(({ block: b }) => {
        if (b.type === "stretch" && !showDeeperKnowledge) return false;
        if (b.type === "checkpoint") return false; // PR-UX-LESSON-3: always render checkpoint via LessonCheckpoint
        if (!SHOW_PAGE_KICKER && isKickerLikeBlock(b)) return false;
        return true;
      });

    // Regression guard: when SHOW_PAGE_KICKER is false, no kicker-like block must be rendered
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development" && !SHOW_PAGE_KICKER) {
      const leaked = blockRenderList.find(({ block: b }) => isKickerLikeBlock(b));
      if (leaked) {
        console.warn("[LessonViewPage] Regression: kicker-like block would be rendered; filter should have removed it.", {
          type: leaked.block.type,
          contentPreview: safeStr(leaked.block.content, "").slice(0, 60),
        });
      }
    }
    // Dev-only: log when kicker/subtitle source is present (remove after confirming fix)
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      const firstBlock = blocks[0];
      const kickerLike = firstBlock ? isKickerLikeBlock(firstBlock) : false;
      const pageHasSubtitle = !!(currentPage as any).subtitle || !!(currentPage as any).kicker || !!(currentPage as any).summary;
      if (kickerLike || pageHasSubtitle) {
        console.log("[LessonViewPage] page header fields", {
          currentPage: { pageId: currentPage.pageId, title: currentPage.title, subtitle: (currentPage as any).subtitle, kicker: (currentPage as any).kicker, summary: (currentPage as any).summary },
          firstBlock: firstBlock ? { type: firstBlock.type, contentPreview: safeStr(firstBlock.content, "").trim().slice(0, 80), isKickerLike: kickerLike } : null,
          blocksToRenderCount: blockRenderList.length,
        });
      }
    }
    const firstCheckpointBlock = blocks.find((b) => {
      if (b.type !== "checkpoint") return false;
      const qType = b.questionType === "short" ? "short" : "mcq";
      const opts = Array.isArray(b.options) ? b.options : [];
      const hasItems =
        (qType === "short" && b.prompt != null && String(b.prompt).trim().length > 0) ||
        (qType === "mcq" && opts.filter((o: any) => o != null && String(o).trim()).length >= 2);
      return hasItems;
    });
    const pageCpAny = pageCp as Record<string, unknown> | null | undefined;
    const pageCpMergedExplanation = mergeCheckpointExplanationParts({
      explanation:
        typeof pageCpAny?.explanation === "string" ? pageCpAny.explanation : undefined,
      markScheme: Array.isArray(pageCpAny?.markScheme) ? (pageCpAny.markScheme as string[]) : undefined,
    });
    const blockCpMergedExplanation = firstCheckpointBlock
      ? mergeCheckpointExplanationParts({
          explanation:
            firstCheckpointBlock.explanation != null
              ? String(firstCheckpointBlock.explanation)
              : undefined,
          markScheme: Array.isArray((firstCheckpointBlock as { markScheme?: string[] }).markScheme)
            ? (firstCheckpointBlock as { markScheme?: string[] }).markScheme
            : undefined,
        })
      : undefined;

    const checkpointData = hasPageCheckpoint
      ? {
          mode: "mcq" as const,
          prompt: safeStr(pageCp!.question, ""),
          options: (pageCp!.options || []).filter((o: any) => o != null && String(o).trim()),
          correctAnswer: safeStr(pageCp!.answer, ""),
          explanation: pageCpMergedExplanation,
          name: `checkpoint-${currentPage.pageId}`,
        }
      : firstCheckpointBlock
      ? {
          mode: (firstCheckpointBlock.questionType === "short" ? "short" : "mcq") as "mcq" | "short",
          prompt: firstCheckpointBlock.prompt ?? "Quick check",
          options: Array.isArray(firstCheckpointBlock.options) ? firstCheckpointBlock.options.filter((o: any) => o != null && String(o).trim()) : [],
          correctAnswer: safeStr(firstCheckpointBlock.correctAnswer, ""),
          explanation: blockCpMergedExplanation,
          name: `checkpoint-${currentPage.pageId}`,
        }
      : null;

    return (
      <LessonImageLightboxProvider>
      <div
        data-lesson-view="structured"
        data-layout={layoutStacked ? "mobile" : "desktop"}
        className={v12StudentPresentation ? "lesson-student-page-shell" : undefined}
        style={{
          minHeight: "100vh",
          background: layoutStacked
            ? "#fff"
            : v12StudentPresentation
              ? "#e8ecf2"
              : "linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%)",
          /* v12: less top padding so the lesson starts sooner; keep a little bottom room */
          padding: layoutStacked ? 0 : v12StudentPresentation ? "0 4px 16px" : 18,
          paddingBottom: layoutStacked && orderedPages.length > 0 ? 80 : undefined,
          fontSize: v12StudentPresentation ? undefined : BASE_FONT_SIZE,
          minWidth: 0,
          overflow: "visible" as const,
        }}
      >
        {aiToast && (
          <Toast
            message={aiToast.message}
            type={aiToast.type}
            onClose={() => setAiToast(null)}
          />
        )}
        {layoutDebugValues && (
          <div
            style={{
              position: "fixed",
              top: 80,
              left: 8,
              right: 8,
              zIndex: 9999,
              background: "#1e293b",
              color: "#f1f5f9",
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            layoutDebug: layoutStacked={String(layoutDebugValues.layoutStacked)} innerWidth={layoutDebugValues.innerWidth} vv={layoutDebugValues.visualViewportWidth} mq={String(layoutDebugValues.matchMedia)}
          </div>
        )}
        <div style={{
          /* Full width of shell — no 1750/1920px band limiting the lesson grid. */
          maxWidth: "100%",
          width: layoutStacked ? "100%" : "100%",
          margin: layoutStacked ? 0 : "0 auto",
          minWidth: 0,
          overflow: "visible" as const,
          padding: layoutStacked ? "0 16px" : 0,
        }}>
          {/* ✅ PROOF PANEL REMOVED FROM HERE */}

          <div style={{ marginBottom: v12StudentPresentation ? 6 : 12 }}>
            <Link
              to="/dashboard"
              style={{ color: "#667eea", textDecoration: "none" }}
            >
              ← Back to Dashboard
            </Link>
          </div>

          {/* [Dev] Access panel — REACT_APP_DEV_TOOLS=1 */}
          {process.env.REACT_APP_DEV_TOOLS === "1" && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                fontSize: 11,
                fontFamily: "monospace",
                color: "#334155",
              }}
              data-dev="access-panel"
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>[Dev] Access</div>
              <div>previewMode: {String(previewMode)}</div>
              <div>accessDecision: {JSON.stringify(accessDecision ?? null)}</div>
              <div>hasFullLessonAccess: {String(hasFullLessonAccess)}</div>
              <div>userType: {String(user?.userType ?? "—")}</div>
              <div>isAdmin: {String((user as any)?.isAdmin ?? "—")}</div>
              <div>adminPassActive: {String((user as any)?.adminPassActive ?? "—")}</div>
              <div>subscriptionActive: {String((user as any)?.subscriptionActive ?? "—")}</div>
            </div>
          )}

          {/* Lesson Integrity debug panel — teacher/admin only */}
          {isTeacherOrAdmin && lesson && (
            <div
              style={{
                marginBottom: v12StudentPresentation ? 8 : 16,
                padding: "12px 16px",
                borderRadius: 10,
                background: "#f0f9ff",
                border: "1px solid #bae6fd",
                fontSize: 12,
                fontFamily: "monospace",
                color: "#0c4a6e",
              }}
              data-dev="lesson-integrity-debug"
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Lesson Integrity</div>
              <div>lessonId: {lesson.id ?? "—"}</div>
              <div>topicKey: {(lesson as { topicKey?: string }).topicKey || topicKeyForBank || "—"}</div>
              <div>
                counts: pages={orderedPages.length}, blocks={orderedPages.reduce((s, p) => s + (Array.isArray(p.blocks) ? p.blocks.length : 0), 0)}, flashcards={flashcards.length}, quiz={quizQuestions.length}, assessment={Array.isArray(lesson.assessment?.questions) ? lesson.assessment.questions.length : 0}, pastPapers={Array.isArray(lesson.pastPapers) ? lesson.pastPapers.length : 0}
              </div>
            </div>
          )}

          {!hasFullLessonAccess && accessDecision?.reason === "FREE_PREVIEW" && (
            <div
              style={{
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 8,
                marginBottom: v12StudentPresentation ? 8 : 12,
                fontSize: "0.9rem",
                color: "#555",
              }}
            >
              You're viewing a free preview (first page only).
            </div>
          )}
          {!hasFullLessonAccess && (
            <div
              style={{
                marginBottom: v12StudentPresentation ? 8 : 14,
                padding: "10px 12px",
                borderRadius: 10,
                backgroundColor: "#fff7ed",
                border: "1px solid rgba(249,115,22,0.35)",
                color: "#9a3412",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>
                Upgrade to access the full lesson
              </div>
              <button
                onClick={() => navigate("/subscription")}
                style={{
                  padding: "0.4rem 0.9rem",
                  backgroundColor: "#f97316",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View plans
              </button>
            </div>
          )}

          {/* MOBILE: single-column block layout, no grid, no sidebars. DESKTOP: 3-column grid; sticky sidebars: App.css (min-width: 900px) */}
          <div
            data-lesson-presentation={v12StudentPresentation ? "v12" : "legacy"}
            className="lesson-view-three-col"
            style={
              layoutStacked
                ? { display: "block", width: "100%", maxWidth: "100%", minWidth: 0 }
                : {
                    display: "grid",
                    /* V12: stable side rails + centered band — avoids ultra-wide stretch and fake gutters */
                    gridTemplateColumns: v12StudentPresentation
                      ? "minmax(180px, 220px) minmax(0, 1fr) minmax(180px, 220px)"
                      : "260px minmax(0, 1fr) 280px",
                    gap: v12StudentPresentation ? 2 : 4,
                    alignItems: "start",
                    alignContent: "start",
                    minWidth: 0,
                    width: "100%",
                    maxWidth: v12StudentPresentation ? "1400px" : undefined,
                    margin: v12StudentPresentation ? "0 auto" : undefined,
                    boxSizing: "border-box" as const,
                    overflow: "visible" as const,
                  }
            }
          >
            {/* LEFT SIDEBAR — desktop only */}
            {!layoutStacked && (
            <aside
              className={[
                "lesson-left-sidebar",
                v12StudentPresentation ? "lesson-student-sidebar--v12" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                background: "white",
                borderRadius: 14,
                padding: 14,
                boxShadow: v12StudentPresentation
                  ? "0 1px 10px rgba(15,23,42,0.05)"
                  : "0 6px 18px rgba(0,0,0,0.06)",
                border: v12StudentPresentation
                  ? "1px solid #e8ecf1"
                  : "2px solid rgba(59,130,246,0.35)",
                textAlign: "left",
                minWidth: 0,
              }}
            >
              <div
                style={{ fontWeight: "bold", color: "#111827", marginBottom: 6 }}
              >
                {lesson.subject || "Subject"}
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "0.95rem",
                  marginBottom: 10,
                }}
              >
                {lesson.level || "Level"}
                {lesson.examBoardName ? ` · ${lesson.examBoardName}` : ""}
              </div>

              <div
                style={{ fontWeight: "bold", marginBottom: 8, color: "#111827" }}
              >
                {lesson.topic || "Topic"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orderedPages.map((p, idx) => {
                  const isCurrent = idx === currentPageIndex;
                  const isCompleted = idx < currentPageIndex;
                  const icon = isCurrent ? "→" : isCompleted ? "✔" : "○";

                  return (
                    <button
                      key={p.pageId || idx}
                      type="button"
                      className={
                        v12StudentPresentation ? "lesson-student-nav-page" : undefined
                      }
                      data-current={v12StudentPresentation ? (isCurrent ? "true" : "false") : undefined}
                      onClick={() => goToPage(p)}
                      style={{
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: 10,
                        border: v12StudentPresentation
                          ? "1px solid #e5e7eb"
                          : "2px solid rgba(59,130,246,0.25)",
                        background: isCurrent
                          ? v12StudentPresentation
                            ? "#f8fafc"
                            : "#eef2ff"
                          : "white",
                        cursor: "pointer",
                        color: "#111827",
                        fontWeight: isCurrent ? 800 : 600,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ width: 18, textAlign: "center" }}>
                        {icon}
                      </span>
                      <span style={{ flex: 1 }}>
                        {p.title || `Page ${p.order}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className={
                  v12StudentPresentation ? "lesson-student-progress-block" : undefined
                }
                style={{ marginTop: 14 }}
              >
                <div
                  style={{
                    fontWeight: v12StudentPresentation ? 600 : "bold",
                    marginBottom: 6,
                    color: v12StudentPresentation ? "#64748b" : "#111827",
                    fontSize: v12StudentPresentation ? "0.8125rem" : undefined,
                    letterSpacing: v12StudentPresentation ? "0.04em" : undefined,
                    textTransform: v12StudentPresentation
                      ? ("uppercase" as const)
                      : undefined,
                  }}
                >
                  Progress
                </div>
                <div
                  className={
                    v12StudentPresentation ? "lesson-student-progress-track" : undefined
                  }
                  style={{
                    height: 10,
                    background: "#e5e7eb",
                    borderRadius: 999,
                    overflow: "hidden",
                    border: v12StudentPresentation
                      ? "1px solid #e2e8f0"
                      : "2px solid rgba(59,130,246,0.20)",
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      background: "#48bb78",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: "#6b7280",
                    fontSize: "0.95rem",
                  }}
                >
                  {progressCount} of {orderedPages.length} pages
                </div>
              </div>
            </aside>
            )}

            {/* MAIN CONTENT CARD — mobile: clean article flow; desktop: card */}
            <main style={{ order: layoutStacked ? 1 : undefined, minWidth: 0, width: "100%", maxWidth: "100%" }}>
              <div className="lesson-focus-container">
              <div
                className={
                  v12StudentPresentation
                    ? "lesson-student-main-card lesson-student-section"
                    : undefined
                }
                data-v12-student={v12StudentPresentation ? "true" : undefined}
                data-lesson-presentation={v12StudentPresentation ? "v12" : undefined}
                style={{
                  background: "white",
                  borderRadius: layoutStacked ? 0 : 16,
                  padding: v12StudentPresentation
                    ? layoutStacked
                      ? 20
                      : 36
                    : layoutStacked
                      ? 16
                      : 28,
                  maxWidth: "100%",
                  width: "100%",
                  minWidth: 0,
                  margin: layoutStacked ? 0 : "0 auto",
                  boxSizing: "border-box",
                  /* V12+desktop: flat inside .lesson-focus-container — shadow removed in lessonStudentView.css */
                  boxShadow: layoutStacked
                    ? "none"
                    : v12StudentPresentation
                      ? "none"
                      : "0 10px 28px rgba(0,0,0,0.08)",
                  border: layoutStacked
                    ? "none"
                    : v12StudentPresentation
                      ? "1px solid #e5e7eb"
                      : "3px solid rgba(59,130,246,0.45)",
                  textAlign: "left",
                  ...(v12StudentPresentation
                    ? {}
                    : { fontSize: BASE_FONT_SIZE, lineHeight: 1.8 }),
                  display: "block" as const,
                }}
              >
                <div
                  className={
                    v12StudentPresentation ? "lesson-student-page-chrome" : undefined
                  }
                >
                {/* ✅ Header fix: Lesson title is the main title; page title is secondary */}
                <div
                  className={v12StudentPresentation ? "lesson-student-header" : undefined}
                  style={{ marginBottom: v12StudentPresentation ? 10 : 14, textAlign: "left" }}
                >
                  <h1
                    className={[
                      v12StudentPresentation ? "lesson-student-title" : "",
                      lessonTitleDisplay.kind === "split" ? "lesson-view-title-split" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      v12StudentPresentation
                        ? { margin: 0, textAlign: "left" as const }
                        : {
                            margin: 0,
                            color: "#111827",
                            textAlign: "left",
                            fontSize: layoutStacked ? "1.75rem" : "2.4rem",
                            fontWeight: 950 as any,
                            lineHeight: 1.15,
                            letterSpacing: "-0.02em",
                          }
                    }
                  >
                    {lessonTitleDisplay.kind === "split" ? (
                      <>
                        <span className="lesson-title-prefix">{lessonTitleDisplay.prefix}</span>
                        <span className="lesson-title-main">{lessonTitleDisplay.mainTitle}</span>
                      </>
                    ) : (
                      lesson.title
                    )}
                  </h1>
                  <div
                    className={v12StudentPresentation ? "lesson-student-meta" : undefined}
                    style={{
                      color: "#6b7280",
                      marginTop: v12StudentPresentation ? 6 : 8,
                      fontSize: v12StudentPresentation ? "0.9375rem" : "1rem",
                      textAlign: "left",
                    }}
                  >
                    {lesson.topic} · {lesson.level}
                    {lesson.examBoardName ? ` · ${lesson.examBoardName}` : ""}
                  </div>

                  {lesson?.description && (() => {
                    const cleanedDesc = stripMediaFromDescription(lesson.description);
                    if (!cleanedDesc) return null;
                    return (
                      <div
                        className={v12StudentPresentation ? "lesson-student-blurb" : undefined}
                        style={{
                          marginTop: 12,
                          borderRadius: 6,
                          border: v12StudentPresentation ? "none" : "1px solid #e5e7eb",
                          background: v12StudentPresentation ? "transparent" : "#f9fafb",
                          padding: v12StudentPresentation ? 0 : 12,
                          fontSize: v12StudentPresentation ? "1rem" : "0.875rem",
                          lineHeight: v12StudentPresentation ? 1.65 : undefined,
                          color: "#1f2937",
                        }}
                      >
                        {!v12StudentPresentation ? (
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>What you&apos;ll learn</div>
                        ) : null}
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {cleanedDesc.length > 400
                            ? `${cleanedDesc.slice(0, 400)}…`
                            : cleanedDesc}
                        </div>
                      </div>
                    );
                  })()}

                  <h2
                    className={v12StudentPresentation ? "lesson-student-page-heading" : undefined}
                    style={
                      v12StudentPresentation
                        ? { margin: "12px 0 0", textAlign: "left" as const }
                        : {
                            margin: "16px 0 0",
                            color: "#111827",
                            textAlign: "left",
                            fontSize: layoutStacked ? "1.4rem" : "2.0rem",
                            fontWeight: 900,
                            lineHeight: 1.2,
                          }
                    }
                  >
                    {currentPage.title || `Page ${currentPageIndex + 1}`}
                  </h2>
                  {/* Page kicker: hero caption not rendered (SHOW_PAGE_KICKER is false). Same caption in renderHero. */}
                </div>

                {curriculumConfidence && (
                  <div>
                    <h3>Curriculum Coverage</h3>
                    <p>✔ DfE GCSE {(curriculumConfidence as any).subject}</p>
                    <p>✔ {(curriculumConfidence as any).board} ({(curriculumConfidence as any).specVersion})</p>
                    <h3>Review</h3>
                    <p>
                      Reviewed by: {(curriculumConfidence as any).review?.reviewedBy?.name}
                      {" "}({(curriculumConfidence as any).review?.reviewedBy?.experienceYears} yrs)
                    </p>
                    <h3>Provenance</h3>
                    <p>AI-assisted, human-approved</p>
                  </div>
                )}

                {renderHero(currentPage.hero)}

                {/* ✅ Visual (changes per page) */}
                {renderVisualBox()}

                {/* Deeper knowledge toggle */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: v12StudentPresentation ? 0 : 10,
                  }}
                >
                  <button
                    type="button"
                    className={v12StudentPresentation ? "lesson-student-deeper-toggle" : undefined}
                    onClick={() => setShowDeeperKnowledge((v) => !v)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: v12StudentPresentation
                        ? "1px solid #e2e8f0"
                        : "2px solid rgba(124,58,237,0.25)",
                      background: showDeeperKnowledge
                        ? v12StudentPresentation
                          ? "#f1f5f9"
                          : "rgba(124,58,237,0.10)"
                        : "white",
                      cursor: "pointer",
                      fontWeight: v12StudentPresentation ? 600 : 900,
                      color: v12StudentPresentation ? "#334155" : "#5b21b6",
                    }}
                  >
                    {showDeeperKnowledge ? "Hide deeper knowledge" : "Show deeper knowledge"}
                  </button>
                </div>
                </div>

                {/* Blocks — checkpoint rendered via LessonCheckpoint below. PR-006.1: id=block-{idx} uses original block index for citation deep links. */}
                <div
                  className={
                    v12StudentPresentation ? "lesson-student-page-body" : undefined
                  }
                >
                  <KeywordGlossaryProvider
                    flashcards={glossaryFlashcardsForLesson}
                    topicKey={topicKeyForBank}
                    specKey={specKey ? String(specKey) : null}
                    glossaryIndexItems={lessonHighlightKeywords}
                  >
                  {v12StudentPresentation
                    ? chunkBlocksForTeachingLayout(blockRenderList).map((chunk, chunkIdx) => (
                        <LessonStudentChunk
                          key={`lesson-section-${chunkIdx}`}
                          chunk={chunk}
                          renderBlockRow={({ block: b, idx }) => (
                            <div key={idx} id={`block-${idx}`}>
                              <LessonStudentBlockRenderer
                                block={b as any}
                                blockIndex={idx}
                                markdownComponents={markdownComponents as any}
                                stripVideoMarkdown={stripVideoMarkdown}
                                maybeParseKeywordsFromText={maybeParseKeywordsFromText}
                                renderDiagramBlock={renderDiagramBlock}
                                enableMarkdownMediaSplit={v12StudentPresentation}
                                highlightKeywords={lessonHighlightKeywords}
                                lessonTitleForAi={lesson ? safeStr(lesson.title, "") : undefined}
                                levelForAi={lesson ? safeStr(lesson.level, "") : undefined}
                                subjectForAi={lesson ? safeStr(lesson.subject, "") : undefined}
                              />
                              {user && id && (
                                <div style={{ marginTop: 6, fontSize: 12 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReportBlockId(String(idx));
                                      setShowReportModal(true);
                                    }}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#94a3b8",
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      padding: 0,
                                    }}
                                  >
                                    Report issue with this block
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        />
                      ))
                    : blockRenderList.map(({ block: b, idx }) => {
                        const blockKind = resolveLessonDisplayBlockType(b);
                        return (
                        <div key={idx} id={`block-${idx}`}>
                          {blockKind === "diagram" ? (
                            renderDiagramBlock(b, idx)
                          ) : blockKind === "selfCheck" ? (
                            <InlineSelfCheckBlock
                              prompt={safeStr(b.prompt, "")}
                              questionType={b.questionType === "short" ? "short" : "mcq"}
                              options={Array.isArray(b.options) ? b.options : []}
                              correctAnswer={safeStr(b.correctAnswer, "")}
                              explanation={safeStr(b.explanation, "")}
                              presentation={v12StudentPresentation ? "v12" : "default"}
                            />
                          ) : blockKind === "interactiveSequence" ? (
                            <InteractiveSequenceBlock
                              blockTitle={safeStr(b.title, "")}
                              intro={safeStr(b.intro, "")}
                              steps={(() => {
                                const rawSeq = Array.isArray(b.sequenceSteps)
                                  ? b.sequenceSteps
                                  : Array.isArray((b as { steps?: unknown }).steps)
                                    ? (b as { steps: unknown[] }).steps
                                    : [];
                                return rawSeq.map((s: any) => {
                                  const sid = typeof s?.id === "string" ? String(s.id).trim() : "";
                                  return {
                                    ...(sid ? { id: sid.slice(0, 64) } : {}),
                                    title: String(s?.title ?? ""),
                                    description: String(s?.description ?? ""),
                                    imageUrl: String(s?.imageUrl ?? ""),
                                    caption: String(s?.caption ?? ""),
                                  };
                                });
                              })()}
                              resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                            />
                          ) : blockKind === "interactiveDiagram" ? (
                            <InteractiveDiagramBlock
                              blockTitle={safeStr(b.title, "")}
                              intro={safeStr(b.intro, "")}
                              imageUrl={safeStr(b.imageUrl, "")}
                              hotspots={(Array.isArray(b.hotspots) ? b.hotspots : []).map((h, i) =>
                                normalizeInteractiveDiagramHotspot(h, i)
                              )}
                              resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                              lessonTitle={lesson ? safeStr(lesson.title, "") : undefined}
                              level={lesson ? safeStr(lesson.level, "") : undefined}
                              subject={lesson ? safeStr(lesson.subject, "") : undefined}
                            />
                          ) : blockKind === "dragDropMatch" ? (
                            <DragDropMatchBlock
                              block={{
                                title: safeStr(b.title, ""),
                                intro: safeStr(b.intro, ""),
                                instructions: safeStr(b.instructions, ""),
                                pairs: (Array.isArray(b.pairs) ? b.pairs : []).map((p, i) => ({
                                  id: String(p?.id ?? "").trim() || `p${i}`,
                                  prompt: String(p?.prompt ?? ""),
                                  answer: String(p?.answer ?? ""),
                                  explanation: p?.explanation != null ? String(p.explanation) : undefined,
                                })),
                              }}
                            />
                          ) : (
                            renderCallout(b.type, safeStr(b.content, ""), idx)
                          )}
                          {user && id && (
                            <div style={{ marginTop: 6, fontSize: 12 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setReportBlockId(String(idx));
                                  setShowReportModal(true);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#94a3b8",
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  padding: 0,
                                }}
                              >
                                Report issue with this block
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                  </KeywordGlossaryProvider>
                </div>

                {/* PR-UX-LESSON-3: Single checkpoint per page — one component, unified styling */}
                {checkpointData && (
                  <div
                    className={
                      v12StudentPresentation
                        ? "lesson-student-checkpoint-section"
                        : undefined
                    }
                  >
                    <LessonCheckpoint
                      mode={checkpointData.mode}
                      prompt={checkpointData.prompt}
                      options={checkpointData.options}
                      correctAnswer={checkpointData.correctAnswer}
                      explanation={checkpointData.explanation}
                      name={checkpointData.name}
                      lessonId={id ?? undefined}
                      pageId={typeof currentPage.pageId === "string" ? currentPage.pageId : undefined}
                      entitled={Boolean(accessDecision?.allowed)}
                      presentation={v12StudentPresentation ? "v12" : "default"}
                    />
                    {user && id && (
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setReportBlockId("checkpoint");
                            setShowReportModal(true);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94a3b8",
                            cursor: "pointer",
                            textDecoration: "underline",
                            padding: 0,
                          }}
                        >
                          Report issue with this question
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* SS2: Inline Prev/Next removed; use bottom nav (LessonPrevNextBar) only */}

                {/* Step 4 RAG + Step 5 Summarise (when user has access) */}
                {id && accessDecision?.allowed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <SummariseLesson lessonId={id} lessonTitle={lesson?.title} />
                    </div>
                  </div>
                )}

                {/* Preview / paywall — subscription (no coin unlock) */}
                {!hasFullLessonAccess && (
                  <div
                    style={{
                      marginTop: "32px",
                      padding: "24px",
                      borderRadius: "14px",
                      backgroundColor: "#fff7ed",
                      border: "2px solid rgba(249,115,22,0.40)",
                      boxShadow: "0 4px 12px rgba(249,115,22,0.15)",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        color: "#9a3412",
                      }}
                    >
                      Get full access
                    </h3>
                    <p
                      style={{
                        margin: "0 0 8px 0",
                        fontSize: "1rem",
                        color: "#7c2d12",
                        lineHeight: 1.6,
                      }}
                    >
                      You&apos;re viewing a free preview. Upgrade to access all pages, flashcards, and quizzes.
                    </p>
                    <p
                      style={{
                        margin: "0 0 20px 0",
                        fontSize: "0.95rem",
                        color: "#9a3412",
                        lineHeight: 1.5,
                      }}
                    >
                      Full access is included in your subscription.
                    </p>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <Link
                        to="/subscription"
                        style={{
                          padding: "12px 24px",
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: "#f97316",
                          color: "white",
                          fontSize: "1rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-block",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#ea580c";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#f97316";
                        }}
                      >
                        Upgrade to access
                      </Link>
                    </div>
                  </div>
                )}

                {/* PR-005: Ask AI about this topic — teacher/admin only */}
                {isTeacherOrAdmin && specKey && (topicKeyForBank || (lesson as { topicKey?: string })?.topicKey) && (
                  <AskAiPanel
                    specKey={specKey}
                    topicKey={topicKeyForBank || (lesson as { topicKey?: string }).topicKey || ""}
                    lessonId={id || undefined}
                    suppressAutoScroll={isPreviewEntry || previewEntrySuppressScroll || suppressAskAiScrollOnMount}
                  />
                )}
                {/* PR-007: Student Ask AI — same taxonomy gates as teacher (spec + topic) */}
                {isStudent && specKey && studentTutorTopicKey && (
                  <AskAiStudentPanel
                    specKey={specKey}
                    topicKey={studentTutorTopicKey}
                    lessonId={id || undefined}
                    suppressAutoScroll={isPreviewEntry || previewEntrySuppressScroll || suppressAskAiScrollOnMount}
                  />
                )}
                {/* PR-038: Today's study plan — student only */}
                {isStudent && specKey && (
                  <StudyPlanPanel specKey={specKey} currentLessonId={id} />
                )}

                {/* Testing section: Quick Quiz, Practice papers, Practice questions, Flashcards — only after final page */}
                {isLastPage && (
                <>
                {/* Page Quiz — page-aware in structured view */}
                <Section title="Quiz Page" variant="card">
                  <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#6b7280" }}>Short questions for this lesson page.</p>
                  {!hasFullLessonAccess ? (
                    <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
                      Quiz available with full access (included in your subscription).
                    </div>
                  ) : pageQuizQuestions.length === 0 && endOfLessonQuizQuestions.length === 0 ? (
                    <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
                      {isTeacherOrAdmin ? (
                        id ? (
                          <>No page quiz questions yet. Add them in <Link to={`/edit-lesson/${id}#quiz`} style={{ color: "#2563eb", fontWeight: 600 }}>Edit Lesson → Quiz</Link>.</>
                        ) : (
                          <>No page quiz questions yet. Add them in Edit Lesson → Attach Quiz Page From Question Bank.</>
                        )
                      ) : (
                        <>No page quiz questions yet.</>
                      )}
                    </div>
                  ) : (
                    <>
                      {pageQuizQuestions.length === 0 ? (
                        <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
                          {isTeacherOrAdmin ? (
                            id ? (
                              <>No page quiz questions yet. Add them in <Link to={`/edit-lesson/${id}#quiz`} style={{ color: "#2563eb", fontWeight: 600 }}>Edit Lesson → Quiz</Link>.</>
                            ) : (
                              <>No page quiz questions yet. Add them in Edit Lesson → Attach Quiz Page From Question Bank.</>
                            )
                          ) : (
                            <>No page quiz questions yet.</>
                          )}
                        </div>
                      ) : (
                        <div>
                          <QuizView
                            title=""
                            questions={pageQuizQuestions.map((raw: any, idx: number) => normalizeQuizQuestion(raw, idx))}
                            onQuestionAnswered={topicKeyForBank && isStudent ? handleQuestionAnswered : undefined}
                            onContinueLesson={() => window.scrollBy({ top: 400, behavior: "smooth" })}
                          />
                        </div>
                      )}
                      {endOfLessonQuizQuestions.length > 0 && (
                        <div style={{ marginTop: 24 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>End of Lesson Test</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>Topic-bank questions for this sub-topic</div>
                          <QuizView
                            title=""
                            questions={endOfLessonQuizQuestions.map((raw: any, idx: number) => normalizeQuizQuestion(raw, idx))}
                            onQuestionAnswered={topicKeyForBank && isStudent ? handleQuestionAnswered : undefined}
                            onContinueLesson={() => window.scrollBy({ top: 400, behavior: "smooth" })}
                          />
                        </div>
                      )}
                    </>
                  )}
                </Section>

                {/* PR — Adaptive Testing Loop: adaptive feedback based on quiz mastery */}
                {isStudent && topicKeyForBank && masteryData && (
                  <AdaptiveFeedbackCard
                    masteryScore={masteryData.masteryScore}
                    topicKey={topicKeyForBank}
                    hasAttempts={masteryData.attempts > 0}
                    onReviewFlashcards={() => {
                      setShowFlashcards(true);
                      setTimeout(() => flashcardsViewerRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                    }}
                    onTryMorePractice={() => setPracticeSeedCounter((c) => c + 1)}
                    onReviewContent={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                    onShowDiagram={() => {
                      document.getElementById("lesson-visual")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                )}

                {/* Lane B: Practice papers (full papers attached to lesson) */}
                {attachedPapersSummaries.length > 0 && (
                  <Section title="Practice papers" variant="plain">
                    <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151" }}>
                      Full papers linked to this lesson. Start when you&apos;re ready.
                    </p>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      {attachedPapersSummaries.map((p) => (
                        <li key={p._id}>
                          <Link
                            to={`/assessments/papers/${p._id}/start`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "10px 14px",
                              borderRadius: 8,
                              border: "1px solid #e5e7eb",
                              background: "#f8fafc",
                              color: "#1e293b",
                              textDecoration: "none",
                              fontWeight: 600,
                              fontSize: 14,
                            }}
                          >
                            {p.title} · {p.kind.replace(/_/g, " ")} · {p.questionCount} questions
                            {p.timeSeconds ? ` · ${Math.round(p.timeSeconds / 60)} min` : ""} → Start
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Section>
                )}

                {/* PR3b: Practice questions (single source — examQuestions or embedded assessment) */}
                <PracticeSection
                  practiceLoading={practiceLoading}
                  practiceError={practiceError}
                  practiceQuestions={effectivePractice.questions}
                  practiceAllowed={practiceAllowed}
                  lessonId={id || undefined}
                  practiceSource={effectivePractice.source}
                  topicKey={topicKeyForBank || undefined}
                  onTryAnotherSet={() => setPracticeSeedCounter((c) => c + 1)}
                  onLoadBankOnly={loadBankOnly}
                  hidePracticeStructuralLabels={v12StudentPresentation}
                />

                {isStudent && (
                  <ExamPracticeSection
                    loading={examPracticeLoading}
                    error={examPracticeError}
                    questions={examPracticeQuestions}
                    practiceAllowed={practiceAllowed}
                    lessonId={id || undefined}
                  />
                )}

                {/* PR-CONTENT-TARGETING-1: warn when lesson has no valid topic mapping */}
                {lesson && !topicKeyForBank && (
                  <div
                    style={{
                      marginBottom: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "#fef3c7",
                      border: "1px solid #f59e0b",
                      color: "#92400e",
                      fontSize: 13,
                    }}
                  >
                    This lesson isn&apos;t mapped to a syllabus subtopic yet, so flashcards and practice can&apos;t be generated.
                  </div>
                )}
                {/* PR-FE-FLASHCARDS-COLLAPSE-1: Flashcards collapsed by default; button expands viewer */}
                <Section
                  title="Flashcards"
                  right={isTeacherOrAdmin ? (
                      <button
                        onClick={handleAIGenerate}
                        disabled={isGenerating || !topicKeyForBank}
                        title={!topicKeyForBank ? "This lesson isn't mapped to a syllabus subtopic yet." : undefined}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "10px",
                          border: "2px solid #10b981",
                          background: isGenerating || !topicKeyForBank ? "#e5e7eb" : "#10b981",
                          color: "white",
                          cursor: isGenerating || !topicKeyForBank ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                          fontSize: "14px"
                        }}
                      >
                        {isGenerating ? "Generating..." : "Generate revision with AI"}
                      </button>
                    ) : undefined}
                  variant="plain"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* PR-FE-REVIEWS-COLLAPSE-1: SS2-style inline row: Test learning with + Flashcards pill + Finished? + Student reviews pill */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 14, color: "#374151" }}>Test learning with:</span>
                      <button
                        type="button"
                        onClick={() => setShowFlashcards((v) => !v)}
                        disabled={flashcards.length === 0}
                        style={{
                          padding: "10px 18px",
                          borderRadius: 999,
                          border: "1px solid #8b5cf6",
                          background: flashcards.length === 0 ? "#f3f4f6" : showFlashcards ? "#ede9fe" : "#8b5cf6",
                          color: flashcards.length === 0 ? "#9ca3af" : showFlashcards ? "#5b21b6" : "white",
                          cursor: flashcards.length === 0 ? "not-allowed" : "pointer",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {showFlashcards ? "Hide flashcards" : "Flashcards"}
                      </button>
                      {flashcards.length > 0 && !showFlashcards && (
                        <span style={{ fontSize: 13, color: "#6b7280", opacity: 0.8 }}>{flashcards.length} cards available</span>
                      )}
                      {flashcards.length === 0 && (
                        <span style={{ fontSize: 13, color: "#9ca3af" }}>No flashcards available</span>
                      )}
                      {isLastPage && (
                        <span style={{ marginLeft: "auto", opacity: 0.9, fontSize: 14, color: "#64748b" }}>
                          Finished the lesson? See what other students thought.
                        </span>
                      )}
                      {isLastPage && (
                        <button
                          type="button"
                          onClick={() => setShowReviews((v) => !v)}
                          style={{
                            padding: "10px 18px",
                            borderRadius: 999,
                            border: "1px solid #48bb78",
                            background: showReviews ? "#c6f6d5" : "#48bb78",
                            color: showReviews ? "#22543d" : "white",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          {showReviews ? "Hide reviews" : "Student reviews"}
                        </button>
                      )}
                    </div>
                    {showFlashcards && (
                      <div ref={flashcardsViewerRef} style={{ display: "grid", gap: "16px" }}>
                        {process.env.REACT_APP_DEV_TOOLS === "1" && (
                          <div
                            style={{
                              padding: "10px 12px",
                              borderRadius: 8,
                              background: "#f0f9ff",
                              border: "1px solid #bae6fd",
                              fontSize: 12,
                              fontFamily: "monospace",
                              color: "#0c4a6e",
                            }}
                            data-dev="flashcard-debug"
                          >
                            <div><strong>Flashcard debug</strong></div>
                            <div>Count from API: {flashcards.length}</div>
                            <div>Lesson ID: {id ?? "—"}</div>
                            <div>Access: {accessDecision?.reason ?? "—"}</div>
                            {flashcards.length > 0 && (
                              <div style={{ marginTop: 6 }}>
                                First 5: {flashcards.slice(0, 5).map((c: any, i: number) => (
                                  <div key={c.id ?? i}>
                                    [{String(c.id ?? c._id ?? i).slice(0, 12)}] {(c.front || "").slice(0, 40)}{(c.front && c.front.length > 40) ? "…" : ""}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {isTeacherOrAdmin && flashcards.length === 0 && topicKeyForBank ? (
                          <div style={{ marginBottom: 8 }}>
                            <button
                              type="button"
                              onClick={handleLoadFromBank}
                              disabled={loadFromBankLoading}
                              style={{
                                padding: "8px 16px",
                                borderRadius: "8px",
                                border: "1px solid #2563eb",
                                background: loadFromBankLoading ? "#e5e7eb" : "#eff6ff",
                                color: "#2563eb",
                                cursor: loadFromBankLoading ? "not-allowed" : "pointer",
                                fontWeight: 600,
                                fontSize: "14px",
                              }}
                            >
                              {loadFromBankLoading ? "Loading…" : "Load flashcards from bank"}
                            </button>
                            {loadFromBankError ? (
                              <span style={{ marginLeft: 8, fontSize: 13, color: "#dc2626" }}>{loadFromBankError}</span>
                            ) : null}
                          </div>
                        ) : null}
                        <FlashcardsView
                          title="Flashcards"
                          hideTitle
                          cards={flashcards.map((flashcard: any, i: number) => ({
                            id: flashcard.id ?? flashcard._id ?? String(i),
                            front: flashcard.front ?? flashcard.question ?? "",
                            back: flashcard.back ?? flashcard.answer ?? "",
                            difficulty: (flashcard.difficulty && [1, 2, 3].includes(flashcard.difficulty))
                              ? (flashcard.difficulty as 1 | 2 | 3)
                              : 1,
                            tags: Array.isArray(flashcard.tags) ? flashcard.tags : [],
                          }))}
                        />
                      </div>
                    )}
                    {/* PR-FE-REVIEWS-COLLAPSE-1: Student Reviews expanded only when showReviews; CTA inside expanded block */}
                    {showReviews && (
                      <div ref={reviewsRef}>
                        <Section
                          title="Student Reviews"
                          id="student-reviews"
                          right={
                            reviewsEnabled ? (
                              <button
                                onClick={() => setShowReviewForm(true)}
                                style={{
                                  padding: "10px 20px",
                                  background: "#48bb78",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontWeight: "bold",
                                }}
                              >
                                ✏️ {reviewCtaLabel}
                              </button>
                            ) : undefined
                          }
                          variant="plain"
                        >
                          {!reviewsEnabled && (
                            <div
                              style={{
                                padding: "14px",
                                borderRadius: "10px",
                                background: "#f7f7ff",
                                color: "rgba(0,0,0,0.75)",
                                border: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              Reviews are coming soon for these lessons.
                            </div>
                          )}

                          {reviewsEnabled && showReviewForm && (
                            <div style={{ marginBottom: "30px" }}>
                              <ReviewForm
                                lessonId={lesson.id}
                                onReviewSubmitted={handleReviewSubmitted}
                              />
                              <div style={{ textAlign: "right", marginTop: "10px" }}>
                                <button
                                  onClick={() => setShowReviewForm(false)}
                                  style={{
                                    padding: "8px 16px",
                                    background: "#e2e8f0",
                                    color: "#4a5568",
                                    border: "none",
                                    borderRadius: "6px",
                                    cursor: "pointer",
                                  }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}

                          {reviewsEnabled && reviewSubmitted && (
                            <div
                              style={{
                                backgroundColor: "#d4edda",
                                color: "#155724",
                                padding: "1rem",
                                borderRadius: "0.375rem",
                                marginBottom: "1.5rem",
                                border: "1px solid #c3e6cb",
                              }}
                            >
                              ✅ Thank you for your review!
                            </div>
                          )}

                          {reviewsEnabled ? <ReviewList lessonId={lesson.id} hideTitle /> : null}
                        </Section>
                      </div>
                    )}
                  </div>
                </Section>
                </>
                )}
              </div>
              </div>
            </main>

            {/* RIGHT RAIL — hidden on mobile; compact bar shows progress */}
            {!layoutStacked && (
            <aside
              className="lesson-right-sidebar"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                className={v12StudentPresentation ? "lesson-student-rail-card--v12" : undefined}
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: v12StudentPresentation
                    ? "none"
                    : "0 6px 18px rgba(0,0,0,0.06)",
                  border: v12StudentPresentation
                    ? "1px solid #e8ecf1"
                    : "2px solid rgba(59,130,246,0.25)",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontWeight: v12StudentPresentation ? 600 : "bold",
                    marginBottom: 6,
                    color: v12StudentPresentation ? "#64748b" : "#111827",
                    fontSize: v12StudentPresentation ? "0.8125rem" : undefined,
                    letterSpacing: v12StudentPresentation ? "0.04em" : undefined,
                    textTransform: v12StudentPresentation
                      ? ("uppercase" as const)
                      : undefined,
                  }}
                >
                  Topic progress
                </div>
                <div style={{ color: "#6b7280" }}>
                  Page {currentPageIndex + 1} of {orderedPages.length}
                </div>
              </div>
            </aside>
            )}
          </div>

          {/* Mobile: compact sticky progress/navigation bar — both elements always visible, no horizontal scroll */}
          {layoutStacked &&
            orderedPages.length > 0 &&
            createPortal(
              <div
                data-lesson-presentation={v12StudentPresentation ? "v12" : "legacy"}
                style={{
                  position: "fixed",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 9999,
                  background: "white",
                  borderTop: v12StudentPresentation
                    ? "1px solid #e8ecf1"
                    : "2px solid rgba(59,130,246,0.35)",
                  boxShadow: v12StudentPresentation
                    ? "0 -2px 14px rgba(15,23,42,0.06)"
                    : "0 -4px 12px rgba(0,0,0,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  maxWidth: "100vw",
                  boxSizing: "border-box",
                  padding: "12px 16px",
                  paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>
                    Page {currentPageIndex + 1} of {orderedPages.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobilePagesDrawer(true)}
                  style={{
                    flexShrink: 0,
                    marginLeft: 12,
                    minHeight: 44,
                    padding: "10px 18px",
                    background: "#eef2ff",
                    border: "2px solid rgba(59,130,246,0.35)",
                    borderRadius: 10,
                    fontWeight: 700,
                    color: "#3730a3",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Pages
                </button>
              </div>,
              document.body
            )}

          {/* Mobile: Pages drawer — rendered via portal so always on top */}
          {layoutStacked &&
            showMobilePagesDrawer &&
            orderedPages.length > 0 &&
            createPortal(
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Lesson pages"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 10000,
                  background: "rgba(0,0,0,0.4)",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                }}
                onClick={() => setShowMobilePagesDrawer(false)}
              >
                <div
                  style={{
                    background: "white",
                    width: "100%",
                    maxHeight: "70vh",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    boxShadow: "0 -8px 24px rgba(0,0,0,0.15)",
                    padding: "20px 16px",
                    paddingBottom: "max(32px, env(safe-area-inset-bottom, 0px))",
                    overflowY: "auto",
                    flexShrink: 0,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>Lesson pages</h3>
                    <button
                      type="button"
                      onClick={() => setShowMobilePagesDrawer(false)}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        background: "none",
                        border: "none",
                        fontSize: 24,
                        cursor: "pointer",
                        color: "#6b7280",
                        padding: 4,
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {orderedPages.map((p, idx) => {
                      const isCurrent = idx === currentPageIndex;
                      const isCompleted = idx < currentPageIndex;
                      const icon = isCurrent ? "→" : isCompleted ? "✔" : "○";
                      return (
                        <button
                          key={p.pageId || idx}
                          onClick={() => {
                            goToPage(p);
                            setShowMobilePagesDrawer(false);
                            // Scroll to top after drawer closes and content re-renders (mobile: students see change)
                            setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 150);
                          }}
                          style={{
                            minHeight: 48,
                            textAlign: "left",
                            padding: "14px 16px",
                            borderRadius: 10,
                            border: "2px solid rgba(59,130,246,0.25)",
                            background: isCurrent ? "#eef2ff" : "white",
                          cursor: "pointer",
                          color: "#111827",
                          fontWeight: isCurrent ? 800 : 600,
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ width: 24, textAlign: "center", fontSize: 16 }}>{icon}</span>
                        <span style={{ flex: 1 }}>{p.title || `Page ${p.order}`}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>,
              document.body
            )}

          {/* Report Issue — bottom of each lesson page (students + teachers) */}
          {user && id && (
            <div className="report-issue-container" style={{ paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                className="report-issue-button"
                onClick={() => {
                  setReportBlockId(null);
                  setShowReportModal(true);
                }}
              >
                🚩 Report a mistake in this lesson
              </button>
            </div>
          )}
          {showReportModal && id && (
            <ReportIssueModal
              lessonId={id}
              pageId={currentPage?.pageId ?? undefined}
              pageTitle={currentPage?.title ?? undefined}
              pageOrder={currentPageIndex >= 0 ? currentPageIndex + 1 : undefined}
              blockId={reportBlockId ?? undefined}
              onClose={() => {
                setShowReportModal(false);
                setReportBlockId(null);
              }}
              onSuccess={() => setAiToast({ message: "Thank you for your report. We'll review it shortly.", type: "success" })}
            />
          )}
          {/* PR-STUDENT-LESSON-NAV-3: SS2-style prev/next bar at bottom */}
          {specKey && topicKeyForBank && (
            <LessonPrevNextBar
              specKey={specKey}
              currentTopicKey={topicKeyForBank}
              onNavigateTopic={(key) => navigate(`/browse-lessons?topicKey=${encodeURIComponent(key)}`)}
              onBackToTopics={() => navigate("/browse-lessons")}
              className={v12StudentPresentation ? "lesson-student-prevnext" : undefined}
            />
          )}
          {/* PR-024.1: Student topic summary modal (structured view) */}
          {showTopicSummaryModal && isStudent && specKey && studentTutorTopicKey && (
            <TopicSummaryStudentModal
              specKey={specKey}
              topicKey={studentTutorTopicKey}
              lessonId={id || undefined}
              onClose={() => setShowTopicSummaryModal(false)}
            />
          )}
        </div>

      </div>
      </LessonImageLightboxProvider>
    );
  }

  // ============================
  // Legacy view (no pages)
  // ============================
  const lessonTitleDisplayLegacy = getLessonTitleDisplayParts(lesson);
  return (
    <LessonImageLightboxProvider>
    <div
      data-lesson-presentation={v12StudentPresentation ? "v12" : "legacy"}
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: layoutStacked ? "12px" : "20px",
        fontSize: BASE_FONT_SIZE,
        overflowX: "hidden",
        minWidth: 0,
      }}
    >
      {aiToast && (
        <Toast
          message={aiToast.message}
          type={aiToast.type}
          onClose={() => setAiToast(null)}
        />
      )}
      {/* ✅ PROOF PANEL REMOVED FROM LEGACY VIEW TOO */}

      <Link to="/dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
        ← Back to Dashboard
      </Link>

      {/* [Dev] Access panel renders once in structured view only (REACT_APP_DEV_TOOLS=1) */}

      {/* Lesson Integrity debug panel — teacher/admin only, dev tools or non-prod (legacy view) */}
      {isTeacherOrAdmin && (process.env.NODE_ENV !== "production" || process.env.REACT_APP_DEV_TOOLS === "1") && lesson && (
        <div
          style={{
            marginTop: 16,
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 10,
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            fontSize: 12,
            fontFamily: "monospace",
            color: "#0c4a6e",
          }}
          data-dev="lesson-integrity-debug"
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Lesson Integrity</div>
          <div>lessonId: {lesson.id ?? "—"}</div>
          <div>topicKey: {(lesson as { topicKey?: string }).topicKey || topicKeyForBank || "—"}</div>
          <div>
            counts: pages=0, blocks=0, flashcards={flashcards.length}, quiz={quizQuestions.length}, assessment={Array.isArray(lesson.assessment?.questions) ? lesson.assessment.questions.length : 0}, pastPapers={Array.isArray(lesson.pastPapers) ? lesson.pastPapers.length : 0}
          </div>
        </div>
      )}

      <div
        className={v12StudentPresentation ? "lesson-student-legacy-card" : undefined}
        style={{
          marginTop: "30px",
          background: "white",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1
              className={[
                v12StudentPresentation ? "lesson-student-page-heading" : "",
                lessonTitleDisplayLegacy.kind === "split" ? "lesson-view-title-split" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{
                marginBottom: "10px",
                color: "#111827",
                fontSize: "2.4rem",
                fontWeight: 950 as any,
                lineHeight: 1.15,
              }}
            >
              {lessonTitleDisplayLegacy.kind === "split" ? (
                <>
                  <span className="lesson-title-prefix">{lessonTitleDisplayLegacy.prefix}</span>
                  <span className="lesson-title-main">{lessonTitleDisplayLegacy.mainTitle}</span>
                </>
              ) : (
                lesson.title
              )}
            </h1>
            <p style={{ color: "#666" }}>By {lesson.teacherName}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background: lesson.isPublished ? "#d4edda" : "#fff3cd",
                color: lesson.isPublished ? "#155724" : "#856404",
                fontWeight: "bold",
                fontSize: "0.95rem",
              }}
            >
              {lesson.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div className={v12StudentPresentation ? "lesson-student-legacy-content" : undefined} style={{ marginBottom: "30px" }}>
          <h3
            style={{
              color: "#111827",
              marginBottom: "10px",
              fontSize: "1.65rem",
              fontWeight: 900,
            }}
          >
            Lesson Content
          </h3>
          <div
            className={v12StudentPresentation ? "lesson-content lesson-student-legacy-inner" : "lesson-content"}
            style={{
              background: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
              lineHeight: "1.8",
              minHeight: "200px",
              textAlign: "left",
              fontSize: BASE_FONT_SIZE,
            }}
          >
            <KeywordGlossaryProvider
              flashcards={glossaryFlashcardsForLesson}
              topicKey={topicKeyForBank}
              specKey={specKey ? String(specKey) : null}
              glossaryIndexItems={lessonHighlightKeywords}
            >
              <KeywordHighlightOnceProvider resetKey={id ?? "legacy"}>
                <LessonMarkdown className="lesson-md-body" components={lessonViewMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>
                  {preprocessMarkdownAssetUrls(stripVideoMarkdown(lesson.content || ""))}
                </LessonMarkdown>
              </KeywordHighlightOnceProvider>
            </KeywordGlossaryProvider>
          </div>
        </div>

        {/* Preview / paywall — legacy view (subscription, no coin unlock) */}
        {!hasFullLessonAccess && (
          <div
            style={{
              marginTop: "32px",
              padding: "24px",
              borderRadius: "14px",
              backgroundColor: "#fff7ed",
              border: "2px solid rgba(249,115,22,0.40)",
              boxShadow: "0 4px 12px rgba(249,115,22,0.15)",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#9a3412",
              }}
            >
              Get full access
            </h3>
            <p
              style={{
                margin: "0 0 8px 0",
                fontSize: "1rem",
                color: "#7c2d12",
                lineHeight: 1.6,
              }}
            >
              You&apos;re viewing a free preview. Upgrade to access all pages, flashcards, and quizzes.
            </p>
            <p
              style={{
                margin: "0 0 20px 0",
                fontSize: "0.95rem",
                color: "#9a3412",
                lineHeight: 1.5,
              }}
            >
              Full access is included in your subscription.
            </p>
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <Link
                to="/subscription"
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: "#f97316",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#ea580c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#f97316";
                }}
              >
                Upgrade to access
              </Link>
            </div>
          </div>
        )}

        {/* Subscribe CTA when user does not have full access */}
        {!hasFullLessonAccess && (
          <div style={{ marginTop: 16 }}>
            <SubscribeCTA lessonId={id || undefined} />
          </div>
        )}

        {/* PR-005: Ask AI about this topic — teacher/admin only */}
        {isTeacherOrAdmin && specKey && (topicKeyForBank || (lesson as { topicKey?: string })?.topicKey) && (
          <AskAiPanel
            specKey={specKey}
            topicKey={topicKeyForBank || (lesson as { topicKey?: string }).topicKey || ""}
            lessonId={id || undefined}
            suppressAutoScroll={isPreviewEntry || previewEntrySuppressScroll || suppressAskAiScrollOnMount}
          />
        )}
        {/* PR-007: Student Ask AI — same taxonomy gates as teacher panel (spec + topic); enquiry API rate-limits */}
        {isStudent && specKey && studentTutorTopicKey && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setShowTopicSummaryModal(true)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  background: "#8b5cf6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Summarise this topic
              </button>
            </div>
            <AskAiStudentPanel
              specKey={specKey}
              topicKey={studentTutorTopicKey}
              lessonId={id || undefined}
              suppressAutoScroll={isPreviewEntry || previewEntrySuppressScroll || suppressAskAiScrollOnMount}
            />
          </>
        )}
        {/* PR-038: Today's study plan — student only */}
        {isStudent && specKey && (
          <StudyPlanPanel specKey={specKey} currentLessonId={id} />
        )}

        {/* Page Quiz — gate on hasFullLessonAccess (legacy view, no pages) */}
        <Section title="Page Quiz" variant="card">
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#6b7280" }}>Short questions for this lesson page.</p>
          {!hasFullLessonAccess ? (
            <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
              Quiz available with full access (included in your subscription).
            </div>
          ) : quizQuestions.length === 0 ? (
            <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
              {isTeacherOrAdmin ? (
                id ? (
                  <>No page quiz questions yet. Add them in <Link to={`/edit-lesson/${id}#quiz`} style={{ color: "#2563eb", fontWeight: 600 }}>Edit Lesson → Quiz</Link>.</>
                ) : (
                  <>No page quiz questions yet. Add them in Edit Lesson → Attach Quiz Page From Question Bank.</>
                )
              ) : (
                <>No page quiz questions yet.</>
              )}
            </div>
          ) : (
            <>
              <QuizView
                title=""
                questions={(quizQuestions ?? []).map((raw: any, idx: number) => normalizeQuizQuestion(raw, idx))}
                onQuestionAnswered={topicKeyForBank && isStudent ? handleQuestionAnswered : undefined}
                onContinueLesson={() => window.scrollBy({ top: 400, behavior: "smooth" })}
              />
            </>
          )}
        </Section>

        {/* PR — Adaptive Testing Loop: adaptive feedback (legacy view) */}
        {isStudent && topicKeyForBank && masteryData && (
          <AdaptiveFeedbackCard
            masteryScore={masteryData.masteryScore}
            topicKey={topicKeyForBank}
            hasAttempts={masteryData.attempts > 0}
            onReviewFlashcards={() => {
              setShowFlashcards(true);
              setTimeout(() => flashcardsViewerRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }}
            onTryMorePractice={() => setPracticeSeedCounter((c) => c + 1)}
            onReviewContent={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            onShowDiagram={() => {
              document.getElementById("lesson-visual")?.scrollIntoView({ behavior: "smooth" });
            }}
          />
        )}

        {/* Lane B: Practice papers (full papers attached to lesson) */}
        {attachedPapersSummaries.length > 0 && (
          <Section title="Practice papers" variant="plain">
            <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151" }}>
              Full papers linked to this lesson. Start when you&apos;re ready.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {attachedPapersSummaries.map((p) => (
                <li key={p._id}>
                  <Link
                    to={`/assessments/papers/${p._id}/start`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#f8fafc",
                      color: "#1e293b",
                      textDecoration: "none",
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {p.title} · {p.kind.replace(/_/g, " ")} · {p.questionCount} questions
                    {p.timeSeconds ? ` · ${Math.round(p.timeSeconds / 60)} min` : ""} → Start
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* PR3b: Practice questions (entitled only) */}
        <PracticeSection
          practiceLoading={practiceLoading}
          practiceError={practiceError}
          practiceQuestions={practiceQuestions}
          practiceAllowed={practiceAllowed}
          lessonId={id || undefined}
          practiceSource={practiceSource}
          topicKey={topicKeyForBank || undefined}
          onTryAnotherSet={() => setPracticeSeedCounter((c) => c + 1)}
          onLoadBankOnly={loadBankOnly}
          hidePracticeStructuralLabels={v12StudentPresentation}
        />

        {lesson && !topicKeyForBank && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 14px",
              borderRadius: 8,
              background: "#fef3c7",
              border: "1px solid #f59e0b",
              color: "#92400e",
              fontSize: 13,
            }}
          >
            This lesson isn&apos;t mapped to a syllabus subtopic yet, so flashcards and practice can&apos;t be generated.
          </div>
        )}
        {/* PR-FE-FLASHCARDS-COLLAPSE-1: Flashcards collapsed by default; button expands viewer */}
        <Section
          title="Flashcards"
          right={isTeacherOrAdmin ? (
            <button
              onClick={handleAIGenerate}
              disabled={isGenerating || !topicKeyForBank}
              title={!topicKeyForBank ? "This lesson isn't mapped to a syllabus subtopic yet." : undefined}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "2px solid #10b981",
                background: isGenerating || !topicKeyForBank ? "#e5e7eb" : "#10b981",
                color: "white",
                cursor: isGenerating || !topicKeyForBank ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "14px"
              }}
            >
              {isGenerating ? "Generating..." : "Generate revision with AI"}
            </button>
          ) : undefined}
          variant="plain"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* PR-FE-REVIEWS-COLLAPSE-1: SS2-style inline row (legacy: single page, always show Finished? + Student reviews pill) */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, color: "#374151" }}>Test learning with:</span>
              <button
                type="button"
                onClick={() => setShowFlashcards((v) => !v)}
                disabled={flashcards.length === 0}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid #8b5cf6",
                  background: flashcards.length === 0 ? "#f3f4f6" : showFlashcards ? "#ede9fe" : "#8b5cf6",
                  color: flashcards.length === 0 ? "#9ca3af" : showFlashcards ? "#5b21b6" : "white",
                  cursor: flashcards.length === 0 ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {showFlashcards ? "Hide flashcards" : "Flashcards"}
              </button>
              {flashcards.length > 0 && !showFlashcards && (
                <span style={{ fontSize: 13, color: "#6b7280", opacity: 0.8 }}>{flashcards.length} cards available</span>
              )}
              {flashcards.length === 0 && (
                <span style={{ fontSize: 13, color: "#9ca3af" }}>No flashcards available</span>
              )}
              <span style={{ marginLeft: "auto", opacity: 0.9, fontSize: 14, color: "#64748b" }}>
                Finished the lesson? See what other students thought.
              </span>
              <button
                type="button"
                onClick={() => setShowReviews((v) => !v)}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "1px solid #48bb78",
                  background: showReviews ? "#c6f6d5" : "#48bb78",
                  color: showReviews ? "#22543d" : "white",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {showReviews ? "Hide reviews" : "Student reviews"}
              </button>
            </div>
            {showFlashcards && (
              <div ref={flashcardsViewerRef} style={{ display: "grid", gap: "16px" }}>
                {process.env.REACT_APP_DEV_TOOLS === "1" && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "#0c4a6e",
                    }}
                    data-dev="flashcard-debug"
                  >
                    <div><strong>Flashcard debug</strong></div>
                    <div>Count from API: {flashcards.length}</div>
                    <div>Lesson ID: {id ?? "—"}</div>
                    <div>Access: {accessDecision?.reason ?? "—"}</div>
                    {flashcards.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        First 5: {flashcards.slice(0, 5).map((c: any, i: number) => (
                          <div key={c.id ?? i}>
                            [{String(c.id ?? c._id ?? i).slice(0, 12)}] {(c.front || "").slice(0, 40)}{(c.front && c.front.length > 40) ? "…" : ""}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {isTeacherOrAdmin && flashcards.length === 0 && topicKeyForBank ? (
                  <div style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={handleLoadFromBank}
                      disabled={loadFromBankLoading}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "8px",
                        border: "1px solid #2563eb",
                        background: loadFromBankLoading ? "#e5e7eb" : "#eff6ff",
                        color: "#2563eb",
                        cursor: loadFromBankLoading ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: "14px",
                      }}
                    >
                      {loadFromBankLoading ? "Loading…" : "Load flashcards from bank"}
                    </button>
                    {loadFromBankError ? (
                      <span style={{ marginLeft: 8, fontSize: 13, color: "#dc2626" }}>{loadFromBankError}</span>
                    ) : null}
                  </div>
                ) : null}
                <FlashcardsView
                  title="Flashcards"
                  hideTitle
                  cards={flashcards.map((flashcard: any, i: number) => ({
                    id: flashcard.id ?? flashcard._id ?? String(i),
                    front: flashcard.front ?? flashcard.question ?? "",
                    back: flashcard.back ?? flashcard.answer ?? "",
                    difficulty: (flashcard.difficulty && [1, 2, 3].includes(flashcard.difficulty))
                      ? (flashcard.difficulty as 1 | 2 | 3)
                      : 1,
                    tags: Array.isArray(flashcard.tags) ? flashcard.tags : [],
                  }))}
                />
              </div>
            )}
            {/* PR-FE-REVIEWS-COLLAPSE-1: Student Reviews expanded only when showReviews (legacy) */}
            {showReviews && (
              <div ref={reviewsRef}>
                <Section
                  title="Student Reviews"
                  id="student-reviews"
                  right={
                    reviewsEnabled ? (
                      <button
                        onClick={() => setShowReviewForm(true)}
                        style={{
                          padding: "10px 20px",
                          background: "#48bb78",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        ✏️ {reviewCtaLabel}
                      </button>
                    ) : undefined
                  }
                  variant="plain"
                >
                  {!reviewsEnabled && (
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "#f7f7ff",
                        color: "rgba(0,0,0,0.75)",
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      Reviews are coming soon for these lessons.
                    </div>
                  )}

                  {reviewsEnabled && showReviewForm && (
                    <div style={{ marginBottom: "30px" }}>
                      <ReviewForm
                        lessonId={lesson.id}
                        onReviewSubmitted={handleReviewSubmitted}
                      />
                      <div style={{ textAlign: "right", marginTop: "10px" }}>
                        <button
                          onClick={() => setShowReviewForm(false)}
                          style={{
                            padding: "8px 16px",
                            background: "#e2e8f0",
                            color: "#4a5568",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {reviewsEnabled && reviewSubmitted && (
                    <div
                      style={{
                        backgroundColor: "#d4edda",
                        color: "#155724",
                        padding: "1rem",
                        borderRadius: "0.375rem",
                        marginBottom: "1.5rem",
                        border: "1px solid #c3e6cb",
                      }}
                    >
                      ✅ Thank you for your review!
                    </div>
                  )}

                  {reviewsEnabled ? <ReviewList lessonId={lesson.id} hideTitle /> : null}
                </Section>
              </div>
            )}
          </div>
        </Section>

        {/* PR15: Next steps (entitled only) in legacy view */}
        {!nextStepsLoading && nextSteps?.studentSummary && (
          <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid #e2e8f0", textAlign: "left" }}>
            <h2 style={{ color: "#333", fontSize: "1.65rem", margin: "0 0 16px" }}>What to do next</h2>
            <div style={{ padding: "20px 24px", borderRadius: "12px", background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0c4a6e", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {nextSteps.studentSummary}
            </div>
          </div>
        )}
        {/* Report Issue — bottom of legacy lesson (students + teachers) */}
        {user && id && (
          <div className="report-issue-container" style={{ paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              className="report-issue-button"
              onClick={() => {
                setReportBlockId(null);
                setShowReportModal(true);
              }}
            >
              🚩 Report a mistake in this lesson
            </button>
          </div>
        )}
        {showReportModal && id && (
          <ReportIssueModal
            lessonId={id}
            onClose={() => setShowReportModal(false)}
            onSuccess={() => setAiToast({ message: "Thank you for your report. We'll review it shortly.", type: "success" })}
          />
        )}
        {specKey && topicKeyForBank && (
          <LessonPrevNextBar
            specKey={specKey}
            currentTopicKey={topicKeyForBank}
            onNavigateTopic={(key) => navigate(`/browse-lessons?topicKey=${encodeURIComponent(key)}`)}
            onBackToTopics={() => navigate("/browse-lessons")}
            className={v12StudentPresentation ? "lesson-student-prevnext" : undefined}
          />
        )}
        {/* PR-024.1: Student topic summary modal */}
        {showTopicSummaryModal && isStudent && specKey && studentTutorTopicKey && (
          <TopicSummaryStudentModal
            specKey={specKey}
            topicKey={studentTutorTopicKey}
            lessonId={id || undefined}
            onClose={() => setShowTopicSummaryModal(false)}
          />
        )}
      </div>
    </div>
    </LessonImageLightboxProvider>
  );
};

export default LessonViewPage;