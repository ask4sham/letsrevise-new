import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { createWorksheet } from "../api/worksheets";
import { getTeacherOverview, type TeacherOverview } from "../api/teacherOverview";
import { getQuestionAnalytics, type QuestionAnalyticsItem } from "../api/teacherAnalytics";
import { SpecSelector } from "../components/SpecSelector";
import { getStoredSpecKey, setStoredSpecKey } from "../utils/specKey";
import { useTaxonomy } from "../hooks/useTaxonomy";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCreateLessonTaxonomyOptions } from "../hooks/useCreateLessonTaxonomyOptions";
import { CreateLessonTopicSelectors, type TopicSelectionValue } from "../components/TopicSelectors/CreateLessonTopicSelectors";
import { ExistingLessonsPanel } from "../components/ExistingLessonsPanel";
import type { SpecKey } from "../api/taxonomy";
import {
  formatPublishWithQualityWarningsMessage,
  type PublishWarningSummary,
} from "../utils/formatPublishWarningMessage";

/** PR7: readiness from backend (computed) */
type ReadinessSignals = {
  missing?: string[];
  checkpointCount?: number;
  diagramCount?: number;
  practiceCount?: number;
  isReviewed?: boolean;
};

type LessonRow = {
  _id: string;
  id?: string;
  title: string;
  subject: string;
  level: string;
  topic?: string;
  board?: string;
  examBoard?: string;
  tier?: string;
  purchaseCount?: number;
  totalEarnings?: number;
  averageRating?: number;
  views?: number;
  isPublished: boolean;
  createdAt: string;
  /** PR7: computed readiness (included in teacher list) */
  readiness?: {
    status: "DRAFT" | "NEEDS_REVIEW" | "READY";
    score?: number;
    signals?: ReadinessSignals;
  };
  /** PR19 Quick setup: count practice attached */
  examQuestions?: unknown[];
  /** PR19 Quick setup: mark lessons reviewed */
  reviewedAt?: string | null;
  /** Phase 2: draft lesson is a priority candidate for manual curriculum AI (server-ranked). */
  recommendedForCurriculumCheck?: boolean;
  /** Phase 3: student practice signals suggest reviewing curriculum (manual AI only). */
  needsCurriculumReview?: boolean;
};

/** PR4: topicKey -> taxonomy metadata from AQA GCSE Biology */
type TaxonomyTopicInfo = { topic: string; unit: string; requiredPractical: boolean };

/** PR5/PR6: unit with topics for filters, coverage, and generate */
type TaxonomyUnit = {
  unit: string;
  topics: Array<{ topic: string; key: string; requiredPractical?: boolean; tier?: string[] }>;
};

/** Normalize display topic to taxonomy key (match backend topicToKey). */
function topicToKey(topic: string | undefined): string {
  if (!topic || typeof topic !== "string") return "";
  return topic
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Exam boards for AI modal dropdown (from bank). */
const EXAM_BOARDS = ["", "AQA", "OCR", "Edexcel", "WJEC"] as const;

/** Append chip/preset text to instructions with clean formatting: no duplicates, period-separated. */
function appendInstructionClean(current: string, toAdd: string): string {
  const trim = (s: string) => s.replace(/\.+$/, "").trim();
  const segments = (trim(current) || "")
    .split(/\.\s+/)
    .map((s) => trim(s))
    .filter(Boolean);
  const addSegments = trim(toAdd)
    .split(/\.\s+/)
    .map((s) => trim(s))
    .filter(Boolean);
  const seen = new Set(segments.map((s) => s.toLowerCase()));
  for (const s of addSegments) {
    if (s && !seen.has(s.toLowerCase())) {
      seen.add(s.toLowerCase());
      segments.push(s);
    }
  }
  return segments.join(". ").replace(/\s*$/, "") + (segments.length ? "" : "");
}

/** Preset instruction texts for combined presets. */
const AI_PRESETS = {
  "Exam-ready lesson":
    "Exam-focused. Include misconceptions. Add exam-style questions with mark-scheme answers. Keep strictly in spec.",
  "Foundation-friendly":
    "Use simpler language. Keep explanations short and clear. Avoid unnecessary complexity. Stay strictly within foundation-level GCSE expectations.",
  "High-grade (7–9) depth":
    "Include deeper knowledge, stronger explanations, comparisons, and evaluation where relevant. Target high-grade GCSE answers while staying in spec.",
} as const;

/** Map AI form (subject, level, board, tier) to taxonomy specKey for topic dropdown. Only AQA specs have taxonomy endpoints. */
function getSpecKeyForAiForm(
  subject: string,
  level: string,
  board: string,
  tier: string
): SpecKey | null {
  if (board !== "AQA") return null;
  if (level !== "GCSE") return null;
  const sub = (subject || "").trim().toLowerCase();
  if (sub === "biology") return "aqa-gcse-biology";
  if (sub === "chemistry") return "aqa-gcse-chemistry";
  if (sub === "physics") return "aqa-gcse-physics";
  if (sub === "mathematics" || sub === "maths") {
    const t = (tier || "").trim().toLowerCase();
    if (t === "foundation") return "aqa-gcse-maths-foundation";
    if (t === "higher") return "aqa-gcse-maths-higher";
    return "aqa-gcse-maths-higher";
  }
  if (sub === "english") return "aqa-gcse-english-language";
  return null;
}

const CountBadge: React.FC<{ n: number }> = ({ n }) => {
  if (!n || n <= 0) return null;
  return (
    <span style={{ marginLeft: 8, padding: "2px 8px", borderRadius: 999, fontSize: "0.75rem", fontWeight: 700, background: "#111827", color: "white" }}>
      {n}
    </span>
  );
};

const TeacherDashboard: React.FC = () => {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [stats, setStats] = useState({
    totalLessons: 0,
    publishedLessons: 0,
    draftLessons: 0,
    totalEarnings: 0,
    totalPurchases: 0,
    averageRating: 0,
    monthlyEarnings: [] as any[],
  });
  const [loading, setLoading] = useState(true);
  const { user, refresh } = useCurrentUser({ watchLocation: true });

  // ✅ AI modal state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiForm, setAiForm] = useState({
    subject: "Biology",
    level: "GCSE",
    topic: "",
    topicKey: "",
    board: "", // ✅ optional by default
    tier: "higher",
    autoGenerateFromBanks: true,
    additionalInstructions: "",
    strictSpec: false,
    useLessonGeneratorV2: false,
    useLessonGeneratorV3: false,
    useLessonGeneratorV4: false,
    forceComparisonTable: false,
    forceExamQuestion: false,
    forceDiagramSuggestion: false,
  });
  const [aiTopicSelection, setAiTopicSelection] = useState<TopicSelectionValue>({
    subject: "Biology",
    specKey: "",
    mainTopicTitle: "",
    topicKey: "",
    topic: "",
  });
  const { options: aiTaxonomyOptions, loading: aiTaxonomyLoading, error: aiTaxonomyError } = useCreateLessonTaxonomyOptions();

  // Lock body scroll when AI modal is open
  useEffect(() => {
    if (aiOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [aiOpen]);

  // ✅ Teacher checklist modal
  const [checklistOpen, setChecklistOpen] = useState(false);

  // showStartHere kept for compatibility (Start here banner removed; state unused)
  const [showStartHere, setShowStartHere] = useState(false);
  // PR-UX-DASH-INNOV-2: Today's interaction - show all recent or top 5
  const [showAllRecent, setShowAllRecent] = useState(false);
  // PR — Recent activity collapsible: collapsed by default; expand when urgent activity exists
  const [recentExpanded, setRecentExpanded] = useState(false);

  // PR-CHEM-2: Subject/spec selector (Biology vs Chemistry)
  const [specKey, setSpecKey] = useState<SpecKey>(getStoredSpecKey);
  const { data: taxonomyData } = useTaxonomy(specKey);

  // PR4/PR5: taxonomy map and units derived from selected spec
  const { taxonomyMap, taxonomyUnits } = useMemo(() => {
    const units = Array.isArray(taxonomyData?.units) ? taxonomyData.units : [];
    const map: Record<string, TaxonomyTopicInfo> = {};
    for (const u of units) {
      const unitName = u?.unit ?? "";
      const topics = Array.isArray(u?.topics) ? u.topics : [];
      for (const t of topics) {
        const key = t?.key ?? topicToKey(t?.topic);
        if (key) {
          map[key] = {
            topic: t?.topic ?? "",
            unit: unitName,
            requiredPractical: !!t?.requiredPractical,
          };
        }
      }
    }
    const taxonomyUnitsMapped: TaxonomyUnit[] = units.map((u: any) => ({
      unit: u?.unit ?? "",
      topics: (Array.isArray(u?.topics) ? u.topics : []).map((t: any) => ({
        topic: t?.topic ?? "",
        key: t?.key ?? topicToKey(t?.topic),
        requiredPractical: !!t?.requiredPractical,
        tier: Array.isArray(t?.tier) ? t.tier : [],
      })),
    }));
    return { taxonomyMap: map, taxonomyUnits: taxonomyUnitsMapped };
  }, [taxonomyData]);

  // PR5: Collapsible "Topics not yet covered"
  const [showUncoveredTopics, setShowUncoveredTopics] = useState(false);

  // PR6: Generate missing topic
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [generateErrors, setGenerateErrors] = useState<Record<string, string>>({});
  const [topicTierChoice, setTopicTierChoice] = useState<Record<string, "foundation" | "higher">>({});

  // PR-W2: Create worksheet then navigate to builder
  const [creatingWorksheet, setCreatingWorksheet] = useState(false);

  // PR-EDGE-3: Teacher overview (needs marking, awaiting release, due soon)
  const [overview, setOverview] = useState<TeacherOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  // PR-EDGE-5: Questions causing difficulty
  const [questionAnalytics, setQuestionAnalytics] = useState<QuestionAnalyticsItem[]>([]);

  const navigate = useNavigate();


  // PR5: Coverage (published lessons only)
  const coverage = useMemo(() => {
    const coveredTopicKeys = new Set(
      lessons.filter((l) => l.isPublished).map((l) => topicToKey(l.topic))
    );
    const allTopics = taxonomyUnits.flatMap((u) =>
      u.topics.map((t) => ({ ...t, unit: u.unit }))
    );
    const totalCount = allTopics.length;
    const coveredCount = allTopics.filter((t) => coveredTopicKeys.has(t.key)).length;
    const requiredPracticals = allTopics.filter((t) => t.requiredPractical);
    const coveredRPs = requiredPracticals.filter((t) => coveredTopicKeys.has(t.key)).length;
    const uncoveredTopics = allTopics.filter((t) => !coveredTopicKeys.has(t.key));
    return {
      coveredTopicKeys,
      allTopics,
      coveredCount,
      totalCount,
      requiredPracticals,
      coveredRPs,
      rpTotal: requiredPracticals.length,
      uncoveredTopics,
    };
  }, [lessons, taxonomyUnits]);

  // PR — Recent: auto-expand when urgent activity exists (once per session)
  const hasAutoExpandedRecentRef = useRef(false);
  useEffect(() => {
    if (!overview || hasAutoExpandedRecentRef.current) return;
    const hasUrgent =
      (overview.needsMarking?.worksheets?.count ?? 0) > 0 ||
      (overview.awaitingRelease?.worksheets?.count ?? 0) > 0 ||
      (overview.awaitingRelease?.quizzes?.count ?? 0) > 0 ||
      (overview.awaitingRelease?.assessments?.count ?? 0) > 0 ||
      (overview.dueSoon?.worksheets?.count ?? 0) > 0 ||
      (overview.dueSoon?.quizzes?.count ?? 0) > 0 ||
      (overview.dueSoon?.assessments?.count ?? 0) > 0 ||
      (overview.quizSubmissionsToday ?? 0) > 0 ||
      (overview.lowScoreCount ?? 0) > 0 ||
      (overview.awaitingReleaseTotal ?? 0) > 0;
    if (hasUrgent && overview.recentActivity && overview.recentActivity.length > 0) {
      hasAutoExpandedRecentRef.current = true;
      setRecentExpanded(true);
    }
  }, [overview]);

  useEffect(() => {
    const init = async () => {
      try {
        // 1) User from useCurrentUser hook (no localStorage read here)
        // 2) Load lessons from BACKEND (Mongo) — includes drafts
        await fetchLessonsFromBackend();

        // 3) Load teacher stats (earnings, purchases, etc.) from BACKEND
        await fetchTeacherStatsFromBackend();

        // 3b) PR-EDGE-3: Load teacher overview (needs marking, awaiting release, etc.)
        setOverviewLoading(true);
        setOverviewError(null);
        try {
          const ov = await getTeacherOverview();
          setOverview(ov);
        } catch {
          setOverview(null);
          setOverviewError("Could not load overview");
        } finally {
          setOverviewLoading(false);
        }

        // 3c) PR-EDGE-5: Load question analytics (questions causing difficulty)
        try {
          const analytics = await getQuestionAnalytics("cell-structure", 30);
          const difficult = (analytics.items || []).filter((q) => q.percentCorrect != null && q.attempts >= 3).slice(0, 5);
          setQuestionAnalytics(difficult);
        } catch {
          setQuestionAnalytics([]);
        }
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLessonsFromBackend = async () => {
    try {
      const res = await api.get("/lessons/teacher");
      const data = res?.data;

      const rawLessons: any[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.lessons)
        ? data.lessons
        : [];

      const mapped: LessonRow[] = rawLessons.map((l: any) => ({
        _id: String(l._id || l.id),
        id: String(l._id || l.id),

        title: l.title ?? "Untitled Lesson",
        subject: l.subject ?? "Not set",
        level: l.level ?? "Not set",
        topic: l.topic ?? undefined,
        board: l.board ?? undefined,
        examBoard: l.examBoard ?? l.board ?? undefined,
        tier: l.tier ?? undefined,

        purchaseCount: l.purchaseCount ?? 0,
        totalEarnings: l.totalEarnings ?? 0,
        averageRating: l.averageRating ?? 0,
        views: l.views ?? 0,

        isPublished: Boolean(l.isPublished),

        createdAt: l.createdAt ?? l.created_at ?? new Date().toISOString(),

        readiness: l.readiness ?? undefined,
        examQuestions: l.examQuestions,
        reviewedAt: l.reviewedAt,
      }));

      setLessons(mapped);

      const totalLessons = mapped.length;
      const publishedLessons = mapped.filter((x) => x.isPublished).length;
      const draftLessons = totalLessons - publishedLessons;

      setStats((prev) => ({
        ...prev,
        totalLessons,
        publishedLessons,
        draftLessons,
      }));
    } catch (err: any) {
      console.error("Error fetching lessons from backend:", err);

      setLessons([]);
      setStats((prev) => ({
        ...prev,
        totalLessons: 0,
        publishedLessons: 0,
        draftLessons: 0,
      }));
    }
  };

  const onSpecChange = (v: SpecKey) => {
    setSpecKey(v);
    setStoredSpecKey(v);
  };

  // PR6: Generate draft lesson for an uncovered topic
  const handleGenerateForTopic = async (topicKey: string, tier: "foundation" | "higher") => {
    const rowKey = topicKey;
    setGenerateErrors((prev) => ({ ...prev, [rowKey]: "" }));
    setGeneratingKey(rowKey);
    try {
      const res = await api.post("/ai/lesson-factory/aqa-gcse-biology", {
        topicKey,
        tier,
        length: "standard",
      });
      const lessonId = res?.data?.lessonId;
      if (lessonId) {
        navigate(`/edit-lesson/${lessonId}`);
        return;
      }
      setGenerateErrors((prev) => ({ ...prev, [rowKey]: "Failed to generate lesson. Please try again." }));
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        (typeof err?.response?.data?.details === "string" ? err.response.data.details : null) ||
        "Failed to generate lesson. Please try again.";
      setGenerateErrors((prev) => ({ ...prev, [rowKey]: msg }));
    } finally {
      setGeneratingKey(null);
    }
  };

  const fetchTeacherStatsFromBackend = async () => {
    try {
      const response = await api.get("/lessons/teacher/stats");

      const statsData = response?.data || {};

      setStats((prev) => ({
        ...prev,
        totalEarnings:
          statsData.totalEarnings !== undefined && statsData.totalEarnings !== null
            ? statsData.totalEarnings
            : prev.totalEarnings,
        totalPurchases:
          statsData.totalPurchases !== undefined && statsData.totalPurchases !== null
            ? statsData.totalPurchases
            : prev.totalPurchases,
        averageRating:
          statsData.averageRating !== undefined && statsData.averageRating !== null
            ? statsData.averageRating
            : prev.averageRating,
        monthlyEarnings: Array.isArray(statsData.monthlyEarnings)
          ? statsData.monthlyEarnings
          : prev.monthlyEarnings,
      }));
    } catch (err) {
      console.error("Error fetching teacher stats:", err);
    }
  };

  const handlePublishToggle = async (lessonId: string, isCurrentlyPublished: boolean) => {
    try {
      const next = !isCurrentlyPublished;

      const pubRes = await api.patch(`/lessons/${lessonId}/publish`, { isPublished: next });
      const pubData = pubRes.data as {
        publishedWithWarnings?: boolean;
        publishWarningSummary?: PublishWarningSummary;
        /** @deprecated legacy flat list */
        publishWarnings?: string[];
      };
      if (next && pubData?.publishedWithWarnings && pubData?.publishWarningSummary) {
        alert(formatPublishWithQualityWarningsMessage(pubData.publishWarningSummary));
      } else if (
        next &&
        pubData?.publishedWithWarnings &&
        Array.isArray(pubData.publishWarnings) &&
        pubData.publishWarnings.length > 0
      ) {
        alert(
          `Lesson published successfully, with quality warnings.\n\n${pubData.publishWarnings.map((w) => `• ${w}`).join("\n")}`
        );
      } else {
        alert(next ? "Lesson published successfully!" : "Lesson unpublished successfully!");
      }

      await fetchLessonsFromBackend();
      await fetchTeacherStatsFromBackend();
    } catch (err: any) {
      console.error("Publish toggle error:", err);

      const status = err?.status || err?.response?.status;
      if (status === 404) {
        alert(
          "Publish is not wired yet on the backend. Next step: add PATCH /api/lessons/:id/publish."
        );
        return;
      }

      const data = err?.data || err?.response?.data;
      const base = err?.message || data?.error || data?.msg || "Failed to update lesson status";
      const struct = data?.structureIssues;
      if (Array.isArray(struct) && struct.length > 0) {
        alert(`${base}\n\n${struct.map((s: string) => `• ${s}`).join("\n")}`);
        return;
      }
      const top = data?.topIssues;
      if (Array.isArray(top) && top.length > 0) {
        alert(`${base}\n\n${top.slice(0, 12).map((s: string) => `• ${s}`).join("\n")}`);
        return;
      }
      alert(base);
    }
  };

  const handleCashOut = async () => {
    if (stats.totalEarnings <= 0) {
      alert("You have no earnings to cash out!");
      return;
    }

    if (!window.confirm(`Do you want to cash out ${stats.totalEarnings} in earnings?`)) {
      return;
    }

    try {
      const response = await api.post("/earnings/cashout", {
        amount: stats.totalEarnings,
      });

      alert(
        `Success! ${response.data.message}\nNew Balance: ${response.data.newBalance} coins\nRemaining Earnings: ${response.data.remainingEarnings} coins`
      );

      refresh();

      await fetchTeacherStatsFromBackend();
    } catch (err: any) {
      console.error("Cash out failed:", err);
      alert(err?.data?.message || err?.message || "Cash out failed.");
    }
  };

  const handleViewAnalytics = () => {
    navigate("/analysis");
  };

  const openAiModal = () => {
    setAiError("");
    setAiOpen(true);
  };

  const handleCreateWorksheet = async () => {
    setCreatingWorksheet(true);
    try {
      const worksheet = await createWorksheet({});
      navigate(`/teacher/worksheets/${worksheet._id}/edit`);
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to create worksheet");
    } finally {
      setCreatingWorksheet(false);
    }
  };

  const handleAiTopicSelectionChange = (value: TopicSelectionValue) => {
    setAiTopicSelection(value);
    setAiError("");
    setAiForm((p) => ({
      ...p,
      subject: value.subject,
      topic: value.topic,
      topicKey: value.topicKey,
    }));
  };

  // ✅ AI Generate handler (calls backend and opens edit page)
  const handleAIGenerate = async () => {
    const topic = (aiForm.topic || "").trim();
    const topicKey = (aiForm.topicKey || "").trim();
    if (!topic && !topicKey) {
      setAiError("Please select a sub-topic or enter Topic (display).");
      return;
    }

    setAiError("");
    setAiLoading(true);
    try {
      let instr = (aiForm.additionalInstructions || "").trim();
      if (aiForm.forceComparisonTable) instr = appendInstructionClean(instr, "Add comparison table");
      if (aiForm.forceExamQuestion) instr = appendInstructionClean(instr, "Include a real exam question with mark scheme");
      if (aiForm.forceDiagramSuggestion) instr = appendInstructionClean(instr, "Include diagram suggestion or placeholder");

      const payload: Record<string, unknown> = {
        subject: (aiForm.subject || "").trim(),
        level: (aiForm.level || "").trim(),
        topic: topic || aiTopicSelection.mainTopicTitle || "",
        board: (aiForm.board || "").trim(),
        tier: aiForm.level === "GCSE" ? (aiForm.tier || "").trim() : "",
        autoGenerateFromBanks: aiForm.autoGenerateFromBanks === true,
        strictSpec: aiForm.strictSpec === true,
        useLessonGeneratorV2: aiForm.useLessonGeneratorV2 === true,
        useLessonGeneratorV3: aiForm.useLessonGeneratorV3 === true,
        useLessonGeneratorV4: aiForm.useLessonGeneratorV4 === true,
      };
      if (topicKey) payload.topicKey = topicKey;
      if (instr) payload.additionalInstructions = instr;

      if (process.env.NODE_ENV !== "production") {
        console.log("[GenerateLessonMaterials] request payload", payload);
      }

      // Backend may run two OpenAI Responses calls (draft + second pass); allow long structured JSON latency.
      const res = await api.post("/ai/generate-and-save", payload, { timeout: 600000 });
      const lessonId = res?.data?.lessonId;

      if (!lessonId) {
        setAiError("AI saved a draft, but no lessonId returned.");
        return;
      }

      setAiOpen(false);

      // Refresh list so it appears immediately
      await fetchLessonsFromBackend();
      await fetchTeacherStatsFromBackend();

      const warning = res?.data?.warning;
      // Go straight to edit (pass warning so EditLessonPage can show it)
      navigate(`/edit-lesson/${lessonId}`, warning ? { state: { generationWarning: warning } } : undefined);
    } catch (err: any) {
      console.error("AI generate-and-save failed:", err);
      // Support both axios error (err.response.data) and api interceptor (err.data)
      const data = err?.response?.data ?? err?.data;
      const msg =
        (typeof data?.details === "string" ? data.details : null) ||
        (typeof data?.error === "string" ? data.error : null) ||
        (typeof data?.message === "string" ? data.message : null) ||
        err?.message ||
        "AI generation failed. Please try again.";
      const status = err?.response?.status ?? err?.status;
      const display = status === 422
        ? `${msg}${data?.code ? ` (${data.code})` : ""}`
        : msg;
      setAiError(display);
    } finally {
      setAiLoading(false);
    }
  };

  // ✅ Checklist handlers
  const openChecklist = () => setChecklistOpen(true);
  const closeChecklist = () => setChecklistOpen(false);

  const handleCopyGoldStandardLesson = async () => {
    // ✅ Safe placeholder: tries an endpoint if you add it later; otherwise shows a clear message.
    // Recommended backend later: POST /lessons/clone-gold  -> { lessonId }
    try {
      const res = await api.post("/lessons/clone-gold", {});
      const lessonId = res?.data?.lessonId;

      if (!lessonId) {
        alert("Gold template clone did not return a lessonId.");
        return;
      }

      // Go straight to edit cloned draft
      navigate(`/edit-lesson/${lessonId}`);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        alert(
          "Copy gold-standard lesson is not wired yet.\n\nDev task: create POST /api/lessons/clone-gold to clone the reference lesson and return { lessonId }."
        );
        return;
      }

      alert(err?.response?.data?.error || err?.message || "Could not copy the gold-standard lesson.");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

  const aiTopicOk = Boolean((aiForm.topic || "").trim() || (aiForm.topicKey || "").trim());

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%)",
        padding: "20px",
      }}
    >
      {/* PR-UX-DASH-TEACH-2: 3-column layout — left Content stack | middle main | right Tools+Stats */}
      <div
        className="teacher-dashboard-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "260px minmax(0, 1.4fr) 240px",
          gap: 24,
          maxWidth: 1450,
          margin: "0 auto",
        }}
      >
        {/* LEFT: Content actions — PR-034.1 colour-coded groups (green=teach, blue=practice, purple=monitor, grey=account) */}
        <aside className="teacher-dashboard-left" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "white", padding: 16, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#166534", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", borderLeft: "3px solid #22c55e", paddingLeft: 6 }}>CONTENT CREATION</div>
              <Link to="/create-lesson" style={{ padding: "10px 14px", background: "#22c55e", color: "white", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, textAlign: "center", borderLeft: "3px solid #16a34a" }}>+ Create lesson</Link>
              <button type="button" onClick={openAiModal} title="Create draft lesson content, quizzes and flashcards for a topic" style={{ padding: "10px 14px", background: "rgba(34,197,94,0.12)", color: "#166534", border: "1px solid #22c55e", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%", textAlign: "center" }}>Generate lesson with AI</button>
              <Link to="/browse-lessons" style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", color: "#166534", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #86efac", textAlign: "center" }}>My lessons</Link>
              <Link to="/assessments/papers/builder" style={{ padding: "10px 14px", background: "rgba(34,197,94,0.08)", color: "#166534", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #86efac", textAlign: "center" }}>Exam lessons</Link>
              <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600, marginTop: 10, marginBottom: 4, textTransform: "uppercase", borderLeft: "3px solid #3b82f6", paddingLeft: 6 }}>Question Banks</div>
              <Link to="/teacher/topic-banks/flashcards" style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", color: "#1e40af", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #93c5fd", textAlign: "center" }}>Flashcards</Link>
              <Link to="/teacher/topic-banks/quizzes" style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", color: "#1e40af", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #93c5fd", textAlign: "center" }}>Quizzes</Link>
              <Link to="/teacher/topic-banks/past-papers" style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", color: "#1e40af", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #93c5fd", textAlign: "center" }}>Exam questions</Link>
              <Link to="/teacher/content-coverage" style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", color: "#1e40af", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #93c5fd", textAlign: "center" }} title="Topic bank coverage (flashcards, quizzes per topic)">Topic bank coverage</Link>
              <Link to="/teacher/csv-import" style={{ padding: "10px 14px", background: "rgba(59,130,246,0.08)", color: "#1e40af", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #93c5fd", textAlign: "center" }} title="Bulk CSV import for flashcards and exam questions">CSV import</Link>
              <div style={{ fontSize: 11, color: "#6b21a8", fontWeight: 600, marginTop: 10, marginBottom: 4, textTransform: "uppercase", borderLeft: "3px solid #8b5cf6", paddingLeft: 6 }}>Monitor course health</div>
              <Link to="/coverage" title="See which topics need more support" style={{ padding: "10px 14px", background: "rgba(139,92,246,0.08)", color: "#6b21a8", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #c4b5fd", textAlign: "center" }}>Coverage</Link>
              <Link to="/teacher/questions" title="See where students are asking questions or where coverage is weak" style={{ padding: "10px 14px", background: "rgba(139,92,246,0.08)", color: "#6b21a8", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #c4b5fd", textAlign: "center" }}>Student questions</Link>
              <Link to="/teacher/content-issues" title="Reported mistakes in lesson content" style={{ padding: "10px 14px", background: "rgba(139,92,246,0.08)", color: "#6b21a8", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #c4b5fd", textAlign: "center" }}>Content Issues</Link>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 10, marginBottom: 4, textTransform: "uppercase", borderLeft: "3px solid #9ca3af", paddingLeft: 6 }}>Account</div>
              <button type="button" onClick={handleCreateWorksheet} disabled={creatingWorksheet} style={{ padding: "10px 14px", background: "#f9fafb", color: "#4b5563", border: "1px solid #d1d5db", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: creatingWorksheet ? "wait" : "pointer", width: "100%", textAlign: "center" }}>{creatingWorksheet ? "Creating…" : "Create worksheet"}</button>
              <Link to="/teacher/reports/attempts" style={{ padding: "10px 14px", background: "#f9fafb", color: "#4b5563", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Assessment reports</Link>
              <Link to="/teacher/ops/link-students" style={{ padding: "10px 14px", background: "#f9fafb", color: "#4b5563", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Create students</Link>
              <Link to="/teacher/exam-question-bank" style={{ padding: "10px 14px", background: "#f9fafb", color: "#4b5563", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Create questions</Link>
            </div>
          </div>
        </aside>

        {/* MIDDLE: Main dashboard content */}
        <main className="teacher-dashboard-main" style={{ minWidth: 0 }}>
        <div style={{ marginBottom: "30px" }}>
          {/* Row 1: Title + Welcome (left), earnings summary (right) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap",
              marginBottom: "10px",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h1 style={{ color: "#333", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
                <span role="img" aria-label="teacher">👨‍🏫</span>
                Teacher Dashboard
              </h1>
              <p style={{ marginTop: "4px", marginBottom: 2, color: "#666", opacity: 0.85 }}>
                Welcome back, {user?.firstName}! Manage your lessons and track your earnings.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                Create lessons → Help students learn → Improve topics where students struggle.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  background: "white",
                  padding: "10px 20px",
                  borderRadius: "20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  fontWeight: "bold",
                  color: "#333",
                  fontSize: "1.1rem",
                }}
              >
                💰 Earnings: {stats.totalEarnings ?? 0}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "30px", marginTop: 8 }}>
          {/* PR-EDGE-3: Today panel — actionable summary; PR-UX-DASH-TEACH-1: renamed + badge strip */}
          {overview && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 20,
                padding: 28,
                background: "rgba(255,255,255,0.9)",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 0 }}>Today&apos;s interaction</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#475569" }}>What students did today</div>
                </div>
                {overview?.recentActivity && overview.recentActivity.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setRecentExpanded((v) => !v)}
                    aria-expanded={recentExpanded}
                    style={{
                      alignSelf: "flex-start",
                      background: "none",
                      border: "none",
                      padding: "4px 0",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.95rem",
                      color: "#111827",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Recent <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>{recentExpanded ? "▾" : "▸"}</span>
                  </button>
                )}
              </div>
              {overviewLoading && <span style={{ color: "#6b7280", fontSize: 14 }}>Loading…</span>}
              {overviewError && (
                <>
                  <span style={{ color: "#991b1b", fontSize: 14, marginRight: 8 }}>{overviewError}. </span>
                  <button
                    type="button"
                    onClick={async () => {
                      setOverviewLoading(true);
                      setOverviewError(null);
                      try {
                        const ov = await getTeacherOverview();
                        setOverview(ov);
                      } catch {
                        setOverviewError("Could not load overview");
                      } finally {
                        setOverviewLoading(false);
                      }
                    }}
                    style={{ padding: "4px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
                  >
                    Retry
                  </button>
                </>
              )}
              {overview && !overviewLoading && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {((overview.needsMarking?.worksheets?.count ?? 0) > 0 ||
                (overview.awaitingRelease?.worksheets?.count ?? 0) > 0 ||
                (overview.awaitingRelease?.quizzes?.count ?? 0) > 0 ||
                (overview.awaitingRelease?.assessments?.count ?? 0) > 0 ||
                (overview.dueSoon?.worksheets?.count ?? 0) > 0 ||
                (overview.dueSoon?.quizzes?.count ?? 0) > 0 ||
                (overview.dueSoon?.assessments?.count ?? 0) > 0 ||
                (overview.quizSubmissionsToday ?? 0) > 0 ||
                (overview.lowScoreCount ?? 0) > 0 ||
                (overview.awaitingReleaseTotal ?? 0) > 0) && (
                <>
                  {(overview.quizSubmissionsToday ?? 0) > 0 && (
                    <Link
                      to="/teacher/reports/attempts"
                      style={{
                        padding: "8px 14px",
                        background: "#dbeafe",
                        color: "#1e40af",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        border: "1px solid #3b82f6",
                      }}
                    >
                      {overview.quizSubmissionsToday} quiz submission{overview.quizSubmissionsToday !== 1 ? "s" : ""} today
                    </Link>
                  )}
                  {(overview.lowScoreCount ?? 0) > 0 && (
                    <Link
                      to="/teacher/reports/at-risk?threshold=0.4&days=7"
                      style={{
                        padding: "8px 14px",
                        background: "#fee2e2",
                        color: "#991b1b",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        border: "1px solid #ef4444",
                      }}
                    >
                      {overview.lowScoreCount} attempt{(overview.lowScoreCount ?? 0) !== 1 ? "s" : ""} &lt; 40%
                    </Link>
                  )}
                  {(overview.awaitingReleaseTotal ?? 0) > 0 && (
                    <Link
                      to="/teacher/reports/attempts"
                      style={{
                        padding: "8px 14px",
                        background: "#f3f4f6",
                        color: "#4b5563",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        border: "1px solid #9ca3af",
                      }}
                    >
                      {overview.awaitingReleaseTotal} awaiting release
                    </Link>
                  )}
                  {(overview.needsMarking?.worksheets?.count ?? 0) > 0 && (
                    <Link
                      to={overview.needsMarking.worksheets.link || "/teacher/worksheets/needs-marking"}
                      style={{
                        padding: "8px 14px",
                        background: "#fef3c7",
                        color: "#92400e",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontWeight: 600,
                        border: "1px solid #f59e0b",
                      }}
                    >
                      Needs marking ({overview.needsMarking.worksheets.count})
                    </Link>
                  )}
                  {((overview.awaitingRelease?.worksheets?.count ?? 0) > 0 ||
                    (overview.awaitingRelease?.quizzes?.count ?? 0) > 0 ||
                    (overview.awaitingRelease?.assessments?.count ?? 0) > 0) && (
                    <>
                      {(overview.awaitingRelease?.worksheets?.count ?? 0) > 0 && (
                        <Link
                          to={overview.awaitingRelease?.worksheets?.link || "/teacher/worksheets"}
                          style={{
                            padding: "8px 14px",
                            background: "#dbeafe",
                            color: "#1e40af",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 600,
                            border: "1px solid #3b82f6",
                          }}
                        >
                          Awaiting release — worksheets ({overview.awaitingRelease.worksheets.count})
                        </Link>
                      )}
                      {(overview.awaitingRelease?.quizzes?.count ?? 0) > 0 && (
                        <Link
                          to={overview.awaitingRelease?.quizzes?.link || "/teacher/reports/attempts"}
                          style={{
                            padding: "8px 14px",
                            background: "#dbeafe",
                            color: "#1e40af",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 600,
                            border: "1px solid #3b82f6",
                          }}
                        >
                          Awaiting release — quizzes ({overview.awaitingRelease.quizzes.count})
                        </Link>
                      )}
                      {(overview.awaitingRelease?.assessments?.count ?? 0) > 0 && (
                        <Link
                          to={overview.awaitingRelease?.assessments?.link || "/teacher/reports/attempts"}
                          style={{
                            padding: "8px 14px",
                            background: "#dbeafe",
                            color: "#1e40af",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 600,
                            border: "1px solid #3b82f6",
                          }}
                        >
                          Awaiting release — assessments ({overview.awaitingRelease.assessments.count})
                        </Link>
                      )}
                    </>
                  )}
                  {((overview.dueSoon?.worksheets?.count ?? 0) > 0 ||
                    (overview.dueSoon?.quizzes?.count ?? 0) > 0 ||
                    (overview.dueSoon?.assessments?.count ?? 0) > 0) && (
                    <>
                      {(overview.dueSoon?.worksheets?.count ?? 0) > 0 && (
                        <Link
                          to={overview.dueSoon?.worksheets?.link || "/teacher/worksheets"}
                          style={{
                            padding: "8px 14px",
                            background: "#f3e8ff",
                            color: "#6b21a8",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 600,
                            border: "1px solid #a855f7",
                          }}
                        >
                          Due soon — worksheets ({overview.dueSoon.worksheets.count})
                        </Link>
                      )}
                      {(overview.dueSoon?.quizzes?.count ?? 0) > 0 && (
                        <Link
                          to={overview.dueSoon?.quizzes?.link || "/teacher/reports/attempts"}
                          style={{
                            padding: "8px 14px",
                            background: "#f3e8ff",
                            color: "#6b21a8",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 600,
                            border: "1px solid #a855f7",
                          }}
                        >
                          Due soon — quizzes ({overview.dueSoon.quizzes.count})
                        </Link>
                      )}
                      {(overview.dueSoon?.assessments?.count ?? 0) > 0 && (
                        <Link
                          to={overview.dueSoon?.assessments?.link || "/teacher/reports/attempts"}
                          style={{
                            padding: "8px 14px",
                            background: "#f3e8ff",
                            color: "#6b21a8",
                            borderRadius: 8,
                            textDecoration: "none",
                            fontWeight: 600,
                            border: "1px solid #a855f7",
                          }}
                        >
                          Due soon — assessments ({overview.dueSoon.assessments.count})
                        </Link>
                      )}
                    </>
                  )}
                </>
              )}
              </div>
              )}
              {overview && overview.recentActivity && overview.recentActivity.length > 0 && recentExpanded && (
                <div style={{ width: "100%", paddingTop: 14, borderTop: "1px solid #e5e7eb", fontSize: 14 }}>
                  <div style={{ marginTop: 0 }}>
                      {overview.recentActivity.length > 5 && (
                        <div style={{ marginBottom: 8, display: "flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            onClick={() => setShowAllRecent((v) => !v)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#2563eb",
                              fontSize: 13,
                              cursor: "pointer",
                              padding: 0,
                              fontWeight: 500,
                              textDecoration: "underline",
                            }}
                          >
                            {showAllRecent ? "Show less" : `View all activity (${overview.recentActivity.length})`}
                          </button>
                        </div>
                      )}
                      {(showAllRecent ? overview.recentActivity : overview.recentActivity.slice(0, 5)).map((a, i) => (
                        <Link key={i} to={a.link} style={{ display: "block", color: "#4b5563", marginBottom: 6, textDecoration: "none", lineHeight: 1.5 }}>
                          {a.label}
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PR-EDGE-5: Questions causing difficulty */}
          {questionAnalytics.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 20,
                padding: 16,
                background: "rgba(254,243,199,0.5)",
                borderRadius: 12,
                border: "1px solid rgba(245,158,11,0.3)",
              }}
            >
              <div style={{ fontWeight: 700, marginRight: 12, marginBottom: 4, width: "100%" }}>💡 Suggested teaching actions</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>Based on student questions and course coverage.</div>
              {questionAnalytics.slice(0, 5).map((q, i) => (
                <div
                  key={q.questionId}
                  style={{
                    padding: "8px 12px",
                    background: "#fff",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    maxWidth: 320,
                  }}
                >
                  <div style={{ color: "#6b7280", marginBottom: 2 }}>
                    {q.percentCorrect != null ? `${Math.round(q.percentCorrect)}%` : "—"} · {q.attempts} attempts
                  </div>
                  <div style={{ fontWeight: 500 }}>{(q.questionPreview || "").slice(0, 60)}…</div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Lessons List */}
        <div
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "30px",
          }}
        >
          {/* PR5: Coverage card (when taxonomy loaded); Course setup card removed — duplicates SpecSelector + coverage block */}
          {taxonomyUnits.length > 0 && (
            <>
            <div
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <SpecSelector value={specKey} onChange={onSpecChange} />
              </div>
              <h3 style={{ color: "#333", margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }}>
                {taxonomyData?.subject && taxonomyData?.level ? `${taxonomyData.subject} ${taxonomyData.level} coverage` : "AQA GCSE Biology coverage"}
              </h3>
              <div style={{ color: "#6b7280", fontSize: "13px", marginBottom: 12 }}>
                Covered: {coverage.coveredCount} / {coverage.totalCount} topics
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "#e5e7eb",
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${coverage.totalCount ? (coverage.coveredCount / coverage.totalCount) * 100 : 0}%`,
                    background: "#22c55e",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ color: "#6b7280", fontSize: "12px" }}>
                  Required Practicals covered: {coverage.coveredRPs} / {coverage.rpTotal}
                </span>
                {coverage.coveredRPs < coverage.rpTotal && (
                  <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#fee2e2", color: "#b91c1c", fontWeight: 600 }}>
                    Needs attention
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowUncoveredTopics((v) => !v)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #3b82f6",
                    background: "#dbeafe",
                    color: "#1e40af",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {showUncoveredTopics ? "Hide uncovered topics" : "View uncovered topics"}
                </button>
                <Link
                  to="/create-lesson"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "#48bb78",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Plan next lesson
                </Link>
                <Link
                  to="/teacher/reports/attempts"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #3b82f6",
                    background: "#dbeafe",
                    color: "#1e40af",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Monitor Practice
                </Link>
                <Link
                  to="/teacher/reports/topic-performance"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #7c3aed",
                    background: "#ede9fe",
                    color: "#5b21b6",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Topic performance
                </Link>
                <Link
                  to="/teacher/ops/link-students"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid #8000ff",
                    background: "rgba(128,0,255,0.12)",
                    color: "#5b21b6",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Link students (beta)
                </Link>
              </div>
              {/* PR5: Topics not yet covered (toggled by "View uncovered topics" CTA above); PR-039 Improve this topic */}
              {coverage.uncoveredTopics.length > 0 && showUncoveredTopics && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", marginBottom: 4, color: "#374151" }}>✨ Improve this topic</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>Generate teaching materials or fix gaps in this topic.</div>
                    <div
                      style={{
                        paddingLeft: 12,
                        borderLeft: "3px solid #e5e7eb",
                        fontSize: "13px",
                        color: "#374151",
                      }}
                    >
                      {taxonomyUnits.map((u) => {
                        const uncoveredInUnit = coverage.uncoveredTopics.filter(
                          (t) => t.unit === u.unit
                        );
                        if (uncoveredInUnit.length === 0) return null;
                        return (
                          <div key={u.unit} style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{u.unit}</div>
                            <ul style={{ margin: 0, paddingLeft: 18, listStyle: "none" }}>
                              {uncoveredInUnit.map((t) => {
                                const tiers = Array.isArray(t.tier) ? t.tier : [];
                                const higherOnly = tiers.length === 1 && tiers[0] === "higher";
                                const effectiveTier: "foundation" | "higher" =
                                  topicTierChoice[t.key] ??
                                  (tiers.includes("foundation") ? "foundation" : "higher");
                                const isGenerating = generatingKey === t.key;
                                const rowError = generateErrors[t.key];
                                return (
                                  <li key={t.key} style={{ marginBottom: 10 }}>
                                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                                      <span>{t.topic}</span>
                                      {t.requiredPractical && (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            padding: "1px 4px",
                                            borderRadius: 3,
                                            background: "#fef3c7",
                                            color: "#92400e",
                                          }}
                                        >
                                          Required Practical
                                        </span>
                                      )}
                                      {higherOnly ? (
                                        <span
                                          style={{
                                            fontSize: 11,
                                            padding: "2px 6px",
                                            borderRadius: 4,
                                            background: "#dbeafe",
                                            color: "#1e40af",
                                          }}
                                        >
                                          Higher only
                                        </span>
                                      ) : (
                                        <select
                                          value={effectiveTier}
                                          onChange={(e) =>
                                            setTopicTierChoice((prev) => ({
                                              ...prev,
                                              [t.key]: e.target.value as "foundation" | "higher",
                                            }))
                                          }
                                          style={{
                                            padding: "4px 8px",
                                            borderRadius: 4,
                                            border: "1px solid #d1d5db",
                                            fontSize: 12,
                                          }}
                                        >
                                          <option value="foundation">Foundation</option>
                                          <option value="higher">Higher</option>
                                        </select>
                                      )}
                                      <button
                                        type="button"
                                        disabled={isGenerating}
                                        onClick={() => handleGenerateForTopic(t.key, higherOnly ? "higher" : effectiveTier)}
                                        style={{
                                          padding: "4px 10px",
                                          borderRadius: 4,
                                          border: "1px solid #22c55e",
                                          background: isGenerating ? "#e5e7eb" : "#22c55e",
                                          color: isGenerating ? "#6b7280" : "white",
                                          fontSize: 12,
                                          cursor: isGenerating ? "not-allowed" : "pointer",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {isGenerating ? "Generating…" : "Generate"}
                                      </button>
                                    </div>
                                    {rowError && (
                                      <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{rowError}</div>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  )}
              </div>
            </>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: taxonomyUnits.length > 0 ? 16 : 0,
              marginBottom: "20px",
            }}
          >
            <h2 style={{ color: "#333", margin: 0 }}>My Lessons</h2>
            <div style={{ color: "#666" }}>
              {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
            </div>
          </div>

          {lessons.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "3rem", color: "#e2e8f0", marginBottom: "20px" }}>📚</div>
              <h3 style={{ color: "#666", marginBottom: "10px" }}>No lessons yet</h3>
              <p style={{ color: "#999" }}>Create your first lesson to reach students.</p>

              <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                <button
                  onClick={openAiModal}
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    padding: "10px 20px",
                    background: "#111827",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  ✨ Generate with AI
                </button>

                <Link
                  to="/create-lesson"
                  style={{
                    display: "inline-block",
                    marginTop: "20px",
                    padding: "10px 20px",
                    background: "#48bb78",
                    color: "white",
                    textDecoration: "none",
                    borderRadius: "6px",
                    fontWeight: "bold",
                  }}
                >
                  Create lesson (manual)
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {lessons.map((lesson) => {
                const topicKey = topicToKey(lesson.topic);
                const taxonomyInfo = topicKey ? taxonomyMap[topicKey] : undefined;
                const subtitle =
                  taxonomyInfo
                    ? `${taxonomyInfo.unit} › ${taxonomyInfo.topic}`
                    : (lesson.topic && lesson.topic.trim()) || "—";
                const tierLabel =
                  lesson.tier === "foundation"
                    ? "Foundation"
                    : lesson.tier === "higher"
                      ? "Higher"
                      : lesson.tier
                        ? String(lesson.tier).charAt(0).toUpperCase() + String(lesson.tier).slice(1).toLowerCase()
                        : null;
                const examBoardLabel = lesson.examBoard || lesson.board || "AQA";
                const status = lesson.readiness?.status ?? "DRAFT";
                const missing = lesson.readiness?.signals?.missing ?? [];
                const missingLabels: Record<string, string> = {
                  NO_DIAGRAMS: "diagrams",
                  NO_CHECKPOINTS: "checkpoints",
                  NO_PRACTICE: "practice",
                  NOT_REVIEWED: "reviewed",
                };
                const missingText = missing.map((m) => missingLabels[m] ?? m).filter(Boolean);
                return (
                  <div
                    key={lesson._id}
                    style={{
                      display: "flex",
                      gap: 20,
                      padding: 16,
                      background: "#fff",
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    {/* Left: lesson content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", fontWeight: 700, color: "#111827", lineHeight: 1.3, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                        <span>{lesson.title}</span>
                        {lesson.needsCurriculumReview ? (
                          <span
                            title="Student practice on this lesson shows low accuracy, repeated attempts, and/or high-confidence wrong answers. Run a curriculum check when you edit (no automatic AI)."
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "rgba(234,88,12,0.12)",
                              color: "#9a3412",
                              border: "1px solid rgba(234,88,12,0.4)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Needs curriculum review
                          </span>
                        ) : null}
                        {lesson.recommendedForCurriculumCheck ? (
                          <span
                            title="This draft is a good candidate to open and run “Check against curriculum” (no automatic AI)."
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "rgba(99,102,241,0.12)",
                              color: "#4338ca",
                              border: "1px solid rgba(99,102,241,0.35)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Curriculum check recommended
                          </span>
                        ) : null}
                      </h3>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 10 }}>
                        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#e5e7eb", color: "#374151" }}>
                          {examBoardLabel}
                        </span>
                        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#e5e7eb", color: "#374151" }}>
                          {lesson.level || "GCSE"}
                        </span>
                        {tierLabel && (
                          <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1e40af" }}>
                            {tierLabel}
                          </span>
                        )}
                        {taxonomyInfo?.requiredPractical && (
                          <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e" }}>
                            Required Practical
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 12,
                          fontSize: 13,
                          color: "#4b5563",
                          marginBottom: 8,
                        }}
                      >
                        <span>{lesson.subject}</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span>{lesson.level}</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span>Subscription access</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span>{lesson.purchaseCount ?? 0} purchases</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>{lesson.totalEarnings ?? 0} earnings</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: lesson.isPublished ? "#dcfce7" : "#fee2e2",
                            color: lesson.isPublished ? "#166534" : "#991b1b",
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {lesson.isPublished ? "Published" : "Draft"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background:
                              status === "READY"
                                ? "#dcfce7"
                                : status === "NEEDS_REVIEW"
                                  ? "#fef3c7"
                                  : "#e5e7eb",
                            color:
                              status === "READY"
                                ? "#166534"
                                : status === "NEEDS_REVIEW"
                                  ? "#92400e"
                                  : "#4b5563",
                          }}
                        >
                          {status === "READY" ? "Classroom-ready" : status === "NEEDS_REVIEW" ? "Review required for:" : "Draft"}
                        </span>
                        {missingText.length > 0 && (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {missingText.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Right: actions (vertical stack) */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        alignItems: "flex-end",
                        flexShrink: 0,
                      }}
                    >
                      <Link to={`/lesson/${lesson._id}?entry=preview`}>
                        <button
                          style={{
                            width: 100,
                            height: 32,
                            padding: "0 12px",
                            background: "#4299e1",
                            color: "white",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          Preview lesson
                        </button>
                      </Link>
                      <Link to={`/edit-lesson/${lesson._id}`}>
                        <button
                          style={{
                            width: 100,
                            height: 32,
                            padding: "0 12px",
                            background: "#e2e8f0",
                            color: "#333",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          Edit Lesson
                        </button>
                      </Link>
                      <button
                        onClick={() => handlePublishToggle(lesson._id, lesson.isPublished)}
                        style={{
                          width: 100,
                          height: 32,
                          padding: "0 12px",
                          background: lesson.isPublished ? "#fed7d7" : "#48bb78",
                          color: lesson.isPublished ? "#b91c1c" : "white",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        {lesson.isPublished ? "Unpublish Lesson" : "Publish Lesson"}
                      </button>
                      <Link to={`/teacher/reports/lesson/${lesson.id}`}>
                        <button
                          type="button"
                          style={{
                            width: 100,
                            height: 32,
                            padding: "0 12px",
                            borderRadius: 6,
                            border: "1px solid #6366f1",
                            background: "rgba(99,102,241,0.1)",
                            color: "#4f46e5",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                          }}
                        >
                          Lesson Attempts
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </main>

        {/* RIGHT: Quick teaching tools — high-value shortcuts, no duplicates of left nav */}
        <aside className="teacher-dashboard-right" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "white", padding: 16, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <h3 style={{ color: "#333", margin: "0 0 4px 0", fontSize: "1rem" }}>Quick teaching tools</h3>
            <p style={{ margin: "0 0 12px 0", fontSize: 12, color: "#6b7280" }}>Shortcuts for common actions.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 6, textTransform: "uppercase" }}>Review work</div>
              <div style={{ marginBottom: 8 }}>
                <Link to="/teacher/worksheets/needs-marking" style={{ display: "block", padding: "10px 14px", background: "#fef3c7", color: "#92400e", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #f59e0b", textAlign: "center" }}>Needs marking <CountBadge n={overview?.needsMarking?.worksheets?.count ?? 0} /></Link>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 4, marginBottom: 6, textTransform: "uppercase" }}>Improve course</div>
              <div style={{ marginBottom: 8 }}>
                <Link to="/teacher/reports/needs-attention" style={{ display: "block", padding: "10px 14px", background: "rgba(220,38,38,0.08)", color: "#dc2626", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "2px solid #dc2626", textAlign: "center" }}>Needs attention <CountBadge n={lessons.filter((l) => (l.readiness?.status ?? "DRAFT") !== "READY").length} /></Link>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Link to="/teacher/misconceptions" style={{ display: "block", padding: "10px 14px", background: "rgba(59,130,246,0.1)", color: "#2563eb", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #2563eb", textAlign: "center" }}>Misconceptions</Link>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Link to="/teacher/reteach-plans" style={{ display: "block", padding: "10px 14px", background: "rgba(16,185,129,0.1)", color: "#059669", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #059669", textAlign: "center" }}>Reteach plans</Link>
              </div>
              <div style={{ marginBottom: 8 }}>
                <button type="button" onClick={handleViewAnalytics} style={{ width: "100%", padding: "10px 14px", background: "#667eea", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>View analytics</button>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Link to="/docs/view?file=SPRINT_CELL_BIOLOGY_WEEK_1.md" title="See the next priority topics to improve" style={{ display: "block", padding: "10px 14px", background: "#f1f5f9", color: "#475569", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #cbd5e1", textAlign: "center" }}>Course improvement plan</Link>
              </div>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 4, marginBottom: 6, textTransform: "uppercase" }}>Business</div>
              <div style={{ marginBottom: 8 }}>
                <button type="button" onClick={handleCashOut} style={{ width: "100%", padding: "10px 14px", background: "#ed8936", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Cash out earnings</button>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "white", padding: 10, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1rem", color: "#667eea", marginBottom: 2 }}>📚</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#333" }}>{stats.totalLessons}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Total lessons</div>
            </div>
            <div style={{ background: "white", padding: 10, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1rem", color: "#48bb78", marginBottom: 2 }}>👁️</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#333" }}>{stats.publishedLessons}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Published</div>
            </div>
            <div style={{ background: "white", padding: 10, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1rem", color: "#ed8936", marginBottom: 2 }}>💰</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#333" }}>{stats.totalEarnings}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Earnings</div>
            </div>
            <div style={{ background: "white", padding: 10, borderRadius: 10, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: "1rem", color: "#9f7aea", marginBottom: 2 }}>🛒</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#333" }}>{stats.totalPurchases}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>Purchases</div>
            </div>
          </div>
        </aside>

        {/* ✅ Checklist Modal */}
        {checklistOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 9998,
            }}
            onClick={closeChecklist}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "760px",
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <h3 style={{ margin: 0, color: "#111827" }}>✅ Teacher Lesson Authoring Checklist (MANDATORY)</h3>
                  <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
                    Use this every time. It prevents broken lessons and keeps Deeper Knowledge working.
                  </p>
                </div>
                <button
                  onClick={closeChecklist}
                  style={{
                    background: "transparent",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                  }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div style={{ marginTop: "14px", color: "#111827", lineHeight: 1.65 }}>
                <ol style={{ paddingLeft: "18px", margin: 0 }}>
                  <li>
                    <b>Lesson setup:</b> One lesson per sub-topic. Add duration + short description. Save as <b>Draft</b>.
                  </li>
                  <li>
                    <b>Pages:</b> Use multiple pages. Recommended order:
                    <br />
                    Overview → Core Concept 1 → Core Concept 2 → Comparison / examples (optional) → Check understanding → Exam tips → Stretch: Deeper knowledge (optional).
                  </li>
                  <li>
                    <b>Core content:</b> Every page must contain at least one normal <b>Text</b> block.
                  </li>
                  <li>
                    <b>Deeper Knowledge:</b> Put advanced material <b>only</b> in <b>Deeper knowledge</b> blocks.
                  </li>
                  <li>
                    <b>Stretch page rule:</b> Keep a short core sentence + advanced bullets inside Deeper knowledge.
                  </li>
                  <li>
                    <b>Before submission:</b> No empty pages, no core facts hidden in Deeper knowledge, keep Draft → submit for review.
                  </li>
                </ol>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
                <button
                  onClick={closeChecklist}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Close
                </button>
                <Link
                  to="/create-lesson"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#48bb78",
                    color: "white",
                    textDecoration: "none",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                  onClick={() => setChecklistOpen(false)}
                >
                  + Create Lesson
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ✅ AI Modal — scrollable body, fixed header/footer, fits viewport */}
        {aiOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
              overflow: "hidden",
            }}
            onClick={() => (aiLoading ? null : setAiOpen(false))}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "620px",
                maxHeight: "90vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                background: "white",
                borderRadius: "12px",
                boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Fixed header */}
              <div style={{ flex: "0 0 auto", padding: "20px 20px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div>
                    <h3 style={{ margin: 0, color: "#111827" }}>✨ Generate lesson with AI</h3>
                    <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
                      Generate a first draft from a topic (template + AI content). You edit, then publish. Optional; may be limited during rollout.
                    </p>
                  </div>
                  <button
                    onClick={() => (aiLoading ? null : setAiOpen(false))}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "1.2rem",
                      cursor: aiLoading ? "not-allowed" : "pointer",
                    }}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                {aiError ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "rgba(127,29,29,0.95)",
                      fontWeight: 700,
                    }}
                  >
                    {aiError}
                  </div>
                ) : null}
              </div>

              {/* Scrollable body — fits viewport, scrolls on small screens */}
              <div
                style={{
                  flex: "1 1 auto",
                  minHeight: 0,
                  maxHeight: "85vh",
                  overflowY: "auto",
                  padding: "16px 20px",
                  paddingRight: 6,
                }}
              >
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    fontSize: "0.875rem",
                    color: "#334155",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8, color: "#0f172a" }}>How to create a lesson using AI</div>
                  <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.6 }}>
                    <li>Select <b>Subject → Spec → Main topic → Sub-topic</b> (same as manual Create Lesson); optionally set Level, Exam board, and Tier. Then click <b>Generate</b>.</li>
                    <li>Click <b>Generate</b> — the AI builds a syllabus-aligned draft and saves it; you are taken to the lesson editor.</li>
                    <li>Edit pages, add checkpoints and exam tips, then save as Draft and submit for review when ready.</li>
                  </ul>
                  <div style={{ fontWeight: 700, marginTop: 12, marginBottom: 6, color: "#0f172a" }}>How to add diagrams using AI</div>
                  <ul style={{ margin: 0, paddingLeft: "18px", lineHeight: 1.6 }}>
                    <li>In the lesson editor, add a <b>Diagram</b> block where you want an image (or use an existing one).</li>
                    <li>In that block, click <b>Generate with AI</b> — the AI creates an image from the lesson content and inserts it. Repeat for other blocks as needed.</li>
                    <li>For some Biology topics, a diagram block may be added automatically when you generate the lesson; you can keep it or replace it with <b>Generate with AI</b>.</li>
                  </ul>
                </div>

                <div style={{ marginTop: "16px" }}>
                  <CreateLessonTopicSelectors
                    options={aiTaxonomyOptions}
                    loading={aiTaxonomyLoading}
                    error={aiTaxonomyError}
                    value={aiTopicSelection}
                    onChange={handleAiTopicSelectionChange}
                    showTopicDisplay={true}
                    layout="stack"
                    selectStyle={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                    labelStyle={{ fontSize: "0.85rem", color: "#374151", marginBottom: 4 }}
                  />
                </div>

                {aiForm.topicKey.trim() ? (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      fontSize: "0.875rem",
                      color: "#065f46",
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>AI will generate content only for the selected sub-topic.</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", color: "#047857" }}>
                      {aiTopicSelection.subject && <span>Subject: {aiTopicSelection.subject}</span>}
                      {aiTopicSelection.specKey && <span>Spec: {aiTopicSelection.specKey}</span>}
                      {aiTopicSelection.mainTopicTitle && <span>Main topic: {aiTopicSelection.mainTopicTitle}</span>}
                      {aiTopicSelection.topic && <span>Sub-topic: {aiTopicSelection.topic}</span>}
                    </div>
                  </div>
                ) : null}

                {aiForm.topicKey.trim() ? (
                  <ExistingLessonsPanel
                    topicKey={aiForm.topicKey}
                    currentUserId={user?._id ? String(user._id) : undefined}
                    layout="compact"
                    aiFormContext={{
                      additionalInstructions: aiForm.additionalInstructions || undefined,
                      strictSpec: aiForm.strictSpec || undefined,
                    }}
                  />
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>Level</label>
                  <select
                    value={aiForm.level}
                    onChange={(e) => {
                      const nextLevel = e.target.value;
                      setAiError("");
                      setAiForm((p) => ({
                        ...p,
                        level: nextLevel,
                        tier: nextLevel === "GCSE" ? p.tier : "",
                      }));
                    }}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  >
                    <option>KS3</option>
                    <option>GCSE</option>
                    <option>A-Level</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>Exam board</label>
                  <select
                    value={aiForm.board}
                    onChange={(e) => {
                      setAiError("");
                      setAiForm((p) => ({ ...p, board: e.target.value }));
                    }}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  >
                    <option value="">Any (optional)</option>
                    {EXAM_BOARDS.filter((b) => b !== "").map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>
                    GCSE Tier {aiForm.level === "GCSE" ? "" : "(disabled)"}
                  </label>
                  <select
                    value={aiForm.level === "GCSE" ? aiForm.tier : ""}
                    disabled={aiForm.level !== "GCSE"}
                    onChange={(e) => {
                      setAiError("");
                      setAiForm((p) => ({ ...p, tier: e.target.value }));
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      background: aiForm.level !== "GCSE" ? "#f9fafb" : "white",
                    }}
                  >
                    <option value="">(empty)</option>
                    <option value="foundation">foundation</option>
                    <option value="higher">higher</option>
                  </select>
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid #86efac",
                    background: "rgba(34,197,94,0.08)",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#166534", marginBottom: 8 }}>
                    Lesson planner (V2 / V3)
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#374151", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={aiForm.useLessonGeneratorV2 === true}
                      onChange={(e) =>
                        setAiForm((p) => ({
                          ...p,
                          useLessonGeneratorV2: e.target.checked,
                          useLessonGeneratorV3: e.target.checked ? p.useLessonGeneratorV3 : false,
                          useLessonGeneratorV4: e.target.checked ? p.useLessonGeneratorV4 : false,
                        }))
                      }
                    />
                    Generate with V2 planner (teach→test journey)
                  </label>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2, marginLeft: 24, marginBottom: 8 }}>
                    Plans the learning journey before blocks are generated. V1 remains the default.
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={aiForm.useLessonGeneratorV3 === true}
                      disabled={aiForm.useLessonGeneratorV2 !== true}
                      onChange={(e) =>
                        setAiForm((p) => ({
                          ...p,
                          useLessonGeneratorV3: e.target.checked,
                          useLessonGeneratorV4: e.target.checked ? p.useLessonGeneratorV4 : false,
                        }))
                      }
                    />
                    Enforce structure with V3 (architecture gate before save)
                  </label>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2, marginLeft: 24, marginBottom: 8 }}>
                    Reorders blocks and validates architecture scores before export. Requires V2 planner.
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={aiForm.useLessonGeneratorV4 === true}
                      disabled={aiForm.useLessonGeneratorV2 !== true}
                      onChange={(e) => setAiForm((p) => ({ ...p, useLessonGeneratorV4: e.target.checked }))}
                    />
                    Teaching intelligence V4 (teacher voice + exam modelling)
                  </label>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2, marginLeft: 24 }}>
                    Adds teaching journey, examiner language, and spiral retrieval to the prompt; scores teaching quality after save. Requires V2.
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={aiForm.autoGenerateFromBanks === true}
                      onChange={(e) => setAiForm((p) => ({ ...p, autoGenerateFromBanks: e.target.checked }))}
                    />
                    Auto-generate from topic banks (attach flashcards + quiz when draft is created)
                  </label>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2, marginLeft: 24 }}>
                    Only questions for the selected sub-topic will be attached.
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: "#374151" }}>
                    <input
                      type="checkbox"
                      checked={aiForm.strictSpec === true}
                      onChange={(e) => setAiForm((p) => ({ ...p, strictSpec: e.target.checked }))}
                    />
                    Strictly follow specification (no extra content)
                  </label>
                </div>

                <div style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                  <label style={{ fontSize: "0.85rem", color: "#374151", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Additional instructions for this lesson
                  </label>
                  <textarea
                    value={aiForm.additionalInstructions || ""}
                    onChange={(e) => setAiForm((p) => ({ ...p, additionalInstructions: e.target.value }))}
                    placeholder="Only include content relevant to cell structure, differences between plant and animal cells, and functions of organelles. Do not include out-of-spec content. Match GCSE exam expectations."
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      fontSize: "0.9rem",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                  <div style={{ fontWeight: 600, fontSize: "0.8rem", marginTop: 10, marginBottom: 4, color: "#0f172a" }}>
                    Presets
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {(Object.keys(AI_PRESETS) as Array<keyof typeof AI_PRESETS>).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setAiForm((p) => ({
                            ...p,
                            additionalInstructions: appendInstructionClean(p.additionalInstructions || "", AI_PRESETS[key]),
                          }))
                        }
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #22c55e",
                          background: "rgba(34,197,94,0.08)",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          color: "#166534",
                          fontWeight: 600,
                        }}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: 4, color: "#0f172a" }}>
                    Quick chips
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {[
                      "Exam-focused",
                      "Simpler language",
                      "Higher tier depth",
                      "Include misconceptions",
                      "Add comparison table",
                      "Keep strictly in spec",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setAiForm((p) => ({
                            ...p,
                            additionalInstructions: appendInstructionClean(p.additionalInstructions || "", chip),
                          }))
                        }
                        style={{
                          padding: "4px 10px",
                          borderRadius: 16,
                          border: "1px solid #d1d5db",
                          background: "white",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                          color: "#374151",
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: "0.8rem", color: "#6b7280" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={aiForm.forceComparisonTable}
                        onChange={(e) => setAiForm((p) => ({ ...p, forceComparisonTable: e.target.checked }))}
                      />
                      Include comparison table
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={aiForm.forceExamQuestion}
                        onChange={(e) => setAiForm((p) => ({ ...p, forceExamQuestion: e.target.checked }))}
                      />
                      Include real exam question
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={aiForm.forceDiagramSuggestion}
                        onChange={(e) => setAiForm((p) => ({ ...p, forceDiagramSuggestion: e.target.checked }))}
                      />
                      Include diagram suggestion
                    </label>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: "0.8rem",
                      color: "#475569",
                      lineHeight: 1.5,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, color: "#334155" }}>AI will generate:</div>
                    <ul style={{ margin: 0, paddingLeft: "18px" }}>
                      <li>Structured lesson with 3–5 teaching sections</li>
                      <li>Key ideas, misconceptions, and exam tips</li>
                      <li>Exam-style questions with answers</li>
                      <li>1 checkpoint</li>
                      <li>Flashcards/quiz if selected topic banks exist</li>
                    </ul>
                  </div>
                </div>
                </div>
              </div>

              {/* Fixed footer */}
              <div
                style={{
                  flex: "0 0 auto",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  padding: "16px 20px 20px",
                  borderTop: "1px solid #e5e7eb",
                  background: "white",
                }}
              >
                <button
                  onClick={() => (aiLoading ? null : setAiOpen(false))}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #e5e7eb",
                    background: "white",
                    cursor: aiLoading ? "not-allowed" : "pointer",
                    fontWeight: 700,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiTopicOk}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: aiLoading || !aiTopicOk ? "#6b7280" : "#111827",
                    color: "white",
                    cursor: aiLoading || !aiTopicOk ? "not-allowed" : "pointer",
                    fontWeight: 800,
                  }}
                  title={!aiTopicOk ? "Enter a topic to generate a draft" : undefined}
                >
                  {aiLoading ? "Generating..." : "Generate Draft"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;