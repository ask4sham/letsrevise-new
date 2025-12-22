import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ExamBoardRow = { name: string };

type SupabaseLessonRow = {
  id: string;
  title: string | null;
  subject: string | null;
  level: string | null;
  stage: string | null;
  years: string | number | null;
  lesson_notes: string | null;
  teacher_id: string | null;
  is_published: boolean | null;
  created_at: string | null;
  // GCSE tier (optional)
  tier?: string | null;
  exam_board?: ExamBoardRow[] | ExamBoardRow | null;
};

type StudentLessonCard = {
  id: string; // UUID
  title: string;
  description: string;
  subject: string;
  level: string;
  stage: string;
  years: string | number | null;
  teacherName: string;
  teacherId: string;
  estimatedDuration: number;
  shamCoinPrice: number;
  views: number;
  averageRating: number;
  createdAt: string;
  examBoardName: string | null;
  tier: string; // '' | foundation | higher
};

function getBoardName(exam_board: ExamBoardRow[] | ExamBoardRow | null | undefined): string | null {
  if (Array.isArray(exam_board)) return exam_board[0]?.name ?? null;
  if (exam_board && typeof exam_board === "object" && "name" in exam_board) {
    return (exam_board as ExamBoardRow).name ?? null;
  }
  return null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const EXAM_BOARDS = ["AQA", "OCR", "Edexcel", "WJEC"] as const;

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [lessons, setLessons] = useState<StudentLessonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [filters, setFilters] = useState({
    subject: "",
    level: "",
    tier: "",
    examBoard: "",
    search: "",
  });

  useEffect(() => {
    fetchUserData();
    fetchPublishedLessonsFromSupabase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserData = () => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (err) {
        console.error("Error parsing user data:", err);
      }
    }
  };

  const fetchPublishedLessonsFromSupabase = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("lessons")
        .select(
          `
            id,
            title,
            subject,
            level,
            stage,
            years,
            lesson_notes,
            teacher_id,
            is_published,
            created_at,
            tier,
            exam_board:exam_boards(name)
          `
        )
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("Supabase error fetching lessons:", error);
        setLessons([]);
        return;
      }

      const raw = (data ?? []) as unknown as SupabaseLessonRow[];

      const mapped: StudentLessonCard[] = raw.map((l) => {
        const examBoardName = getBoardName(l.exam_board ?? null);

        const safeTitle = String(l.title ?? "Untitled Lesson");
        const safeNotes = String(l.lesson_notes ?? "");
        const safeSubject = String(l.subject ?? "Not set");
        const safeLevel = String(l.level ?? "Not set");
        const safeStage = String(l.stage ?? "Not set");
        const safeCreatedAt = String(l.created_at ?? new Date().toISOString());
        const safeTier = String(l.tier ?? "").toLowerCase();

        const description =
          examBoardName
            ? `Exam board: ${examBoardName}`
            : safeNotes.trim().length > 0
            ? safeNotes.trim().slice(0, 160) + (safeNotes.trim().length > 160 ? "…" : "")
            : "No description yet.";

        return {
          id: String(l.id),
          title: safeTitle,
          description,
          subject: safeSubject,
          level: safeLevel,
          stage: safeStage,
          years: l.years ?? null,
          teacherName: "Teacher",
          teacherId: String(l.teacher_id ?? ""),
          estimatedDuration: 0,
          shamCoinPrice: 0,
          views: 0,
          averageRating: 0,
          createdAt: safeCreatedAt,
          examBoardName,
          tier: safeTier,
        };
      });

      setLessons(mapped);
    } catch (err) {
      console.error("Error fetching lessons from Supabase:", err);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLessons = useMemo(() => {
    let filtered = [...lessons];

    if (filters.subject) {
      filtered = filtered.filter((lesson) => lesson.subject === filters.subject);
    }

    if (filters.level) {
      filtered = filtered.filter((lesson) => lesson.level === filters.level);
    }

    // GCSE tier filter – only applies when Level = GCSE
    if (filters.level === "GCSE" && filters.tier) {
      const desired = filters.tier.toLowerCase();
      filtered = filtered.filter(
        (lesson) =>
          lesson.level === "GCSE" &&
          (lesson.tier || "").toLowerCase() === desired
      );
    }

    // Exam board filter
    if (filters.examBoard) {
      filtered = filtered.filter(
        (lesson) => (lesson.examBoardName || "") === filters.examBoard
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((lesson) =>
        [
          lesson.title,
          lesson.description,
          lesson.subject,
          lesson.level,
          lesson.stage,
          String(lesson.years ?? ""),
          lesson.teacherName,
          lesson.examBoardName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchLower)
      );
    }

    return filtered;
  }, [filters, lessons]);

  const handleFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    // If level changes, reset tier when not GCSE
    if (name === "level") {
      setFilters((prev) => ({
        ...prev,
        level: value,
        tier: value === "GCSE" ? prev.tier : "",
      }));
      return;
    }

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Get Access / Purchase goes to the lesson page (MVP)
  const handlePurchase = async (lessonId: string) => {
    navigate(`/lesson/${lessonId}`);
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lessons...</h2>
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
            <h1 style={{ color: "#333", marginBottom: "5px" }}>👨‍🎓 Student Dashboard</h1>
            <p style={{ color: "#666" }}>
              Welcome back, {user?.firstName}! Browse and purchase lessons from expert
              teachers.
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
            <Link to="/dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
              Back to Main Dashboard
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div
          style={{
            background: "white",
            padding: "25px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "30px",
          }}
        >
          <h3 style={{ color: "#333", marginBottom: "20px" }}>Filter Lessons</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
            }}
          >
            {/* Subject */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#666",
                  fontWeight: "bold",
                }}
              >
                Subject
              </label>
              <select
                name="subject"
                value={filters.subject}
                onChange={handleFilterChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              >
                <option value="">All Subjects</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="English">English</option>
                <option value="History">History</option>
                <option value="Geography">Geography</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Economics">Economics</option>
                <option value="Business">Business</option>
              </select>
            </div>

            {/* Level */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#666",
                  fontWeight: "bold",
                }}
              >
                Level
              </label>
              <select
                name="level"
                value={filters.level}
                onChange={handleFilterChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              >
                <option value="">All Levels</option>
                <option value="KS3">KS3</option>
                <option value="GCSE">GCSE</option>
                <option value="A-Level">A-Level</option>
              </select>
            </div>

            {/* Tier – only when GCSE selected */}
            {filters.level === "GCSE" && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    color: "#666",
                    fontWeight: "bold",
                  }}
                >
                  Tier
                </label>
                <select
                  name="tier"
                  value={filters.tier}
                  onChange={handleFilterChange}
                  style={{
                    width: "100%",
                    padding: "10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "6px",
                  }}
                >
                  <option value="">All tiers</option>
                  <option value="foundation">Foundation</option>
                  <option value="higher">Higher</option>
                </select>
              </div>
            )}

            {/* Exam Board */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#666",
                  fontWeight: "bold",
                }}
              >
                Exam Board
              </label>
              <select
                name="examBoard"
                value={filters.examBoard}
                onChange={handleFilterChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              >
                <option value="">All boards</option>
                {EXAM_BOARDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div style={{ gridColumn: "span 2" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#666",
                  fontWeight: "bold",
                }}
              >
                Search
              </label>
              <input
                type="text"
                name="search"
                placeholder="Search by title, subject, stage, board..."
                value={filters.search}
                onChange={handleFilterChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                }}
              />
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ color: "#333", margin: 0 }}>Available Lessons</h2>
          <div style={{ color: "#666" }}>
            {filteredLessons.length} lesson{filteredLessons.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Lessons Grid */}
        {filteredLessons.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              background: "white",
              padding: "60px 30px",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ fontSize: "4rem", color: "#e2e8f0", marginBottom: "20px" }}>🔍</div>
            <h3 style={{ color: "#666", marginBottom: "10px" }}>No lessons found</h3>
            <p style={{ color: "#999" }}>
              Try changing your filters or check back later for new lessons.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "25px",
            }}
          >
            {filteredLessons.map((lesson) => {
              const isPurchased = user?.purchasedLessons?.some(
                (p: any) => p.lessonId === lesson.id
              );

              const canAfford = (user?.shamCoins || 0) >= lesson.shamCoinPrice;
              const buttonText = isPurchased
                ? "Purchased"
                : !canAfford
                ? "Not Enough Coins"
                : lesson.shamCoinPrice === 0
                ? "Get Access"
                : `Purchase (${lesson.shamCoinPrice} coins)`;

              return (
                <div
                  key={lesson.id}
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      padding: "20px",
                      color: "white",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1.25rem" }}>{lesson.title}</h3>
                    <p
                      style={{
                        margin: "5px 0 0 0",
                        opacity: 0.9,
                        fontSize: "0.9rem",
                      }}
                    >
                      By {lesson.teacherName}
                    </p>
                  </div>

                  <div style={{ padding: "20px", flexGrow: 1 }}>
                    <p
                      style={{
                        color: "#666",
                        lineHeight: "1.5",
                        marginBottom: "15px",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {lesson.description}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        marginBottom: "15px",
                      }}
                    >
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "#e2e8f0",
                          borderRadius: "20px",
                          fontSize: "0.8rem",
                          color: "#4a5568",
                        }}
                      >
                        {lesson.subject}
                      </span>
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "#bee3f8",
                          borderRadius: "20px",
                          fontSize: "0.8rem",
                          color: "#2c5282",
                        }}
                      >
                        {lesson.level}
                      </span>
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "#fed7d7",
                          borderRadius: "20px",
                          fontSize: "0.8rem",
                          color: "#c53030",
                        }}
                      >
                        {lesson.stage} • Year {String(lesson.years ?? "—")}
                      </span>
                      <span
                        style={{
                          padding: "4px 10px",
                          background: "#fef3c7",
                          borderRadius: "20px",
                          fontSize: "0.8rem",
                          color: "#92400e",
                        }}
                      >
                        {lesson.examBoardName ?? "Board not set"}
                      </span>
                      {lesson.level === "GCSE" && lesson.tier && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "#e9d5ff",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            color: "#6b21a8",
                          }}
                        >
                          {lesson.tier === "foundation"
                            ? "Foundation Tier"
                            : lesson.tier === "higher"
                            ? "Higher Tier"
                            : lesson.tier}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "auto",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "1.5rem",
                            fontWeight: "bold",
                            color: "#333",
                          }}
                        >
                          {lesson.shamCoinPrice}{" "}
                          <span style={{ fontSize: "1rem", color: "#666" }}>
                            ShamCoins
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>
                          ⭐ {lesson.averageRating}/5
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <Link to={`/lesson/${lesson.id}`}>
                          <button
                            style={{
                              padding: "8px 16px",
                              background: "#e2e8f0",
                              color: "#333",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                            }}
                          >
                            Preview
                          </button>
                        </Link>

                        <button
                          onClick={() => !isPurchased && canAfford && handlePurchase(lesson.id)}
                          disabled={isPurchased || !canAfford}
                          style={{
                            padding: "8px 16px",
                            background: isPurchased
                              ? "#a0aec0"
                              : !canAfford
                              ? "#f56565"
                              : "#48bb78",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor:
                              isPurchased || !canAfford ? "not-allowed" : "pointer",
                            fontSize: "0.9rem",
                            fontWeight: "bold",
                            minWidth: "120px",
                          }}
                        >
                          {buttonText}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Purchased Lessons (legacy-safe) */}
        {user?.purchasedLessons && user.purchasedLessons.length > 0 && (
          <div style={{ marginTop: "50px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ color: "#333", margin: 0 }}>My Purchased Lessons</h2>
              <div style={{ color: "#666" }}>
                {user.purchasedLessons.length} lesson
                {user.purchasedLessons.length !== 1 ? "s" : ""}
              </div>
            </div>

            <div
              style={{
                background: "white",
                borderRadius: "12px",
                padding: "25px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "20px",
                }}
              >
                {user.purchasedLessons.map((purchase: any) => {
                  const lessonId = String(purchase.lessonId ?? "");
                  const canOpen = isUuid(lessonId);

                  return (
                    <div
                      key={purchase._id || lessonId}
                      style={{
                        background: "#f8fafc",
                        borderRadius: "8px",
                        padding: "15px",
                        border: "2px solid #e2e8f0",
                        opacity: canOpen ? 1 : 0.75,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              margin: "0 0 5px 0",
                              color: "#333",
                            }}
                          >
                            {purchase.lesson?.title || "Lesson"}
                          </h4>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.9rem",
                              color: "#666",
                            }}
                          >
                            Purchased:{" "}
                            {purchase.timestamp
                              ? new Date(purchase.timestamp).toLocaleDateString()
                              : "—"}
                          </p>
                          <p
                            style={{
                              margin: "5px 0 0 0",
                              fontSize: "0.9rem",
                              color: "#48bb78",
                            }}
                          >
                            Price: {purchase.price ?? 0} ShamCoins
                          </p>
                          {!canOpen && (
                            <p
                              style={{
                                margin: "8px 0 0 0",
                                fontSize: "0.85rem",
                                color: "#b45309",
                              }}
                            >
                              Legacy purchase (old id). Will work after we migrate purchases
                              to Supabase.
                            </p>
                          )}
                        </div>

                        {canOpen ? (
                          <Link to={`/lesson/${lessonId}`}>
                            <button
                              style={{
                                padding: "8px 16px",
                                background: "#667eea",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                                fontWeight: "bold",
                              }}
                            >
                              Study Now
                            </button>
                          </Link>
                        ) : (
                          <button
                            disabled
                            style={{
                              padding: "8px 16px",
                              background: "#a0aec0",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "not-allowed",
                              fontSize: "0.9rem",
                              fontWeight: "bold",
                            }}
                          >
                            Unavailable
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div
          style={{
            marginTop: "40px",
            textAlign: "center",
            color: "#666",
            fontSize: "0.9rem",
          }}
        >
          <p>Need more ShamCoins? Complete assignments or refer friends to earn more!</p>
          <p>Purchases will be re-enabled after we migrate the purchase flow to Supabase.</p>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
