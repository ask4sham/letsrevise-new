/**
 * PR-013: Coverage topic detail drawer — spec coverage, lessons, weak questions, quick actions.
 * PR-014: Generate starter pack (draft) action.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCoverageDrilldown, type CoverageDrilldownResponse } from "../../api/coverageDrilldown";
import { getSprintOrderMarkdown } from "../../api/sprintOrder";
import {
  postGenerateStarterPack,
  postGenerateWeakEvidenceFix,
  postGeneratePracticeSet,
  type StarterPackResponse,
  type WeakEvidenceFixResponse,
  type PracticeSetResponse,
} from "../../api/generation";
import { getTeacherNotes, type TeacherNoteItem } from "../../api/teacherNotes";
import {
  postTopicSummary,
  getTopicSummaryLogs,
  getTopicSummaryLogById,
  postTopicSummaryToLesson,
  type TopicSummaryMode,
  type TopicSummaryResponse,
  type TopicSummaryLogItem,
  type TopicSummaryLogsResponse,
} from "../../api/topicSummary";
import { postTopicSummaryPdf } from "../../api/topicSummaryExport";
import { CitationsList } from "../ai/CitationsList";
import { ReviewPublishChecklist } from "../generation/ReviewPublishChecklist";
import type { CoverageRow } from "../../api/coverage";
import type { SpecKey } from "../../api/taxonomy";

type Props = {
  open: boolean;
  onClose: () => void;
  specKey: SpecKey | string;
  topicKey: string;
  windowDays: number;
  row?: CoverageRow | null;
  onAskAi?: (question: string) => void;
  /** PR-032: When true, auto-open the practice set modal when drawer opens. */
  initialOpenPracticeSet?: boolean;
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? "#059669" : pct >= 40 ? "#2563eb" : "#dc2626";
  return (
    <div style={{ width: 80, height: 10, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
    </div>
  );
}

export const CoverageTopicDrawer: React.FC<Props> = ({
  open,
  onClose,
  specKey,
  topicKey,
  windowDays,
  row,
  onAskAi,
  initialOpenPracticeSet = false,
}) => {
  const [data, setData] = useState<CoverageDrilldownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState<StarterPackResponse | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [showGenConfirm, setShowGenConfirm] = useState(false);
  const [teacherNotes, setTeacherNotes] = useState<TeacherNoteItem[]>([]);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryMode, setSummaryMode] = useState<TopicSummaryMode>("overview");
  const [summaryMaxSources, setSummaryMaxSources] = useState(14);
  const [summaryAllowExternal, setSummaryAllowExternal] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryResult, setSummaryResult] = useState<TopicSummaryResponse | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfIncludeEvidence, setPdfIncludeEvidence] = useState(true);
  const [pdfIncludeNextSteps, setPdfIncludeNextSteps] = useState(true);
  const [pdfIncludeMiniRevision, setPdfIncludeMiniRevision] = useState(false);
  const [recentLogs, setRecentLogs] = useState<TopicSummaryLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPagination, setLogsPagination] = useState<TopicSummaryLogsResponse["pagination"] | null>(null);
  const [logsLoadingMore, setLogsLoadingMore] = useState(false);
  const [openLogLoading, setOpenLogLoading] = useState(false);
  const [showToLessonConfirm, setShowToLessonConfirm] = useState(false);
  const [toLessonLoading, setToLessonLoading] = useState(false);
  const [toLessonResult, setToLessonResult] = useState<{ lessonId: string; lessonUrlEdit: string; lessonUrlView: string } | null>(null);
  const [weakFixLoading, setWeakFixLoading] = useState(false);
  const [weakFixResult, setWeakFixResult] = useState<WeakEvidenceFixResponse | null>(null);
  const [weakFixError, setWeakFixError] = useState<string | null>(null);
  const [showWeakFixModal, setShowWeakFixModal] = useState(false);
  const [weakFixStatementCodes, setWeakFixStatementCodes] = useState<Set<string>>(new Set());
  const [weakFixQuestionIndices, setWeakFixQuestionIndices] = useState<Set<number>>(new Set());
  const [weakFixAllowExternal, setWeakFixAllowExternal] = useState(false);
  const [weakFixWindowDays, setWeakFixWindowDays] = useState(14);
  const [practiceSetLoading, setPracticeSetLoading] = useState(false);
  const [practiceSetResult, setPracticeSetResult] = useState<PracticeSetResponse | null>(null);
  const [practiceSetError, setPracticeSetError] = useState<string | null>(null);
  const [showPracticeSetModal, setShowPracticeSetModal] = useState(false);
  const [practiceSetPreset, setPracticeSetPreset] = useState<"standard" | "exam-heavy" | "flashcards-heavy">("standard");
  const [practiceSetAllowExternal, setPracticeSetAllowExternal] = useState(false);

  // PR-032: Auto-open practice set modal when drawer opens with initialOpenPracticeSet
  useEffect(() => {
    if (open && initialOpenPracticeSet) {
      setShowPracticeSetModal(true);
    }
  }, [open, initialOpenPracticeSet]);

  useEffect(() => {
    if (!open || !topicKey?.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCoverageDrilldown({ specKey, topicKey, windowDays })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Failed to load drill-down");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, specKey, topicKey, windowDays]);

  useEffect(() => {
    if (!open || !specKey || !topicKey?.trim()) return;
    let cancelled = false;
    getTeacherNotes({ specKey, topicKey, limit: 20 })
      .then((res) => { if (!cancelled) setTeacherNotes(res.items ?? []); })
      .catch(() => { if (!cancelled) setTeacherNotes([]); });
    return () => { cancelled = true; };
  }, [open, specKey, topicKey]);

  useEffect(() => {
    const stored = localStorage.getItem("askai:allowExternal:teacher");
    if (stored === "true") setSummaryAllowExternal(true);
  }, []);

  useEffect(() => {
    if (!open || !specKey || !topicKey?.trim()) return;
    let cancelled = false;
    setLogsLoading(true);
    getTopicSummaryLogs({ specKey, topicKey, limit: 10 })
      .then((res) => {
        if (!cancelled) {
          setRecentLogs(res.items);
          setLogsPagination(res.pagination);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRecentLogs([]);
          setLogsPagination(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLogsLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, specKey, topicKey]);

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    setSummaryResult(null);
    try {
      const res = await postTopicSummary({
        specKey,
        topicKey,
        mode: summaryMode,
        maxSources: summaryMaxSources,
        allowExternal: summaryAllowExternal,
      });
      setSummaryResult(res);
      if (res.topicSummaryLogId) {
        getTopicSummaryLogs({ specKey, topicKey, limit: 10 })
          .then((logsRes) => {
            setRecentLogs(logsRes.items);
            setLogsPagination(logsRes.pagination);
          })
          .catch(() => {});
      }
    } catch (e: any) {
      setSummaryError(e?.response?.data?.error ?? e?.message ?? "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleCopySummary = () => {
    if (!summaryResult?.summary?.summary) return;
    navigator.clipboard.writeText(summaryResult.summary.summary);
    setCopyToast("Summary copied");
    setTimeout(() => setCopyToast(null), 2000);
  };
  const handleCopyKeyPoints = () => {
    if (!summaryResult?.summary?.keyPoints?.length) return;
    navigator.clipboard.writeText(summaryResult.summary.keyPoints.join("\n"));
    setCopyToast("Key points copied");
    setTimeout(() => setCopyToast(null), 2000);
  };
  const handleCopyEverything = () => {
    if (!summaryResult) return;
    const parts = [
      summaryResult.summary.summary,
      "",
      "Key points:",
      ...(summaryResult.summary.keyPoints || []),
    ];
    const lp = summaryResult.summary.sections?.lessonPlan;
    if (lp) {
      parts.push("", `Lesson plan (${lp.durationMinutes} min):`);
      (lp.segments || []).forEach((s) => {
        parts.push(`  ${s.minutes}: ${s.title}`);
        parts.push(`    Script: ${s.teacherScript}`);
        parts.push(`    Activity: ${s.activity}`);
        parts.push(`    Check: ${s.checkForUnderstanding}`);
      });
    }
    const rs = summaryResult.summary.sections?.revisionSheet;
    if (rs) {
      parts.push("", "Common mistakes:", ...(rs.commonMistakes || []));
      parts.push("", "Memory cues:", ...(rs.memoryCues || []));
      parts.push("", "Flashcards:");
      (rs.flashcards || []).forEach((f, i) => parts.push(`  ${i + 1}. ${f.front} / ${f.back}`));
    }
    const ef = summaryResult.summary.sections?.examFocus;
    if (ef) {
      parts.push("", "Command words:", ...(ef.commandWords || []));
      parts.push("", "Exam question:", ef.examQuestion?.question || "", "Mark scheme:", ef.examQuestion?.markScheme || "");
    }
    navigator.clipboard.writeText(parts.join("\n"));
    setCopyToast("Everything copied");
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!summaryResult) return;
    setPdfDownloading(true);
    setCopyToast("Generating PDF…");
    try {
      await postTopicSummaryPdf({
        topicSummaryLogId: summaryResult.topicSummaryLogId,
        specKey: summaryResult.specKey,
        topicKey: summaryResult.topicKey,
        mode: summaryResult.mode,
        includeCitations: true,
        ...(!summaryResult.topicSummaryLogId && {
          summary: summaryResult.summary,
          usedSources: summaryResult.usedSources,
          confidenceLevel: summaryResult.confidenceLevel,
          confidenceReason: summaryResult.confidenceReason,
        }),
      });
      setCopyToast("Downloaded");
      setTimeout(() => setCopyToast(null), 2000);
    } catch (e: any) {
      setCopyToast(e?.message ?? "Download failed");
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleOpenLog = async (logId: string) => {
    try {
      const log = await getTopicSummaryLogById(logId);
      const asResponse: TopicSummaryResponse = {
        specKey: log.specKey,
        topicKey: log.topicKey,
        mode: log.mode,
        confidenceLevel: (log.confidenceLevel as TopicSummaryResponse["confidenceLevel"]) ?? "moderate",
        confidenceReason: log.confidenceReason ?? "",
        usedSources: log.usedSources,
        externalUsed: log.externalUsed,
        summary: log.summary,
        topicSummaryLogId: log.topicSummaryLogId,
      };
      setSummaryResult(asResponse);
      setToLessonResult(null);
    } catch (e: any) {
      setCopyToast(e?.message ?? "Failed to load summary");
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setOpenLogLoading(false);
    }
  };

  const handleDownloadPdfFromLog = async (logId: string) => {
    setPdfDownloading(true);
    setCopyToast("Generating PDF…");
    try {
      await postTopicSummaryPdf({
        topicSummaryLogId: logId,
        specKey,
        topicKey,
        mode: "overview",
        includeCitations: true,
        includeEvidenceAppendix: pdfIncludeEvidence,
        includeNextSteps: pdfIncludeNextSteps,
        includeMiniRevisionAppendix: pdfIncludeMiniRevision,
      });
      setCopyToast("Downloaded");
      setTimeout(() => setCopyToast(null), 2000);
    } catch (e: any) {
      setCopyToast(e?.message ?? "Download failed");
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setPdfDownloading(false);
    }
  };

  const handleLoadMoreLogs = async () => {
    if (!logsPagination?.hasMore || !logsPagination?.oldestReturnedAt) return;
    setLogsLoadingMore(true);
    try {
      const res = await getTopicSummaryLogs({
        specKey,
        topicKey,
        limit: 10,
        before: logsPagination.oldestReturnedAt,
      });
      setRecentLogs((prev) => [...prev, ...res.items]);
      setLogsPagination(res.pagination);
    } finally {
      setLogsLoadingMore(false);
    }
  };

  const handleCopyTopicKey = () => {
    navigator.clipboard.writeText(topicKey);
    setCopyToast("topicKey copied");
    setTimeout(() => setCopyToast(null), 2000);
  };

  const handleCreateDraftLesson = async () => {
    const logId = summaryResult?.topicSummaryLogId;
    if (!logId) return;
    setShowToLessonConfirm(false);
    setToLessonLoading(true);
    setToLessonResult(null);
    setSummaryError(null);
    try {
      const res = await postTopicSummaryToLesson({ topicSummaryLogId: logId });
      setToLessonResult({ lessonId: res.lessonId, lessonUrlEdit: res.lessonUrlEdit, lessonUrlView: res.lessonUrlView });
      setCopyToast("Draft lesson created");
      setTimeout(() => setCopyToast(null), 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Failed to create draft lesson";
      setSummaryError(msg);
      setCopyToast(msg);
      setTimeout(() => setCopyToast(null), 4000);
    } finally {
      setToLessonLoading(false);
    }
  };

  const handleAskAi = (question: string) => {
    if (onAskAi) {
      onAskAi(question);
      onClose();
    } else {
      navigator.clipboard.writeText(question);
      setCopyToast("Question copied—paste into Ask AI");
      setTimeout(() => setCopyToast(null), 2500);
    }
  };

  const handleDownloadSprintOrder = async () => {
    setSprintLoading(true);
    try {
      const { source } = await getSprintOrderMarkdown({
        specKey,
        windowDays,
        useSnapshots: true,
        top: 200,
        minEnquiries: 3,
      });
      setCopyToast(`Downloaded sprint order (${source})`);
      setTimeout(() => setCopyToast(null), 3000);
    } catch (e: any) {
      setCopyToast(e?.message ?? "Download failed");
      setTimeout(() => setCopyToast(null), 3000);
    } finally {
      setSprintLoading(false);
    }
  };

  const handleGenerateStarterPack = async () => {
    setShowGenConfirm(false);
    setGenLoading(true);
    setGenError(null);
    setGenResult(null);
    try {
      const statementCodes = data?.specStatements?.missing?.slice(0, 3).map((m) => m.statementCode).filter(Boolean) ?? [];
      const res = await postGenerateStarterPack({
        specKey,
        topicKey,
        statementCodes: statementCodes.length > 0 ? statementCodes : undefined,
      });
      setGenResult(res);
    } catch (e: any) {
      setGenError(e?.response?.data?.message ?? e?.message ?? "Generation failed");
    } finally {
      setGenLoading(false);
    }
  };

  const getPracticeSetCounts = () => {
    switch (practiceSetPreset) {
      case "exam-heavy":
        return { quizMcq: 3, quizShort: 2, exam: 4, flashcards: 4 };
      case "flashcards-heavy":
        return { quizMcq: 3, quizShort: 2, exam: 1, flashcards: 10 };
      default:
        return { quizMcq: 5, quizShort: 3, exam: 2, flashcards: 6 };
    }
  };

  const handleGeneratePracticeSet = async () => {
    setShowPracticeSetModal(false);
    setPracticeSetLoading(true);
    setPracticeSetError(null);
    setPracticeSetResult(null);
    try {
      const res = await postGeneratePracticeSet({
        specKey,
        topicKey,
        counts: getPracticeSetCounts(),
        allowExternal: practiceSetAllowExternal,
      });
      setPracticeSetResult(res);
    } catch (e: any) {
      setPracticeSetError(e?.response?.data?.message ?? e?.message ?? "Generation failed");
    } finally {
      setPracticeSetLoading(false);
    }
  };

  const handleGenerateWeakEvidenceFix = async () => {
    setShowWeakFixModal(false);
    setWeakFixLoading(true);
    setWeakFixError(null);
    setWeakFixResult(null);
    try {
      const statementCodes = weakFixStatementCodes.size > 0
        ? Array.from(weakFixStatementCodes).slice(0, 5)
        : undefined;
      const weakQuestions = weakFixQuestionIndices.size > 0 && data?.weakQuestions
        ? Array.from(weakFixQuestionIndices)
          .sort((a, b) => a - b)
          .slice(0, 5)
          .map((i) => data!.weakQuestions[i]?.question)
          .filter(Boolean)
        : undefined;
      const res = await postGenerateWeakEvidenceFix({
        specKey,
        topicKey,
        statementCodes,
        weakQuestions,
        allowExternal: weakFixAllowExternal,
        windowDays: weakFixWindowDays,
      });
      setWeakFixResult(res);
    } catch (e: any) {
      setWeakFixError(e?.response?.data?.message ?? e?.message ?? "Generation failed");
    } finally {
      setWeakFixLoading(false);
    }
  };

  const createLessonUrl = (statementCode?: string) => {
    const params = new URLSearchParams({ topicKey });
    if (statementCode) params.set("statementCode", statementCode);
    return `/create-lesson?${params.toString()}`;
  };

  const segment = topicKey.includes(":") ? topicKey.split(":").slice(-1)[0] : topicKey;
  const displayTitle = segment ? segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : topicKey;

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 999,
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: "min(480px, 100vw)",
          height: "100vh",
          background: "white",
          boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{displayTitle}</h2>
              <button
                type="button"
                onClick={handleCopyTopicKey}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  color: "#6b7280",
                  padding: 2,
                }}
                title="Copy topicKey"
              >
                📋
              </button>
            </div>
            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#6b7280" }}>{topicKey}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Window: {windowDays} days</div>
            {row && (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 600,
                    backgroundColor: row.status === "STRONG" ? "#d1fae5" : row.status === "OK" ? "#dbeafe" : "#fef3c7",
                    color: row.status === "STRONG" ? "#047857" : row.status === "OK" ? "#1d4ed8" : "#a16207",
                  }}
                >
                  {row.status}
                </span>
                <ScoreBar score={row.score} />
                <span style={{ fontSize: 12 }}>{row.score}</span>
                <span style={{ fontSize: 11, color: "#6b7280" }} title="Enquiries / weak enquiries">
                  enq {row.enquiriesTotal}/{row.enquiriesWeakEvidence}
                </span>
                <span style={{ fontSize: 11, color: "#6b7280" }} title="Summaries / weak summaries">
                  sum {row.summariesTotal ?? 0}/{row.weakSummariesTotal ?? 0}
                </span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "#6b7280",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {copyToast && (
            <div
              style={{
                padding: "8px 12px",
                marginBottom: 12,
                background: "#d1fae5",
                color: "#065f46",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {copyToast}
            </div>
          )}

          {loading && (
            <div style={{ color: "#6b7280" }}>
              <div style={{ height: 20, background: "#f3f4f6", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 80, background: "#f3f4f6", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ height: 60, background: "#f3f4f6", borderRadius: 4 }} />
            </div>
          )}

          {error && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ color: "#b91c1c", marginBottom: 8 }}>{error}</p>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  getCoverageDrilldown({ specKey, topicKey, windowDays })
                    .then(setData)
                    .catch((e: any) => setError(e?.message ?? "Failed"))
                    .finally(() => setLoading(false));
                }}
                style={{
                  padding: "8px 16px",
                  background: "#374151",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Retry
              </button>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Section 1 — Spec statements */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Spec statements — {data.specStatements.indexed}/{data.specStatements.total} indexed,{" "}
                  {data.specStatements.missing.length} missing
                </h3>
                {data.specStatements.missing.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#059669" }}>All spec statements have knowledge documents.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.specStatements.missing.map((m) => (
                      <li key={m.statementCode || m._id || Math.random()} style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{m.statementCode}</span> — {m.statementText}
                        <div style={{ marginTop: 4 }}>
                          <Link
                            to={createLessonUrl(m.statementCode)}
                            style={{ fontSize: 12, color: "#2563eb", textDecoration: "none" }}
                          >
                            Create lesson for this statement →
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <Link
                    to={createLessonUrl()}
                    style={{
                      display: "inline-block",
                      padding: "8px 16px",
                      background: "#10b981",
                      color: "white",
                      borderRadius: 8,
                      fontWeight: 600,
                      textDecoration: "none",
                      fontSize: 13,
                    }}
                  >
                    Create lesson for this topic
                  </Link>
                  <button
                    type="button"
                    onClick={() => setShowGenConfirm(true)}
                    disabled={genLoading}
                    style={{
                      padding: "8px 16px",
                      background: "#6366f1",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: genLoading ? "wait" : "pointer",
                    }}
                  >
                    {genLoading ? "Generating…" : "Generate lesson materials"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPracticeSetModal(true)}
                    disabled={practiceSetLoading}
                    style={{
                      padding: "8px 16px",
                      background: "#0ea5e9",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: practiceSetLoading ? "wait" : "pointer",
                    }}
                  >
                    {practiceSetLoading ? "Generating…" : "Generate practice set (draft)"}
                  </button>
                </div>
              </section>

              {/* PR-029: Create draft lesson confirmation modal */}
              {showToLessonConfirm && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    zIndex: 1200,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                  onClick={() => setShowToLessonConfirm(false)}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 24,
                      maxWidth: 420,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Create draft lesson</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563" }}>
                      Creates a draft lesson only. You can edit and publish later.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setShowToLessonConfirm(false)}
                        style={{
                          padding: "8px 16px",
                          background: "#e5e7eb",
                          color: "#374151",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateDraftLesson}
                        style={{
                          padding: "8px 16px",
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Create
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PR-014: Generate starter pack confirmation modal */}
              {showGenConfirm && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    zIndex: 1100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                  onClick={() => setShowGenConfirm(false)}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 24,
                      maxWidth: 420,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Generate starter pack</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563" }}>
                      Creates a draft lesson + draft flashcards, quiz questions, and exam questions. Nothing is published.
                      Uses top missing spec statements when none are selected.
                    </p>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setShowGenConfirm(false)}
                        style={{
                          padding: "8px 16px",
                          background: "#e5e7eb",
                          color: "#374151",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateStarterPack}
                        style={{
                          padding: "8px 16px",
                          background: "#6366f1",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PR-032: Generate practice set modal */}
              {showPracticeSetModal && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    zIndex: 1100,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                  onClick={() => setShowPracticeSetModal(false)}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 24,
                      maxWidth: 420,
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Generate practice set (draft)</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563" }}>
                      Creates draft flashcards, quiz questions (MCQ + short), and exam questions. Nothing is published.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Preset</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(["standard", "exam-heavy", "flashcards-heavy"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPracticeSetPreset(p)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              background: practiceSetPreset === p ? "#0ea5e9" : "#f3f4f6",
                              color: practiceSetPreset === p ? "white" : "#374151",
                              border: "none",
                              borderRadius: 6,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {p === "standard" ? "Standard" : p === "exam-heavy" ? "Exam-heavy" : "Flashcards-heavy"}
                          </button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
                        {practiceSetPreset === "standard" && "5 MCQ, 3 short, 2 exam, 6 flashcards"}
                        {practiceSetPreset === "exam-heavy" && "3 MCQ, 2 short, 4 exam, 4 flashcards"}
                        {practiceSetPreset === "flashcards-heavy" && "3 MCQ, 2 short, 1 exam, 10 flashcards"}
                      </div>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={practiceSetAllowExternal}
                          onChange={(e) => setPracticeSetAllowExternal(e.target.checked)}
                        />
                        Allow external trusted sources (teacher/admin only)
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setShowPracticeSetModal(false)}
                        style={{
                          padding: "8px 16px",
                          background: "#e5e7eb",
                          color: "#374151",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleGeneratePracticeSet}
                        style={{
                          padding: "8px 16px",
                          background: "#0ea5e9",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PR-032: Practice set success panel */}
              {practiceSetResult && (
                <section style={{ marginBottom: 24, padding: 16, background: "#e0f2fe", borderRadius: 12, border: "1px solid #0ea5e9" }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#0369a1" }}>
                    Practice set created
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#0284c7" }}>
                    Job ID: {practiceSetResult.jobId}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link
                      to={practiceSetResult.links.flashcardsBank}
                      style={{ fontSize: 13, color: "#0284c7", fontWeight: 600 }}
                    >
                      Review draft flashcards ({practiceSetResult.outputs.flashcardIdsCount})
                    </Link>
                    <Link
                      to={practiceSetResult.links.quizBank}
                      style={{ fontSize: 13, color: "#0284c7", fontWeight: 600 }}
                    >
                      Review draft quiz ({practiceSetResult.outputs.quizCount})
                    </Link>
                    <Link
                      to={practiceSetResult.links.examBank}
                      style={{ fontSize: 13, color: "#0284c7", fontWeight: 600 }}
                    >
                      Review draft exam questions ({practiceSetResult.outputs.examCount})
                    </Link>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <ReviewPublishChecklist
                      jobId={practiceSetResult.jobId}
                      topicKey={topicKey}
                      specKey={specKey as string}
                    />
                  </div>
                </section>
              )}

              {practiceSetError && (
                <section style={{ marginBottom: 24, padding: 12, background: "#fee2e2", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{practiceSetError}</p>
                </section>
              )}

              {/* PR-014: Success panel with links */}
              {genResult && (
                <section style={{ marginBottom: 24, padding: 16, background: "#d1fae5", borderRadius: 12 }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#065f46" }}>
                    Lesson materials created
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#047857" }}>
                    Job ID: {genResult.jobId}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link
                      to={`/edit-lesson/${genResult.outputs.lessonId}`}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Edit draft lesson →
                    </Link>
                    <Link
                      to={genResult.links.flashcardsBank}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Review draft flashcards ({genResult.outputs.flashcardIdsCount})
                    </Link>
                    <Link
                      to={genResult.links.quizBank}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Review draft quiz ({genResult.outputs.quizCount})
                    </Link>
                    <Link
                      to={genResult.links.examBank}
                      style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}
                    >
                      Review draft exam questions ({genResult.outputs.examCount})
                    </Link>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <ReviewPublishChecklist
                      jobId={genResult.jobId}
                      topicKey={topicKey}
                      specKey={specKey as string}
                    />
                  </div>
                </section>
              )}

              {genError && (
                <section style={{ marginBottom: 24, padding: 12, background: "#fee2e2", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{genError}</p>
                </section>
              )}

              {/* Section 2 — Lessons */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Lessons contributing knowledge ({data.lessons.length})
                </h3>
                {data.lessons.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#6b7280" }}>No lessons indexed for this topic.</p>
                ) : (
                  <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                        <th style={{ textAlign: "left", padding: "8px 0" }}>Lesson</th>
                        <th style={{ textAlign: "right", padding: "8px 0" }}>Docs</th>
                        <th style={{ textAlign: "left", padding: "8px 0" }}>Updated</th>
                        <th style={{ textAlign: "center", padding: "8px 0" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lessons.map((l) => (
                        <tr key={l.lessonId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "8px 0" }}>{l.title}</td>
                          <td style={{ textAlign: "right", padding: "8px 0" }}>{l.knowledgeDocs}</td>
                          <td style={{ padding: "8px 0", fontSize: 12, color: "#6b7280" }}>
                            {l.lastUpdated ? new Date(l.lastUpdated).toLocaleDateString() : "-"}
                          </td>
                          <td style={{ padding: "8px 0", textAlign: "center" }}>
                            <Link to={l.links.student} style={{ marginRight: 8, fontSize: 12, color: "#2563eb" }}>
                              View
                            </Link>
                            <Link to={l.links.edit} style={{ fontSize: 12, color: "#2563eb" }}>
                              Edit
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              {/* PR-023: Section — Teacher notes (curated) */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Teacher notes (curated) — {teacherNotes.length}
                </h3>
                {teacherNotes.length === 0 ? (
                  <>
                    <p style={{ fontSize: 13, color: "#6b7280" }}>No curated notes yet.</p>
                    <Link
                      to={`/external-sources?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`}
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 13,
                        color: "#2563eb",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Review external sources →
                    </Link>
                  </>
                ) : (
                  <>
                    {teacherNotes.slice(0, 5).map((n) => (
                      <div
                        key={n.knowledgeDocumentId}
                        style={{
                          padding: 12,
                          marginBottom: 8,
                          background: "#f8fafc",
                          borderRadius: 8,
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                          {n.title || "Teacher note"}
                        </div>
                        {n.metadata?.domain && (
                          <div style={{ marginBottom: 4 }}>
                            <a
                              href={n.metadata?.url || `https://${n.metadata.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 12,
                                color: "#2563eb",
                                textDecoration: "none",
                              }}
                            >
                              <span
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: "#e0e7ff",
                                  color: "#3730a3",
                                  marginRight: 6,
                                }}
                              >
                                {n.metadata.domain}
                              </span>
                              → Open
                            </a>
                          </div>
                        )}
                        <p style={{ margin: "0 0 4px 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                          {(n.textSnippet || "").slice(0, 180)}
                          {(n.textSnippet || "").length > 180 ? "…" : ""}
                        </p>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>
                          {n.updatedAt ? new Date(n.updatedAt).toLocaleDateString() : ""}
                        </div>
                      </div>
                    ))}
                    {teacherNotes.length > 5 && (
                      <Link
                        to={`/external-sources?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`}
                        style={{ fontSize: 13, color: "#2563eb", fontWeight: 600 }}
                      >
                        View all ({teacherNotes.length}) →
                      </Link>
                    )}
                    {teacherNotes.length <= 5 && (
                      <Link
                        to={`/external-sources?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`}
                        style={{ display: "block", marginTop: 8, fontSize: 13, color: "#2563eb", fontWeight: 600 }}
                      >
                        Review external sources →
                      </Link>
                    )}
                  </>
                )}
              </section>

              {/* PR-024: Section — Teaching summary. PR-027: Recent summaries */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Teaching summary
                </h3>
                <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#6b7280" }}>
                  Summarise topic across spec, lessons, and teacher notes. Perplexity-style teaching artifact.
                </p>
                {logsLoading ? (
                  <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>Loading recent summaries…</p>
                ) : recentLogs.length > 0 ? (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Recent summaries</div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {recentLogs.map((log) => (
                        <li
                          key={log._id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 8,
                            padding: "8px 10px",
                            marginBottom: 6,
                            background: "#f8fafc",
                            borderRadius: 8,
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: "2px 6px",
                                borderRadius: 4,
                                background: "#e0e7ff",
                                color: "#4338ca",
                                fontWeight: 600,
                              }}
                            >
                              {log.mode === "overview" ? "Overview" : log.mode === "lessonPlan" ? "Lesson plan" : log.mode === "revisionSheet" ? "Revision sheet" : "Exam focus"}
                            </span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                            {log.confidenceLevel && (
                              <span
                                style={{
                                  fontSize: 11,
                                  padding: "2px 6px",
                                  borderRadius: 4,
                                  background: log.confidenceLevel === "strong" ? "#d1fae5" : log.confidenceLevel === "moderate" ? "#fef3c7" : "#fee2e2",
                                  color: log.confidenceLevel === "strong" ? "#065f46" : log.confidenceLevel === "moderate" ? "#92400e" : "#991b1b",
                                  fontWeight: 600,
                                }}
                              >
                                {log.confidenceLevel === "strong" ? "Strong" : log.confidenceLevel === "moderate" ? "Moderate" : "Weak"}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowSummaryModal(true);
                                handleOpenLog(log._id);
                              }}
                              style={{
                                padding: "4px 10px",
                                fontSize: 11,
                                background: "#8b5cf6",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Open
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadPdfFromLog(log._id)}
                              disabled={pdfDownloading}
                              style={{
                                padding: "4px 10px",
                                fontSize: 11,
                                background: "#dc2626",
                                color: "white",
                                border: "none",
                                borderRadius: 6,
                                cursor: pdfDownloading ? "wait" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Download PDF
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {logsPagination?.hasMore && (
                      <button
                        type="button"
                        onClick={handleLoadMoreLogs}
                        disabled={logsLoadingMore}
                        style={{
                          marginTop: 8,
                          padding: "6px 12px",
                          fontSize: 12,
                          background: "#f1f5f9",
                          color: "#475569",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          cursor: logsLoadingMore ? "wait" : "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {logsLoadingMore ? "Loading…" : "Load more"}
                      </button>
                    )}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setShowSummaryModal(true);
                    setSummaryResult(null);
                    setSummaryError(null);
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "#8b5cf6",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Create topic summary
                </button>
              </section>

              {/* PR-024: Topic summary modal */}
              {showSummaryModal && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    zIndex: 1100,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    padding: 24,
                    overflowY: "auto",
                  }}
                  onClick={() => setShowSummaryModal(false)}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 24,
                      maxWidth: 560,
                      width: "100%",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                      marginBottom: 40,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 16px 0", fontSize: 18 }}>Teaching summary</h3>
                    {openLogLoading ? (
                      <p style={{ fontSize: 14, color: "#6b7280" }}>Loading summary…</p>
                    ) : !summaryResult ? (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Mode</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {(["overview", "lessonPlan", "revisionSheet", "examFocus"] as const).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setSummaryMode(m)}
                                style={{
                                  padding: "6px 12px",
                                  fontSize: 12,
                                  background: summaryMode === m ? "#8b5cf6" : "#f3f4f6",
                                  color: summaryMode === m ? "white" : "#374151",
                                  border: "none",
                                  borderRadius: 6,
                                  cursor: "pointer",
                                  fontWeight: 600,
                                }}
                              >
                                {m === "overview" ? "Overview" : m === "lessonPlan" ? "Lesson plan" : m === "revisionSheet" ? "Revision sheet" : "Exam focus"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Max sources</label>
                          <select
                            value={summaryMaxSources}
                            onChange={(e) => setSummaryMaxSources(Number(e.target.value))}
                            style={{
                              padding: "8px 12px",
                              fontSize: 13,
                              border: "1px solid #e5e7eb",
                              borderRadius: 8,
                              minWidth: 80,
                            }}
                          >
                            <option value={8}>8</option>
                            <option value={14}>14</option>
                            <option value={20}>20</option>
                          </select>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={summaryAllowExternal}
                              onChange={(e) => setSummaryAllowExternal(e.target.checked)}
                            />
                            Use external references if course content is thin
                          </label>
                        </div>
                        {summaryError && (
                          <div style={{ marginBottom: 16, padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>
                            {summaryError}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => setShowSummaryModal(false)}
                            style={{
                              padding: "8px 16px",
                              background: "#e5e7eb",
                              color: "#374151",
                              border: "none",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontWeight: 600,
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleGenerateSummary}
                            disabled={summaryLoading}
                            style={{
                              padding: "8px 16px",
                              background: summaryLoading ? "#9ca3af" : "#8b5cf6",
                              color: "white",
                              border: "none",
                              borderRadius: 8,
                              cursor: summaryLoading ? "wait" : "pointer",
                              fontWeight: 600,
                            }}
                          >
                            {summaryLoading ? "Building topic summary from trusted sources…" : "Generate"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 700,
                              backgroundColor:
                                summaryResult.confidenceLevel === "strong"
                                  ? "#d1fae5"
                                  : summaryResult.confidenceLevel === "moderate"
                                    ? "#fef3c7"
                                    : "#fee2e2",
                              color:
                                summaryResult.confidenceLevel === "strong"
                                  ? "#065f46"
                                  : summaryResult.confidenceLevel === "moderate"
                                    ? "#92400e"
                                    : "#991b1b",
                            }}
                          >
                            {summaryResult.confidenceLevel === "strong" ? "Strong" : summaryResult.confidenceLevel === "moderate" ? "Moderate" : "Weak"}
                          </span>
                          {summaryResult.cached && (
                            <span style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>(cached)</span>
                          )}
                          {summaryResult.externalUsed && (
                            <span style={{ fontSize: 12, color: "#92400e" }}>External references used</span>
                          )}
                        </div>
                        <div style={{ marginBottom: 12, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                          {summaryResult.summary.summary}
                        </div>
                        {summaryResult.summary.keyPoints?.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Key points</div>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                              {summaryResult.summary.keyPoints.map((kp, i) => (
                                <li key={i} style={{ marginBottom: 4 }}>{kp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {summaryResult.summary.sections?.lessonPlan && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
                              Lesson plan ({summaryResult.summary.sections.lessonPlan.durationMinutes} min)
                            </div>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                                  <th style={{ padding: 8, textAlign: "left" }}>Time</th>
                                  <th style={{ padding: 8, textAlign: "left" }}>Title</th>
                                  <th style={{ padding: 8, textAlign: "left" }}>Activity</th>
                                  <th style={{ padding: 8, textAlign: "left" }}>Check</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(summaryResult.summary.sections.lessonPlan.segments || []).map((s, i) => (
                                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                    <td style={{ padding: 8 }}>{s.minutes}</td>
                                    <td style={{ padding: 8 }}>{s.title}</td>
                                    <td style={{ padding: 8 }}>{s.activity}</td>
                                    <td style={{ padding: 8 }}>{s.checkForUnderstanding}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {summaryResult.summary.sections?.revisionSheet && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Revision sheet</div>
                            {summaryResult.summary.sections.revisionSheet.commonMistakes?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Common mistakes:</strong>
                                <ul style={{ margin: "4px 0 0 20px" }}>
                                  {summaryResult.summary.sections.revisionSheet.commonMistakes.map((m, i) => (
                                    <li key={i}>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {summaryResult.summary.sections.revisionSheet.memoryCues?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Memory cues:</strong>
                                <ul style={{ margin: "4px 0 0 20px" }}>
                                  {summaryResult.summary.sections.revisionSheet.memoryCues.map((m, i) => (
                                    <li key={i}>{m}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {(summaryResult.summary.sections.revisionSheet.flashcards || []).length > 0 && (
                              <div>
                                <strong>Flashcards:</strong>
                                {(summaryResult.summary.sections.revisionSheet.flashcards || []).map((f, i) => (
                                  <div key={i} style={{ marginTop: 8, padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Q: {f.front}</div>
                                    <div style={{ fontSize: 13, color: "#475569" }}>A: {f.back}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {summaryResult.summary.sections?.examFocus && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Exam focus</div>
                            {summaryResult.summary.sections.examFocus.commandWords?.length > 0 && (
                              <div style={{ marginBottom: 8 }}>
                                <strong>Command words:</strong>{" "}
                                {summaryResult.summary.sections.examFocus.commandWords.join(", ")}
                              </div>
                            )}
                            {summaryResult.summary.sections.examFocus.examQuestion && (
                              <div style={{ padding: 12, background: "#fefce8", borderRadius: 8, border: "1px solid #fde047" }}>
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>Question: {summaryResult.summary.sections.examFocus.examQuestion.question}</div>
                                <div style={{ fontSize: 12, color: "#854d0e" }}>Mark scheme: {summaryResult.summary.sections.examFocus.examQuestion.markScheme}</div>
                              </div>
                            )}
                          </div>
                        )}
                        {summaryResult.summary.citations?.length > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <CitationsList
                              citations={summaryResult.summary.citations as any}
                              usedSources={summaryResult.usedSources as any}
                              defaultQuotesExpanded={false}
                              studentMode={false}
                              specKey={specKey}
                              topicKey={topicKey}
                              sectionTitle="Citations"
                            />
                          </div>
                        )}
                        <div style={{ marginBottom: 12, padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>PDF export options</div>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={pdfIncludeEvidence} onChange={(e) => setPdfIncludeEvidence(e.target.checked)} />
                            Include evidence appendix
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={pdfIncludeNextSteps} onChange={(e) => setPdfIncludeNextSteps(e.target.checked)} />
                            Include next steps
                          </label>
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={pdfIncludeMiniRevision} onChange={(e) => setPdfIncludeMiniRevision(e.target.checked)} />
                            Add mini revision appendix
                          </label>
                        </div>
                        {toLessonResult ? (
                          <div style={{ marginBottom: 16, padding: 12, background: "#d1fae5", borderRadius: 8, border: "1px solid #059669" }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14, color: "#065f46" }}>Draft lesson created</div>
                            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                              <Link to={toLessonResult.lessonUrlEdit} style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>
                                Edit lesson →
                              </Link>
                              <a href={toLessonResult.lessonUrlView} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#059669", fontWeight: 600 }}>
                                View lesson (new tab) →
                              </a>
                            </div>
                          </div>
                        ) : null}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                          <button type="button" onClick={handleCopySummary} style={{ padding: "6px 12px", fontSize: 12, background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                            Copy summary
                          </button>
                          <button type="button" onClick={handleCopyKeyPoints} style={{ padding: "6px 12px", fontSize: 12, background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                            Copy key points
                          </button>
                          <button type="button" onClick={handleCopyEverything} style={{ padding: "6px 12px", fontSize: 12, background: "#e2e8f0", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                            Copy everything
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={pdfDownloading}
                            style={{ padding: "6px 12px", fontSize: 12, background: "#dc2626", color: "white", border: "none", borderRadius: 6, cursor: pdfDownloading ? "wait" : "pointer", fontWeight: 600 }}
                          >
                            {pdfDownloading ? "Downloading…" : "Download PDF"}
                          </button>
                          {summaryResult?.topicSummaryLogId && (
                            <button
                              type="button"
                              onClick={() => setShowToLessonConfirm(true)}
                              disabled={toLessonLoading}
                              style={{ padding: "6px 12px", fontSize: 12, background: "#10b981", color: "white", border: "none", borderRadius: 6, cursor: toLessonLoading ? "wait" : "pointer", fontWeight: 600 }}
                            >
                              {toLessonLoading ? "Creating…" : "Create draft lesson"}
                            </button>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => { setSummaryResult(null); setSummaryError(null); setToLessonResult(null); }}
                            style={{ padding: "8px 16px", background: "#8b5cf6", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                          >
                            New summary
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowSummaryModal(false)}
                            style={{ padding: "8px 16px", background: "#e5e7eb", color: "#374151", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}
                          >
                            Close
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Section 3 — Topics students struggle with */}
              <section style={{ marginBottom: 24 }}>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>
                  Topics students struggle with ({data.weakQuestions.length})
                </h3>
                {data.weakQuestions.length === 0 ? (
                  <p style={{ fontSize: 13, color: "#6b7280" }}>No weak-evidence enquiries in window.</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.weakQuestions.map((q, i) => (
                      <li key={i} style={{ marginBottom: 8, fontSize: 13 }}>
                        &quot;{q.question.slice(0, 100)}{q.question.length > 100 ? "…" : ""}&quot; ({q.enquiries})
                        <button
                          type="button"
                          onClick={() => handleAskAi(q.question)}
                          style={{
                            marginLeft: 8,
                            padding: "2px 8px",
                            fontSize: 11,
                            background: "#6366f1",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                          }}
                        >
                          Ask AI
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {(data.specStatements.missing.length > 0 || data.weakQuestions.length > 0) && (
                  <button
                    type="button"
                    onClick={() => setShowWeakFixModal(true)}
                    disabled={weakFixLoading}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: "#8b5cf6",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: weakFixLoading ? "wait" : "pointer",
                    }}
                  >
                    {weakFixLoading ? "Generating…" : "Fix weak evidence (draft pack)"}
                  </button>
                )}
              </section>

              {/* PR-031: Fix weak evidence modal */}
              {showWeakFixModal && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.4)",
                    zIndex: 1150,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 16,
                  }}
                  onClick={() => setShowWeakFixModal(false)}
                >
                  <div
                    style={{
                      background: "white",
                      borderRadius: 12,
                      padding: 24,
                      maxWidth: 480,
                      maxHeight: "85vh",
                      overflow: "auto",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>Fix topic with AI</h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: 14, color: "#4b5563" }}>
                      Create draft content to improve a difficult topic. Select up to 5 missing statements and 5 questions students struggle with.
                    </p>
                    <div style={{ marginBottom: 16, fontSize: 12, color: "#6b7280" }}>
                      Missing statements: {data?.specStatements?.missing?.length ?? 0} • Questions students struggle with: {data?.weakQuestions?.length ?? 0}
                    </div>
                    {data?.specStatements?.missing && data.specStatements.missing.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600 }}>Missing statements (max 5)</h4>
                        <div style={{ maxHeight: 120, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                          {data.specStatements.missing.slice(0, 10).map((m) => (
                            <label key={m.statementCode} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 12, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={weakFixStatementCodes.has(m.statementCode)}
                                onChange={() => {
                                  const next = new Set(weakFixStatementCodes);
                                  if (next.has(m.statementCode)) next.delete(m.statementCode);
                                  else if (next.size < 5) next.add(m.statementCode);
                                  setWeakFixStatementCodes(next);
                                }}
                              />
                              <span>{m.statementCode}: {(m.statementText || "").slice(0, 60)}…</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {data?.weakQuestions && data.weakQuestions.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <h4 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 600 }}>Weak questions (max 5)</h4>
                        <div style={{ maxHeight: 120, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                          {data.weakQuestions.slice(0, 10).map((q, i) => (
                            <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6, fontSize: 12, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={weakFixQuestionIndices.has(i)}
                                onChange={() => {
                                  const next = new Set(weakFixQuestionIndices);
                                  if (next.has(i)) next.delete(i);
                                  else if (next.size < 5) next.add(i);
                                  setWeakFixQuestionIndices(next);
                                }}
                              />
                              <span>&quot;{(q.question || "").slice(0, 50)}…&quot; ({q.enquiries})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={weakFixAllowExternal}
                          onChange={(e) => setWeakFixAllowExternal(e.target.checked)}
                        />
                        Allow external trusted sources (teacher/admin only)
                      </label>
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600 }}>Window (days)</label>
                      <select
                        value={weakFixWindowDays}
                        onChange={(e) => setWeakFixWindowDays(Number(e.target.value))}
                        style={{ marginLeft: 8, padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db" }}
                      >
                        <option value={7}>7</option>
                        <option value={14}>14</option>
                        <option value={30}>30</option>
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setShowWeakFixModal(false)}
                        style={{
                          padding: "8px 16px",
                          background: "#e5e7eb",
                          color: "#374151",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateWeakEvidenceFix}
                        style={{
                          padding: "8px 16px",
                          background: "#8b5cf6",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Create drafts
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PR-031: Weak evidence fix success panel */}
              {weakFixResult && (
                <section style={{ marginBottom: 24, padding: 16, background: "#ede9fe", borderRadius: 12, border: "1px solid #8b5cf6" }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700, color: "#5b21b6" }}>
                    Topic fix pack created
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#6d28d9" }}>
                    Job ID: {weakFixResult.jobId}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link
                      to={`/edit-lesson/${weakFixResult.lessonId}`}
                      style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}
                    >
                      Edit draft lesson →
                    </Link>
                    <Link
                      to={weakFixResult.links.flashcardsBank}
                      style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}
                    >
                      Review draft flashcards ({weakFixResult.flashcards.length})
                    </Link>
                    <Link
                      to={weakFixResult.links.quizBank}
                      style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}
                    >
                      Review draft quiz ({weakFixResult.quiz.length})
                    </Link>
                    <Link
                      to={weakFixResult.links.examBank}
                      style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}
                    >
                      Review draft exam questions ({weakFixResult.exam.length})
                    </Link>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <ReviewPublishChecklist
                      jobId={weakFixResult.jobId}
                      topicKey={topicKey}
                      specKey={specKey as string}
                    />
                  </div>
                </section>
              )}

              {weakFixError && (
                <section style={{ marginBottom: 24, padding: 12, background: "#fee2e2", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{weakFixError}</p>
                </section>
              )}

              {/* Section 4 — Sprint */}
              <section>
                <h3 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>Sprint</h3>
                <button
                  type="button"
                  onClick={handleDownloadSprintOrder}
                  disabled={sprintLoading}
                  style={{
                    padding: "10px 16px",
                    background: "#6366f1",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: sprintLoading ? "wait" : "pointer",
                    fontSize: 14,
                  }}
                >
                  {sprintLoading ? "Downloading…" : "Download sprint order"}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
};
