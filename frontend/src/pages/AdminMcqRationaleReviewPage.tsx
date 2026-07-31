/**
 * Admin — MCQ Rationale Review (V2.3B1 + V2.3B2a Generate).
 * May create one Candidate record when enabled. Cannot reject, regenerate, approve or save rationales.
 * Generated candidates do not change the Exam Question.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  createMcqRationaleCandidate,
  createMcqRationaleCandidateIdempotencyKey,
  readMcqRationaleCandidateError,
} from "../api/mcqRationaleCandidates";
import {
  fetchMcqRationaleReviewContext,
  type McqRationaleReviewContext,
} from "../api/mcqRationaleReviewContext";

type IdempotencySlot = {
  questionId: string;
  partLabel: string;
  fingerprint: string;
  key: string;
  terminal: boolean;
};

function canGenerateReasonLabel(code: string): string {
  switch (code) {
    case "PUBLISHED_NOT_ENABLED":
      return "Published-question candidate generation is not enabled.";
    case "STATUS_NOT_ALLOWED":
      return "This question status is not eligible for candidate generation.";
    case "RATIONALE_SUBSTANTIVE":
      return "A substantive rationale already exists.";
    case "NOT_ELIGIBLE":
      return "This part is not eligible for candidate generation.";
    case "IMAGE_CONTEXT_REQUIRED":
      return "Trusted image context text is required before generation can be considered.";
    case "ACTIVE_CANDIDATE_EXISTS":
      return "An active candidate already exists for this part.";
    default:
      return code ? `Generation is not available (${code}).` : "";
  }
}

function generationActionMessage(code: string): string {
  switch (code) {
    case "FEATURE_DISABLED":
      return "Candidate generation is currently disabled.";
    case "PUBLISHED_NOT_ENABLED":
      return "Published-question candidate generation is not enabled.";
    case "STATUS_NOT_ALLOWED":
      return "This question status is not eligible for candidate generation.";
    case "IMAGE_CONTEXT_REQUIRED":
      return "Trusted image context is required before a candidate can be generated.";
    case "STALE_SOURCE_FINGERPRINT":
      return "The question source changed since this page was loaded. Review the updated source before generating again.";
    case "ACTIVE_CANDIDATE_EXISTS":
      return "An active candidate already exists for this part. Generation was not started again.";
    case "GENERATION_LEASE_EXPIRED":
    case "GENERATION_RESERVATION_LOST":
    case "DUPLICATE_RESERVATION":
      return "Generation could not complete because another reservation is active or the lease expired. Refresh and review the latest candidate status.";
    case "RATE_LIMITED":
      return "Too many generation requests. Please wait a minute and try again.";
    case "ACTOR_DAILY_CAP":
      return "Your daily candidate generation limit has been reached. Try again tomorrow.";
    case "GLOBAL_DAILY_CAP":
      return "The shared daily candidate generation limit has been reached. Try again tomorrow.";
    case "LLM_TIMEOUT":
      return "The generation provider timed out. You can retry when generation is available again.";
    case "LLM_ERROR":
    case "LLM_EMPTY":
    case "LLM_NOT_CONFIGURED":
      return "Candidate generation failed at the provider. You can retry when generation is available again.";
    case "LLM_BAD_JSON":
    case "VALIDATION_FAILED":
      return "The provider returned an unusable rationale. You can retry when generation is available again.";
    case "ACCESS_DENIED":
    case "UNAUTHORIZED":
      return "You do not have permission to generate a candidate.";
    case "NETWORK_UNCERTAIN":
      return "The request may not have completed. You can retry safely using the same attempt.";
    case "SERVER_ERROR":
    default:
      return "Candidate generation failed. Please try again later.";
  }
}

export default function AdminMcqRationaleReviewPage() {
  const navigate = useNavigate();
  const { questionId: rawQuestionId, partLabel: rawPartLabel } = useParams<{
    questionId: string;
    partLabel: string;
  }>();
  const { user } = useCurrentUser({ watchLocation: true });
  const [data, setData] = useState<McqRationaleReviewContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [replayedNote, setReplayedNote] = useState(false);

  const inFlightRef = useRef(false);
  const idemRef = useRef<IdempotencySlot | null>(null);
  const routeRef = useRef({ questionId: "", partLabel: "" });

  useEffect(() => {
    const isAdmin = user?.userType === "admin";
    const isCm = (user as { staffRole?: string } | null)?.staffRole === "content_manager";
    if (user && !isAdmin && !isCm) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const resolveRouteIds = useCallback(() => {
    const questionId = (rawQuestionId || "").trim();
    let partLabel = "";
    try {
      partLabel = decodeURIComponent(rawPartLabel || "").trim();
    } catch {
      partLabel = "";
    }
    return { questionId, partLabel };
  }, [rawQuestionId, rawPartLabel]);

  const refreshContext = useCallback(async (questionId: string, partLabel: string) => {
    const res = await fetchMcqRationaleReviewContext(questionId, partLabel);
    setData(res);
    return res;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setErrorCode(null);
      setData(null);
      setActionError(null);
      setActionCode(null);
      setReplayedNote(false);
      setGenerating(false);
      inFlightRef.current = false;
      idemRef.current = null;

      const { questionId, partLabel } = resolveRouteIds();
      routeRef.current = { questionId, partLabel };

      if (!questionId || !partLabel) {
        setError("This review link is missing a valid question or part label.");
        setErrorCode("MALFORMED_ROUTE");
        setLoading(false);
        return;
      }

      try {
        const res = await fetchMcqRationaleReviewContext(questionId, partLabel);
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
          setError("You do not have permission to review this MCQ rationale.");
          setErrorCode(code || "ACCESS_DENIED");
        } else if (status === 404) {
          setError(apiError || "Question or part was not found.");
          setErrorCode(code || "NOT_FOUND");
        } else {
          setError(apiError || ax.message || "Failed to load review context.");
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
  }, [resolveRouteIds]);

  useEffect(() => {
    if (!data) return;
    const cur = idemRef.current;
    if (
      cur &&
      (cur.questionId !== data.questionId ||
        cur.partLabel !== data.partLabel ||
        cur.fingerprint !== data.currentSourceFingerprint)
    ) {
      idemRef.current = null;
    }
  }, [data]);

  function acquireIdempotencyKey(ctx: McqRationaleReviewContext): string {
    const cur = idemRef.current;
    if (
      cur &&
      !cur.terminal &&
      cur.questionId === ctx.questionId &&
      cur.partLabel === ctx.partLabel &&
      cur.fingerprint === ctx.currentSourceFingerprint
    ) {
      return cur.key;
    }
    const key = createMcqRationaleCandidateIdempotencyKey();
    idemRef.current = {
      questionId: ctx.questionId,
      partLabel: ctx.partLabel,
      fingerprint: ctx.currentSourceFingerprint,
      key,
      terminal: false,
    };
    return key;
  }

  async function handleGenerate() {
    if (inFlightRef.current || generating || !data) return;
    if (!data.generationFeatureEnabled || !data.canGenerate || data.imageContextRequired) return;

    inFlightRef.current = true;
    setGenerating(true);
    setActionError(null);
    setActionCode(null);
    setReplayedNote(false);

    const idempotencyKey = acquireIdempotencyKey(data);
    const { questionId, partLabel } = routeRef.current;

    try {
      const result = await createMcqRationaleCandidate({
        questionId,
        partLabel,
        idempotencyKey,
        expectedSourceFingerprint: data.currentSourceFingerprint,
      });

      if (idemRef.current && idemRef.current.key === idempotencyKey) {
        idemRef.current.terminal = true;
      }

      setReplayedNote(Boolean(result.replayed));
      await refreshContext(questionId, partLabel);
    } catch (e: unknown) {
      const parsed = readMcqRationaleCandidateError(e);

      if (parsed.networkUncertain) {
        setActionCode(parsed.code);
        setActionError(generationActionMessage("NETWORK_UNCERTAIN"));
      } else {
        if (idemRef.current && idemRef.current.key === idempotencyKey) {
          idemRef.current.terminal = true;
        }
        setActionCode(parsed.code);
        setActionError(generationActionMessage(parsed.code));
        try {
          await refreshContext(questionId, partLabel);
        } catch {
          // Keep the action error; load errors are secondary.
        }
      }
    } finally {
      inFlightRef.current = false;
      setGenerating(false);
    }
  }

  return (
    <div data-testid="mcq-rationale-review-page" style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px 48px" }}>
      <div style={{ marginBottom: 8 }}>
        <Link
          to="/admin/exam-question-rationale-inventory"
          data-testid="mcq-rationale-review-back"
          style={{ color: "#2563eb", fontSize: 14, textDecoration: "none" }}
        >
          ← Back to MCQ Rationale Inventory
        </Link>
      </div>

      <h1 style={{ margin: "0 0 8px", fontSize: 26, color: "#0f172a" }}>MCQ Rationale Review</h1>

      <div
        data-testid="mcq-rationale-review-readonly-notice"
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
        <strong>Review workflow.</strong> Candidate generation is available only when enabled. This page cannot
        reject, regenerate, approve or save rationales.
        <div style={{ marginTop: 6 }}>Generated candidates do not change the Exam Question.</div>
      </div>

      {loading ? (
        <p data-testid="mcq-rationale-review-loading" style={{ color: "#64748b" }}>
          Loading review context…
        </p>
      ) : null}

      {!loading && error ? (
        <div
          data-testid="mcq-rationale-review-error"
          role="alert"
          tabIndex={-1}
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

      {!loading && data ? (
        <ReviewBody
          data={data}
          generating={generating}
          actionError={actionError}
          actionCode={actionCode}
          replayedNote={replayedNote}
          onGenerate={handleGenerate}
        />
      ) : null}
    </div>
  );
}

const SHARED_MEDIA_BLOCKED_MESSAGE =
  "This Composite Exam Question has shared media attached, but no trusted description is available. Candidate generation remains blocked.";
const SHARED_MEDIA_TRUSTED_MESSAGE = "Trusted context is available for the shared media.";
const LEGACY_IMAGE_CONTEXT_MESSAGE =
  "Trusted image context text is required before generation can be considered.";

function ReviewBody({
  data,
  generating,
  actionError,
  actionCode,
  replayedNote,
  onGenerate,
}: {
  data: McqRationaleReviewContext;
  generating: boolean;
  actionError: string | null;
  actionCode: string | null;
  replayedNote: boolean;
  onGenerate: () => void;
}) {
  const tax = data.taxonomy;
  const candidate = data.latestCandidate;
  const showGenerate =
    data.generationFeatureEnabled === true &&
    data.canGenerate === true &&
    data.imageContextRequired !== true;

  // New wording only for a complete, internally consistent blocked shared-media diagnostic.
  const showSharedMediaBlocked =
    Boolean(data.imageContextRequired) &&
    data.mediaContext?.referencePresent === true &&
    data.mediaContext?.scope === "question_shared" &&
    data.mediaContext?.trustedContextAvailable !== true;
  const showSharedMediaTrusted =
    data.mediaContext?.referencePresent === true &&
    data.mediaContext?.scope === "question_shared" &&
    data.mediaContext?.trustedContextAvailable === true &&
    data.imageContextRequired !== true;
  // Whenever image context is required, always show exactly one explanation.
  // Malformed/inconsistent mediaContext must fall back to the legacy warning.
  const showLegacyImageWarning = Boolean(data.imageContextRequired) && !showSharedMediaBlocked;

  return (
    <div data-testid="mcq-rationale-review-body" style={{ display: "grid", gap: 18 }}>
      <section aria-labelledby="review-source-meta-heading">
        <h2 id="review-source-meta-heading" style={sectionHeading}>
          Source metadata
        </h2>
        <dl style={metaGrid}>
          <MetaItem label="Subject" value={tax.subject || "—"} />
          <MetaItem label="Exam board" value={tax.examBoard || "—"} />
          <MetaItem label="Level / tier" value={[tax.level, tax.tier].filter(Boolean).join(" · ") || "—"} />
          <MetaItem label="Topic" value={tax.topic || tax.topicKey || "—"} />
          <MetaItem label="Status" value={data.questionStatus || "—"} />
          <MetaItem label="Part" value={data.partLabel} />
        </dl>
      </section>

      <section aria-labelledby="review-question-heading">
        <h2 id="review-question-heading" style={sectionHeading}>
          Question
        </h2>
        {data.sharedStem ? (
          <p data-testid="mcq-rationale-review-shared-stem" style={bodyText}>
            <strong>Shared stem:</strong> {data.sharedStem}
          </p>
        ) : null}
        <p data-testid="mcq-rationale-review-question-text" style={{ ...bodyText, fontWeight: 600 }}>
          ({data.partLabel}) {data.questionText}
        </p>
        <ul data-testid="mcq-rationale-review-options" style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {data.options.map((opt) => (
            <li
              key={opt.index}
              data-testid={opt.isCorrect ? "mcq-rationale-review-correct-option" : "mcq-rationale-review-option"}
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
                  data-testid="mcq-rationale-review-correct-badge"
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
        <p style={{ ...bodyText, marginTop: 12 }}>
          Marks: <strong>{data.marks == null ? "—" : data.marks}</strong>
        </p>
        <div data-testid="mcq-rationale-review-mark-scheme" style={{ ...bodyText, marginTop: 8 }}>
          <strong>Mark scheme</strong>
          {data.markScheme.length === 0 ? (
            <p style={{ margin: "6px 0 0" }}>—</p>
          ) : (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {data.markScheme.map((line, i) => (
                <li key={i} style={{ wordBreak: "break-word" }}>
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="review-current-rationale-heading">
        <h2 id="review-current-rationale-heading" style={sectionHeading}>
          Current rationale
        </h2>
        <p style={bodyText}>
          Bucket:{" "}
          <span data-testid="mcq-rationale-review-bucket" style={badge}>
            {data.rationaleBucket}
          </span>
        </p>
        <p data-testid="mcq-rationale-review-current-rationale" style={{ ...bodyText, whiteSpace: "pre-wrap" }}>
          {data.currentRationale && String(data.currentRationale).trim()
            ? data.currentRationale
            : "No rationale currently stored"}
        </p>
      </section>

      <section aria-labelledby="review-candidate-heading">
        <h2 id="review-candidate-heading" style={sectionHeading}>
          Latest candidate
        </h2>
        {!candidate ? (
          <p data-testid="mcq-rationale-review-candidate-empty" style={bodyText}>
            No candidate has been generated for this part.
          </p>
        ) : (
          <div data-testid="mcq-rationale-review-candidate" style={{ display: "grid", gap: 8 }}>
            <p style={bodyText}>
              Status:{" "}
              <span data-testid="mcq-rationale-review-candidate-status" style={badge}>
                {candidate.status}
              </span>{" "}
              · Attempt {candidate.attemptNumber}
            </p>
            {data.candidateIsStale ? (
              <div
                data-testid="mcq-rationale-review-stale-warning"
                role="status"
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #fcd34d",
                  background: "#fffbeb",
                  color: "#92400e",
                  fontSize: 13,
                }}
              >
                This candidate is stale: the Question Bank source fingerprint has changed since it was generated.
              </div>
            ) : null}
            {replayedNote ? (
              <p data-testid="mcq-rationale-review-replayed" style={{ ...bodyText, color: "#475569", fontSize: 13 }}>
                Showing the existing candidate for this attempt (idempotent replay).
              </p>
            ) : null}
            <p data-testid="mcq-rationale-review-candidate-explanation" style={{ ...bodyText, whiteSpace: "pre-wrap" }}>
              {candidate.explanation?.trim() ? candidate.explanation : "—"}
            </p>
            <p style={{ ...bodyText, fontSize: 12, color: "#64748b" }}>
              Generated {formatTs(candidate.generatedAt)} · Completed {formatTs(candidate.completedAt)}
            </p>
            {candidate.failureCode ? (
              <p data-testid="mcq-rationale-review-failure-code" style={{ ...bodyText, color: "#b91c1c" }}>
                Failure code: {candidate.failureCode}
              </p>
            ) : null}
            {candidate.validationIssueCodes?.length ? (
              <p data-testid="mcq-rationale-review-validation-codes" style={{ ...bodyText, color: "#b91c1c" }}>
                Validation: {candidate.validationIssueCodes.join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="review-generation-status-heading">
        <h2 id="review-generation-status-heading" style={sectionHeading}>
          Generation status
        </h2>
        {!data.generationFeatureEnabled ? (
          <p data-testid="mcq-rationale-review-feature-disabled" style={noticeBox}>
            Candidate generation is currently disabled.
          </p>
        ) : null}
        {data.canGenerateReason === "PUBLISHED_NOT_ENABLED" ? (
          <p data-testid="mcq-rationale-review-published-disabled" style={noticeBox}>
            Published-question candidate generation is not enabled.
          </p>
        ) : null}
        {showSharedMediaBlocked ? (
          <p data-testid="mcq-rationale-review-shared-media-warning" style={noticeBox}>
            {SHARED_MEDIA_BLOCKED_MESSAGE}
          </p>
        ) : null}
        {showSharedMediaTrusted ? (
          <p data-testid="mcq-rationale-review-shared-media-trusted" style={noticeBox}>
            {SHARED_MEDIA_TRUSTED_MESSAGE}
          </p>
        ) : null}
        {showLegacyImageWarning ? (
          <p data-testid="mcq-rationale-review-image-context-warning" style={noticeBox}>
            {LEGACY_IMAGE_CONTEXT_MESSAGE}
          </p>
        ) : null}
        {data.canGenerateReason &&
        data.canGenerateReason !== "PUBLISHED_NOT_ENABLED" &&
        data.canGenerateReason !== "IMAGE_CONTEXT_REQUIRED" ? (
          <p data-testid="mcq-rationale-review-can-generate-reason" style={{ ...bodyText, color: "#475569" }}>
            {canGenerateReasonLabel(data.canGenerateReason)}
          </p>
        ) : null}

        {actionError ? (
          <div
            data-testid="mcq-rationale-review-generate-error"
            role="alert"
            style={{
              ...noticeBox,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            <div>{actionError}</div>
            {actionCode ? (
              <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c" }}>Code: {actionCode}</div>
            ) : null}
          </div>
        ) : null}

        {showGenerate ? (
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              data-testid="mcq-rationale-review-generate"
              onClick={onGenerate}
              disabled={generating}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid #1d4ed8",
                background: generating ? "#93c5fd" : "#2563eb",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: generating ? "not-allowed" : "pointer",
              }}
            >
              {generating ? "Generating candidate…" : "Generate candidate"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>{label}</dt>
      <dd style={{ margin: "2px 0 0", fontSize: 14, color: "#0f172a", wordBreak: "break-word" }}>{value}</dd>
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

const badge: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  padding: "3px 8px",
  borderRadius: 999,
  color: "#1e40af",
  background: "#dbeafe",
};

const noticeBox: React.CSSProperties = {
  margin: "0 0 8px",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
};
