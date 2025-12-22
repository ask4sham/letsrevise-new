import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { supabase } from "../lib/supabaseClient";

const TeacherDashboard: React.FC = () => {
  const [lessons, setLessons] = useState<any[]>([]);
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

        // 2) Load Supabase lessons (UUID-based)
        await fetchLessonsFromSupabase(parsedUser);

        // 3) Load teacher stats (earnings, purchases, etc.)
        await fetchTeacherStatsFromBackend();
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLessonsFromSupabase = async (parsedUser?: any) => {
    try {
      const teacherId = parsedUser?._id || parsedUser?.id || null;

      // If we don't have a teacherId yet, we still fetch lessons (fallback) to avoid blank dashboard
      let query = supabase
        .from("lessons")
        .select(
          `
          id,
          title,
          subject,
          level,
          lesson_notes,
          teacher_id,
          is_published,
          created_at
        `
        )
        .order("created_at", { ascending: false });

      if (teacherId) {
        query = query.eq("teacher_id", teacherId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase lessons fetch error:", error);
        setLessons([]);
        // Keep stats counts consistent with lessons list
        setStats((prev) => ({
          ...prev,
          totalLessons: 0,
          publishedLessons: 0,
          draftLessons: 0,
        }));
        return;
      }

      const mapped = (data || []).map((l: any) => {
        // Map to the shape your existing UI expects (without changing UI code)
        return {
          _id: String(l.id), // IMPORTANT: _id becomes UUID so existing links work
          id: String(l.id),

          title: l.title ?? "Untitled Lesson",
          subject: l.subject ?? "Not set",
          level: l.level ?? "Not set",

          // Your table UI expects these, keep safe fallbacks
          shamCoinPrice: 0,
          purchaseCount: 0,
          totalEarnings: 0,
          averageRating: 0,
          views: 0,

          // publish state
          isPublished: Boolean(l.is_published),

          // dates
          createdAt: l.created_at ?? new Date().toISOString(),
        };
      });

      setLessons(mapped);

      // Recompute counts from Supabase lessons (robust + consistent)
      const totalLessons = mapped.length;
      const publishedLessons = mapped.filter((x: any) => x.isPublished).length;
      const draftLessons = totalLessons - publishedLessons;

      setStats((prev) => ({
        ...prev,
        totalLessons,
        publishedLessons,
        draftLessons,
      }));
    } catch (err) {
      console.error("Error fetching lessons from Supabase:", err);
    }
  };

  const fetchTeacherStatsFromBackend = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        "http://localhost:5000/api/lessons/teacher/stats",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Safely handle null / undefined response bodies
      const statsData = response?.data || {};

      setStats((prev) => ({
        ...prev,
        totalEarnings:
          statsData.totalEarnings !== undefined &&
          statsData.totalEarnings !== null
            ? statsData.totalEarnings
            : prev.totalEarnings,
        totalPurchases:
          statsData.totalPurchases !== undefined &&
          statsData.totalPurchases !== null
            ? statsData.totalPurchases
            : prev.totalPurchases,
        averageRating:
          statsData.averageRating !== undefined &&
          statsData.averageRating !== null
            ? statsData.averageRating
            : prev.averageRating,
        monthlyEarnings: Array.isArray(statsData.monthlyEarnings)
          ? statsData.monthlyEarnings
          : prev.monthlyEarnings,
      }));
    } catch (err) {
      console.error("Error fetching teacher stats:", err);
      // Keep previous stats (initially zeros) if the request fails
    }
  };

  const handlePublishToggle = async (
    lessonId: string,
    isCurrentlyPublished: boolean
  ) => {
    try {
      // Publish/unpublish is now done in Supabase so LessonViewPage stays consistent
      const { error } = await supabase
        .from("lessons")
        .update({ is_published: !isCurrentlyPublished })
        .eq("id", lessonId);

      if (error) {
        console.error("Supabase publish toggle error:", error);
        alert("Failed to update lesson status");
        return;
      }

      alert(
        isCurrentlyPublished
          ? "Lesson unpublished successfully!"
          : "Lesson published successfully!"
      );

      // Refresh lessons + counts
      const userData = localStorage.getItem("user");
      const parsedUser = userData ? JSON.parse(userData) : null;
      await fetchLessonsFromSupabase(parsedUser);

      // Keep backend stats refreshed too (earnings/purchases chart)
      await fetchTeacherStatsFromBackend();
    } catch (err) {
      console.error("Error updating lesson status:", err);
      alert("Failed to update lesson status");
    }
  };

  const handleCashOut = async () => {
    console.log("=== CASH OUT DEBUG ===");
    console.log(
      "Cash out attempt. Total earnings from stats:",
      stats.totalEarnings
    );
    console.log("User earnings from state:", user?.earnings);
    console.log("User object:", user);

    if (stats.totalEarnings <= 0) {
      alert("You have no earnings to cash out!");
      return;
    }

    if (
      !window.confirm(
        `Do you want to cash out ${stats.totalEarnings} ShamCoins?`
      )
    ) {
      return;
    }

    try {
      const token = localStorage.getItem("token");
      console.log("Sending cash out request with amount:", stats.totalEarnings);
      console.log("Token exists:", !!token);

      const response = await axios.post(
        "http://localhost:5000/api/earnings/cashout",
        { amount: stats.totalEarnings },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("Cash out successful! Response:", response.data);
      alert(
        `Success! ${response.data.message}\nNew Balance: ${response.data.newBalance} coins\nRemaining Earnings: ${response.data.remainingEarnings} coins`
      );

      // Refresh user data
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
      console.error("=== CASH OUT ERROR DETAILS ===");
      console.error("Full error object:", err);
      console.error("Error response data:", err.response?.data);
      console.error("Error status:", err.response?.status);
      console.error("Error message:", err.message);
      alert(
        err.response?.data?.message ||
          "Cash out failed. Please check console for details."
      );
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
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:5000/api/earnings/fix-earnings",
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(
        `Fixed! ${response.data.message}\nNew Earnings: ${response.data.newEarnings} coins\nRemaining ShamCoins: ${response.data.newShamCoins} coins`
      );

      // Refresh user data
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
      alert(err.response?.data?.message || "Fix failed");
    }
  };

  const handleViewAnalytics = () => {
    navigate("/analysis");
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Dashboard...</h2>
      </div>
    );
  }

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
            <h1 style={{ color: "#333", marginBottom: "5px" }}>
              👨‍🏫 Teacher Dashboard
            </h1>
            <p style={{ color: "#666" }}>
              Welcome back, {user?.firstName}! Manage your lessons and track
              your earnings.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
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
            <Link
              to="/dashboard"
              style={{ color: "#667eea", textDecoration: "none" }}
            >
              Back to Main Dashboard
            </Link>
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
            <div
              style={{ fontSize: "2rem", color: "#667eea", marginBottom: "10px" }}
            >
              📚
            </div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>
              {stats.totalLessons}
            </h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>
              Total Lessons Created
            </p>
          </div>

          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{ fontSize: "2rem", color: "#48bb78", marginBottom: "10px" }}
            >
              👁️
            </div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>
              {stats.publishedLessons}
            </h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>
              Published Lessons
            </p>
          </div>

          <div
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{ fontSize: "2rem", color: "#ed8936", marginBottom: "10px" }}
            >
              💰
            </div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>
              {stats.totalEarnings} ShamCoins
            </h3>
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
            <div
              style={{ fontSize: "2rem", color: "#9f7aea", marginBottom: "10px" }}
            >
              🛒
            </div>
            <h3 style={{ color: "#333", marginBottom: "5px" }}>
              {stats.totalPurchases}
            </h3>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>
              Total Purchases
            </p>
          </div>
        </div>

        {/* Earnings Chart (Analytics) */}
        {stats.monthlyEarnings.length > 0 && (
          <div
            id="teacher-analytics"
            style={{
              background: "white",
              padding: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              marginBottom: "30px",
            }}
          >
            <h3 style={{ color: "#333", marginBottom: "20px" }}>
              Monthly Earnings
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "10px",
                height: "150px",
                padding: "20px 0",
              }}
            >
              {stats.monthlyEarnings.map((item: any, index: number) => (
                <div key={index} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    style={{
                      height: `${
                        (item.earnings /
                          Math.max(
                            ...stats.monthlyEarnings.map(
                              (e: any) => e.earnings
                            )
                          )) * 100
                      }px`,
                      background: "#48bb78",
                      borderRadius: "4px",
                      marginBottom: "10px",
                    }}
                  ></div>
                  <div style={{ fontSize: "0.8rem", color: "#666" }}>
                    {item.month}
                  </div>
                  <div
                    style={{ fontSize: "0.9rem", fontWeight: "bold" }}
                  >
                    {item.earnings}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
              <div
                style={{
                  fontSize: "3rem",
                  color: "#e2e8f0",
                  marginBottom: "20px",
                }}
              >
                📚
              </div>
              <h3 style={{ color: "#666", marginBottom: "10px" }}>
                No lessons yet
              </h3>
              <p style={{ color: "#999" }}>
                Create your first lesson to start earning ShamCoins!
              </p>
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
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Title
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Subject
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Level
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Price
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Purchases
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Earnings
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "12px",
                        color: "#666",
                        fontWeight: "bold",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson: any) => (
                    <tr
                      key={lesson._id}
                      style={{ borderBottom: "1px solid #e2e8f0" }}
                    >
                      <td style={{ padding: "12px" }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            color: "#333",
                          }}
                        >
                          {lesson.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#666",
                          }}
                        >
                          {new Date(lesson.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td style={{ padding: "12px", color: "#666" }}>
                        {lesson.subject}
                      </td>
                      <td style={{ padding: "12px", color: "#666" }}>
                        {lesson.level}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#666",
                          fontWeight: "bold",
                        }}
                      >
                        {lesson.shamCoinPrice} coins
                      </td>
                      <td style={{ padding: "12px", color: "#666" }}>
                        {lesson.purchaseCount || 0}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          color: "#48bb78",
                          fontWeight: "bold",
                        }}
                      >
                        {lesson.totalEarnings || 0} coins
                      </td>
                      <td style={{ padding: "12px" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            background: lesson.isPublished
                              ? "#c6f6d5"
                              : "#fed7d7",
                            color: lesson.isPublished
                              ? "#22543d"
                              : "#742a2a",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            fontWeight: "bold",
                          }}
                        >
                          {lesson.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Link to={`/teacher/lesson/${lesson._id}`}>
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
                            onClick={() =>
                              handlePublishToggle(
                                lesson._id,
                                lesson.isPublished
                              )
                            }
                            style={{
                              padding: "6px 12px",
                              background: lesson.isPublished
                                ? "#fed7d7"
                                : "#48bb78",
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
          <h3 style={{ color: "#333", marginBottom: "20px" }}>
            Quick Actions
          </h3>
          <div style={{ display: "flex", gap: "15px", flexWrap: "wrap" }}>
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
      </div>
    </div>
  );
};

export default TeacherDashboard;
