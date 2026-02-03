// frontend/src/pages/BrowseLessons.tsx

import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "http://localhost:5000";

interface Lesson {
  _id: string;
  id?: string;
  title: string;
  description: string;
  content: string;
  subject: string;
  level: string;
  topic: string;
  board: string;
  tier: string;
  isPublished: boolean;
  // Phase B: whether this lesson exposes a free preview slice
  isFreePreview?: boolean;
  createdAt: string;
  updatedAt: string;
  teacherId: string;
  teacherName: string;
  estimatedDuration: number;
  shamCoinPrice: number;
  views: number;
  averageRating: number;
  pages?: any[];
}

interface Filters {
  subject: string;
  topic: string;
  level: string;
  board: string;
  tier: string;
  search: string;
}

const BrowseLessons: React.FC = () => {
  const navigate = useNavigate();

  // ✅ localStorage-backed state for advanced/deeper knowledge
  const [advancedMode, setAdvancedMode] = useState<boolean>(() => {
    return localStorage.getItem("advancedMode") === "true";
  });

  // ✅ Sync state to localStorage whenever advancedMode changes
  useEffect(() => {
    localStorage.setItem("advancedMode", String(advancedMode));
  }, [advancedMode]);

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [filters, setFilters] = useState<Filters>({
    subject: "",
    topic: "",
    level: "",
    board: "",
    tier: "",
    search: "",
  });

  // Determine user type from localStorage
  const userType = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return String(u?.userType || u?.type || "").toLowerCase();
    } catch {
      return "";
    }
  }, []);

  const isStudent = userType === "student";

  // Student's stage/level for gating
  const studentStageKey = useMemo(() => {
    const lsStage = localStorage.getItem("selectedStage") || "";
    if (lsStage) {
      const normalized = lsStage.toLowerCase();
      if (normalized.includes("ks3")) return "ks3";
      if (normalized.includes("gcse")) return "gcse";
      if (normalized.includes("a-level") || normalized.includes("alevel") || normalized.includes("a level"))
        return "a-level";
      return normalized;
    }

    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      const stageFromUser = u?.stage || u?.level || u?.selectedStage || "";
      const normalized = String(stageFromUser).toLowerCase();
      if (normalized.includes("ks3")) return "ks3";
      if (normalized.includes("gcse")) return "gcse";
      if (normalized.includes("a-level") || normalized.includes("alevel") || normalized.includes("a level"))
        return "a-level";
      return normalized;
    } catch {
      return "";
    }
  }, []);

  const stageLabel = useMemo(() => {
    if (studentStageKey === "ks3") return "KS3";
    if (studentStageKey === "gcse") return "GCSE";
    if (studentStageKey === "a-level") return "A-Level";
    return "";
  }, [studentStageKey]);

  useEffect(() => {
    fetchUserData();
    loadPublishedLessons();
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

  const loadPublishedLessons = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      // If student, pass level to backend for gating
      const levelParam = isStudent && studentStageKey ? getLevelFromStageKey(studentStageKey) : "";

      const res = await axios.get(`${API_BASE}/api/lessons`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        params: levelParam ? { level: levelParam } : undefined,
      });

      const allLessons = Array.isArray(res.data) ? res.data : [];
      const publishedLessons = allLessons.filter((lesson: Lesson) => lesson.isPublished);
      setLessons(publishedLessons);
    } catch (error) {
      console.error("Error loading lessons:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelFromStageKey = (stageKey: string): string => {
    if (stageKey === "ks3") return "KS3";
    if (stageKey === "gcse") return "GCSE";
    if (stageKey === "a-level") return "A-Level";
    return "";
  };

  const normalizeTier = (tier: string) => {
    if (!tier) return "";
    const t = tier.toLowerCase();
    if (t.includes("foundation")) return "foundation";
    if (t.includes("higher")) return "higher";
    if (t.includes("advanced")) return "advanced";
    return t;
  };

  const normalizeLevelLabel = (level: string) => {
    if (!level) return "Not set";
    const l = level.toLowerCase();
    if (l.includes("ks3")) return "KS3";
    if (l.includes("gcse")) return "GCSE";
    if (l.includes("a-level") || l.includes("alevel") || l.includes("a level")) return "A-Level";
    return level;
  };

  // Filter lessons based on stage gating and advanced mode
  const gatedLessons = useMemo(() => {
    let filtered = lessons;

    // Stage gating for students
    if (isStudent && studentStageKey) {
      filtered = filtered.filter((lesson) => {
        const lessonLevel = normalizeLevelLabel(lesson.level).toLowerCase();
        if (studentStageKey === "gcse") return lessonLevel.includes("gcse");
        if (studentStageKey === "ks3") return lessonLevel.includes("ks3");
        if (studentStageKey === "a-level")
          return lessonLevel.includes("a-level") || lessonLevel.includes("alevel") || lessonLevel.includes("a level");
        return true;
      });
    }

    // Advanced mode filtering (hide "advanced" tier when off)
    if (!advancedMode) {
      filtered = filtered.filter((lesson) => {
        const tier = normalizeTier(lesson.tier);
        return tier !== "advanced";
      });
    }

    return filtered;
  }, [lessons, isStudent, studentStageKey, advancedMode]);

  // Extract unique values for filter dropdowns
  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();
    gatedLessons.forEach((lesson) => subjects.add(lesson.subject || "Not set"));
    return Array.from(subjects).sort();
  }, [gatedLessons]);

  const topicOptions = useMemo(() => {
    const topics = new Set<string>();
    gatedLessons.forEach((lesson) => topics.add(lesson.topic || "Not set"));
    return Array.from(topics).sort();
  }, [gatedLessons]);

  const levelOptions = useMemo(() => {
    const levels = new Set<string>();
    gatedLessons.forEach((lesson) => levels.add(normalizeLevelLabel(lesson.level)));
    return Array.from(levels).sort();
  }, [gatedLessons]);

  const boardOptions = useMemo(() => {
    const boards = new Set<string>(["AQA", "OCR", "Edexcel", "WJEC", "Not set"]);
    gatedLessons.forEach((lesson) => boards.add(lesson.board || "Not set"));
    return Array.from(boards).sort((a, b) => {
      if (a === "Not set") return 1;
      if (b === "Not set") return -1;
      return a.localeCompare(b);
    });
  }, [gatedLessons]);

  const tierOptions = useMemo(() => {
    const tiers = new Set<string>(["foundation", "higher", "advanced"]);
    gatedLessons.forEach((lesson) => {
      const tier = normalizeTier(lesson.tier);
      if (tier) tiers.add(tier);
    });
    return Array.from(tiers).sort();
  }, [gatedLessons]);

  // Apply all filters
  const filteredLessons = useMemo(() => {
    const searchTerm = filters.search.toLowerCase().trim();

    return gatedLessons.filter((lesson) => {
      // Subject filter
      if (filters.subject && lesson.subject !== filters.subject) return false;

      // Topic filter
      if (filters.topic && lesson.topic !== filters.topic) return false;

      // Level filter
      if (filters.level && normalizeLevelLabel(lesson.level) !== filters.level) return false;

      // Board filter
      if (filters.board && lesson.board !== filters.board) return false;

      // Tier filter
      if (filters.tier) {
        const lessonTier = normalizeTier(lesson.tier);
        if (lessonTier !== filters.tier) return false;
      }

      // Hide lessons with stretch blocks when advanced mode is OFF
      if (!advancedMode) {
        const hasStretchBlocks = lesson.pages?.some((page) =>
          page.blocks?.some((block: any) => block.type === "stretch")
        );
        if (hasStretchBlocks) return false;
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          lesson.title,
          lesson.description,
          lesson.subject,
          lesson.topic,
          lesson.level,
          lesson.board,
          lesson.teacherName,
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(searchTerm);
      }

      return true;
    });
  }, [gatedLessons, filters, advancedMode]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      subject: "",
      topic: "",
      level: "",
      board: "",
      tier: "",
      search: "",
    });
  };

  const handlePurchase = async (lessonId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please log in to purchase lessons");
        navigate("/login");
        return;
      }

      const response = await axios.post(
        `${API_BASE}/api/lessons/${lessonId}/purchase`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 200 || response.status === 201) {
        alert("Lesson purchased successfully!");
        fetchUserData(); // Refresh user data to update coins and purchased lessons
        loadPublishedLessons(); // Refresh lessons list
      }
    } catch (error: any) {
      console.error("Purchase error:", error);
      if (error.response?.status === 400) {
        alert(error.response.data.message || "Failed to purchase lesson");
      } else {
        alert("Failed to purchase lesson. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lessons...</h2>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f7fafc", padding: "20px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
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
            <h1 style={{ color: "#2d3748", marginBottom: "5px" }}>📚 Browse Lessons</h1>
            <p style={{ color: "#718096" }}>
              {isStudent && stageLabel
                ? `You are browsing ${stageLabel} lessons only.`
                : "Browse all available lessons."}
            </p>
            {advancedMode && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(124,58,237,0.10)",
                  border: "2px solid rgba(124,58,237,0.35)",
                  color: "#4c1d95",
                  fontWeight: 900,
                }}
              >
                🔥 Advanced mode enabled (Deeper knowledge)
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div
              style={{
                background: "white",
                padding: "10px 20px",
                borderRadius: "20px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                fontWeight: "bold",
                color: "#2d3748",
                fontSize: "1.1rem",
              }}
            >
              💰 {user?.shamCoins || 0} ShamCoins
            </div>

            <Link
              to={userType === "teacher" ? "/teacher-dashboard" : "/dashboard"}
              style={{
                color: "#667eea",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Subscription CTA for conversion */}
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 16px",
            borderRadius: 10,
            backgroundColor: "#eef2ff",
            border: "1px solid rgba(129,140,248,0.4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: "#3730a3", fontWeight: 600, fontSize: "0.95rem" }}>
            Subscribe to unlock all lessons and full content.
          </div>
          <button
            type="button"
            onClick={() => navigate("/subscription")}
            style={{
              padding: "0.5rem 1.1rem",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: 999,
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            View plans
          </button>
        </div>

        {/* Filters Section */}
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
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <h3 style={{ color: "#2d3748", margin: 0 }}>Filter Lessons</h3>

            {/* ✅ Advanced mode toggle button - simplified onClick */}
            <button
              type="button"
              onClick={() => setAdvancedMode((v) => !v)}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                background: advancedMode ? "#111827" : "#3b82f6",
                color: "white",
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {advancedMode ? "Deeper knowledge: ON" : "Deeper knowledge"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
              alignItems: "end",
            }}
          >
            {/* Subject Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "0.9rem",
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
                  backgroundColor: "white",
                  fontSize: "0.95rem",
                }}
              >
                <option value="">All Subjects</option>
                {subjectOptions.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                }}
              >
                Topic
              </label>
              <select
                name="topic"
                value={filters.topic}
                onChange={handleFilterChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  fontSize: "0.95rem",
                }}
              >
                <option value="">All Topics</option>
                {topicOptions.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                }}
              >
                Level
              </label>
              <select
                name="level"
                value={filters.level}
                onChange={handleFilterChange}
                disabled={isStudent && stageLabel ? true : false}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  backgroundColor: isStudent && stageLabel ? "#f7fafc" : "white",
                  color: isStudent && stageLabel ? "#718096" : "#2d3748",
                  fontSize: "0.95rem",
                }}
              >
                {isStudent && stageLabel ? (
                  <option value={stageLabel}>{stageLabel}</option>
                ) : (
                  <>
                    <option value="">All Levels</option>
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Board Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                }}
              >
                Exam Board
              </label>
              <select
                name="board"
                value={filters.board}
                onChange={handleFilterChange}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  backgroundColor: "white",
                  fontSize: "0.95rem",
                }}
              >
                <option value="">All Boards</option>
                {boardOptions.map((board) => (
                  <option key={board} value={board}>
                    {board}
                  </option>
                ))}
              </select>
            </div>

            {/* Tier Filter */}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "0.9rem",
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
                  backgroundColor: "white",
                  fontSize: "0.95rem",
                }}
              >
                <option value="">All Tiers</option>
                {tierOptions.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Filter */}
            <div style={{ gridColumn: "span 2" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  color: "#4a5568",
                  fontWeight: "600",
                  fontSize: "0.9rem",
                }}
              >
                Search
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="text"
                  name="search"
                  placeholder="Search lessons..."
                  value={filters.search}
                  onChange={handleFilterChange}
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: "2px solid #e2e8f0",
                    borderRadius: "6px",
                    fontSize: "0.95rem",
                  }}
                />
                <button
                  onClick={clearFilters}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#e2e8f0",
                    color: "#4a5568",
                    border: "none",
                    borderRadius: "6px",
                    fontWeight: "600",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2 style={{ color: "#2d3748", margin: 0 }}>Available Lessons</h2>
          <div style={{ color: "#718096" }}>
            {filteredLessons.length} lesson{filteredLessons.length !== 1 ? "s" : ""} found
            {advancedMode && " (Advanced mode active)"}
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
            <h3 style={{ color: "#4a5568", marginBottom: "10px" }}>No lessons found</h3>
            <p style={{ color: "#a0aec0" }}>Try adjusting your filters or search term.</p>
            {advancedMode && (
              <p style={{ color: "#7c3aed", marginTop: "10px" }}>
                Note: Advanced mode is active. Try disabling it to see more basic lessons.
              </p>
            )}
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
                (p: any) => String(p.lessonId) === String(lesson._id || lesson.id)
              );

              const canAfford = (user?.shamCoins || 0) >= lesson.shamCoinPrice;
              const buttonText = isPurchased
                ? "Purchased"
                : !canAfford
                ? "Not Enough Coins"
                : lesson.shamCoinPrice === 0
                ? "Get Access"
                : `Purchase (${lesson.shamCoinPrice} coins)`;

              const hasStretchBlocks = lesson.pages?.some((page) =>
                page.blocks?.some((block: any) => block.type === "stretch")
              );

              return (
                <div
                  key={lesson._id || lesson.id}
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                  }}
                    onClick={() => navigate(`/lessons/${lesson._id || lesson.id}`)}
                >
                  {/* Lesson Header */}
                  <div
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      padding: "20px",
                      color: "white",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "1.25rem", lineHeight: "1.3" }}>{lesson.title}</h3>
                    <p style={{ margin: "5px 0 0 0", opacity: 0.9, fontSize: "0.9rem" }}>
                      By {lesson.teacherName}
                    </p>
                  </div>

                  {/* Lesson Content */}
                    <div style={{ padding: "20px", flexGrow: 1 }}>
                      {/* Status chip: Preview vs Locked */}
                      <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between" }}>
                        <span
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: lesson.isFreePreview ? "#dcfce7" : "#e5e7eb",
                            color: lesson.isFreePreview ? "#166534" : "#4b5563",
                            border: lesson.isFreePreview
                              ? "1px solid rgba(22,101,52,0.35)"
                              : "1px solid rgba(75,85,99,0.25)",
                          }}
                        >
                          {lesson.isFreePreview ? "Preview" : "Locked"}
                        </span>
                      </div>
                    <p
                      style={{
                        color: "#718096",
                        lineHeight: "1.5",
                        marginBottom: "15px",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {lesson.description || "No description available."}
                    </p>

                    {/* Tags */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "15px" }}>
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
                        {normalizeLevelLabel(lesson.level)}
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
                        {lesson.topic}
                      </span>

                      {lesson.board && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "#fef3c7",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            color: "#92400e",
                          }}
                        >
                          {lesson.board}
                        </span>
                      )}

                      {lesson.tier && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: normalizeTier(lesson.tier) === "advanced" ? "rgba(124,58,237,0.20)" : "#e9d5ff",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            color: normalizeTier(lesson.tier) === "advanced" ? "#5b21b6" : "#6b21a8",
                            fontWeight: normalizeTier(lesson.tier) === "advanced" ? 700 : 400,
                          }}
                        >
                          {normalizeTier(lesson.tier) === "foundation"
                            ? "Foundation Tier"
                            : normalizeTier(lesson.tier) === "higher"
                            ? "Higher Tier"
                            : normalizeTier(lesson.tier) === "advanced"
                            ? "🔥 Advanced"
                            : lesson.tier}
                        </span>
                      )}

                      {hasStretchBlocks && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: "rgba(124,58,237,0.12)",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            color: "#5b21b6",
                            fontWeight: 700,
                          }}
                        >
                          🔍 Advanced available
                        </span>
                      )}
                    </div>

                    {/* Lesson Stats */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "auto",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#2d3748" }}>
                          {lesson.shamCoinPrice}{" "}
                          <span style={{ fontSize: "1rem", color: "#718096" }}>ShamCoins</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#718096" }}>
                          ⭐ {lesson.averageRating || 0}/5 • 👁️ {lesson.views || 0} views
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "10px" }}>
                        <Link to={`/lesson/${lesson._id || lesson.id}`}>
                          <button
                            style={{
                              padding: "8px 16px",
                              background: "#e2e8f0",
                              color: "#4a5568",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.9rem",
                              fontWeight: "500",
                            }}
                          >
                            Preview
                          </button>
                        </Link>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            !isPurchased && canAfford && handlePurchase(lesson._id || lesson.id);
                          }}
                          disabled={isPurchased || !canAfford}
                          style={{
                            padding: "8px 16px",
                            background: isPurchased ? "#a0aec0" : !canAfford ? "#f56565" : "#48bb78",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: isPurchased || !canAfford ? "not-allowed" : "pointer",
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

        {/* Purchased Lessons Section */}
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
              <h2 style={{ color: "#2d3748", margin: 0 }}>My Purchased Lessons</h2>
              <div style={{ color: "#718096" }}>
                {user.purchasedLessons.length} lesson{user.purchasedLessons.length !== 1 ? "s" : ""}
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
                  const canOpen = /^[0-9a-f]{24}$/i.test(lessonId) || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lessonId);

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
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: "0 0 5px 0", color: "#2d3748" }}>
                            {purchase.lesson?.title || "Lesson"}
                          </h4>
                          <p style={{ margin: 0, fontSize: "0.9rem", color: "#718096" }}>
                            Purchased:{" "}
                            {purchase.timestamp ? new Date(purchase.timestamp).toLocaleDateString() : "—"}
                          </p>
                          <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem", color: "#48bb78" }}>
                            Price: {purchase.price ?? 0} ShamCoins
                          </p>
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

        {/* Footer */}
        <div style={{ marginTop: "40px", textAlign: "center", color: "#718096", fontSize: "0.9rem" }}>
          <p>Need more ShamCoins? Complete assignments or refer friends to earn more!</p>
          <p>Questions? Contact support@shamlearning.com</p>
        </div>
      </div>
    </div>
  );
};

export default BrowseLessons;