import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

export type ReteachPlan = {
  content: string;
  pinned: boolean;
  generatedAt?: string;
  days?: number;
  studentSummary?: string;
};

type Props = {
  lessonId: string | null;
  /** Days of data for (re)generate; default 7 */
  days?: number;
};

export function ReteachPlanCard({ lessonId, days: insightsDays = 7 }: Props) {
  const [reteachPlan, setReteachPlan] = useState<ReteachPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);

  useEffect(() => {
    if (!lessonId) {
      setReteachPlan(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .get<{ ok: boolean; plan?: ReteachPlan }>(`/reports/lessons/${lessonId}/reteach-plan`)
      .then((res) => {
        if (!cancelled && res?.data?.ok && res.data.plan) setReteachPlan(res.data.plan);
        else if (!cancelled) setReteachPlan(null);
      })
      .catch(() => {
        if (!cancelled) setReteachPlan(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [lessonId]);

  if (!lessonId) {
    return (
      <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Reteach plan</div>
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Select a lesson to view or generate a reteach plan.</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    setGenerateLoading(true);
    try {
      const res = await api.post<{ ok: boolean; plan?: ReteachPlan }>(`/reports/lessons/${lessonId}/reteach-plan`, {
        days: insightsDays,
        limit: 10,
      });
      if (res?.data?.ok && res.data.plan) setReteachPlan(res.data.plan);
    } finally {
      setGenerateLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Reteach plan</div>
      {loading ? (
        <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Loading…</p>
      ) : reteachPlan ? (
        <>
          {reteachPlan.pinned && reteachPlan.content && (
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
              {reteachPlan.content.replace(/#+\s/g, "").slice(0, 220)}
              {reteachPlan.content.length > 220 ? "…" : ""}
            </div>
          )}
          {!reteachPlan.pinned && (
            <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b" }}>Plan available — open report to view or pin.</p>
          )}
          <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#374151" }}>
            Student next steps: {reteachPlan.studentSummary?.trim() ? "✓" : "—"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link to={`/teacher/reports/lesson/${lessonId}`} style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
              Edit in report
            </Link>
            <button
              type="button"
              disabled={generateLoading}
              onClick={handleGenerate}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #2563eb",
                background: "rgba(37,99,235,0.1)",
                cursor: generateLoading ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#2563eb",
                alignSelf: "flex-start",
              }}
            >
              {generateLoading ? "Generating…" : "Generate"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b" }}>No plan yet. Generate from report or here.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link to={`/teacher/reports/lesson/${lessonId}`} style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
              Edit in report
            </Link>
            <button
              type="button"
              disabled={generateLoading}
              onClick={handleGenerate}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #2563eb",
                background: "rgba(37,99,235,0.1)",
                cursor: generateLoading ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#2563eb",
                alignSelf: "flex-start",
              }}
            >
              {generateLoading ? "Generating…" : "Generate"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
