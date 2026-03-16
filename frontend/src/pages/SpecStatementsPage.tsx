/**
 * Admin Spec Statements — ingest exam board spec documents into structured SpecStatements.
 * Route: /admin/spec-statements
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchSpecStatements,
  ingestSpecDocument,
  type SpecStatement,
  type IngestionResult,
} from "../api/specStatements";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
  { value: "aqa-l2-further-maths", label: "AQA L2 Further Maths" },
  { value: "aqa-gcse-english-literature", label: "AQA GCSE English Literature" },
  { value: "aqa-gcse-english-language", label: "AQA GCSE English Language" },
];

const SpecStatementsPage: React.FC = () => {
  const [specKey, setSpecKey] = useState("aqa-gcse-biology");
  const [statements, setStatements] = useState<SpecStatement[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const loadStatements = useCallback(async () => {
    if (!specKey) return;
    setLoading(true);
    setError(null);
    try {
      const items = await fetchSpecStatements(specKey);
      setStatements(items);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Failed to load statements");
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  useEffect(() => {
    loadStatements();
  }, [loadStatements]);

  const handleIngest = async () => {
    if (!file || !specKey) {
      setError("Select a spec and upload a file (.txt, .md, .pdf)");
      return;
    }
    setIngesting(true);
    setError(null);
    setResult(null);
    try {
      const res = await ingestSpecDocument({ file, specKey, dryRun });
      setResult(res);
      if (!dryRun && res.summary.saved > 0) {
        loadStatements();
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Ingestion failed");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.25rem", fontWeight: 700 }}>Spec Document Ingestion</h1>
          <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
            Ingest official exam board spec documents into structured SpecStatements for AI generation.
          </p>
        </div>
        <Link
          to="/admin"
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#f3f4f6",
            color: "#374151",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ← Admin
        </Link>
      </div>

      {error && (
        <div style={{ padding: "1rem", backgroundColor: "#fef2f2", color: "#991b1b", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      <section style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem", fontWeight: 600 }}>Ingest document</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#6b7280" }}>Spec</label>
            <select
              value={specKey}
              onChange={(e) => setSpecKey(e.target.value)}
              style={{ padding: "0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db", minWidth: 200 }}
            >
              {SPEC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.85rem", marginBottom: 4, color: "#6b7280" }}>File (.txt, .md, .pdf)</label>
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ padding: "0.25rem" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            <span style={{ fontSize: "0.9rem" }}>Dry run (no DB writes)</span>
          </label>
          <button
            onClick={handleIngest}
            disabled={ingesting || !file}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: ingesting || !file ? "#e5e7eb" : "#2563eb",
              color: ingesting || !file ? "#9ca3af" : "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: ingesting || !file ? "not-allowed" : "pointer",
            }}
          >
            {ingesting ? "Ingesting…" : "Ingest"}
          </button>
        </div>
      </section>

      {result && (
        <section style={{ backgroundColor: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem", fontWeight: 600 }}>
            Ingestion result {result.dryRun && "(dry run)"}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Parsed</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{result.summary.parsedStatements}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Mapped</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{result.summary.mappedStatements}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Unmapped</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{result.summary.unmappedStatements}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Duplicates</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{result.summary.duplicateStatements}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Saved</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{result.summary.saved}</div>
            </div>
          </div>
          {result.unmapped.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Unmapped statements ({result.unmapped.length})</summary>
              <div style={{ marginTop: "0.5rem", maxHeight: 200, overflow: "auto", fontSize: "0.85rem" }}>
                {result.unmapped.slice(0, 20).map((u, i) => (
                  <div key={i} style={{ padding: "0.25rem 0", borderBottom: "1px solid #e5e7eb" }}>
                    <div>{u.statementText.slice(0, 120)}{u.statementText.length > 120 ? "…" : ""}</div>
                    <div style={{ color: "#6b7280", fontSize: "0.8rem" }}>{u.reason}</div>
                  </div>
                ))}
                {result.unmapped.length > 20 && (
                  <div style={{ color: "#6b7280", marginTop: 4 }}>… and {result.unmapped.length - 20} more</div>
                )}
              </div>
            </details>
          )}
        </section>
      )}

      <section style={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem", fontWeight: 600 }}>
          Stored SpecStatements for {SPEC_OPTIONS.find((o) => o.value === specKey)?.label || specKey}
        </h2>
        {loading ? (
          <div>Loading…</div>
        ) : statements.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No statements stored for this spec yet.</div>
        ) : (
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Topic</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Statement</th>
                  <th style={{ textAlign: "left", padding: "0.5rem" }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {statements.slice(0, 100).map((s) => (
                  <tr key={s._id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.5rem", verticalAlign: "top" }}>{s.topicKey}</td>
                    <td style={{ padding: "0.5rem" }}>{s.statementText.slice(0, 80)}{s.statementText.length > 80 ? "…" : ""}</td>
                    <td style={{ padding: "0.5rem" }}>{s.statementType || "core"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {statements.length > 100 && (
              <div style={{ padding: "0.5rem", color: "#6b7280", fontSize: "0.85rem" }}>
                Showing 100 of {statements.length}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default SpecStatementsPage;
