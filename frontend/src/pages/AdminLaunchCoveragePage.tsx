/**
 * Read-only Coverage Dashboard — published counts per canonical specKey + topicKey.
 * Route: /admin/launch-coverage
 * Rows link to teacher/admin tools to fill gaps; API remains read-only.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { fetchAdminTopicLaunchCoverage, type LaunchCoverageRow } from "../api/adminLaunchCoverage";
import type { SpecKey } from "../api/taxonomy";

const READINESS_OPTIONS = ["all", "ready", "partial", "missing"] as const;

function topicSlugFromNamespaced(namespacedTopicKey: string): string {
  if (!namespacedTopicKey) return "";
  return namespacedTopicKey.includes(":")
    ? namespacedTopicKey.split(":").pop()!.trim()
    : namespacedTopicKey.trim();
}

/** Lesson is counted but the row still flags a lesson gap — treat as mapping/key mismatch. */
function lessonExistsButShowsMissing(row: LaunchCoverageRow): boolean {
  if (row.publishedLessonCount < 1) return false;
  if (row.status === "missing") return true;
  if (row.missingSummary?.includes("lesson")) return true;
  return false;
}

function bankHref(kind: "flashcards" | "quizzes" | "exam", row: LaunchCoverageRow): string {
  const enc = encodeURIComponent;
  return kind === "exam"
    ? `/teacher/exam-question-bank?specKey=${enc(row.specKey)}&topicKey=${enc(row.topicKey)}`
    : `/teacher/topic-banks/${kind}?specKey=${enc(row.specKey)}&topicKey=${enc(row.topicKey)}`;
}

function StatusBadge({ status }: { status: LaunchCoverageRow["status"] }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ready: { bg: "#d1fae5", color: "#047857", label: "READY" },
    partial: { bg: "#fef3c7", color: "#b45309", label: "PARTIAL" },
    missing: { bg: "#fee2e2", color: "#b91c1c", label: "MISSING" },
  };
  const s = map[status] ?? map.missing;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function RowActions({ row }: { row: LaunchCoverageRow }) {
  const slug = topicSlugFromNamespaced(row.topicKey);
  const topicCommandHref = `/admin/topic/${encodeURIComponent(row.specKey)}/${encodeURIComponent(slug)}`;
  const linkStyle: React.CSSProperties = { color: "#2563eb", fontWeight: 600, fontSize: 13 };

  if (lessonExistsButShowsMissing(row)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", maxWidth: 280 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e" }}>Fix topic mapping</span>
        <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          A published lesson is counted, but this topic still looks incomplete. Align lesson/bank{" "}
          <code style={{ fontSize: 11 }}>topicKey</code> with the canonical taxonomy.
        </span>
        <Link to={topicCommandHref} style={linkStyle}>
          Topic command →
        </Link>
        <Link to="/admin/taxonomy" style={linkStyle}>
          Curriculum / Taxonomy →
        </Link>
      </div>
    );
  }

  const needsLesson = row.publishedLessonCount < 1;
  const needFc = row.publishedFlashcardCount < 1;
  const needQuiz = row.publishedQuizCount < 1;
  const needExam = row.publishedExamCount < 1;
  const anyGap = needsLesson || needFc || needQuiz || needExam;

  if (!anyGap) {
    return <span style={{ color: "#94a3b8", fontSize: 13 }}>—</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", maxWidth: 300 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#1e40af" }}>Generate missing content</span>
      {needsLesson && (
        <Link
          to="/create-lesson"
          state={{ specKey: row.specKey, topicKey: row.topicKey }}
          style={linkStyle}
        >
          Create lesson →
        </Link>
      )}
      {needFc && (
        <Link to={bankHref("flashcards", row)} style={linkStyle}>
          Flashcards →
        </Link>
      )}
      {needQuiz && (
        <Link to={bankHref("quizzes", row)} style={linkStyle}>
          Quiz →
        </Link>
      )}
      {needExam && (
        <Link to={bankHref("exam", row)} style={linkStyle}>
          Exam →
        </Link>
      )}
      {needsLesson && (
        <p style={{ fontSize: 11, color: "#64748b", margin: 0, lineHeight: 1.35 }}>
          Already published a lesson but count is still zero?{" "}
          <Link to={topicCommandHref} style={{ color: "#2563eb", fontWeight: 600 }}>
            Check topic mapping
          </Link>
        </p>
      )}
    </div>
  );
}

export default function AdminLaunchCoveragePage() {
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const [rows, setRows] = useState<LaunchCoverageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<(typeof READINESS_OPTIONS)[number]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAdminTopicLaunchCoverage(specKey)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [specKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (readiness !== "all" && r.status !== readiness) return false;
      if (!q) return true;
      return (
        r.topicLabel.toLowerCase().includes(q) ||
        r.topicKey.toLowerCase().includes(q) ||
        r.specKey.toLowerCase().includes(q)
      );
    });
  }, [rows, readiness, search]);

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/admin" style={{ color: "#2563eb", fontWeight: 600 }}>
          ← Admin
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Coverage Dashboard</h1>
      <p style={{ color: "#64748b", marginBottom: 20, maxWidth: 720 }}>
        Read-only per-topic counts (canonical specKey + topicKey): published lessons, quiz questions, exam questions,
        flashcards. Ready / Partial / Missing reflects launch readiness. Use <strong>Next steps</strong>: if a lesson
        is counted but the row still looks wrong, fix topic mapping; otherwise open only the links you still need to
        fill.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <div>
          <SpecSelector value={specKey} onChange={onSpecChange} />
        </div>
        <label style={{ fontWeight: 600 }}>
          Readiness
          <select
            value={readiness}
            onChange={(e) => setReadiness(e.target.value as (typeof READINESS_OPTIONS)[number])}
            style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 6 }}
          >
            <option value="all">All</option>
            <option value="ready">Ready</option>
            <option value="partial">Partial</option>
            <option value="missing">Missing</option>
          </select>
        </label>
        <label style={{ fontWeight: 600 }}>
          Search
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Topic label or topicKey"
            style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 6, minWidth: 220 }}
          />
        </label>
      </div>

      {loading && <p style={{ color: "#64748b" }}>Loading…</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!loading && !error && (
        <>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 8 }}>
            Showing {filtered.length} of {rows.length} topics
          </p>
          <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Topic</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Topic key</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Lessons</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Quiz</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Exam</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Flashcards</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Status</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Gaps</th>
                  <th style={{ padding: 10, borderBottom: "1px solid #e2e8f0" }}>Links</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.topicKey} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10, fontWeight: 600 }}>{row.topicLabel}</td>
                    <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{row.topicKey}</td>
                    <td style={{ padding: 10 }}>{row.publishedLessonCount}</td>
                    <td style={{ padding: 10 }}>{row.publishedQuizCount}</td>
                    <td style={{ padding: 10 }}>{row.publishedExamCount}</td>
                    <td style={{ padding: 10 }}>{row.publishedFlashcardCount}</td>
                    <td style={{ padding: 10 }}>
                      <StatusBadge status={row.status} />
                    </td>
                    <td style={{ padding: 10, fontSize: 12, color: "#64748b" }}>{row.missingSummary ?? "—"}</td>
                    <td style={{ padding: 10, verticalAlign: "top" }}>
                      <RowActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
