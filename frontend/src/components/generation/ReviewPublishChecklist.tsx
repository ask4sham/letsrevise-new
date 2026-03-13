/**
 * PR-014.1a / PR-014.1b: Review & fix issues checklist for generated content.
 * Check only until blocks === 0, then "Publish all" appears. Fix links open in new tab.
 */
import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  getPublishGateCheck,
  postPublishGatePublish,
  type PublishGateIssue,
  type PublishGateCheckResponse,
} from "../../api/generation";

type Props = {
  jobId: string;
  topicKey: string;
  specKey?: string;
};

function IssueRow({ issue }: { issue: PublishGateIssue }) {
  const fixUrl = issue.fixLink || issue.fixPath || "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        background: issue.level === "block" ? "#fee2e2" : "#fef3c7",
        borderRadius: 8,
        marginBottom: 8,
        fontSize: 13,
      }}
    >
      <span style={{ flex: 1 }}>
        <span
          style={{
            display: "inline-block",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            marginRight: 8,
            background: issue.level === "block" ? "#b91c1c" : "#d97706",
            color: "white",
          }}
        >
          {issue.level.toUpperCase()}
        </span>
        {issue.message}
      </span>
      {fixUrl && (
        <a
          href={fixUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: 12,
            padding: "4px 12px",
            background: "#374151",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 12,
            textDecoration: "none",
          }}
        >
          Fix
        </a>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  lesson: "Lesson",
  flashcard: "Flashcards",
  quiz: "Quiz",
  exam: "Exam",
};

export const ReviewPublishChecklist: React.FC<Props> = ({ jobId, topicKey, specKey }) => {
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishGateCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<{
    lessonId: string | null;
    topicKey: string;
    published: { lesson: boolean; flashcards: number; quiz: number; exam: number };
  } | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setPublishSuccess(null);
    try {
      const res = await getPublishGateCheck({ jobId });
      setResult(res);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
          (e as Error)?.message ??
          "Check failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const publishAll = async () => {
    if (!result?.ok || result.blocks > 0) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await postPublishGatePublish({ jobId });
      setPublishSuccess({
        lessonId: res.lessonId ?? null,
        topicKey: res.topicKey ?? topicKey,
        published: res.published,
      });
    } catch (e: unknown) {
      const err = (e as { response?: { data?: { message?: string; issues?: PublishGateIssue[] } }; message?: string });
      setError(err?.response?.data?.message ?? (e as Error)?.message ?? "Publish failed");
      if (err?.response?.data?.issues?.length) {
        setResult((prev) => ({
          ...(prev ?? { ok: false, blocks: 0, warns: 0, issues: [], summaryByType: {} }),
          issues: err.response!.data!.issues!,
          blocks: err.response!.data!.issues!.filter((i) => i.level === "block").length,
        }));
      }
    } finally {
      setPublishing(false);
    }
  };

  const blockIssues = result?.issues?.filter((i) => i.level === "block") ?? [];
  const warnIssues = result?.issues?.filter((i) => i.level === "warn") ?? [];
  const byType = (type: string) => (result?.issues?.filter((i) => i.type === type) ?? []);

  return (
    <div
      style={{
        padding: 16,
        background: "#f9fafb",
        borderRadius: 12,
        border: "1px solid #e5e7eb",
      }}
    >
      <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
        Review & fix issues
      </h3>
      {publishSuccess ? (
        <div
          style={{
            padding: 16,
            background: "#d1fae5",
            borderRadius: 8,
            border: "1px solid #10b981",
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 16, color: "#065f46", marginBottom: 12 }}>
            ✅ Published successfully
          </div>
          <div style={{ fontSize: 13, color: "#047857", marginBottom: 12 }}>
            Lesson: {publishSuccess.published.lesson ? "Yes" : "No"} • Flashcards: {publishSuccess.published.flashcards} • Quiz: {publishSuccess.published.quiz} • Exam: {publishSuccess.published.exam}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {publishSuccess.lessonId && (
              <Link
                to={`/lessons/${publishSuccess.lessonId}`}
                style={{
                  padding: "8px 16px",
                  background: "#059669",
                  color: "white",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                View lesson as student
              </Link>
            )}
            <Link
              to="/coverage"
              style={{
                padding: "8px 16px",
                background: "#374151",
                color: "white",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                textDecoration: "none",
              }}
            >
              Back to coverage
            </Link>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={runCheck}
            disabled={loading}
            style={{
              padding: "8px 16px",
              background: "#6366f1",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 13,
              cursor: loading ? "wait" : "pointer",
              marginBottom: 12,
              marginRight: result?.ok && result?.blocks === 0 ? 8 : 0,
            }}
          >
            {loading ? "Checking…" : "Run publish check"}
          </button>
          {result?.ok && result.blocks === 0 && (
            <button
              type="button"
              onClick={publishAll}
              disabled={publishing}
              style={{
                padding: "8px 16px",
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: publishing ? "wait" : "pointer",
                marginBottom: 12,
              }}
            >
              {publishing ? "Publishing…" : "Publish all"}
            </button>
          )}
        </>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            background: "#fee2e2",
            color: "#b91c1c",
            borderRadius: 8,
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {!publishSuccess && result && (
        <>
          {/* Counts summary at top */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 12,
              fontSize: 12,
              color: "#6b7280",
            }}
          >
            <span>Blocks: {result.blocks}</span>
            <span>Warnings: {result.warns}</span>
            {result.summaryByType &&
              Object.entries(result.summaryByType).map(([type, s]) =>
                (s.blocks + s.warns) > 0 ? (
                  <span key={type}>
                    {TYPE_LABELS[type] ?? type}: {s.blocks}B / {s.warns}W
                  </span>
                ) : null
              )}
          </div>

          {/* Large status banner */}
          <div
            style={{
              padding: 14,
              marginBottom: 16,
              background: result.ok ? "#d1fae5" : "#fee2e2",
              color: result.ok ? "#065f46" : "#b91c1c",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 16,
              textAlign: "center",
            }}
          >
            {result.ok ? "✅ Ready to publish" : "❌ Fix issues first"}
            {result.blocks > 0 && !result.ok && ` (${result.blocks} blocking)`}
            {result.warns > 0 && result.ok && ` • ${result.warns} warning(s)`}
          </div>

          {/* Sections by type: Lesson / Flashcards / Quiz / Exam */}
          {(["lesson", "flashcard", "quiz", "exam"] as const).map((type) => {
            const typeIssues = byType(type);
            if (typeIssues.length === 0) return null;
            return (
              <div key={type} style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {TYPE_LABELS[type] ?? type}
                </h4>
                {typeIssues.map((issue, i) => (
                  <IssueRow key={`${issue.entityId}-${i}`} issue={issue} />
                ))}
              </div>
            );
          })}

          {/* Fallback: show blocking then warnings if not grouped above */}
          {blockIssues.length > 0 && !result.summaryByType && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "#374151" }}>
                Blocking issues
              </h4>
              {blockIssues.map((issue, i) => (
                <IssueRow key={`${issue.entityId}-${i}`} issue={issue} />
              ))}
            </div>
          )}
          {warnIssues.length > 0 && !result.summaryByType && (
            <div style={{ marginBottom: 12 }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 12, fontWeight: 600, color: "#92400e" }}>
                Warnings
              </h4>
              {warnIssues.map((issue, i) => (
                <IssueRow key={`w-${issue.entityId}-${i}`} issue={issue} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
