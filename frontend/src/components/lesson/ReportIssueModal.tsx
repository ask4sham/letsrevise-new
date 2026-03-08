/**
 * ReportIssueModal — students/teachers report mistakes in lesson content.
 */
import React, { useState } from "react";
import api from "../../services/api";

const ISSUE_TYPES = [
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "typo_spelling", label: "Typo / spelling" },
  { value: "image_problem", label: "Image problem" },
  { value: "question_incorrect", label: "Question incorrect" },
  { value: "other", label: "Other" },
] as const;

export interface ReportIssueModalProps {
  lessonId: string;
  pageId?: string | null;
  pageTitle?: string | null;
  pageOrder?: number | null;
  blockId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReportIssueModal({
  lessonId,
  pageId,
  pageTitle,
  pageOrder,
  blockId,
  onClose,
  onSuccess,
}: ReportIssueModalProps): React.ReactElement {
  const [reportType, setReportType] = useState<string>(ISSUE_TYPES[0].value);
  const [description, setDescription] = useState("");
  const [suggestedFix, setSuggestedFix] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const desc = description.trim();
    if (!desc) {
      setError("Description is required.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/lesson-issues", {
        lessonId,
        pageId: pageId || undefined,
        pageTitle: pageTitle || undefined,
        pageOrder: pageOrder != null ? pageOrder : undefined,
        blockId: blockId || undefined,
        reportType,
        description: desc,
        suggestedFix: suggestedFix.trim() || undefined,
      });
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.msg || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "white",
          borderRadius: 14,
          padding: 24,
          maxWidth: 440,
          width: "90%",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: "1.25rem", fontWeight: 700 }}>
          Report an issue
        </h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              Issue type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 14,
              }}
            >
              {ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              Description <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              placeholder="Describe the mistake..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 6, fontWeight: 600, fontSize: 14 }}>
              Suggested correction (optional)
            </label>
            <textarea
              value={suggestedFix}
              onChange={(e) => setSuggestedFix(e.target.value)}
              rows={2}
              placeholder="How should it be corrected?"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 14,
                resize: "vertical",
              }}
            />
          </div>
          {error && (
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "#4f46e5",
                color: "white",
                fontWeight: 600,
                cursor: submitting ? "not-allowed" : "pointer",
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
