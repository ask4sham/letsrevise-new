// frontend/src/pages/StudentDashboard.tsx
// PR-AUTH-UI-1: use shared useCurrentUser hook (single source of truth for auth).
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import LessonAccessBadge, { LessonAccessBadgeLegend } from "../components/LessonAccessBadge";
import { getStudentDashboard, type DashboardResponse } from "../api/studentDashboard";
import {
  getCatalogueAvailability,
  getPublicCatalogue,
  type CatalogueAvailabilityResponse,
} from "../api/catalogueAvailability";
import StudentMyClassesSection from "../components/StudentMyClassesSection";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getAxiosErrorMessage, getErrorMessageFromData } from "../utils/apiErrorMessage";
import {
  buildRevisionCourseOptions,
  buildRevisionSubjectOptions,
  buildGroupedRevisionTopicOptions,
  computeRevisionPublicActionsEnabled,
  filterAdminGrants,
  findCatalogueTopicNode,
  findProfileLevelNode,
  formatCatalogueCourseDisplayLabel,
  formatComingSoonLabel,
  getSelectedRevisionStatus,
  lessonMatchesCatalogueTopic,
  resolveProfileStageKey,
  revisionCourseToSpecKey,
  shouldShowGrantedSection,
} from "../utils/catalogueRevisionOptions";

const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_URL ||
  "";

async function fetchLessonsByIds(ids: string[], token: string | null) {
  const res = await fetch(`${API_BASE}/api/lessons/by-ids`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    throw new Error(getErrorMessageFromData(parsed, `by-ids failed: ${res.status}`));
  }
  return res.json();
}

/**
 * ✅ StudentDashboard (Option A, same logic as BrowseLessons)
 * - Shows ONLY published lessons
 * - Locks the student to their stage/level (KS3/GCSE/A-Level)
 * - Subject / Topic / Board filters + Search
 *
 * UX changes:
 * - Subject dropdown shows a fuller list (seeded with common subjects + subjects seen in gated lessons)
 * - Topic is now TYPEABLE (with suggestions via <datalist>)
 *
 * Legacy Supabase is OFF by default (wipe slate clean).
 */
const ENABLE_LEGACY_SUPABASE = false;

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
  tier?: string | null;
  exam_board?: ExamBoardRow[] | ExamBoardRow | null;
};

type MongoLessonRaw = {
  _id?: any;
  id?: any;
  title?: any;
  description?: any;
  content?: any;
  subject?: any;
  level?: any;
  topic?: any;
  board?: any;
  tier?: any;
  isPublished?: any;
  isFreePreview?: any;
  hasAccess?: any;
  createdAt?: any;
  pages?: any[];
  teacherName?: any;
  teacherId?: any;
  estimatedDuration?: any;
  views?: any;
  averageRating?: any;
};

type StudentLessonCard = {
  id: string;

  title: string;
  description: string;

  subject: string;
  topic: string;

  // Lesson level label shown on cards (e.g., "GCSE", "A-Level", "KS3")
  level: string;

  // Legacy-ish fields used by existing UI
  stage: string;
  years: string | number | null;

  teacherName: string;
  teacherId: string;

  estimatedDuration: number;
  views: number;
  averageRating: number;
  createdAt: string;

  // Board filter value (includes "Not set")
  examBoardName: string;

  tier: string; // '' | foundation | higher | etc

  // Phase C4: backend-provided entitlement (no client entitlement logic)
  isFreePreview?: boolean;
  hasAccess?: boolean;
  locked?: boolean;
  reason?: string;
};

function safeStr(v: any, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s : fallback;
}

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

function isMongoObjectId(value: string) {
  return /^[a-f0-9]{24}$/i.test(value);
}

function normalizeTier(tier: string) {
  const t = safeStr(tier, "").toLowerCase();
  if (!t) return "";
  if (t.includes("foundation")) return "foundation";
  if (t.includes("higher")) return "higher";
  if (t.includes("advanced")) return "advanced";
  return t;
}

function normalizeLevelLabel(level: string) {
  const v = safeStr(level, "");
  const l = v.toLowerCase();

  if (!l) return "Not set";
  if (l.includes("ks3")) return "KS3";
  if (l.includes("igcse")) return "IGCSE";
  if (l.includes("gcse")) return "GCSE";
  if (l.includes("a-level") || l.includes("alevel") || l.includes("a level")) return "A-Level";

  return v;
}

function normalizeBoardName(board: string) {
  const b = safeStr(board, "");
  return b.trim() ? b : "Not set";
}

/** Course = board + level + tier (student-friendly label for MY REVISION). */
function buildCourseKey(board: string, level: string, tier: string) {
  const b = normalizeBoardName(board);
  const lv = normalizeLevelLabel(level);
  const t = normalizeTier(tier);
  return `${b}|${lv}|${t}`;
}

function formatCourseLabel(
  board: string,
  level: string,
  tier: string,
  opts?: { suppressTier?: boolean }
) {
  const b = normalizeBoardName(board);
  const lv = normalizeLevelLabel(level);
  const t = normalizeTier(tier);
  if (b === "Not set" && lv === "Not set") return "Course not set";
  const tierLabel = opts?.suppressTier
    ? ""
    : t === "foundation"
      ? "Foundation"
      : t === "higher"
        ? "Higher"
        : t === "advanced"
          ? "Advanced"
          : "";
  const parts = [b !== "Not set" ? b : "", lv !== "Not set" ? lv : "", tierLabel].filter(Boolean);
  return parts.join(" · ") || "Course not set";
}

function parseCourseKey(courseKey: string): { board: string; level: string; tier: string } {
  const [board = "", level = "", tier = ""] = String(courseKey || "").split("|");
  return { board, level, tier };
}

function normalizeForCompare(s: string) {
  return safeStr(s, "").trim().toLowerCase();
}

/** Display-only: Edexcel International GCSE Biology (4BI1); suppress Foundation/Higher labelling. */
function isEdexcelIgcseBiologyDisplay(lesson: {
  examBoardName?: string;
  level?: string;
  subject?: string;
  topic?: string;
  title?: string;
}): boolean {
  const board = normalizeForCompare(lesson.examBoardName || "");
  const subject = normalizeForCompare(lesson.subject || "");
  if (board !== "edexcel" || subject !== "biology") return false;
  if (normalizeLevelLabel(lesson.level || "") === "IGCSE") return true;
  const blob = [lesson.topic, lesson.title].map((s) => safeStr(s, "")).join(" ");
  return /\b4bi1\b/i.test(blob);
}

type RevisionFocusView = {
  summary: string;
  weakAreas: Array<{
    topicKey: string;
    topicName: string;
    attempted: number;
    correct: number;
    total: number;
    percentage: number;
  }>;
};

/** Map MY REVISION course selection to backend specKey (Biology only). */
function courseSelectionToSpecKey(
  revisionSubject: string,
  revisionCourse: string,
  lessons: StudentLessonCard[]
): string | null {
  if (!revisionSubject || !revisionCourse) return null;
  if (normalizeForCompare(revisionSubject) !== "biology") return null;

  const { board, level, tier } = parseCourseKey(revisionCourse);
  const boardNorm = normalizeForCompare(board);
  const levelNorm = normalizeLevelLabel(level);

  if (boardNorm === "aqa" && levelNorm === "GCSE") return "aqa-gcse-biology";
  if (boardNorm === "edexcel" && levelNorm === "IGCSE") return "edexcel-igcse-biology";

  if (boardNorm === "edexcel" && levelNorm === "GCSE") {
    const matchesCourse = lessons.some((l) => {
      if (normalizeForCompare(l.subject) !== "biology") return false;
      if (normalizeBoardName(l.examBoardName) !== board) return false;
      if (normalizeLevelLabel(l.level) !== level) return false;
      if ((normalizeTier(l.tier) || "") !== (tier || "")) return false;
      return isEdexcelIgcseBiologyDisplay(l);
    });
    if (matchesCourse) return "edexcel-igcse-biology";
  }

  return null;
}

/**
 * Student stage gating helpers (same as BrowseLessons)
 * Normalized key: "ks3" | "gcse" | "a-level" | ""
 */
function normalizeStageKey(s: string) {
  const v = safeStr(s, "").toLowerCase();
  if (!v) return "";
  if (v.includes("ks3")) return "ks3";
  if (v.includes("gcse") || v.includes("gcse")) return "gcse";
  if (v.includes("a-level") || v.includes("alevel") || v.includes("a level")) return "a-level";
  return v;
}

function stageLabel(stageKey: string) {
  if (stageKey === "ks3") return "KS3";
  if (stageKey === "gcse") return "GCSE";
  if (stageKey === "a-level") return "A-Level";
  return "";
}

function stageKeyToLessonLevel(stageKey: string): string {
  return stageLabel(stageKey) || "";
}

function lessonMatchesStage(lessonLevel: string, stageKey: string) {
  if (!stageKey) return true;
  const lvl = safeStr(lessonLevel, "").toLowerCase();
  if (!lvl) return false;

  if (stageKey === "gcse") return lvl.includes("gcse");
  if (stageKey === "ks3") return lvl.includes("ks3");
  if (stageKey === "a-level") return lvl.includes("a-level") || lvl.includes("alevel") || lvl.includes("a level");
  return false;
}

function buildPreview(desc: string, content: string, max = 160) {
  const d = safeStr(desc, "");
  if (d.trim()) return d.trim().slice(0, max) + (d.trim().length > max ? "…" : "");
  const c = safeStr(content, "");
  if (!c.trim()) return "No description yet.";
  const t = c.trim();
  return t.slice(0, max) + (t.length > max ? "…" : "");
}

function buildDescriptionFromLegacy(notes: string, examBoardName: string | null) {
  const safeNotes = safeStr(notes, "");
  if (examBoardName) return `Exam board: ${examBoardName}`;
  if (!safeNotes.trim()) return "No description yet.";
  const trimmed = safeNotes.trim();
  return trimmed.slice(0, 160) + (trimmed.length > 160 ? "…" : "");
}

const BASE_EXAM_BOARDS = ["AQA", "OCR", "Edexcel", "WJEC", "Not set"] as const;

/** Display-only: align legacy API placeholder (no behaviour change). */
function revisionFocusDisplayCopy(text: string): string {
  return text.replace(
    /Keep practising to see personalised revision focus\.?/gi,
    "We'll highlight your weak topics here after a few quizzes."
  );
}

const REVISION_FOCUS_NO_COURSE_COPY =
  "Choose a Biology course and complete a few quizzes to start building your Revision Focus.";
const CATALOGUE_UNAVAILABLE_COPY =
  "We couldn't load your curriculum catalogue. Try refreshing, or continue with Browse all lessons below.";
const REVISION_FOCUS_UNAVAILABLE_COPY = "Revision Focus is temporarily unavailable.";

/** Step 6: Your revision focus - course-specific fetch only (no shared dashboardData, no knowledge-gap). */
function RevisionFocusBlock({
  specKey,
  revisionFocusData,
  revisionFocusLoading,
  revisionFocusError,
}: {
  specKey: string | null;
  revisionFocusData: RevisionFocusView | null;
  revisionFocusLoading: boolean;
  revisionFocusError: string | null;
}) {
  const shellStyle = {
    background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
    padding: "14px 20px",
    borderRadius: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    marginBottom: "16px",
    border: "1px solid #fcd34d",
  } as const;

  if (!specKey) {
    return (
      <div style={shellStyle}>
        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Your revision focus</div>
        <p style={{ margin: 0, color: "#78350f", fontSize: "0.95rem", lineHeight: 1.5 }}>{REVISION_FOCUS_NO_COURSE_COPY}</p>
      </div>
    );
  }

  if (revisionFocusLoading) {
    return (
      <div style={shellStyle}>
        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Your revision focus</div>
        <p style={{ margin: 0, color: "#b45309", fontSize: "0.9rem" }}>Loading...</p>
      </div>
    );
  }

  if (revisionFocusError) {
    return (
      <div style={shellStyle}>
        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Your revision focus</div>
        <p style={{ margin: 0, color: "#78350f", fontSize: "0.95rem", lineHeight: 1.5 }}>{revisionFocusError}</p>
      </div>
    );
  }

  const summary =
    revisionFocusData?.summary ||
    (!revisionFocusData?.weakAreas?.length
      ? "We'll highlight your weak topics here after a few quizzes."
      : "Complete quizzes and practice to unlock your personalised revision focus.");

  return (
    <div style={shellStyle}>
      <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Your revision focus</div>
      <p style={{ margin: "0 0 10px 0", color: "#78350f", fontSize: "0.95rem", lineHeight: 1.5 }}>
        {revisionFocusDisplayCopy(summary)}
      </p>
      {revisionFocusData?.weakAreas && revisionFocusData.weakAreas.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 20, color: "#92400e", fontSize: "0.9rem", lineHeight: 1.6 }}>
          {revisionFocusData.weakAreas.map((w) => (
            <li key={w.topicKey}>
              {w.topicName || w.topicKey}: {w.percentage}% ({w.correct}/{w.total})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const StudentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ✅ UPDATED: localStorage-backed state for advanced/deeper knowledge
  const [advancedMode, setAdvancedMode] = useState<boolean>(() => {
    return localStorage.getItem("advancedMode") === "true";
  });

  const [lessons, setLessons] = useState<StudentLessonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, token } = useCurrentUser({ watchLocation: true });

  // Phase 2: Unified dashboard (summary, weakTopics, recentActivity, studyPlan, recommendations)
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // PR13.3: Recommended next (from misconception topics) — uses dashboard when available
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recTopics, setRecTopics] = useState<Array<{ topicKey: string; topic?: string; score: number; wrong: number; highConfidenceWrong: number }>>([]);
  const [recLessons, setRecLessons] = useState<StudentLessonCard[]>([]);

  const [revisionFocusData, setRevisionFocusData] = useState<RevisionFocusView | null>(null);
  const [revisionFocusLoading, setRevisionFocusLoading] = useState(false);
  const [revisionFocusError, setRevisionFocusError] = useState<string | null>(null);

  const [catalogueData, setCatalogueData] = useState<CatalogueAvailabilityResponse | null>(null);
  const [catalogueLoading, setCatalogueLoading] = useState(false);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const [purchasedLessonMap, setPurchasedLessonMap] = useState<
    Record<string, { _id: string; title: string | null; subject: string | null; level: string | null; topic: string | null }>
  >({});

  // Filters (match BrowseLessons UX)
  const [filters, setFilters] = useState({
    subject: "",
    topic: "",
    board: "",
    tier: "",
    search: "",
  });

  // Topic suggestion narrowing (within selected subject) — still useful even with typeable Topic
  const [topicNarrow, setTopicNarrow] = useState("");

  // PR-UX-STU-DASH-2: Filters collapsed by default on desktop
  const [filtersOpen, setFiltersOpen] = useState(false);

  // MY REVISION pathway (Subject → Course → Topic); catalogue behind Browse
  const [revisionSubject, setRevisionSubject] = useState("");
  const [revisionCourse, setRevisionCourse] = useState("");
  const [revisionTopic, setRevisionTopic] = useState("");
  const [browseOpen, setBrowseOpen] = useState(false);

  // PR-AUTH-UI-2: derive from useCurrentUser (no localStorage auth reads)
  const userType = (user?.userType || user?.type || "").toString().toLowerCase();
  const isStudent = userType === "student" || userType === "";

  /** Profile study stage — server/catalogue truth for the whole dashboard (not localStorage). */
  const profileStageKey = useMemo(
    () =>
      resolveProfileStageKey(
        catalogueData?.profileStage,
        safeStr((user as any)?.stageKey || user?.stage || user?.level, ""),
        (user as any)?.yearGroup
      ),
    [catalogueData?.profileStage, user?.stage, user?.level, (user as any)?.stageKey, (user as any)?.yearGroup]
  );

  const lockedLevelLabel = useMemo(() => {
    return isStudent && profileStageKey ? stageLabel(profileStageKey) : "";
  }, [isStudent, profileStageKey]);

  const adminGrantItems = useMemo(
    () => filterAdminGrants(catalogueData?.grantedToYou),
    [catalogueData?.grantedToYou]
  );

  /** True when the unified dashboard reports real learning activity (not just recommendations). */
  const hasDashboardActivity = useMemo(() => {
    if (!dashboardData?.ok) return false;
    const ra = dashboardData.recentActivity?.length ?? 0;
    const wt = dashboardData.weakTopics?.length ?? 0;
    return ra > 0 || wt > 0;
  }, [dashboardData]);

  useEffect(() => {
    if (!token) {
      setCatalogueData(null);
      setCatalogueLoading(false);
      setCatalogueError(null);
      return;
    }
    let cancelled = false;
    setCatalogueLoading(true);
    setCatalogueError(null);
    getCatalogueAvailability()
      .then(async (data) => {
        if (cancelled) return;
        if (data?.ok && data.publicTree?.levels?.length) {
          setCatalogueData(data);
          setCatalogueError(null);
          return;
        }
        try {
          const pub = await getPublicCatalogue();
          if (cancelled) return;
          if (pub?.ok && pub.publicTree?.levels?.length) {
            setCatalogueData({
              ok: true,
              profileStage: data?.profileStage || "",
              publicTree: pub.publicTree,
              grantedToYou: data?.grantedToYou || [],
              generatedAt: pub.generatedAt,
            });
            setCatalogueError(null);
            return;
          }
        } catch {
          /* use primary response below */
        }
        if (data?.ok) {
          setCatalogueData(data);
          setCatalogueError(null);
        } else {
          setCatalogueData(null);
          setCatalogueError(CATALOGUE_UNAVAILABLE_COPY);
        }
      })
      .catch(async () => {
        if (cancelled) return;
        try {
          const pub = await getPublicCatalogue();
          if (cancelled) return;
          if (pub?.ok && pub.publicTree?.levels?.length) {
            setCatalogueData({
              ok: true,
              profileStage: "",
              publicTree: pub.publicTree,
              grantedToYou: [],
              generatedAt: pub.generatedAt,
            });
            setCatalogueError(null);
            return;
          }
        } catch {
          /* fall through */
        }
        setCatalogueData(null);
        setCatalogueError(CATALOGUE_UNAVAILABLE_COPY);
      })
      .finally(() => {
        if (!cancelled) setCatalogueLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    loadPublishedLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileStageKey, token, isStudent]);
  useEffect(() => {
    if (!token) {
      setDashboardData(null);
      setDashboardLoading(false);
      return;
    }
    setDashboardLoading(true);
    getStudentDashboard({ days: 14, limit: 6 })
      .then((dash) => {
        setDashboardData(dash);
        if (dash?.ok && dash.recommendations) {
          setRecTopics(dash.recommendations.topics ?? []);
          setRecLessons(
            (dash.recommendations.lessons ?? []).map((l: any) => ({
              id: String(l.id ?? l._id ?? ""),
              title: l.title ?? "Untitled",
              description: l.description ?? "",
              subject: l.subject ?? "Not set",
              topic: l.topic ?? "Not set",
              level: normalizeLevelLabel(l.level ?? "Not set"),
              stage: l.level ?? "",
              years: null,
              teacherName: l.teacherName ?? "Teacher",
              teacherId: "",
              estimatedDuration: 0,
              views: 0,
              averageRating: 0,
              createdAt: "",
              examBoardName: normalizeBoardName(l.examBoard ?? l.board ?? ""),
              tier: "",
              isFreePreview: Boolean(l.isFreePreview),
              hasAccess: Boolean(l.hasAccess),
              locked: Boolean(l.locked),
              reason: l.reason,
            }))
          );
        }
      })
      .catch(() => {
        setDashboardData(null);
        setRecLoading(true);
        // Fallback: fetch recommendations from legacy endpoint
        axios
          .get(`${API_BASE}/api/reports/students/me/recommendations`, {
            params: { days: 14, limit: 6 },
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => {
            const data = res?.data;
            if (data?.ok) {
              setRecTopics(Array.isArray(data.topics) ? data.topics : []);
              const raw = Array.isArray(data.lessons) ? data.lessons : [];
              setRecLessons(
                raw.map((l: any) => ({
                  id: String(l.id ?? l._id ?? ""),
                  title: l.title ?? "Untitled",
                  description: l.description ?? "",
                  subject: l.subject ?? "Not set",
                  topic: l.topic ?? "Not set",
                  level: normalizeLevelLabel(l.level ?? "Not set"),
                  stage: l.level ?? "",
                  years: null,
                  teacherName: l.teacherName ?? "Teacher",
                  teacherId: "",
                  estimatedDuration: 0,
                  views: 0,
                  averageRating: 0,
                  createdAt: "",
                  examBoardName: normalizeBoardName(l.examBoard ?? l.board ?? ""),
                  tier: "",
                  isFreePreview: Boolean(l.isFreePreview),
                  hasAccess: Boolean(l.hasAccess),
                  locked: Boolean(l.locked),
                  reason: l.reason,
                }))
              );
            }
          })
          .catch((err: unknown) => {
            setRecError(getAxiosErrorMessage(err, "Failed to load recommendations."));
            setRecLessons([]);
            setRecTopics([]);
          })
          .finally(() => setRecLoading(false));
      })
      .finally(() => setDashboardLoading(false));
  }, [token]);

  // Batch-fetch lesson metadata for purchased lessons (no N+1)
  useEffect(() => {
    const list = user?.purchasedLessons;
    if (!Array.isArray(list) || list.length === 0) {
      setPurchasedLessonMap((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return;
    }
    const ids = Array.from(new Set(list.map((p: any) => String(p?.lessonId ?? p)).filter(Boolean)));
    if (ids.length === 0) {
      setPurchasedLessonMap({});
      return;
    }
    (async () => {
      try {
        const data = await fetchLessonsByIds(ids, token);
        setPurchasedLessonMap(
          (data.lessons || []).reduce((acc: Record<string, any>, l: any) => {
            const id = String(l._id ?? l.id ?? "");
            if (id) acc[id] = l;
            return acc;
          }, {})
        );
      } catch {
        setPurchasedLessonMap({});
      }
    })();
  }, [user?.purchasedLessons, token]);

  const fetchPublishedLessonsFromMongo = async (): Promise<StudentLessonCard[]> => {
    try {

      // Option A: if student stage known, we can pass level, but server also enforces level for students.
      const levelParam = isStudent && profileStageKey ? stageKeyToLessonLevel(profileStageKey) : "";

      const res = await axios.get(`${API_BASE}/api/lessons`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        params: levelParam ? { level: levelParam } : undefined,
      });

      const arr = Array.isArray(res.data) ? (res.data as MongoLessonRaw[]) : [];

      const mapped: StudentLessonCard[] = arr
        .filter((l) => Boolean((l as any)?.isPublished) === true)
        .map((l) => {
          const id = safeStr(l._id || l.id, "");
          const title = safeStr(l.title, "Untitled Lesson");

          const subject = safeStr(l.subject, "Not set");
          const topic = safeStr(l.topic, "Not set");

          const level = normalizeLevelLabel(safeStr(l.level, "Not set"));
          const tier = normalizeTier(safeStr((l as any).tier, ""));

          // PR0: API returns examBoard (canonical); fallback to board
          const examBoardName = normalizeBoardName(safeStr((l as any).examBoard ?? (l as any).board, ""));

          const preview = buildPreview(safeStr(l.description, ""), safeStr(l.content, ""), 160);

          return {
            id,
            title,
            description: preview,
            subject,
            topic,
            level,

            // Keep legacy-ish fields safe
            stage: level,
            years: null,

            teacherName: safeStr((l as any).teacherName, "Teacher"),
            teacherId: safeStr((l as any).teacherId?._id || (l as any).teacherId, ""),

            estimatedDuration: Number.isFinite(Number((l as any).estimatedDuration))
              ? Number((l as any).estimatedDuration)
              : 0,
            views: Number.isFinite(Number((l as any).views)) ? Number((l as any).views) : 0,
            averageRating: Number.isFinite(Number((l as any).averageRating))
              ? Number((l as any).averageRating)
              : 0,
            createdAt: safeStr((l as any).createdAt, new Date().toISOString()),

            examBoardName,
            tier,

            isFreePreview: Boolean((l as any).isFreePreview),
            hasAccess: Boolean((l as any).hasAccess),
          };
        })
        .filter((x) => Boolean(x.id));

      return mapped;
    } catch (err) {
      console.error("Mongo lessons fetch failed:", err);
      return [];
    }
  };

  const fetchPublishedLessonsFromSupabase = async (): Promise<StudentLessonCard[]> => {
    try {
      if (!ENABLE_LEGACY_SUPABASE) return [];

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
        return [];
      }

      const raw = (data ?? []) as unknown as SupabaseLessonRow[];

      return raw.map((l) => {
        const examBoardNameRaw = getBoardName(l.exam_board ?? null);
        const examBoardName = normalizeBoardName(examBoardNameRaw ?? "");

        const safeTitle = String(l.title ?? "Untitled Lesson");
        const safeNotes = String(l.lesson_notes ?? "");
        const safeSubject = String(l.subject ?? "Not set");

        const safeLevel = normalizeLevelLabel(String(l.level ?? "Not set"));
        const safeStage = String(l.stage ?? safeLevel);
        const safeCreatedAt = String(l.created_at ?? new Date().toISOString());
        const safeTier = normalizeTier(String(l.tier ?? ""));

        return {
          id: String(l.id),
          title: safeTitle,
          description: buildDescriptionFromLegacy(safeNotes, examBoardNameRaw),
          subject: safeSubject,
          topic: "Not set",
          level: safeLevel,
          stage: safeStage,
          years: l.years ?? null,
          teacherName: "Teacher",
          teacherId: String(l.teacher_id ?? ""),
          estimatedDuration: 0,
          views: 0,
          averageRating: 0,
          createdAt: safeCreatedAt,
          examBoardName,
          tier: safeTier,
        };
      });
    } catch (err) {
      console.error("Error fetching lessons from Supabase:", err);
      return [];
    }
  };

  const loadPublishedLessons = async () => {
    try {
      setLoading(true);

      const [mongo, legacy] = await Promise.all([
        fetchPublishedLessonsFromMongo(),
        fetchPublishedLessonsFromSupabase(),
      ]);

      const merged = [...mongo, ...legacy].sort((a, b) => {
        const da = new Date(a.createdAt).getTime();
        const db = new Date(b.createdAt).getTime();
        return db - da;
      });

      setLessons(merged);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ Stage-gated lessons (Option A)
   */
  const gatedLessons = useMemo(() => {
    let base = lessons;

    // Stage gate (existing behavior)
    if (isStudent && profileStageKey) {
      base = base.filter((l) => lessonMatchesStage(l.level, profileStageKey));
    }

    // ✅ UPDATED: Advanced mode toggle (now using localStorage-backed state)
    // If Advanced mode is OFF: hide lessons marked as "advanced"
    // If Advanced mode is ON: show everything
    if (!advancedMode) {
      base = base.filter((l) => safeStr(l.tier, "").toLowerCase() !== "advanced");
    }

    return base;
  }, [lessons, isStudent, profileStageKey, advancedMode]);

  /**
   * Subjects dropdown: derived from gatedLessons only (published catalogue).
   */
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    gatedLessons.forEach((l) => set.add(safeStr(l.subject, "Not set")));
    set.delete("Not set");
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    // If lessons have truly unknown subject, still allow selecting it
    if (gatedLessons.some((l) => normalizeForCompare(l.subject) === "not set")) arr.push("Not set");
    return arr;
  }, [gatedLessons]);

  /**
   * Topic suggestions (for datalist)
   * - scoped to selected subject (if chosen)
   * - also narrowed by topicNarrow input
   */
  const topicOptions = useMemo(() => {
    const set = new Set<string>();

    gatedLessons.forEach((l) => {
      if (filters.subject && safeStr(l.subject, "") !== filters.subject) return;
      set.add(safeStr(l.topic, "Not set"));
    });

    let arr = Array.from(set).sort((a, b) => a.localeCompare(b));

    const q = topicNarrow.trim().toLowerCase();
    if (q) arr = arr.filter((t) => t.toLowerCase().includes(q));

    return arr;
  }, [gatedLessons, filters.subject, topicNarrow]);

  const boardOptions = useMemo(() => {
    const set = new Set<string>(BASE_EXAM_BOARDS as unknown as string[]);
    gatedLessons.forEach((l) => set.add(normalizeBoardName(l.examBoardName)));

    const arr = Array.from(set);
    arr.sort((a, b) => {
      const an = a.toLowerCase() === "not set";
      const bn = b.toLowerCase() === "not set";
      if (an && !bn) return 1;
      if (!an && bn) return -1;
      return a.localeCompare(b);
    });
    return arr;
  }, [gatedLessons]);

  const revisionLevelNode = useMemo(
    () => findProfileLevelNode(catalogueData?.publicTree?.levels, profileStageKey),
    [catalogueData?.publicTree?.levels, profileStageKey]
  );

  const revisionCatalogueSubjectOptions = useMemo(
    () => buildRevisionSubjectOptions(revisionLevelNode),
    [revisionLevelNode]
  );

  const revisionCatalogueCourseOptions = useMemo(
    () => buildRevisionCourseOptions(revisionLevelNode, revisionSubject),
    [revisionLevelNode, revisionSubject]
  );

  const revisionCatalogueTopicGroups = useMemo(
    () => buildGroupedRevisionTopicOptions(revisionLevelNode, revisionSubject, revisionCourse),
    [revisionLevelNode, revisionSubject, revisionCourse]
  );

  const selectedRevisionTopicNode = useMemo(
    () => findCatalogueTopicNode(revisionLevelNode, revisionSubject, revisionCourse, revisionTopic),
    [revisionLevelNode, revisionSubject, revisionCourse, revisionTopic]
  );

  const revisionSelectionStatus = useMemo(
    () =>
      getSelectedRevisionStatus(
        revisionLevelNode,
        revisionSubject,
        revisionCourse,
        revisionTopic
      ),
    [revisionLevelNode, revisionSubject, revisionCourse, revisionTopic]
  );

  const myRevisionLessons = useMemo(() => {
    if (!revisionSubject || !revisionTopic) return [];
    const legacyCourse = revisionCourse.includes("|") ? parseCourseKey(revisionCourse) : null;
    return gatedLessons
      .filter((l) => {
        if (safeStr(l.subject, "") !== revisionSubject) return false;
        if (
          !lessonMatchesCatalogueTopic(
            l,
            revisionTopic,
            selectedRevisionTopicNode?.label
          )
        ) {
          return false;
        }
        if (legacyCourse) {
          if (normalizeBoardName(l.examBoardName) !== legacyCourse.board) return false;
          if (normalizeLevelLabel(l.level) !== legacyCourse.level) return false;
          if ((normalizeTier(l.tier) || "") !== (legacyCourse.tier || "")) return false;
        }
        return true;
      })
      .slice(0, 3);
  }, [gatedLessons, revisionSubject, revisionCourse, revisionTopic, selectedRevisionTopicNode?.label]);

  const revisionFocusSpecKey = useMemo(() => {
    if (!revisionSubject || !revisionCourse || !revisionTopic) return null;
    if (revisionSelectionStatus.isComingSoon) return null;
    return revisionCourseToSpecKey(revisionCourse, revisionSubject, () =>
      courseSelectionToSpecKey(revisionSubject, revisionCourse, gatedLessons)
    );
  }, [
    revisionSubject,
    revisionCourse,
    revisionTopic,
    gatedLessons,
    revisionSelectionStatus.isComingSoon,
  ]);

  useEffect(() => {
    if (!token || !revisionFocusSpecKey) {
      setRevisionFocusData(null);
      setRevisionFocusLoading(false);
      setRevisionFocusError(null);
      return;
    }

    let cancelled = false;
    setRevisionFocusLoading(true);
    setRevisionFocusError(null);
    setRevisionFocusData(null);

    getStudentDashboard({ specKey: revisionFocusSpecKey, days: 14, limit: 6 })
      .then((dash) => {
        if (cancelled) return;
        if (dash?.ok) {
          setRevisionFocusData({
            summary: dash.summary?.revisionFocus ?? "We'll highlight your weak topics here after a few quizzes.",
            weakAreas: (dash.weakTopics ?? []).map((w) => ({
              topicKey: w.topicKey,
              topicName: w.topicName ?? w.topicKey,
              attempted: w.total,
              correct: w.correct,
              total: w.total,
              percentage: w.percentage,
            })),
          });
          setRevisionFocusError(null);
        } else {
          setRevisionFocusData(null);
          setRevisionFocusError(REVISION_FOCUS_UNAVAILABLE_COPY);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRevisionFocusData(null);
        setRevisionFocusError(REVISION_FOCUS_UNAVAILABLE_COPY);
      })
      .finally(() => {
        if (!cancelled) setRevisionFocusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, revisionFocusSpecKey]);

  const revisionReady = Boolean(revisionSubject && revisionCourse && revisionTopic);
  const learnLesson = myRevisionLessons[0] || null;
  const revisionPublicActionsEnabled = revisionReady
    ? computeRevisionPublicActionsEnabled(
        revisionSelectionStatus.topicStatus,
        myRevisionLessons.length
      )
    : false;
  const showGrantedSection = shouldShowGrantedSection(adminGrantItems);

  /**
   * Final filtered list:
   * 1) Stage gating (already applied in gatedLessons)
   * 2) Subject / Topic (typed) / Board / Tier
   * 3) Search
   */
  const filteredLessons = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const typedTopic = filters.topic.trim();

    return gatedLessons.filter((lesson) => {
      if (filters.subject && lesson.subject !== filters.subject) return false;

      // ✅ Topic is typeable: treat it as a contains-match (case-insensitive)
      if (typedTopic) {
        const hay = normalizeForCompare(lesson.topic);
        const needle = normalizeForCompare(typedTopic);
        if (!hay.includes(needle)) return false;
      }

      // If NOT in advanced mode, hide lessons that contain stretch blocks
      if (!advancedMode) {
        const hasStretch =
          Array.isArray((lesson as any).pages) &&
          (lesson as any).pages.some((p: any) =>
            Array.isArray(p?.blocks) && p.blocks.some((b: any) => b?.type === "stretch")
          );

        if (hasStretch) return false;
      }

      if (filters.board) {
        const b = normalizeBoardName(lesson.examBoardName);
        if (b !== filters.board) return false;
      }

      // GCSE tier filter (only when level is GCSE)
      if (normalizeLevelLabel(lesson.level) === "GCSE" && filters.tier) {
        const desired = filters.tier.toLowerCase();
        if ((lesson.tier || "").toLowerCase() !== desired) return false;
      }

      if (!q) return true;

      const haystack = [
        lesson.title,
        lesson.description,
        lesson.subject,
        lesson.topic,
        lesson.level,
        lesson.examBoardName,
        lesson.teacherName,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [gatedLessons, filters, advancedMode]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;

    // When subject changes, reset topic (because topics are scoped by subject)
    if (name === "subject") {
      setFilters((prev) => ({
        ...prev,
        subject: value,
        topic: "",
      }));
      setTopicNarrow("");
      return;
    }

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleExamPractice = () => {
    navigate("/assessments/papers"); // Changed from "/assessments" to "/assessments/papers"
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
        padding: "16px",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header - PR-UX-STU-DASH-2.3: reduced spacing */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1 style={{ color: "#333", marginBottom: "5px" }}>Student Dashboard</h1>
            <p style={{ color: "#666", margin: 0 }}>
              {user?.firstName ? `Hi ${user.firstName}` : "Welcome"}
              {lockedLevelLabel ? ` · ${lockedLevelLabel}` : ""}
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
        </div>

        {/* 1. Continue Learning */}
        <div
          style={{
            background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
            padding: "20px 22px",
            borderRadius: "14px",
            boxShadow: "0 6px 20px rgba(16,185,129,0.15)",
            marginBottom: "16px",
            border: "1px solid #6ee7b7",
          }}
        >
          <h2 style={{ color: "#065f46", margin: "0 0 6px 0", fontSize: "1.35rem" }}>Continue learning</h2>
          <p style={{ color: "#047857", margin: 0, fontSize: "0.95rem" }}>
            {!dashboardLoading && hasDashboardActivity
              ? "Pick up where you left off."
              : "Start with a Biology topic below."}
          </p>
          <div style={{ marginTop: 14 }}>
            {!dashboardLoading && hasDashboardActivity && recLessons.length > 0 && recLessons[0]?.id ? (
              <Link className="btn-primary" to={`/lesson/${recLessons[0].id}`} style={{ fontSize: "1rem", padding: "12px 22px" }}>
                Continue
              </Link>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setBrowseOpen(true)}
                style={{ fontSize: "1rem", padding: "12px 22px" }}
              >
                Browse lessons
              </button>
            )}
          </div>
        </div>

        {/* 2. MY REVISION — indigo border distinguishes from My classes (teal) */}
        <div
          className="student-dashboard-revision"
          style={{
            background: "white",
            padding: "22px 24px",
            borderRadius: "14px",
            boxShadow: "0 3px 10px rgba(79, 70, 229, 0.10)",
            marginBottom: "16px",
            border: "2px solid #4f46e5",
          }}
        >
          <h2 style={{ color: "#0f172a", margin: "0 0 6px 0", fontSize: "1.4rem", fontWeight: 800 }}>MY REVISION</h2>
          <p style={{ color: "#475569", margin: "0 0 18px 0", fontSize: "0.95rem", fontWeight: 500 }}>
            Choose your course and topic, then learn, quiz, or practise.
            {lockedLevelLabel ? ` Your study stage is ${lockedLevelLabel}.` : ""}
          </p>

          {catalogueError && !catalogueLoading && (
            <p
              role="alert"
              style={{
                color: "#9a3412",
                fontSize: "0.9rem",
                margin: "0 0 12px 0",
                padding: "10px 12px",
                background: "#fff7ed",
                border: "1px solid #fdba74",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              {catalogueError}
            </p>
          )}

          {catalogueLoading && (
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "0 0 12px 0" }}>
              Loading catalogue…
            </p>
          )}

          {/* Step 1: dropdowns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 14,
              marginBottom: 18,
              padding: 14,
              background: "#f1f5f9",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: 8, color: "#0f172a", fontWeight: 800, fontSize: "0.9rem" }}>
                1. Subject
              </label>
              <select
                value={revisionSubject}
                onChange={(e) => {
                  setRevisionSubject(e.target.value);
                  setRevisionCourse("");
                  setRevisionTopic("");
                }}
                style={{
                  width: "100%",
                  minHeight: 48,
                  padding: "12px 14px",
                  border: revisionSubject ? "2px solid #059669" : "2px solid #64748b",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#0f172a",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                <option value="">Select subject</option>
                {revisionCatalogueSubjectOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, color: "#0f172a", fontWeight: 800, fontSize: "0.9rem" }}>
                2. Course
              </label>
              <select
                value={revisionCourse}
                disabled={!revisionSubject}
                onChange={(e) => {
                  setRevisionCourse(e.target.value);
                  setRevisionTopic("");
                }}
                style={{
                  width: "100%",
                  minHeight: 48,
                  padding: "12px 14px",
                  border: !revisionSubject
                    ? "2px solid #cbd5e1"
                    : revisionCourse
                      ? "2px solid #059669"
                      : "2px solid #64748b",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 600,
                  color: revisionSubject ? "#0f172a" : "#94a3b8",
                  background: revisionSubject ? "white" : "#e2e8f0",
                  cursor: revisionSubject ? "pointer" : "not-allowed",
                }}
              >
                <option value="">Select course</option>
                {revisionCatalogueCourseOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 8, color: "#0f172a", fontWeight: 800, fontSize: "0.9rem" }}>
                3. Topic
              </label>
              <select
                value={revisionTopic}
                disabled={!revisionSubject || !revisionCourse}
                onChange={(e) => setRevisionTopic(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 48,
                  padding: "12px 14px",
                  border:
                    !revisionSubject || !revisionCourse
                      ? "2px solid #cbd5e1"
                      : revisionTopic
                        ? "2px solid #059669"
                        : "2px solid #64748b",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 600,
                  color: revisionSubject && revisionCourse ? "#0f172a" : "#94a3b8",
                  background: revisionSubject && revisionCourse ? "white" : "#e2e8f0",
                  cursor: revisionSubject && revisionCourse ? "pointer" : "not-allowed",
                }}
              >
                <option value="">Select topic</option>
                {revisionCatalogueTopicGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {revisionReady && revisionSelectionStatus.statusHeadline && (
            <div
              style={{
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 10,
                background: "#fff7ed",
                border: "1px solid #fdba74",
                color: "#9a3412",
                fontWeight: 700,
                fontSize: "0.95rem",
              }}
            >
              {revisionSelectionStatus.statusHeadline}
            </div>
          )}

          {/* Step 2: actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
            {revisionPublicActionsEnabled && learnLesson?.id ? (
              <Link
                to={`/lesson/${learnLesson.id}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: "1rem",
                  fontWeight: 800,
                  textDecoration: "none",
                  background: "#059669",
                  color: "white",
                  border: "2px solid #047857",
                  boxShadow: "0 2px 0 #065f46",
                }}
              >
                Learn topic
              </Link>
            ) : (
              <button
                type="button"
                disabled={!revisionPublicActionsEnabled}
                onClick={() => {
                  if (revisionPublicActionsEnabled) setBrowseOpen(true);
                }}
                style={{
                  minHeight: 48,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: "1rem",
                  fontWeight: 800,
                  background: revisionPublicActionsEnabled ? "#059669" : "#cbd5e1",
                  color: revisionPublicActionsEnabled ? "white" : "#64748b",
                  border: revisionPublicActionsEnabled ? "2px solid #047857" : "2px solid #94a3b8",
                  cursor: revisionPublicActionsEnabled ? "pointer" : "not-allowed",
                  boxShadow: revisionPublicActionsEnabled ? "0 2px 0 #065f46" : "none",
                }}
              >
                Learn topic
              </button>
            )}
            {revisionPublicActionsEnabled ? (
              <Link
                to="/student/quick-quiz"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: "1rem",
                  fontWeight: 800,
                  textDecoration: "none",
                  background: "white",
                  color: "#0f172a",
                  border: "2px solid #334155",
                }}
              >
                Quick quiz
              </Link>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  minHeight: 48,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: "1rem",
                  fontWeight: 800,
                  background: "#e2e8f0",
                  color: "#94a3b8",
                  border: "2px solid #cbd5e1",
                  cursor: "not-allowed",
                }}
              >
                Quick quiz
              </button>
            )}
            <button
              type="button"
              disabled={!revisionPublicActionsEnabled}
              onClick={handleExamPractice}
              style={{
                minHeight: 48,
                padding: "12px 22px",
                borderRadius: 10,
                fontSize: "1rem",
                fontWeight: 800,
                background: revisionPublicActionsEnabled ? "white" : "#e2e8f0",
                color: revisionPublicActionsEnabled ? "#0f172a" : "#94a3b8",
                border: revisionPublicActionsEnabled ? "2px solid #334155" : "2px solid #cbd5e1",
                cursor: revisionPublicActionsEnabled ? "pointer" : "not-allowed",
              }}
            >
              Exam practice
            </button>
            {revisionPublicActionsEnabled ? (
              <Link
                to="/student/structure-notes"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 48,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: "1rem",
                  fontWeight: 800,
                  textDecoration: "none",
                  background: "white",
                  color: "#0f172a",
                  border: "2px solid #334155",
                }}
              >
                Make notes
              </Link>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  minHeight: 48,
                  padding: "12px 22px",
                  borderRadius: 10,
                  fontSize: "1rem",
                  fontWeight: 800,
                  background: "#e2e8f0",
                  color: "#94a3b8",
                  border: "2px solid #cbd5e1",
                  cursor: "not-allowed",
                }}
              >
                Make notes
              </button>
            )}
          </div>

          {/* Step 3: helper */}
          {!revisionReady && (
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: 0, fontWeight: 600 }}>
              Select subject, course, then topic to unlock the buttons.
            </p>
          )}

          {revisionReady && revisionSelectionStatus.isComingSoon && (
            <p style={{ color: "#9a3412", fontSize: "0.9rem", margin: "8px 0 0 0", fontWeight: 600 }}>
              This curriculum is not available yet. You can browse it now, and learning tools will unlock when lessons launch.
            </p>
          )}

          {showGrantedSection && (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {adminGrantItems.map((grant) => (
                <div
                  key={grant.lessonId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid #c4b5fd",
                    background: "#f5f3ff",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#4c1d95", fontSize: "0.85rem" }}>
                      Granted to you
                      {grant.stageMismatch ? " · different stage" : ""}
                    </div>
                    <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>{grant.title}</div>
                    <div style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 2 }}>
                      {grant.topic} · {grant.subject}
                      {grant.level ? ` · ${grant.level}` : ""}
                    </div>
                  </div>
                  <Link to={`/lesson/${grant.lessonId}`}>
                    <button
                      type="button"
                      style={{
                        padding: "10px 16px",
                        background: "#7c3aed",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Learn
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {revisionReady && myRevisionLessons.length > 0 && (
            <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
              {myRevisionLessons.map((lesson) => {
                const isFreePreview = Boolean(lesson.isFreePreview);
                const isUnlocked = Boolean(lesson.hasAccess) && !isFreePreview;
                const courseLine = formatCourseLabel(lesson.examBoardName, lesson.level, lesson.tier, {
                  suppressTier: isEdexcelIgcseBiologyDisplay(lesson),
                });
                return (
                  <div
                    key={lesson.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "1rem" }}>{lesson.title}</div>
                      <div style={{ color: "#64748b", fontSize: "0.85rem", marginTop: 2 }}>
                        {lesson.topic} · {courseLine}
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <LessonAccessBadge
                          hasAccess={lesson.hasAccess}
                          locked={lesson.locked}
                          reason={lesson.reason}
                          isFreePreview={lesson.isFreePreview}
                        />
                      </div>
                    </div>
                    <div>
                      {isUnlocked || isFreePreview ? (
                        <Link to={`/lesson/${lesson.id}`}>
                          <button
                            type="button"
                            style={{
                              padding: "10px 16px",
                              background: isUnlocked ? "#10b981" : "#e2e8f0",
                              color: isUnlocked ? "white" : "#334155",
                              border: "none",
                              borderRadius: 8,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {isUnlocked ? "Go to Lesson" : "Preview"}
                          </button>
                        </Link>
                      ) : (
                        <Link to="/subscription">
                          <button
                            type="button"
                            style={{
                              padding: "10px 16px",
                              background: "transparent",
                              color: "#4f46e5",
                              border: "1px solid #4f46e5",
                              borderRadius: 8,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Upgrade
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {revisionReady &&
            !revisionSelectionStatus.isComingSoon &&
            myRevisionLessons.length === 0 &&
            !showGrantedSection && (
            <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "8px 0 0 0" }}>
              No lessons for this topic yet.{" "}
              <button
                type="button"
                onClick={() => setBrowseOpen(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#047857",
                  fontWeight: 700,
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: 0,
                }}
              >
                Browse all lessons
              </button>
            </p>
          )}
        </div>

        {/* My classes — invitations + joined summary */}
        <StudentMyClassesSection />

        {/* 3. Revision Focus */}
        <RevisionFocusBlock
          specKey={revisionFocusSpecKey}
          revisionFocusData={revisionFocusData}
          revisionFocusLoading={revisionFocusLoading}
          revisionFocusError={revisionFocusError}
        />

        {/* 4. My Progress | My Work */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/student/my-progress")}
            style={{
              padding: "18px 20px",
              background: "white",
              border: "2px solid #334155",
              borderRadius: 12,
              boxShadow: "0 2px 0 #0f172a",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1.05rem" }}>My progress →</div>
            <div style={{ color: "#475569", fontSize: "0.85rem", marginTop: 4, fontWeight: 600 }}>
              Weak topics and mastery
            </div>
          </button>
          <Link
            to="/student/my-work"
            style={{
              padding: "18px 20px",
              background: "white",
              border: "2px solid #334155",
              borderRadius: 12,
              boxShadow: "0 2px 0 #0f172a",
              textDecoration: "none",
              display: "block",
            }}
          >
            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "1.05rem" }}>My work →</div>
            <div style={{ color: "#475569", fontSize: "0.85rem", marginTop: 4, fontWeight: 600 }}>
              Assignments and completed work
            </div>
          </Link>
        </div>

        {/* 5. Browse all lessons (collapsed by default) */}
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setBrowseOpen((v) => !v)}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "14px 18px",
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              fontWeight: 800,
              color: "#334155",
              fontSize: "1rem",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            Browse all lessons {browseOpen ? "▴" : "▾"}
          </button>
        </div>

        {browseOpen && (
        <>
        {/* Filters - PR-UX-STU-DASH-2.1: collapsible, collapsed by default */}
        <div
          style={{
            background: "white",
            padding: filtersOpen ? "20px" : "14px 20px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginBottom: filtersOpen ? 16 : 0,
            }}
          >
            <div style={{ minWidth: 140 }}>
              <label style={{ display: "block", marginBottom: 4, color: "#666", fontSize: "0.85rem", fontWeight: 600 }}>
                Subject
              </label>
              <select
                name="subject"
                value={filters.subject}
                onChange={handleFilterChange}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 14 }}
              >
                <option value="">All Subjects</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Search - always visible when collapsed */}
            <div style={{ flex: 1, minWidth: 180 }}>
              <label style={{ display: "block", marginBottom: 4, color: "#666", fontSize: "0.85rem", fontWeight: 600 }}>
                Search
              </label>
              <input
                type="text"
                name="search"
                placeholder="Search title, subject, topic..."
                value={filters.search}
                onChange={handleFilterChange}
                style={{ width: "100%", padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: 14 }}
              />
            </div>

            {/* Advanced filters toggle */}
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: filtersOpen ? "#e5e7eb" : "white",
                color: "#374151",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              {filtersOpen ? "Hide filters" : "Advanced filters"}
            </button>

            {filtersOpen && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "15px",
                alignItems: "end",
                marginTop: 16,
              }}
            >
            {/* Topic (TYPEABLE) */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#666", fontWeight: "bold" }}>
                Topic
              </label>
              <input
                name="topic"
                value={filters.topic}
                onChange={handleFilterChange}
                list="topic-options"
                placeholder="Type a topic…"
                style={{ width: "100%", padding: "10px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
              />
              <datalist id="topic-options">
                {topicOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {/* Level (locked for students, Option A) */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#666", fontWeight: "bold" }}>
                Level
              </label>
              <select
                name="levelLocked"
                value={lockedLevelLabel || "All Levels"}
                disabled={Boolean(lockedLevelLabel)}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  background: Boolean(lockedLevelLabel) ? "#f8fafc" : "white",
                  color: Boolean(lockedLevelLabel) ? "#6b7280" : "#111827",
                }}
              >
                {lockedLevelLabel ? (
                  <option value={lockedLevelLabel}>{lockedLevelLabel}</option>
                ) : (
                  <>
                    <option value="All Levels">All Levels</option>
                    <option value="KS3">KS3</option>
                    <option value="GCSE">GCSE</option>
                    <option value="A-Level">A-Level</option>
                  </>
                )}
              </select>
            </div>

            {/* Exam Board */}
            <div>
              <label style={{ display: "block", marginBottom: "8px", color: "#666", fontWeight: "bold" }}>
                Exam Board
              </label>
              <select
                name="board"
                value={filters.board}
                onChange={handleFilterChange}
                style={{ width: "100%", padding: "10px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
              >
                <option value="">All boards</option>
                {boardOptions.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Narrow topics input (within subject) */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", marginBottom: "8px", color: "#666", fontWeight: "bold" }}>
                Narrow topics (within subject)
              </label>
              <input
                type="text"
                value={topicNarrow}
                onChange={(e) => setTopicNarrow(e.target.value)}
                placeholder="Narrow topic suggestions (within the selected subject)..."
                style={{ width: "100%", padding: "10px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
              />
            </div>

            {/* Deeper knowledge toggle */}
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  setAdvancedMode((v) => {
                    const newValue = !v;
                    localStorage.setItem("advancedMode", String(newValue));
                    return newValue;
                  });
                }}
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

            {/* Tier (only when locked/filtered level is GCSE) */}
            {lockedLevelLabel === "GCSE" && (
              <div>
                <label style={{ display: "block", marginBottom: "8px", color: "#666", fontWeight: "bold" }}>
                  Tier
                </label>
                <select
                  name="tier"
                  value={filters.tier}
                  onChange={handleFilterChange}
                  style={{ width: "100%", padding: "10px", border: "2px solid #e2e8f0", borderRadius: "6px" }}
                >
                  <option value="">All tiers</option>
                  <option value="foundation">Foundation</option>
                  <option value="higher">Higher</option>
                </select>
              </div>
            )}
            </div>
            )}
          </div>
        </div>

        {/* Results Count - PR-UX-STU-DASH-2.3: reduced spacing */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ color: "#333", margin: 0 }}>All lessons</h2>
          <div style={{ color: "#666" }}>
            {filteredLessons.length} lesson{filteredLessons.length !== 1 ? "s" : ""}
            {advancedMode && " (Advanced mode active)"}
          </div>
        </div>
        <LessonAccessBadgeLegend />

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
            <p style={{ color: "#999" }}>Try changing your filters or check back later for new lessons.</p>
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
              const isFreePreview = Boolean(lesson.isFreePreview);
              const isUnlocked = Boolean(lesson.hasAccess) && !isFreePreview;
              const isLocked = !isFreePreview && !isUnlocked;

              return (
                <div
                  key={lesson.id}
                  className="lesson-card"
                  style={{
                    background: "white",
                    borderRadius: "12px",
                    overflow: "hidden",
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
                    <p style={{ margin: "5px 0 0 0", opacity: 0.9, fontSize: "0.9rem" }}>
                      By {lesson.teacherName}
                    </p>
                  </div>

                  <div style={{ padding: "20px", flexGrow: 1 }}>
                    <div style={{ marginBottom: "12px" }}>
                      <LessonAccessBadge
                        hasAccess={lesson.hasAccess}
                        locked={lesson.locked}
                        reason={lesson.reason}
                        isFreePreview={lesson.isFreePreview}
                      />
                    </div>

                    {lesson.description?.trim() ? (
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
                    ) : null}

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
                        {lesson.topic}
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
                        {lesson.examBoardName}
                      </span>

                      {lesson.tier && !isEdexcelIgcseBiologyDisplay(lesson) && (
                        <span
                          style={{
                            padding: "4px 10px",
                            background: lesson.tier === "advanced" ? "rgba(124,58,237,0.20)" : "#e9d5ff",
                            borderRadius: "20px",
                            fontSize: "0.8rem",
                            color: lesson.tier === "advanced" ? "#5b21b6" : "#6b21a8",
                            fontWeight: lesson.tier === "advanced" ? 700 : 400,
                          }}
                        >
                          {lesson.tier === "foundation"
                            ? "Foundation Tier"
                            : lesson.tier === "higher"
                            ? "Higher Tier"
                            : lesson.tier === "advanced"
                            ? "🔥 Advanced"
                            : lesson.tier}
                        </span>
                      )}

                      {Array.isArray((lesson as any).pages) &&
                        (lesson as any).pages.some((p: any) =>
                          Array.isArray(p?.blocks) && p.blocks.some((b: any) => b?.type === "stretch")
                        ) && (
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

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "auto",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: "1rem", fontWeight: 700, color: "#333" }}>
                          {isFreePreview
                            ? "Free preview"
                            : isUnlocked
                            ? "Included in your subscription"
                            : "Upgrade to access"}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#666" }}>⭐ {lesson.averageRating}/5</div>
                      </div>

                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        {isUnlocked && (
                          <Link to={`/lesson/${lesson.id}`}>
                            <button
                              style={{
                                padding: "8px 16px",
                                background: "#48bb78",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                                fontWeight: "bold",
                              }}
                            >
                              View lesson
                            </button>
                          </Link>
                        )}
                        {isFreePreview && (
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
                        )}
                        {isLocked && (
                          <>
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
                              Locked
                            </button>
                            <Link to="/subscription">
                              <button
                                style={{
                                  padding: "8px 16px",
                                  background: "transparent",
                                  color: "#4f46e5",
                                  border: "1px solid #4f46e5",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "0.9rem",
                                }}
                              >
                                Upgrade to access
                              </button>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        </>
        )}

        {/* Purchased Lessons */}
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
              <h2 style={{ color: "#333", margin: 0 }}>My lessons</h2>
              <div style={{ color: "#666" }}>
                {(() => {
                  const uniq = new Set(user.purchasedLessons.map((p: any) => String(p?.lessonId ?? p)).filter(Boolean));
                  return `${uniq.size} lesson${uniq.size !== 1 ? "s" : ""}`;
                })()}
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
                {(() => {
                  const seen = new Set<string>();
                  const rows: { lessonId: string; purchase: any }[] = [];
                  user.purchasedLessons.forEach((purchase: any) => {
                    const lessonId = String(purchase.lessonId ?? purchase ?? "");
                    if (!lessonId || seen.has(lessonId)) return;
                    seen.add(lessonId);
                    rows.push({ lessonId, purchase });
                  });
                  return rows.map(({ lessonId, purchase }) => {
                    const canOpen = isUuid(lessonId) || isMongoObjectId(lessonId);
                    const lesson = purchasedLessonMap[lessonId];
                    const unavailable = !lesson;

                    return (
                      <div
                        key={lessonId}
                        style={{
                          background: "#f8fafc",
                          borderRadius: "8px",
                          padding: "15px",
                          border: "2px solid #e2e8f0",
                          opacity: canOpen && !unavailable ? 1 : 0.85,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h4 style={{ margin: "0 0 5px 0", color: "#333" }}>
                              {lesson?.title ?? "Lesson unavailable"}
                            </h4>
                            {lesson && (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                {lesson.subject && (
                                  <span style={{ padding: "2px 8px", background: "#e2e8f0", borderRadius: 12, fontSize: "0.8rem", color: "#4a5568" }}>
                                    {lesson.subject}
                                  </span>
                                )}
                                {lesson.level && (
                                  <span style={{ padding: "2px 8px", background: "#bee3f8", borderRadius: 12, fontSize: "0.8rem", color: "#2c5282" }}>
                                    {lesson.level}
                                  </span>
                                )}
                              </div>
                            )}
                            <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem", color: "#48bb78" }}>
                              Included in your subscription
                            </p>
                          </div>
                          {canOpen && !unavailable ? (
                            <Link to={`/lesson/${lessonId}`} style={{ flexShrink: 0 }}>
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
                              {unavailable ? "Unavailable" : "Unavailable"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Footer Info */}
        <div style={{ marginTop: "40px", textAlign: "center", color: "#666", fontSize: "0.9rem" }}>
          <p>Some lessons include free previews. Full access depends on your account.</p>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;