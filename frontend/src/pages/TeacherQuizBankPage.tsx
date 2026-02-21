/**
 * PR-Q1: Topic Quiz Bank — teacher/admin manage MCQ questions by topicKey.
 * Route: /teacher/topic-banks/quizzes
 */
import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";
import {
  listTopicQuizQuestions,
  previewBulkImportTopicQuizQuestions,
  bulkCreateTopicQuizQuestions,
  publishTopicQuizQuestion,
  unpublishTopicQuizQuestion,
  bulkPublishTopicQuizQuestions,
  bulkUnpublishTopicQuizQuestions,
  deleteTopicQuizQuestion,
  type TopicQuizQuestion,
  type BulkPreviewResponse,
  type QuizKind,
} from "../api/topicQuizQuestions";
import { getQuestionAnalytics } from "../api/teacherAnalytics";

type TaxonomyUnit = { unit: string; topics: { topic: string; key: string }[] };

const TeacherQuizBankPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const kindFromUrl = (searchParams.get("kind") || "quiz").toLowerCase() as QuizKind;
  const initialKind: QuizKind = kindFromUrl === "assessment" ? "assessment" : "quiz";

  const [taxonomy, setTaxonomy] = useState<{ units: TaxonomyUnit[] } | null>(null);
  const [topicKey, setTopicKey] = useState<string>("");
  const [kind, setKind] = useState<QuizKind>(initialKind);
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");

  useEffect(() => {
    setKind(initialKind);
  }, [kindFromUrl]);
  const [questions, setQuestions] = useState<TopicQuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importText, setImportText] = useState("");
  const [dedupeMode, setDedupeMode] = useState<"skip" | "error" | "allow">("skip");
  const [previewResult, setPreviewResult] = useState<BulkPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [topicAccuracy, setTopicAccuracy] = useState<number | null>(null);

  useEffect(() => {
    api.get("/taxonomy/aqa-gcse-biology").then((res) => setTaxonomy(res?.data ?? null)).catch(() => setTaxonomy(null));
  }, []);

  const fetchQuestions = async () => {
    if (!topicKey) {
      setQuestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listTopicQuizQuestions(topicKey, { status: statusFilter, mineOnly: true, kind });
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
  }, [topicKey, statusFilter]);

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
      const items = previewResult.previewItems.map((x) => ({
        questionText: x.questionText,
        choices: x.choices,
        correctIndex: x.correctIndex,
        explanation: x.explanation,
        tags: x.tags,
      }));
      const result = await bulkCreateTopicQuizQuestions({ topicKey, items, dedupeMode, kind });
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
    setBulkLoading(true);
    try {
      const res = await bulkPublishTopicQuizQuestions(Array.from(selectedIds));
      setMessage(`Published ${res.updatedCount} question(s).`);
      setSelectedIds(new Set());
      fetchQuestions();
    } catch (err: any) {
      setMessage(err?.response?.status === 404 ? "Some items could not be updated." : (err?.response?.data?.error || err?.message || "Bulk publish failed"));
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

  const allTopics = taxonomy?.units?.flatMap((u) => u.topics || []) ?? [];

  function getCorrectLabel(q: TopicQuizQuestion) {
    const labels = "ABCDEF";
    return q.correctIndex >= 0 && q.correctIndex < q.choices.length ? labels[q.correctIndex] : "?";
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
          Topic {kind === "assessment" ? "Assessment" : "Quiz"} Bank
        </h1>
      </div>
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

      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Topic</label>
        <select
          value={topicKey}
          onChange={(e) => setTopicKey(e.target.value)}
          style={{ padding: "8px 12px", minWidth: 260, borderRadius: 8, border: "1px solid #d1d5db" }}
        >
          <option value="">— Select topic —</option>
          {allTopics.map((t) => (
            <option key={t.key} value={t.key}>
              {t.topic}
            </option>
          ))}
        </select>
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

      <div style={{ display: "grid", gap: 24 }}>
        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Import</h2>
          {!topicKey && <p style={{ color: "#6b7280", marginBottom: 12 }}>Enter a topicKey to preview/import.</p>}
          <div style={{ marginBottom: 12 }}>
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
          <textarea
            placeholder={
              importFormat === "json"
                ? '[{"questionText":"What is diffusion?","choices":["A","B","C"],"correctIndex":0}]'
                : "questionText,choiceA,choiceB,choiceC,choiceD,correct,tags\nWhat is mitosis?,A,B,C,D,B,cell-cycle"
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
                      <li key={i} style={{ marginBottom: 4 }}>{item.questionText.slice(0, 80)}{item.questionText.length > 80 ? "…" : ""} → correct: {String.fromCharCode(65 + item.correctIndex)}</li>
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

        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Questions {topicKey ? `(${questions.length})` : ""}
              {topicAccuracy != null && (
                <span style={{ marginLeft: 12, fontSize: 13, fontWeight: 500, color: "#6b7280" }}>
                  · Topic % correct: {Math.round(topicAccuracy)}%
                </span>
              )}
            </h2>
            {topicKey && !loading && questions.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
              </div>
            )}
          </div>
          {!topicKey && <p style={{ color: "#6b7280" }}>Select a topic to list questions.</p>}
          {topicKey && loading && <p>Loading…</p>}
          {topicKey && !loading && questions.length === 0 && <p style={{ color: "#6b7280" }}>No questions yet. Import above.</p>}
          {topicKey && !loading && questions.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {questions.map((q) => (
                <li
                  key={q._id}
                  style={{
                    padding: "10px 12px",
                    marginBottom: 8,
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1, minWidth: 0, cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedIds.has(q._id)} onChange={() => toggleSelect(q._id)} style={{ marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{q.questionText.length > 120 ? q.questionText.slice(0, 120) + "…" : q.questionText}</div>
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {q.choices.map((c, i) => (
                        <span key={i} style={{ marginRight: 8 }}>{String.fromCharCode(65 + i)}: {c.length > 40 ? c.slice(0, 40) + "…" : c}</span>
                      ))}
                    </div>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>Correct: {getCorrectLabel(q)} · {q.status}</span>
                  </div>
                  </label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {q.status === "draft" ? (
                      <button type="button" onClick={() => handlePublish(q._id)} disabled={!!actionLoading} style={{ padding: "4px 8px", fontSize: 12, color: "#059669" }}>
                        {actionLoading === q._id ? "…" : "Publish"}
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleUnpublish(q._id)} disabled={!!actionLoading} style={{ padding: "4px 8px", fontSize: 12, color: "#6b7280" }}>
                        {actionLoading === q._id ? "…" : "Unpublish"}
                      </button>
                    )}
                    <button type="button" onClick={() => handleDelete(q._id)} disabled={!!actionLoading} style={{ padding: "4px 8px", fontSize: 12, color: "#dc2626" }}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeacherQuizBankPage;
