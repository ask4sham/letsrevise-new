/**
 * Admin — MCQ Rationale Inventory (V2.2).
 * Strictly read-only: no generate / approve / save / backfill controls.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  fetchMcqRationaleInventory,
  type McqRationaleInventoryItem,
  type McqRationaleInventoryResponse,
  type RationaleBucket,
} from "../api/mcqRationaleInventory";

const BUCKETS: Array<{ key: RationaleBucket | "eligible"; label: string; color: string; bg: string }> = [
  { key: "missing", label: "Missing", color: "#9a3412", bg: "#ffedd5" },
  { key: "empty", label: "Empty", color: "#a16207", bg: "#fef9c3" },
  { key: "generic", label: "Generic", color: "#6b21a8", bg: "#f3e8ff" },
  { key: "substantive", label: "Substantive", color: "#166534", bg: "#dcfce7" },
  { key: "malformed", label: "Malformed", color: "#991b1b", bg: "#fee2e2" },
  { key: "eligible", label: "Potential V2.3", color: "#1e40af", bg: "#dbeafe" },
];

function bucketStyle(bucket: string): { color: string; bg: string } {
  const found = BUCKETS.find((b) => b.key === bucket);
  return found ? { color: found.color, bg: found.bg } : { color: "#334155", bg: "#f1f5f9" };
}

const emptyFilters = {
  subject: "",
  examBoard: "",
  level: "",
  topicKey: "",
  status: "",
  rationaleBucket: "",
  potentiallyEligibleForBackfill: "",
  page: 1,
  pageSize: 25,
};

export default function AdminMcqRationaleInventoryPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser({ watchLocation: true });
  const [filters, setFilters] = useState(emptyFilters);
  const [data, setData] = useState<McqRationaleInventoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isAdmin = user?.userType === "admin";
    const isCm = (user as { staffRole?: string } | null)?.staffRole === "content_manager";
    if (user && !isAdmin && !isCm) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMcqRationaleInventory({
        subject: filters.subject || undefined,
        examBoard: filters.examBoard || undefined,
        level: filters.level || undefined,
        topicKey: filters.topicKey || undefined,
        status: filters.status || undefined,
        rationaleBucket: filters.rationaleBucket || undefined,
        potentiallyEligibleForBackfill: filters.potentiallyEligibleForBackfill || undefined,
        page: filters.page,
        pageSize: filters.pageSize,
      });
      setData(res);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string"
          ? (e as { message: string }).message
          : "Failed to load rationale inventory.";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = data?.summary;
  const items: McqRationaleInventoryItem[] = data?.items || [];

  return (
    <div data-testid="mcq-rationale-inventory-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 48px" }}>
      <div style={{ marginBottom: 8 }}>
        <Link to="/admin" style={{ color: "#2563eb", fontSize: 14, textDecoration: "none" }}>
          ← Admin
        </Link>
      </div>
      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#0f172a" }}>MCQ Rationale Inventory</h1>
      <p style={{ margin: "0 0 12px", color: "#475569", fontSize: 15, lineHeight: 1.5 }}>
        Read-only report of rationale coverage in Composite Exam MCQs.
      </p>
      <div
        data-testid="mcq-rationale-inventory-readonly-notice"
        style={{
          marginBottom: 20,
          padding: "10px 12px",
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          color: "#334155",
          fontSize: 13,
        }}
      >
        This page cannot generate, edit, approve, save or backfill rationales. Counts are MCQ parts unless labelled as
        questions.
      </div>

      {summary ? (
        <div
          data-testid="mcq-rationale-inventory-summary"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 20,
          }}
        >
          <SummaryCard label="Composite questions" value={summary.totalCompositeQuestions} />
          <SummaryCard label="MCQ parts" value={summary.totalCompositeMcqParts} />
          {BUCKETS.map((b) => (
            <SummaryCard
              key={b.key}
              label={b.label}
              value={b.key === "eligible" ? summary.potentiallyEligible : summary[b.key as RationaleBucket]}
              color={b.color}
              bg={b.bg}
            />
          ))}
          <SummaryCard label="Published parts" value={summary.published} />
          <SummaryCard label="Draft parts" value={summary.draft} />
        </div>
      ) : null}

      <div
        data-testid="mcq-rationale-inventory-filters"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
          alignItems: "flex-end",
        }}
      >
        <FilterInput
          label="Subject"
          value={filters.subject}
          onChange={(v) => setFilters((f) => ({ ...f, subject: v, page: 1 }))}
        />
        <FilterInput
          label="Exam board"
          value={filters.examBoard}
          onChange={(v) => setFilters((f) => ({ ...f, examBoard: v, page: 1 }))}
        />
        <FilterInput
          label="Level"
          value={filters.level}
          onChange={(v) => setFilters((f) => ({ ...f, level: v, page: 1 }))}
        />
        <FilterInput
          label="Topic key"
          value={filters.topicKey}
          onChange={(v) => setFilters((f) => ({ ...f, topicKey: v, page: 1 }))}
        />
        <label style={labelStyle}>
          Status
          <select
            aria-label="Status filter"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}
            style={inputStyle}
          >
            <option value="">Active (draft + published)</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label style={labelStyle}>
          Bucket
          <select
            aria-label="Rationale bucket filter"
            data-testid="filter-rationale-bucket"
            value={filters.rationaleBucket}
            onChange={(e) => setFilters((f) => ({ ...f, rationaleBucket: e.target.value, page: 1 }))}
            style={inputStyle}
          >
            <option value="">All buckets</option>
            <option value="missing">Missing</option>
            <option value="empty">Empty</option>
            <option value="generic">Generic</option>
            <option value="substantive">Substantive</option>
            <option value="malformed">Malformed</option>
          </select>
        </label>
        <label style={labelStyle}>
          V2.3 eligible
          <select
            aria-label="Potential backfill eligibility filter"
            value={filters.potentiallyEligibleForBackfill}
            onChange={(e) =>
              setFilters((f) => ({ ...f, potentiallyEligibleForBackfill: e.target.value, page: 1 }))
            }
            style={inputStyle}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p data-testid="mcq-rationale-inventory-loading" style={{ color: "#64748b" }}>
          Loading inventory…
        </p>
      ) : null}
      {error ? (
        <p data-testid="mcq-rationale-inventory-error" role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p data-testid="mcq-rationale-inventory-empty" style={{ color: "#64748b" }}>
          No Composite MCQ parts match these filters.
        </p>
      ) : null}

      <div data-testid="mcq-rationale-inventory-results" style={{ display: "grid", gap: 12 }}>
        {items.map((row) => {
          const style = bucketStyle(row.rationaleBucket);
          return (
            <article
              key={`${row.questionId}:${row.partLabel}`}
              data-testid="mcq-rationale-inventory-row"
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
                background: "#fff",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {[row.subject, row.examBoard, row.level].filter(Boolean).join(" · ") || "—"}
                </span>
                <span style={{ fontSize: 12, color: "#475569" }}>{row.topic || row.topicKey || "—"}</span>
                <Badge text={row.status || "—"} />
                <Badge text={row.rationaleBucket} color={style.color} bg={style.bg} />
                {row.potentiallyEligibleForBackfill ? (
                  <Badge text="potential V2.3" color="#1e40af" bg="#dbeafe" />
                ) : null}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6, wordBreak: "break-word" }}>
                ({row.partLabel}) {row.questionText}
              </div>
              <div style={{ fontSize: 13, color: "#334155", marginBottom: 6 }}>
                Correct: <strong>{row.correctOption || "—"}</strong>
              </div>
              <div style={{ fontSize: 13, color: "#475569", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                Rationale: {row.currentRationale || "—"}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#64748b" }}>
                Updated {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : "—"} · Owner {row.ownerName}
                {" · "}
                <Link
                  to={`/teacher/exam-question-bank?highlightId=${encodeURIComponent(row.questionId)}`}
                  style={{ color: "#2563eb" }}
                >
                  Open in Question Bank
                </Link>
                {row.status === "draft" &&
                row.potentiallyEligibleForBackfill &&
                row.rationaleBucket !== "malformed" &&
                row.rationaleBucket !== "substantive" ? (
                  <>
                    {" · "}
                    <Link
                      data-testid="mcq-rationale-inventory-review-link"
                      to={`/admin/exam-question-rationale-inventory/${encodeURIComponent(row.questionId)}/${encodeURIComponent(row.partLabel)}/review`}
                      style={{ color: "#2563eb" }}
                    >
                      Review →
                    </Link>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {data && data.totalMatchingParts > 0 ? (
        <div
          data-testid="mcq-rationale-inventory-pagination"
          style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 20, flexWrap: "wrap" }}
        >
          <button
            type="button"
            disabled={filters.page <= 1 || loading}
            onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
            style={btnStyle}
          >
            Previous
          </button>
          <span style={{ fontSize: 13, color: "#475569" }}>
            Page {data.page} of {data.totalPages} · {data.totalMatchingParts} matching parts
          </span>
          <button
            type="button"
            disabled={filters.page >= data.totalPages || loading}
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            style={btnStyle}
          >
            Next
          </button>
        </div>
      ) : null}

      {data?.linkedLessonCount?.deferred ? (
        <p style={{ marginTop: 16, fontSize: 12, color: "#94a3b8" }}>
          Linked lesson counts are deferred in V2.2 ({data.linkedLessonCount.reason}).
        </p>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color?: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        padding: "12px 12px 10px",
        background: bg || "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: color || "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || "#0f172a", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function Badge({ text, color, bg }: { text: string; color?: string; bg?: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.3,
        padding: "3px 8px",
        borderRadius: 999,
        color: color || "#334155",
        background: bg || "#e2e8f0",
      }}
    >
      {text}
    </span>
  );
}

function FilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  minWidth: 120,
  padding: "7px 8px",
  borderRadius: 6,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  fontWeight: 400,
};

const btnStyle: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
