/**
 * PR-F1: Topic Flashcard Bank — teacher/admin manage flashcards by topicKey.
 * Route: /teacher/topic-banks/flashcards
 */
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  listTopicFlashcards,
  createTopicFlashcard,
  bulkCreateTopicFlashcardsFromText,
  previewBulkImportTopicFlashcards,
  deleteTopicFlashcard,
  publishTopicFlashcard,
  unpublishTopicFlashcard,
  bulkPublishTopicFlashcards,
  bulkUnpublishTopicFlashcards,
  type TopicFlashcard,
  type ListParams,
  type BulkPreviewResponse,
} from "../api/topicFlashcards";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import type { SpecKey } from "../api/taxonomy";

/** Minimal auto-detect for backend format: "csv" | "newline". */
function detectFlashcardFormat(text: string): "csv" | "newline" {
  const t = text.trim();
  if (!t) return "newline";
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 5);
  const csvLikely = lines.some((l) => l.includes(","));
  const delimLikely = t.includes("::") || t.includes("--");
  if (delimLikely) return "newline";
  return csvLikely ? "csv" : "newline";
}

const TeacherFlashcardBankPage: React.FC = () => {
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomy } = useTaxonomy(specKey);
  const [selectedUnit, setSelectedUnit] = useState<string>("");
  const [topicKey, setTopicKey] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ListParams["status"]>("all");
  const [flashcards, setFlashcards] = useState<TopicFlashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [addFront, setAddFront] = useState("");
  const [addBack, setAddBack] = useState("");
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<BulkPreviewResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [dedupeMode, setDedupeMode] = useState<"skip" | "error" | "allow">("skip");
  const [formatOverride, setFormatOverride] = useState<"auto" | "csv" | "newline">("auto");
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setSelectedUnit("");
    setTopicKey("");
  };

  const fetchFlashcards = async () => {
    if (!topicKey) {
      setFlashcards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listTopicFlashcards({
        topicKey,
        specKey,
        status: statusFilter,
        mineOnly: true,
      });
      setFlashcards(list);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to load flashcards");
      setFlashcards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, [topicKey, specKey, statusFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const front = addFront.trim();
    const back = addBack.trim();
    if (!topicKey || !front || !back) {
      setMessage("Select a topic and enter front and back.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await createTopicFlashcard({ topicKey, specKey, front, back });
      setAddFront("");
      setAddBack("");
      setMessage("Card added.");
      fetchFlashcards();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to add");
    } finally {
      setSaving(false);
    }
  };

  const canImport = Boolean(specKey && topicKey);

  const runPreview = async () => {
    setImportError(null);
    setPreview(null);
    const text = importText.trim();
    if (!text) {
      setImportError("Paste your flashcards first.");
      return;
    }
    if (!canImport) {
      setImportError("Please select a Collection and Topic before importing.");
      return;
    }
    setIsPreviewLoading(true);
    try {
      const format = formatOverride === "auto" ? detectFlashcardFormat(text) : formatOverride;
      const res = await previewBulkImportTopicFlashcards({
        topicKey,
        specKey,
        format,
        text,
        dedupeMode,
        csvOptions: { skipEmptyLines: true },
      });
      setPreview(res);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Preview failed";
      setImportError(msg);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const runImport = async () => {
    setImportError(null);
    const text = importText.trim();
    if (!text) {
      setImportError("Paste your flashcards first.");
      return;
    }
    if (!canImport) {
      setImportError("Please select a Collection and Topic before importing.");
      return;
    }
    setIsImporting(true);
    try {
      const format = formatOverride === "auto" ? detectFlashcardFormat(text) : formatOverride;
      const result = await bulkCreateTopicFlashcardsFromText({
        topicKey,
        specKey,
        format,
        text,
        dedupeMode,
        csvOptions: { skipEmptyLines: true },
      });
      setImportText("");
      setPreview(null);
      setMessage(
        `Imported ${result.createdCount} draft(s). Skipped: ${result.skipped.duplicatesInPayload + result.skipped.duplicatesInDb} duplicate(s), ${result.skipped.invalid} invalid.`
      );
      fetchFlashcards();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.message || e?.message || "Import failed";
      setImportError(msg);
      setMessage(msg);
    } finally {
      setIsImporting(false);
    }
  };

  // Debounced auto-preview when paste/typing (400ms after last change)
  useEffect(() => {
    if (!importText.trim() || !topicKey) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      runPreview();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when text or topic changes
  }, [importText, topicKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === flashcards.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(flashcards.map((f) => f._id)));
  };
  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await bulkPublishTopicFlashcards(Array.from(selectedIds));
      setMessage(`Published ${res.updatedCount} card(s).`);
      setSelectedIds(new Set());
      fetchFlashcards();
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
      const res = await bulkUnpublishTopicFlashcards(Array.from(selectedIds));
      setMessage(`Unpublished ${res.updatedCount} card(s).`);
      setSelectedIds(new Set());
      fetchFlashcards();
    } catch (err: any) {
      setMessage(err?.response?.status === 404 ? "Some items could not be updated." : (err?.response?.data?.error || err?.message || "Bulk unpublish failed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await publishTopicFlashcard(id);
      setFlashcards((prev) => prev.map((f) => (f._id === id ? updated : f)));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Publish failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await unpublishTopicFlashcard(id);
      setFlashcards((prev) => prev.map((f) => (f._id === id ? updated : f)));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Unpublish failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteTopicFlashcard(id);
      setFlashcards((prev) => prev.filter((f) => f._id !== id));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Collections from taxonomy (full list; do not filter by existing flashcards)
  const units = taxonomy?.units ?? [];
  const topicsInUnit = selectedUnit ? units.find((u) => u.unit === selectedUnit)?.topics ?? [] : [];
  const allTopics = units.flatMap((u) => u.topics || []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Topic Flashcard Bank</h1>
      </div>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>
        Add flashcards by topic. New lessons for that topic will auto-seed from this bank; you can also load them into existing lessons from the lesson editor.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <SpecSelector value={specKey} onChange={onSpecChange} />
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Collection</label>
          <select
            value={selectedUnit}
            onChange={(e) => {
              setSelectedUnit(e.target.value);
              setTopicKey("");
            }}
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

      <div style={{ display: "grid", gap: 24 }}>
        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Add one card</h2>
          <form onSubmit={handleAdd}>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Front"
                value={addFront}
                onChange={(e) => setAddFront(e.target.value)}
                maxLength={500}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <textarea
                placeholder="Back"
                value={addBack}
                onChange={(e) => setAddBack(e.target.value)}
                maxLength={2000}
                rows={2}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <button type="submit" disabled={saving || !topicKey}>
              {saving ? "Adding…" : "Add card"}
            </button>
          </form>
        </section>

        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Import</h2>
          <p style={{ color: "#6b7280", marginBottom: 8, fontSize: 14 }}>
            Paste cards — we&apos;ll detect format automatically.
          </p>
          <p style={{ color: "#9ca3af", marginBottom: 12, fontSize: 12 }}>
            Examples: <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>Question TAB Answer</code> (TSV, most reliable)
            {" · "}
            <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>Front :: Back</code>
            {" · "}
            <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>Question,Answer</code> (CSV; use quotes if answer contains commas)
          </p>
          <textarea
            placeholder={"Diffusion :: Movement from high to low concentration\nOsmosis :: Movement of water across membrane\n\nOr CSV: Question (Paraphrased),Answer\nWhat is mitosis?,Division of the nucleus"}
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
            rows={6}
            style={{
              width: "100%",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
          {importError && (
            <div style={{ marginTop: 8, padding: 8, background: "#fef2f2", borderRadius: 6, color: "#991b1b", fontSize: 13 }}>
              {importError}
            </div>
          )}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={runPreview}
              disabled={!importText.trim() || !topicKey || isPreviewLoading}
              style={{ padding: "8px 14px", borderRadius: 8, background: "#2563eb", color: "#fff", fontWeight: 600, border: "none", cursor: importText.trim() && topicKey && !isPreviewLoading ? "pointer" : "not-allowed" }}
            >
              {isPreviewLoading ? "Previewing…" : "Preview"}
            </button>
            <details style={{ fontSize: 13, color: "#6b7280" }}>
              <summary style={{ cursor: "pointer" }}>Advanced</summary>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <span>
                  <label>Format: </label>
                  <select
                    value={formatOverride}
                    onChange={(e) => setFormatOverride(e.target.value as "auto" | "csv" | "newline")}
                    style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db" }}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="csv">CSV</option>
                    <option value="newline">Delimiter (:: / --)</option>
                  </select>
                </span>
                <span>
                  <label>Dedupe: </label>
                  <select
                    value={dedupeMode}
                    onChange={(e) => setDedupeMode(e.target.value as "skip" | "error" | "allow")}
                    style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db" }}
                  >
                    <option value="skip">Skip duplicates</option>
                    <option value="error">Error if any duplicates</option>
                    <option value="allow">Allow all</option>
                  </select>
                </span>
              </div>
            </details>
          </div>

          {preview && preview.ok && (
            <div style={{ marginTop: 16, padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>
                Detected: {formatOverride === "auto" ? (detectFlashcardFormat(importText) === "csv" ? "CSV" : "Delimiter (:: / --)") : formatOverride === "csv" ? "CSV" : "Delimiter (:: / --)"}
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
                Total parsed: {preview.summary.totalParsed} · Valid: {preview.summary.validCount} · Would create: <strong>{preview.summary.wouldCreate}</strong>
                {preview.summary.duplicatesInDb > 0 && ` · Already in bank: ${preview.summary.duplicatesInDb}`}
              </p>
              {preview.previewItems.length > 0 && (
                <table style={{ width: "100%", marginBottom: 12, fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: 4 }}>Front</th>
                      <th style={{ textAlign: "left", padding: 4 }}>Back</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewItems.slice(0, 10).map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: 4 }}>{item.front.slice(0, 60)}{item.front.length > 60 ? "…" : ""}</td>
                        <td style={{ padding: 4, color: "#4b5563" }}>{item.back.slice(0, 60)}{item.back.length > 60 ? "…" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <button
                type="button"
                onClick={runImport}
                disabled={!canImport || isImporting || preview.summary.wouldCreate === 0}
                title={!canImport ? "Select Collection and Topic first" : undefined}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: preview.summary.wouldCreate > 0 && !isImporting ? "#059669" : "#9ca3af",
                  color: "#fff",
                  fontWeight: 600,
                  border: "none",
                  cursor: preview.summary.wouldCreate > 0 && !isImporting ? "pointer" : "not-allowed",
                }}
              >
                {isImporting ? "Importing…" : `Import ${preview.summary.wouldCreate} cards`}
              </button>
            </div>
          )}
        </section>

        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
            Cards {topicKey ? `(${flashcards.length})` : ""}
          </h2>
          {!topicKey && <p style={{ color: "#6b7280" }}>Select a topic to list cards.</p>}
          {topicKey && loading && <p>Loading…</p>}
          {topicKey && !loading && flashcards.length === 0 && <p style={{ color: "#6b7280" }}>No cards yet. Add one above.</p>}
          {topicKey && !loading && flashcards.length > 0 && (
            <>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Bulk:</span>
                <button
                  type="button"
                  onClick={handleBulkPublish}
                  disabled={selectedIds.size === 0 || bulkLoading}
                  style={{ padding: "6px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: selectedIds.size > 0 && !bulkLoading ? "pointer" : "not-allowed" }}
                >
                  {bulkLoading ? "…" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={handleBulkUnpublish}
                  disabled={selectedIds.size === 0 || bulkLoading}
                  style={{ padding: "6px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: selectedIds.size > 0 && !bulkLoading ? "pointer" : "not-allowed" }}
                >
                  Unpublish
                </button>
                {selectedIds.size > 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>{selectedIds.size} selected</span>}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {flashcards.map((f) => (
                <li
                  key={f._id}
                  style={{
                    padding: "10px 12px",
                    marginBottom: 8,
                    background: "#f9fafb",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <label style={{ flexShrink: 0, marginTop: 2 }}>
                    <input type="checkbox" checked={selectedIds.has(f._id)} onChange={() => toggleSelect(f._id)} />
                  </label>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{f.front}</div>
                    <div style={{ fontSize: 14, color: "#4b5563" }}>{f.back}</div>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>{f.status}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {f.status === "draft" ? (
                      <button
                        type="button"
                        onClick={() => handlePublish(f._id)}
                        disabled={!!actionLoading}
                        style={{ padding: "4px 8px", fontSize: 12, color: "#059669" }}
                      >
                        {actionLoading === f._id ? "…" : "Publish"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleUnpublish(f._id)}
                        disabled={!!actionLoading}
                        style={{ padding: "4px 8px", fontSize: 12, color: "#6b7280" }}
                      >
                        {actionLoading === f._id ? "…" : "Unpublish"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(f._id)}
                      disabled={!!actionLoading}
                      style={{ padding: "4px 8px", fontSize: 12, color: "#dc2626" }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={selectedIds.size === flashcards.length && flashcards.length > 0} onChange={toggleSelectAll} />
                Select all
              </label>
            </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default TeacherFlashcardBankPage;
