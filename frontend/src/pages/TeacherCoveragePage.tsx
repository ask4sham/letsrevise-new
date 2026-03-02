/**
 * PR-COVERAGE-1: Teacher Content Coverage — same data as SPRINT_ORDER docs (single source of truth).
 * Route: /teacher/content-coverage
 */
import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { fetchQuestionBankAudit, type QuestionBankAuditRow, type QuestionBankAuditResponse } from "../api/questionBankAudit";
import type { SpecKey } from "../api/taxonomy";
import { sprintOrderFilename, questionBankAuditFilename } from "../utils/docFilenames";

type FilterMode = "all" | "missingBank" | "notFullyCovered";
type SortMode = "taxonomy" | "sprint";

/** Bank content = Flashcards + Quiz (what teachers create and attach to lessons). */
function hasBankContent(c: {
  flashcards?: number;
  mcq?: number;
  short?: number;
  quiz_mcq?: number;
  quiz_short?: number;
}) {
  return (
    (c.flashcards ?? 0) +
    (c.mcq ?? c.quiz_mcq ?? 0) +
    (c.short ?? c.quiz_short ?? 0)
  ) > 0;
}

/** Fully covered = all 4 banks have content (Flashcards, Quiz, Exam Qs, Past Paper Qs). */
function isFullyCoveredAllBanks(c: {
  flashcards?: number;
  mcq?: number;
  short?: number;
  quiz_mcq?: number;
  quiz_short?: number;
  examQuestions?: number;
  pastPaperQuestions?: number;
}) {
  return (
    (c.flashcards ?? 0) > 0 &&
    ((c.mcq ?? c.quiz_mcq ?? 0) + (c.short ?? c.quiz_short ?? 0) > 0) &&
    (c.examQuestions ?? 0) > 0 &&
    (c.pastPaperQuestions ?? 0) > 0
  );
}

/** Build units from audit rows and derive coverage for UI. Unit order = taxonomy (by min topicIndex). */
function auditRowsToUnits(rows: QuestionBankAuditRow[]) {
  const byUnit = new Map<string, QuestionBankAuditRow[]>();
  for (const r of rows) {
    const list = byUnit.get(r.mainTopicTitle) ?? [];
    list.push(r);
    byUnit.set(r.mainTopicTitle, list);
  }
  const unitNames = Array.from(byUnit.keys());
  const unitOrder = unitNames.sort((a, b) => {
    const minA = Math.min(...(byUnit.get(a) ?? []).map((r) => r.topicIndex));
    const minB = Math.min(...(byUnit.get(b) ?? []).map((r) => r.topicIndex));
    return minA - minB;
  });
  return unitOrder.map((unit) => {
    const topicRows = byUnit.get(unit) ?? [];
    const topics = topicRows.map((r) => {
      const c = r.counts;
      const score =
        (c.flashcards > 0 ? 1 : 0) +
        (c.mcq > 0 || c.short > 0 ? 1 : 0) +
        (c.examQuestions > 0 ? 1 : 0) +
        (c.pastPaperQuestions > 0 ? 1 : 0);
      const outOf = 4;
      const hasAnyContent =
        (c.flashcards ?? 0) +
        (c.mcq ?? 0) +
        (c.short ?? 0) +
        (c.examQuestions ?? 0) +
        (c.pastPaperQuestions ?? 0) >
        0;
      return {
        topic: r.subTopicTitle,
        topicKey: r.topicKey,
        namespacedTopicKey: `${r.topicKey}`,
        status: r.status,
        dod: r.dod,
        counts: {
          flashcards: c.flashcards,
          quiz_mcq: c.mcq,
          quiz_short: c.short,
          examQuestions: c.examQuestions,
          pastPaperQuestions: c.pastPaperQuestions,
        },
        coverage: {
          any: hasAnyContent,
          score,
          outOf,
        },
      };
    });
    return { unit, topics };
  });
}

const TeacherCoveragePage: React.FC = () => {
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const [data, setData] = useState<QuestionBankAuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("missingBank");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("taxonomy");
  const [docOpenError, setDocOpenError] = useState<string | null>(null);
  const navigate = useNavigate();

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
    setData(null);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQuestionBankAudit(specKey)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
          // Default filter remains "missingBank"; no override on load
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[Content Coverage] fetch failed", err);
          const msg =
            (err?.response?.data && typeof err.response.data === "object" && err.response.data.error) ||
            err?.message ||
            "Request failed";
          setError(typeof msg === "string" ? msg : "Request failed");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [specKey]);

  const rowsForDisplay = useMemo(() => {
    if (!data?.rows) return [];
    let rows = [...data.rows];
    if (sortMode === "sprint") {
      const order = { EMPTY: 0, GAP: 1, OK: 2 };
      rows = rows.sort((a, b) => {
        const sa = order[a.status] ?? 2;
        const sb = order[b.status] ?? 2;
        if (sa !== sb) return sa - sb;
        return a.topicIndex - b.topicIndex;
      });
    }
    return rows;
  }, [data?.rows, sortMode]);

  const units = useMemo(() => auditRowsToUnits(rowsForDisplay), [rowsForDisplay]);

  const filteredUnits = useMemo(() => {
    return units
      .map((unit) => {
        let topics = unit.topics;
        if (filterMode === "missingBank") {
          topics = topics.filter((t) => !hasBankContent(t.counts));
        } else if (filterMode === "notFullyCovered") {
          topics = topics.filter((t) => !isFullyCoveredAllBanks(t.counts));
        }
        // "all" → no filter
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          topics = topics.filter(
            (t) =>
              t.topic.toLowerCase().includes(q) ||
              t.topicKey.toLowerCase().includes(q) ||
              unit.unit.toLowerCase().includes(q)
          );
        }
        return { ...unit, topics };
      })
      .filter((u) => u.topics.length > 0);
  }, [units, filterMode, search]);

  const totals = useMemo(() => {
    if (!data?.rows)
      return { totalTopics: 0, missingBankCount: 0, withBankCount: 0, fullyCoveredCount: 0 };
    const totalTopics = data.rows.length;
    const missingBankCount = data.rows.filter((r) => !hasBankContent(r.counts)).length;
    const withBankCount = totalTopics - missingBankCount;
    const fullyCoveredCount = data.rows.filter((r) => isFullyCoveredAllBanks(r.counts)).length;
    return { totalTopics, missingBankCount, withBankCount, fullyCoveredCount };
  }, [data?.rows]);

  const sprintOrderFile = specKey ? sprintOrderFilename(specKey) : "";
  const auditFile = specKey ? questionBankAuditFilename(specKey) : "";

  const openSprintOrder = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!specKey) return;
    const file = sprintOrderFilename(specKey);
    setDocOpenError(null);
    window.location.hash = `#/docs/view?file=${encodeURIComponent(file)}`;
  };

  const openAudit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!specKey) return;
    const file = questionBankAuditFilename(specKey);
    setDocOpenError(null);
    window.location.hash = `#/docs/view?file=${encodeURIComponent(file)}`;
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Dashboard
        </Link>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Content Coverage</h1>
      </div>
      <p style={{ color: "#6b7280", marginBottom: 20 }}>
        See which taxonomy topics have content in Flashcards, Quiz, Exam Questions, and Past Paper Questions. Same data as Sprint Order docs.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <SpecSelector value={specKey} onChange={onSpecChange} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Sort:</label>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="taxonomy">Taxonomy order</option>
            <option value="sprint">Sprint priority (EMPTY → GAP → OK)</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontWeight: 600 }}>Show:</label>
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as FilterMode)}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="missingBank">Missing bank content (Flashcards/Quiz)</option>
            <option value="notFullyCovered">Not fully covered</option>
            <option value="all">All topics</option>
          </select>
        </div>
        <input
          type="search"
          placeholder="Search topic or collection…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            minWidth: 220,
          }}
        />
        <button
          type="button"
          onClick={openSprintOrder}
          disabled={!sprintOrderFile}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: sprintOrderFile ? "#f9fafb" : "#f3f4f6",
            fontWeight: 600,
            cursor: sprintOrderFile ? "pointer" : "not-allowed",
          }}
        >
          Open Sprint order
        </button>
        <button
          type="button"
          onClick={openAudit}
          disabled={!auditFile}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: auditFile ? "#f9fafb" : "#f3f4f6",
            fontWeight: 600,
            cursor: auditFile ? "pointer" : "not-allowed",
          }}
        >
          Open Audit
        </button>
      </div>

      {docOpenError && (
        <div style={{ padding: 10, marginBottom: 16, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 14 }}>
          {docOpenError}
        </div>
      )}

      {error && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: "#6b7280" }}>Loading coverage…</p>}

      {!loading && data && (
        <>
          <div style={{ marginBottom: 16, fontSize: 14, color: "#6b7280" }}>
            <strong>Totals:</strong> {totals.totalTopics} topics · {totals.missingBankCount} with no bank content (Flashcards/Quiz) · {totals.withBankCount} with bank content · {totals.fullyCoveredCount} fully covered (all 4 banks)
          </div>

          {filteredUnits.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              {filterMode === "missingBank"
                ? `There are ${totals.missingBankCount} topics with no Flashcards or Quiz content. Use "Not fully covered" to see topics that have some content but need more.`
                : "No topics match the current filters."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "left" }}>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Collection</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700 }}>Topic</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Flashcards</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Quiz MCQ</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Quiz Short</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Exam Qs</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "right" }}>Past Paper Qs</th>
                    <th style={{ padding: "10px 12px", fontWeight: 700, textAlign: "center" }}>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUnits.map((unit) =>
                    unit.topics.map((row) => (
                      <tr
                        key={row.topicKey + unit.unit}
                        style={{
                          borderBottom: "1px solid #e5e7eb",
                          background: row.coverage.any ? "transparent" : "#fef2f2",
                        }}
                      >
                        <td style={{ padding: "8px 12px", color: "#6b7280" }}>{unit.unit}</td>
                        <td style={{ padding: "8px 12px", fontWeight: 500 }}>{row.topic}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{row.counts.flashcards}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{row.counts.quiz_mcq}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{row.counts.quiz_short}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{row.counts.examQuestions}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{row.counts.pastPaperQuestions}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 12,
                              background:
                                row.coverage.score === row.coverage.outOf
                                  ? "#d1fae5"
                                  : row.coverage.any
                                    ? "#fef3c7"
                                    : "#f3f4f6",
                              color:
                                row.coverage.score === row.coverage.outOf
                                  ? "#065f46"
                                  : row.coverage.any
                                    ? "#92400e"
                                    : "#6b7280",
                            }}
                          >
                            {row.coverage.score}/{row.coverage.outOf}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeacherCoveragePage;
