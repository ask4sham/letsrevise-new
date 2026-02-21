/**
 * PR-EDGE-4: Student "My Work" dashboard — worksheets, quizzes, assessments.
 */
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStudentMyWork, type MyWorkItem, type MyWorkResponse } from "../api/studentMyWork";

type Tab = "worksheets" | "quizzes" | "assessments";

const statusStyle = (rawStatus: string) => {
  if (rawStatus === "In progress" || rawStatus === "IN_PROGRESS" || rawStatus === "in_progress") {
    return { background: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b" };
  }
  if (rawStatus === "Awaiting release" || rawStatus === "SUBMITTED" || rawStatus === "submitted") {
    return { background: "#dbeafe", color: "#1e40af", border: "1px solid #3b82f6" };
  }
  if (rawStatus === "Marked" || rawStatus === "MARKED") {
    return { background: "#d1fae5", color: "#065f46", border: "1px solid #10b981" };
  }
  return { background: "#f3f4f6", color: "#4b5563", border: "1px solid #d1d5db" };
};

function ItemRow({ item }: { item: MyWorkItem }) {
  const style = statusStyle(item.rawStatus);
  const primaryLabel = item.rawStatus === "IN_PROGRESS" || item.rawStatus === "in_progress" ? "Continue" : "View";
  const primaryLink =
    item.rawStatus === "IN_PROGRESS" || item.rawStatus === "in_progress"
      ? item.linkTo
      : (item as { viewLink?: string }).viewLink ?? item.linkTo;
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: 12, fontWeight: 600 }}>{item.title}</td>
      <td style={{ padding: 12 }}>
        <span style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12, ...style }}>{item.status}</span>
      </td>
      <td style={{ padding: 12, color: "#6b7280" }}>
        {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "—"}
      </td>
      <td style={{ padding: 12 }}>
        {item.released && item.score != null && item.maxScore != null
          ? `${item.score} / ${item.maxScore}`
          : "—"}
      </td>
      <td style={{ padding: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to={primaryLink} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>
          {primaryLabel}
        </Link>
        {item.linkTo && (
          <Link to={item.linkTo} style={{ color: "#6b7280", fontSize: 14, textDecoration: "none" }}>
            Open
          </Link>
        )}
      </td>
    </tr>
  );
}

export default function StudentMyWorkPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<MyWorkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("worksheets");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getStudentMyWork();
        if (mounted) setData(res);
      } catch (e: any) {
        if (mounted) setError(e?.response?.data?.error || e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const items: MyWorkItem[] =
    tab === "worksheets"
      ? data?.worksheets ?? []
      : tab === "quizzes"
      ? data?.quizzes ?? []
      : data?.assessments ?? [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link to="/student-dashboard" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>My Work</h1>
      <p style={{ margin: "0 0 16px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        Worksheets, quizzes and assessments
      </p>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["worksheets", "quizzes", "assessments"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: tab === t ? "2px solid #2563eb" : "1px solid #d1d5db",
              background: tab === t ? "#eff6ff" : "#fff",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
              textTransform: "capitalize",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "#6b7280", marginBottom: 16 }}>Loading…</div>}
      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {!loading && !error && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: 12 }}>Title</th>
                <th style={{ textAlign: "left", padding: 12 }}>Status</th>
                <th style={{ textAlign: "left", padding: 12 }}>Due</th>
                <th style={{ textAlign: "left", padding: 12 }}>Score</th>
                <th style={{ textAlign: "left", padding: 12 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, color: "#6b7280", textAlign: "center" }}>
                    No {tab} yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => <ItemRow key={item.id} item={item} />)
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
