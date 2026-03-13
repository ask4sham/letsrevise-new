/**
 * PR10: School readiness report — AQA GCSE Biology (teacher/admin).
 * Summary + by-unit + uncovered topics.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

type Totals = {
  lessonsPublished: number;
  lessonsDraft: number;
  ready: number;
  needsReview: number;
};

type UnitRow = {
  unit: string;
  topicsTotal: number;
  topicsCovered: number;
  requiredPracticalsTotal: number;
  requiredPracticalsCovered: number;
  readiness: { READY: number; NEEDS_REVIEW: number; DRAFT: number };
};

type UncoveredTopic = {
  key: string;
  topic: string;
  requiredPractical: boolean;
  tier?: string[];
};

type UncoveredByUnit = {
  unit: string;
  topics: UncoveredTopic[];
};

type Report = {
  ok: boolean;
  subject: string;
  examBoard: string;
  level: string;
  totals: Totals;
  byUnit: UnitRow[];
  uncoveredTopicsByUnit: UncoveredByUnit[];
};

export default function BiologyReadinessReportPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<Report>("/reports/aqa-gcse-biology/readiness?scope=me")
      .then((res) => {
        if (!cancelled && res?.data?.ok) setReport(res.data);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.response?.data?.error || e?.message || "Failed to load report");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleUnit = (unit: string) => {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unit)) next.delete(unit);
      else next.add(unit);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ color: "#6b7280" }}>Loading readiness report…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ color: "#b91c1c", marginBottom: 16 }}>{error}</div>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb" }}>Back to Dashboard</Link>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <div style={{ color: "#6b7280" }}>No report data.</div>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb" }}>Back to Dashboard</Link>
      </div>
    );
  }

  const { totals, byUnit, uncoveredTopicsByUnit } = report;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none" }}>
          ← Back to Dashboard
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px 0", fontSize: "1.5rem" }}>
        {report.subject} readiness report
      </h1>
      <p style={{ margin: "0 0 24px 0", color: "#6b7280", fontSize: "0.95rem" }}>
        {report.examBoard} {report.level} — your lessons
      </p>

      {/* Summary cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Published</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{totals.lessonsPublished}</div>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Draft</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111" }}>{totals.lessonsDraft}</div>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: "1px solid #86efac",
            background: "#dcfce7",
          }}
        >
          <div style={{ fontSize: 12, color: "#166534", marginBottom: 4 }}>Classroom-ready</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#166534" }}>{totals.ready}</div>
        </div>
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: "1px solid #fcd34d",
            background: "#fef3c7",
          }}
        >
          <div style={{ fontSize: 12, color: "#92400e", marginBottom: 4 }}>Needs review</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#92400e" }}>{totals.needsReview}</div>
        </div>
      </div>

      {/* By unit table */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>By unit</h2>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f3f4f6" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Unit</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Topics</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>RPs</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Ready</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Needs review</th>
              <th style={{ textAlign: "right", padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Draft</th>
            </tr>
          </thead>
          <tbody>
            {byUnit.map((row) => (
              <tr key={row.unit} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "10px 12px", fontWeight: 500 }}>{row.unit}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  {row.topicsCovered} / {row.topicsTotal}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  {row.requiredPracticalsCovered} / {row.requiredPracticalsTotal}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#16a34a" }}>{row.readiness.READY}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#b45309" }}>{row.readiness.NEEDS_REVIEW}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>{row.readiness.DRAFT}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Uncovered topics (collapsible per unit) */}
      <h2 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Uncovered topics</h2>
      {uncoveredTopicsByUnit.every((u) => u.topics.length === 0) ? (
        <p style={{ color: "#6b7280", fontSize: 14 }}>All topics in the curriculum have at least one published lesson.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {uncoveredTopicsByUnit
            .filter((u) => u.topics.length > 0)
            .map((u) => (
              <div
                key={u.unit}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fafafa",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleUnit(u.unit)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>{u.unit}</span>
                  <span style={{ color: "#6b7280", fontWeight: 400 }}>
                    {u.topics.length} topic{u.topics.length !== 1 ? "s" : ""} not covered
                  </span>
                  <span style={{ fontSize: 18 }}>{openUnits.has(u.unit) ? "−" : "+"}</span>
                </button>
                {openUnits.has(u.unit) && (
                  <div style={{ padding: "0 14px 14px 14px", borderTop: "1px solid #e5e7eb" }}>
                    <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                      {u.topics.map((t) => (
                        <li key={t.key} style={{ marginBottom: 6 }}>
                          {t.topic}
                          {t.requiredPractical && (
                            <span
                              style={{
                                marginLeft: 6,
                                fontSize: 11,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "#fef3c7",
                                color: "#92400e",
                              }}
                            >
                              RP
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
