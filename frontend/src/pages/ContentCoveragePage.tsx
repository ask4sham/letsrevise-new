/**
 * Admin Content Coverage page — spec-level topic coverage from content graph.
 * Route: /admin/content-coverage
 */
import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchSpecCoverage,
  fetchSpecGaps,
  fetchSpecAutopilotReadiness,
  fetchSpecEvidence,
  fetchSpecLearningEvidence,
  fetchEvidenceReviewWorklist,
  fetchAutopilotPromptPacks,
  fetchAutopilotGate,
  rebuildTopicGraph,
  rebuildSpecGraph,
  runTopicAutopilot,
  runSpecAutopilot,
  type TopicCoverageRow,
  type SpecCoverageResponse,
  type TopicGap,
  type SpecGapsResponse,
  type TopicReadiness,
  type SpecReadinessResponse,
  type TopicEvidence,
  type SpecEvidenceResponse,
  type TopicLearningEvidence,
  type SpecLearningEvidenceResponse,
  type EvidenceReviewItem,
  type EvidenceReviewResponse,
  type AutopilotTopicResult,
  type AutopilotSpecResult,
  type AutopilotPromptPack,
  type AutopilotGate,
} from "../api/contentGraph";
import { setStoredSpecKey } from "../utils/specKey";
import Toast from "../components/Toast";

/** Resolve topicKey for URL/state: prefer namespaced specKey:topicKey when topicKey is short. */
function resolveTopicKey(gap: TopicGap): string {
  const tk = gap.topicKey || "";
  const sk = gap.specKey || "";
  if (!tk) return "";
  if (tk.includes(":")) return tk;
  return sk ? `${sk}:${tk}` : tk;
}

export type SuggestedAction = { type: string; label: string; reason: string };

/** Map a suggested action to navigation target. Returns path and optional state. */
export function mapSuggestedActionToNavigation(
  action: SuggestedAction,
  gap: TopicGap
): { path: string; state?: object } {
  const topicKey = resolveTopicKey(gap);
  const specKey = gap.specKey || "";

  switch (action.type) {
    case "create_lesson":
      return {
        path: "/create-lesson",
        state: { specKey, topicKey },
      };
    case "generate_flashcards":
      return {
        path: `/teacher/topic-banks/flashcards?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`,
      };
    case "generate_quiz":
      return {
        path: `/teacher/topic-banks/quizzes?specKey=${encodeURIComponent(specKey)}&topicKey=${encodeURIComponent(topicKey)}`,
      };
    case "generate_exam_questions":
      return {
        path: `/admin/question-banks?tab=exam-questions&topicKey=${encodeURIComponent(topicKey)}`,
      };
    case "review_content":
      return { path: "/admin/content-issues" };
    case "fix_mapping":
      return { path: "/admin/taxonomy" };
    default:
      return { path: "/admin" };
  }
}

/** Map evidence review action to navigation target. */
export function mapReviewActionToNavigation(
  actionType: string,
  item: EvidenceReviewItem
): { path: string; state?: object } {
  const specKey = item.specKey || "";
  const topicKey = item.topicKey || "";

  switch (actionType) {
    case "review_content":
    case "resolve_open_issues":
      return { path: "/admin/content-issues" };
    case "inspect_rejections":
      return { path: "/admin/autopilot-approval" };
    case "improve_prompt_pack":
      return { path: "/admin/autopilot-feedback" };
    case "fix_topic_mapping":
      return { path: "/admin/taxonomy" };
    case "rebuild_graph":
      return { path: "/admin/content-coverage", state: { rebuildTopic: { specKey, topicKey } } };
    default:
      return { path: "/admin" };
  }
}

type ViewMode = "coverage" | "gaps" | "readiness" | "evidence" | "review" | "learning";

const SPEC_OPTIONS: { value: string; label: string }[] = [
  { value: "aqa-gcse-biology", label: "AQA GCSE Biology" },
  { value: "aqa-gcse-chemistry", label: "AQA GCSE Chemistry" },
  { value: "aqa-gcse-physics", label: "AQA GCSE Physics" },
  { value: "aqa-gcse-maths-foundation", label: "AQA GCSE Maths (Foundation)" },
  { value: "aqa-gcse-maths-higher", label: "AQA GCSE Maths (Higher)" },
  { value: "aqa-gcse-english-language", label: "AQA GCSE English Language" },
  { value: "aqa-gcse-english-literature", label: "AQA GCSE English Literature" },
];

function formatTopicKey(key: string): string {
  const part = key.includes(":") ? key.split(":").pop()! : key;
  return part.replace(/-/g, " ");
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "strong"
      ? { background: "#d4edda", color: "#155724" }
      : status === "partial"
      ? { background: "#fff3cd", color: "#856404" }
      : { background: "#f8d7da", color: "#721c24" };
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

function GapFlagsBadges({ gapFlags }: { gapFlags: TopicGap["gapFlags"] }) {
  const active = Object.entries(gapFlags || {}).filter(([, v]) => v);
  if (active.length === 0) return <span style={{ color: "#64748b", fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {active.map(([k]) => (
        <span
          key={k}
          style={{
            padding: "2px 6px",
            background: "#fef3c7",
            color: "#92400e",
            borderRadius: 4,
            fontSize: 11,
          }}
        >
          {k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim()}
        </span>
      ))}
    </div>
  );
}

function EvidenceHealthBadge({ health }: { health: string }) {
  const style =
    health === "strong"
      ? { background: "#d4edda", color: "#155724" }
      : health === "mixed"
      ? { background: "#fff3cd", color: "#856404" }
      : health === "weak"
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
      {health}
    </span>
  );
}

function DifficultyLevelBadge({ level }: { level: string }) {
  const style =
    level === "well_understood"
      ? { background: "#d4edda", color: "#155724" }
      : level === "moderate"
      ? { background: "#fff3cd", color: "#856404" }
      : level === "difficult"
      ? { background: "#f8d7da", color: "#721c24" }
      : level === "very_difficult"
      ? { background: "#f5c6cb", color: "#721c24" }
      : { background: "#e2e8f0", color: "#64748b" };
  const label =
    level === "well_understood"
      ? "Well understood"
      : level === "moderate"
      ? "Moderate"
      : level === "difficult"
      ? "Difficult"
      : level === "very_difficult"
      ? "Very difficult"
      : "Unknown";
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
      {label}
    </span>
  );
}

function GateStatusBadge({ gateStatus }: { gateStatus: string }) {
  const style =
    gateStatus === "allow"
      ? { background: "#d4edda", color: "#155724" }
      : gateStatus === "limited"
      ? { background: "#fff3cd", color: "#856404" }
      : gateStatus === "review_required"
      ? { background: "#fef3c7", color: "#92400e" }
      : { background: "#f8d7da", color: "#721c24" };
  const label =
    gateStatus === "allow"
      ? "Allow"
      : gateStatus === "limited"
      ? "Limited"
      : gateStatus === "review_required"
      ? "Review required"
      : "Block";
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
      {label}
    </span>
  );
}

const ContentCoveragePage: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("coverage");
  const [specKey, setSpecKey] = useState("aqa-gcse-biology");
  const [data, setData] = useState<SpecCoverageResponse | null>(null);
  const [gapsData, setGapsData] = useState<SpecGapsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicCoverageRow | null>(null);
  const [selectedGap, setSelectedGap] = useState<TopicGap | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildingSpec, setRebuildingSpec] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [rebuildToast, setRebuildToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [autopilotDryRun, setAutopilotDryRun] = useState(true);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [autopilotResult, setAutopilotResult] = useState<AutopilotTopicResult | AutopilotSpecResult | null>(null);
  const [readinessData, setReadinessData] = useState<SpecReadinessResponse | null>(null);
  const [selectedReadiness, setSelectedReadiness] = useState<TopicReadiness | null>(null);
  const [promptPacks, setPromptPacks] = useState<AutopilotPromptPack[]>([]);
  const [selectedPromptPack, setSelectedPromptPack] = useState<{ promptPackId: string; promptPackVersion: string } | null>(null);
  const [evidenceData, setEvidenceData] = useState<SpecEvidenceResponse | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<TopicEvidence | null>(null);
  const [gateData, setGateData] = useState<AutopilotGate | null>(null);
  const [reviewWorklistData, setReviewWorklistData] = useState<EvidenceReviewResponse | null>(null);
  const [selectedReviewItem, setSelectedReviewItem] = useState<EvidenceReviewItem | null>(null);
  const [learningEvidenceData, setLearningEvidenceData] = useState<SpecLearningEvidenceResponse | null>(null);
  const [selectedLearningEvidence, setSelectedLearningEvidence] = useState<TopicLearningEvidence | null>(null);

  const loadSpecCoverage = useCallback(async (): Promise<SpecCoverageResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecCoverage(specKey);
      setData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load spec coverage");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  const loadSpecGaps = useCallback(async (): Promise<SpecGapsResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecGaps(specKey);
      setGapsData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load gap analysis");
      setGapsData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  const loadSpecReadiness = useCallback(async (): Promise<SpecReadinessResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecAutopilotReadiness(specKey);
      setReadinessData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load readiness");
      setReadinessData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  const loadPromptPacks = useCallback(async () => {
    try {
      const res = await fetchAutopilotPromptPacks();
      const packs = res.promptPacks || [];
      setPromptPacks(packs);
      setSelectedPromptPack((prev) => {
        if (prev) return prev;
        const defaultPack = packs.find((p) => p.isDefault);
        if (defaultPack) return { promptPackId: defaultPack.promptPackId, promptPackVersion: defaultPack.promptPackVersion };
        if (packs.length > 0) return { promptPackId: packs[0].promptPackId, promptPackVersion: packs[0].promptPackVersion };
        return null;
      });
    } catch {
      setPromptPacks([]);
    }
  }, []);

  const loadSpecEvidence = useCallback(async (): Promise<SpecEvidenceResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecEvidence(specKey);
      setEvidenceData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load topic evidence");
      setEvidenceData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  const loadLearningEvidence = useCallback(async (): Promise<SpecLearningEvidenceResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpecLearningEvidence(specKey);
      setLearningEvidenceData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load student learning evidence");
      setLearningEvidenceData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  const loadReviewWorklist = useCallback(async (): Promise<EvidenceReviewResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEvidenceReviewWorklist(specKey);
      setReviewWorklistData(res);
      setLastRefreshed(new Date());
      return res;
    } catch (err: any) {
      setError(err?.message || "Failed to load evidence review worklist");
      setReviewWorklistData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [specKey]);

  useEffect(() => {
    if (viewMode === "coverage") loadSpecCoverage();
    else if (viewMode === "gaps") {
      loadSpecGaps();
      loadPromptPacks();
    } else if (viewMode === "readiness") loadSpecReadiness();
    else if (viewMode === "evidence") loadSpecEvidence();
    else if (viewMode === "review") loadReviewWorklist();
    else if (viewMode === "learning") loadLearningEvidence();
  }, [viewMode, loadSpecCoverage, loadSpecGaps, loadSpecReadiness, loadPromptPacks, loadSpecEvidence, loadReviewWorklist, loadLearningEvidence]);

  useEffect(() => {
    let sk: string;
    let tk: string;
    if (selectedGap) {
      sk = selectedGap.specKey || specKey;
      tk = resolveTopicKey(selectedGap);
    } else if (selectedReadiness) {
      sk = specKey;
      tk = selectedReadiness.topicKey || "";
    } else if (selectedEvidence) {
      sk = selectedEvidence.specKey || specKey;
      tk = selectedEvidence.topicKey || "";
    } else {
      setGateData(null);
      return;
    }
    if (!sk || !tk) {
      setGateData(null);
      return;
    }
    fetchAutopilotGate(sk, tk)
      .then(setGateData)
      .catch(() => setGateData(null));
  }, [selectedGap, selectedReadiness, selectedEvidence, specKey]);

  const openDrawer = (topic: TopicCoverageRow) => {
    setSelectedTopic(topic);
    setSelectedGap(null);
    setSelectedReadiness(null);
    setSelectedEvidence(null);
    setSelectedReviewItem(null);
    setSelectedLearningEvidence(null);
    setDrawerOpen(true);
  };

  const openGapDrawer = (gap: TopicGap) => {
    setSelectedGap(gap);
    setSelectedTopic(null);
    setSelectedReadiness(null);
    setSelectedEvidence(null);
    setSelectedReviewItem(null);
    setSelectedLearningEvidence(null);
    setDrawerOpen(true);
  };

  const openReadinessDrawer = (r: TopicReadiness) => {
    setSelectedReadiness(r);
    setSelectedTopic(null);
    setSelectedGap(null);
    setSelectedEvidence(null);
    setSelectedReviewItem(null);
    setSelectedLearningEvidence(null);
    setDrawerOpen(true);
  };

  const openEvidenceDrawer = (ev: TopicEvidence) => {
    setSelectedEvidence(ev);
    setSelectedTopic(null);
    setSelectedGap(null);
    setSelectedReadiness(null);
    setSelectedReviewItem(null);
    setSelectedLearningEvidence(null);
    setDrawerOpen(true);
  };

  const openReviewDrawer = (item: EvidenceReviewItem) => {
    setSelectedReviewItem(item);
    setSelectedTopic(null);
    setSelectedGap(null);
    setSelectedReadiness(null);
    setSelectedEvidence(null);
    setSelectedLearningEvidence(null);
    setDrawerOpen(true);
  };

  const openLearningDrawer = (ev: TopicLearningEvidence) => {
    setSelectedLearningEvidence(ev);
    setSelectedTopic(null);
    setSelectedGap(null);
    setSelectedReadiness(null);
    setSelectedEvidence(null);
    setSelectedReviewItem(null);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedTopic(null);
    setSelectedGap(null);
    setSelectedReadiness(null);
    setSelectedEvidence(null);
    setSelectedReviewItem(null);
    setSelectedLearningEvidence(null);
    setGateData(null);
    setAutopilotResult(null);
  };

  const handleRebuildTopic = async () => {
    if (!selectedTopic) return;
    const s = selectedTopic.specKey || specKey;
    const t = selectedTopic.topicKey || "";
    if (!s || !t) return;
    setRebuilding(true);
    setRebuildToast(null);
    try {
      await rebuildTopicGraph(s, t);
      const newData = await loadSpecCoverage();
      const updated = newData?.topics.find(
        (x) => (x.topicKey || "") === t && (x.specKey || "") === s
      );
      if (updated) setSelectedTopic(updated);
      setRebuildToast({ message: "Topic graph rebuilt successfully", type: "success" });
    } catch (err: any) {
      setRebuildToast({ message: err?.message || "Rebuild failed", type: "error" });
    } finally {
      setRebuilding(false);
    }
  };

  const handleRunTopicAutopilot = async () => {
    if (!selectedGap) return;
    const sk = selectedGap.specKey || specKey;
    const tk = resolveTopicKey(selectedGap);
    if (!sk || !tk) return;
    setAutopilotRunning(true);
    setAutopilotResult(null);
    try {
      const result = await runTopicAutopilot({
        specKey: sk,
        topicKey: tk,
        dryRun: autopilotDryRun,
        ...(selectedPromptPack && {
          promptPackId: selectedPromptPack.promptPackId,
          promptPackVersion: selectedPromptPack.promptPackVersion,
        }),
      });
      setAutopilotResult(result);
      if (!autopilotDryRun && !result.requiresReview) {
        const generated = result.executedActions?.filter((a) => a.status === "generated").length ?? 0;
        setRebuildToast({
          message: generated > 0 ? `Autopilot: ${generated} action(s) generated.` : "Autopilot completed.",
          type: "success",
        });
        await loadSpecGaps();
      }
    } catch (err: any) {
      setRebuildToast({ message: err?.response?.data?.error || err?.message || "Autopilot failed", type: "error" });
    } finally {
      setAutopilotRunning(false);
    }
  };

  const handleRunSpecAutopilot = async () => {
    setAutopilotRunning(true);
    setAutopilotResult(null);
    try {
      const result = await runSpecAutopilot({
        specKey,
        dryRun: autopilotDryRun,
        limit: 10,
        ...(selectedPromptPack && {
          promptPackId: selectedPromptPack.promptPackId,
          promptPackVersion: selectedPromptPack.promptPackVersion,
        }),
      });
      setAutopilotResult(result);
      if (!autopilotDryRun && result.summary.generated > 0) {
        setRebuildToast({
          message: `Autopilot: ${result.summary.generated} topic(s) generated content.`,
          type: "success",
        });
        await loadSpecGaps();
      }
    } catch (err: any) {
      setRebuildToast({ message: err?.response?.data?.error || err?.message || "Autopilot failed", type: "error" });
    } finally {
      setAutopilotRunning(false);
    }
  };

  const handleRebuildSpec = async () => {
    setRebuildingSpec(true);
    setRebuildToast(null);
    try {
      const result = await rebuildSpecGraph(specKey);
      setRebuildToast({
        message: `Rebuilt ${result.topicsRebuilt} topics. ${result.lessonLinksCreated} lesson links, ${result.flashcardLinksCreated} flashcard links.`,
        type: "success",
      });
      await loadSpecCoverage();
      if (viewMode === "gaps") await loadSpecGaps();
      if (viewMode === "readiness") await loadSpecReadiness();
      if (viewMode === "evidence") await loadSpecEvidence();
      if (viewMode === "review") await loadReviewWorklist();
      if (viewMode === "learning") await loadLearningEvidence();
    } catch (err: any) {
      setRebuildToast({ message: err?.message || "Rebuild failed", type: "error" });
    } finally {
      setRebuildingSpec(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Link
          to="/admin"
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
          ← Back to Admin
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Content Coverage</h1>
        <select
          value={specKey}
          onChange={(e) => setSpecKey(e.target.value)}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          {SPEC_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRebuildSpec}
          disabled={rebuildingSpec}
          style={{
            padding: "6px 12px",
            fontSize: 13,
            fontWeight: 600,
            background: rebuildingSpec ? "#e2e8f0" : "#e0f2fe",
            color: rebuildingSpec ? "#94a3b8" : "#0369a1",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            cursor: rebuildingSpec ? "not-allowed" : "pointer",
          }}
        >
          {rebuildingSpec ? "Rebuilding…" : "Rebuild Graph For Spec"}
        </button>
        {viewMode === "gaps" && (
          <>
            {promptPacks.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Prompt pack:</label>
                <select
                  value={selectedPromptPack ? `${selectedPromptPack.promptPackId}:${selectedPromptPack.promptPackVersion}` : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) {
                      const [id, ver] = v.split(":");
                      setSelectedPromptPack({ promptPackId: id, promptPackVersion: ver });
                    }
                  }}
                  style={{
                    padding: "4px 8px",
                    fontSize: 13,
                    border: "1px solid #cbd5e1",
                    borderRadius: 6,
                  }}
                >
                  {promptPacks.map((p) => (
                    <option key={`${p.promptPackId}:${p.promptPackVersion}`} value={`${p.promptPackId}:${p.promptPackVersion}`}>
                      {p.label} ({p.promptPackId} {p.promptPackVersion})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <input
                type="checkbox"
                checked={autopilotDryRun}
                onChange={(e) => setAutopilotDryRun(e.target.checked)}
              />
              Dry run (preview only)
            </label>
            <button
              type="button"
              onClick={handleRunSpecAutopilot}
              disabled={autopilotRunning}
              style={{
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 600,
                background: autopilotRunning ? "#e2e8f0" : "#dcfce7",
                color: autopilotRunning ? "#94a3b8" : "#15803d",
                border: "1px solid #bbf7d0",
                borderRadius: 6,
                cursor: autopilotRunning ? "not-allowed" : "pointer",
              }}
            >
              {autopilotRunning ? "Running…" : "Run Autopilot for Spec"}
            </button>
          </>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode("coverage")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "coverage" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "coverage" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Coverage Table
          </button>
          <button
            type="button"
            onClick={() => setViewMode("gaps")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "gaps" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "gaps" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Gap Priorities
          </button>
          <button
            type="button"
            onClick={() => setViewMode("readiness")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "readiness" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "readiness" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Autopilot Readiness
          </button>
          <button
            type="button"
            onClick={() => setViewMode("evidence")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "evidence" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "evidence" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Topic Evidence
          </button>
          <button
            type="button"
            onClick={() => setViewMode("review")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "review" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "review" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Evidence Review
          </button>
          <button
            type="button"
            onClick={() => setViewMode("learning")}
            style={{
              padding: "6px 12px",
              fontSize: 13,
              fontWeight: 600,
              background: viewMode === "learning" ? "#0369a1" : "#f1f5f9",
              color: viewMode === "learning" ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Student Learning
          </button>
        </div>
        {lastRefreshed && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </span>
        )}
        {viewMode === "coverage" && data && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {data.topics.length} topic{data.topics.length !== 1 ? "s" : ""}
          </span>
        )}
        {viewMode === "gaps" && gapsData && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {gapsData.summary.weakTopics} weak, {gapsData.summary.partialTopics} partial, {gapsData.summary.strongTopics} strong
          </span>
        )}
        {viewMode === "readiness" && readinessData && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {readinessData.summary.readyTopics} ready, {readinessData.summary.blockedTopics} blocked, {readinessData.summary.requiresReviewTopics} require review
          </span>
        )}
        {viewMode === "evidence" && evidenceData && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {evidenceData.summary.strongTopics} strong, {evidenceData.summary.mixedTopics} mixed, {evidenceData.summary.weakTopics} weak, {evidenceData.summary.unknownTopics} unknown
          </span>
        )}
        {viewMode === "review" && reviewWorklistData && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {reviewWorklistData.summary.totalItems} items ({reviewWorklistData.summary.blockedItems} blocked, {reviewWorklistData.summary.reviewRequiredItems} review required)
          </span>
        )}
        {viewMode === "learning" && learningEvidenceData && (
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {learningEvidenceData.topics.length} topics
          </span>
        )}
      </div>

      {rebuildToast && (
        <Toast
          message={rebuildToast.message}
          type={rebuildToast.type}
          onClose={() => setRebuildToast(null)}
        />
      )}
      {autopilotResult && "summary" in autopilotResult && viewMode === "gaps" && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Spec Autopilot result</div>
          <div style={{ fontSize: 13 }}>
            Processed: {(autopilotResult as AutopilotSpecResult).totalProcessed} topics. Generated:{" "}
            {(autopilotResult as AutopilotSpecResult).summary.generated}, Skipped:{" "}
            {(autopilotResult as AutopilotSpecResult).summary.skipped}
            {(autopilotResult as AutopilotSpecResult).summary.failed > 0 &&
              `, Failed: ${(autopilotResult as AutopilotSpecResult).summary.failed}`}
          </div>
          <button
            type="button"
            onClick={() => setAutopilotResult(null)}
            style={{ marginTop: 8, fontSize: 12, color: "#15803d", background: "none", border: "none", cursor: "pointer" }}
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "1rem",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            color: "#b91c1c",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#64748b" }}>
          Loading...
        </div>
      ) : viewMode === "readiness" && readinessData ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.6fr 0.8fr 1.2fr 1.5fr 2fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Ready</div>
            <div>Requires Review</div>
            <div>Available Actions</div>
            <div>Blockers</div>
            <div>Summary</div>
          </div>
          {readinessData.topics.map((r, i) => (
            <div
              key={`${r.topicKey}-${i}`}
              onClick={() => openReadinessDrawer(r)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openReadinessDrawer(r)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.6fr 0.8fr 1.2fr 1.5fr 2fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(r.topicKey || "")}</div>
              <div>
                {r.ready ? (
                  <span style={{ color: "#15803d", fontWeight: 600 }}>Yes</span>
                ) : (
                  <span style={{ color: "#64748b" }}>No</span>
                )}
              </div>
              <div>
                {r.requiresReview ? (
                  <span style={{ color: "#b91c1c", fontWeight: 600 }}>Yes</span>
                ) : (
                  <span style={{ color: "#64748b" }}>No</span>
                )}
              </div>
              <div style={{ fontSize: 12 }}>
                {(r.autopilotActionsAvailable || []).length > 0
                  ? r.autopilotActionsAvailable!.join(", ").replace(/generate_/g, "")
                  : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {(r.blockers || []).length > 0 ? r.blockers!.join("; ") : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>{r.summary || "—"}</div>
            </div>
          ))}
          {readinessData.topics.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics found for this spec.
            </div>
          )}
        </div>
      ) : viewMode === "evidence" && evidenceData ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.8fr 0.7fr 0.7fr 0.9fr 1fr 2fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Evidence Health</div>
            <div>Open Issues</div>
            <div>Revisions</div>
            <div>Approval Rate</div>
            <div>Autopilot History</div>
            <div>Summary</div>
          </div>
          {evidenceData.topics.map((ev, i) => (
            <div
              key={`${ev.topicKey}-${i}`}
              onClick={() => openEvidenceDrawer(ev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openEvidenceDrawer(ev)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.8fr 0.7fr 0.7fr 0.9fr 1fr 2fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(ev.topicKey || "")}</div>
              <div>
                <EvidenceHealthBadge health={ev.derivedMetrics?.evidenceHealth || "unknown"} />
              </div>
              <div>{ev.evidenceCounts?.lessonIssues ?? 0}</div>
              <div>{ev.evidenceCounts?.teacherRevisions ?? 0}</div>
              <div>
                {ev.derivedMetrics?.approvalRate != null
                  ? `${Math.round(ev.derivedMetrics.approvalRate)}%`
                  : "—"}
              </div>
              <div style={{ fontSize: 12 }}>
                {ev.evidenceCounts?.autopilotRuns != null && ev.evidenceCounts.autopilotRuns > 0
                  ? `${ev.evidenceCounts.autopilotRuns} run(s)`
                  : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>{ev.summary || "—"}</div>
            </div>
          ))}
          {evidenceData.topics.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics found for this spec.
            </div>
          )}
        </div>
      ) : viewMode === "review" && reviewWorklistData ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.9fr 0.8fr 0.7fr 1.5fr 2fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Gate Status</div>
            <div>Evidence Health</div>
            <div>Priority</div>
            <div>Reasons</div>
            <div>Summary</div>
          </div>
          {reviewWorklistData.items.map((item, i) => (
            <div
              key={`${item.topicKey}-${i}`}
              onClick={() => openReviewDrawer(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openReviewDrawer(item)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.9fr 0.8fr 0.7fr 1.5fr 2fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(item.topicKey || "")}</div>
              <div>
                <GateStatusBadge gateStatus={item.gateStatus} />
              </div>
              <div>
                <EvidenceHealthBadge health={item.evidenceHealth || "unknown"} />
              </div>
              <div style={{ fontWeight: 600, color: item.priorityScore >= 40 ? "#b91c1c" : "#475569" }}>
                {item.priorityScore ?? 0}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {(item.reasons || []).slice(0, 2).join("; ") || "—"}
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>{item.summary || "—"}</div>
            </div>
          ))}
          {reviewWorklistData.items.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics require review for this spec.
            </div>
          )}
        </div>
      ) : viewMode === "learning" && learningEvidenceData ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 0.8fr 0.9fr 0.9fr 1fr 1fr 1.1fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Mastery Score</div>
            <div>Quiz Accuracy</div>
            <div>Exam Accuracy</div>
            <div>Flashcard Difficulty</div>
            <div>Lesson Completions</div>
            <div>Difficulty Level</div>
          </div>
          {learningEvidenceData.topics.map((ev, i) => (
            <div
              key={`${ev.topicKey}-${i}`}
              onClick={() => openLearningDrawer(ev)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openLearningDrawer(ev)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.8fr 0.9fr 0.9fr 1fr 1fr 1.1fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(ev.topicKey || "")}</div>
              <div>{ev.derivedMetrics?.masteryScore != null ? `${ev.derivedMetrics.masteryScore}%` : "—"}</div>
              <div>{ev.quizStats?.accuracy != null ? `${ev.quizStats.accuracy}%` : "—"}</div>
              <div>{ev.examStats?.accuracy != null ? `${ev.examStats.accuracy}%` : "—"}</div>
              <div>{ev.flashcardStats?.averageDifficulty != null ? ev.flashcardStats.averageDifficulty.toFixed(1) : "—"}</div>
              <div>{ev.lessonStats?.completions ?? 0}</div>
              <div>
                <DifficultyLevelBadge level={ev.derivedMetrics?.difficultyLevel || "unknown"} />
              </div>
            </div>
          ))}
          {learningEvidenceData.topics.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No learning evidence for this spec yet.
            </div>
          )}
        </div>
      ) : viewMode === "gaps" && gapsData ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 1.2fr 1.5fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Score</div>
            <div>Status</div>
            <div>Priority</div>
            <div>Flags</div>
            <div>Recommended Action</div>
          </div>
          {gapsData.gaps.map((g, i) => (
            <div
              key={`${g.topicKey}-${i}`}
              onClick={() => openGapDrawer(g)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openGapDrawer(g)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr 1.2fr 1.5fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(g.topicKey || "")}</div>
              <div>{g.coverageScore ?? 0}</div>
              <div>
                <StatusBadge status={g.coverageStatus || "weak"} />
              </div>
              <div style={{ fontWeight: 600, color: g.priorityScore >= 40 ? "#b91c1c" : "#475569" }}>
                {g.priorityScore ?? 0}
              </div>
              <div>
                <GapFlagsBadges gapFlags={g.gapFlags} />
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>
                {g.recommendations?.[0] || "—"}
              </div>
            </div>
          ))}
          {gapsData.gaps.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics found for this spec.
            </div>
          )}
        </div>
      ) : data ? (
        <div
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            overflow: "hidden",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.9fr",
              background: "#f8fafc",
              padding: "0.75rem 1rem",
              borderBottom: "1px solid #e2e8f0",
              fontWeight: 700,
              fontSize: 13,
              gap: 8,
            }}
          >
            <div>Topic</div>
            <div>Unit</div>
            <div>Lessons</div>
            <div>Flashcards</div>
            <div>Quizzes</div>
            <div>Exam Qs</div>
            <div>Issues</div>
            <div>Score</div>
            <div>Status</div>
          </div>
          {data.topics.map((t, i) => (
            <div
              key={`${t.topicKey}-${i}`}
              onClick={() => openDrawer(t)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && openDrawer(t)}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 1fr 0.9fr",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid #e2e8f0",
                cursor: "pointer",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 500 }}>{formatTopicKey(t.topicKey || "")}</div>
              <div style={{ color: "#64748b" }}>{t.unit || "—"}</div>
              <div>{t.lessonCount ?? 0}</div>
              <div>{t.flashcardCount ?? 0}</div>
              <div>{t.quizCount ?? 0}</div>
              <div>{t.examQuestionCount ?? 0}</div>
              <div>{t.issueCount ?? 0}</div>
              <div>{t.coverageScore ?? 0}</div>
              <div>
                <StatusBadge status={t.status || "weak"} />
              </div>
            </div>
          ))}
          {data.topics.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
              No topics found for this spec.
            </div>
          )}
        </div>
      ) : null}

      {/* Gap detail drawer */}
      {drawerOpen && selectedGap && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedGap.topicKey || "")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  to={`/admin/topic/${specKey}/${(selectedGap.topicKey || "").split(":").pop() || selectedGap.topicKey}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <button
                type="button"
                onClick={closeDrawer}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#64748b",
                  lineHeight: 1,
                }}
                aria-label="Close"
              >
                ×
              </button>
              </div>
            </div>
            {selectedGap.summaryParagraph && (
              <div style={{ marginBottom: "1rem", color: "#475569", lineHeight: 1.5, fontSize: 14 }}>
                {selectedGap.summaryParagraph}
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Counts</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569" }}>
                <li>Lessons: {selectedGap.counts?.lessons ?? 0}</li>
                <li>Flashcards: {selectedGap.counts?.flashcards ?? 0}</li>
                <li>Quiz questions: {selectedGap.counts?.quizzes ?? 0}</li>
                <li>Exam questions: {selectedGap.counts?.examQuestions ?? 0}</li>
                <li>Open issues: {selectedGap.counts?.openIssues ?? 0}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Coverage</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Score: {selectedGap.coverageScore ?? 0}</span>
                <StatusBadge status={selectedGap.coverageStatus || "weak"} />
                <span style={{ fontSize: 12, color: "#64748b" }}>Priority: {selectedGap.priorityScore ?? 0}</span>
              </div>
            </div>
            {selectedGap.weakAreas && selectedGap.weakAreas.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Weak areas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedGap.weakAreas.map((w) => (
                    <span
                      key={w}
                      style={{
                        padding: "4px 10px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedGap.recommendations && selectedGap.recommendations.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommendations</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                  {selectedGap.recommendations.map((r, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {gateData && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Autopilot gate</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <GateStatusBadge gateStatus={gateData.gateStatus} />
                  <span style={{ fontSize: 13, color: "#475569" }}>{gateData.summary}</span>
                </div>
                {gateData.reasons && gateData.reasons.length > 0 && (
                  <ul style={{ margin: "0 0 6px 0", paddingLeft: "1.25rem", fontSize: 12, color: "#64748b" }}>
                    {gateData.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {gateData.allowedActions && gateData.allowedActions.length > 0 && (
                  <div style={{ fontSize: 12, color: "#15803d" }}>
                    Allowed: {gateData.allowedActions.map((a) => a.replace("generate_", "")).join(", ")}
                  </div>
                )}
                {gateData.blockedActions && gateData.blockedActions.length > 0 && gateData.gateStatus === "limited" && (
                  <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>
                    Blocked: {gateData.blockedActions.map((a) => a.replace("generate_", "")).join(", ")}
                  </div>
                )}
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Autopilot</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {promptPacks.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 500 }}>Prompt pack:</label>
                    <select
                      value={selectedPromptPack ? `${selectedPromptPack.promptPackId}:${selectedPromptPack.promptPackVersion}` : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) {
                          const [id, ver] = v.split(":");
                          setSelectedPromptPack({ promptPackId: id, promptPackVersion: ver });
                        }
                      }}
                      style={{
                        padding: "4px 8px",
                        fontSize: 13,
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        flex: 1,
                      }}
                    >
                      {promptPacks.map((p) => (
                        <option key={`${p.promptPackId}:${p.promptPackVersion}`} value={`${p.promptPackId}:${p.promptPackVersion}`}>
                          {p.label} ({p.promptPackId} {p.promptPackVersion})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={autopilotDryRun}
                    onChange={(e) => setAutopilotDryRun(e.target.checked)}
                  />
                  Dry run (preview only)
                </label>
                <button
                  type="button"
                  onClick={handleRunTopicAutopilot}
                  disabled={
                    autopilotRunning ||
                    (selectedGap.counts?.openIssues ?? 0) >= 3 ||
                    gateData?.gateStatus === "block" ||
                    gateData?.gateStatus === "review_required"
                  }
                  style={{
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    background:
                      autopilotRunning ||
                      (selectedGap.counts?.openIssues ?? 0) >= 3 ||
                      gateData?.gateStatus === "block" ||
                      gateData?.gateStatus === "review_required"
                        ? "#e2e8f0"
                        : "#dcfce7",
                    color:
                      autopilotRunning ||
                      (selectedGap.counts?.openIssues ?? 0) >= 3 ||
                      gateData?.gateStatus === "block" ||
                      gateData?.gateStatus === "review_required"
                        ? "#94a3b8"
                        : "#15803d",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    cursor:
                      autopilotRunning ||
                      (selectedGap.counts?.openIssues ?? 0) >= 3 ||
                      gateData?.gateStatus === "block" ||
                      gateData?.gateStatus === "review_required"
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {autopilotRunning ? "Running…" : "Run Autopilot"}
                </button>
                {((selectedGap.counts?.openIssues ?? 0) >= 3 ||
                  gateData?.gateStatus === "block" ||
                  gateData?.gateStatus === "review_required") && (
                  <span style={{ fontSize: 12, color: "#b91c1c" }}>
                    {gateData?.gateStatus === "block" || gateData?.gateStatus === "review_required"
                      ? gateData.reasons?.[0] || "Autopilot blocked or requires review"
                      : "Skipped due to high issue count; review content first"}
                  </span>
                )}
                {gateData?.gateStatus === "limited" && (
                  <span style={{ fontSize: 12, color: "#856404" }}>
                    Will run: {gateData.allowedActions?.map((a) => a.replace("generate_", "")).join(", ")} only
                  </span>
                )}
              </div>
            </div>
            {autopilotResult && "executedActions" in autopilotResult && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Autopilot result</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: 13 }}>
                  {autopilotResult.executedActions?.map((a, i) => (
                    <li key={i}>
                      {a.type}: {a.status}
                      {a.createdCount != null && a.createdCount > 0 && ` (${a.createdCount} created)`}
                      {a.reason && ` — ${a.reason}`}
                    </li>
                  ))}
                </ul>
                {autopilotResult.updatedCoverage && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>
                    Updated score: {autopilotResult.updatedCoverage.coverageScore ?? 0}
                  </div>
                )}
              </div>
            )}
            {selectedGap.suggestedActions && selectedGap.suggestedActions.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested actions</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedGap.suggestedActions.map((a, i) => {
                    const nav = mapSuggestedActionToNavigation(a, selectedGap);
                    const handleAction = () => {
                      if (nav.path.startsWith("/teacher/") && selectedGap.specKey) {
                        setStoredSpecKey(selectedGap.specKey as import("../api/taxonomy").SpecKey);
                      }
                      closeDrawer();
                      navigate(nav.path, nav.state ? { state: nav.state } : undefined);
                    };
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={handleAction}
                        style={{
                          padding: "8px 12px",
                          background: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          borderRadius: 6,
                          fontSize: 13,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#0369a1" }}>{a.label}</div>
                        <div style={{ color: "#475569", marginTop: 2 }}>{a.reason}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Readiness detail drawer */}
      {drawerOpen && selectedReadiness && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedReadiness.topicKey || "")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  to={`/admin/topic/${specKey}/${(selectedReadiness.topicKey || "").split(":").pop() || selectedReadiness.topicKey}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "#64748b",
                    lineHeight: 1,
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            {selectedReadiness.summary && (
              <div style={{ marginBottom: "1rem", color: "#475569", lineHeight: 1.5, fontSize: 14 }}>
                {selectedReadiness.summary}
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Counts</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569" }}>
                <li>Lessons: {selectedReadiness.counts?.lessons ?? 0}</li>
                <li>Flashcards: {selectedReadiness.counts?.flashcards ?? 0}</li>
                <li>Quiz questions: {selectedReadiness.counts?.quizzes ?? 0}</li>
                <li>Exam questions: {selectedReadiness.counts?.examQuestions ?? 0}</li>
                <li>Open issues: {selectedReadiness.counts?.openIssues ?? 0}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Readiness flags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedReadiness.readinessFlags?.hasSpecStatements && (
                  <span style={{ padding: "4px 8px", background: "#d4edda", color: "#155724", borderRadius: 6, fontSize: 12 }}>Spec statements</span>
                )}
                {selectedReadiness.readinessFlags?.lowIssues && (
                  <span style={{ padding: "4px 8px", background: "#d4edda", color: "#155724", borderRadius: 6, fontSize: 12 }}>Low issues</span>
                )}
                {selectedReadiness.readinessFlags?.hasTopicNode && (
                  <span style={{ padding: "4px 8px", background: "#d4edda", color: "#155724", borderRadius: 6, fontSize: 12 }}>Topic node</span>
                )}
                {selectedReadiness.readinessFlags?.canGenerateFlashcards && (
                  <span style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", borderRadius: 6, fontSize: 12 }}>Flashcards</span>
                )}
                {selectedReadiness.readinessFlags?.canGenerateQuiz && (
                  <span style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", borderRadius: 6, fontSize: 12 }}>Quiz</span>
                )}
                {selectedReadiness.readinessFlags?.canGenerateExamQuestions && (
                  <span style={{ padding: "4px 8px", background: "#e0f2fe", color: "#0369a1", borderRadius: 6, fontSize: 12 }}>Exam questions</span>
                )}
              </div>
            </div>
            {selectedReadiness.blockers && selectedReadiness.blockers.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Blockers</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#b91c1c", fontSize: 14 }}>
                  {selectedReadiness.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedReadiness.recommendedActions && selectedReadiness.recommendedActions.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommended actions</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                  {selectedReadiness.recommendedActions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedReadiness.autopilotActionsAvailable && selectedReadiness.autopilotActionsAvailable.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Available autopilot actions</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedReadiness.autopilotActionsAvailable.map((a) => (
                    <span
                      key={a}
                      style={{
                        padding: "4px 10px",
                        background: "#dcfce7",
                        color: "#15803d",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      {a.replace(/generate_/g, "")}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {gateData && (
              <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Autopilot gate</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GateStatusBadge gateStatus={gateData.gateStatus} />
                  <span style={{ fontSize: 13, color: "#475569" }}>{gateData.summary}</span>
                </div>
                {gateData.allowedActions && gateData.allowedActions.length > 0 && (
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>Allowed: {gateData.allowedActions.map((a) => a.replace("generate_", "")).join(", ")}</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Topic detail drawer */}
      {drawerOpen && selectedTopic && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(400px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedTopic.topicKey || "")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  to={`/admin/topic/${specKey}/${(selectedTopic.topicKey || "").split(":").pop() || selectedTopic.topicKey}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "#64748b",
                    lineHeight: 1,
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Unit</div>
              <div style={{ color: "#475569" }}>{selectedTopic.unit || "—"}</div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Linked content</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569" }}>
                <li>Lessons: {selectedTopic.lessonCount ?? 0}</li>
                <li>Flashcards: {selectedTopic.flashcardCount ?? 0}</li>
                <li>Quiz questions: {selectedTopic.quizCount ?? 0}</li>
                <li>Exam questions: {selectedTopic.examQuestionCount ?? 0}</li>
                <li>Open issues: {selectedTopic.issueCount ?? 0}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Coverage</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>Score: {selectedTopic.coverageScore ?? 0}</span>
                <StatusBadge status={selectedTopic.status || "weak"} />
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <button
                type="button"
                onClick={() => handleRebuildTopic()}
                disabled={rebuilding}
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  background: rebuilding ? "#e2e8f0" : "#e0f2fe",
                  color: rebuilding ? "#94a3b8" : "#0369a1",
                  border: "1px solid #bae6fd",
                  borderRadius: 6,
                  cursor: rebuilding ? "not-allowed" : "pointer",
                }}
              >
                {rebuilding ? "Rebuilding…" : "Rebuild Topic Graph"}
              </button>
            </div>
            {selectedTopic.weakAreas && selectedTopic.weakAreas.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Weak areas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedTopic.weakAreas.map((w) => (
                    <span
                      key={w}
                      style={{
                        padding: "4px 10px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    >
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Evidence detail drawer */}
      {drawerOpen && selectedEvidence && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedEvidence.topicKey || "")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  to={`/admin/topic/${selectedEvidence.specKey || specKey}/${(selectedEvidence.topicKey || "").split(":").pop() || selectedEvidence.topicKey}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "#64748b",
                    lineHeight: 1,
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Evidence health</div>
              <EvidenceHealthBadge health={selectedEvidence.derivedMetrics?.evidenceHealth || "unknown"} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Evidence counts</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Lesson issues: {selectedEvidence.evidenceCounts?.lessonIssues ?? 0}</li>
                <li>Teacher revisions: {selectedEvidence.evidenceCounts?.teacherRevisions ?? 0}</li>
                <li>Autopilot runs: {selectedEvidence.evidenceCounts?.autopilotRuns ?? 0}</li>
                <li>Autopilot approvals: {selectedEvidence.evidenceCounts?.autopilotApprovals ?? 0}</li>
                <li>Autopilot rejections: {selectedEvidence.evidenceCounts?.autopilotRejections ?? 0}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Evidence signals</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selectedEvidence.evidenceSignals?.hasOpenIssues && (
                  <span style={{ padding: "4px 8px", background: "#fef3c7", color: "#92400e", borderRadius: 6, fontSize: 12 }}>Open issues</span>
                ))}
                {(selectedEvidence.evidenceSignals?.hasHighIssueVolume && (
                  <span style={{ padding: "4px 8px", background: "#fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>High issue volume</span>
                ))}
                {(selectedEvidence.evidenceSignals?.hasTeacherRevisionActivity && (
                  <span style={{ padding: "4px 8px", background: "#dbeafe", color: "#1d4ed8", borderRadius: 6, fontSize: 12 }}>Teacher revisions</span>
                ))}
                {(selectedEvidence.evidenceSignals?.hasAutopilotHistory && (
                  <span style={{ padding: "4px 8px", background: "#dcfce7", color: "#15803d", borderRadius: 6, fontSize: 12 }}>Autopilot history</span>
                ))}
                {(selectedEvidence.evidenceSignals?.hasLowApprovalRate && (
                  <span style={{ padding: "4px 8px", background: "#fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12 }}>Low approval rate</span>
                ))}
                {(!selectedEvidence.evidenceSignals?.hasOpenIssues &&
                  !selectedEvidence.evidenceSignals?.hasHighIssueVolume &&
                  !selectedEvidence.evidenceSignals?.hasTeacherRevisionActivity &&
                  !selectedEvidence.evidenceSignals?.hasAutopilotHistory &&
                  !selectedEvidence.evidenceSignals?.hasLowApprovalRate) && (
                  <span style={{ color: "#64748b", fontSize: 12 }}>No notable signals</span>
                )}
              </div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Derived metrics</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Approval rate: {selectedEvidence.derivedMetrics?.approvalRate != null ? `${Math.round(selectedEvidence.derivedMetrics.approvalRate)}%` : "—"}</li>
                <li>Issue rate level: {selectedEvidence.derivedMetrics?.issueRateLevel || "—"}</li>
              </ul>
            </div>
            {selectedEvidence.blockers && selectedEvidence.blockers.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Blockers</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#b91c1c", fontSize: 14 }}>
                  {selectedEvidence.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            {selectedEvidence.recommendations && selectedEvidence.recommendations.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommendations</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                  {selectedEvidence.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {gateData && (
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Autopilot gate</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GateStatusBadge gateStatus={gateData.gateStatus} />
                  <span style={{ fontSize: 13, color: "#475569" }}>{gateData.summary}</span>
                </div>
                {gateData.allowedActions && gateData.allowedActions.length > 0 && (
                  <div style={{ fontSize: 12, color: "#15803d", marginTop: 4 }}>Allowed: {gateData.allowedActions.map((a) => a.replace("generate_", "")).join(", ")}</div>
                )}
                {gateData.blockedActions && gateData.blockedActions.length > 0 && gateData.gateStatus === "limited" && (
                  <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>Blocked: {gateData.blockedActions.map((a) => a.replace("generate_", "")).join(", ")}</div>
                )}
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Summary</div>
              <div style={{ color: "#475569", fontSize: 14 }}>{selectedEvidence.summary || "—"}</div>
            </div>
          </div>
        </>
      )}

      {/* Evidence Review detail drawer */}
      {drawerOpen && selectedReviewItem && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedReviewItem.topicKey || "")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  to={`/admin/topic/${selectedReviewItem.specKey || specKey}/${(selectedReviewItem.topicKey || "").split(":").pop() || selectedReviewItem.topicKey}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "#64748b",
                    lineHeight: 1,
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <GateStatusBadge gateStatus={selectedReviewItem.gateStatus} />
              <EvidenceHealthBadge health={selectedReviewItem.evidenceHealth || "unknown"} />
              <span style={{ fontWeight: 600, color: "#475569" }}>Priority: {selectedReviewItem.priorityScore ?? 0}</span>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Evidence summary</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Open issues: {selectedReviewItem.evidenceSummary?.openIssues ?? 0}</li>
                <li>Teacher revisions: {selectedReviewItem.evidenceSummary?.teacherRevisions ?? 0}</li>
                <li>Approval rate: {selectedReviewItem.evidenceSummary?.approvalRate != null ? `${Math.round(selectedReviewItem.evidenceSummary.approvalRate)}%` : "—"}</li>
                <li>Autopilot runs: {selectedReviewItem.evidenceSummary?.autopilotRuns ?? 0}</li>
                <li>Autopilot rejections: {selectedReviewItem.evidenceSummary?.autopilotRejections ?? 0}</li>
              </ul>
            </div>
            {selectedReviewItem.reasons && selectedReviewItem.reasons.length > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Reasons</div>
                <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                  {selectedReviewItem.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Summary</div>
              <div style={{ color: "#475569", fontSize: 14 }}>{selectedReviewItem.summary || "—"}</div>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Recommended actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedReviewItem.recommendedActions?.map((a, i) => {
                  const nav = mapReviewActionToNavigation(a.type, selectedReviewItem);
                  const handleAction = () => {
                    if (a.type === "rebuild_graph") {
                      rebuildTopicGraph(selectedReviewItem.specKey, selectedReviewItem.topicKey)
                        .then(() => {
                          setRebuildToast({ message: "Topic graph rebuilt", type: "success" });
                          loadReviewWorklist();
                          closeDrawer();
                        })
                        .catch((err: any) => {
                          setRebuildToast({ message: err?.message || "Rebuild failed", type: "error" });
                        });
                    } else {
                      closeDrawer();
                      navigate(nav.path, nav.state ? { state: nav.state } : undefined);
                    }
                  };
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={handleAction}
                      style={{
                        padding: "8px 12px",
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        borderRadius: 6,
                        fontSize: 13,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#0369a1" }}>{a.label}</div>
                      <div style={{ color: "#475569", marginTop: 2 }}>{a.reason}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Student Learning detail drawer */}
      {drawerOpen && selectedLearningEvidence && (
        <>
          <div
            role="presentation"
            onClick={closeDrawer}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.3)",
              zIndex: 1000,
            }}
          />
          <div
            style={{
              position: "fixed",
              right: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "white",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 1001,
              overflow: "auto",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                {formatTopicKey(selectedLearningEvidence.topicKey || "")}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Link
                  to={`/admin/topic/${selectedLearningEvidence.specKey || specKey}/${(selectedLearningEvidence.topicKey || "").split(":").pop() || selectedLearningEvidence.topicKey}`}
                  style={{
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 600,
                    background: "#e0f2fe",
                    color: "#0369a1",
                    borderRadius: 6,
                    textDecoration: "none",
                  }}
                >
                  Command Center
                </Link>
                <button
                  type="button"
                  onClick={closeDrawer}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 24,
                    cursor: "pointer",
                    color: "#64748b",
                    lineHeight: 1,
                  }}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#475569" }}>
                Mastery: {selectedLearningEvidence.derivedMetrics?.masteryScore != null ? `${selectedLearningEvidence.derivedMetrics.masteryScore}%` : "—"}
              </span>
              <DifficultyLevelBadge level={selectedLearningEvidence.derivedMetrics?.difficultyLevel || "unknown"} />
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Quiz stats</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Attempts: {selectedLearningEvidence.quizStats?.attempts ?? 0}</li>
                <li>Correct: {selectedLearningEvidence.quizStats?.correct ?? 0}</li>
                <li>Accuracy: {selectedLearningEvidence.quizStats?.accuracy != null ? `${selectedLearningEvidence.quizStats.accuracy}%` : "—"}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Exam stats</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Attempts: {selectedLearningEvidence.examStats?.attempts ?? 0}</li>
                <li>Correct: {selectedLearningEvidence.examStats?.correct ?? 0}</li>
                <li>Accuracy: {selectedLearningEvidence.examStats?.accuracy != null ? `${selectedLearningEvidence.examStats.accuracy}%` : "—"}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Flashcard stats</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Reviews: {selectedLearningEvidence.flashcardStats?.reviews ?? 0}</li>
                <li>Average difficulty: {selectedLearningEvidence.flashcardStats?.averageDifficulty != null ? selectedLearningEvidence.flashcardStats.averageDifficulty.toFixed(1) : "—"}</li>
              </ul>
            </div>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Lesson stats</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", fontSize: 14 }}>
                <li>Completions: {selectedLearningEvidence.lessonStats?.completions ?? 0}</li>
                <li>Average time spent: {selectedLearningEvidence.lessonStats?.averageTimeSpent != null ? `${selectedLearningEvidence.lessonStats.averageTimeSpent}s` : "—"}</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ContentCoveragePage;
