/**
 * Topic Command Center — unified operational view for a single topic.
 * Route: /admin/topic/:specKey/:topicKey
 */
import React, { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  fetchTopicCommandCenter,
  runTopicAutopilot,
  fetchAutopilotPromptPacks,
  type TopicCommandCenter,
} from "../api/contentGraph";

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "strong" || status === "allow"
      ? { background: "#d4edda", color: "#155724" }
      : status === "partial" || status === "limited"
      ? { background: "#fff3cd", color: "#856404" }
      : status === "weak" || status === "block" || status === "review_required"
      ? { background: "#f8d7da", color: "#721c24" }
      : { background: "#e2e8f0", color: "#64748b" };
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        ...style,
      }}
    >
      {status}
    </span>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: "1rem",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        marginBottom: "1rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 600 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ActionButton({
  action,
  label,
  reason,
  specKey,
  topicKey,
  onRunAutopilot,
  autopilotRunning,
}: {
  action: string;
  label: string;
  reason: string;
  specKey: string;
  topicKey: string;
  onRunAutopilot?: () => void;
  autopilotRunning?: boolean;
}) {
  const navigate = useNavigate();
  const tk = encodeURIComponent(topicKey);
  const sk = encodeURIComponent(specKey);

  const handleClick = () => {
    switch (action) {
      case "run_autopilot":
        onRunAutopilot?.();
        break;
      case "generate_flashcards":
        navigate(`/teacher/topic-banks/flashcards?specKey=${sk}&topicKey=${tk}`);
        break;
      case "generate_quiz":
        navigate(`/teacher/topic-banks/quizzes?specKey=${sk}&topicKey=${tk}`);
        break;
      case "create_lesson":
        navigate("/create-lesson", { state: { specKey, topicKey } });
        break;
      case "inspect_rejections":
        navigate("/admin/autopilot-approval");
        break;
      case "review_content":
      case "resolve_open_issues":
        navigate("/admin/content-issues");
        break;
      case "fix_taxonomy_mapping":
        navigate("/admin/taxonomy");
        break;
      case "open_evidence_review":
        navigate("/admin/content-coverage", { state: { viewMode: "review" } });
        break;
      case "revise_explanation":
        navigate("/admin/content-coverage");
        break;
      case "generate_exam_questions":
        navigate(`/admin/question-banks?tab=exam-questions&topicKey=${tk}`);
        break;
      default:
        navigate("/admin/content-coverage");
    }
  };

  const disabled = action === "run_autopilot" && autopilotRunning;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={reason}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        background: disabled ? "#e2e8f0" : "#e0f2fe",
        color: disabled ? "#94a3b8" : "#0369a1",
        border: "1px solid #bae6fd",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      {label}
    </button>
  );
}

const TopicCommandCenterPage: React.FC = () => {
  const { specKey, topicKey } = useParams<{ specKey: string; topicKey: string }>();
  const [data, setData] = useState<TopicCommandCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [promptPacks, setPromptPacks] = useState<Array<{ promptPackId: string; promptPackVersion: string; label?: string }>>([]);
  const [selectedPack, setSelectedPack] = useState<{ promptPackId: string; promptPackVersion: string } | null>(null);

  useEffect(() => {
    if (!specKey || !topicKey) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchTopicCommandCenter(specKey, topicKey)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [specKey, topicKey]);

  useEffect(() => {
    fetchAutopilotPromptPacks()
      .then((res) => {
        const packs = res.promptPacks || [];
        setPromptPacks(packs);
        const def = packs.find((p) => p.isDefault) || packs[0];
        if (def) setSelectedPack({ promptPackId: def.promptPackId, promptPackVersion: def.promptPackVersion });
      })
      .catch(() => {});
  }, []);

  const handleRunAutopilot = async () => {
    if (!specKey || !topicKey) return;
    setAutopilotRunning(true);
    try {
      await runTopicAutopilot({
        specKey,
        topicKey,
        dryRun: false,
        ...(selectedPack && {
          promptPackId: selectedPack.promptPackId,
          promptPackVersion: selectedPack.promptPackVersion,
        }),
      });
      const res = await fetchTopicCommandCenter(specKey, topicKey);
      setData(res);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Autopilot failed");
    } finally {
      setAutopilotRunning(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
        <p>Loading topic command center…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
        <Link to="/admin/content-coverage" style={{ color: "#0369a1", textDecoration: "none", marginBottom: "1rem", display: "inline-block" }}>
          ← Back to Content Coverage
        </Link>
        <p style={{ color: "#b91c1c" }}>{error || "Topic not found"}</p>
      </div>
    );
  }

  const tax = data.taxonomy;
  const taxPath = [tax.subject, tax.spec, tax.mainTopic, tax.topic].filter(Boolean).join(" › ");

  return (
    <div style={{ padding: "1.5rem", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Link
          to="/admin/content-coverage"
          style={{
            padding: "0.5rem 1rem",
            background: "#f1f5f9",
            color: "#475569",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          ← Back to Content Coverage
        </Link>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Topic Command Center</h1>
      </div>

      {/* 1. Topic Overview */}
      <SectionCard title="Topic Overview">
        <div style={{ marginBottom: 8 }}>
          <strong>{data.topicTitle}</strong>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{taxPath || data.topicKey}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <span>Coverage: <strong>{data.coverage.coverageScore}</strong></span>
          <span>Mastery: {data.learningEvidence.masteryScore != null ? `${data.learningEvidence.masteryScore}%` : "—"}</span>
          <StatusBadge status={data.evidenceHealth.evidenceHealth} />
          <span style={{ fontWeight: 600, color: (data.safeMode?.enabled ?? data.safeMode) ? "#15803d" : "#64748b" }}>
            Autopilot Safe Mode: {(data.safeMode?.enabled ?? data.safeMode) ? "Enabled" : "Disabled"}
          </span>
        </div>
      </SectionCard>

      {/* 2. Curriculum */}
      <SectionCard title="Curriculum">
        <div style={{ marginBottom: 8 }}>Spec statements: {data.curriculum.specStatementsCount}</div>
        {data.curriculum.specStatements.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: 13, color: "#475569" }}>
            {data.curriculum.specStatements.slice(0, 10).map((s, i) => (
              <li key={i}>{s.statementCode}: {s.statementText?.slice(0, 80)}{s.statementText && s.statementText.length > 80 ? "…" : ""}</li>
            ))}
            {data.curriculum.specStatements.length > 10 && (
              <li style={{ color: "#94a3b8" }}>+{data.curriculum.specStatements.length - 10} more</li>
            )}
          </ul>
        )}
      </SectionCard>

      {/* 2b. Draft Library */}
      {data.draftLibrary && (data.draftLibrary.flashcards > 0 || data.draftLibrary.examQuestions > 0) && (
        <SectionCard title="Draft Library">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <span>Draft flashcards: <strong>{data.draftLibrary.flashcards}</strong></span>
            <span>Draft exam questions: <strong>{data.draftLibrary.examQuestions}</strong></span>
            {data.draftLibrary.lastGeneratedAt && (
              <span style={{ fontSize: 13, color: "#64748b" }}>
                Last generated: {new Date(data.draftLibrary.lastGeneratedAt).toLocaleDateString()}
              </span>
            )}
            <Link
              to="/admin/autopilot-approval"
              style={{ fontSize: 13, color: "#0369a1", textDecoration: "none" }}
            >
              Review in Autopilot Approval →
            </Link>
          </div>
        </SectionCard>
      )}

      {/* 3. Content Coverage */}
      <SectionCard title="Content Coverage">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, fontSize: 14 }}>
          <div>Lessons: <strong>{data.coverage.lessons}</strong></div>
          <div>Flashcards: <strong>{data.coverage.flashcards}</strong></div>
          <div>Quizzes: <strong>{data.coverage.quizzes}</strong></div>
          <div>Exam questions: <strong>{data.coverage.examQuestions}</strong></div>
        </div>
      </SectionCard>

      {/* 4. Gap Analysis */}
      <SectionCard title="Gap Analysis">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>Priority score: <strong>{data.gapAnalysis.priorityScore}</strong></span>
          <StatusBadge status={data.gapAnalysis.gapStatus} />
        </div>
      </SectionCard>

      {/* 5. Autopilot Safe Mode */}
      <SectionCard title="Autopilot Safe Mode">
        {(() => {
          const sm = data.safeMode;
          const enabled = sm?.enabled ?? (typeof sm === "boolean" ? sm : false);
          const sample = sm?.evidenceSample ?? { autopilotRuns: 0, reviewedItems: 0, quizAttempts: 0 };
          const thresh = sm?.thresholds ?? { autopilotRuns: 3, reviewedItems: 10, quizAttempts: 20 };
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Status:</span>
                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 14,
                    background: enabled ? "#dcfce7" : "#f1f5f9",
                    color: enabled ? "#15803d" : "#64748b",
                  }}
                >
                  {enabled ? "Enabled" : "Disabled"}
                </span>
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  {enabled
                    ? "Generated content will be auto-published when autopilot runs."
                    : "Generated content will be saved as draft for review."}
                </span>
              </div>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Evidence Sample</div>
              <ul style={{ margin: "0 0 8px 0", paddingLeft: "1.25rem", fontSize: 13, color: "#475569" }}>
                <li>Autopilot runs: {sample.autopilotRuns ?? 0} / {thresh.autopilotRuns ?? 3}</li>
                <li>Reviewed items: {sample.reviewedItems ?? 0} / {thresh.reviewedItems ?? 10}</li>
                <li>Quiz attempts: {sample.quizAttempts ?? 0} / {thresh.quizAttempts ?? 20}</li>
              </ul>
              {!enabled &&
                ((sample.autopilotRuns ?? 0) < (thresh.autopilotRuns ?? 3) ||
                  (sample.reviewedItems ?? 0) < (thresh.reviewedItems ?? 10) ||
                  (sample.quizAttempts ?? 0) < (thresh.quizAttempts ?? 20)) && (
                <div style={{ fontSize: 13, color: "#b91c1c", marginTop: 8 }}>
                  Safe Mode disabled — insufficient evidence sample size.
                </div>
              )}
            </>
          );
        })()}
      </SectionCard>

      {/* 6. Autopilot */}
      <SectionCard title="Autopilot">
        <div style={{ marginBottom: 8 }}>
          Runs: <strong>{data.autopilot.runs}</strong>
          {data.autopilot.lastRunDate && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "#64748b" }}>
              Last run: {new Date(data.autopilot.lastRunDate).toLocaleDateString()}
            </span>
          )}
        </div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>
          Generated: {data.autopilot.generatedFlashcards} flashcards, {data.autopilot.generatedQuizzes} quizzes, {data.autopilot.generatedExamQuestions} exam questions
        </div>
        {data.autopilot.avgCoverageLift != null && (
          <div style={{ fontSize: 13 }}>Avg coverage lift: {data.autopilot.avgCoverageLift}</div>
        )}
      </SectionCard>

      {/* 7. Prompt Pack Performance */}
      {data.promptPackPerformance.length > 0 && (
        <SectionCard title="Prompt Pack Performance">
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "6px 8px" }}>Pack</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Approval</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Runs</th>
                <th style={{ textAlign: "right", padding: "6px 8px" }}>Coverage lift</th>
              </tr>
            </thead>
            <tbody>
              {data.promptPackPerformance.map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 8px" }}>{p.promptPackId} {p.promptPackVersion}</td>
                  <td style={{ textAlign: "right", padding: "6px 8px" }}>{p.approvalRate != null ? `${p.approvalRate}%` : "—"}</td>
                  <td style={{ textAlign: "right", padding: "6px 8px" }}>{p.runs}</td>
                  <td style={{ textAlign: "right", padding: "6px 8px" }}>{p.avgCoverageLift != null ? p.avgCoverageLift : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      )}

      {/* 8. Evidence Health */}
      <SectionCard title="Evidence Health">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <StatusBadge status={data.evidenceHealth.evidenceHealth} />
          <span>Open issues: {data.evidenceHealth.openIssues}</span>
          <span>Teacher revisions: {data.evidenceHealth.teacherRevisions}</span>
          <span>Approval rate: {data.evidenceHealth.approvalRate != null ? `${data.evidenceHealth.approvalRate}%` : "—"}</span>
        </div>
      </SectionCard>

      {/* 8. Student Learning */}
      <SectionCard title="Student Learning">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <span>Mastery: {data.learningEvidence.masteryScore != null ? `${data.learningEvidence.masteryScore}%` : "—"}</span>
          <span>Difficulty: {data.learningEvidence.difficultyLevel}</span>
          <span>Quiz accuracy: {data.learningEvidence.quizAccuracy != null ? `${data.learningEvidence.quizAccuracy}%` : "—"}</span>
          <span>Exam accuracy: {data.learningEvidence.examAccuracy != null ? `${data.learningEvidence.examAccuracy}%` : "—"}</span>
          <span>Flashcard difficulty: {data.learningEvidence.flashcardDifficulty ?? "—"}</span>
          <span>Lesson completions: {data.learningEvidence.lessonCompletions}</span>
        </div>
      </SectionCard>

      {/* 10. Recommended Actions */}
      <SectionCard title="Recommended Actions">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {data.recommendedActions.map((a, i) => (
            <ActionButton
              key={i}
              action={a.action}
              label={a.label}
              reason={a.reason}
              specKey={data.specKey}
              topicKey={data.topicKey}
              onRunAutopilot={a.action === "run_autopilot" ? handleRunAutopilot : undefined}
              autopilotRunning={autopilotRunning}
            />
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {promptPacks.length > 0 && (
            <select
              value={selectedPack ? `${selectedPack.promptPackId}:${selectedPack.promptPackVersion}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  const [id, ver] = v.split(":");
                  setSelectedPack({ promptPackId: id, promptPackVersion: ver });
                }
              }}
              style={{ padding: "6px 10px", fontSize: 13, border: "1px solid #cbd5e1", borderRadius: 6 }}
            >
              {promptPacks.map((p) => (
                <option key={`${p.promptPackId}:${p.promptPackVersion}`} value={`${p.promptPackId}:${p.promptPackVersion}`}>
                  {p.label || `${p.promptPackId} ${p.promptPackVersion}`}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={handleRunAutopilot}
            disabled={autopilotRunning || !data.readiness.ready}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: autopilotRunning || !data.readiness.ready ? "#e2e8f0" : "#dcfce7",
              color: autopilotRunning || !data.readiness.ready ? "#94a3b8" : "#15803d",
              border: "1px solid #bbf7d0",
              borderRadius: 6,
              cursor: autopilotRunning || !data.readiness.ready ? "not-allowed" : "pointer",
            }}
          >
            {autopilotRunning ? "Running…" : "Run Autopilot"}
          </button>
          <Link
            to={`/teacher/topic-banks/flashcards?specKey=${encodeURIComponent(data.specKey)}&topicKey=${encodeURIComponent(data.topicKey)}`}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "#e0f2fe",
              color: "#0369a1",
              border: "1px solid #bae6fd",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Generate Flashcards
          </Link>
          <Link
            to="/admin/autopilot-approval"
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Inspect Rejections
          </Link>
          <Link
            to="/admin/content-issues"
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "#fef3c7",
              color: "#92400e",
              border: "1px solid #fde68a",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Review Content
          </Link>
          <Link
            to="/admin/taxonomy"
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Fix Taxonomy
          </Link>
          <Link
            to="/admin/content-coverage"
            state={{ viewMode: "review" }}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Open Evidence Review
          </Link>
        </div>
      </SectionCard>
    </div>
  );
};

export default TopicCommandCenterPage;
