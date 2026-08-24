/**
 * Admin — read-only Exam Question view by ID.
 * No edit / save / publish / generate controls.
 */
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  fetchAdminExamQuestionView,
  type AdminExamQuestionOption,
  type AdminExamQuestionPart,
  type AdminExamQuestionView,
} from "../api/adminExamQuestionView";

function isValidObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

export default function AdminExamQuestionViewPage() {
  const navigate = useNavigate();
  const { questionId: rawQuestionId } = useParams<{ questionId: string }>();
  const { user } = useCurrentUser({ watchLocation: true });
  const [data, setData] = useState<AdminExamQuestionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    const isAdmin = user?.userType === "admin";
    const isCm = (user as { staffRole?: string } | null)?.staffRole === "content_manager";
    if (user && !isAdmin && !isCm) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      setData(null);

      const questionId = (rawQuestionId || "").trim();
      if (!questionId || !isValidObjectId(questionId)) {
        setError("The Exam Question could not be loaded.");
        setErrorCode("INVALID_QUESTION_ID");
        setLoading(false);
        return;
      }

      try {
        const res = await fetchAdminExamQuestionView(questionId);
        if (!cancelled) setData(res);
      } catch (e: unknown) {
        if (cancelled) return;
        const ax = e as {
          message?: string;
          response?: { status?: number; data?: { error?: string; code?: string } };
        };
        const status = ax.response?.status;
        const code = ax.response?.data?.code || null;
        const apiError = ax.response?.data?.error;
        if (status === 403 || status === 401) {
          setError("You do not have permission to view this Exam Question.");
          setErrorCode(code || "ACCESS_DENIED");
        } else if (status === 404) {
          setError(apiError || "Exam Question not found.");
          setErrorCode(code || "QUESTION_NOT_FOUND");
        } else if (status === 400) {
          setError(apiError || "The Exam Question could not be loaded.");
          setErrorCode(code || "INVALID_QUESTION_ID");
        } else {
          setError(apiError || ax.message || "The Exam Question could not be loaded.");
          setErrorCode(code || "LOAD_FAILED");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [rawQuestionId]);

  return (
    <div data-testid="admin-exam-question-view-page" style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px 48px" }}>
      <div style={{ marginBottom: 8 }}>
        <Link
          to="/admin/question-banks"
          data-testid="admin-exam-question-view-back"
          style={{ color: "#2563eb", fontSize: 14, textDecoration: "none" }}
        >
          ← Back to Question Banks
        </Link>
      </div>

      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#0f172a" }}>Exam Question</h1>

      <div
        data-testid="admin-exam-question-view-readonly-notice"
        role="note"
        style={{
          marginBottom: 20,
          padding: "10px 12px",
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          color: "#334155",
          fontSize: 13,
          lineHeight: 1.5,
        }}
      >
        <strong>Read-only view.</strong> This page does not change the Exam Question.
      </div>

      {loading ? (
        <p data-testid="admin-exam-question-view-loading" style={{ color: "#64748b" }}>
          Loading Exam Question…
        </p>
      ) : null}

      {!loading && error ? (
        <div
          data-testid="admin-exam-question-view-error"
          role="alert"
          style={{
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            fontSize: 14,
          }}
        >
          <div>{error}</div>
          {errorCode ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>Code: {errorCode}</div>
          ) : null}
        </div>
      ) : null}

      {!loading && data ? <ViewBody data={data} /> : null}
    </div>
  );
}

function ViewBody({ data }: { data: AdminExamQuestionView }) {
  const isComposite = data.questionMode === "composite" || data.type === "composite" || data.parts.length > 0;
  const media = data.mediaSummary;

  return (
    <div data-testid="admin-exam-question-view-body" style={{ display: "grid", gap: 18 }}>
      <section aria-labelledby="aqv-meta-heading">
        <h2 id="aqv-meta-heading" style={sectionHeading}>
          Source metadata
        </h2>
        <dl style={metaGrid}>
          <MetaItem label="Subject" value={data.subject || "—"} />
          <MetaItem label="Exam board" value={data.examBoard || "—"} />
          <MetaItem label="Level" value={data.level || "—"} />
          <MetaItem label="Topic" value={data.topic || data.topicKey || "—"} />
          <MetaItem label="Status" value={data.status || "—"} />
          <MetaItem label="Type" value={data.type || data.questionMode || "—"} />
          <MetaItem label="Owner" value={data.ownerName || "—"} />
          <MetaItem label="Question ID" value={data.id} testId="admin-exam-question-view-id" />
        </dl>
        <p style={{ ...bodyText, marginTop: 10, fontSize: 12, color: "#64748b" }}>
          Created {formatTs(data.createdAt)} · Updated {formatTs(data.updatedAt)}
        </p>
      </section>

      <section aria-labelledby="aqv-media-heading">
        <h2 id="aqv-media-heading" style={sectionHeading}>
          Media summary
        </h2>
        <p data-testid="admin-exam-question-view-media-summary" style={bodyText}>
          {media.questionImagePresent || media.assetCount > 0
            ? `Question-level media reference present${media.assetCount ? ` (${media.assetCount} asset summar${media.assetCount === 1 ? "y" : "ies"})` : ""}.`
            : "No question-level media reference recorded."}
        </p>
      </section>

      <section aria-labelledby="aqv-question-heading">
        <h2 id="aqv-question-heading" style={sectionHeading}>
          Question
        </h2>
        {data.sharedStem ? (
          <p data-testid="admin-exam-question-view-shared-stem" style={bodyText}>
            <strong>Shared stem:</strong> {data.sharedStem}
          </p>
        ) : null}
        {data.question && !isComposite ? (
          <p data-testid="admin-exam-question-view-question-text" style={{ ...bodyText, fontWeight: 600 }}>
            {data.question}
          </p>
        ) : null}
        {data.question && isComposite ? (
          <p data-testid="admin-exam-question-view-composite-title" style={{ ...bodyText, color: "#64748b" }}>
            {data.title || data.question}
          </p>
        ) : null}

        {!isComposite ? (
          <>
            <OptionsList options={data.options} testId="admin-exam-question-view-options" />
            <p style={{ ...bodyText, marginTop: 12 }}>
              Marks: <strong>{data.marks == null ? "—" : data.marks}</strong>
            </p>
            <MarkScheme lines={data.markScheme} testId="admin-exam-question-view-mark-scheme" />
          </>
        ) : null}
      </section>

      {isComposite ? (
        <section aria-labelledby="aqv-parts-heading">
          <h2 id="aqv-parts-heading" style={sectionHeading}>
            Parts
          </h2>
          <div data-testid="admin-exam-question-view-parts" style={{ display: "grid", gap: 16 }}>
            {data.parts.map((part) => (
              <PartCard key={part.label || part.questionText} part={part} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PartCard({ part }: { part: AdminExamQuestionPart }) {
  return (
    <div
      data-testid={`admin-exam-question-view-part-${part.label || "unknown"}`}
      style={{
        padding: "12px 14px",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        background: "#fff",
      }}
    >
      <p style={{ ...bodyText, fontWeight: 700, marginBottom: 8 }}>
        Part {part.label || "—"} · {part.type || "—"}
      </p>
      <p style={{ ...bodyText, fontWeight: 600 }}>{part.questionText || "—"}</p>
      <OptionsList options={part.options} />
      <p style={{ ...bodyText, marginTop: 10 }}>
        Marks: <strong>{part.marks == null ? "—" : part.marks}</strong>
      </p>
      <MarkScheme lines={part.markScheme} />
    </div>
  );
}

function OptionsList({
  options,
  testId,
}: {
  options: AdminExamQuestionOption[];
  testId?: string;
}) {
  if (!options.length) return null;
  return (
    <ul data-testid={testId} style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
      {options.map((opt) => (
        <li
          key={opt.index}
          data-testid={opt.isCorrect ? "admin-exam-question-view-correct-option" : "admin-exam-question-view-option"}
          style={{
            ...optionRow,
            borderColor: opt.isCorrect ? "#86efac" : "#e2e8f0",
            background: opt.isCorrect ? "#f0fdf4" : "#fff",
          }}
        >
          <span style={{ fontWeight: 600, marginRight: 8 }}>{String.fromCharCode(65 + opt.index)}.</span>
          <span style={{ wordBreak: "break-word" }}>{opt.text}</span>
          {opt.isCorrect ? (
            <span
              style={{
                marginLeft: 10,
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                color: "#166534",
                background: "#dcfce7",
                padding: "2px 8px",
                borderRadius: 999,
              }}
            >
              Correct answer
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function MarkScheme({ lines, testId }: { lines: string[]; testId?: string }) {
  return (
    <div data-testid={testId} style={{ ...bodyText, marginTop: 8 }}>
      <strong>Mark scheme</strong>
      {lines.length === 0 ? (
        <p style={{ margin: "6px 0 0" }}>—</p>
      ) : (
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {lines.map((line, i) => (
            <li key={i} style={{ wordBreak: "break-word" }}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetaItem({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div>
      <dt style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{label}</dt>
      <dd data-testid={testId} style={{ margin: "2px 0 0", fontSize: 14, color: "#0f172a", wordBreak: "break-word" }}>
        {value}
      </dd>
    </div>
  );
}

function formatTs(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const sectionHeading: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 18,
  color: "#0f172a",
};

const bodyText: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#334155",
  lineHeight: 1.55,
  wordBreak: "break-word",
};

const metaGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  margin: 0,
};

const optionRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 4,
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  marginBottom: 8,
  fontSize: 14,
  color: "#0f172a",
};
