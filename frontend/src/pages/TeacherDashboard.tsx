import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

type LessonRow = {
  _id: string;
  id?: string;
  title: string;
  subject: string;
  level: string;
  shamCoinPrice?: number;
  purchaseCount?: number;
  totalEarnings?: number;
  averageRating?: number;
  views?: number;
  isPublished: boolean;
  createdAt: string;
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

  const navigate = useNavigate();

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

        shamCoinPrice: l.shamCoinPrice ?? 0,
        purchaseCount: l.purchaseCount ?? 0,
        totalEarnings: l.totalEarnings ?? 0,
        averageRating: l.averageRating ?? 0,
        views: l.views ?? 0,

        isPublished: Boolean(l.isPublished),

        createdAt: l.createdAt ?? l.created_at ?? new Date().toISOString(),
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
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "30px",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div>
            <h1 style={{ color: "#333", marginBottom: "5px" }}>👨‍🏫 Teacher Dashboard</h1>
            <p style={{ color: "#666" }}>
              Welcome back, {user?.firstName}! Manage your lessons and track your earnings.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
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

            {/* ✅ NEW: AI button in header */}
            <button
              onClick={openAiModal}
              style={{
                padding: "10px 16px",
                background: "#111827",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
              title="Generate a full draft lesson with AI, then edit & publish"
            >
              ⚡ AI Generate Lesson
            </button>

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
              + Create New Lesson
            </Link>

            <Link to="/dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
              Back to Main Dashboard
            </Link>
          </div>
        </div>

        {/* ✅ Pinned: Start Here card */}
        <div
          style={{
            background: "white",
            padding: "18px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "20px",
            borderLeft: "6px solid #48bb78",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ maxWidth: "820px" }}>
              <h2 style={{ margin: 0, color: "#111827" }}>👉 Start here: How to create a lesson</h2>
              <p style={{ margin: "8px 0 10px", color: "#4b5563" }}>
                Follow this structure to create high-quality GCSE lessons (core + deeper knowledge done correctly).
              </p>

              <ol style={{ margin: 0, paddingLeft: "18px", color: "#111827", lineHeight: 1.6 }}>
                <li>Click <b>Create New Lesson</b></li>
                <li>Fill lesson details and <b>save as Draft</b></li>
                <li>Use multiple pages (Overview → Core → Check → Exam tips)</li>
                <li>Put advanced content <b>ONLY</b> in <b>Deeper knowledge</b> blocks</li>
                <li>Keep lesson as <b>Draft</b> and submit for review</li>
              </ol>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: "240px" }}>
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
                + Create Lesson
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

              {/* ✅ NEW: Assessment Paper Builder Link */}
              <Link
                to="/assessments/papers/builder"
                style={{
                  padding: "10px 14px",
                  background: "#4f46e5",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                📝 Assessment Papers
              </Link>

              <Link
                to="/teacher/exam-question-bank"
                style={{
                  padding: "10px 14px",
                  background: "#4f46e5",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                📋 Create Questions
              </Link>
            </div>
          </div>
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
              {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
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
                  ⚡ AI Generate Lesson
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
                  Create Your First Lesson
                </Link>
              </div>
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson) => (
                    <tr key={lesson._id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px" }}>
                        <div style={{ fontWeight: "bold", color: "#333" }}>{lesson.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>
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
                        </div>
                      </td>
                    </tr>
                  ))}
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
              ⚡ AI Generate Lesson
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
              <span>+</span> Create New Lesson
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
                  <h3 style={{ margin: 0, color: "#111827" }}>⚡ AI Generate Lesson</h3>
                  <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: "0.9rem" }}>
                    AI creates a full draft lesson → you edit it → then publish.
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