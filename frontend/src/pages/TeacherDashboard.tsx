import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";
import { createWorksheet } from "../api/worksheets";
import { getTeacherOverview, type TeacherOverview } from "../api/teacherOverview";
import { getQuestionAnalytics, type QuestionAnalyticsItem } from "../api/teacherAnalytics";

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
  shamCoinPrice?: number;
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
  const [user, setUser] = useState<any>(null);

  // ✅ AI modal state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string>("");
  const [aiForm, setAiForm] = useState({
    subject: "Biology",
    level: "GCSE",
    topic: "",
    board: "", // ✅ optional by default
    tier: "higher",
  });

  // ✅ Teacher checklist modal
  const [checklistOpen, setChecklistOpen] = useState(false);

  // Start Here collapsible (default collapsed to reduce clutter)
  const [showStartHere, setShowStartHere] = useState(false);

  // PR-UX-DASH-INNOV-1: Quick setup collapsible (persist in localStorage)
  const [quickSetupCollapsed, setQuickSetupCollapsedState] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem("teacherDashboard.quickSetupCollapsed");
      return s === "true";
    } catch {
      return false;
    }
  });

  const setQuickSetupCollapsed = (v: boolean) => {
    setQuickSetupCollapsedState(v);
    try {
      localStorage.setItem("teacherDashboard.quickSetupCollapsed", String(v));
    } catch {
      /* ignore */
    }
  };

  // PR-UX-DASH-INNOV-2: Today's interaction - show all recent or top 5
  const [showAllRecent, setShowAllRecent] = useState(false);

  // PR4: AQA GCSE Biology taxonomy for unit/topic/requiredPractical
  const [taxonomyMap, setTaxonomyMap] = useState<Record<string, TaxonomyTopicInfo>>({});
  // PR5: full units list for filters and coverage
  const [taxonomyUnits, setTaxonomyUnits] = useState<TaxonomyUnit[]>([]);

  // PR5: Topic filter state
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [filterTopicKey, setFilterTopicKey] = useState<string>("all");
  const [filterTier, setFilterTier] = useState<"all" | "foundation" | "higher">("all");
  const [filterReadiness, setFilterReadiness] = useState<"all" | "READY" | "NEEDS_REVIEW" | "DRAFT">("all");

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

  // PR5 + PR7: Client-side filtering
  const filteredLessons = useMemo(() => {
    return lessons.filter((l) => {
      const topicKey = topicToKey(l.topic);
      const taxonomy = taxonomyMap[topicKey];
      if (filterUnit !== "all" && taxonomy?.unit !== filterUnit) return false;
      if (filterTopicKey !== "all" && topicKey !== filterTopicKey) return false;
      if (filterTier !== "all" && l.tier !== filterTier) return false;
      if (filterReadiness !== "all" && (l.readiness?.status ?? "DRAFT") !== filterReadiness) return false;
      return true;
    });
  }, [lessons, taxonomyMap, filterUnit, filterTopicKey, filterTier, filterReadiness]);

  /** At least one lesson is not classroom-ready → show Needs Attention as active (red) */
  const hasNeedsAttention = lessons.some(
    (lesson) => (lesson.readiness?.status ?? "DRAFT") !== "READY"
  );

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

  // PR19: Quick setup counts (no backend changes)
  const quickSetup = useMemo(() => {
    const published = lessons.filter((l) => l.isPublished);
    const noPracticeCount = published.filter(
      (l) => !l.examQuestions || (Array.isArray(l.examQuestions) && l.examQuestions.length === 0)
    ).length;
    const notReviewedCount = published.filter((l) => !l.reviewedAt).length;
    const hasUsedClassroomMode =
      typeof window !== "undefined" && window.localStorage.getItem("hasUsedClassroomMode") === "true";
    return {
      noPracticeCount,
      notReviewedCount,
      hasUsedClassroomMode,
      uncoveredCount: coverage.uncoveredTopics.length,
    };
  }, [lessons, coverage.uncoveredTopics.length]);

  // PR-UX-DASH-INNOV-1: Quick setup remaining count
  const quickSetupRemaining = useMemo(() => {
    let n = 0;
    if (quickSetup.noPracticeCount > 0) n += 1;
    if (quickSetup.uncoveredCount > 0) n += 1;
    if (!quickSetup.hasUsedClassroomMode && lessons.some((l) => l.isPublished)) n += 1;
    if (quickSetup.notReviewedCount > 0) n += 1;
    return n;
  }, [quickSetup, lessons]);

  useEffect(() => {
    if (quickSetupRemaining === 0) {
      setQuickSetupCollapsedState(true);
      try {
        localStorage.setItem("teacherDashboard.quickSetupCollapsed", "true");
      } catch {
        /* ignore */
      }
    }
  }, [quickSetupRemaining]);

  useEffect(() => {
    const init = async () => {
      try {
        // 1) Load user from localStorage
        const userData = localStorage.getItem("user");
        let parsedUser: any = null;

        if (userData) {
          try {
            parsedUser = JSON.parse(userData);
            setUser(parsedUser);
          } catch (err) {
            console.error("Error parsing user data:", err);
          }
        }

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
          const taxRes = await api.get("/taxonomy/aqa-gcse-biology");
          const firstTopicKey = taxRes?.data?.units?.[0]?.topics?.[0]?.key ?? "cell-structure";
          const analytics = await getQuestionAnalytics(firstTopicKey, 30);
          const difficult = (analytics.items || []).filter((q) => q.percentCorrect != null && q.attempts >= 3).slice(0, 5);
          setQuestionAnalytics(difficult);
        } catch {
          setQuestionAnalytics([]);
        }

        // 4) PR4: Load taxonomy for unit/topic/requiredPractical badges
        try {
          const taxRes = await api.get("/taxonomy/aqa-gcse-biology");
          const tax = taxRes?.data;
          const units = Array.isArray(tax?.units) ? tax.units : [];
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
          setTaxonomyMap(map);
          setTaxonomyUnits(
            units.map((u: any) => ({
              unit: u?.unit ?? "",
              topics: (Array.isArray(u?.topics) ? u.topics : []).map((t: any) => ({
                topic: t?.topic ?? "",
                key: t?.key ?? topicToKey(t?.topic),
                requiredPractical: !!t?.requiredPractical,
                tier: Array.isArray(t?.tier) ? t.tier : [],
              })),
            }))
          );
        } catch {
          // non-blocking; badges will degrade gracefully
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

        shamCoinPrice: l.shamCoinPrice ?? 0,
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

      await api.patch(`/lessons/${lessonId}/publish`, { isPublished: next });

      alert(next ? "Lesson published successfully!" : "Lesson unpublished successfully!");

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

      alert(err?.message || "Failed to update lesson status");
    }
  };

  const handleCashOut = async () => {
    if (stats.totalEarnings <= 0) {
      alert("You have no earnings to cash out!");
      return;
    }

    if (!window.confirm(`Do you want to cash out ${stats.totalEarnings} ShamCoins?`)) {
      return;
    }

    try {
      const response = await api.post("/earnings/cashout", {
        amount: stats.totalEarnings,
      });

      alert(
        `Success! ${response.data.message}\nNew Balance: ${response.data.newBalance} coins\nRemaining Earnings: ${response.data.remainingEarnings} coins`
      );

      const userData = localStorage.getItem("user");
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        } catch (err) {
          console.error("Error parsing user data:", err);
        }
      }

      await fetchTeacherStatsFromBackend();
    } catch (err: any) {
      console.error("Cash out failed:", err);
      alert(err?.data?.message || err?.message || "Cash out failed.");
    }
  };

  const fixEarnings = async () => {
    if (
      !window.confirm(
        "This will transfer your available ShamCoins to earnings for cash out. Continue?"
      )
    ) {
      return;
    }

    try {
      const response = await api.post("/earnings/fix-earnings", {});
      alert(
        `Fixed! ${response.data.message}\nNew Earnings: ${response.data.newEarnings} coins\nRemaining ShamCoins: ${response.data.newShamCoins} coins`
      );

      const userData = localStorage.getItem("user");
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
        } catch (err) {
          console.error("Error parsing user data:", err);
        }
      }

      await fetchTeacherStatsFromBackend();
    } catch (err: any) {
      alert(err?.data?.message || err?.message || "Fix failed");
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

  // ✅ AI Generate handler (calls backend and opens edit page)
  const handleAIGenerate = async () => {
    const topic = (aiForm.topic || "").trim();
    if (!topic) {
      setAiError("Please enter a Topic.");
      return;
    }

    setAiError("");
    setAiLoading(true);
    try {
      const payload: any = {
        subject: (aiForm.subject || "").trim(),
        level: (aiForm.level || "").trim(),
        topic,
        board: (aiForm.board || "").trim(), // optional
        tier: aiForm.level === "GCSE" ? (aiForm.tier || "").trim() : "",
      };

      const res = await api.post("/ai/generate-and-save", payload);
      const lessonId = res?.data?.lessonId;

      if (!lessonId) {
        setAiError("AI saved a draft, but no lessonId returned.");
        return;
      }

      setAiOpen(false);

      // Refresh list so it appears immediately
      await fetchLessonsFromBackend();
      await fetchTeacherStatsFromBackend();

      // Go straight to edit
      navigate(`/edit-lesson/${lessonId}`);
    } catch (err: any) {
      console.error("AI generate-and-save failed:", err);
      const msg =
        err?.response?.data?.details ||
        err?.response?.data?.error ||
        err?.message ||
        "AI generation failed.";
      setAiError(msg);
      alert(msg);
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
      const token = localStorage.getItem("token");
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

  const aiTopicOk = Boolean((aiForm.topic || "").trim());

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
        {/* LEFT: Content actions (vertical stack) */}
        <aside className="teacher-dashboard-left" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "white", padding: 16, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <h3 style={{ color: "#333", margin: "0 0 12px 0", fontSize: "1rem" }}>Content</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" }}>Lessons</div>
              <Link to="/create-lesson" style={{ padding: "10px 14px", background: "#48bb78", color: "white", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, textAlign: "center" }}>+ Create lesson</Link>
              <button type="button" onClick={openAiModal} style={{ padding: "10px 14px", background: "#0d6efd", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%" }}>✨ Generate with AI</button>
              <Link to="/browse-lessons" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Browse lessons</Link>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 8, marginBottom: 4, textTransform: "uppercase" }}>Banks</div>
              <Link to="/teacher/topic-banks/flashcards" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Topic Banks → Flashcards</Link>
              <Link to="/teacher/topic-banks/quizzes" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Topic Banks → Quizzes</Link>
              <Link to="/teacher/topic-banks/past-papers" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Topic Banks → Past Papers</Link>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 8, marginBottom: 4, textTransform: "uppercase" }}>Worksheets</div>
              <button type="button" onClick={handleCreateWorksheet} disabled={creatingWorksheet} style={{ padding: "10px 14px", background: "#059669", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: creatingWorksheet ? "wait" : "pointer", width: "100%" }}>{creatingWorksheet ? "Creating…" : "📄 Create worksheet"}</button>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, marginTop: 8, marginBottom: 4, textTransform: "uppercase" }}>Assessment</div>
              <Link to="/assessments/papers/builder" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Assessment Papers</Link>
              <Link to="/teacher/exam-question-bank" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Create Questions</Link>
            </div>
          </div>
        </aside>

        {/* MIDDLE: Main dashboard content */}
        <main className="teacher-dashboard-main" style={{ minWidth: 0 }}>
        <div style={{ marginBottom: "30px" }}>
          {/* Row 1: Title + Welcome (left), ShamCoins (right) */}
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
              <p style={{ marginTop: "4px", color: "#666", opacity: 0.85 }}>
                Welcome back, {user?.firstName}! Manage your lessons and track your earnings.
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
                💰 {user?.shamCoins || 0} ShamCoins
              </div>
            </div>
          </div>

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
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: 4 }}>Today&apos;s interaction</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "#475569" }}>What students did today</div>
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
              {(overview.needsMarking?.worksheets?.count ?? 0) === 0 &&
                (overview.awaitingRelease?.worksheets?.count ?? 0) === 0 &&
                (overview.awaitingRelease?.quizzes?.count ?? 0) === 0 &&
                (overview.awaitingRelease?.assessments?.count ?? 0) === 0 &&
                (overview.dueSoon?.worksheets?.count ?? 0) === 0 &&
                (overview.dueSoon?.quizzes?.count ?? 0) === 0 &&
                (overview.dueSoon?.assessments?.count ?? 0) === 0 &&
                (overview.quizSubmissionsToday ?? 0) === 0 &&
                (overview.lowScoreCount ?? 0) === 0 &&
                (overview.awaitingReleaseTotal ?? 0) === 0 && (
                <span style={{ color: "#6b7280", fontSize: 14 }}>Nothing urgent.</span>
              )}
              </div>
              )}
              {overview && overview.recentActivity && overview.recentActivity.length > 0 && (
                <div style={{ width: "100%", paddingTop: 14, borderTop: "1px solid #e5e7eb", fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Recent</div>
                    {overview.recentActivity.length > 5 && (
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
                        {showAllRecent ? "Show less" : `View all (${overview.recentActivity.length})`}
                      </button>
                    )}
                  </div>
                  {(showAllRecent ? overview.recentActivity : overview.recentActivity.slice(0, 5)).map((a, i) => (
                    <Link key={i} to={a.link} style={{ display: "block", color: "#4b5563", marginBottom: 6, textDecoration: "none", lineHeight: 1.5 }}>
                      {a.label}
                    </Link>
                  ))}
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
              <div style={{ fontWeight: 700, marginRight: 12, marginBottom: 4, width: "100%" }}>Questions causing difficulty</div>
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

        {/* Start Here: collapsible (default collapsed) */}
        <div
          style={{
            background: "white",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "20px",
            borderLeft: "6px solid #48bb78",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setShowStartHere(!showStartHere)}
            style={{
              width: "100%",
              padding: "14px 18px",
              textAlign: "left",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1rem",
              fontWeight: "bold",
              color: "#111827",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>Start here (how to create a lesson)</span>
            <span style={{ fontSize: "1.2rem" }}>{showStartHere ? "▼" : "▶"}</span>
          </button>
          {!showStartHere && (
            <p style={{ margin: 0, padding: "0 18px 14px", color: "#6b7280", fontSize: "0.9rem" }}>
              Follow these steps to publish correctly.
            </p>
          )}
          {showStartHere && (
            <div style={{ padding: "0 18px 18px 18px", borderTop: "1px solid #e5e7eb" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ maxWidth: "820px" }}>
                  <p style={{ margin: "8px 0 10px", color: "#4b5563" }}>
                    Follow this structure to create high-quality GCSE lessons (core + deeper knowledge done correctly).
                  </p>
                  <ol style={{ margin: 0, paddingLeft: "18px", color: "#111827", lineHeight: 1.6 }}>
                    <li>Click <b>Create lesson (manual)</b> or <b>Generate with AI</b></li>
                    <li>Fill lesson details and <b>save as Draft</b></li>
                    <li>Use multiple pages (Overview → Core → Check → Exam tips)</li>
                    <li>Put advanced content <b>ONLY</b> in <b>Deeper knowledge</b> blocks</li>
                    <li>Keep lesson as <b>Draft</b> and submit for review</li>
                  </ol>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "200px" }}>
                  <Link
                    to="/create-lesson"
                    style={{
                      padding: "10px 14px",
                      background: "#48bb78",
                      color: "white",
                      textDecoration: "none",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    + Create lesson (manual)
                  </Link>
                  <button
                    onClick={openChecklist}
                    style={{
                      padding: "10px 14px",
                      background: "white",
                      color: "#111827",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    View lesson checklist
                  </button>
                  <button
                    onClick={handleCopyGoldStandardLesson}
                    style={{
                      padding: "10px 14px",
                      background: "white",
                      color: "#111827",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                    title="Creates a copy of the gold-standard lesson as a new draft you can edit"
                  >
                    Copy gold-standard lesson
                  </button>
                </div>
              </div>
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
          {/* PR5: Coverage card (when taxonomy loaded); PR19: Quick setup; PR-UX-DASH-INNOV-1: collapsible */}
          {taxonomyUnits.length > 0 && (
            <>
            <div
              style={{
                marginBottom: "24px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setQuickSetupCollapsed(!quickSetupCollapsed)}
                style={{
                  width: "100%",
                  padding: "16px",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
                aria-expanded={!quickSetupCollapsed}
              >
                <div>
                  <h3 style={{ color: "#333", margin: 0, fontSize: "1rem", fontWeight: 600 }}>
                    Quick setup
                  </h3>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                    {quickSetupRemaining === 0 ? "All done ✅" : `${quickSetupRemaining} remaining`}
                  </div>
                </div>
                <span style={{ fontSize: "1.1rem", color: "#6b7280" }}>
                  {(quickSetupRemaining === 0 ? quickSetupCollapsed : quickSetupCollapsed) ? "▸" : "▾"}
                </span>
              </button>
              {!quickSetupCollapsed && (
              <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid #e5e7eb" }}>
              <ul style={{ margin: "16px 0 0 0", paddingLeft: 20, fontSize: 14, color: "#374151", listStyle: "disc" }}>
                <li style={{ marginBottom: 6 }}>
                  {quickSetup.noPracticeCount > 0 ? (
                    <Link to="/teacher/reports/needs-attention#setup" style={{ color: "#2563eb", textDecoration: "none" }}>
                      Attach practice to your published lessons
                    </Link>
                  ) : (
                    <span>Attach practice to your published lessons</span>
                  )}
                  {quickSetup.noPracticeCount > 0 && (
                    <span style={{ color: "#6b7280" }}> ({quickSetup.noPracticeCount})</span>
                  )}
                </li>
                <li style={{ marginBottom: 6 }}>
                  {quickSetup.uncoveredCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowUncoveredTopics(true)}
                      style={{ background: "none", border: "none", padding: 0, color: "#2563eb", cursor: "pointer", textDecoration: "none", fontSize: "inherit" }}
                    >
                      Cover remaining topics
                    </button>
                  ) : (
                    <span>Cover remaining topics</span>
                  )}
                  {quickSetup.uncoveredCount > 0 && (
                    <span style={{ color: "#6b7280" }}> ({quickSetup.uncoveredCount})</span>
                  )}
                </li>
                <li style={{ marginBottom: 6 }}>
                  {!quickSetup.hasUsedClassroomMode ? (
                    lessons.some((l) => l.isPublished) ? (
                      <Link to={`/teacher/classroom/${lessons.find((l) => l.isPublished)?._id ?? ""}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                        Try Classroom mode once
                      </Link>
                    ) : (
                      <span>Try Classroom mode once (publish a lesson first)</span>
                    )
                  ) : (
                    <span style={{ color: "#16a34a" }}>Try Classroom mode once ✓</span>
                  )}
                </li>
                <li>
                  {quickSetup.notReviewedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setFilterReadiness("NEEDS_REVIEW")}
                      style={{ background: "none", border: "none", padding: 0, color: "#2563eb", cursor: "pointer", textDecoration: "none", fontSize: "inherit" }}
                    >
                      Mark lessons reviewed
                    </button>
                  ) : (
                    <span>Mark lessons reviewed</span>
                  )}
                  {quickSetup.notReviewedCount > 0 && (
                    <span style={{ color: "#6b7280" }}> ({quickSetup.notReviewedCount})</span>
                  )}
                </li>
              </ul>
              </div>
              )}
            </div>
            <div
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <h3 style={{ color: "#333", margin: "0 0 4px 0", fontSize: "1rem", fontWeight: 600 }}>
                AQA GCSE Biology coverage
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
                  to="/teacher/reports/needs-attention"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "2px solid #dc2626",
                    background: "#fee2e2",
                    color: "#b91c1c",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Needs attention →
                </Link>
              </div>
              {/* PR5: Topics not yet covered (toggled by "View uncovered topics" CTA above) */}
              {coverage.uncoveredTopics.length > 0 && showUncoveredTopics && (
                    <div
                      style={{
                        marginTop: 12,
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
                  )}
              </div>
            </>
          )}

          {/* PR5: Filter bar (when taxonomy loaded) */}
          {taxonomyUnits.length > 0 && lessons.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                marginBottom: 16,
                padding: "12px 0",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                Unit:
                <select
                  value={filterUnit}
                  onChange={(e) => {
                    setFilterUnit(e.target.value);
                    setFilterTopicKey("all");
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                  }}
                >
                  <option value="all">All units</option>
                  {taxonomyUnits.map((u) => (
                    <option key={u.unit} value={u.unit}>
                      {u.unit}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                Topic:
                <select
                  value={filterTopicKey}
                  onChange={(e) => setFilterTopicKey(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    fontSize: 13,
                    minWidth: 180,
                  }}
                >
                  <option value="all">All topics</option>
                  {filterUnit === "all"
                    ? taxonomyUnits.map((u) => (
                        <optgroup key={u.unit} label={u.unit}>
                          {u.topics.map((t) => (
                            <option key={t.key} value={t.key}>
                              {t.topic}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    : taxonomyUnits
                        .filter((u) => u.unit === filterUnit)
                        .flatMap((u) => u.topics)
                        .map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.topic}
                          </option>
                        ))}
                </select>
              </label>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Tier:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "foundation", "higher"] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setFilterTier(tier)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid #d1d5db",
                      background: filterTier === tier ? "#e5e7eb" : "#fff",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: filterTier === tier ? 600 : 400,
                    }}
                  >
                    {tier === "all" ? "All" : tier === "foundation" ? "Foundation" : "Higher"}
                  </button>
                ))}
              </div>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Readiness:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "READY", "NEEDS_REVIEW", "DRAFT"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFilterReadiness(r)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: r === "NEEDS_REVIEW" ? "1px solid #fca5a5" : "1px solid #d1d5db",
                      background: filterReadiness === r ? (r === "NEEDS_REVIEW" ? "#fef2f2" : "#e5e7eb") : "#fff",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: filterReadiness === r ? 600 : 400,
                      color: r === "NEEDS_REVIEW" ? "#dc2626" : undefined,
                    }}
                  >
                    {r === "all" ? "All" : r === "READY" ? "Classroom-ready" : r === "NEEDS_REVIEW" ? "Needs review" : "Draft"}
                  </button>
                ))}
              </div>
              {hasNeedsAttention ? (
                <Link to="/teacher/reports/needs-attention" style={{ marginLeft: 8, textDecoration: "none" }}>
                  <button
                    type="button"
                    style={{
                      marginLeft: 0,
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "1px solid #dc2626",
                      background: "#fef2f2",
                      color: "#15803d",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#fee2e2";
                      e.currentTarget.style.borderColor = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#fef2f2";
                      e.currentTarget.style.borderColor = "#dc2626";
                    }}
                  >
                    Action needed
                  </button>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="No issues right now"
                  style={{
                    marginLeft: 8,
                    padding: "4px 12px",
                    borderRadius: 6,
                    border: "1px solid #d1d5db",
                    background: "#f3f4f6",
                    color: "#9ca3af",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "not-allowed",
                  }}
                >
                  Action needed
                </button>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <h2 style={{ color: "#333", margin: 0 }}>My Lessons</h2>
            <div style={{ color: "#666" }}>
              {filteredLessons.length} lesson{filteredLessons.length !== 1 ? "s" : ""}
              {filteredLessons.length !== lessons.length && ` (of ${lessons.length})`}
            </div>
          </div>

          {lessons.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div style={{ fontSize: "3rem", color: "#e2e8f0", marginBottom: "20px" }}>📚</div>
              <h3 style={{ color: "#666", marginBottom: "10px" }}>No lessons yet</h3>
              <p style={{ color: "#999" }}>Create your first lesson to start earning ShamCoins!</p>

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
          ) : filteredLessons.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#666" }}>
              No lessons match the current filters. Try changing Unit, Topic, or Tier.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {filteredLessons.map((lesson) => {
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
                      <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", fontWeight: 700, color: "#111827", lineHeight: 1.3 }}>
                        {lesson.title}
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
                        <span>{lesson.shamCoinPrice ?? 0} coins</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span>{lesson.purchaseCount ?? 0} purchases</span>
                        <span style={{ color: "#d1d5db" }}>|</span>
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>{lesson.totalEarnings ?? 0} coins earned</span>
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
                      <Link to={`/lesson/${lesson._id}`}>
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
                          View
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
                          Edit
                        </button>
                      </Link>
                      <button
                        onClick={() => navigate(`/lesson/${lesson._id}#practice`)}
                        style={{
                          width: 100,
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          color: "#374151",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Practice
                      </button>
                      <button
                        onClick={() => navigate(`/teacher/classroom/${lesson._id}`)}
                        style={{
                          width: 100,
                          height: 32,
                          padding: "0 12px",
                          borderRadius: 6,
                          border: "1px solid #22c55e",
                          background: "rgba(34,197,94,0.1)",
                          color: "#15803d",
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        Classroom
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
                          Report
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
                        {lesson.isPublished ? "Unpublish" : "Publish"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        </main>

        {/* RIGHT: Teacher tools + compact stats (vertical stack) */}
        <aside className="teacher-dashboard-right" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "white", padding: 16, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            <h3 style={{ color: "#333", margin: "0 0 12px 0", fontSize: "1rem" }}>Teacher tools</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link to="/teacher/worksheets/needs-marking" style={{ padding: "10px 14px", background: "#fef3c7", color: "#92400e", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #f59e0b", textAlign: "center" }}>📋 Needs marking</Link>
              <Link to="/teacher/reports/needs-attention" style={{ padding: "10px 14px", background: "rgba(220,38,38,0.08)", color: "#dc2626", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "2px solid #dc2626", textAlign: "center" }}>Needs attention →</Link>
              <button type="button" onClick={handleViewAnalytics} style={{ padding: "10px 14px", background: "#667eea", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%" }}>📊 View analytics</button>
              <button type="button" onClick={handleCashOut} style={{ padding: "10px 14px", background: "#ed8936", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%" }}>💰 Cash out earnings</button>
              <button type="button" onClick={fixEarnings} style={{ padding: "10px 14px", background: "#9f7aea", color: "white", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "100%" }}>🔧 Fix earnings</button>
              <Link to="/dashboard" style={{ padding: "10px 14px", background: "white", color: "#374151", textDecoration: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, border: "1px solid #d1d5db", textAlign: "center" }}>Main Dashboard</Link>
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

        {/* ✅ AI Modal */}
        {aiOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              zIndex: 9999,
            }}
            onClick={() => (aiLoading ? null : setAiOpen(false))}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "620px",
                background: "white",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 12px 30px rgba(0,0,0,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px" }}>
                <div>
                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>Subject</label>
                  <select
                    value={aiForm.subject}
                    onChange={(e) => {
                      setAiError("");
                      setAiForm((p) => ({ ...p, subject: e.target.value }));
                    }}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  >
                    <option>Biology</option>
                    <option>Chemistry</option>
                    <option>Physics</option>
                    <option>Mathematics</option>
                    <option>English</option>
                  </select>
                </div>

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

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>Topic</label>
                  <input
                    value={aiForm.topic}
                    onChange={(e) => {
                      setAiError("");
                      setAiForm((p) => ({ ...p, topic: e.target.value }));
                    }}
                    placeholder="e.g. Photosynthesis"
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "0.85rem", color: "#374151" }}>Exam board (optional)</label>
                  <input
                    value={aiForm.board}
                    onChange={(e) => {
                      setAiError("");
                      setAiForm((p) => ({ ...p, board: e.target.value }));
                    }}
                    placeholder="e.g. AQA (or leave blank)"
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e5e7eb" }}
                  />
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
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
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