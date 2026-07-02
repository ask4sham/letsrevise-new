import React, { useEffect, useState } from "react";
import api from "../../services/api";
import { getApiClientErrorMessage } from "../../utils/apiErrorMessage";

type SharePermission = "VIEW" | "TEACH";

type ShareRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  schoolName?: string;
  permission?: string;
  permissionLabel?: string;
  reviewStatus?: string;
  status: string;
  sharedAt: string;
};

type Props = {
  lessonId: string;
  lessonTitle: string;
  open: boolean;
  onClose: () => void;
};

function formatSharedDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function shareStatusLabel(status?: string): string {
  if (status === "waiting_for_review") return "Waiting for review";
  if (status === "ready_to_teach") return "Ready to teach";
  return "";
}

const ShareForReviewModal: React.FC<Props> = ({ lessonId, lessonTitle, open, onClose }) => {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("VIEW");
  const [shares, setShares] = useState<ShareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadShares = async () => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/lessons/${lessonId}/shares`);
      setShares(Array.isArray(res.data?.shares) ? res.data.shares : []);
    } catch (e: unknown) {
      setError(getApiClientErrorMessage(e, "Failed to load shares"));
      setShares([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && lessonId) {
      setEmail("");
      setPermission("VIEW");
      setSuccess(null);
      void loadShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lessonId]);

  if (!open) return null;

  const handleShare = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter the teacher's email address");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.post(`/lessons/${lessonId}/shares`, { email: trimmed, permission });
      const reviewer = res.data?.reviewer;
      const displayName = reviewer?.name || trimmed;
      const firstName = displayName.trim().split(/\s+/)[0] || displayName;
      const grantedPermission = (res.data?.permission as SharePermission) || permission;
      if (grantedPermission === "TEACH") {
        setSuccess(
          `Teaching access granted to ${displayName}.\n\n${firstName} will now see this lesson under Shared with Me on their Teacher Dashboard.`
        );
      } else {
        setSuccess(
          `Review request sent to ${displayName}.\n\n${firstName} will now see this lesson under Review Requests on their Teacher Dashboard.`
        );
      }
      setEmail("");
      await loadShares();
    } catch (e: unknown) {
      setError(getApiClientErrorMessage(e, "Failed to share lesson"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (teacherId: string, teacherName: string) => {
    setError(null);
    setSuccess(null);
    try {
      await api.delete(`/lessons/${lessonId}/shares/${teacherId}`);
      setSuccess(`Access revoked for ${teacherName || "teacher"}.`);
      await loadShares();
    } catch (e: unknown) {
      setError(getApiClientErrorMessage(e, "Failed to revoke access"));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-for-review-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          maxWidth: 520,
          width: "100%",
          padding: 24,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-for-review-title" style={{ margin: "0 0 8px", fontSize: 20, color: "#111827" }}>
          Share lesson
        </h2>
        <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 14 }}>
          Grant access to <strong>{lessonTitle}</strong> without copying or transferring ownership.
        </p>

        <fieldset style={{ border: "none", margin: "0 0 16px", padding: 0 }}>
          <legend style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
            Permission
          </legend>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
              <input
                type="radio"
                name="share-permission"
                checked={permission === "VIEW"}
                onChange={() => setPermission("VIEW")}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>Review only</strong>
                <span style={{ display: "block", color: "#6b7280", fontSize: 13 }}>
                  Read-only preview for quality review. Cannot teach in classroom mode.
                </span>
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 14 }}>
              <input
                type="radio"
                name="share-permission"
                checked={permission === "TEACH"}
                onChange={() => setPermission("TEACH")}
                style={{ marginTop: 3 }}
              />
              <span>
                <strong>Teach in classroom</strong>
                <span style={{ display: "block", color: "#6b7280", fontSize: 13 }}>
                  Open and present the master lesson in classroom mode. Cannot edit or publish.
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6, color: "#374151" }}>
          Teacher email
        </label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher@school.com"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
          <button
            type="button"
            onClick={handleShare}
            disabled={submitting}
            style={{
              padding: "10px 16px",
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              cursor: submitting ? "wait" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {submitting ? "Sharing…" : "Share"}
          </button>
        </div>

        {error && (
          <div
            style={{
              marginBottom: 12,
              padding: 10,
              background: "#fef2f2",
              color: "#b91c1c",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              background: "#ecfdf5",
              color: "#047857",
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-line",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ {success.split("\n\n")[0]}</div>
            {success.includes("\n\n") ? <div>{success.split("\n\n").slice(1).join("\n\n")}</div> : null}
          </div>
        )}

        <h3 style={{ fontSize: 14, margin: "0 0 10px", color: "#374151", fontWeight: 700 }}>
          Current access
        </h3>
        {loading ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>Loading…</p>
        ) : shares.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>No shared access yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {shares.map((s) => {
              const statusText = shareStatusLabel(s.reviewStatus);
              const sharedLabel = formatSharedDate(s.sharedAt);
              return (
                <li
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 14px",
                    background: "#f9fafb",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#111827", marginBottom: 2 }}>
                      {s.teacherName || s.teacherEmail}
                    </div>
                    {s.schoolName ? (
                      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>{s.schoolName}</div>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          color: s.permission === "TEACH" ? "#047857" : "#5b21b6",
                          background: s.permission === "TEACH" ? "#d1fae5" : "#ede9fe",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                      >
                        {s.permissionLabel || (s.permission === "TEACH" ? "TEACH IN CLASSROOM" : "VIEW ONLY")}
                      </span>
                      {sharedLabel ? (
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>Shared {sharedLabel}</span>
                      ) : null}
                    </div>
                    {statusText ? (
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, fontStyle: "italic" }}>
                        {statusText}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(s.teacherId, s.teacherName || s.teacherEmail)}
                    style={{
                      padding: "6px 12px",
                      background: "#fff",
                      border: "1px solid #fca5a5",
                      color: "#b91c1c",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#e5e7eb",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareForReviewModal;
