// frontend/src/pages/LessonViewPage.tsx
import React, { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import api, { getVisual, getVisualById } from "../services/api";

import { ReviewList, ReviewForm } from "../components/reviews";
import FlashcardsView from "../components/revision/FlashcardsView";
import { QuizView } from "../components/revision/QuizView";
import { Section } from "../components/lesson/Section";
import { LessonCheckpoint } from "../components/lesson/LessonCheckpoint";
import { SubscribeCTA } from "../components/SubscribeCTA";
import { fetchLessonById } from "../api/lessons";
import { copyBankToLesson } from "../api/flashcardBank";
import { isLessonError } from "../utils/typeGuards";
import { logPaywallEvent } from "../utils/events";
import { logAttempt } from "../utils/attempts";
import { makeAbsoluteAssetUrl } from "../utils/assetUrl";
import { AskAboutLesson } from "../components/ai/AskAboutLesson";
import { SummariseLesson } from "../components/ai/SummariseLesson";
import { NextTopicCTA } from "../components/lesson/NextTopicCTA";
import type { SpecKey } from "../api/taxonomy";

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
  type: "text" | "keyIdea" | "examTip" | "commonMistake" | "stretch" | "checkpoint" | "diagram" | "keyWords";
  content?: string;
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
  shamCoinPrice: number;

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
  /** Past papers (from topic bank snapshot) */
  pastPapers?: Array<unknown>;
}

/** PR-STUDENT-LESSON-NAV-1: Map lesson metadata to taxonomy specKey (same order as topic picker). */
function getSpecKeyFromLesson(lesson: Lesson | null): SpecKey | null {
  if (!lesson) return null;
  const board = (lesson.examBoardName || "").trim();
  if (board !== "AQA") return null;
  if ((lesson.level || "").trim() !== "GCSE") return null;
  const sub = (lesson.subject || "").trim().toLowerCase();
  if (sub === "biology") return "aqa-gcse-biology";
  if (sub === "chemistry") return "aqa-gcse-chemistry";
  if (sub === "physics") return "aqa-gcse-physics";
  if (sub === "mathematics" || sub === "maths") return "aqa-gcse-maths-higher";
  if (sub === "english") return "aqa-gcse-english-language";
  return null;
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
  shamCoins: number;
  purchasedLessons: Array<{
    lessonId: string;
    purchasedAt: string;
  }>;
  // ✅ optional (some user shapes include this; we keep it safe)
  level?: string;
  stage?: string;
  educationLevel?: string;
  academicLevel?: string;
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

function getUserLevel(u: User | null): string {
  if (!u) return "";
  const candidate =
    safeStr((u as any).level, "") ||
    safeStr((u as any).stage, "") ||
    safeStr((u as any).educationLevel, "") ||
    safeStr((u as any).academicLevel, "");
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
}: {
  visualId: string;
  caption: string;
  level: string;
  mode?: "static" | "annotated" | "step";
  annotations?: DiagramAnnotation[];
  steps?: DiagramStep[];
  makeAbsoluteAssetUrl: (url: string) => string;
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

  const boxStyle: React.CSSProperties = {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "#f8f9fa",
    border: "2px solid rgba(34,197,94,0.25)",
    boxShadow: "0 0 0 2px rgba(34,197,94,0.08)",
    textAlign: "center",
  };

  if (loading) {
    return (
      <div style={boxStyle}>
        <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Loading diagram…</div>
      </div>
    );
  }
  if (error || !src) {
    return (
      <div style={boxStyle}>
        <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>Diagram unavailable</div>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={{ position: "relative", display: "inline-block", maxWidth: 720, width: "100%" }}>
        <img
          src={src}
          alt={caption || "Diagram"}
          style={{
            width: "100%",
            maxWidth: 720,
            height: "auto",
            borderRadius: 12,
            display: "block",
            margin: "0 auto",
          }}
        />
        {showOverlay && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
              borderRadius: 12,
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
        )}
      </div>
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
      {caption ? (
        <div style={{ marginTop: 10, color: "#6b7280", fontSize: "0.95rem" }}>
          {caption}
        </div>
      ) : null}
    </div>
  );
}

// PR3b: Practice question components (entitled-only section; always show explanation after check)
function PracticeMCQQuestion({ q, lessonId }: { q: PracticeQuestionLite; lessonId?: string }) {
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
                <strong style={{ color: "#374151" }}>Explanation:</strong>
                <div style={{ marginTop: 4, color: "#4b5563", fontSize: BASE_FONT_SIZE }}>{q.explanation}</div>
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

function PracticeShortQuestion({ q, lessonId }: { q: PracticeQuestionLite; lessonId?: string }) {
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
                <strong style={{ color: "#374151" }}>Explanation:</strong>
                <div style={{ marginTop: 4, color: "#4b5563", fontSize: BASE_FONT_SIZE }}>{q.explanation}</div>
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
const TARGETED_PRACTICE_LIMIT = 6;

function TargetedPracticeSection({
  loading,
  error,
  questions,
  allowed,
  lessonId,
}: {
  loading: boolean;
  error: string | null;
  questions: PracticeQuestionLite[];
  allowed: boolean | undefined;
  lessonId: string | undefined;
}) {
  const displayQuestions = questions.slice(0, TARGETED_PRACTICE_LIMIT);

  return (
    <Section title="Targeted practice for you" variant="plain">
      {loading && (
        <p style={{ color: "#6b7280", margin: 0 }}>Loading targeted practice…</p>
      )}
      {!loading && !error && allowed !== true && (
        <>
          <p style={{ color: "#4b5563", margin: 0, marginBottom: 12 }}>
            Targeted practice is available with subscription or lesson unlock.
          </p>
          <SubscribeCTA lessonId={lessonId} />
        </>
      )}
      {!loading && !error && allowed === true && (
        <>
          {displayQuestions.length === 0 ? (
            <p style={{ color: "#6b7280", margin: 0 }}>
              No targeted questions yet — try the practice questions below.
            </p>
          ) : (
            <>
              <p style={{ color: "#6b7280", margin: "0 0 16px 0", fontSize: "0.95rem" }}>
                Based on your recent attempts.
              </p>
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
                    <PracticeMCQQuestion q={q} lessonId={lessonId} />
                  ) : (
                    <PracticeShortQuestion q={q} lessonId={lessonId} />
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
      {error && <p style={{ color: "#dc2626", margin: 0 }}>{error}</p>}
    </Section>
  );
}

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
}: {
  practiceLoading: boolean;
  practiceError: string | null;
  practiceQuestions: PracticeQuestionLite[];
  practiceAllowed: boolean | undefined;
  lessonId: string | undefined;
  practiceSource?: "attached" | "bank" | null;
  topicKey?: string;
  onTryAnotherSet?: () => void;
  onLoadBankOnly?: () => void;
}) {
  const displayQuestions = practiceQuestions.slice(0, PRACTICE_DISPLAY_LIMIT);
  const hasMore = practiceQuestions.length > PRACTICE_DISPLAY_LIMIT;
  const canTryAnother = practiceSource === "bank" && practiceQuestions.length > 0 && typeof onTryAnotherSet === "function";
  const isEmptyAttached = practiceSource === "attached" && practiceQuestions.length === 0;
  const isEmptyBank = practiceSource === "bank" && practiceQuestions.length === 0;
  const browseUrl = topicKey ? `/browse-lessons?topicKey=${encodeURIComponent(topicKey)}` : "/browse-lessons";

  const rightLabel = practiceSource === "attached" ? "From lesson" : practiceSource === "bank" ? "From question bank" : null;

  return (
    <Section
      title="Practice questions"
      id="practice"
      right={rightLabel ? <span style={{ fontSize: 12, color: "#6b7280" }}>{rightLabel}</span> : undefined}
      variant="plain"
    >
      {practiceLoading && (
        <p style={{ color: "#6b7280", margin: 0 }}>Loading practice questions…</p>
      )}
      {practiceError && (
        <p style={{ color: "#dc2626", margin: 0 }}>{practiceError}</p>
      )}
      {!practiceLoading && !practiceError && practiceAllowed !== true && (
        <>
          <p style={{ color: "#4b5563", margin: 0, marginBottom: 12 }}>
            Practice questions are available with subscription or lesson unlock.
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
                    <PracticeMCQQuestion q={q} lessonId={lessonId} />
                  ) : (
                    <PracticeShortQuestion q={q} lessonId={lessonId} />
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

const LessonViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** PR-LESSON-VIEW-FIX-1: Store API error details for teacher/dev debug display */
  const [loadErrorDetails, setLoadErrorDetails] = useState<{ status?: number; reason?: string; error?: string } | null>(null);

  // Phase B: entitlement UI state
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [accessDecision, setAccessDecision] = useState<{ allowed?: boolean; reason?: string } | null>(null);
  const loggedPreviewRef = useRef<string | null>(null);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // ✅ AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  // PR-F1: Load flashcards from bank (teacher, when lesson has none)
  const [loadFromBankLoading, setLoadFromBankLoading] = useState(false);
  const [loadFromBankError, setLoadFromBankError] = useState<string | null>(null);

  // Unlock (1 ShamCoin) flow: error message when 400 "Not enough ShamCoins"
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // ✅ Only enable legacy reviews when lessonId is a Mongo ObjectId.
  const reviewsEnabled = isMongoObjectId(id);

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

  // PR13.2: Targeted practice (misconception-driven) — entitled only
  const [targetedPracticeLoading, setTargetedPracticeLoading] = useState(false);
  const [targetedPracticeError, setTargetedPracticeError] = useState<string | null>(null);
  const [targetedPracticeQuestions, setTargetedPracticeQuestions] = useState<PracticeQuestionLite[]>([]);
  const [targetedPracticeAllowed, setTargetedPracticeAllowed] = useState<boolean | undefined>(undefined);

  // PR15: Student next steps (entitled only, from reteach plan)
  const [nextStepsLoading, setNextStepsLoading] = useState(false);
  const [nextSteps, setNextSteps] = useState<{ studentSummary: string; updatedAt: string | null } | null>(null);

  const pageParam = useMemo(() => searchParams.get("page") || "", [searchParams]);

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

  // PR-F1: topicKey for "Load flashcards from bank" (lesson.topicKey or slug from lesson.topic)
  const topicKeyForBank = useMemo(() => {
    if (!lesson) return "";
    const key = (lesson as { topicKey?: string }).topicKey;
    if (typeof key === "string" && key.trim()) return key.trim().toLowerCase();
    const t = (lesson as { topic?: string }).topic;
    if (typeof t === "string" && t.trim()) {
      return t.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    }
    return "";
  }, [lesson]);

  // PR-STUDENT-LESSON-NAV-1: specKey for NextTopicCTA (taxonomy ordering)
  const specKey = useMemo(() => getSpecKeyFromLesson(lesson), [lesson]);

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Scroll to #practice when arriving via /lesson/:id#practice
  useEffect(() => {
    if (location.hash === "#practice") {
      setTimeout(() => {
        const el = document.getElementById("practice");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    }
  }, [location.hash, id]);

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
      .get(`/lessons/${id}/practice`, { params: { limit: 10, seed: practiceSeed } })
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
  }, [id, accessDecision?.allowed, accessDecision?.reason, practiceSeed]);

  const loadBankOnly = useCallback(async () => {
    if (!id || accessDecision?.allowed !== true) return;
    setPracticeLoading(true);
    setPracticeError(null);
    try {
      const bankSeed = `${practiceSeed}:bank`;
      const res = await api.get(`/lessons/${id}/practice`, { params: { limit: 10, seed: bankSeed, mode: "bank-only" } });
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
  }, [id, accessDecision?.allowed, practiceSeed]);

  // PR13.2: Fetch targeted practice (misconception-driven) when entitled
  useEffect(() => {
    if (!id || !accessDecision || accessDecision.allowed !== true) {
      setTargetedPracticeAllowed(false);
      setTargetedPracticeQuestions([]);
      setTargetedPracticeError(null);
      return;
    }
    setTargetedPracticeLoading(true);
    setTargetedPracticeError(null);
    api
      .get<{ ok: boolean; allowed: boolean; questions: PracticeQuestionLite[] }>(`/lessons/${id}/targeted-practice`, {
        params: { days: 14, limit: 6 },
      })
      .then((res) => {
        const data = res?.data;
        setTargetedPracticeAllowed(!!data?.allowed);
        setTargetedPracticeQuestions(Array.isArray(data?.questions) ? data.questions : []);
      })
      .catch(() => {
        setTargetedPracticeAllowed(false);
        setTargetedPracticeQuestions([]);
        setTargetedPracticeError("Failed to load targeted practice.");
      })
      .finally(() => setTargetedPracticeLoading(false));
  }, [id, accessDecision?.allowed]);

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
        shamCoinPrice: Number.isFinite(Number(data.shamCoinPrice))
          ? Number(data.shamCoinPrice)
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
        pastPapers: Array.isArray(data.pastPapers) ? data.pastPapers : undefined,
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
        shamCoinPrice: 0,
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

  const fetchUserData = () => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
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

  // ✅ ADDED: AI generation handler for LessonViewPage
  const handleAIGenerate = async () => {
    if (!lesson || !lesson.id) return;
    
    setIsGenerating(true);
    try {
      await api.post(`/lessons/${lesson.id}/generate-revision`, {});
      await fetchLessonSmart(); // Refresh the lesson data
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Error generating revision content');
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

  const handlePurchase = async () => {
    if (!user || !lesson) return;

    // ✅ Legacy UUID lessons are not purchasable/viewable anymore
    if (isUuid(lesson.id)) {
      navigate("/subscription");
      return;
    }

    // Legacy Mongo purchase route (kept)
    if (user.userType !== "student") {
      alert("Only students can purchase lessons");
      return;
    }

    if (hasPurchasedLesson()) {
      alert("You have already purchased this lesson!");
      return;
    }

    if (user.shamCoins < lesson.shamCoinPrice) {
      alert(
        `You need ${lesson.shamCoinPrice} ShamCoins to purchase this lesson. You have ${user.shamCoins} ShamCoins.`
      );
      return;
    }

    if (
      !window.confirm(
        `Purchase "${lesson.title}" for ${lesson.shamCoinPrice} ShamCoins?`
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `http://localhost:5000/api/lessons/${lesson.id}/purchase`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if ((response.data as any).success === false)
        throw new Error((response.data as any).error || "Purchase failed");

      const updatedUser = (response.data as any).user || {
        ...user,
        shamCoins: (response.data as any).remainingShamCoins,
        purchasedLessons:
          (response.data as any).purchasedLessons || user.purchasedLessons,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      alert(
        `✅ Purchase successful! You now have ${updatedUser.shamCoins} ShamCoins remaining.`
      );
      fetchLessonSmart();
    } catch (error: any) {
      console.error("Purchase failed:", error);
      if (error.response?.data?.msg) alert(`❌ ${error.response.data.msg}`);
      else if (error.response?.data?.error)
        alert(`❌ ${error.response.data.error}`);
      else if (error.message) alert(`❌ ${error.message}`);
      else alert("❌ Purchase failed. Please try again.");
    }
  };

  const handleUnlock = async () => {
    if (!lesson?.id || unlocking) return;
    setUnlockError(null);
    setUnlocking(true);
    try {
      const res = await api.post(`/lessons/${lesson.id}/unlock`);
      const data = (res as any)?.data;
      if (data?.shamCoins !== undefined && data?.purchasedLessons) {
        const updatedUser = { ...user, shamCoins: data.shamCoins, purchasedLessons: data.purchasedLessons };
        setUser(updatedUser);
        try {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (_) {}
      }
      setUnlockError(null);
      await fetchLessonSmart();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.msg || "";
      if (status === 400 && msg === "Not enough ShamCoins") {
        setUnlockError("Not enough ShamCoins");
      } else {
        setUnlockError(err?.message || "Unlock failed. Please try again.");
      }
    } finally {
      setUnlocking(false);
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

  // ✅ Ensure ALL revision text is left-aligned (but we do NOT change radio layout below)
  const markdownComponents = useMemo(() => {
    const leftBlock: React.CSSProperties = { textAlign: "left" };

    const headingBase: React.CSSProperties = {
      ...leftBlock,
      color: "#111827",
      fontWeight: 900,
      lineHeight: 1.2,
      marginTop: 12,
      marginBottom: 8,
    };

    return {
      h1: ({ children, ...props }: any) => (
        <h1
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "2.4rem",
            marginTop: 10,
          }}
        >
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: any) => (
        <h2
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "2.0rem",
          }}
        >
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: any) => (
        <h3
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "1.65rem",
          }}
        >
          {children}
        </h3>
      ),
      h4: ({ children, ...props }: any) => (
        <h4
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "1.35rem",
          }}
        >
          {children}
        </h4>
      ),
      ul: ({ ...props }: any) => (
        <ul
          style={{ 
            paddingLeft: 22, 
            margin: "8px 0", 
            listStyleType: "disc",
            textAlign: "left",
            lineHeight: 1.8,
          }} 
          {...props} 
        />
      ),
      ol: ({ ...props }: any) => (
        <ol
          style={{ 
            paddingLeft: 22, 
            margin: "8px 0", 
            listStyleType: "decimal",
            textAlign: "left",
            lineHeight: 1.8,
          }} 
          {...props} 
        />
      ),
      li: ({ ...props }: any) => (
        <li
          style={{ 
            margin: "4px 0",
            textAlign: "left",
          }} 
          {...props} 
        />
      ),
      blockquote: ({ ...props }: any) => (
        <blockquote
          {...props}
          style={{
            ...(props.style || {}),
            ...leftBlock,
            borderLeft: "4px solid rgba(59,130,246,0.35)",
            paddingLeft: 12,
            marginLeft: 0,
            color: "rgba(0,0,0,0.75)",
          }}
        />
      ),
      img: ({ node, ...props }: any) => {
        const rawSrc = safeStr(props.src, "");
        const srcAbs = rawSrc ? (makeAbsoluteAssetUrl(rawSrc) ?? "") : "";
        const caption = props.title || "";

        return (
          <figure style={{ margin: "12px auto", textAlign: "center" }}>
            <img
              {...props}
              src={srcAbs || rawSrc}
              style={{
                maxWidth: "100%",
                height: "auto",
                borderRadius: 10,
                display: "block",
                margin: "0 auto",
                background: "white",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
              alt={props.alt || "Lesson image"}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {caption && (
              <figcaption
                style={{
                  marginTop: 6,
                  fontSize: "0.9rem",
                  color: "#6b7280",
                }}
              >
                {caption}
              </figcaption>
            )}
          </figure>
        );
      },
      p: ({ node, children, ...props }: any) => {
        const hasImageChild = node?.children?.some(
          (child: any) => child.tagName === "img"
        );
        
        if (hasImageChild) {
          return <>{children}</>;
        }
        
        return <p style={{ textAlign: "left" }} {...props}>{children}</p>;
      },
      a: ({ ...props }: any) => (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {props.children}
        </a>
      ),
    };
  }, []);

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
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
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
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
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
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
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
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
        </div>
      );
    }

    // PR-UX-LESSON-4: Key words callout — explicit keyWords block or text that looks like comma-separated keywords
    const keywords = kind === "keyWords" || kind === "text" ? maybeParseKeywordsFromText(text) : null;
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
    // - Text is forced left-aligned (images can still be centered)
    return (
      <div
        key={idx}
        style={{
          ...base,
          padding: "12px 14px",
          background: "#fbfbfc",
          border: "2px solid rgba(0,0,0,0.10)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.03)",
        }}
      >
        <ReactMarkdown components={markdownComponents as any}>
          {text}
        </ReactMarkdown>
      </div>
    );
  };

  const renderDiagramBlock = (block: LessonPageBlock, idx: number) => {
    const caption = block.caption ?? "";
    if (block.imageUrl) {
      const src = block.imageUrl.startsWith("http")
        ? block.imageUrl
        : (makeAbsoluteAssetUrl(block.imageUrl) ?? "");
      return (
        <div
          key={`diagram-${idx}-img`}
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            background: "#f8f9fa",
            border: "2px solid rgba(34,197,94,0.25)",
            boxShadow: "0 0 0 2px rgba(34,197,94,0.08)",
            textAlign: "center",
          }}
        >
          <img
            src={src}
            alt={block.alt ?? (caption || "Diagram")}
            style={{ width: "100%", maxWidth: 720, height: "auto", borderRadius: 12 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {caption ? (
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: "0.95rem" }}>{caption}</div>
          ) : null}
        </div>
      );
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
      />
    );
  };

  const renderHero = (hero?: LessonPageHero) => {
    const h = hero || { type: "none", src: "", caption: "" };
    const src = normalizeHeroSrc(h);

    // ✅ If there is no valid src, do NOT render the hero at all (prevents broken image icon)
    if (!h || h.type === "none" || !src) return null;

    const boxStyle: React.CSSProperties = {
      background: "#f8f9fa",
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      border: "2px solid rgba(59,130,246,0.25)",
      boxShadow: "0 0 0 2px rgba(59,130,246,0.10)",
      textAlign: "left",
    };

    const captionStyle: React.CSSProperties = {
      marginTop: 10,
      color: "#6b7280",
      fontSize: "0.95rem",
      textAlign: "center",
    };

    if (h.type === "video" || h.type === "animation") {
      return (
        <div style={boxStyle}>
          <video
            controls
            style={{ width: "100%", borderRadius: 12, background: "#000" }}
            src={src}
          />
          {h.caption ? <div style={captionStyle}>{h.caption}</div> : null}
        </div>
      );
    }

    if (h.type === "image") {
      return (
        <div style={boxStyle}>
          <img
            src={src}
            alt={h.caption || "Lesson visual"}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 12,
              display: "block",
            }}
            onError={(e) => {
              // hide broken image if URL is invalid
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {h.caption ? <div style={captionStyle}>{h.caption}</div> : null}
        </div>
      );
    }

    return null;
  };

  const renderVisualBox = () => {
    if (!visualData?.visual) return null;

    const wrapper: React.CSSProperties = {
      margin: "14px 0",
      padding: 14,
      borderRadius: 14,
      border: "2px solid rgba(0,0,0,0.10)",
      background: "#ffffff",
      textAlign: "left",
    };

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
      const srcAbs = makeAbsoluteAssetUrl((visualData.visual as any).src);
      if (!srcAbs) return null;

      return (
        <div style={wrapper}>
          <div style={headerRow}>
            <div style={badge}>📌 Visual</div>
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              (Auto-maps to the current page)
            </div>
          </div>

          <img
            src={srcAbs}
            alt={`${lesson?.topic || "Lesson"} diagram`}
            style={{ width: "100%", height: "auto", borderRadius: 12 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />

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
        <div style={wrapper}>
          <div style={headerRow}>
            <div style={badge}>📌 Visual</div>
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              Step {visualStepIndex + 1} of {steps.length}
            </div>
          </div>

          <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>
            {title}
          </div>

          <img
            src={src}
            alt={title}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 12,
              marginBottom: 10,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />

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
          Subscribe to unlock all lessons instantly.
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
  const isTeacherOrAdmin =
    user?.userType === "admin" ||
    user?.userType === "teacher" ||
    (user as any)?.isAdmin === true;

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

    // PR-UX-LESSON-3: Single checkpoint per page — prefer page.checkpoint, else first valid block
    const pageCp = currentPage.checkpoint;
    const hasPageCheckpoint =
      Boolean(pageCp?.question && Array.isArray(pageCp?.options)) &&
      (pageCp!.options!.filter((o: any) => o != null && String(o).trim()).length >= 2);
    const blocks = currentPage.blocks || [];
    const blocksToRender = blocks.filter((b) => {
      if (b.type === "stretch" && !showDeeperKnowledge) return false;
      if (b.type === "checkpoint") return false; // PR-UX-LESSON-3: always render checkpoint via LessonCheckpoint
      return true;
    });
    const firstCheckpointBlock = blocks.find((b) => {
      if (b.type !== "checkpoint") return false;
      const qType = b.questionType === "short" ? "short" : "mcq";
      const opts = Array.isArray(b.options) ? b.options : [];
      const hasItems =
        (qType === "short" && b.prompt != null && String(b.prompt).trim().length > 0) ||
        (qType === "mcq" && opts.filter((o: any) => o != null && String(o).trim()).length >= 2);
      return hasItems;
    });
    const checkpointData = hasPageCheckpoint
      ? {
          mode: "mcq" as const,
          prompt: safeStr(pageCp!.question, ""),
          options: (pageCp!.options || []).filter((o: any) => o != null && String(o).trim()),
          correctAnswer: safeStr(pageCp!.answer, ""),
          name: `checkpoint-${currentPage.pageId}`,
        }
      : firstCheckpointBlock
      ? {
          mode: (firstCheckpointBlock.questionType === "short" ? "short" : "mcq") as "mcq" | "short",
          prompt: firstCheckpointBlock.prompt ?? "Quick check",
          options: Array.isArray(firstCheckpointBlock.options) ? firstCheckpointBlock.options.filter((o: any) => o != null && String(o).trim()) : [],
          correctAnswer: safeStr(firstCheckpointBlock.correctAnswer, ""),
          explanation: firstCheckpointBlock.explanation,
          name: `checkpoint-${currentPage.pageId}`,
        }
      : null;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%)",
          padding: "18px",
          fontSize: BASE_FONT_SIZE,
        }}
      >
        <div style={{ maxWidth: 1750, margin: "0 auto" }}>
          {/* ✅ PROOF PANEL REMOVED FROM HERE */}

          <div style={{ marginBottom: 12 }}>
            <Link
              to="/dashboard"
              style={{ color: "#667eea", textDecoration: "none" }}
            >
              ← Back to Dashboard
            </Link>
          </div>

          {/* Lesson Integrity debug panel — teacher/admin only */}
          {isTeacherOrAdmin && lesson && (
            <div
              style={{
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
                counts: pages={orderedPages.length}, blocks={orderedPages.reduce((s, p) => s + (Array.isArray(p.blocks) ? p.blocks.length : 0), 0)}, flashcards={flashcards.length}, quiz={quizQuestions.length}, assessment={Array.isArray(lesson.assessment?.questions) ? lesson.assessment.questions.length : 0}, pastPapers={Array.isArray(lesson.pastPapers) ? lesson.pastPapers.length : 0}
              </div>
            </div>
          )}

          {accessDecision?.reason === "FREE_PREVIEW" && (
            <div
              style={{
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 8,
                marginBottom: 12,
                fontSize: "0.9rem",
                color: "#555",
              }}
            >
              You're viewing a free preview (first page only).
            </div>
          )}
          {previewMode && (
            <div
              style={{
                marginBottom: 14,
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
                Preview mode: subscribe to unlock the full lesson
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "260px minmax(0, 1fr) 280px",
              gap: 18,
              alignItems: "start",
            }}
          >
            {/* LEFT SIDEBAR */}
            <aside
              style={{
                position: "sticky",
                top: 16,
                alignSelf: "start",
                background: "white",
                borderRadius: 14,
                padding: 14,
                boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                border: "2px solid rgba(59,130,246,0.35)",
                textAlign: "left",
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
                      onClick={() => goToPage(p)}
                      style={{
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: 10,
                        border: "2px solid rgba(59,130,246,0.25)",
                        background: isCurrent ? "#eef2ff" : "white",
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

              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: 6,
                    color: "#111827",
                  }}
                >
                  Progress
                </div>
                <div
                  style={{
                    height: 10,
                    background: "#e5e7eb",
                    borderRadius: 999,
                    overflow: "hidden",
                    border: "2px solid rgba(59,130,246,0.20)",
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

            {/* MAIN CONTENT CARD */}
            <main>
              <div
                style={{
                  background: "white",
                  borderRadius: 16,
                  padding: "28px",
                  maxWidth: 1100,
                  margin: "0 auto",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.08)",
                  border: "3px solid rgba(59,130,246,0.45)",
                  textAlign: "left",
                  fontSize: BASE_FONT_SIZE,
                  lineHeight: 1.8,
                }}
              >
                {/* ✅ Header fix: Lesson title is the main title; page title is secondary */}
                <div style={{ marginBottom: 14, textAlign: "left" }}>
                  <h1
                    style={{
                      margin: 0,
                      color: "#111827",
                      textAlign: "left",
                      fontSize: "2.4rem",
                      fontWeight: 950 as any,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {lesson.title}
                  </h1>
                  <div
                    style={{
                      color: "#6b7280",
                      marginTop: 8,
                      fontSize: "1rem",
                      textAlign: "left",
                    }}
                  >
                    {lesson.topic} · {lesson.level}
                    {lesson.examBoardName ? ` · ${lesson.examBoardName}` : ""}
                  </div>

                  <h2
                    style={{
                      margin: "16px 0 0",
                      color: "#111827",
                      textAlign: "left",
                      fontSize: "2.0rem",
                      fontWeight: 900,
                      lineHeight: 1.2,
                    }}
                  >
                    {currentPage.title || `Page ${currentPageIndex + 1}`}
                  </h2>
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
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowDeeperKnowledge((v) => !v)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "2px solid rgba(124,58,237,0.25)",
                      background: showDeeperKnowledge ? "rgba(124,58,237,0.10)" : "white",
                      cursor: "pointer",
                      fontWeight: 900,
                      color: "#5b21b6",
                    }}
                  >
                    {showDeeperKnowledge ? "Hide deeper knowledge" : "Show deeper knowledge"}
                  </button>
                </div>

                {/* Blocks — checkpoint blocks rendered via LessonCheckpoint below */}
                <div>
                  {blocksToRender.map((b, idx) =>
                    b.type === "diagram"
                      ? renderDiagramBlock(b, idx)
                      : renderCallout(b.type, safeStr(b.content, ""), idx)
                  )}
                </div>

                {/* PR-UX-LESSON-3: Single checkpoint per page — one component, unified styling */}
                {checkpointData && (
                  <LessonCheckpoint
                    mode={checkpointData.mode}
                    prompt={checkpointData.prompt}
                    options={checkpointData.options}
                    correctAnswer={checkpointData.correctAnswer}
                    explanation={checkpointData.explanation}
                    name={checkpointData.name}
                    lessonId={id ?? undefined}
                    entitled={Boolean(accessDecision?.allowed)}
                  />
                )}

                {/* Prev / Next */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 22,
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    disabled={!prevPage}
                    onClick={() => prevPage && goToPage(prevPage)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "2px solid rgba(0,0,0,0.20)",
                      background: prevPage ? "white" : "#f3f4f6",
                      cursor: prevPage ? "pointer" : "not-allowed",
                      color: "#111827",
                      fontWeight: 800,
                    }}
                  >
                    ← Previous
                  </button>

                  <button
                    disabled={!nextPage}
                    onClick={() => nextPage && goToPage(nextPage)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: nextPage ? "#48bb78" : "#9ca3af",
                      cursor: nextPage ? "pointer" : "not-allowed",
                      color: "white",
                      fontWeight: 900,
                    }}
                  >
                    Next →
                  </button>
                </div>

                {/* Step 4 RAG + Step 5 Summarise (when user has access) */}
                {id && accessDecision?.allowed && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <SummariseLesson lessonId={id} lessonTitle={lesson?.title} />
                    </div>
                    <AskAboutLesson lessonId={id} lessonTitle={lesson?.title} />
                  </div>
                )}

                {/* Phase C3: Preview mode CTA block */}
                {previewMode && (
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
                      Unlock the full lesson
                    </h3>
                    <p
                      style={{
                        margin: "0 0 20px 0",
                        fontSize: "1rem",
                        color: "#7c2d12",
                        lineHeight: 1.6,
                      }}
                    >
                      You're viewing a preview. Unlock the complete lesson to access all pages, flashcards, and quiz questions.
                    </p>
                    {unlockError && (
                      <div
                        style={{
                          marginBottom: "12px",
                          padding: "12px",
                          borderRadius: "10px",
                          backgroundColor: unlockError === "Not enough ShamCoins" ? "#fef2f2" : "#f8fafc",
                          border: unlockError === "Not enough ShamCoins" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                          color: unlockError === "Not enough ShamCoins" ? "#991b1b" : "#475569",
                        }}
                      >
                        {unlockError === "Not enough ShamCoins" ? (
                          <>
                            <p style={{ margin: "0 0 10px 0", fontWeight: 600 }}>Not enough ShamCoins to unlock this lesson.</p>
                            <Link to="/subscription">
                              <button
                                type="button"
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  border: "none",
                                  backgroundColor: "#4f46e5",
                                  color: "white",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Subscribe to get ShamCoins
                              </button>
                            </Link>
                          </>
                        ) : (
                          <p style={{ margin: 0 }}>{unlockError}</p>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={handleUnlock}
                        disabled={unlocking}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: unlocking ? "#94a3b8" : "#f97316",
                          color: "white",
                          fontSize: "1rem",
                          fontWeight: 700,
                          cursor: unlocking ? "not-allowed" : "pointer",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!unlocking) e.currentTarget.style.backgroundColor = "#ea580c";
                        }}
                        onMouseLeave={(e) => {
                          if (!unlocking) e.currentTarget.style.backgroundColor = "#f97316";
                        }}
                      >
                        {unlocking ? "Unlocking…" : "Unlock full lesson (1 ShamCoin)"}
                      </button>
                      <Link
                        to="/subscription"
                        style={{
                          padding: "12px 24px",
                          borderRadius: "10px",
                          border: "2px solid rgba(249,115,22,0.50)",
                          backgroundColor: "transparent",
                          color: "#9a3412",
                          fontSize: "1rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-block",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.10)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        Subscribe to unlock all lessons
                      </Link>
                    </div>
                  </div>
                )}

                {/* Check your understanding — Section for consistent spacing */}
                <Section title="Check your understanding" variant="card">
                  {quizQuestions.length === 0 ? (
                    <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
                      No quiz questions generated for this topic yet.
                    </div>
                  ) : (
                    <QuizView
                      title=""
                      questions={
                        quizQuestions.map((q: any, i: number) => {
                          const base = {
                            id: q.id ?? `q_${String(i + 1).padStart(3, "0")}`,
                            question: q.question ?? "",
                            explanation: q.explanation,
                            tags: q.tags,
                            difficulty: q.difficulty,
                            marks: q.marks
                          };
                          if (q.type === "mcq") {
                            return { ...base, type: "mcq" as const, options: Array.isArray(q.options) ? q.options : [], correctAnswer: q.correctAnswer ?? "" };
                          }
                          if (q.type === "exam") {
                            return { ...base, type: "exam" as const, markScheme: Array.isArray(q.markScheme) ? q.markScheme : [], correctAnswer: q.correctAnswer ?? "See mark scheme." };
                          }
                          return { ...base, type: "short" as const, correctAnswer: q.correctAnswer ?? "" };
                        })
                      }
                    />
                  )}
                </Section>

                {/* PR13.2: Targeted practice (entitled only) — above practice */}
                <TargetedPracticeSection
                  loading={targetedPracticeLoading}
                  error={targetedPracticeError}
                  questions={targetedPracticeQuestions}
                  allowed={targetedPracticeAllowed}
                  lessonId={id || undefined}
                />

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
                />

                {/* Flashcards section — Section provides standard header and spacing */}
                <Section
                  title="Flashcards"
                  right={isTeacherOrAdmin ? (
                      <button
                        onClick={handleAIGenerate}
                        disabled={isGenerating}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "10px",
                          border: "2px solid #10b981",
                          background: isGenerating ? "#e5e7eb" : "#10b981",
                          color: "white",
                          cursor: isGenerating ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                          fontSize: "14px"
                        }}
                      >
                        {isGenerating ? "Generating..." : "Generate revision with AI"}
                      </button>
                    ) : undefined}
                  variant="plain"
                >
                  <div style={{ display: "grid", gap: "16px" }}>
                    {/* Debug only: requires REACT_APP_DEV_TOOLS=1 (hidden from teachers to avoid confusion) */}
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
                    {/* PR-F1: Load from bank — teacher only, when no flashcards */}
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
                </Section>

                {/* PR-UX-REVIEWS-1: Student Reviews only on last page */}
                {/* TODO: Consider prompting for a review after final checkpoint completion */}
                {isLastPage && (
                  <>
                    <p style={{ marginTop: 24, marginBottom: 8, color: "#64748b", fontSize: 14 }}>
                      Finished the lesson? See what other students thought.
                    </p>
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
                          ✏️ TEST: Write a Review
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
                  </>
                )}
              </div>
            </main>

            {/* RIGHT RAIL */}
            <aside
              style={{
                position: "sticky",
                top: 16,
                alignSelf: "start",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  border: "2px solid rgba(59,130,246,0.25)",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                  Topic progress
                </div>
                <div style={{ color: "#6b7280" }}>
                  Page {currentPageIndex + 1} of {orderedPages.length}
                </div>
              </div>
            </aside>
          </div>
          {/* PR-STUDENT-LESSON-NAV-1: CTA only on last page (student has actually finished) */}
          {isLastPage && specKey && topicKeyForBank && (
            <NextTopicCTA
              specKey={specKey}
              currentTopicKey={topicKeyForBank}
              onNavigate={(nextKey) => navigate(nextKey ? `/browse-lessons?topicKey=${encodeURIComponent(nextKey)}` : "/browse-lessons")}
              onBackToTopics={() => navigate("/browse-lessons")}
            />
          )}
        </div>

      </div>
    );
  }

  // ============================
  // Legacy view (no pages)
  // ============================
  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "20px",
        fontSize: BASE_FONT_SIZE,
      }}
    >
      {/* ✅ PROOF PANEL REMOVED FROM LEGACY VIEW TOO */}

      <Link to="/dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
        ← Back to Dashboard
      </Link>

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
              style={{
                marginBottom: "10px",
                color: "#111827",
                fontSize: "2.4rem",
                fontWeight: 950 as any,
                lineHeight: 1.15,
              }}
            >
              {lesson.title}
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

        <div style={{ marginBottom: "30px" }}>
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
            <ReactMarkdown components={markdownComponents as any}>
              {lesson.content || ""}
            </ReactMarkdown>
          </div>
        </div>

        {/* Phase C3: Preview mode CTA block for legacy view */}
        {previewMode && (
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
              Unlock the full lesson
            </h3>
            <p
              style={{
                margin: "0 0 20px 0",
                fontSize: "1rem",
                color: "#7c2d12",
                lineHeight: 1.6,
              }}
            >
              You're viewing a preview. Unlock the complete lesson to access all pages, flashcards, and quiz questions.
            </p>
            {unlockError && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: unlockError === "Not enough ShamCoins" ? "#fef2f2" : "#f8fafc",
                  border: unlockError === "Not enough ShamCoins" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                  color: unlockError === "Not enough ShamCoins" ? "#991b1b" : "#475569",
                }}
              >
                {unlockError === "Not enough ShamCoins" ? (
                  <>
                    <p style={{ margin: "0 0 10px 0", fontWeight: 600 }}>Not enough ShamCoins to unlock this lesson.</p>
                    <Link to="/subscription">
                      <button
                        type="button"
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: "#4f46e5",
                          color: "white",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Subscribe to get ShamCoins
                      </button>
                    </Link>
                  </>
                ) : (
                  <p style={{ margin: 0 }}>{unlockError}</p>
                )}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: unlocking ? "#94a3b8" : "#f97316",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: unlocking ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!unlocking) e.currentTarget.style.backgroundColor = "#ea580c";
                }}
                onMouseLeave={(e) => {
                  if (!unlocking) e.currentTarget.style.backgroundColor = "#f97316";
                }}
              >
                {unlocking ? "Unlocking…" : "Unlock full lesson (1 ShamCoin)"}
              </button>
              <Link
                to="/subscription"
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "2px solid rgba(249,115,22,0.50)",
                  backgroundColor: "transparent",
                  color: "#9a3412",
                  fontSize: "1rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.10)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Subscribe to unlock all lessons
              </Link>
            </div>
          </div>
        )}

        {/* Subscribe CTA under FREE_PREVIEW (dynamic price from /api/pricing) */}
        {(previewMode || accessDecision?.reason === "FREE_PREVIEW") && (
          <div style={{ marginTop: 16 }}>
            <SubscribeCTA lessonId={id || undefined} />
          </div>
        )}

        {/* Check your understanding — Section for consistent spacing */}
        <Section title="Check your understanding" variant="card">
          {quizQuestions.length === 0 ? (
            <div style={{ padding: 16, color: "#64748b", fontSize: 14 }}>
              No quiz questions generated for this topic yet.
            </div>
          ) : (
            <QuizView
              title=""
              questions={
                quizQuestions.map((q: any, i: number) => {
                  const base = {
                    id: q.id ?? `q_${String(i + 1).padStart(3, "0")}`,
                    question: q.question ?? "",
                    explanation: q.explanation,
                    tags: q.tags,
                    difficulty: q.difficulty,
                    marks: q.marks
                  };
                  if (q.type === "mcq") {
                    return { ...base, type: "mcq" as const, options: Array.isArray(q.options) ? q.options : [], correctAnswer: q.correctAnswer ?? "" };
                  }
                  if (q.type === "exam") {
                    return { ...base, type: "exam" as const, markScheme: Array.isArray(q.markScheme) ? q.markScheme : [], correctAnswer: q.correctAnswer ?? "See mark scheme." };
                  }
                  return { ...base, type: "short" as const, correctAnswer: q.correctAnswer ?? "" };
                })
              }
            />
          )}
        </Section>

        {/* PR13.2: Targeted practice (entitled only) */}
        <TargetedPracticeSection
          loading={targetedPracticeLoading}
          error={targetedPracticeError}
          questions={targetedPracticeQuestions}
          allowed={targetedPracticeAllowed}
          lessonId={id || undefined}
        />

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
        />

        {/* Flashcards section — Section for consistent spacing */}
        <Section
          title="Flashcards"
          right={isTeacherOrAdmin ? (
            <button
              onClick={handleAIGenerate}
              disabled={isGenerating}
              style={{
                padding: "8px 16px",
                borderRadius: "10px",
                border: "2px solid #10b981",
                background: isGenerating ? "#e5e7eb" : "#10b981",
                color: "white",
                cursor: isGenerating ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "14px"
              }}
            >
              {isGenerating ? "Generating..." : "Generate revision with AI"}
            </button>
          ) : undefined}
          variant="plain"
        >
          <div style={{ display: "grid", gap: "16px" }}>
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
        {specKey && topicKeyForBank && (
          <NextTopicCTA
            specKey={specKey}
            currentTopicKey={topicKeyForBank}
            onNavigate={(nextKey) => navigate(nextKey ? `/browse-lessons?topicKey=${encodeURIComponent(nextKey)}` : "/browse-lessons")}
            onBackToTopics={() => navigate("/browse-lessons")}
          />
        )}
      </div>
    </div>
  );
};

export default LessonViewPage;