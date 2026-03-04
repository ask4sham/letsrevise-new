/**
 * PR-Q1: Topic Quiz Bank — teacher/admin manage MCQ questions by topicKey.
 * Route: /teacher/topic-banks/quizzes
 */
import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  listTopicQuizQuestions,
  previewBulkImportTopicQuizQuestions,
  bulkCreateTopicQuizQuestions,
  publishTopicQuizQuestion,
  unpublishTopicQuizQuestion,
  bulkPublishTopicQuizQuestions,
  bulkUnpublishTopicQuizQuestions,
  deleteTopicQuizQuestion,
  patchTopicQuizQuestion,
  type TopicQuizQuestion,
  type BulkPreviewResponse,
  type QuizKind,
  type QuizQuestionType,
  type BulkCreateQuizItem,
} from "../api/topicQuizQuestions";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getQuestionAnalytics } from "../api/teacherAnalytics";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import type { SpecKey } from "../api/taxonomy";

type TaxonomyUnit = { unit: string; topics: { topic: string; key: string }[] };

const TeacherQuizBankPage: React.FC = () => {
  const { user } = useCurrentUser({ watchLocation: true });
  const userType = (user?.userType || user?.type || "").toString().toLowerCase();
  const isAdmin = userType === "admin" || (user as { isAdmin?: boolean })?.isAdmin === true;
  const canManageQuizBank = isAdmin || userType === "teacher";

  const [searchParams] = useSearchParams();
  const kindFromUrl = (searchParams.get("kind") || "quiz").toLowerCase() as QuizKind;
  const initialKind: QuizKind = kindFromUrl === "assessment" ? "assessment" : "quiz";
  const topicKeyFromUrl = searchParams.get("topicKey") ?? "";

  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomy } = useTaxonomy(specKey);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [topicKey, setTopicKey] = useState<string>("");
  const [kind, setKind] = useState<QuizKind>(initialKind);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");

  useEffect(() => {
    setKind(initialKind);
  }, [kindFromUrl]);

  /** Deep-link: pre-select topic from URL (?topicKey=...) when coming from lesson editor */
  useEffect(() => {
    if (!topicKeyFromUrl || !taxonomy?.units) return;
    const units = taxonomy.units ?? [];
    setTopicKey(topicKeyFromUrl);
    const unitContaining = units.find((u: TaxonomyUnit) => (u.topics || []).some((t: { topic: string; key: string }) => t.key === topicKeyFromUrl));
    if (unitContaining) setSelectedUnit(unitContaining.unit);
  }, [topicKeyFromUrl, taxonomy?.units]);
  const [questions, setQuestions] = useState<TopicQuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [importType, setImportType] = useState<QuizQuestionType>("mcq");
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importText, setImportText] = useState("");
  const [dedupeMode, setDedupeMode] = useState<"skip" | "error" | "allow">("skip");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<{
    type: QuizQuestionType;
    questionText: string;
    choices: string[];
    correctIndex: number;
    acceptableAnswers: string[];
    matchMode: "exact" | "contains";
    explanation: string;
  }>({
    type: "mcq",
    questionText: "",
    choices: ["", ""],
    correctIndex: 0,
    acceptableAnswers: [""],
    matchMode: "contains",
    explanation: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<TopicQuizQuestion | null>(null);
  const [editForm, setEditForm] = useState<{
    type: QuizQuestionType;
    questionText: string;
    choices: string[];
    correctIndex: number;
    acceptableAnswers: string[];
    matchMode: "exact" | "contains";
    explanation: string;
  }>({
    type: "mcq",
    questionText: "",
    choices: ["", ""],
    correctIndex: 0,
    acceptableAnswers: [""],
    matchMode: "contains",
    explanation: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [previewResult, setPreviewResult] = useState<BulkPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [topicAccuracy, setTopicAccuracy] = useState<number | null>(null);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setSelectedUnit("");
    setTopicKey("");
  };

  const fetchQuestions = async () => {
    if (!topicKey) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listTopicQuizQuestions(topicKey, { specKey, status: statusFilter, mineOnly: true, kind });
      setQuestions(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load questions");
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [topicKey, specKey, statusFilter]);

  const handlePreview = async () => {
    if (!topicKey) {
      setMessage("Enter a topicKey to preview/import.");
      return;
    }
    if (!importText.trim()) {
      setMessage("Paste text to preview.");
      return;
    }
    setPreviewLoading(true);
    setMessage(null);
    setPreviewResult(null);
    try {
      const result = await previewBulkImportTopicQuizQuestions({
        topicKey,
        specKey,
        type: importType,
        format: importFormat,
        text: importText,
        dedupeMode,
        kind,
      });
      setPreviewResult(result);
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!topicKey || !previewResult || previewResult.summary.wouldCreate === 0) {
      setMessage("No new questions to import (all duplicates or invalid).");
      return;
    }
    setImportLoading(true);
    setMessage(null);
    try {
      const items: BulkCreateQuizItem[] = previewResult.previewItems.map((x) => {
        const type = (x.type === "short-answer" ? "short-answer" : "mcq") as QuizQuestionType;
        if (type === "short-answer") {
          return {
            type: "short-answer",
            questionText: x.questionText,
            acceptableAnswers: x.acceptableAnswers ?? [],
            matchMode: x.matchMode ?? "contains",
            explanation: x.explanation,
            tags: x.tags,
          };
        }
        return {
          type: "mcq",
          questionText: x.questionText,
          choices: x.choices ?? [],
          correctIndex: x.correctIndex ?? 0,
          explanation: x.explanation,
          tags: x.tags,
        };
      });
      const result = await bulkCreateTopicQuizQuestions({ topicKey, specKey, type: importType, items, dedupeMode, kind });
      setImportText("");
      setPreviewResult(null);
      setMessage(`Imported ${result.createdCount} draft(s). Skipped: ${result.skipped.duplicatesInPayload + result.skipped.duplicatesInDb} duplicate(s), ${result.skipped.invalid} invalid.`);
      fetchQuestions();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(questions.map((q) => q._id)));
  };
  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;
    const invalid = questions.filter((q) => selectedIds.has(q._id)).map((q) => ({ q, ...questionPublishable(q) })).filter((x) => !x.valid);
    if (invalid.length > 0) {
      setMessage(`Cannot publish: ${invalid.map((x) => `"${(x.q.questionText ?? "").slice(0, 40)}…": ${x.reason}`).join("; ")}`);
      return;
    }
    setBulkLoading(true);
    try {
      const res = await bulkPublishTopicQuizQuestions(Array.from(selectedIds));
      setMessage(`Published ${res.updatedCount} question(s).`);
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.errors && Array.isArray(data.errors)) {
        const lines = data.errors.map((e: { id?: string; questionText?: string; errors?: string[] }) =>
          `${(e.questionText ?? "").slice(0, 40)}…: ${(e.errors ?? []).join(", ")}`
        );
        setMessage(`Cannot publish: ${lines.join("; ")}`);
      } else {
        setMessage(err?.response?.status === 404 ? "Some items could not be updated." : (data?.message || data?.error || err?.message || "Bulk publish failed"));
      }
    } finally {
      setBulkLoading(false);
    }
  };
  const handleBulkUnpublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await bulkUnpublishTopicQuizQuestions(Array.from(selectedIds));
      setMessage(`Unpublished ${res.updatedCount} question(s).`);
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (err: any) {
      setMessage(err?.response?.status === 404 ? "Some items could not be updated." : (err?.response?.data?.error || err?.message || "Bulk unpublish failed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await publishTopicQuizQuestion(id);
      setQuestions((prev) => prev.map((q) => (q._id === id ? updated : q)));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Publish failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await unpublishTopicQuizQuestion(id);
      setQuestions((prev) => prev.map((q) => (q._id === id ? updated : q)));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Unpublish failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteTopicQuizQuestion(id);
      setQuestions((prev) => prev.filter((q) => q._id !== id));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (q: TopicQuizQuestion) => {
    const isShortAnswer = q.type === "short-answer" || (Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length > 0 && (!Array.isArray(q.choices) || q.choices.length < 2));
    setEditItem(q);
    setEditForm({
      type: isShortAnswer ? "short-answer" : "mcq",
      questionText: q.questionText ?? (q as { question?: string }).question ?? "",
      choices: Array.isArray(q.choices) && q.choices.length >= 2 ? [...q.choices] : ["", ""],
      correctIndex: q.correctIndex ?? 0,
      acceptableAnswers: Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length > 0 ? [...q.acceptableAnswers] : [""],
      matchMode: (q.matchMode as "exact" | "contains") ?? "contains",
      explanation: q.explanation ?? "",
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editItem) return;
    if (!editForm.questionText.trim()) {
      setMessage("Enter question text.");
      return;
    }
    if (editForm.type === "mcq") {
      const validChoices = editForm.choices.map((c) => c.trim()).filter(Boolean);
      if (validChoices.length < 2) {
        setMessage("MCQ needs at least 2 choices.");
        return;
      }
      if (editForm.correctIndex < 0 || editForm.correctIndex >= validChoices.length) {
        setMessage("Select a valid correct answer.");
        return;
      }
    } else {
      const validAnswers = editForm.acceptableAnswers.map((a) => a.trim()).filter(Boolean);
      if (validAnswers.length === 0) {
        setMessage("Short answer needs at least one acceptable answer.");
        return;
      }
    }
    setEditSaving(true);
    setMessage(null);
    try {
      if (editForm.type === "mcq") {
        const choices = editForm.choices.map((c) => c.trim()).filter(Boolean);
        await patchTopicQuizQuestion(editItem._id, {
          questionText: editForm.questionText.trim(),
          choices,
          correctChoice: String.fromCharCode(65 + editForm.correctIndex),
          explanation: editForm.explanation.trim() || undefined,
        });
      } else {
        await patchTopicQuizQuestion(editItem._id, {
          questionText: editForm.questionText.trim(),
          acceptableAnswers: editForm.acceptableAnswers.map((a) => a.trim()).filter(Boolean),
          matchMode: editForm.matchMode,
          explanation: editForm.explanation.trim() || undefined,
        });
      }
      setEditModalOpen(false);
      setEditItem(null);
      setMessage("Question saved.");
      fetchQuestions();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Save failed");
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!topicKey || !addForm.questionText.trim()) {
      setMessage("Select a topic and enter question text.");
      return;
    }
    if (addForm.type === "mcq") {
      const validChoices = addForm.choices.map((c) => c.trim()).filter(Boolean);
      if (validChoices.length < 2) {
        setMessage("MCQ needs at least 2 choices.");
        return;
      }
      if (addForm.correctIndex < 0 || addForm.correctIndex >= validChoices.length) {
        setMessage("Select a valid correct answer.");
        return;
      }
    } else {
      const validAnswers = addForm.acceptableAnswers.map((a) => a.trim()).filter(Boolean);
      if (validAnswers.length === 0) {
        setMessage("Short answer needs at least one acceptable answer.");
        return;
      }
    }
    setAddSaving(true);
    setMessage(null);
    try {
      const item: BulkCreateQuizItem =
        addForm.type === "mcq"
          ? {
              type: "mcq",
              questionText: addForm.questionText.trim(),
              choices: addForm.choices.map((c) => c.trim()).filter(Boolean),
              correctIndex: addForm.correctIndex,
              explanation: addForm.explanation.trim() || undefined,
            }
          : {
              type: "short-answer",
              questionText: addForm.questionText.trim(),
              acceptableAnswers: addForm.acceptableAnswers.map((a) => a.trim()).filter(Boolean),
              matchMode: addForm.matchMode,
              explanation: addForm.explanation.trim() || undefined,
            };
      await bulkCreateTopicQuizQuestions({
        topicKey,
        specKey,
        items: [item],
        dedupeMode: "skip",
        kind,
      });
      setAddModalOpen(false);
      setAddForm({
        type: "mcq",
        questionText: "",
        choices: ["", ""],
        correctIndex: 0,
        acceptableAnswers: [""],
        matchMode: "contains",
        explanation: "",
      });
      setMessage("Question added as draft.");
      fetchQuestions();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Add failed");
    } finally {
      setAddSaving(false);
    }
  };

  const units = taxonomy?.units ?? [];
  const topicsInUnit = selectedUnit ? units.find((u) => u.unit === selectedUnit)?.topics ?? [] : [];
  const allTopics = units.flatMap((u) => u.topics || []);

  function getCorrectLabel(q: TopicQuizQuestion) {
    const labels = "ABCDEF";
    return q.correctIndex >= 0 && q.correctIndex < q.choices.length ? labels[q.correctIndex] : "?";
  }

  function questionPublishable(q: TopicQuizQuestion): { valid: boolean; reason: string } {
    const text = String(q.questionText ?? (q as { question?: string }).question ?? "").trim();
    if (!text) return { valid: false, reason: "Question text is required" };
    const isShortAnswer = q.type === "short-answer" || (Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length > 0 && (!Array.isArray(q.choices) || q.choices.length < 2));
    if (isShortAnswer) {
      const answers = (q.acceptableAnswers ?? []).map((a) => String(a ?? "").trim()).filter(Boolean);
      if (answers.length === 0) return { valid: false, reason: "Short answer needs at least one model answer" };
    } else {
      const choices = (q.choices ?? []).map((c) => String(c ?? "").trim()).filter(Boolean);
      if (choices.length < 2) return { valid: false, reason: "MCQ needs ≥2 options" };
      const idx = q.correctIndex ?? 0;
      if (idx < 0 || idx >= choices.length) return { valid: false, reason: "MCQ needs a valid correct answer selected" };
    }
    return { valid: true, reason: "" };
  }

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          Topic {kind === "assessment" ? "Assessment" : "Quiz"} Bank
        </h1>
      </div>
      {!isAdmin && (
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#4b5563" }}>
          You can edit, save, and publish questions here. Admins control deletion.
        </p>
      )}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>Mode:</label>
        <button
          type="button"
          onClick={() => setKind("quiz")}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: kind === "quiz" ? "#eff6ff" : "#fff",
            fontWeight: kind === "quiz" ? 700 : 400,
            cursor: "pointer",
          }}
        >
          Quiz
        </button>
        <button
          type="button"
          onClick={() => setKind("assessment")}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: kind === "assessment" ? "#eff6ff" : "#fff",
            fontWeight: kind === "assessment" ? 700 : 400,
            cursor: "pointer",
          }}
        >
          Assessment
        </button>
        {kind === "assessment" && (
          <Link to="/teacher/topic-banks/quizzes" style={{ fontSize: 13, color: "#2563eb" }}>
            Switch to Quiz bank
          </Link>
        )}
        {kind === "quiz" && (
          <Link to="/teacher/topic-banks/quizzes?kind=assessment" style={{ fontSize: 13, color: "#2563eb" }}>
            Manage assessment bank →
          </Link>
        )}
      </div>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>
        Add {kind === "assessment" ? "assessment" : "quiz"} MCQ questions by topic. Bulk import from JSON or CSV, then publish when ready.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <SpecSelector value={specKey} onChange={onSpecChange} />
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Collection</label>
          <select
            value={selectedUnit}
            onChange={(e) => { setSelectedUnit(e.target.value); setTopicKey(""); }}
            style={{ padding: "8px 12px", minWidth: 220, borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">— Select collection —</option>
            {units.map((u) => (
              <option key={u.unit} value={u.unit}>{u.unit}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Topic</label>
          <select
            value={topicKey}
            onChange={(e) => setTopicKey(e.target.value)}
            style={{ padding: "8px 12px", minWidth: 260, borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">— Select topic —</option>
            {selectedUnit
              ? topicsInUnit.map((t) => (
                  <option key={t.key} value={t.key}>{t.topic}</option>
                ))
              : allTopics.map((t) => (
                  <option key={t.key} value={t.key}>{t.topic}</option>
                ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600, marginRight: 12 }}>Show:</label>
        {(["all", "draft", "published"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            style={{
              marginRight: 8,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #d1d5db",
              background: statusFilter === s ? "#eff6ff" : "#fff",
              fontWeight: statusFilter === s ? 700 : 400,
            }}
          >
            {s === "all" ? "All" : s === "draft" ? "Draft" : "Published"}
          </button>
        ))}
      </div>

      {message && (
        <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
          {message}
        </div>
      )}
      {error && (
        <div style={{ padding: 10, marginBottom: 12, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 24 }}>
        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, width: "100%", minWidth: 0 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Import</h2>
          {!topicKey && <p style={{ color: "#6b7280", marginBottom: 12 }}>Select a topic to preview/import.</p>}
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontWeight: 600, marginRight: 8 }}>Type:</label>
              <select
                value={importType}
                onChange={(e) => { setImportType(e.target.value as QuizQuestionType); setPreviewResult(null); }}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                <option value="mcq">MCQ</option>
                <option value="short-answer">Short Answer</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 600, marginRight: 8 }}>Format:</label>
              <select
                value={importFormat}
                onChange={(e) => setImportFormat(e.target.value as "json" | "csv")}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
          {importType === "mcq" && importFormat === "csv" && (
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
              CSV columns: topicKey, question, choiceA.., correctChoice, explanation
            </p>
          )}
          {importType === "short-answer" && (
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
              {importFormat === "csv"
                ? "CSV columns: topicKey, question, acceptableAnswers (use | separator), explanation"
                : "Short answer: acceptableAnswers with | separator; matchMode optional (exact | contains)."}
            </p>
          )}
          <textarea
            placeholder={
              importType === "short-answer"
                ? importFormat === "json"
                  ? '[{"type":"short-answer","questionText":"Name the organelle that contains DNA.","acceptableAnswers":["nucleus","the nucleus"],"matchMode":"contains"}]'
                  : "topicKey,question,acceptableAnswers,explanation\ndiffusion,Name the organelle.,nucleus|the nucleus,"
                : importFormat === "json"
                  ? '[{"questionText":"What is diffusion?","choices":["A","B","C"],"correctIndex":0}]'
                  : "topicKey,question,choiceA,choiceB,choiceC,choiceD,correctChoice,explanation\ndiffusion,What is mitosis?,A,B,C,D,B,"
            }
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setPreviewResult(null);
            }}
            rows={6}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontFamily: importFormat === "json" ? "monospace" : "inherit",
              fontSize: importFormat === "json" ? 13 : 14,
            }}
          />
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || !topicKey || !importText.trim()}
              style={{ padding: "8px 14px", borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              {previewLoading ? "Previewing…" : "Preview"}
            </button>
            <details style={{ fontSize: 13, color: "#6b7280" }}>
              <summary style={{ cursor: "pointer" }}>Advanced</summary>
              <div style={{ marginTop: 8 }}>
                <label>Dedupe mode: </label>
                <select
                  value={dedupeMode}
                  onChange={(e) => setDedupeMode(e.target.value as "skip" | "error" | "allow")}
                  style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db" }}
                >
                  <option value="skip">Skip duplicates</option>
                  <option value="error">Error if any duplicates</option>
                  <option value="allow">Allow all</option>
                </select>
              </div>
            </details>
          </div>

          {previewResult && (
            <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Preview results</h3>
              <div style={{ fontSize: 13, marginBottom: 12 }}>
                Total parsed: {previewResult.summary.totalParsed} · Valid: {previewResult.summary.validCount} · Invalid: {previewResult.summary.invalidCount} · Duplicates (payload): {previewResult.summary.duplicatesInPayload} · Duplicates (DB): {previewResult.summary.duplicatesInDb} · <strong>Would create: {previewResult.summary.wouldCreate}</strong>
              </div>
              {previewResult.summary.wouldCreate === 0 && (
                <p style={{ color: "#dc2626", fontSize: 13 }}>No new questions to import (all duplicates or invalid).</p>
              )}
              {previewResult.invalid.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>Invalid rows:</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "#991b1b" }}>
                    {previewResult.invalid.slice(0, 10).map((inv, i) => (
                      <li key={i}>#{inv.index}: {inv.reason} — {inv.raw.slice(0, 50)}…</li>
                    ))}
                    {previewResult.invalid.length > 10 && <li>…and {previewResult.invalid.length - 10} more</li>}
                  </ul>
                </div>
              )}
              {previewResult.previewItems.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>First {Math.min(10, previewResult.previewItems.length)} questions:</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12 }}>
                    {previewResult.previewItems.slice(0, 10).map((item, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {item.questionText.slice(0, 80)}{item.questionText.length > 80 ? "…" : ""}
                        {" → "}
                        {(item.type === "short-answer")
                          ? `Short answer: ${(item.acceptableAnswers ?? []).join(", ") || "—"}`
                          : `correct: ${String.fromCharCode(65 + (item.correctIndex ?? 0))}`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                type="button"
                onClick={handleImport}
                disabled={importLoading || previewResult.summary.wouldCreate === 0}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: previewResult.summary.wouldCreate > 0 ? "#059669" : "#9ca3af",
                  color: "#fff",
                  fontWeight: 600,
                  border: "none",
                  cursor: previewResult.summary.wouldCreate > 0 && !importLoading ? "pointer" : "not-allowed",
                }}
              >
                {importLoading ? "Importing…" : "Import (Create Drafts)"}
              </button>
            </div>
          )}
        </section>

        <section className="teacher-quiz-bank-questions-section" style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12, width: "100%", minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Questions {topicKey ? `(${questions.length})` : ""}
              {topicAccuracy != null && (
                <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 500, color: "#6b7280" }}>
                  · Topic % correct: {Math.round(topicAccuracy)}%
                </span>
              )}
            </h2>
            {topicKey && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(true)}
                  style={{ padding: "6px 12px", borderRadius: 8, background: "#059669", color: "#fff", fontWeight: 600, border: "none", cursor: "pointer" }}
                >
                  Add question
                </button>
                {!loading && questions.length > 0 && canManageQuizBank && (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, cursor: "pointer" }}>
                      <input type="checkbox" checked={selectedIds.size === questions.length && questions.length > 0} onChange={toggleSelectAll} />
                      Select all
                    </label>
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "publish") handleBulkPublish();
                        else if (v === "unpublish") handleBulkUnpublish();
                        e.target.value = "";
                      }}
                      disabled={selectedIds.size === 0 || bulkLoading}
                      style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
                    >
                      <option value="">Bulk actions</option>
                      <option value="publish">Publish selected ({selectedIds.size})</option>
                      <option value="unpublish">Unpublish selected ({selectedIds.size})</option>
                    </select>
                  </>
                )}
              </div>
            )}
          </div>
          {!topicKey && <p style={{ color: "#6b7280" }}>Select a topic to list questions.</p>}
          {topicKey && loading && <p>Loading…</p>}
          {topicKey && !loading && questions.length === 0 && <p style={{ color: "#6b7280" }}>No questions yet. Import above.</p>}
          {topicKey && !loading && questions.length > 0 && (
            <ul className="teacher-quiz-bank-questions-list" style={{ listStyle: "none", padding: 0, margin: 0, width: "100%", minWidth: 0 }}>
              {questions.map((q) => {
                const isShortAnswer = q.type === "short-answer" || (Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length > 0 && !(Array.isArray(q.choices) && q.choices.length >= 2));
                const publishCheck = questionPublishable(q);
                return (
                <li
                  key={q._id}
                  style={{
                    padding: "10px 12px",
                    marginBottom: 8,
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  {isAdmin && (
                    <label style={{ flexShrink: 0, marginTop: 2 }}>
                      <input type="checkbox" checked={selectedIds.has(q._id)} onChange={() => toggleSelect(q._id)} />
                    </label>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "#111827", wordBreak: "break-word", overflowWrap: "break-word" }}>
                      {q.questionText ?? (q as { question?: string }).question}
                    </div>
                    {isShortAnswer ? (
                      q.acceptableAnswers?.length ? (
                        <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 4, wordBreak: "break-word", overflowWrap: "break-word" }}>
                          <span style={{ fontWeight: 600 }}>Acceptable answers:</span>{" "}
                          {(q.acceptableAnswers ?? []).join(" • ")}
                        </div>
                      ) : null
                    ) : (
                      <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 4 }}>
                        {(q.choices ?? []).map((c, i) => (
                          <div key={i} style={{ wordBreak: "break-word", overflowWrap: "break-word" }}>
                            {String.fromCharCode(65 + i)}. {c}
                          </div>
                        ))}
                      </div>
                    )}
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                      {isShortAnswer ? `Match: ${q.matchMode ?? "contains"}` : `Correct: ${getCorrectLabel(q)}`} · {q.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => openEditModal(q)}
                      disabled={!!actionLoading}
                      style={{ padding: "4px 8px", fontSize: 12, color: "#2563eb", fontWeight: 600 }}
                    >
                      Edit
                    </button>
                    {canManageQuizBank && (
                      <>
                        {q.status === "draft" ? (
                          <button
                            type="button"
                            onClick={() => handlePublish(q._id)}
                            disabled={!!actionLoading || !publishCheck.valid}
                            title={!publishCheck.valid ? publishCheck.reason : undefined}
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                              color: publishCheck.valid ? "#059669" : "#9ca3af",
                              opacity: publishCheck.valid ? 1 : 0.7,
                              cursor: publishCheck.valid && !actionLoading ? "pointer" : "not-allowed",
                            }}
                          >
                            {actionLoading === q._id ? "…" : "Publish"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleUnpublish(q._id)}
                            disabled={!!actionLoading}
                            style={{ padding: "4px 8px", fontSize: 12, color: "#6b7280" }}
                          >
                            {actionLoading === q._id ? "…" : "Unpublish"}
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(q._id)}
                            disabled={!!actionLoading}
                            style={{ padding: "4px 8px", fontSize: 12, color: "#dc2626" }}
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {addModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => !addSaving && setAddModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Add quiz question</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Type</label>
              <select
                value={addForm.type}
                onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as QuizQuestionType }))}
                style={{ padding: "8px 12px", width: "100%", borderRadius: 8, border: "1px solid #d1d5db" }}
              >
                <option value="mcq">MCQ</option>
                <option value="short-answer">Short Answer</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Question</label>
              <textarea
                value={addForm.questionText}
                onChange={(e) => setAddForm((f) => ({ ...f, questionText: e.target.value }))}
                rows={3}
                placeholder="Question text…"
                style={{ padding: 8, width: "100%", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
              />
            </div>
            {addForm.type === "mcq" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Choices (2–6)</label>
                  {(addForm.choices.length < 6 ? [...addForm.choices, ""] : addForm.choices).map((choice, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 24, fontWeight: 600 }}>{String.fromCharCode(65 + i)}</span>
                      <input
                        type="text"
                        value={i < addForm.choices.length ? choice : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = [...addForm.choices];
                          while (next.length <= i) next.push("");
                          next[i] = val;
                          if (i === next.length - 1 && val && next.length < 6) next.push("");
                          const trimmed = next.filter((c, j) => j < next.length - 1 || (c && c.trim()));
                          setAddForm((f) => ({
                            ...f,
                            choices: trimmed.length >= 2 ? trimmed : trimmed.length === 1 ? [trimmed[0], ""] : ["", ""],
                            correctIndex: Math.min(f.correctIndex, Math.max(0, trimmed.length - 1)),
                          }));
                        }}
                        placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Correct answer</label>
                  <select
                    value={Math.min(addForm.correctIndex, Math.max(0, addForm.choices.filter((c) => c.trim()).length - 1))}
                    onChange={(e) => setAddForm((f) => ({ ...f, correctIndex: Number(e.target.value) }))}
                    style={{ padding: "8px 12px", width: "100%", borderRadius: 8, border: "1px solid #d1d5db" }}
                  >
                    {addForm.choices.filter((c) => c.trim()).length === 0 ? (
                      <option value={0}>— Add choices first —</option>
                    ) : (
                      addForm.choices.filter((c) => c.trim()).map((c, i) => (
                        <option key={i} value={i}>{String.fromCharCode(65 + i)}: {c.slice(0, 50)}{c.length > 50 ? "…" : ""}</option>
                      ))
                    )}
                  </select>
                </div>
              </>
            )}
            {addForm.type === "short-answer" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Acceptable answers (one per line or comma-separated)</label>
                  <textarea
                    value={addForm.acceptableAnswers.join("\n")}
                    onChange={(e) => setAddForm((f) => ({
                      ...f,
                      acceptableAnswers: e.target.value.split(/[\n,]/).map((a) => a.trim()).filter(Boolean).slice(0, 10) || [""],
                    }))}
                    rows={3}
                    placeholder="nucleus&#10;the nucleus"
                    style={{ padding: 8, width: "100%", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Match mode</label>
                  <select
                    value={addForm.matchMode}
                    onChange={(e) => setAddForm((f) => ({ ...f, matchMode: e.target.value as "exact" | "contains" }))}
                    style={{ padding: "8px 12px", width: "100%", borderRadius: 8, border: "1px solid #d1d5db" }}
                  >
                    <option value="contains">Contains (keyword/phrase)</option>
                    <option value="exact">Exact (normalized)</option>
                  </select>
                </div>
              </>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Explanation (optional)</label>
              <textarea
                value={addForm.explanation}
                onChange={(e) => setAddForm((f) => ({ ...f, explanation: e.target.value }))}
                rows={2}
                placeholder="Optional explanation shown after answer"
                style={{ padding: 8, width: "100%", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => !addSaving && setAddModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: addSaving ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={addSaving}
                style={{ padding: "8px 16px", borderRadius: 8, background: "#059669", color: "#fff", fontWeight: 600, border: "none", cursor: addSaving ? "not-allowed" : "pointer" }}
              >
                {addSaving ? "Saving…" : "Add draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && editItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => !editSaving && setEditModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 520,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>Edit question</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Type</label>
              <select
                value={editForm.type}
                onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as QuizQuestionType }))}
                style={{ padding: "8px 12px", width: "100%", borderRadius: 8, border: "1px solid #d1d5db" }}
              >
                <option value="mcq">MCQ</option>
                <option value="short-answer">Short Answer</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Question</label>
              <textarea
                value={editForm.questionText}
                onChange={(e) => setEditForm((f) => ({ ...f, questionText: e.target.value }))}
                rows={3}
                placeholder="Question text…"
                style={{ padding: 8, width: "100%", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
              />
            </div>
            {editForm.type === "mcq" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Choices (2–6)</label>
                  {(editForm.choices.length < 6 ? [...editForm.choices, ""] : editForm.choices).map((choice, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 24, fontWeight: 600 }}>{String.fromCharCode(65 + i)}</span>
                      <input
                        type="text"
                        value={i < editForm.choices.length ? choice : ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const next = [...editForm.choices];
                          while (next.length <= i) next.push("");
                          next[i] = val;
                          if (i === next.length - 1 && val && next.length < 6) next.push("");
                          const trimmed = next.filter((c, j) => j < next.length - 1 || (c && c.trim()));
                          setEditForm((f) => ({
                            ...f,
                            choices: trimmed.length >= 2 ? trimmed : trimmed.length === 1 ? [trimmed[0], ""] : ["", ""],
                            correctIndex: Math.min(f.correctIndex, Math.max(0, trimmed.length - 1)),
                          }));
                        }}
                        placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Correct answer</label>
                  <select
                    value={Math.min(editForm.correctIndex, Math.max(0, editForm.choices.filter((c) => c.trim()).length - 1))}
                    onChange={(e) => setEditForm((f) => ({ ...f, correctIndex: Number(e.target.value) }))}
                    style={{ padding: "8px 12px", width: "100%", borderRadius: 8, border: "1px solid #d1d5db" }}
                  >
                    {editForm.choices.filter((c) => c.trim()).length === 0 ? (
                      <option value={0}>— Add choices first —</option>
                    ) : (
                      editForm.choices.filter((c) => c.trim()).map((c, i) => (
                        <option key={i} value={i}>{String.fromCharCode(65 + i)}: {c.slice(0, 50)}{c.length > 50 ? "…" : ""}</option>
                      ))
                    )}
                  </select>
                </div>
              </>
            )}
            {editForm.type === "short-answer" && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Acceptable answers (one per line or comma-separated)</label>
                  <textarea
                    value={editForm.acceptableAnswers.join("\n")}
                    onChange={(e) => setEditForm((f) => ({
                      ...f,
                      acceptableAnswers: e.target.value.split(/[\n,]/).map((a) => a.trim()).filter(Boolean).slice(0, 10) || [""],
                    }))}
                    rows={3}
                    placeholder="nucleus&#10;the nucleus"
                    style={{ padding: 8, width: "100%", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Match mode</label>
                  <select
                    value={editForm.matchMode}
                    onChange={(e) => setEditForm((f) => ({ ...f, matchMode: e.target.value as "exact" | "contains" }))}
                    style={{ padding: "8px 12px", width: "100%", borderRadius: 8, border: "1px solid #d1d5db" }}
                  >
                    <option value="contains">Contains (keyword/phrase)</option>
                    <option value="exact">Exact (normalized)</option>
                  </select>
                </div>
              </>
            )}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 4 }}>Explanation (optional)</label>
              <textarea
                value={editForm.explanation}
                onChange={(e) => setEditForm((f) => ({ ...f, explanation: e.target.value }))}
                rows={2}
                placeholder="Optional explanation shown after answer"
                style={{ padding: 8, width: "100%", borderRadius: 8, border: "1px solid #d1d5db", resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => !editSaving && setEditModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: editSaving ? "not-allowed" : "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving}
                style={{ padding: "8px 16px", borderRadius: 8, background: "#059669", color: "#fff", fontWeight: 600, border: "none", cursor: editSaving ? "not-allowed" : "pointer" }}
              >
                {editSaving ? "Saving…" : "Save (Draft)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherQuizBankPage;
