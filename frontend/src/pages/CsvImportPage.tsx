/**
 * Phase 1: CSV import for Flashcards and Exam Questions.
 * Route: /admin/csv-import or /teacher/csv-import
 */
import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  importFlashcardsCsv,
  importExamQuestionsCsv,
  downloadFlashcardsTemplate,
  downloadExamQuestionsTemplate,
  type CsvImportResult,
} from "../api/csvImport";

type ImportType = "flashcards" | "exam-questions";

export default function CsvImportPage() {
  const { user } = useCurrentUser();
  const isTeacher = user?.userType === "teacher";
  const [importType, setImportType] = useState<ImportType>("flashcards");
  const [file, setFile] = useState<File | null>(null);
  const [defaultSpecKey, setDefaultSpecKey] = useState("");
  const [defaultTopicKey, setDefaultTopicKey] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f || null);
    setResult(null);
    setError(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) {
      setError("Please select a CSV file");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = {
        file,
        dryRun,
        defaultSpecKey: defaultSpecKey.trim() || undefined,
        defaultTopicKey: defaultTopicKey.trim() || undefined,
      };
      const res =
        importType === "flashcards"
          ? await importFlashcardsCsv(params)
          : await importExamQuestionsCsv(params);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }, [file, dryRun, defaultSpecKey, defaultTopicKey, importType]);

  const handleDownloadTemplate = useCallback(
    async (type: ImportType) => {
      setTemplateError(null);
      try {
        if (type === "flashcards") await downloadFlashcardsTemplate();
        else await downloadExamQuestionsTemplate();
      } catch (e) {
        setTemplateError(e instanceof Error ? e.message : "Download failed");
      }
    },
    []
  );

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Link
          to={isTeacher ? "/teacher-dashboard" : "/admin"}
          style={{ color: "#666", textDecoration: "none" }}
        >
          ← Back to {isTeacher ? "Teacher" : "Admin"} Dashboard
        </Link>
        <h1 style={{ marginTop: 8, marginBottom: 4 }}>CSV Import</h1>
        <p style={{ color: "#666", margin: 0 }}>
          Bulk upload Flashcards or Exam Questions from Anki-style CSV files.
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          Import type
        </label>
        <select
          value={importType}
          onChange={(e) => {
            setImportType(e.target.value as ImportType);
            setResult(null);
            setError(null);
          }}
          style={{ padding: 8, minWidth: 200 }}
        >
          <option value="flashcards">Flashcards</option>
          <option value="exam-questions">Exam Questions</option>
        </select>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
          CSV file
        </label>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: "block" }}
        />
        {file && (
          <span style={{ marginLeft: 8, color: "#666" }}>{file.name}</span>
        )}
      </div>

      <div style={{ marginBottom: 24, display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
            Default specKey (optional)
          </label>
          <input
            type="text"
            value={defaultSpecKey}
            onChange={(e) => setDefaultSpecKey(e.target.value)}
            placeholder="e.g. aqa-gcse-biology"
            style={{ padding: 8, width: 200 }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
            Default topicKey (optional)
          </label>
          <input
            type="text"
            value={defaultTopicKey}
            onChange={(e) => setDefaultTopicKey(e.target.value)}
            placeholder="e.g. cell-structure"
            style={{ padding: 8, width: 200 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          <span>Dry run (preview only, do not import)</span>
        </label>
      </div>

      <div style={{ marginBottom: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={handleImport}
          disabled={loading}
          style={{
            padding: "10px 20px",
            background: loading ? "#ccc" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "Importing…" : dryRun ? "Preview" : "Import"}
        </button>
        <button
          onClick={() => handleDownloadTemplate(importType)}
          style={{
            padding: "10px 20px",
            background: "#f3f4f6",
            color: "#374151",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Download {importType === "flashcards" ? "Flashcards" : "Exam Questions"} template
        </button>
      </div>

      {templateError && (
        <div style={{ color: "#dc2626", marginBottom: 16 }}>{templateError}</div>
      )}
      {error && (
        <div style={{ color: "#dc2626", marginBottom: 16 }}>{error}</div>
      )}

      {result && (
        <div style={{ marginTop: 32, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: 16, background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: 0, marginBottom: 12 }}>Result summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              <div>
                <span style={{ color: "#6b7280" }}>Parsed</span>
                <div style={{ fontWeight: 600 }}>{result.summary.parsedRows}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>Valid</span>
                <div style={{ fontWeight: 600 }}>{result.summary.validRows}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>Imported</span>
                <div style={{ fontWeight: 600, color: "#059669" }}>{result.summary.importedRows}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>Duplicates</span>
                <div style={{ fontWeight: 600 }}>{result.summary.duplicateRows}</div>
              </div>
              <div>
                <span style={{ color: "#6b7280" }}>Invalid</span>
                <div style={{ fontWeight: 600, color: "#dc2626" }}>{result.summary.invalidRows}</div>
              </div>
            </div>
            {result.dryRun && (
              <p style={{ marginTop: 12, marginBottom: 0, color: "#6b7280", fontSize: 14 }}>
                Dry run — no data was imported. Uncheck "Dry run" and click Import to apply.
              </p>
            )}
          </div>
          {result.errors.length > 0 && (
            <div style={{ padding: 16 }}>
              <h4 style={{ margin: "0 0 12px 0" }}>Errors</h4>
              <div style={{ maxHeight: 240, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <th style={{ textAlign: "left", padding: 8 }}>Row</th>
                      <th style={{ textAlign: "left", padding: 8 }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 50).map((err, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: 8 }}>{err.rowNumber}</td>
                        <td style={{ padding: 8 }}>{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.errors.length > 50 && (
                  <p style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
                    … and {result.errors.length - 50} more
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
