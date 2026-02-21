/**
 * PR-PP1: Topic Past Paper Bank — teacher/admin manage past papers by topicKey.
 * Route: /teacher/topic-banks/past-papers
 */
import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import {
  listTopicPastPapers,
  previewBulkImportTopicPastPapers,
  bulkImportTopicPastPapers,
  uploadTopicPastPapers,
  publishTopicPastPaper,
  unpublishTopicPastPaper,
  bulkPublishTopicPastPapers,
  bulkUnpublishTopicPastPapers,
  deleteTopicPastPaper,
  downloadTopicPastPaperFile,
  type TopicPastPaper,
  type BulkPreviewResponse,
  type UploadMetadata,
} from "../api/topicPastPapers";

type TaxonomyUnit = { unit: string; topics: { topic: string; key: string }[] };

type Tab = "urls" | "upload" | "list";
type ExamBoard = "" | "AQA" | "OCR" | "Edexcel" | "Other";

function isUrlOnAqa(url: string): boolean {
  try {
    const u = new URL(url);
    const h = (u.hostname || "").toLowerCase();
    return h === "aqa.org.uk" || h.endsWith(".aqa.org.uk");
  } catch {
    return false;
  }
}

function extractUrlsFromImportText(format: "json" | "csv", text: string): string[] {
  const urls: string[] = [];
  try {
    if (format === "json") {
      const arr = JSON.parse(text) as Array<{ url?: string }>;
      if (Array.isArray(arr)) arr.forEach((x) => { if (typeof x?.url === "string") urls.push(x.url); });
    } else {
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      const header = lines[0]?.toLowerCase();
      const urlIdx = header ? header.split(/[,\t;]/).map((s) => s.trim()).indexOf("url") : -1;
      if (urlIdx >= 0) {
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(/[,\t;]/).map((s) => s.trim());
          const v = cols[urlIdx];
          if (typeof v === "string" && /^https?:\/\//i.test(v)) urls.push(v);
        }
      }
    }
  } catch {
    /* ignore */
  }
  return urls;
}

const TeacherPastPapersBankPage: React.FC = () => {
  const [taxonomy, setTaxonomy] = useState<{ units: TaxonomyUnit[] } | null>(null);
  const [topicKey, setTopicKey] = useState<string>("");
  const [examBoard, setExamBoard] = useState<ExamBoard>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published">("all");
  const [activeTab, setActiveTab] = useState<Tab>("list");
  const [items, setItems] = useState<TopicPastPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Import URLs
  const [importFormat, setImportFormat] = useState<"json" | "csv">("json");
  const [importText, setImportText] = useState("");
  const [dedupeMode, setDedupeMode] = useState<"skip" | "error" | "allow">("skip");
  const [previewResult, setPreviewResult] = useState<BulkPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // Upload files
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadMetadata, setUploadMetadata] = useState<UploadMetadata>({});
  const [uploadLoading, setUploadLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    api.get("/taxonomy/aqa-gcse-biology").then((res) => setTaxonomy(res?.data ?? null)).catch(() => setTaxonomy(null));
  }, []);

  const fetchItems = async () => {
    if (!topicKey) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listTopicPastPapers({
        topicKey,
        status: statusFilter,
        mineOnly: true,
      });
      setItems(list);
    } catch (err: any) {
      setError(err?.message || "Failed to load past papers");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [topicKey, statusFilter]);

  useEffect(() => {
    if (examBoard === "AQA" && activeTab === "upload") setActiveTab("list");
  }, [examBoard]);

  const handlePreview = async () => {
    if (!topicKey) {
      setMessage("Select a topic to preview.");
      return;
    }
    if (!importText.trim()) {
      setMessage("Paste text to preview.");
      return;
    }
    if (examBoard === "AQA") {
      const urls = extractUrlsFromImportText(importFormat, importText);
      const invalid = urls.filter((u) => !isUrlOnAqa(u));
      if (invalid.length > 0) {
        setMessage("AQA past papers must be from aqa.org.uk. Some URLs in your input are not. Fix them before preview.");
        return;
      }
    }
    setPreviewLoading(true);
    setMessage(null);
    setPreviewResult(null);
    try {
      const result = await previewBulkImportTopicPastPapers({
        topicKey,
        format: importFormat,
        text: importText,
        dedupeMode,
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
      setMessage("No new items to import (run Preview first and ensure wouldCreate > 0).");
      return;
    }
    if (examBoard === "AQA") {
      const urls = previewResult.previewItems.map((x) => x.url).filter(Boolean);
      const invalid = urls.filter((u) => !isUrlOnAqa(u));
      if (invalid.length > 0) {
        setMessage("AQA past papers must be from aqa.org.uk. Some preview items are not. Re-run preview after fixing.");
        return;
      }
    }
    setImportLoading(true);
    setMessage(null);
    try {
      const bulkItems = previewResult.previewItems.map((x) => ({
        title: x.title,
        url: x.url,
        year: x.year,
        paper: x.paper,
        session: x.session,
        tier: x.tier,
        type: x.type,
        examBoard: x.examBoard,
        qualification: x.qualification,
        subject: x.subject,
        tags: x.tags,
      }));
      const result = await bulkImportTopicPastPapers({ topicKey, items: bulkItems, dedupeMode });
      setImportText("");
      setPreviewResult(null);
      setMessage(
        `Imported ${result.createdCount} draft(s). Skipped: ${result.skipped.duplicatesInPayload + result.skipped.duplicatesInDb} duplicate(s), ${result.skipped.invalid} invalid.`
      );
      fetchItems();
      setActiveTab("list");
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    if (e.target) e.target.value = "";
  };

  const handleUpload = async () => {
    if (!topicKey || selectedFiles.length === 0) {
      setMessage("Select a topic and at least one file.");
      return;
    }
    setUploadLoading(true);
    setMessage(null);
    try {
      const result = await uploadTopicPastPapers({
        topicKey,
        files: selectedFiles,
        metadata: Object.keys(uploadMetadata).length > 0 ? uploadMetadata : undefined,
      });
      setSelectedFiles([]);
      setUploadMetadata({});
      setMessage(
        `Uploaded ${result.uploaded.acceptedFiles} file(s). Rejected: ${result.uploaded.rejectedFiles}. Created: ${result.createdCount} draft(s).`
      );
      fetchItems();
      setActiveTab("list");
    } catch (err: any) {
      setMessage(err?.message || "Upload failed");
    } finally {
      setUploadLoading(false);
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
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((p) => p._id)));
  };
  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await bulkPublishTopicPastPapers(Array.from(selectedIds));
      setMessage(`Published ${res.updatedCount} past paper(s).`);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Bulk publish failed");
    } finally {
      setBulkLoading(false);
    }
  };
  const handleBulkUnpublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await bulkUnpublishTopicPastPapers(Array.from(selectedIds));
      setMessage(`Unpublished ${res.updatedCount} past paper(s).`);
      setSelectedIds(new Set());
      fetchItems();
    } catch (err: any) {
      setMessage(err?.response?.data?.error || err?.message || "Bulk unpublish failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handlePublish = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await publishTopicPastPaper(id);
      setItems((prev) => prev.map((p) => (p._id === id ? updated : p)));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Publish failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublish = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await unpublishTopicPastPaper(id);
      setItems((prev) => prev.map((p) => (p._id === id ? updated : p)));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Unpublish failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteTopicPastPaper(id);
      setItems((prev) => prev.filter((p) => p._id !== id));
    } catch (err: any) {
      setMessage(err?.response?.data?.error || "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownload = async (item: TopicPastPaper) => {
    if (item.sourceType !== "file" || !item.file?.fileId) {
      setMessage("This item has no file to download.");
      return;
    }
    setActionLoading(item._id);
    try {
      await downloadTopicPastPaperFile(item.file.fileId, item.file.originalName || "past-paper.pdf");
    } catch (err: any) {
      setMessage(err?.message || "Download failed");
    } finally {
      setActionLoading(null);
    }
  };

  const allTopics = taxonomy?.units?.flatMap((u) => u.topics || []) ?? [];

  const sourceLabel = (p: TopicPastPaper) => (p.sourceType === "url" ? "URL" : "File");
  const sourceValue = (p: TopicPastPaper) =>
    p.sourceType === "url" ? (p.url ? (p.url.length > 50 ? p.url.slice(0, 50) + "…" : p.url) : "—") : p.file?.originalName || "—";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Topic Past Paper Bank</h1>
      </div>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>
        Add past papers by topic via URLs (bulk JSON/CSV) or file upload (PDF, doc, docx). Deduplication is applied.
      </p>

      <div style={{ marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
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
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Exam board</label>
          <select
            value={examBoard}
            onChange={(e) => setExamBoard(e.target.value as ExamBoard)}
            style={{ padding: "8px 12px", minWidth: 140, borderRadius: 8, border: "1px solid #d1d5db" }}
          >
            <option value="">(blank)</option>
            <option value="AQA">AQA</option>
            <option value="OCR">OCR</option>
            <option value="Edexcel">Edexcel</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {examBoard === "AQA" && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e" }}>
          AQA past papers must be linked from aqa.org.uk (uploads disabled).
        </div>
      )}

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <label style={{ fontWeight: 600 }}>Show:</label>
        {(["all", "draft", "published"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            style={{
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
        <span style={{ width: 16 }} />
        <label style={{ fontWeight: 600 }}>Tab:</label>
        {(["list", "urls", "upload"] as Tab[]).map((t) => {
          const hideUpload = t === "upload" && examBoard === "AQA";
          if (hideUpload) return null;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid #d1d5db",
                background: activeTab === t ? "#e0e7ff" : "#fff",
                fontWeight: activeTab === t ? 700 : 400,
              }}
            >
              {t === "list" ? "List" : t === "urls" ? "Import URLs" : "Upload files"}
            </button>
          );
        })}
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

      {activeTab === "urls" && (
        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Import URLs</h2>
          {!topicKey && <p style={{ color: "#6b7280", marginBottom: 12 }}>Select a topic to preview/import.</p>}
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
                ? '[{"title":"AQA Bio Paper 1 2023","url":"https://example.com/paper.pdf","year":2023}]'
                : "title,url,year,paper,session,tier,type\nAQA Bio 1 2023,https://example.com/paper.pdf,2023,1,summer,higher,foundation"
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
              fontSize: 13,
            }}
          />
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || !topicKey || !importText.trim()}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "#2563eb",
                color: "#fff",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
              }}
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
                Total parsed: {previewResult.summary.totalParsed} · Valid: {previewResult.summary.validCount} · Invalid:{" "}
                {previewResult.summary.invalidCount} · Duplicates (payload): {previewResult.summary.duplicatesInPayload} ·
                Duplicates (DB): {previewResult.summary.duplicatesInDb} · <strong>Would create: {previewResult.summary.wouldCreate}</strong>
              </div>
              {previewResult.summary.wouldCreate === 0 && (
                <p style={{ color: "#dc2626", fontSize: 13 }}>No new items to import (all duplicates or invalid).</p>
              )}
              {previewResult.invalid.length > 0 && (
                <ul style={{ margin: "4px 0 12px 16px", padding: 0, fontSize: 12, color: "#991b1b" }}>
                  {previewResult.invalid.slice(0, 5).map((inv, i) => (
                    <li key={i}>
                      #{inv.index}: {inv.reason} — {inv.raw.slice(0, 60)}…
                    </li>
                  ))}
                  {previewResult.invalid.length > 5 && <li>…and {previewResult.invalid.length - 5} more</li>}
                </ul>
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
      )}

      {activeTab === "upload" && examBoard !== "AQA" && (
        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Upload files</h2>
          {!topicKey && <p style={{ color: "#6b7280", marginBottom: 12 }}>Select a topic first.</p>}
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>PDF, doc, docx. Max 25MB per file.</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileSelect}
            style={{ marginBottom: 12 }}
          />
          {selectedFiles.length > 0 && (
            <ul style={{ marginBottom: 12, fontSize: 13, listStyle: "none", padding: 0 }}>
              {selectedFiles.map((f, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {f.name} ({(f.size / 1024).toFixed(1)} KB)
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginBottom: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Title (optional)</label>
              <input
                type="text"
                value={uploadMetadata.title ?? ""}
                onChange={(e) => setUploadMetadata((m) => ({ ...m, title: e.target.value || undefined }))}
                placeholder="e.g. Paper 1 2023"
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Year</label>
              <input
                type="number"
                value={uploadMetadata.year ?? ""}
                onChange={(e) =>
                  setUploadMetadata((m) => ({ ...m, year: e.target.value ? parseInt(e.target.value, 10) : undefined }))
                }
                placeholder="2023"
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Paper</label>
              <input
                type="text"
                value={uploadMetadata.paper ?? ""}
                onChange={(e) => setUploadMetadata((m) => ({ ...m, paper: e.target.value || undefined }))}
                placeholder="1"
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Session</label>
              <input
                type="text"
                value={uploadMetadata.session ?? ""}
                onChange={(e) => setUploadMetadata((m) => ({ ...m, session: e.target.value || undefined }))}
                placeholder="summer"
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b7280" }}>Tier</label>
              <input
                type="text"
                value={uploadMetadata.tier ?? ""}
                onChange={(e) => setUploadMetadata((m) => ({ ...m, tier: e.target.value || undefined }))}
                placeholder="higher"
                style={{ width: "100%", padding: 6, borderRadius: 6, border: "1px solid #d1d5db" }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploadLoading || !topicKey || selectedFiles.length === 0}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: selectedFiles.length > 0 && topicKey ? "#059669" : "#9ca3af",
              color: "#fff",
              fontWeight: 600,
              border: "none",
              cursor: selectedFiles.length > 0 && topicKey && !uploadLoading ? "pointer" : "not-allowed",
            }}
          >
            {uploadLoading ? "Uploading…" : "Upload"}
          </button>
        </section>
      )}

      {activeTab === "list" && (
        <section style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>
            Past papers {topicKey ? `(${items.length})` : ""}
          </h2>
          {!topicKey && <p style={{ color: "#6b7280" }}>Select a topic to list items.</p>}
          {topicKey && loading && <p>Loading…</p>}
          {topicKey && !loading && items.length === 0 && <p style={{ color: "#6b7280" }}>No past papers yet. Import URLs or upload files.</p>}
          {topicKey && !loading && items.length > 0 && (
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
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: 8, width: 36 }}>
                      <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleSelectAll} />
                    </th>
                    <th style={{ textAlign: "left", padding: 8 }}>Title</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Year / Paper / Type</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Source</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Status</th>
                    <th style={{ textAlign: "left", padding: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p._id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: 8 }}>
                        <input type="checkbox" checked={selectedIds.has(p._id)} onChange={() => toggleSelect(p._id)} />
                      </td>
                      <td style={{ padding: 8 }}>
                        {p.title}
                        {p.officialSource === true && (
                          <span style={{ marginLeft: 8, padding: "2px 6px", borderRadius: 4, fontSize: 11, background: "#dbeafe", color: "#1d4ed8", fontWeight: 600 }}>
                            Official (AQA)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: 8, color: "#4b5563" }}>
                        {[p.year, p.paper, p.type].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td style={{ padding: 8, fontSize: 12, color: "#6b7280" }}>
                        <span style={{ fontWeight: 600 }}>{sourceLabel(p)}:</span> {sourceValue(p)}
                        {p.sourceType === "url" && p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, color: "#2563eb" }}>
                            Open
                          </a>
                        )}
                      </td>
                      <td style={{ padding: 8 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            fontSize: 12,
                            background: p.status === "published" ? "#d1fae5" : "#e5e7eb",
                            color: p.status === "published" ? "#065f46" : "#4b5563",
                            fontWeight: 600,
                          }}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={{ padding: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {p.sourceType === "file" && (
                            <button
                              type="button"
                              onClick={() => handleDownload(p)}
                              disabled={!!actionLoading}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#2563eb" }}
                            >
                              {actionLoading === p._id ? "…" : "Download"}
                            </button>
                          )}
                          {p.status === "draft" ? (
                            <button
                              type="button"
                              onClick={() => handlePublish(p._id)}
                              disabled={!!actionLoading}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#059669" }}
                            >
                              {actionLoading === p._id ? "…" : "Publish"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUnpublish(p._id)}
                              disabled={!!actionLoading}
                              style={{ padding: "4px 8px", fontSize: 12, color: "#6b7280" }}
                            >
                              {actionLoading === p._id ? "…" : "Unpublish"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(p._id)}
                            disabled={!!actionLoading}
                            style={{ padding: "4px 8px", fontSize: 12, color: "#dc2626" }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default TeacherPastPapersBankPage;
