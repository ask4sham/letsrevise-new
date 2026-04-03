/**
 * PR9: Teacher-only classroom delivery view.
 * Lesson pages + checkpoints + practice, no paywall, no admin clutter.
 */
import React, { useMemo, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { getVisualById } from "../services/api";
import { makeAbsoluteAssetUrl, preprocessMarkdownAssetUrls } from "../utils/assetUrl";
import { LessonMarkdown } from "../components/lesson/LessonMarkdown";
import { LessonImageLightboxProvider } from "../components/lesson/LessonImageLightbox";
import { hideBrokenLessonImage, LessonImageFrame } from "../components/lesson/LessonImageFrame";
import { LessonDiagramFrame } from "../components/lesson/LessonDiagramFrame";
import {
  createLessonMarkdownViewComponents,
  lessonMarkdownUrlTransform,
} from "../components/lesson/lessonMarkdownViewComponents";
import { hasRenderableLessonImageSrc } from "../constants/lessonImageDisplay";
import { getSpecKeyFromLesson, resolveLessonTopicKeyForBank } from "../utils/resolveLessonTopicKey";

interface DiagramAnnotation {
  id: string;
  kind?: "label" | "callout";
  text?: string;
  x?: number;
  y?: number;
  color?: string;
  align?: "left" | "center" | "right";
}

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
  mode?: "static" | "annotated" | "step";
  annotations?: DiagramAnnotation[];
  steps?: DiagramStep[];
  diagramVariant?: "standard" | "featured";
}

interface LessonPage {
  pageId: string;
  title: string;
  order: number;
  blocks?: LessonPageBlock[];
  checkpoint?: { question?: string; options?: string[]; answer?: string };
}

interface Lesson {
  id: string;
  title: string;
  topic: string;
  topicKey?: string;
  subject: string;
  level: string;
  pages?: LessonPage[];
}

interface PracticeQuestionLite {
  id: string;
  question: string;
  type: string;
  marks: number;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
}

const BASE_FONT = 20;

function safeStr(v: any, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s : fallback;
}

function sortPages(pages: LessonPage[]) {
  return [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
}

const resolveAssetUrl = (url: string) => makeAbsoluteAssetUrl(url) ?? "";

function DiagramBlockContent({
  visualId,
  caption,
  level,
  mode: blockMode = "static",
  annotations = [],
  steps = [],
  variant = "standard",
}: {
  visualId: string;
  caption: string;
  level: string;
  mode?: "static" | "annotated" | "step";
  annotations?: DiagramAnnotation[];
  steps?: DiagramStep[];
  variant?: "standard" | "featured";
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!visualId);
  const [stepIndex, setStepIndex] = useState(0);
  const resolveUrl = resolveAssetUrl;

  const mode = blockMode === "annotated" || blockMode === "step" ? blockMode : "static";
  const hasSteps = mode === "step" && Array.isArray(steps) && steps.length > 0;
  const currentStep = hasSteps ? steps[Math.max(0, Math.min(stepIndex, steps.length - 1))] : null;
  const showIds = currentStep?.showAnnotationIds ?? [];
  const visibleAnnotations =
    mode === "step"
      ? annotations.filter((a) => showIds.includes(a.id))
      : annotations;
  const showOverlay = mode !== "static" && visibleAnnotations.length > 0;

  useEffect(() => {
    if (!visualId?.trim()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getVisualById(visualId, level)
      .then((res: any) => {
        if (cancelled) return;
        const v = res?.data?.visual;
        const url = v && typeof v.src === "string" ? v.src : "";
        setSrc(url ? resolveUrl(url) : null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [visualId, level]);

  if (!visualId?.trim()) return null;
  if (loading) {
    return (
      <LessonDiagramFrame variant={variant}>
        <div style={{ color: "#6b7280" }}>Loading diagram…</div>
      </LessonDiagramFrame>
    );
  }
  if (!src || !hasRenderableLessonImageSrc(src)) {
    return (
      <LessonDiagramFrame variant={variant}>
        <div style={{ color: "#6b7280" }}>Diagram unavailable</div>
      </LessonDiagramFrame>
    );
  }
  return (
    <LessonDiagramFrame variant={variant} caption={caption}>
      <LessonImageFrame variant="primary" lightboxSrc={src}>
        <div style={{ position: "relative", display: "inline-block", maxWidth: 720, width: "100%" }}>
          <img
            src={src}
            alt={caption || "Diagram"}
            style={{ width: "100%", maxWidth: 720, height: "auto", borderRadius: 12, margin: "0 auto", display: "block" }}
            onError={hideBrokenLessonImage}
          />
        {showOverlay && (
          <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, pointerEvents: "none", borderRadius: 12 }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
              {visibleAnnotations.map((a) => {
                const x = typeof a.x === "number" ? a.x : 0.5;
                const y = typeof a.y === "number" ? a.y : 0.5;
                const y2 = Math.max(0, Math.min(1, y - 0.035));
                return (
                  <line key={a.id} x1={`${x * 100}%`} y1={`${y * 100}%`} x2={`${x * 100}%`} y2={`${y2 * 100}%`} stroke="#111827" strokeWidth="2" opacity="0.55" />
                );
              })}
            </svg>
            {visibleAnnotations.map((a) => {
              const x = typeof a.x === "number" ? a.x : 0.5;
              const y = typeof a.y === "number" ? a.y : 0.5;
              return (
                <div key={`pin-${a.id}`} style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: "translate(-50%, -50%)", width: 10, height: 10, borderRadius: 999, background: "#111827", border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
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
      </LessonImageFrame>
      {hasSteps && steps.length > 1 && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.9rem", color: "#6b7280" }}>Step {stepIndex + 1} / {steps.length}</span>
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: stepIndex === 0 ? "not-allowed" : "pointer", fontWeight: 600, opacity: stepIndex === 0 ? 0.6 : 1 }}
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
            disabled={stepIndex >= steps.length - 1}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #22c55e", background: "rgba(34,197,94,0.1)", cursor: stepIndex >= steps.length - 1 ? "not-allowed" : "pointer", fontWeight: 600, opacity: stepIndex >= steps.length - 1 ? 0.6 : 1 }}
          >
            Next
          </button>
        </div>
      )}
    </LessonDiagramFrame>
  );
}

function CheckpointMCQBlock({ block, name }: { block: LessonPageBlock; name: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const options = Array.isArray(block.options) ? block.options : [];
  const correctAnswer = block.correctAnswer != null ? String(block.correctAnswer).trim() : "";
  const isCorrect = checked && selected !== null && correctAnswer !== "" && selected.trim() === correctAnswer;
  const getOptionBg = (opt: string) => {
    const optTrim = String(opt ?? "").trim();
    const isCorrectOpt = correctAnswer !== "" && optTrim === correctAnswer;
    if (!checked) return "white";
    if (isCorrectOpt) return "#dcfce7";
    if (selected !== null && selected.trim() === optTrim && !isCorrect) return "#fee2e2";
    return "white";
  };
  return (
    <>
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
      <div style={{ marginTop: 10 }}>
        {!checked ? (
          <button type="button" disabled={selected === null} onClick={() => setChecked(true)} style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid rgba(59,130,246,0.4)", background: selected !== null ? "rgba(59,130,246,0.12)" : "#f1f5f9", cursor: selected !== null ? "pointer" : "not-allowed", fontWeight: 700 }}>
            Check answer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 2 }}>{isCorrect ? <span style={{ color: "#16a34a", fontWeight: 700 }}>✅ Correct</span> : <span style={{ color: "#dc2626", fontWeight: 700 }}>❌ Not quite</span>}</div>
            {block.explanation ? <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}><strong>Explanation:</strong><div style={{ marginTop: 4, color: "#4b5563" }}>{block.explanation}</div></div> : null}
            <button type="button" onClick={() => { setSelected(null); setChecked(false); }} style={{ marginTop: 6, padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(0,0,0,0.14)", background: "white", cursor: "pointer", fontWeight: 700 }}>Try again</button>
          </>
        )}
      </div>
    </>
  );
}

function CheckpointShortBlock({ block }: { block: LessonPageBlock }) {
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  return (
    <>
      <div style={{ marginTop: 8 }}>
        <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer..." disabled={checked} style={{ width: "100%", maxWidth: 500, padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: BASE_FONT }} />
      </div>
      <div style={{ marginTop: 10 }}>
        {!checked ? (
          <button type="button" disabled={!answer.trim()} onClick={() => setChecked(true)} style={{ padding: "10px 16px", borderRadius: 10, border: "2px solid rgba(59,130,246,0.4)", background: answer.trim() ? "rgba(59,130,246,0.12)" : "#f1f5f9", cursor: answer.trim() ? "pointer" : "not-allowed", fontWeight: 700 }}>
            Check answer
          </button>
        ) : (
          <>
            <div style={{ marginTop: 10, padding: 12, borderRadius: 8, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
              <strong>Model answer:</strong>
              <div style={{ marginTop: 6, color: "#4b5563" }}>{block.correctAnswer != null ? String(block.correctAnswer).trim() : "—"}</div>
            </div>
            {block.explanation ? <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e5e7eb" }}><strong>Explanation:</strong><div style={{ marginTop: 4, color: "#4b5563" }}>{block.explanation}</div></div> : null}
            <button type="button" onClick={() => { setAnswer(""); setChecked(false); }} style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(0,0,0,0.14)", background: "white", cursor: "pointer", fontWeight: 700 }}>Try again</button>
          </>
        )}
      </div>
    </>
  );
}

type TabMode = "lesson" | "reteach";

interface ReteachPlanPayload {
  ok: boolean;
  plan?: { content: string; pinned?: boolean; studentSummary?: string };
}

const ClassroomModePage: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [practiceQuestions, setPracticeQuestions] = useState<PracticeQuestionLite[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceAllowed, setPracticeAllowed] = useState(false);
  /** PR15: Lesson | Reteach tab */
  const [tab, setTab] = useState<TabMode>("lesson");
  const [reteachPlan, setReteachPlan] = useState<{ content: string } | null>(null);
  const [reteachPlanLoading, setReteachPlanLoading] = useState(false);
  const [reteachPlanError, setReteachPlanError] = useState<string | null>(null);

  // PR19: Mark that teacher has used Classroom mode (for Quick setup checklist)
  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("hasUsedClassroomMode", "true");
    }
  }, []);

  useEffect(() => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    api
      .get(`/lessons/${lessonId}`)
      .then((res) => {
        const d = res?.data;
        if (!d) {
          setError("Lesson not found");
          return;
        }
        setLesson({
          id: String(d._id ?? d.id ?? lessonId),
          title: safeStr(d.title, "Untitled"),
          topic: safeStr(d.topic, ""),
          topicKey: typeof d.topicKey === "string" ? d.topicKey : undefined,
          subject: safeStr(d.subject, "Biology"),
          level: safeStr(d.level, "GCSE"),
          pages: Array.isArray(d.pages) ? d.pages : [],
        });
      })
      .catch(() => setError("Failed to load lesson"))
      .finally(() => setLoading(false));
  }, [lessonId]);

  const topicKeyForBank = useMemo(() => {
    if (!lesson) return null;
    const specKey = getSpecKeyFromLesson(lesson);
    const candidate = lesson.topicKey ?? null;
    return resolveLessonTopicKeyForBank({ specKey, topicKeyCandidate: candidate ?? undefined });
  }, [lesson]);

  const lessonMarkdownComponents = useMemo(
    () => createLessonMarkdownViewComponents(safeStr),
    []
  );

  useEffect(() => {
    if (!lessonId) return;
    setPracticeLoading(true);
    api
      .get(`/lessons/${lessonId}/practice`, {
        params: topicKeyForBank ? { topicKey: topicKeyForBank } : undefined,
      })
      .then((res) => {
        const data = res?.data;
        setPracticeAllowed(!!data?.allowed);
        setPracticeQuestions(Array.isArray(data?.questions) ? data.questions : []);
      })
      .catch(() => {
        setPracticeAllowed(false);
        setPracticeQuestions([]);
      })
      .finally(() => setPracticeLoading(false));
  }, [lessonId, topicKeyForBank]);

  /** PR15: Fetch reteach plan when Reteach tab is selected */
  useEffect(() => {
    if (!lessonId || tab !== "reteach") return;
    setReteachPlanLoading(true);
    setReteachPlanError(null);
    api
      .get<ReteachPlanPayload>(`/reports/lessons/${lessonId}/reteach-plan`)
      .then((res) => {
        if (res?.data?.ok && res.data.plan?.content != null) setReteachPlan({ content: res.data.plan.content });
        else setReteachPlan(null);
      })
      .catch(() => {
        setReteachPlan(null);
        setReteachPlanError("Failed to load reteach plan.");
      })
      .finally(() => setReteachPlanLoading(false));
  }, [lessonId, tab]);

  const orderedPages = useMemo(() => (lesson?.pages ? sortPages(lesson.pages) : []), [lesson]);
  const currentPage = orderedPages[pageIndex] || null;
  const prevPage = pageIndex > 0 ? orderedPages[pageIndex - 1] : null;
  const nextPage = pageIndex < orderedPages.length - 1 ? orderedPages[pageIndex + 1] : null;

  const maybeParseKeywordsFromText = (blockText: string): string[] | null => {
    const t = String(blockText ?? "").trim();
    if (t.length === 0 || t.length > 250) return null;
    if (!t.includes(",")) return null;
    if (/[.!?]/.test(t)) return null;
    const items = t.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    const seen = new Set<string>();
    const deduped = items.filter((s) => {
      const lower = s.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
    return deduped.length >= 2 ? deduped : null; // 1 item looks weird as a callout; render as normal text
  };

  const renderCallout = (kind: LessonPageBlock["type"] | "keyWords", text: string, idx: number) => {
    const base: React.CSSProperties = { padding: 14, borderRadius: 12, margin: "14px 0", lineHeight: 1.8, background: "white", textAlign: "left", fontSize: BASE_FONT };
    if (kind === "keyIdea") return <div key={idx} style={{ ...base, background: "#f0fff4", border: "2px solid rgba(34,197,94,0.40)" }}><div style={{ fontWeight: 900, marginBottom: 6, color: "#065f46" }}>🔑 Key Idea(s)</div><div className="lesson-content"><LessonMarkdown className="lesson-md-body" components={lessonMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>{preprocessMarkdownAssetUrls(text)}</LessonMarkdown></div></div>;
    if (kind === "examTip") return <div key={idx} style={{ ...base, background: "#eef2ff", border: "2px solid rgba(99,102,241,0.40)" }}><div style={{ fontWeight: 900, marginBottom: 6, color: "#3730a3" }}>🧠 Exam insight</div><div className="lesson-content"><LessonMarkdown className="lesson-md-body" components={lessonMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>{preprocessMarkdownAssetUrls(text)}</LessonMarkdown></div></div>;
    if (kind === "commonMistake") return <div key={idx} style={{ ...base, background: "#fff7ed", border: "2px solid rgba(249,115,22,0.45)" }}><div style={{ fontWeight: 900, marginBottom: 6, color: "#9a3412" }}>⚠️ Common mistake(s)</div><div className="lesson-content"><LessonMarkdown className="lesson-md-body" components={lessonMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>{preprocessMarkdownAssetUrls(text)}</LessonMarkdown></div></div>;
    if (kind === "stretch") return <div key={idx} style={{ ...base, border: "2px solid rgba(124,58,237,0.35)", background: "rgba(124,58,237,0.08)" }}><div style={{ fontWeight: 900, marginBottom: 6, color: "#5b21b6" }}>🔍 Deeper knowledge</div><div className="lesson-content"><LessonMarkdown className="lesson-md-body" components={lessonMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>{preprocessMarkdownAssetUrls(text)}</LessonMarkdown></div></div>;
    const keywords = (kind === "keyWords" || kind === "text") ? maybeParseKeywordsFromText(text) : null;
    if (keywords && keywords.length > 0) return (
      <div key={idx} style={{ ...base, background: "rgba(139,92,246,0.06)", border: "2px solid rgba(139,92,246,0.30)" }}>
        <div style={{ fontWeight: 900, marginBottom: 8, color: "#5b21b6" }}>🔑 Key words</div>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>{keywords.map((item, i) => <li key={i}>{item}</li>)}</ul>
      </div>
    );
    return <div key={idx} style={{ ...base, background: "#fbfbfc", border: "2px solid rgba(0,0,0,0.10)" }}><div className="lesson-content"><LessonMarkdown className="lesson-md-body" components={lessonMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>{preprocessMarkdownAssetUrls(text)}</LessonMarkdown></div></div>;
  };

  const renderDiagramBlock = (block: LessonPageBlock, idx: number) => {
    const mode = block.mode === "annotated" || block.mode === "step" ? block.mode : "static";
    const annotations = Array.isArray(block.annotations) ? block.annotations : [];
    const steps = Array.isArray(block.steps) ? block.steps : [];
    const diagramVariant = block.diagramVariant === "featured" ? "featured" : "standard";
    return (
      <div key={`diagram-${idx}`} style={{ marginTop: 14 }}>
        <DiagramBlockContent
          visualId={block.visualId ?? ""}
          caption={block.caption ?? ""}
          level={lesson?.level ?? "GCSE"}
          mode={mode}
          annotations={annotations}
          steps={steps}
          variant={diagramVariant}
        />
      </div>
    );
  };

  const renderCheckpointBlock = (block: LessonPageBlock, idx: number) => {
    const questionType = block.questionType === "short" ? "short" : "mcq";
    const name = `classroom-cp-${idx}-${currentPage?.pageId ?? idx}`;
    return (
      <div key={`checkpoint-${idx}`} style={{ marginTop: 14, padding: 16, borderRadius: 14, background: "#f8f9fa", border: "2px solid rgba(59,130,246,0.25)", textAlign: "left" }}>
        <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: 6, fontWeight: 600 }}>Check your understanding</div>
        <div style={{ fontWeight: 800, marginBottom: 10, color: "#111827", fontSize: BASE_FONT }}>{block.prompt ?? "Quick check"}</div>
        {questionType === "mcq" && Array.isArray(block.options) && block.options.length > 0 ? (
          <CheckpointMCQBlock block={block} name={name} />
        ) : (
          <CheckpointShortBlock block={block} />
        )}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 50, textAlign: "center" }}><h2>Loading lesson…</h2></div>;
  if (error || !lesson) return (
    <div style={{ padding: 50, textAlign: "center" }}>
      <h2>{error || "Lesson not found"}</h2>
      <button onClick={() => navigate("/teacher-dashboard")} style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd", background: "white", cursor: "pointer", fontWeight: 700 }}>← Back to dashboard</button>
    </div>
  );

  return (
    <LessonImageLightboxProvider>
    <div style={{ minHeight: "100vh", background: "#f5f7fa", padding: 18, fontSize: BASE_FONT }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Top bar: Lesson | Reteach tabs + nav */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 20, padding: "12px 16px", background: "white", borderRadius: 12, border: "2px solid rgba(59,130,246,0.25)", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ flex: "1 1 200px" }}>
            <h1 style={{ margin: 0, fontSize: "1.4rem", color: "#111827" }}>{lesson.title}</h1>
            <div style={{ marginTop: 4, color: "#6b7280", fontSize: "0.95rem" }}>{lesson.topic}{lesson.subject ? ` · ${lesson.subject}` : ""}{lesson.level ? ` · ${lesson.level}` : ""}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button type="button" onClick={() => setTab("lesson")} style={{ padding: "8px 14px", borderRadius: 8, border: tab === "lesson" ? "2px solid #2563eb" : "2px solid #e2e8f0", background: tab === "lesson" ? "rgba(37,99,235,0.1)" : "white", color: tab === "lesson" ? "#1d4ed8" : "#64748b", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Lesson</button>
            <button type="button" onClick={() => setTab("reteach")} style={{ padding: "8px 14px", borderRadius: 8, border: tab === "reteach" ? "2px solid #2563eb" : "2px solid #e2e8f0", background: tab === "reteach" ? "rgba(37,99,235,0.1)" : "white", color: tab === "reteach" ? "#1d4ed8" : "#64748b", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Reteach</button>
            <Link to={`/teacher/lesson/${lesson.id}`} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #94a3b8", background: "#f1f5f9", color: "#334155", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Back to editor</Link>
            {tab === "lesson" && <a href="#practice" style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)", color: "#1d4ed8", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>Practice</a>}
            {tab === "lesson" && prevPage && <button type="button" onClick={() => setPageIndex((i) => i - 1)} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #94a3b8", background: "white", cursor: "pointer", fontWeight: 700 }}>← Previous</button>}
            {tab === "lesson" && nextPage && <button type="button" onClick={() => setPageIndex((i) => i + 1)} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid #22c55e", background: "#22c55e", color: "white", cursor: "pointer", fontWeight: 700 }}>Next →</button>}
          </div>
        </div>

        {/* PR15: Reteach tab — full plan as handout + Print/Copy */}
        {tab === "reteach" && (
          <div style={{ background: "white", borderRadius: 14, padding: 28, marginBottom: 24, border: "2px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.3rem", color: "#111827" }}>Reteach plan</h2>
            {reteachPlanLoading && <p style={{ color: "#6b7280", margin: 0 }}>Loading reteach plan…</p>}
            {reteachPlanError && <p style={{ color: "#dc2626", margin: 0 }}>{reteachPlanError}</p>}
            {!reteachPlanLoading && !reteachPlanError && !reteachPlan?.content && <p style={{ color: "#6b7280", margin: 0 }}>No reteach plan yet. Generate one from the <Link to={`/teacher/reports/lesson/${lesson.id}`} style={{ color: "#2563eb", fontWeight: 600 }}>lesson report</Link>.</p>}
            {!reteachPlanLoading && !reteachPlanError && reteachPlan?.content && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                  <button type="button" onClick={() => window.print()} style={{ padding: "10px 18px", borderRadius: 8, border: "2px solid #059669", background: "#059669", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 14 }}>Print</button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = reteachPlan.content.replace(/#{1,6}\s/g, "").replace(/\*\*/g, "");
                      navigator.clipboard.writeText(text || reteachPlan.content).then(() => {}, () => {});
                    }}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "2px solid #6366f1", background: "#6366f1", color: "white", cursor: "pointer", fontWeight: 700, fontSize: 14 }}
                  >
                    Copy
                  </button>
                </div>
                <div className="reteach-plan-content" style={{ fontSize: 22, lineHeight: 1.6, color: "#1f2937", textAlign: "left" }}>
                  <LessonMarkdown className="lesson-md-body" components={lessonMarkdownComponents as any} urlTransform={lessonMarkdownUrlTransform}>{preprocessMarkdownAssetUrls(reteachPlan.content)}</LessonMarkdown>
                </div>
              </>
            )}
          </div>
        )}

        {/* Main content: one page (Lesson tab only) */}
        {tab === "lesson" && currentPage && (
          <div style={{ background: "white", borderRadius: 14, padding: 24, marginBottom: 24, border: "2px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.2rem", color: "#111827" }}>{currentPage.title || `Page ${pageIndex + 1}`}</h2>
            <div>
              {(currentPage.blocks || []).map((b, idx) =>
                b.type === "checkpoint" ? renderCheckpointBlock(b, idx) : b.type === "diagram" ? renderDiagramBlock(b, idx) : renderCallout(b.type, safeStr(b.content, ""), idx)
              )}
            </div>
            {currentPage.checkpoint?.question && Array.isArray(currentPage.checkpoint?.options) && currentPage.checkpoint.options.length > 0 && (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: "#f8f9fa", border: "2px solid rgba(59,130,246,0.25)" }}>
                <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>✅ Check your understanding</div>
                <div style={{ marginBottom: 10, color: "#111827", fontWeight: 700 }}>{currentPage.checkpoint.question}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{currentPage.checkpoint.options.map((opt, i) => <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white" }}>{opt}</div>)}</div>
              </div>
            )}
          </div>
        )}

        {tab === "lesson" && (
        <>
        {/* Practice section */}
        <div id="practice" style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid #e2e8f0" }}>
          <h2 style={{ color: "#333", fontSize: "1.5rem", margin: "0 0 16px" }}>Practice</h2>
          {practiceLoading && <p style={{ color: "#6b7280", margin: 0 }}>Loading practice questions…</p>}
          {!practiceLoading && !practiceAllowed && <p style={{ color: "#6b7280", margin: 0 }}>Practice not available for this lesson.</p>}
          {!practiceLoading && practiceAllowed && practiceQuestions.length === 0 && (
            <p style={{ color: "#6b7280", margin: 0 }}>No practice attached yet. <Link to={`/teacher/lesson/${lesson.id}#past-paper`} style={{ color: "#2563eb", fontWeight: 600 }}>Attach from Question Bank</Link></p>
          )}
          {!practiceLoading && practiceAllowed && practiceQuestions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {practiceQuestions.slice(0, 10).map((q, idx) => (
                <div key={q.id} style={{ padding: 16, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, color: "#374151" }}>Q{idx + 1}</span>
                    {q.marks != null && <span style={{ fontSize: 13, color: "#6b7280" }}>({q.marks} {q.marks === 1 ? "mark" : "marks"})</span>}
                  </div>
                  <div style={{ color: "#1f2937", marginBottom: 12 }}>{q.question}</div>
                  {Array.isArray(q.options) && q.options.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{q.options.map((opt, i) => <div key={i} style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white" }}>{opt}</div>)}</div>
                  ) : (
                    <div style={{ color: "#6b7280", fontSize: "0.95rem" }}>Short answer question</div>
                  )}
                </div>
              ))}
              {practiceQuestions.length > 10 && <p style={{ color: "#6b7280", marginTop: 8 }}>Showing first 10 of {practiceQuestions.length} questions.</p>}
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
    </LessonImageLightboxProvider>
  );
};

export default ClassroomModePage;
