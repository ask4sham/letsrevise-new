import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import {
  getTaxonomyOptionGroups,
  getTaxonomyKeyToTopic,
  getSpecTopicFieldLabel,
  type SpecKey,
} from "../api/taxonomy";
import { aiRewriteExamQuestion, publishExamQuestion } from "../api/examQuestions";
import { getApiClientErrorMessage } from "../utils/apiErrorMessage";
import { getExamPublishReadinessUi } from "../utils/examQuestionPublishReadinessUi";
import { makeAbsoluteAssetUrl } from "../utils/assetUrl";
import { examBankDefaultFormFields, resolveExamQuestionLevelForSave } from "../utils/examQuestionLevelFilter";

const QUESTION_TYPES = ["mcq", "short", "label", "table", "data"] as const;
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Geography", "Computer Science", "Other"];
const EXAM_BOARDS = ["AQA", "Edexcel", "OCR", "CIE", "WJEC", "Other"];
const LEVELS = ["GCSE", "IGCSE", "A-Level", "IB", "KS3", "Other"];

const PART_TYPES = ["short", "mcq"] as const;
const PART_LABELS = "abcdefghijklmnopqrstuvwxyz".split("");

type CompositePartForm = {
  label: string;
  type: (typeof PART_TYPES)[number];
  marks: number;
  questionText: string;
  options: string[];
  correctIndex: number;
  markScheme: string;
};

function makeEmptyPart(index: number): CompositePartForm {
  return {
    label: PART_LABELS[index] ?? String(index + 1),
    type: "short",
    marks: 2,
    questionText: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    markScheme: "",
  };
}

type ExamBankForm = {
  subject: string;
  examBoard: string;
  level: string;
  topic: string;
  topicKey: string;
  questionType: (typeof QUESTION_TYPES)[number];
  marks: number;
  questionText: string;
  correctAnswerMarkScheme: string;
  mcqOptions: string[];
  correctIndex: number;
  imageUrl: string;
  questionMode: "single" | "composite";
  sharedStem: string;
  title: string;
  parts: CompositePartForm[];
};

/** Composite Exam Question editor — shared stem + add/edit/remove sub-parts, auto total marks. */
function CompositePartsEditor({
  form,
  setForm,
}: {
  form: ExamBankForm;
  setForm: React.Dispatch<React.SetStateAction<ExamBankForm>>;
}): React.ReactElement {
  const totalMarks = form.parts.reduce((sum, p) => sum + (Number.isFinite(p.marks) ? p.marks : 0), 0);

  const updatePart = (index: number, patch: Partial<CompositePartForm>) => {
    setForm((f) => ({
      ...f,
      parts: f.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };
  const addPart = () => setForm((f) => ({ ...f, parts: [...f.parts, makeEmptyPart(f.parts.length)] }));
  const removePart = (index: number) =>
    setForm((f) => {
      const next = f.parts.filter((_, i) => i !== index);
      return { ...f, parts: next.map((p, i) => ({ ...p, label: PART_LABELS[i] ?? String(i + 1) })) };
    });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
  };

  return (
    <>
      <div>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
          Title (optional)
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Sperm cell — structure and reproduction"
          style={fieldStyle}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
          Shared stem
        </label>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>
          Shown once above all parts, alongside the shared image.
        </p>
        <textarea
          value={form.sharedStem}
          onChange={(e) => setForm((f) => ({ ...f, sharedStem: e.target.value }))}
          placeholder="e.g. The diagram shows a human sperm cell."
          rows={3}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>Parts</label>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
            Total: {totalMarks} {totalMarks === 1 ? "mark" : "marks"}
          </span>
        </div>

        {form.parts.map((part, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Part ({part.label})</strong>
              <button
                type="button"
                onClick={() => removePart(index)}
                disabled={form.parts.length <= 1}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: form.parts.length <= 1 ? "#9ca3af" : "#b91c1c",
                  background: form.parts.length <= 1 ? "#f3f4f6" : "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: form.parts.length <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Remove
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Type</label>
                <select
                  value={part.type}
                  onChange={(e) => updatePart(index, { type: e.target.value as (typeof PART_TYPES)[number] })}
                  style={fieldStyle}
                >
                  {PART_TYPES.map((t) => (
                    <option key={t} value={t}>{t === "mcq" ? "Multiple choice" : "Short answer"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Marks</label>
                <input
                  type="number"
                  min={1}
                  value={part.marks}
                  onChange={(e) => updatePart(index, { marks: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  style={fieldStyle}
                />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Question text</label>
              <textarea
                value={part.questionText}
                onChange={(e) => updatePart(index, { questionText: e.target.value })}
                placeholder="Enter this part's question…"
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </div>
            {part.type === "mcq" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Options (2–4)</label>
                  {["A", "B", "C", "D"].map((letter, i) => (
                    <input
                      key={letter}
                      type="text"
                      value={part.options[i] ?? ""}
                      onChange={(e) => {
                        const next = [...part.options];
                        while (next.length < 4) next.push("");
                        next[i] = e.target.value;
                        updatePart(index, { options: next });
                      }}
                      placeholder={`Option ${letter}`}
                      style={{ ...fieldStyle, marginBottom: 6 }}
                    />
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Correct option</label>
                  <select
                    value={part.correctIndex}
                    onChange={(e) => updatePart(index, { correctIndex: parseInt(e.target.value, 10) })}
                    style={fieldStyle}
                  >
                    {["A", "B", "C", "D"].map((letter, i) => (
                      <option key={letter} value={i}>
                        Option {letter}
                        {part.options[i]?.trim() ? ` — ${part.options[i].trim().slice(0, 40)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                Mark scheme {part.type === "mcq" ? "(optional)" : ""}
              </label>
              <textarea
                value={part.markScheme}
                onChange={(e) => updatePart(index, { markScheme: e.target.value })}
                placeholder="One mark-scheme point per line…"
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addPart}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#4f46e5",
            background: "white",
            border: "1px dashed #4f46e5",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          + Add part
        </button>
      </div>
    </>
  );
}

/** Set `REACT_APP_DEBUG_EXAM_BANK=true` in `.env.local` to enable fetch logging (only when `NODE_ENV === "development"`). */
const DEBUG_EXAM_BANK = process.env.REACT_APP_DEBUG_EXAM_BANK === "true";

type ExamQuestion = {
  _id: string;
  subject: string;
  examBoard?: string;
  level?: string;
  topic?: string;
  topicKey?: string | null;
  unitKey?: string | null;
  type: string;
  marks: number;
  question: string;
  /** From POST /api/uploads/lesson-media — optional stem image */
  imageUrl?: string | null;
  options?: string[];
  correctIndex?: number | null;
  correctAnswer?: string | null;
  markScheme?: string[];
  status: string;
  questionMode?: "single" | "composite" | string;
  title?: string | null;
  sharedStem?: string | null;
  totalMarks?: number | null;
  parts?: Array<{
    label?: string;
    type?: string;
    marks?: number;
    questionText?: string;
    options?: string[];
    correctIndex?: number | null;
    markScheme?: string[];
  }>;
  reviewFlags?: string[];
  metadata?: {
    qualityScore?: number;
    qualityBand?: "high" | "medium" | "low";
    qualityFlags?: string[];
    [k: string]: unknown;
  };
  createdAt?: string;
  updatedAt?: string;
};

const TeacherExamQuestionBankPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const topicKeyFromUrl = searchParams.get("topicKey") ?? "";
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchGenRef = React.useRef(0);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgePreview, setPurgePreview] = useState<{ count: number } | null>(null);
  const [publishErrorById, setPublishErrorById] = useState<Record<string, string>>({});
  const [aiRewriteErrorById, setAiRewriteErrorById] = useState<Record<string, string>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const saveErrorRef = useRef<HTMLDivElement | null>(null);
  const [filterTopicKey, setFilterTopicKey] = useState<string>(topicKeyFromUrl);
  const [aiLessonAssetsOnly, setAiLessonAssetsOnly] = useState(false);
  const [lessonIdFilter, setLessonIdFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "published">("");
  const [sortBy, setSortBy] = useState<"updatedAt" | "qualityScore">("updatedAt");
  const [qualityBand, setQualityBand] = useState<"" | "high" | "medium" | "low">("");
  const [aiRewriteLoadingId, setAiRewriteLoadingId] = useState<string | null>(null);
  const [publishLoadingId, setPublishLoadingId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomy } = useTaxonomy(specKey);
  const [form, setForm] = useState<ExamBankForm>(() => {
    const d = examBankDefaultFormFields(getStoredSpecKey());
    return {
      subject: d.subject,
      examBoard: d.examBoard,
      level: d.level,
      topic: "",
      topicKey: "",
      questionType: "short" as (typeof QUESTION_TYPES)[number],
      marks: 2,
      questionText: "",
      correctAnswerMarkScheme: "",
      mcqOptions: ["", "", "", "", ""] as string[],
      correctIndex: 0,
      imageUrl: "",
      questionMode: "single" as "single" | "composite",
      sharedStem: "",
      title: "",
      parts: [] as CompositePartForm[],
    };
  });

  const topicOptionGroups = React.useMemo(() => getTaxonomyOptionGroups(taxonomy), [taxonomy]);
  const keyToTopic = React.useMemo(() => getTaxonomyKeyToTopic(taxonomy), [taxonomy]);

  const defaultForm = React.useMemo<ExamBankForm>(() => {
    const d = examBankDefaultFormFields(specKey);
    return {
      subject: d.subject,
      examBoard: d.examBoard,
      level: d.level,
      topic: "",
      topicKey: "",
      questionType: "short" as (typeof QUESTION_TYPES)[number],
      marks: 2,
      questionText: "",
      correctAnswerMarkScheme: "",
      mcqOptions: ["", "", "", "", ""] as string[],
      correctIndex: 0,
      imageUrl: "",
      questionMode: "single" as "single" | "composite",
      sharedStem: "",
      title: "",
      parts: [] as CompositePartForm[],
    };
  }, [specKey]);

  const fetchQuestions = useCallback(async () => {
    const gen = ++fetchGenRef.current;
    if (process.env.NODE_ENV === "development" && DEBUG_EXAM_BANK) {
      console.log("fetchQuestions triggered with:", {
        filterTopicKey,
        aiLessonAssetsOnly,
        lessonIdFilter,
        statusFilter,
        sortBy,
        qualityBand,
      });
    }
    try {
      const params: Record<string, string> = {};
      if (filterTopicKey) params.topicKey = filterTopicKey;
      if (aiLessonAssetsOnly) {
        params.metadataSource = "ai_lesson_assets";
        params.generationType = "exam";
      }
      if (lessonIdFilter.trim()) params.lessonId = lessonIdFilter.trim();
      if (statusFilter) params.status = statusFilter;
      if (sortBy === "qualityScore") params.sortBy = "qualityScore";
      if (qualityBand) params.qualityBand = qualityBand;
      const res = await api.get("/exam-questions", { params });
      if (gen !== fetchGenRef.current) return;
      const data = res?.data;
      setQuestions(Array.isArray(data?.questions) ? data.questions : []);
      setLoadError(null);
    } catch (err: unknown) {
      if (gen !== fetchGenRef.current) return;
      setLoadError(getApiClientErrorMessage(err, "Failed to load questions"));
      setQuestions([]);
    } finally {
      if (gen === fetchGenRef.current) setLoading(false);
    }
  }, [filterTopicKey, aiLessonAssetsOnly, lessonIdFilter, statusFilter, sortBy, qualityBand]);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
  };

  // Pre-set topic / AI filters from URL (e.g. "Review exam drafts"). Functional updates avoid redundant setState when already in sync.
  useEffect(() => {
    const key = searchParams.get("topicKey");
    if (key) setFilterTopicKey((prev) => (prev === key ? prev : key));
    const ms = searchParams.get("metadataSource");
    if (ms === "ai_lesson_assets") {
      setAiLessonAssetsOnly((prev) => (prev ? prev : true));
      setSortBy((prev) => (prev === "qualityScore" ? prev : "qualityScore"));
    }
  }, [searchParams]);

  useEffect(() => {
    if (aiLessonAssetsOnly) setSortBy((prev) => (prev === "qualityScore" ? prev : "qualityScore"));
  }, [aiLessonAssetsOnly]);

  // Runs when fetchQuestions identity changes — that only happens when filter deps in useCallback change (not every render).
  useEffect(() => {
    setLoading(true);
    void fetchQuestions();
  }, [fetchQuestions]);

  function validateForm(): string | null {
    if (!form.topicKey?.trim()) {
      return "Cannot save: select a topic from the taxonomy list (canonical topicKey required for Exam Practice to match lessons).";
    }
    if (form.questionMode === "composite") {
      if (!form.sharedStem.trim()) return "Add a shared question stem for the composite question.";
      if (!form.parts.length) return "Add at least one part (a, b, c…).";
      for (const part of form.parts) {
        if (!part.questionText.trim()) return `Part (${part.label}) needs question text.`;
        if (!(part.marks > 0)) return `Part (${part.label}) needs at least 1 mark.`;
        if (part.type === "mcq") {
          const opts = part.options.map((s) => s.trim()).filter(Boolean);
          if (opts.length < 2) return `Part (${part.label}) MCQ needs at least 2 options.`;
          if (part.correctIndex < 0 || part.correctIndex >= opts.length) {
            return `Part (${part.label}) MCQ needs a selected correct option.`;
          }
        }
      }
      return null;
    }
    const q = form.questionText.trim();
    if (!q) return "Question text is required.";
    if (form.marks < 2) return "Marks must be at least 2 for Exam Question Bank entries.";
    if (form.questionType === "mcq") {
      const opts = form.mcqOptions.map((s) => s.trim()).filter(Boolean);
      if (opts.length < 2) return "MCQ requires at least 2 options.";
      if (opts.length > 5) return "MCQ allows at most 5 options.";
      if (form.correctIndex < 0 || form.correctIndex >= opts.length) return "Please select the correct option.";
    }
    // Draft save is intentionally lenient: publish-readiness (detailed mark scheme,
    // model answer, etc.) is enforced only when publishing, not when saving a draft.
    return null;
  }

  const onExamQuestionImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please choose an image file (PNG, JPEG, WebP, or GIF).");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageUploadError("Image must be 12MB or smaller.");
      return;
    }
    setImageUploadError(null);
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post<{ url?: string; ok?: boolean }>("/uploads/lesson-media", fd, {
        params: { folder: "exam-questions" },
      });
      const url = res.data?.url;
      if (!url || typeof url !== "string") throw new Error("Upload did not return a URL.");
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err: unknown) {
      setImageUploadError(getApiClientErrorMessage(err, "Image upload failed."));
    } finally {
      setImageUploading(false);
    }
  };

  const openCreateModal = (mode: "single" | "composite" = "single") => {
    setEditingId(null);
    setFormError(null);
    setImageUploadError(null);
    setForm(
      mode === "composite"
        ? { ...defaultForm, questionMode: "composite", parts: [makeEmptyPart(0)] }
        : defaultForm
    );
    setModalOpen(true);
  };

  const openEditModal = (q: ExamQuestion) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const mcqOptions = [...opts, "", "", "", "", ""].slice(0, 5) as [string, string, string, string, string];
    const isComposite = String(q.questionMode ?? "").toLowerCase() === "composite" || String(q.type ?? "") === "composite";
    const parts: CompositePartForm[] = isComposite && Array.isArray(q.parts)
      ? q.parts.map((p, i) => {
          const pOpts = Array.isArray(p.options) ? p.options.map((o) => String(o ?? "")) : [];
          return {
            label: p.label || (PART_LABELS[i] ?? String(i + 1)),
            type: (String(p.type).toLowerCase() === "mcq" ? "mcq" : "short") as (typeof PART_TYPES)[number],
            marks: typeof p.marks === "number" ? p.marks : 1,
            questionText: p.questionText || "",
            options: [...pOpts, "", "", "", ""].slice(0, Math.max(4, pOpts.length)),
            correctIndex: typeof p.correctIndex === "number" && p.correctIndex >= 0 ? p.correctIndex : 0,
            markScheme: Array.isArray(p.markScheme) ? p.markScheme.join("\n") : "",
          };
        })
      : [];
    setForm({
      ...defaultForm,
      subject: q.subject || "Biology",
      examBoard: q.examBoard || "AQA",
      level: q.level || "GCSE",
      topic: q.topic || "",
      topicKey: q.topicKey || "",
      questionType: (isComposite ? "short" : (q.type || "mcq")) as (typeof QUESTION_TYPES)[number],
      marks: q.marks ?? 1,
      questionText: isComposite ? "" : (q.question || ""),
      correctAnswerMarkScheme: Array.isArray(q.markScheme) ? q.markScheme.join("\n") : (q.correctAnswer != null ? String(q.correctAnswer) : ""),
      mcqOptions,
      correctIndex: q.correctIndex != null && q.correctIndex >= 0 ? q.correctIndex : 0,
      imageUrl: typeof q.imageUrl === "string" ? q.imageUrl : "",
      questionMode: isComposite ? "composite" : "single",
      sharedStem: isComposite ? (q.sharedStem || q.question || "") : "",
      title: isComposite ? (q.title || "") : "",
      parts,
    });
    setFormError(null);
    setImageUploadError(null);
    setEditingId(q._id);
    setModalOpen(true);
  };

  const handlePublishExam = async (id: string) => {
    setPublishLoadingId(id);
    setPublishErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const updated = await publishExamQuestion(id);
      setQuestions((prev) =>
        prev.map((x) => (x._id === id ? { ...x, ...(updated as ExamQuestion), status: String((updated as ExamQuestion).status || "published") } : x))
      );
      setPublishErrorById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e: unknown) {
      const ex = e as { message?: string; data?: { msg?: string; issues?: unknown[] } };
      let line = getApiClientErrorMessage(e, "Publish failed");
      const issues = ex.data?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const detail = issues
          .map((it: unknown) =>
            typeof it === "string" ? it : (it as { message?: string })?.message || (it as { msg?: string })?.msg
          )
          .filter(Boolean)
          .join(" · ");
        if (detail) line = `${line}${line.includes(detail) ? "" : ` · ${detail}`}`;
      }
      setPublishErrorById((prev) => ({ ...prev, [id]: line }));
    } finally {
      setPublishLoadingId(null);
    }
  };

  const handleAiRewriteExam = async (id: string, action: string) => {
    if (!action) return;
    setAiRewriteLoadingId(id);
    setAiRewriteErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const updated = (await aiRewriteExamQuestion(id, action)) as ExamQuestion;
      setQuestions((prev) => prev.map((x) => (x._id === id ? { ...x, ...updated } : x)));
    } catch (e: unknown) {
      setAiRewriteErrorById((prev) => ({
        ...prev,
        [id]: getApiClientErrorMessage(e, "AI rewrite failed"),
      }));
    } finally {
      setAiRewriteLoadingId(null);
    }
  };

  const handlePurgeDryRun = async () => {
    setPurgeBusy(true);
    setPurgePreview(null);
    try {
      const res = await api.post<{ success?: boolean; count?: number }>(
        "/exam-questions/bulk/purge-invalid-ai-exam-drafts",
        { dryRun: true }
      );
      setPurgePreview({ count: Number(res.data?.count ?? 0) });
    } catch (e: unknown) {
      alert(getApiClientErrorMessage(e, "Could not preview cleanup"));
    } finally {
      setPurgeBusy(false);
    }
  };

  const handlePurgeConfirm = async () => {
    if (!purgePreview || purgePreview.count < 1) return;
    if (!window.confirm(`Permanently delete ${purgePreview.count} unpublishable AI exam draft(s)? This cannot be undone.`)) return;
    setPurgeBusy(true);
    try {
      await api.post("/exam-questions/bulk/purge-invalid-ai-exam-drafts", { confirm: true });
      setPurgePreview(null);
      await fetchQuestions();
    } catch (e: unknown) {
      alert(getApiClientErrorMessage(e, "Cleanup failed"));
    } finally {
      setPurgeBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      requestAnimationFrame(() => {
        saveErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }
    setFormError(null);
    try {
      setSaving(true);
      const levelForSave = resolveExamQuestionLevelForSave({
        specKey,
        topicKey: form.topicKey,
        level: form.level,
      });
      const sharedMeta = {
        subject: form.subject,
        examBoard: form.examBoard || undefined,
        level: levelForSave || form.level || undefined,
        topic: form.topic || undefined,
        topicKey: form.topicKey?.trim() || undefined,
        specKey: specKey || undefined,
      };
      let payload: Record<string, unknown>;
      if (form.questionMode === "composite") {
        payload = {
          ...sharedMeta,
          questionMode: "composite",
          title: form.title.trim() || undefined,
          sharedStem: form.sharedStem.trim(),
          parts: form.parts.map((p) => {
            const opts = p.options.map((s) => s.trim()).filter(Boolean);
            const ms = p.markScheme.split("\n").map((s) => s.trim()).filter(Boolean);
            return {
              label: p.label,
              type: p.type,
              marks: p.marks,
              questionText: p.questionText.trim(),
              options: p.type === "mcq" ? opts : [],
              correctIndex: p.type === "mcq" ? p.correctIndex : null,
              markScheme: ms,
            };
          }),
        };
      } else {
        const markScheme = form.correctAnswerMarkScheme
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        const mcqOpts = form.questionType === "mcq"
          ? form.mcqOptions.map((s) => s.trim()).filter(Boolean)
          : [];
        const correctIdx = form.questionType === "mcq" ? form.correctIndex : undefined;
        const correctAnswerVal = form.questionType === "mcq"
          ? (mcqOpts[correctIdx!] ?? null)
          : (form.correctAnswerMarkScheme.trim() || null);
        payload = {
          ...sharedMeta,
          type: form.questionType,
          marks: form.marks,
          question: form.questionText.trim(),
          correctAnswer: correctAnswerVal,
          correctIndex: correctIdx,
          markScheme: form.questionType === "mcq" ? [] : (markScheme.length ? markScheme : []),
          options: form.questionType === "mcq" ? mcqOpts : [],
        };
      }
      const trimmedImg = form.imageUrl.trim();
      if (trimmedImg) payload.imageUrl = trimmedImg;
      else if (editingId) payload.imageUrl = null;
      if (editingId) {
        await api.put(`/exam-questions/${editingId}`, payload);
        setEditingId(null);
      } else {
        await api.post("/exam-questions", payload);
      }
      setModalOpen(false);
      setForm(defaultForm);
      await fetchQuestions();
    } catch (err: any) {
      alert(err?.message || "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="teacher-exam-question-bank"
      style={{ padding: "1.5rem", maxWidth: "min(1280px, 100%)", margin: "0 auto", minHeight: "100vh", boxSizing: "border-box" }}
    >
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          to="/teacher-dashboard"
          style={{
            textDecoration: "none",
            color: "#4f46e5",
            fontSize: "0.95rem",
            display: "inline-block",
            marginBottom: "0.75rem",
          }}
        >
          ← Back to Teacher Dashboard
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", color: "#111827" }}>Exam Question Bank</h1>
          <p style={{ margin: "0.35rem 0 0", color: "#6b7280", fontSize: "1rem" }}>
            Create, edit, and organise exam questions
          </p>
          <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: "0.875rem", maxWidth: 720, lineHeight: 1.5 }}>
            <strong>Exam Bank</strong> is for longer structured answers (Explain, Describe, Compare…). Quick recall MCQs belong in the{" "}
            <Link to="/teacher/topic-banks/quizzes" style={{ color: "#4f46e5", fontWeight: 600 }}>
              Topic Quiz Bank
            </Link>
            . Publishing requires a solid mark scheme (see publish rules).
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => openCreateModal("single")}
            style={{
              padding: "10px 18px",
              background: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            + Create Question
          </button>
          <button
            type="button"
            onClick={() => openCreateModal("composite")}
            style={{
              padding: "10px 18px",
              background: "white",
              color: "#4f46e5",
              border: "1px solid #4f46e5",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            + Create Composite Question
          </button>
        </div>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <SpecSelector value={specKey} onChange={onSpecChange} />
        <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Filter by topic:</label>
        <select
          value={filterTopicKey}
          onChange={(e) => setFilterTopicKey(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d1d5db", minWidth: "220px" }}
        >
          <option value="">All topics</option>
          {topicOptionGroups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.topics.map((t) => (
                <option key={`${g.label}:${t.key}`} value={t.key}>{t.topic}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
          <input
            type="checkbox"
            checked={aiLessonAssetsOnly}
            onChange={(e) => setAiLessonAssetsOnly(e.target.checked)}
          />
          AI lesson drafts only
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }}>
          Lesson ID
          <input
            type="text"
            value={lessonIdFilter}
            onChange={(e) => setLessonIdFilter(e.target.value)}
            placeholder="optional"
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db", width: 200 }}
          />
        </label>
        <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Status:</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "draft" | "published")}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
        <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Sort:</label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "updatedAt" | "qualityScore")}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          <option value="updatedAt">Updated</option>
          <option value="qualityScore">Quality score</option>
        </select>
        <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>Band:</label>
        <select
          value={qualityBand}
          onChange={(e) => setQualityBand(e.target.value as "" | "high" | "medium" | "low")}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "10px",
          padding: "10px 12px",
          background: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#334155" }}>
          AI exam drafts (from lesson asset generation) that cannot be published:
        </span>
        <button
          type="button"
          disabled={purgeBusy}
          onClick={() => void handlePurgeDryRun()}
          style={{
            padding: "6px 12px",
            fontSize: "0.8125rem",
            background: "white",
            border: "1px solid #cbd5e1",
            borderRadius: "6px",
            cursor: purgeBusy ? "not-allowed" : "pointer",
          }}
        >
          {purgeBusy ? "Working…" : "Preview unpublishable"}
        </button>
        <button
          type="button"
          disabled={purgeBusy || !purgePreview || purgePreview.count < 1}
          onClick={() => void handlePurgeConfirm()}
          style={{
            padding: "6px 12px",
            fontSize: "0.8125rem",
            background: !purgePreview || purgePreview.count < 1 ? "#e5e7eb" : "#fee2e2",
            color: !purgePreview || purgePreview.count < 1 ? "#9ca3af" : "#991b1b",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            cursor: purgeBusy || !purgePreview || purgePreview.count < 1 ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          Delete listed drafts
        </button>
        {purgePreview != null && (
          <span style={{ fontSize: 12, color: "#64748b" }}>Preview: {purgePreview.count} draft(s) would be deleted.</span>
        )}
      </div>

      {loading && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Loading questions...</div>
      )}
      {loadError && !loading && questions.length === 0 && (
        <div style={{ padding: "1rem", marginBottom: "1rem", background: "#fef2f2", color: "#991b1b", borderRadius: "8px" }}>
          {loadError}
        </div>
      )}
      {!loading && questions.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th className="small">Subject</th>
                <th className="topic-col">Topic</th>
                <th className="small">Type</th>
                <th className="small">Marks</th>
                <th className="col-question">Question</th>
                <th className="col-options">Options</th>
                <th>Quality</th>
                <th className="status-col">Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q._id}>
                  <td className="small">{q.subject}</td>
                  <td className="topic-cell">
                    {q.topicKey ? (keyToTopic[q.topicKey] ?? q.topicKey) : (q.topic || "—")}
                  </td>
                  <td className="small">{q.type}</td>
                  <td className="small">{q.marks}</td>
                  <td className="question-cell">
                    {q.imageUrl ? (
                      <span title="Has question image" style={{ marginRight: 6 }} aria-hidden>
                        📷
                      </span>
                    ) : null}
                    {q.question || "—"}
                  </td>
                  <td className="options-cell">
                    {q.type === "mcq" && Array.isArray(q.options) && q.options.length > 0
                      ? q.options.map((opt, i) => (
                          <span key={i} style={{ display: "block", marginBottom: 4 }}>
                            {String.fromCharCode(65 + i)}: {opt}
                          </span>
                        ))
                      : "—"}
                  </td>
                  <td className="quality-cell">
                    {q.metadata?.qualityScore != null ? (
                      <span
                        style={{
                          fontWeight: 600,
                          padding: "2px 6px",
                          borderRadius: 4,
                          background:
                            q.metadata?.qualityBand === "high"
                              ? "#d1fae5"
                              : q.metadata?.qualityBand === "medium"
                              ? "#fef3c7"
                              : "#fee2e2",
                        }}
                        title="Heuristic quality (AI drafts)"
                      >
                        {q.metadata.qualityScore}
                        {q.metadata.qualityBand ? ` · ${q.metadata.qualityBand}` : ""}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="status-cell">
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                        <span>{q.status}</span>
                        {String(q.status).toLowerCase() === "draft" &&
                          (() => {
                            const pub = getExamPublishReadinessUi(q);
                            if (!pub.ok) {
                              return (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.3,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fcd34d",
                                    maxWidth: "100%",
                                  }}
                                >
                                  Needs improvement
                                </span>
                              );
                            }
                            return null;
                          })()}
                      </div>
                      {String(q.status).toLowerCase() === "draft" &&
                        (() => {
                          const pub = getExamPublishReadinessUi(q);
                          if (!pub.ok && pub.reasons.length) {
                            return (
                              <ul
                                style={{
                                  margin: 0,
                                  paddingLeft: 18,
                                  fontSize: 11,
                                  color: "#78350f",
                                  lineHeight: 1.45,
                                  maxWidth: 320,
                                }}
                              >
                                {pub.reasons.map((reason) => (
                                  <li key={reason}>{reason}</li>
                                ))}
                              </ul>
                            );
                          }
                          return null;
                        })()}
                    </div>
                    {Array.isArray(q.reviewFlags) && q.reviewFlags.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {q.reviewFlags.map((flag) => (
                          <span
                            key={flag}
                            style={{
                              fontSize: 10,
                              background: "#fef3c7",
                              color: "#92400e",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                            title="Heuristic review hint"
                          >
                            {flag.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      type="button"
                      onClick={() => openEditModal(q)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "0.875rem",
                        background: "#f3f4f6",
                        color: "#374151",
                        border: "1px solid #d1d5db",
                        borderRadius: "6px",
                        cursor: "pointer",
                        marginBottom: 8,
                        display: "block",
                      }}
                    >
                      Edit
                    </button>
                    {publishErrorById[q._id] && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#b91c1c",
                          marginBottom: 8,
                          lineHeight: 1.35,
                          maxWidth: 200,
                          wordBreak: "break-word",
                        }}
                      >
                        {publishErrorById[q._id]}
                      </div>
                    )}
                    {String(q.status).toLowerCase() !== "published" && (
                      <button
                        type="button"
                        onClick={() => void handlePublishExam(q._id)}
                        disabled={publishLoadingId === q._id}
                        style={{
                          padding: "6px 12px",
                          fontSize: "0.875rem",
                          background: publishLoadingId === q._id ? "#e5e7eb" : "#d1fae5",
                          color: publishLoadingId === q._id ? "#9ca3af" : "#065f46",
                          border: "1px solid #6ee7b7",
                          borderRadius: "6px",
                          cursor: publishLoadingId === q._id ? "not-allowed" : "pointer",
                          marginBottom: 8,
                          display: "block",
                          fontWeight: 600,
                        }}
                      >
                        {publishLoadingId === q._id ? "Publishing…" : "Publish"}
                      </button>
                    )}
                    {q.status === "draft" && (q.type === "mcq" || q.type === "short") && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 200 }}>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            e.target.value = "";
                            if (v) void handleAiRewriteExam(q._id, v);
                          }}
                          disabled={aiRewriteLoadingId === q._id}
                          style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #d8b4fe" }}
                        >
                          <option value="">AI improve…</option>
                          <option value="improve_mark_scheme">Improve mark scheme</option>
                          <option value="make_more_gcse_style">More GCSE-style</option>
                          <option value="make_easier">Make easier</option>
                          <option value="make_harder">Make harder</option>
                        </select>
                        {aiRewriteLoadingId === q._id && <span style={{ fontSize: 11, color: "#6b7280" }}>Working…</span>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && questions.length === 0 && !loadError && (
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            padding: "3rem 2rem",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", color: "#d1d5db", marginBottom: "1rem" }}>📝</div>
          <h3 style={{ margin: "0 0 0.5rem", color: "#374151" }}>No questions yet</h3>
          <p style={{ margin: 0, color: "#6b7280", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
            Click <strong>Create Question</strong> to add structured exam-style questions (short answer and other formats suitable for assessed responses — not quick quiz MCQs).
          </p>
        </div>
      )}

      {/* Create Question Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
          }}
          onClick={() => { setModalOpen(false); setEditingId(null); setImageUploadError(null); setForm(defaultForm); }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              overflow: "auto",
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem" }}>
              {form.questionMode === "composite"
                ? editingId
                  ? "Edit Composite Question"
                  : "Create Composite Question"
                : editingId
                ? "Edit Question"
                : "Create Question"}
            </h2>

            {formError && (
              <div style={{ marginBottom: "1rem", padding: "10px 12px", background: "#fef2f2", color: "#991b1b", borderRadius: "8px", fontSize: "0.9rem" }}>
                {formError}
              </div>
            )}

            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Subject</label>
                <select
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Exam board</label>
                <select
                  value={form.examBoard}
                  onChange={(e) => setForm((f) => ({ ...f, examBoard: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {EXAM_BOARDS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Level</label>
                <select
                  value={form.level}
                  onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>{getSpecTopicFieldLabel(specKey)}</label>
                <select
                  value={form.topicKey}
                  onChange={(e) => setForm((f) => ({ ...f, topicKey: e.target.value, topic: e.target.value ? (keyToTopic[e.target.value] ?? "") : "" }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                >
                  <option value="">— Select topic —</option>
                  {topicOptionGroups.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.topics.map((t) => (
                        <option key={`${g.label}:${t.key}`} value={t.key}>{t.topic}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Topic (free text, optional)</label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="e.g. Cell structure"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                />
              </div>
              {form.questionMode !== "composite" && (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Question type</label>
                    <select
                      value={form.questionType}
                      onChange={(e) => setForm((f) => ({ ...f, questionType: e.target.value as (typeof QUESTION_TYPES)[number] }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Marks</label>
                    <input
                      type="number"
                      min={2}
                      value={form.marks}
                      onChange={(e) => setForm((f) => ({ ...f, marks: Math.max(2, parseInt(e.target.value, 10) || 2) }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Question text</label>
                    <textarea
                      value={form.questionText}
                      onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
                      placeholder="Enter the question stem..."
                      rows={3}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", resize: "vertical" }}
                    />
                  </div>
                  {form.questionType === "mcq" && (
                    <>
                      <div>
                        <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Options (2–5)</label>
                        {["A", "B", "C", "D", "E"].map((letter, i) => (
                          <input
                            key={letter}
                            type="text"
                            value={form.mcqOptions[i] ?? ""}
                            onChange={(e) => setForm((f) => {
                              const next = [...(f.mcqOptions ?? ["", "", "", "", ""])];
                              next[i] = e.target.value;
                              return { ...f, mcqOptions: next };
                            })}
                            placeholder={`Option ${letter}`}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", marginBottom: "6px" }}
                          />
                        ))}
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Correct option</label>
                        <select
                          value={form.correctIndex}
                          onChange={(e) => setForm((f) => ({ ...f, correctIndex: parseInt(e.target.value, 10) }))}
                          style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db" }}
                        >
                          {["A", "B", "C", "D", "E"].map((letter, i) => (
                            <option key={letter} value={i}>Option {letter}{form.mcqOptions[i]?.trim() ? ` — ${form.mcqOptions[i].trim().slice(0, 40)}${(form.mcqOptions[i].trim().length > 40 ? "…" : "")}` : ""}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  {form.questionType !== "mcq" && (
                    <div>
                      <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>Correct answer / mark scheme</label>
                      <textarea
                        value={form.correctAnswerMarkScheme}
                        onChange={(e) => setForm((f) => ({ ...f, correctAnswerMarkScheme: e.target.value }))}
                        placeholder="Model answer or mark scheme points..."
                        rows={3}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d1d5db", resize: "vertical" }}
                      />
                    </div>
                  )}
                </>
              )}
              {form.questionMode === "composite" && (
                <CompositePartsEditor form={form} setForm={setForm} />
              )}
              <div>
                <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
                  Question image (optional)
                </label>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280" }}>
                  Shown above the question stem in Exam Practice. PNG, JPEG, WebP, or GIF — max ~12MB.
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  disabled={imageUploading || saving}
                  onChange={(e) => void onExamQuestionImageSelected(e)}
                  style={{ fontSize: 13, marginBottom: 8 }}
                />
                {imageUploading && <p style={{ margin: "4px 0", fontSize: 12, color: "#6b7280" }}>Uploading…</p>}
                {imageUploadError && (
                  <p style={{ margin: "4px 0 8px", fontSize: 12, color: "#b91c1c" }}>{imageUploadError}</p>
                )}
                {form.imageUrl.trim() ? (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={makeAbsoluteAssetUrl(form.imageUrl.trim())}
                      alt="Question illustration preview"
                      style={{
                        maxWidth: "100%",
                        maxHeight: 200,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                        display: "block",
                      }}
                    />
                    <button
                      type="button"
                      disabled={saving || imageUploading}
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      style={{
                        marginTop: 8,
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#b91c1c",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        borderRadius: 6,
                        cursor: saving || imageUploading ? "not-allowed" : "pointer",
                      }}
                    >
                      Remove image
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {formError && (
              <div
                ref={saveErrorRef}
                role="alert"
                style={{ marginTop: "1.25rem", padding: "10px 12px", background: "#fef2f2", color: "#991b1b", borderRadius: "8px", fontSize: "0.9rem" }}
              >
                {formError}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => { setModalOpen(false); setEditingId(null); setImageUploadError(null); setForm(defaultForm); }}
                style={{
                  padding: "8px 16px",
                  background: "white",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                style={{
                  padding: "8px 16px",
                  background: saving ? "#e5e7eb" : "#4f46e5",
                  color: saving ? "#9ca3af" : "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : "Save Draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherExamQuestionBankPage;
