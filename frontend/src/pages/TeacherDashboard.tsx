import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

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
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header — 3 explicit rows: title+ShamCoins | buttons | helper */}
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

          {/* Row 2: Action buttons (Create+AI group, then outline buttons) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "6px",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <Link
                to="/create-lesson"
                style={{
                  padding: "10px 20px",
                  background: "#48bb78",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "6px",
                  fontWeight: "bold",
                }}
              >
                + Create lesson (manual)
              </Link>
              <button
                type="button"
                onClick={openAiModal}
                style={{
                  padding: "10px 16px",
                  background: "#0d6efd",
                  color: "#fff",
                  border: "1px solid #0d6efd",
                  borderRadius: "6px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
                title="Generate a first draft lesson from a topic (template + AI content)"
              >
                ✨ Generate with AI
              </button>
            </div>
            <Link
              to="/browse-lessons"
              style={{
                padding: "10px 16px",
                background: "white",
                color: "#374151",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "600",
                border: "1px solid #d1d5db",
              }}
            >
              Browse Lessons
            </Link>
            <Link
              to="/assessments/papers/builder"
              style={{
                padding: "10px 16px",
                background: "white",
                color: "#374151",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "600",
                border: "1px solid #d1d5db",
              }}
            >
              📝 Assessment Papers
            </Link>
            <Link
              to="/teacher/exam-question-bank"
              style={{
                padding: "10px 16px",
                background: "white",
                color: "#374151",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "600",
                border: "1px solid #d1d5db",
              }}
            >
              Create Questions
            </Link>
            <Link
              to="/dashboard"
              style={{
                padding: "10px 16px",
                background: "white",
                color: "#374151",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "600",
                border: "1px solid #d1d5db",
              }}
            >
              Main Dashboard
            </Link>
          </div>

          {/* Row 3: AI helper (bigger + bolder) */}
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#1f6feb", marginBottom: "14px" }}>
            AI: optional first-draft from a topic. May be limited during rollout.
          </div>
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

        {/* Teacher Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "2rem", color: "#667eea", marginBottom: "10px" }}>📚</div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>{stats.totalLessons}</h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Total Lessons Created</p>
          </div>

          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "2rem", color: "#48bb78", marginBottom: "10px" }}>👁️</div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>{stats.publishedLessons}</h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Published Lessons</p>
          </div>

          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "2rem", color: "#ed8936", marginBottom: "10px" }}>💰</div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>{stats.totalEarnings} ShamCoins</h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Total Earnings</p>
          </div>

          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "2rem", color: "#9f7aea", marginBottom: "10px" }}>🛒</div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>{stats.totalPurchases}</h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>Total Purchases</p>
          </div>
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
          {/* PR5: Coverage card (when taxonomy loaded); PR19: Quick setup */}
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
              <h3 style={{ color: "#333", margin: "0 0 12px 0", fontSize: "1rem" }}>
                Quick setup
              </h3>
              <ul style={{ margin: "0 0 16px 0", paddingLeft: 20, fontSize: 14, color: "#374151", listStyle: "disc" }}>
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
            <div
              style={{
                marginBottom: "20px",
                padding: "16px",
                borderRadius: "10px",
                border: "1px solid #e5e7eb",
                background: "#f9fafb",
              }}
            >
              <h3 style={{ color: "#333", margin: "0 0 12px 0", fontSize: "1rem" }}>
                AQA GCSE Biology coverage
              </h3>
              <div style={{ color: "#374151", fontSize: "14px", marginBottom: 8 }}>
                Covered: {coverage.coveredCount} / {coverage.totalCount} topics
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: "#e5e7eb",
                  overflow: "hidden",
                  marginBottom: 8,
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
              <div style={{ color: "#6b7280", fontSize: "12px", marginBottom: 8 }}>
                Required Practicals covered: {coverage.coveredRPs} / {coverage.rpTotal}
              </div>
              <Link
                to="/teacher/reports/attempts"
                style={{ fontSize: 13, color: "#2563eb", textDecoration: "none" }}
              >
                Practice monitoring
              </Link>
              {" · "}
              <Link
                to="/teacher/reports/needs-attention"
                style={{ fontSize: 13, color: "#dc2626", fontWeight: 600, textDecoration: "none" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                  e.currentTarget.style.color = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                  e.currentTarget.style.color = "#dc2626";
                }}
              >
                Needs attention →
              </Link>
              {/* PR5: Collapsible "Topics not yet covered" */}
              {coverage.uncoveredTopics.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowUncoveredTopics((v) => !v)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#4b5563",
                      fontSize: "13px",
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    {showUncoveredTopics ? "Hide" : "Show"} topics not yet covered
                  </button>
                  {showUncoveredTopics && (
                    <div
                      style={{
                        marginTop: 8,
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
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Title
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Subject
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Level
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Price
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Purchases
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Earnings
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Status
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Readiness
                    </th>
                    <th style={{ textAlign: "left", padding: "12px", color: "#666", fontWeight: "bold" }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
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
                    return (
                    <tr key={lesson._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: "bold", color: "#333" }}>{lesson.title}</div>
                        <div style={{ fontSize: "12px", color: "#666", opacity: 0.85, marginTop: 2 }}>
                          {subtitle}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
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
                        {/* PR5: Coverage badge */}
                        <div style={{ fontSize: "11px", marginTop: 4, color: "#6b7280" }}>
                          {lesson.isPublished ? (
                            <span style={{ color: "#16a34a" }}>✓ Counts toward coverage</span>
                          ) : (
                            <span>Draft (not counted)</span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#999", marginTop: 4 }}>
                          {new Date(lesson.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: "12px", color: "#666" }}>{lesson.subject}</td>
                      <td style={{ padding: "12px", color: "#666" }}>{lesson.level}</td>
                      <td style={{ padding: "12px", color: "#666", fontWeight: "bold" }}>
                        {lesson.shamCoinPrice ?? 0} coins
                      </td>
                      <td style={{ padding: "12px", color: "#666" }}>{lesson.purchaseCount ?? 0}</td>
                      <td style={{ padding: "12px", color: "#48bb78", fontWeight: "bold" }}>
                        {lesson.totalEarnings ?? 0} coins
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            background: lesson.isPublished ? "#c6f6d5" : "#fed7d7",
                            color: lesson.isPublished ? "#22543d" : "#742a2a",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            fontWeight: "bold",
                          }}
                        >
                          {lesson.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        {(() => {
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
                            <div>
                              <span
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "20px",
                                  fontSize: "0.8rem",
                                  fontWeight: "bold",
                                  background:
                                    status === "READY"
                                      ? "#c6f6d5"
                                      : status === "NEEDS_REVIEW"
                                        ? "#fef3c7"
                                        : "#e5e7eb",
                                  color:
                                    status === "READY"
                                      ? "#22543d"
                                      : status === "NEEDS_REVIEW"
                                        ? "#92400e"
                                        : "#4b5563",
                                }}
                              >
                                {status === "READY" ? "Classroom-ready" : status === "NEEDS_REVIEW" ? "Needs review" : "Draft"}
                              </span>
                              {missingText.length > 0 && (
                                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                  Missing: {missingText.join(", ")}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <Link to={`/edit-lesson/${lesson._id}`}>
                            <button
                              style={{
                                padding: "6px 12px",
                                background: "#e2e8f0",
                                color: "#333",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              Edit
                            </button>
                          </Link>

                          <button
                            onClick={() => handlePublishToggle(lesson._id, lesson.isPublished)}
                            style={{
                              padding: "6px 12px",
                              background: lesson.isPublished ? "#fed7d7" : "#48bb78",
                              color: "white",
                              border: "none",
                              borderRadius: "4px",
                              cursor: "pointer",
                              fontSize: "0.8rem",
                            }}
                          >
                            {lesson.isPublished ? "Unpublish" : "Publish"}
                          </button>

                          <Link to={`/lesson/${lesson._id}`}>
                            <button
                              style={{
                                padding: "6px 12px",
                                background: "#4299e1",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                              }}
                            >
                              View
                            </button>
                          </Link>

                          <button
                            onClick={() => navigate(`/lesson/${lesson._id}#practice`)}
                            style={{
                              marginLeft: 4,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #ddd",
                              background: "#fff",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            Practice
                          </button>

                          <button
                            onClick={() => navigate(`/teacher/classroom/${lesson._id}`)}
                            style={{
                              marginLeft: 4,
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #22c55e",
                              background: "rgba(34,197,94,0.1)",
                              color: "#15803d",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            Classroom
                          </button>

                          <Link to={`/teacher/reports/lesson/${lesson.id}`}>
                            <button
                              type="button"
                              style={{
                                marginLeft: 4,
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: "1px solid #6366f1",
                                background: "rgba(99,102,241,0.1)",
                                color: "#4f46e5",
                                cursor: "pointer",
                                fontSize: 12,
                              }}
                            >
                              Report
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ color: "#333", marginBottom: "20px" }}>Quick Actions</h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
            {/* ✅ NEW: AI button in quick actions */}
            <button
              onClick={openAiModal}
              style={{
                padding: "12px 24px",
                background: "#111827",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              ✨ Generate with AI
            </button>

            <Link
              to="/create-lesson"
              style={{
                padding: "12px 24px",
                background: "#48bb78",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>+</span> Create lesson (manual)
            </Link>

            {/* ✅ NEW: Assessment Paper Builder in Quick Actions */}
            <Link
              to="/assessments/papers/builder"
              style={{
                padding: "12px 24px",
                background: "#4f46e5",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📝 Assessment Papers
            </Link>

            <Link
              to="/teacher/exam-question-bank"
              style={{
                padding: "12px 24px",
                background: "#4f46e5",
                color: "white",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📋 Create Questions
            </Link>

            <Link
              to="/teacher/reports/needs-attention"
              style={{
                padding: "12px 24px",
                background: "rgba(220,38,38,0.08)",
                color: "#dc2626",
                textDecoration: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                border: "2px solid #dc2626",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              Needs attention →
            </Link>

            <button
              onClick={handleViewAnalytics}
              style={{
                padding: "12px 24px",
                background: "#667eea",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📊 View Analytics
            </button>

            <button
              onClick={handleCashOut}
              style={{
                padding: "12px 24px",
                background: "#ed8936",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              💰 Cash Out Earnings
            </button>

            <button
              onClick={fixEarnings}
              style={{
                padding: "12px 24px",
                background: "#9f7aea",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🔧 Fix Earnings
            </button>
          </div>
        </div>

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