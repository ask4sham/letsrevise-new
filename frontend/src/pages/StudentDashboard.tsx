// frontend/src/pages/StudentDashboard.tsx
// PR-AUTH-UI-1: use shared useCurrentUser hook (single source of truth for auth).
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import LessonAccessBadge, { LessonAccessBadgeLegend } from "../components/LessonAccessBadge";
import { getKnowledgeGap, type KnowledgeGapResponse } from "../api/studentKnowledgeGap";
import { getStudentDashboard, type DashboardResponse } from "../api/studentDashboard";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getApiClientErrorMessage, getAxiosErrorMessage, getErrorMessageFromData } from "../utils/apiErrorMessage";

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
  shamCoinPrice?: any;
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
  shamCoinPrice: number;
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
  if (l.includes("gcse")) return "GCSE";
  if (l.includes("a-level") || l.includes("alevel") || l.includes("a level")) return "A-Level";

  return v;
}

function normalizeBoardName(board: string) {
  const b = safeStr(board, "");
  return b.trim() ? b : "Not set";
}

function normalizeForCompare(s: string) {
  return safeStr(s, "").trim().toLowerCase();
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

// Seed "all subjects" list for the dropdown (plus whatever exists in Mongo).
// Add/remove freely without breaking anything.
const BASE_SUBJECTS = [
  "Biology",
  "Chemistry",
  "Physics",
  "Science",
  "Mathematics",
  "Further Mathematics",
  "English Language",
  "English Literature",
  "Geography",
  "History",
  "Computer Science",
  "Business",
  "Economics",
  "Psychology",
  "Sociology",
  "Religious Studies",
  "Spanish",
  "French",
  "German",
  "Art",
  "Music",
  "PE",
] as const;

/** Step 6: Your revision focus — uses dashboardData when available, fallback to knowledge-gap. */
function RevisionFocusBlock({
  dashboardData,
  dashboardLoading,
}: {
  dashboardData: DashboardResponse | null;
  dashboardLoading: boolean;
}) {
  const [fallbackData, setFallbackData] = useState<KnowledgeGapResponse | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);

  const data: KnowledgeGapResponse | null = dashboardData?.ok
    ? {
        summary: dashboardData.summary?.revisionFocus ?? "Keep practising to see personalised revision focus.",
        weakAreas: (dashboardData.weakTopics ?? []).map((w) => ({
          topicKey: w.topicKey,
          topicName: w.topicName ?? w.topicKey,
          attempted: w.total,
          correct: w.correct,
          total: w.total,
          percentage: w.percentage,
        })),
      }
    : fallbackData;

  useEffect(() => {
    if (!dashboardLoading && !dashboardData?.ok && fallbackData === null && !fallbackError) {
      getKnowledgeGap()
        .then(setFallbackData)
        .catch((err: unknown) => setFallbackError(getApiClientErrorMessage(err, "Failed to load revision focus")));
    }
  }, [dashboardLoading, dashboardData?.ok, fallbackData, fallbackError]);

  const loading = dashboardLoading && !fallbackData;

  if (loading) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          padding: "14px 20px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          marginBottom: "16px",
          border: "1px solid #fcd34d",
        }}
      >
        <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Your revision focus</div>
        <p style={{ margin: 0, color: "#b45309", fontSize: "0.9rem" }}>Loading…</p>
      </div>
    );
  }
  if (fallbackError) return null;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
        padding: "14px 20px",
        borderRadius: "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        marginBottom: "16px",
        border: "1px solid #fcd34d",
      }}
    >
      <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Your revision focus</div>
      <p style={{ margin: "0 0 10px 0", color: "#78350f", fontSize: "0.95rem", lineHeight: 1.5 }}>
        {data?.summary || "Keep practising to see personalised revision focus."}
      </p>
      {data?.weakAreas && data.weakAreas.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 20, color: "#92400e", fontSize: "0.9rem", lineHeight: 1.6 }}>
          {data.weakAreas.map((w) => (
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

  const [purchasedLessonMap, setPurchasedLessonMap] = useState<
    Record<string, { _id: string; title: string | null; subject: string | null; level: string | null; topic: string | null; shamCoinPrice: number }>
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

  // PR-AUTH-UI-2: derive from useCurrentUser (no localStorage auth reads)
  const userType = (user?.userType || user?.type || "").toString().toLowerCase();
  const isStudent = userType === "student" || userType === "";

  const studentStageKey = useMemo(() => {
    const lsStage = safeStr(localStorage.getItem("selectedStage"), "");
    if (lsStage) return normalizeStageKey(lsStage);
    const stageFromUser = safeStr(user?.stage || user?.level || (user as any)?.selectedStage, "");
    return normalizeStageKey(stageFromUser);
  }, [user?.stage, user?.level, (user as any)?.selectedStage]);

  const lockedLevelLabel = useMemo(() => {
    return isStudent && studentStageKey ? stageLabel(studentStageKey) : "";
  }, [isStudent, studentStageKey]);

  useEffect(() => {
    loadPublishedLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 2: Fetch unified dashboard (revision focus + recommendations + study plan)
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
              shamCoinPrice: 0,
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
                  shamCoinPrice: 0,
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
      setPurchasedLessonMap({});
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
      const levelParam = isStudent && studentStageKey ? stageKeyToLessonLevel(studentStageKey) : "";

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
            shamCoinPrice: Number.isFinite(Number((l as any).shamCoinPrice))
              ? Number((l as any).shamCoinPrice)
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
          shamCoinPrice: 0,
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
    if (isStudent && studentStageKey) {
      base = base.filter((l) => lessonMatchesStage(l.level, studentStageKey));
    }

    // ✅ UPDATED: Advanced mode toggle (now using localStorage-backed state)
    // If Advanced mode is OFF: hide lessons marked as "advanced"
    // If Advanced mode is ON: show everything
    if (!advancedMode) {
      base = base.filter((l) => safeStr(l.tier, "").toLowerCase() !== "advanced");
    }

    return base;
  }, [lessons, isStudent, studentStageKey, advancedMode]);

  /**
   * Subjects dropdown:
   * - Seed with a broader list (BASE_SUBJECTS)
   * - Also include whatever subjects exist in gatedLessons
   */
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    (BASE_SUBJECTS as unknown as string[]).forEach((s) => set.add(s));
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

  const handlePurchase = async (lessonId: string) => {
    navigate(`/lesson/${lessonId}`);
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
            <h1 style={{ color: "#333", marginBottom: "5px" }}>👨‍🎓 Student Dashboard</h1>
            <p style={{ color: "#666" }}>
              Welcome back, {user?.firstName}!{" "}
              {lockedLevelLabel ? `You are browsing ${lockedLevelLabel} lessons only.` : ""}
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
            <p style={{ color: "#6b7280", fontSize: "0.9rem", margin: "8px 0 0 0" }}>
              This week: Start a lesson to begin tracking progress.
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

            {/* ✅ UPDATED: Exam Practice Link - Now goes to /assessments/papers */}
            <button
              onClick={handleExamPractice}
              style={{
                padding: "10px 16px",
                background: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              📝 Exam Practice
            </button>

            <Link to="/dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
              Back to Main Dashboard
            </Link>
          </div>
        </div>

        {/* Start learning - PR-UX-STU-DASH-2: compact */}
        <div
          style={{
            background: "white",
            padding: "14px 20px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "16px",
          }}
        >
          <h3 style={{ color: "#333", margin: "0 0 12px 0", fontSize: "1rem" }}>Start learning</h3>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => navigate("/browse-lessons")}
              style={{
                padding: "10px 18px",
                background: "#48bb78",
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
              🔍 Browse Lessons
            </button>
            <button
              onClick={handleExamPractice}
              style={{
                padding: "10px 18px",
                background: "#4f46e5",
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
              📝 Exam Practice
            </button>
            <Link
              to="/student/my-work"
              style={{
                padding: "10px 18px",
                background: "#059669",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              📋 My Work
            </Link>
            <button
              onClick={() => navigate("/student/my-progress")}
              style={{
                padding: "10px 18px",
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
              📊 View Progress
            </button>
            <Link
              to="/student/practice"
              style={{
                padding: "10px 18px",
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              ✏️ Practice recommendations
            </Link>
            <Link
              to="/student/quick-quiz"
              style={{
                padding: "10px 18px",
                background: "#0d9488",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              🧠 Quick quiz
            </Link>
            <Link
              to="/student/structure-notes"
              style={{
                padding: "10px 18px",
                background: "#c026d3",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textDecoration: "none",
              }}
            >
              📝 Create your own notes
            </Link>
          </div>
        </div>

        {/* Step 6: Your revision focus (knowledge gap) — uses unified dashboard */}
        <RevisionFocusBlock dashboardData={dashboardData} dashboardLoading={dashboardLoading} />

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

        {/* PR-UX-STU-DASH-1: Recommended next - PR-UX-STU-DASH-2.2: slim, single row */}
        <div
          style={{
            background: "white",
            padding: "12px 16px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            marginBottom: "16px",
          }}
        >
          {filteredLessons.length > 0 ? (
            (() => {
              const recommendedLesson = filteredLessons[0];
              return (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#6b7280", marginRight: 4 }}>Recommended next</span>
                  <span style={{ fontSize: "1rem", fontWeight: 600, color: "#111827" }}>{recommendedLesson.title}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        background: "#e2e8f0",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        color: "#4a5568",
                      }}
                    >
                      {recommendedLesson.subject}
                    </span>
                    {recommendedLesson.examBoardName && recommendedLesson.examBoardName !== "Not set" && (
                      <span
                        style={{
                          padding: "2px 8px",
                          background: "#fef3c7",
                          borderRadius: 12,
                          fontSize: "0.75rem",
                          color: "#92400e",
                        }}
                      >
                        {recommendedLesson.examBoardName}
                      </span>
                    )}
                  </div>
                  <Link to={`/lesson/${recommendedLesson.id}`} style={{ marginLeft: "auto" }}>
                    <button
                      style={{
                        padding: "8px 16px",
                        background: "#48bb78",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Continue
                    </button>
                  </Link>
                </div>
              );
            })()
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#6b7280" }}>Recommended next</span>
              <span style={{ fontSize: "0.95rem", color: "#374151" }}>Start your first lesson</span>
              <Link to="/browse-lessons">
                <button
                  style={{
                    padding: "8px 16px",
                    background: "#48bb78",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Browse lessons
                </button>
              </Link>
            </div>
          )}
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
          <h2 style={{ color: "#333", margin: 0 }}>Available Lessons</h2>
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

                      {lesson.tier && (
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
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#333" }}>
                          {lesson.shamCoinPrice}{" "}
                          <span style={{ fontSize: "1rem", color: "#666" }}>ShamCoins</span>
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
                                Subscribe
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
              <h2 style={{ color: "#333", margin: 0 }}>My Purchased Lessons</h2>
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
                            <p style={{ margin: 0, fontSize: "0.9rem", color: "#666" }}>
                              Purchased:{" "}
                              {purchase.purchasedAt ? new Date(purchase.purchasedAt).toLocaleDateString() : purchase.timestamp ? new Date(purchase.timestamp).toLocaleDateString() : "—"}
                            </p>
                            <p style={{ margin: "5px 0 0 0", fontSize: "0.9rem", color: "#48bb78" }}>
                              Price: {purchase.price ?? 0} ShamCoins
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
          <p>Need more ShamCoins? Complete assignments or refer friends to earn more!</p>
          <p>Purchases will be re-enabled after we migrate the purchase flow to Supabase.</p>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;