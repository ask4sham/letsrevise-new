// ============================
// Phase 1 Parent Progress — LOCKED
// Do NOT add raw scores, percentages,
// timings, or curriculum coverage here.
// See PHASE_1_INVARIANTS.md
// ============================
// /frontend/src/pages/ParentDashboard.tsx

import React, { useEffect, useState } from "react";
import api from "../services/api";

/**
 * ParentDashboard
 * - Fetch linked children for the logged-in parent (GET /parent/children)
 * - Fetch selected child's progress (GET /parent/children/:childId/progress)
 *
 * IMPORTANT:
 * This page must use the shared api client (../services/api)
 * so it always hits the SAME backend as login + the rest of the app
 * and always sends Bearer tokens consistently.
 */

type SubjectKey =
  | "Mathematics"
  | "English"
  | "Science"
  | "Languages"
  | "Humanities"
  | "Other";

type Child = {
  id: string;
  name: string;
  yearGroup?: string;
  email?: string;
};

type SubjectProgress = {
  subject: SubjectKey;
  progressPct: number; // display heuristic (NOT a "true score")
  statusLabel: "On track" | "Needs attention" | "Strong";
};

type ActivityItem = {
  id: string;
  dateISO: string;
  label: string;
  detail?: string;
};

type InsightItem = {
  label: string;
  detail?: string;
};

type ChildProgressBundle = {
  child: Child;
  overallPct: number;
  subjects: SubjectProgress[];
  recentActivity: ActivityItem[];
  strengths: InsightItem[];
  needsWork: InsightItem[];
  timeThisWeekMins: number;
  streakDays: number;
};

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function statusPillStyle(
  status: SubjectProgress["statusLabel"]
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    border: "1px solid #eaeaea",
    background: "#fff",
    color: "#333",
    whiteSpace: "nowrap",
  };

  if (status === "Strong")
    return {
      ...base,
      background: "#ecfdf3",
      borderColor: "#b7f0c6",
      color: "#166534",
    };
  if (status === "Needs attention")
    return {
      ...base,
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };
  return {
    ...base,
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1e40af",
  };
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

/**
 * Backend shapes (Phase 1 parent-safe signals)
 */
type ApiChild = {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  yearGroup?: string;
};

type ApiChildrenResponse = {
  children: ApiChild[] | Record<string, any>;
};

type ApiTrend = "improving" | "stable" | "declining";
type ApiStatus = "strength" | "needs_attention" | "neutral";

type ApiProgressResponse = {
  childId: string;
  overall: { status: ApiStatus; trend: ApiTrend };
  subjects: { name: string; status: ApiStatus; trend: ApiTrend }[];
  updatedAt: string;
};

function normaliseToSubjectKey(name: string): SubjectKey {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "Other";
  if (n.includes("math")) return "Mathematics";
  if (n.includes("english")) return "English";
  if (n.includes("science")) return "Science";
  if (n.includes("language")) return "Languages";
  if (n.includes("humanit")) return "Humanities";
  return "Other";
}

function uiStatusFromApiStatus(s: ApiStatus): SubjectProgress["statusLabel"] {
  if (s === "strength") return "Strong";
  if (s === "needs_attention") return "Needs attention";
  return "On track";
}

/**
 * IMPORTANT: display-only heuristic.
 * We do NOT claim "progress is a percentage"—this is just a UI gauge.
 */
function pctFromApiStatus(s: ApiStatus): number {
  if (s === "strength") return 82;
  if (s === "needs_attention") return 52;
  return 0; // neutral / no-signal placeholder
}

function buildInsightsFromSignals(
  overall: ApiProgressResponse["overall"] | null,
  subjects: ApiProgressResponse["subjects"] | null
) {
  const strengths: InsightItem[] = [];
  const needsWork: InsightItem[] = [];

  const subj = Array.isArray(subjects) ? subjects : [];
  const strong = subj.filter((x) => x.status === "strength");
  const needs = subj.filter((x) => x.status === "needs_attention");

  if (overall?.trend === "improving") {
    strengths.push({
      label: "Learning momentum",
      detail: "Recent answers suggest your child is improving.",
    });
  }

  if (strong.length > 0) {
    strengths.push({
      label: "Strengths",
      detail: strong
        .slice(0, 3)
        .map((s) => s.name)
        .join(", "),
    });
  }

  if (needs.length > 0) {
    needsWork.push({
      label: "Areas to focus next",
      detail: needs
        .slice(0, 3)
        .map((s) => s.name)
        .join(", "),
    });
  }

  if (overall?.trend === "declining") {
    needsWork.push({
      label: "A gentle check-in",
      detail:
        "Recent answers suggest some topics may benefit from a quick revisit.",
    });
  }

  return { strengths, needsWork };
}

const ParentDashboard: React.FC = () => {
  const token = getAuthToken();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  const [bundle, setBundle] = useState<ChildProgressBundle | null>(null);

  const [loadingChildren, setLoadingChildren] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const [errorChildren, setErrorChildren] = useState<string>("");
  const [errorProgress, setErrorProgress] = useState<string>("");

  const backendLabel =
    (api as any)?.defaults?.baseURL || process.env.REACT_APP_API_BASE || "unknown";

  // 1) Load linked children
  useEffect(() => {
    const run = async () => {
      setErrorChildren("");
      setLoadingChildren(true);

      try {
        // IMPORTANT: api client already prefixes /api and attaches Bearer token
        const res = await api.get<ApiChildrenResponse>("/parent/children");

        const raw = res.data?.children;

        let list: ApiChild[] = [];
        if (Array.isArray(raw)) list = raw;
        else if (raw && typeof raw === "object") {
          list = Object.values(raw) as ApiChild[];
        }

        const normalized: Child[] = list
          .filter((c) => !!c?.id)
          .map((c) => ({
            id: String(c.id),
            name:
              `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
              c.email ||
              "Child",
            yearGroup: c.yearGroup,
            email: c.email,
          }));

        setChildren(normalized);

        if (!selectedChildId && normalized[0]?.id) {
          setSelectedChildId(normalized[0].id);
        }

        if (normalized.length === 0) {
          setBundle(null);
        }
      } catch (e: any) {
        const msg =
          e?.response?.data?.msg ||
          e?.response?.data?.message ||
          "Failed to load linked children.";
        setErrorChildren(msg);
        setChildren([]);
        setBundle(null);
      } finally {
        setLoadingChildren(false);
      }
    };

    if (token) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 2) Load progress for selected child
  useEffect(() => {
    const run = async () => {
      if (!selectedChildId) return;

      setErrorProgress("");
      setLoadingProgress(true);

      try {
        const res = await api.get<ApiProgressResponse>(
          `/parent/children/${encodeURIComponent(selectedChildId)}/progress`
        );

        const apiRes = res.data;

        const childName =
          children.find((c) => c.id === selectedChildId)?.name || "Child";

        const overallPct = pctFromApiStatus(apiRes?.overall?.status || "neutral");

        // Phase 1 invariant: ONLY subjects returned by backend
        const apiSubjects = Array.isArray(apiRes?.subjects) ? apiRes.subjects : [];

        const subjects: SubjectProgress[] = apiSubjects
          .map((s) => ({
            subject:
              normaliseToSubjectKey(s.name) === "Other"
                ? (s.name as SubjectKey)
                : normaliseToSubjectKey(s.name),
            progressPct: pctFromApiStatus(s.status),
            statusLabel: uiStatusFromApiStatus(s.status),
          }))
          .filter(
            (s, idx, arr) => arr.findIndex((x) => x.subject === s.subject) === idx
          );

        const recentActivity: ActivityItem[] = []; // Phase 1: not returned yet

        const { strengths, needsWork } = buildInsightsFromSignals(
          apiRes?.overall || null,
          apiRes?.subjects || null
        );

        const built: ChildProgressBundle = {
          child: {
            id: String(apiRes?.childId || selectedChildId),
            name: childName,
            email: children.find((c) => c.id === selectedChildId)?.email,
            yearGroup: children.find((c) => c.id === selectedChildId)?.yearGroup,
          },
          overallPct,
          subjects,
          recentActivity,
          strengths,
          needsWork,
          timeThisWeekMins: 0, // Phase 1: intentionally not in contract
          streakDays: 0, // Phase 1: intentionally not in contract
        };

        setBundle(built);
      } catch (e: any) {
        const msg =
          e?.response?.data?.msg ||
          e?.response?.data?.message ||
          "Failed to load child progress.";
        setErrorProgress(msg);
        setBundle(null);
      } finally {
        setLoadingProgress(false);
      }
    };

    if (token) run();
  }, [selectedChildId, token, children]);

  // UI states
  if (!token) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6 }}>Child Progress</h1>
        <p style={{ marginTop: 0, color: "#555" }}>
          You’re not logged in. Please log in as a parent to view child progress.
        </p>
      </div>
    );
  }

  if (loadingChildren) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6 }}>Child Progress</h1>
        <p style={{ marginTop: 0, color: "#555" }}>Loading linked children…</p>
      </div>
    );
  }

  if (errorChildren) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6 }}>Child Progress</h1>
        <p style={{ marginTop: 0, color: "#c00" }}>⚠️ {errorChildren}</p>
        <p style={{ marginTop: 10, color: "#555" }}>
          Backend: <span style={{ fontFamily: "monospace" }}>{backendLabel}</span>
        </p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ marginBottom: 6 }}>Child Progress</h1>
        <p style={{ marginTop: 0, color: "#555" }}>
          No child profiles are linked to this parent account yet.
        </p>
        <p style={{ marginTop: 10, color: "#555" }}>
          Backend: <span style={{ fontFamily: "monospace" }}>{backendLabel}</span>
        </p>
      </div>
    );
  }

  const selected = bundle;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ marginBottom: 6 }}>Child Progress</h1>
        <p style={{ marginTop: 0, color: "#555" }}>
          Parent view: monitor learning progress and recent activity.
        </p>
        <div style={{ color: "#777", fontSize: 12 }}>
          Backend: <span style={{ fontFamily: "monospace" }}>{backendLabel}</span>
        </div>
      </div>

      {/* Child selector */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, color: "#333" }}>Child</div>
        <select
          value={selectedChildId}
          onChange={(e) => setSelectedChildId(e.target.value)}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: "white",
            minWidth: 240,
            fontSize: 14,
          }}
          aria-label="Select child"
        >
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.yearGroup ? ` — ${c.yearGroup}` : ""}
            </option>
          ))}
        </select>
      </div>

      {loadingProgress && (
        <div style={{ marginBottom: 12, color: "#555" }}>Loading progress…</div>
      )}
      {errorProgress && (
        <div style={{ marginBottom: 12, color: "#c00" }}>⚠️ {errorProgress}</div>
      )}

      {!selected ? (
        <div
          style={{
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 12,
            background: "#ffffff",
            boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ color: "#555" }}>Select a child to view progress.</div>
        </div>
      ) : (
        <>
          {/* Top summary cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                Overall progress
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111" }}>
                {clampPct(selected.overallPct)}%
              </div>
              <div style={{ marginTop: 10 }}>
                <div
                  style={{
                    height: 10,
                    borderRadius: 999,
                    background: "#f1f5f9",
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      width: `${clampPct(selected.overallPct)}%`,
                      height: "100%",
                      background: "#6366f1",
                    }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 10, color: "#777", fontSize: 12 }}>
                This is a parent-friendly indicator (not a raw score).
              </div>
            </div>

            <div
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                Learning this week
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111" }}>
                {Math.max(0, Math.round(selected.timeThisWeekMins))} mins
              </div>
              <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
                Keep a steady routine for best retention.
              </div>
            </div>

            <div
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                Current streak
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#111" }}>
                {Math.max(0, Math.round(selected.streakDays))} days
              </div>
              <div style={{ marginTop: 6, color: "#666", fontSize: 13 }}>
                Consistency beats cramming.
              </div>
            </div>
          </div>

          {/* Subject progress + Recent activity */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14,
              marginBottom: 18,
            }}
          >
            <section
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
              aria-label="Progress by subject"
            >
              <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>
                Progress by subject
              </h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selected.subjects.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px dashed #e5e7eb",
                      background: "#fafafa",
                      color: "#555",
                      fontSize: 14,
                    }}
                  >
                    No subject activity yet — once your child completes quizzes,
                    progress will appear here.
                  </div>
                ) : (
                  selected.subjects.map((s) => (
                    <div
                      key={s.subject}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #f0f0f0",
                        background: "#fafafa",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#111" }}>
                          {s.subject}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ fontWeight: 800, color: "#111" }}>
                            {clampPct(s.progressPct)}%
                          </div>
                          <span style={statusPillStyle(s.statusLabel)}>
                            {s.statusLabel}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          height: 10,
                          borderRadius: 999,
                          background: "#f1f5f9",
                          overflow: "hidden",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            width: `${clampPct(s.progressPct)}%`,
                            height: "100%",
                            background: "#6366f1",
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ marginTop: 10, color: "#777", fontSize: 12 }}>
                Subject signals are based on quiz performance trends (Phase 1).
              </div>
            </section>

            <section
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
              aria-label="Recent activity"
            >
              <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>
                Recent activity
              </h2>

              {selected.recentActivity.length === 0 ? (
                <p style={{ color: "#666", marginTop: 0 }}>
                  No recent activity yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {selected.recentActivity.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #f0f0f0",
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800, color: "#111" }}>{a.label}</div>
                        <div style={{ color: "#666", fontSize: 12 }}>{fmtDate(a.dateISO)}</div>
                      </div>
                      {a.detail && (
                        <div style={{ marginTop: 6, color: "#444", fontSize: 13 }}>
                          {a.detail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Strengths / Needs work */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
            <section
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
              aria-label="Strengths"
            >
              <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>
                Strengths
              </h2>

              {selected.strengths.length === 0 ? (
                <p style={{ color: "#666", marginTop: 0 }}>No insights yet.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, color: "#333" }}>
                  {selected.strengths.map((x, idx) => (
                    <li key={`${x.label}-${idx}`} style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 800 }}>{x.label}</span>
                      {x.detail ? <span style={{ color: "#555" }}> — {x.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              style={{
                padding: 16,
                border: "1px solid #eee",
                borderRadius: 12,
                background: "#ffffff",
                boxShadow: "0 4px 14px rgba(0,0,0,0.04)",
              }}
              aria-label="Needs attention"
            >
              <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>
                Needs attention
              </h2>

              {selected.needsWork.length === 0 ? (
                <p style={{ color: "#666", marginTop: 0 }}>No concerns flagged.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, color: "#333" }}>
                  {selected.needsWork.map((x, idx) => (
                    <li key={`${x.label}-${idx}`} style={{ marginBottom: 8 }}>
                      <span style={{ fontWeight: 800 }}>{x.label}</span>
                      {x.detail ? <span style={{ color: "#555" }}> — {x.detail}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div style={{ marginTop: 16, color: "#777", fontSize: 12 }}>
            Note: This is a parent-only progress view. It avoids raw technical
            metrics and focuses on supportive guidance.
          </div>
        </>
      )}
    </div>
  );
};

export default ParentDashboard;
