/**
 * Admin Autopilot Approval Queue — review autopilot-generated draft content.
 * Route: /admin/autopilot-approval
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  fetchAutopilotDrafts,
  approveAutopilotItem,
  rejectAutopilotItem,
  bulkApproveAutopilotItems,
  bulkRejectAutopilotItems,
  type AutopilotDraftItem,
  type AutopilotDraftsFilters,
  type AutopilotDraftsResponse,
} from "../api/contentGraph";
import Toast from "../components/Toast";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All specs" },
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
];

const ITEM_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  { value: "flashcard", label: "Flashcard" },
  { value: "quizQuestion", label: "Quiz Question" },
  { value: "examQuestion", label: "Exam Question" },
];

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { dateStyle: "short" }) + " " + d.toLocaleTimeString(undefined, { timeStyle: "short" });
  } catch {
    return "—";
  }
}

function typeLabel(t: string): string {
  if (t === "flashcard") return "Flashcard";
  if (t === "quizQuestion") return "Quiz";
  if (t === "examQuestion") return "Exam Q";
  return t;
}

const AutopilotApprovalPage: React.FC = () => {
  const [filters, setFilters] = useState<AutopilotDraftsFilters>({});
  const [data, setData] = useState<AutopilotDraftsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailItem, setDetailItem] = useState<AutopilotDraftItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModalItem, setRejectModalItem] = useState<AutopilotDraftItem | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAutopilotDrafts(filters);
      setData(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load drafts");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const toggleSelect = (item: AutopilotDraftItem) => {
    const key = `${item.itemType}:${item.itemId}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.items?.length) return;
    if (selected.size >= data.items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.items.map((i) => `${i.itemType}:${i.itemId}`)));
    }
  };

  const handleApprove = async (item: AutopilotDraftItem) => {
    setActionLoading(`${item.itemType}:${item.itemId}`);
    try {
      await approveAutopilotItem({ itemType: item.itemType, itemId: item.itemId });
      setToast({ message: "Item approved", type: "success" });
      setDetailItem(null);
      loadDrafts();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(`${item.itemType}:${item.itemId}`);
        return next;
      });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Approval failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (item: AutopilotDraftItem, reason?: string) => {
    setActionLoading(`${item.itemType}:${item.itemId}`);
    try {
      await rejectAutopilotItem({ itemType: item.itemType, itemId: item.itemId, reason });
      setToast({ message: "Item rejected", type: "success" });
      setDetailItem(null);
      setRejectModalItem(null);
      setRejectReason("");
      loadDrafts();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(`${item.itemType}:${item.itemId}`);
        return next;
      });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Rejection failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = (item: AutopilotDraftItem) => {
    setRejectModalItem(item);
    setRejectReason("");
  };

  const handleBulkApprove = async () => {
    const items = Array.from(selected).map((key) => {
      const [itemType, itemId] = key.split(":");
      return { itemType, itemId };
    });
    if (items.length === 0) return;
    setActionLoading("bulk-approve");
    try {
      const res = await bulkApproveAutopilotItems({ items });
      setToast({
        message: `Approved ${res.approved?.length ?? 0} item(s)${(res.failed?.length ?? 0) > 0 ? `, ${res.failed?.length} failed` : ""}`,
        type: (res.failed?.length ?? 0) > 0 ? "error" : "success",
      });
      setSelected(new Set());
      loadDrafts();
      setDetailItem(null);
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Bulk approval failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkReject = async () => {
    const items = Array.from(selected).map((key) => {
      const [itemType, itemId] = key.split(":");
      return { itemType, itemId };
    });
    if (items.length === 0) return;
    setActionLoading("bulk-reject");
    try {
      const res = await bulkRejectAutopilotItems({ items, reason: rejectReason || undefined });
      setToast({
        message: `Rejected ${res.rejected?.length ?? 0} item(s)${(res.failed?.length ?? 0) > 0 ? `, ${res.failed?.length} failed` : ""}`,
        type: (res.failed?.length ?? 0) > 0 ? "error" : "success",
      });
      setSelected(new Set());
      setRejectReason("");
      loadDrafts();
      setDetailItem(null);
    } catch (err: any) {
      setToast({ message: err?.response?.data?.error || err?.message || "Bulk rejection failed", type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const items = data?.items ?? [];
  const summary = data?.summary ?? { totalDrafts: 0, flashcards: 0, quizQuestions: 0, examQuestions: 0 };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Link
          to="/admin"
          style={{
            padding: "0.5rem 1rem",
            background: "#f1f5f9",
            color: "#475569",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ← Back to Admin
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Autopilot Approval Queue</h1>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
        <select
          value={filters.specKey ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, specKey: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
        >
          {SPEC_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Topic key filter"
          value={filters.topicKey ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, topicKey: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, minWidth: 160 }}
        />
        <select
          value={filters.itemType ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, itemType: e.target.value || undefined }))}
          style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14 }}
        >
          {ITEM_TYPE_OPTIONS.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadDrafts}
          disabled={loading}
          style={{
            padding: "6px 12px",
            background: loading ? "#e2e8f0" : "#0369a1",
            color: "white",
            border: "none",
            borderRadius: 6,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: "1rem", fontSize: 14, color: "#64748b" }}>
        {summary.totalDrafts} draft(s) — Flashcards: {summary.flashcards} | Quiz: {summary.quizQuestions} | Exam: {summary.examQuestions}
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div style={{ marginBottom: "1rem", display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontWeight: 600 }}>{selected.size} selected</span>
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={!!actionLoading}
            style={{
              padding: "6px 12px",
              background: "#15803d",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: actionLoading ? "not-allowed" : "pointer",
            }}
          >
            Approve selected
          </button>
          <input
            type="text"
            placeholder="Reject reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            style={{ padding: "6px 12px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 14, minWidth: 180 }}
          />
          <button
            type="button"
            onClick={() => handleBulkReject()}
            disabled={!!actionLoading}
            style={{
              padding: "6px 12px",
              background: "#b91c1c",
              color: "white",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: actionLoading ? "not-allowed" : "pointer",
            }}
          >
            Reject selected
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            style={{
              padding: "6px 12px",
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {error && (
        <div style={{ padding: "1rem", background: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                <input
                  type="checkbox"
                  checked={items.length > 0 && selected.size >= items.length}
                  onChange={toggleSelectAll}
                  disabled={items.length === 0}
                />
              </th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Type</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Topic</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Preview</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Quality</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Status</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Created</th>
              <th style={{ padding: "10px 12px", textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                  No autopilot drafts found. Run Autopilot from Content Coverage to generate content.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const key = `${item.itemType}:${item.itemId}`;
                const isSelected = selected.has(key);
                const isActing = actionLoading === key;
                return (
                  <tr
                    key={key}
                    style={{
                      background: isSelected ? "#eff6ff" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setDetailItem(item)}
                  >
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item)} />
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{typeLabel(item.itemType)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
                      {item.topicTitle || item.topicKey || "—"}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", maxWidth: 200 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "block", whiteSpace: "nowrap" }}>
                        {item.titlePreview || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 12 }}>
                      {item.qualityScore != null ? (
                        <span
                          title={(item.qualityFlags || []).join(", ") || "No flags"}
                          style={{
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 600,
                            background:
                              item.qualityBand === "high"
                                ? "#d1fae5"
                                : item.qualityBand === "medium"
                                ? "#fef3c7"
                                : "#fee2e2",
                            color: "#0f172a",
                          }}
                        >
                          {item.qualityScore} {item.qualityBand ? `· ${item.qualityBand}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>
                      <span style={{ padding: "2px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 4, fontSize: 12 }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }}>{formatDate(item.createdAt)}</td>
                    <td style={{ padding: "10px 12px", borderBottom: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleApprove(item)}
                        disabled={!!actionLoading}
                        style={{
                          padding: "4px 8px",
                          marginRight: 4,
                          fontSize: 12,
                          background: "#15803d",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: isActing ? "not-allowed" : "pointer",
                        }}
                      >
                        {isActing ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openRejectModal(item)}
                        disabled={!!actionLoading}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          background: "#b91c1c",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: isActing ? "not-allowed" : "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Detail drawer */}
      {detailItem && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            width: 400,
            maxWidth: "100%",
            height: "100%",
            background: "white",
            boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
            zIndex: 1000,
            overflowY: "auto",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Draft details</h2>
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              style={{
                padding: "4px 12px",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
          <dl style={{ margin: 0, fontSize: 14 }}>
            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Type</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{typeLabel(detailItem.itemType)}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Topic</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailItem.topicTitle || detailItem.topicKey}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Spec</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailItem.specKey || "—"}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Preview</dt>
            <dd style={{ margin: "2px 0 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{detailItem.titlePreview}</dd>

            {detailItem.contentPreview && (
              <>
                <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Content</dt>
                <dd style={{ margin: "2px 0 0 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{detailItem.contentPreview}</dd>
              </>
            )}

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Status</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailItem.status}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Generated by</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{detailItem.generatedBy}</dd>

            <dt style={{ fontWeight: 600, color: "#64748b", marginTop: 12 }}>Created</dt>
            <dd style={{ margin: "2px 0 0 0" }}>{formatDate(detailItem.createdAt)}</dd>
          </dl>
          <div style={{ marginTop: "1.5rem", display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => handleApprove(detailItem)}
              disabled={!!actionLoading}
              style={{
                padding: "8px 16px",
                background: "#15803d",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => openRejectModal(detailItem)}
              disabled={!!actionLoading}
              style={{
                padding: "8px 16px",
                background: "#b91c1c",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: actionLoading ? "not-allowed" : "pointer",
              }}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModalItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
          }}
          onClick={() => setRejectModalItem(null)}
        >
          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: 12,
              maxWidth: 400,
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 1rem 0" }}>Reject item</h3>
            <p style={{ margin: "0 0 0.5rem 0", fontSize: 14, color: "#64748b" }}>
              {typeLabel(rejectModalItem.itemType)} — {rejectModalItem.topicTitle || rejectModalItem.topicKey}
            </p>
            <label style={{ display: "block", marginTop: 12, fontSize: 14 }}>
              Reason (optional)
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incorrect content, off-topic"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "8px 12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  fontSize: 14,
                  minHeight: 60,
                }}
              />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => handleReject(rejectModalItem, rejectReason || undefined)}
                disabled={!!actionLoading}
                style={{
                  padding: "8px 16px",
                  background: "#b91c1c",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: actionLoading ? "not-allowed" : "pointer",
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectModalItem(null);
                  setRejectReason("");
                }}
                style={{
                  padding: "8px 16px",
                  background: "#f1f5f9",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default AutopilotApprovalPage;
