// PR-ADMIN-INGEST-UI-1: Admin ingestion UI — CSV upload, preview, safe import
import React, { useCallback, useEffect, useState } from "react";
import type { SpecKey } from "../api/taxonomy";
import type { IngestType, IngestReport } from "../api/adminIngest";
import { previewIngest, runIngest } from "../api/adminIngest";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { parseCsvToRows } from "../utils/csvParse";
import { SpecSelector } from "../components/SpecSelector";
import { IngestCsvUploader } from "../components/admin/IngestCsvUploader";
import { IngestPreviewTable } from "../components/admin/IngestPreviewTable";
import { IngestActions } from "../components/admin/IngestActions";
import { Link } from "react-router-dom";

const INGEST_TYPES: { value: IngestType; label: string }[] = [
  { value: "flashcards", label: "Flashcards" },
  { value: "exam-questions", label: "Exam Questions" },
  { value: "past-papers", label: "Past Papers" },
  { value: "past-paper-questions", label: "Past Paper Questions" },
];

function csvRowsToItems(type: IngestType, rows: Record<string, string>[]): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  const first = rows[0];
  const has = (k: string) => Object.prototype.hasOwnProperty.call(first, k);

  switch (type) {
    case "flashcards": {
      const topicKey = has("topicKey") ? "topicKey" : "topic_key";
      const question = has("question") ? "question" : has("front") ? "front" : "q";
      const answer = has("answer") ? "answer" : has("back") ? "back" : "a";
      return rows.map((r) => ({
        topicKey: (r.topicKey ?? r.topic_key ?? "").trim(),
        question: (r[question] ?? r.front ?? "").trim(),
        answer: (r[answer] ?? r.back ?? "").trim(),
      }));
    }
    case "exam-questions":
      return rows.map((r) => ({
        topicKey: (r.topicKey ?? r.topic_key ?? "").trim(),
        question: (r.question ?? r.q ?? "").trim(),
        markScheme: (r.markScheme ?? r.mark_scheme ?? r.answer ?? "").trim(),
        marks: r.marks ? Number(r.marks) : undefined,
      }));
    case "past-papers":
      return rows.map((r) => ({
        examBoard: (r.examBoard ?? r.exam_board ?? "").trim(),
        level: (r.level ?? "").trim(),
        year: (r.year ?? "").trim(),
        paperCode: (r.paperCode ?? r.paper_code ?? "").trim(),
        title: (r.title ?? "").trim() || undefined,
        series: (r.series ?? "").trim() || undefined,
        tier: (r.tier ?? "").trim() || undefined,
      }));
    case "past-paper-questions":
      return rows.map((r) => ({
        pastPaperId: (r.pastPaperId ?? r.past_paper_id ?? "").trim(),
        topicKey: (r.topicKey ?? r.topic_key ?? "").trim(),
        question: (r.question ?? r.q ?? "").trim(),
        questionNumber: (r.questionNumber ?? r.question_number ?? "").trim() || undefined,
        marks: r.marks ? Number(r.marks) : undefined,
        markScheme: (r.markScheme ?? r.mark_scheme ?? "").trim() || undefined,
      }));
    default:
      return [];
  }
}

export default function AdminIngestPage() {
  const [specKey, setSpecKeyState] = useState<SpecKey>(getStoredSpecKey);
  const [type, setType] = useState<IngestType>("flashcards");
  const [csvText, setCsvText] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [previewReport, setPreviewReport] = useState<IngestReport | null>(null);
  const [importResult, setImportResult] = useState<IngestReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmCopyright, setConfirmCopyright] = useState(false);
  const [pastPaperIdOverride, setPastPaperIdOverride] = useState("");

  const setSpecKey = useCallback((v: SpecKey) => {
    setStoredSpecKey(v);
    setSpecKeyState(v);
  }, []);

  const handleCsvText = useCallback(
    (text: string) => {
      setCsvText(text);
      setPreviewReport(null);
      setImportResult(null);
      const rows = parseCsvToRows(text);
      const parsed = csvRowsToItems(type, rows);
      setItems(parsed);
      if (parsed.length > 0) {
        setLoading(true);
        const itemsToSend =
          type === "past-paper-questions" && pastPaperIdOverride.trim()
            ? parsed.map((it) => ({ ...it, pastPaperId: pastPaperIdOverride.trim() }))
            : parsed;
        previewIngest({ type, specKey, items: itemsToSend })
          .then(setPreviewReport)
          .catch((err) => {
            console.error(err);
            setPreviewReport(null);
          })
          .finally(() => setLoading(false));
      }
    },
    [type, specKey, pastPaperIdOverride]
  );

  // Re-run preview when specKey or pastPaperIdOverride changes and we already have items
  useEffect(() => {
    if (items.length === 0 || loading) return;
    const itemsToSend =
      type === "past-paper-questions" && pastPaperIdOverride.trim()
        ? items.map((it) => ({ ...it, pastPaperId: pastPaperIdOverride.trim() }))
        : items;
    setLoading(true);
    previewIngest({ type, specKey, items: itemsToSend })
      .then(setPreviewReport)
      .catch((err) => {
        console.error(err);
        setPreviewReport(null);
      })
      .finally(() => setLoading(false));
  }, [specKey, pastPaperIdOverride]);

  const runPreview = useCallback(() => {
    if (items.length === 0) return;
    setLoading(true);
    const itemsToSend =
      type === "past-paper-questions" && pastPaperIdOverride.trim()
        ? items.map((it) => ({ ...it, pastPaperId: pastPaperIdOverride.trim() }))
        : items;
    previewIngest({ type, specKey, items: itemsToSend })
      .then(setPreviewReport)
      .catch((err) => {
        console.error(err);
        setPreviewReport(null);
      })
      .finally(() => setLoading(false));
  }, [type, specKey, items, pastPaperIdOverride]);

  const handleImport = useCallback(() => {
    const itemsToSend =
      type === "past-paper-questions" && pastPaperIdOverride.trim()
        ? items.map((it) => ({ ...it, pastPaperId: pastPaperIdOverride.trim() }))
        : items;
    setImporting(true);
    setImportResult(null);
    runIngest({ type, specKey, items: itemsToSend })
      .then((report) => {
        setImportResult(report);
        setPreviewReport(report);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => setImporting(false));
  }, [type, specKey, items, pastPaperIdOverride]);

  const handleDownloadResult = useCallback(() => {
    if (!importResult) return;
    const blob = new Blob([JSON.stringify(importResult, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ingest-result-${type}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult, type]);

  const canImport =
    !!previewReport && items.length > 0 && previewReport.valid > 0;
  const requireConfirmCopyright = type === "past-papers" || type === "past-paper-questions";

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-4">
        <Link to="/admin" className="text-indigo-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="text-xl font-semibold">Bulk import</h1>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Upload a CSV, preview validation and dedupe, then import. All topic keys are namespaced by spec.
        No copyrighted material is ingested or distributed.
      </p>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Target type</label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as IngestType);
                setCsvText("");
                setItems([]);
                setPreviewReport(null);
                setImportResult(null);
              }}
              className="border rounded px-3 py-1.5"
            >
              {INGEST_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <SpecSelector value={specKey} onChange={setSpecKey} />
          </div>
        </div>

        {type === "past-paper-questions" && (
          <div>
            <label className="block text-sm font-medium mb-1">Past paper ID (if not in CSV)</label>
            <input
              type="text"
              value={pastPaperIdOverride}
              onChange={(e) => setPastPaperIdOverride(e.target.value)}
              placeholder="Mongo ID of the past paper"
              className="border rounded px-3 py-1.5 w-64"
            />
          </div>
        )}

        {items.length > 0 && (
          <div>
            <button
              type="button"
              onClick={runPreview}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 text-sm"
            >
              Refresh preview
            </button>
            <span className="ml-2 text-sm text-gray-500">Use after changing spec or past paper ID</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">CSV file</label>
          <IngestCsvUploader onCsvText={handleCsvText} disabled={loading} />
        </div>

        {loading && <p className="text-sm text-gray-500">Loading preview…</p>}

        {previewReport && (
          <>
            <div>
              <p className="text-sm font-medium mb-1">
                Preview: {previewReport.valid} valid, {previewReport.invalid} invalid,{" "}
                {previewReport.skippedDuplicates} skip (duplicate)
              </p>
              <IngestPreviewTable report={previewReport} items={items} type={type} />
            </div>
            <IngestActions
              canImport={canImport}
              confirmCopyrightChecked={confirmCopyright}
              requireConfirmCopyright={requireConfirmCopyright}
              onConfirmCopyrightChange={setConfirmCopyright}
              onImport={handleImport}
              importing={importing}
              result={importResult ?? null}
              onDownloadResult={handleDownloadResult}
            />
          </>
        )}

        {csvText && items.length === 0 && !loading && (
          <p className="text-sm text-amber-600">CSV has no rows or could not be parsed. Check headers.</p>
        )}
      </div>
    </div>
  );
}
