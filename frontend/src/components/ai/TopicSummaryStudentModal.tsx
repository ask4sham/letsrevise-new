/**
 * PR-024.1: Student topic summary modal — Overview | Revision sheet only.
 * Feature-flagged via aiTutorEnabled. Citations collapsed, studentMode.
 */
import React, { useState } from "react";
import { postTopicSummary, type TopicSummaryMode, type TopicSummaryResponse } from "../../api/topicSummary";
import { postTopicSummaryPdf } from "../../api/topicSummaryExport";
import { CitationsList } from "./CitationsList";

type Props = {
  specKey: string;
  topicKey: string;
  lessonId?: string;
  onClose: () => void;
};

const STUDENT_MODES: TopicSummaryMode[] = ["overview", "revisionSheet"];

export function TopicSummaryStudentModal({ specKey, topicKey, lessonId, onClose }: Props) {
  const [mode, setMode] = useState<TopicSummaryMode>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TopicSummaryResponse | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfIncludeEvidence, setPdfIncludeEvidence] = useState(false);
  const [pdfIncludeNextSteps, setPdfIncludeNextSteps] = useState(true);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await postTopicSummary({
        specKey,
        topicKey,
        mode,
        maxSources: 10,
        allowExternal: false,
      });
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (!result?.summary?.summary) return;
    navigator.clipboard.writeText(result.summary.summary);
    setCopyToast("Summary copied");
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleCopyKeyPoints = () => {
    if (!result?.summary?.keyPoints?.length) return;
    navigator.clipboard.writeText(result.summary.keyPoints.join("\n"));
    setCopyToast("Key points copied");
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    setPdfDownloading(true);
    setCopyToast("Generating PDF…");
    try {
      await postTopicSummaryPdf({
        topicSummaryLogId: result.topicSummaryLogId,
        specKey: result.specKey,
        topicKey: result.topicKey,
        mode: result.mode,
        includeCitations: true,
        ...(!result.topicSummaryLogId && {
          summary: result.summary,
          usedSources: result.usedSources,
          confidenceLevel: result.confidenceLevel,
          confidenceReason: result.confidenceReason,
        }),
      });
      setCopyToast("Downloaded");
      setTimeout(() => setCopyToast(null), 2000);
    } catch (e: any) {
      setCopyToast(e?.message ?? "Download failed");
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 1100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 24,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 520,
          width: "100%",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          marginBottom: 40,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Summarise this topic</h3>
        {!result ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Mode</label>
              <div style={{ display: "flex", gap: 8 }}>
                {STUDENT_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      background: mode === m ? "#8b5cf6" : "#f3f4f6",
                      color: mode === m ? "white" : "#374151",
                      border: "none",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {m === "overview" ? "Overview" : "Revision sheet"}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <div style={{ marginBottom: 16, padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  background: "#e5e7eb",
                  color: "#374151",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                style={{
                  padding: "8px 16px",
                  background: loading ? "#9ca3af" : "#8b5cf6",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: loading ? "wait" : "pointer",
                  fontWeight: 600,
                }}
              >
                {loading ? "Building summary…" : "Generate"}
              </button>
            </div>
          </>
        ) : (
          <>
            {copyToast && (
              <div style={{ marginBottom: 12, padding: 8, background: "#d1fae5", color: "#065f46", borderRadius: 8, fontSize: 13 }}>
                {copyToast}
              </div>
            )}
            <div style={{ marginBottom: 12, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {result.summary.summary}
            </div>
            {result.summary.keyPoints?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Key points</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {result.summary.keyPoints.map((kp, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{kp}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.summary.sections?.revisionSheet && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Revision sheet</div>
                {result.summary.sections.revisionSheet.commonMistakes?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Common mistakes:</strong>
                    <ul style={{ margin: "4px 0 0 20px" }}>
                      {result.summary.sections.revisionSheet.commonMistakes.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.summary.sections.revisionSheet.memoryCues?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <strong>Memory cues:</strong>
                    <ul style={{ margin: "4px 0 0 20px" }}>
                      {result.summary.sections.revisionSheet.memoryCues.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(result.summary.sections.revisionSheet.flashcards || []).length > 0 && (
                  <div>
                    <strong>Flashcards:</strong>
                    {(result.summary.sections.revisionSheet.flashcards || []).map((f, i) => (
                      <div key={i} style={{ marginTop: 8, padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Q: {f.front}</div>
                        <div style={{ fontSize: 13, color: "#475569" }}>A: {f.back}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {result.summary.citations?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <CitationsList
                  citations={result.summary.citations as any}
                  usedSources={result.usedSources as any}
                  defaultQuotesExpanded={false}
                  studentMode={true}
                  lessonId={lessonId}
                  sectionTitle="Sources"
                />
              </div>
            )}
            <div style={{ marginBottom: 12, padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>PDF export options</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={pdfIncludeEvidence} onChange={(e) => setPdfIncludeEvidence(e.target.checked)} />
                Include evidence appendix
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                <input type="checkbox" checked={pdfIncludeNextSteps} onChange={(e) => setPdfIncludeNextSteps(e.target.checked)} />
                Include next steps
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <button type="button" onClick={handleCopySummary} style={{ padding: "6px 12px", fontSize: 12, background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Copy summary
              </button>
              <button type="button" onClick={handleCopyKeyPoints} style={{ padding: "6px 12px", fontSize: 12, background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                Copy key points
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={pdfDownloading}
                style={{ padding: "6px 12px", fontSize: 12, background: "#dc2626", color: "white", border: "none", borderRadius: 6, cursor: pdfDownloading ? "wait" : "pointer", fontWeight: 600 }}
              >
                {pdfDownloading ? "Downloading…" : "Download PDF"}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "#8b5cf6",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
