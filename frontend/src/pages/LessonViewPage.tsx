// frontend/src/pages/LessonViewPage.tsx
import React, { useMemo, useEffect, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import axios from "axios";
import { supabase } from "../lib/supabaseClient";
import api, { getVisual } from "../services/api";

import { ReviewList, ReviewForm } from "../components/reviews";
import FlashcardsView from "../components/revision/FlashcardsView";
import { QuizView } from "../components/revision/QuizView";
import SubscriptionRequired from "../components/SubscriptionRequired";

interface LessonPageBlock {
  type: "text" | "keyIdea" | "examTip" | "commonMistake" | "stretch";
  content: string;
}

interface LessonPageHero {
  type: "none" | "image" | "video" | "animation";
  src: any; // can be string OR {url} depending on what editor saved
  caption?: string;
}

interface LessonPage {
  pageId: string;
  title: string;
  order: number;
  pageType?: string;
  hero?: LessonPageHero;
  blocks?: LessonPageBlock[];
  checkpoint?: {
    question?: string;
    options?: string[];
    answer?: string;
  };
}

interface Lesson {
  id: string;

  title: string;
  description: string;
  content: string;

  subject: string;
  level: string;
  topic: string;

  // UI label remains "Exam board"
  examBoardName: string | null;

  teacherName: string;
  teacherId: string;

  estimatedDuration: number;
  shamCoinPrice: number;

  isPublished: boolean;
  views: number;

  averageRating: number;
  totalRatings: number;

  createdAt: string;

  // ✅ NEW
  pages?: LessonPage[];
  
  // ✅ Phase C3: Preview mode flag from backend
  isFreePreview?: boolean;
  
  // ✅ ADDED: Revision fields
  flashcards?: Array<{
    id: string;
    front: string;
    back: string;
    tags?: string[];
    difficulty?: number; // This is number (not 1|2|3)
  }>;
  quiz?: {
    timeSeconds?: number;
    questions?: Array<{
      id: string;
      type: "mcq" | "short" | "exam";
      question: string;
      options?: string[];
      correctAnswer: string;
      explanation?: string;
      tags?: string[];
      difficulty?: number;
      marks?: number;
      markScheme?: string[];
    }>;
  };
}

// ✅ Define a type for the flashcards with proper difficulty
type FlashcardData = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: number; // Allow any number for now
};

interface User {
  _id: string;
  userType: string;
  shamCoins: number;
  purchasedLessons: Array<{
    lessonId: string;
    purchasedAt: string;
  }>;
  // ✅ optional (some user shapes include this; we keep it safe)
  level?: string;
  stage?: string;
  educationLevel?: string;
  academicLevel?: string;
}

type ExamBoardRow = { name: string };

function getBoardName(
  exam_board: ExamBoardRow[] | ExamBoardRow | null | undefined
): string | null {
  if (Array.isArray(exam_board)) return exam_board[0]?.name ?? null;
  if (exam_board && typeof exam_board === "object" && "name" in exam_board) {
    return (exam_board as ExamBoardRow).name ?? null;
  }
  return null;
}

// ✅ Mongo ObjectId is 24 hex chars. Supabase UUID is different.
function isMongoObjectId(value: string | undefined) {
  if (!value) return false;
  return /^[a-f0-9]{24}$/i.test(value);
}

function isUuid(value: string | undefined) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function safeStr(v: any, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s : fallback;
}

function sortPages(pages: LessonPage[]) {
  return [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function normalizeHeroSrc(hero?: LessonPageHero): string {
  if (!hero) return "";
  const raw = (hero as any).src;

  // common shapes:
  // - "https://..."
  // - { url: "https://..." }
  // - { src: "https://..." }
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const url = safeStr((raw as any).url, "") || safeStr((raw as any).src, "");
    return url.trim();
  }

  return "";
}

// ============================
// Level normalization + access gate
// ============================

function normalizeLevelForCompare(levelRaw: string) {
  const s = safeStr(levelRaw, "").toLowerCase().trim();
  if (!s) return "";

  // common variants we might see in data
  if (
    s.includes("ks3") ||
    s.includes("key stage 3") ||
    s.includes("key stage three")
  )
    return "ks3";
  if (s.includes("gcse")) return "gcse";
  if (s.includes("a level") || s.includes("alevel") || s.includes("a-level"))
    return "a-level";

  // fallback: return cleaned string
  return s.replace(/\s+/g, " ").trim();
}

function getUserLevel(u: User | null): string {
  if (!u) return "";
  const candidate =
    safeStr((u as any).level, "") ||
    safeStr((u as any).stage, "") ||
    safeStr((u as any).educationLevel, "") ||
    safeStr((u as any).academicLevel, "");
  return normalizeLevelForCompare(candidate);
}

type CheckpointFeedback = {
  open: boolean;
  correct: boolean;
  message: string;
};

// ============================
// Style-only constants
// ============================
const BASE_FONT_SIZE = 25; // ✅ CHANGED: 15 → 25 (+10px)

// ============================
// Visual types (backend response)
// ============================
type VisualVariant =
  | {
      level: string;
      type: "staticDiagram";
      src: string;
      labels?: string[];
      caption?: string;
    }
  | {
      level: string;
      type: "stepAnimation";
      src: string;
      steps: Array<{
        title?: string;
        text?: string;
        caption?: string;
        image?: string; // optional (if you add later)
        svg?: string; // optional (inline svg string if you add later)
      }>;
    };

type VisualResponse = {
  conceptKey: string;
  subject: string;
  topic: string;
  level: string;
  visual: VisualVariant;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function makeAbsoluteAssetUrl(maybeRelativeUrl: string) {
  const s = safeStr(maybeRelativeUrl, "");
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // 1) Preferred: derive from axios api baseURL (e.g. http://localhost:5000/api)
  const apiBase = safeStr((api as any)?.defaults?.baseURL, "");
  const apiOrigin = apiBase
    ? apiBase.replace(/\/api\/?$/i, "").replace(/\/+$/i, "")
    : "";

  // 2) Fallback: current origin (works if frontend+backend are same host in prod)
  let origin = window.location.origin;

  // 3) Dev fallback: if frontend is on :3000 and visuals are served by backend on :5000
  // (prevents /visuals/... resolving to the frontend server)
  if (/:\d+$/.test(origin) && origin.endsWith(":3000")) {
    origin = origin.replace(":3000", ":5000");
  }

  const base = apiOrigin || origin;

  // Ensure exactly one slash between base and path
  return `${base}${s.startsWith("/") ? "" : "/"}${s}`;
}

const LessonViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Phase B: entitlement UI state
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // ✅ AI generation state
  const [isGenerating, setIsGenerating] = useState(false);

  // Unlock (1 ShamCoin) flow: error message when 400 "Not enough ShamCoins"
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // ✅ Only enable legacy reviews when lessonId is a Mongo ObjectId.
  const reviewsEnabled = isMongoObjectId(id);

  // ✅ Checkpoint UI state (per page)
  const [checkpointSelectionByPage, setCheckpointSelectionByPage] = useState<
    Record<string, string>
  >({});
  const [checkpointFeedback, setCheckpointFeedback] =
    useState<CheckpointFeedback>({
      open: false,
      correct: false,
      message: "",
    });

  // ============================
  // Visuals (concept diagrams / animations)
  // ============================
  const [visualData, setVisualData] = useState<VisualResponse | null>(null);

  // Page → visual step mapping (auto)
  const [visualStepIndex, setVisualStepIndex] = useState(0);
  // ✅ Student toggle: show/hide "Deeper knowledge" (stretch) blocks
  const [showDeeperKnowledge, setShowDeeperKnowledge] = useState(false);

  const [curriculumConfidence, setCurriculumConfidence] = useState<unknown>(null);

  const pageParam = useMemo(() => searchParams.get("page") || "", [searchParams]);

  const hasStructuredPages = useMemo(
    () =>
      Boolean(
        lesson?.pages && Array.isArray(lesson.pages) && lesson.pages.length > 0
      ),
    [lesson]
  );

  const orderedPages = useMemo(() => {
    if (!lesson?.pages || !Array.isArray(lesson.pages)) return [];
    return sortPages(lesson.pages);
  }, [lesson]);

  const currentPageIndex = useMemo(() => {
    if (!hasStructuredPages) return 0;
    if (!pageParam) return 0;

    const idxById = orderedPages.findIndex(
      (p) => String(p.pageId) === String(pageParam)
    );
    if (idxById >= 0) return idxById;

    const idxByOrder = orderedPages.findIndex(
      (p) => String(p.order) === String(pageParam)
    );
    if (idxByOrder >= 0) return idxByOrder;

    return 0;
  }, [hasStructuredPages, pageParam, orderedPages]);

  const currentPage = useMemo(() => {
    if (!hasStructuredPages) return null;
    return orderedPages[currentPageIndex] || null;
  }, [hasStructuredPages, orderedPages, currentPageIndex]);

  // ✅ SINGLE SOURCE OF TRUTH: Quiz questions
  const quizQuestions = useMemo(() => {
    if (!lesson) return [];
    // Use lesson.quiz?.questions if it exists and is an array
    if (lesson.quiz?.questions && Array.isArray(lesson.quiz.questions)) {
      return lesson.quiz.questions;
    }
    // Fallback to empty array
    return [];
  }, [lesson]);

  // ✅ SINGLE SOURCE OF TRUTH: Flashcards
  const flashcards = useMemo(() => {
    if (!lesson) return [];
    // Use lesson.flashcards if it exists and is an array
    if (lesson.flashcards && Array.isArray(lesson.flashcards)) {
      return lesson.flashcards;
    }
    // Fallback to empty array
    return [];
  }, [lesson]);

  useEffect(() => {
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchLessonSmart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api
      .get(`/curriculum-confidence/${id}`)
      .then((res) => setCurriculumConfidence(res.data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    console.log("Curriculum confidence:", curriculumConfidence);
  }, [curriculumConfidence]);

  // ✅ Visual fetch (optional, silent fail)
  useEffect(() => {
    const loadVisual = async () => {
      try {
        if (!lesson) return;

        // MVP mapping: conceptKey is the topic lowercased (works for "Photosynthesis")
        const conceptKey = safeStr(lesson.topic, "").toLowerCase().trim();
        if (!conceptKey) return;

        const level = safeStr(lesson.level, "").trim();
        if (!level) return;

        const res = await getVisual(conceptKey, level);
        const payload = (res as any)?.data || null;
        setVisualData(payload);

        // reset step index when a new visual loads
        setVisualStepIndex(0);
      } catch {
        setVisualData(null);
        setVisualStepIndex(0);
      }
    };

    loadVisual();
  }, [lesson]);

  // ✅ Page → Visual auto-map (best for learning)
  useEffect(() => {
    if (!visualData?.visual) return;

    if (visualData.visual.type === "stepAnimation") {
      const steps = Array.isArray((visualData.visual as any).steps)
        ? (visualData.visual as any).steps
        : [];
      if (steps.length === 0) return;

      // ✅ Only auto-map when the page actually has a matching step.
      // If page index is beyond available steps, disable the visual.
      if (currentPageIndex >= steps.length) {
        setVisualStepIndex(-1);
        // Guarded console.warn
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[LessonViewPage] No visual step mapped for this page index:",
            currentPageIndex
          );
        }
        return;
      }

      setVisualStepIndex(currentPageIndex);
    }
  }, [currentPageIndex, visualData]);

  // ✅ Gate: students can only view lessons that match their level (if user level is known)
  useEffect(() => {
    if (!lesson || !user) return;
    if (safeStr(user.userType, "").toLowerCase() !== "student") return;

    const userLevel = getUserLevel(user);
    if (!userLevel) return; // if we don't know, don't block

    const lessonLevel = normalizeLevelForCompare(lesson.level);
    if (!lessonLevel) return;

    if (userLevel !== lessonLevel) {
      setError("This lesson is not available for your level.");
      setLesson(null);
    }
  }, [lesson, user]);

  /**
   * SMART loader:
   * - Mongo ObjectId => fetch from backend (Mongo)
   * - UUID (legacy Supabase) => blocked (legacy slate is being cleared)
   */
  const fetchLessonSmart = async () => {
    try {
      setLoading(true);
      setError("");
      setLesson(null);
       // Reset entitlement flags before each load
      setSubscriptionRequired(false);
      setPreviewMode(false);

      if (!id) {
        setError("Lesson id missing");
        return;
      }

      if (isMongoObjectId(id)) {
        await fetchLessonFromBackend(id);
        return;
      }

      if (isUuid(id)) {
        // ✅ slate wipe: do not load legacy lessons anymore
        setError("This legacy lesson is no longer available.");
        return;
      }

      setError("Invalid lesson id format");
    } catch (err: any) {
      console.error("Error loading lesson:", err);
      setError(err?.message || "Failed to load lesson");
    } finally {
      setLoading(false);
    }
  };

  /**
   * ✅ Mongo backend lesson fetch (new system)
   * GET /api/lessons/:id
   */
  const fetchLessonFromBackend = async (lessonId: string) => {
    try {
      const res = await api.get(`/lessons/${lessonId}`);
      const data = (res as any)?.data || null;

      if (!data) {
        setError("Lesson not found");
        return;
      }

      // ✅ Only published lessons should be visible to students.
      const isStudent = safeStr(user?.userType, "").toLowerCase() === "student";
      if (isStudent && Boolean((data as any).isPublished) !== true) {
        setError("Lesson not found");
        return;
      }

      const rawNotes = safeStr(data.content, "");
      const description =
        safeStr(data.description, "") ||
        (rawNotes.trim()
          ? rawNotes.trim().slice(0, 220) +
            (rawNotes.trim().length > 220 ? "…" : "")
          : "—");

      const quizData = data.quiz || {};
      
      const mapped: Lesson = {
        id: safeStr(data._id || data.id || lessonId, lessonId),
        title: safeStr(data.title, "Untitled Lesson"),
        description,
        content: rawNotes.trim() ? rawNotes : "No lesson content yet.",
        subject: safeStr(data.subject, "Not set"),
        level: safeStr(data.level, "Not set"),
        topic: safeStr(data.topic, "Not set"),
        examBoardName: data.board ? safeStr(data.board, "") : null,
        teacherName: safeStr(data.teacherName, "Teacher"),
        teacherId: safeStr(data.teacherId, ""),
        estimatedDuration: Number.isFinite(Number(data.estimatedDuration))
          ? Number(data.estimatedDuration)
          : 0,
        shamCoinPrice: Number.isFinite(Number(data.shamCoinPrice))
          ? Number(data.shamCoinPrice)
          : 0,
        isPublished: Boolean(data.isPublished),
        views: Number.isFinite(Number(data.views)) ? Number(data.views) : 0,
        averageRating: Number.isFinite(Number(data.averageRating))
          ? Number(data.averageRating)
          : 0,
        totalRatings: Number.isFinite(Number(data.totalRatings))
          ? Number(data.totalRatings)
          : 0,
        createdAt: safeStr(data.createdAt, new Date().toISOString()),
        pages: Array.isArray(data.pages) ? data.pages : [],
        isFreePreview: Boolean(data.isFreePreview),
        // ✅ ADDED: Revision data with proper array validation
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
        // ✅ FIXED: Ensure quiz.questions is always an array
        quiz: {
          timeSeconds: quizData.timeSeconds || 600,
          questions: Array.isArray(quizData.questions) ? quizData.questions : []
        },
      };

      // Phase C3: Detect preview mode from backend flag
      // Preview mode when: pages.length === 1 AND lesson.isFreePreview === true
      const previewFromBackend =
        Array.isArray(mapped.pages) &&
        mapped.pages.length === 1 &&
        Boolean(mapped.isFreePreview);

      setPreviewMode(Boolean(previewFromBackend));

      setLesson(mapped);

      // If lesson has pages but no URL param, ensure URL points to page 1 (stable deep-link)
      if (mapped.pages && mapped.pages.length > 0) {
        const ordered = sortPages(mapped.pages);
        const first = ordered[0];
        const current = searchParams.get("page");
        if (!current && first?.pageId) {
          setSearchParams({ page: String(first.pageId) }, { replace: true });
        }
      }
    } catch (err: any) {
      console.error("Backend lesson fetch error:", err);
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.msg ||
        "";

      // Subscription paywall from backend
      if (status === 403 && msg === "Subscription required") {
        setSubscriptionRequired(true);
        setError("");
        setLesson(null);
        return;
      }

      setError(err?.message || "Failed to load lesson");
    }
  };

  // NOTE: legacy supabase fetch kept (unused) only to avoid breaking imports/refs if you reuse later.
  // We do NOT call it anymore as part of the "wipe legacy slate clean" plan.
  const fetchLessonFromSupabase = async (lessonId: string) => {
    try {
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
            exam_board:exam_boards(name)
          `
        )
        .eq("id", lessonId)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        setError(error.message || "Failed to load lesson");
        return;
      }

      const examBoardName = getBoardName((data as any)?.exam_board);

      const rawNotes = safeStr((data as any)?.lesson_notes, "");
      const resolvedContent = rawNotes.trim() || "No lesson content yet.";
      const resolvedDescription = rawNotes.trim()
        ? rawNotes.trim().slice(0, 220) +
          (rawNotes.trim().length > 220 ? "…" : "")
        : "—";

      const mapped: Lesson = {
        id: safeStr((data as any)?.id, ""),
        title: safeStr((data as any)?.title, "Untitled Lesson"),
        subject: safeStr((data as any)?.subject, "Not set"),
        level: safeStr((data as any)?.level, "Not set"),
        topic: "Not set",
        examBoardName: examBoardName ?? null,
        description: resolvedDescription,
        content: resolvedContent,
        teacherName: "Teacher",
        teacherId: safeStr((data as any)?.teacher_id, ""),
        estimatedDuration: 0,
        shamCoinPrice: 0,
        isPublished: Boolean((data as any)?.is_published),
        views: 0,
        averageRating: 0,
        totalRatings: 0,
        createdAt: safeStr((data as any)?.created_at, new Date().toISOString()),
        pages: [],
      };

      setLesson(mapped);
    } catch (err: any) {
      console.error("Error fetching lesson from Supabase:", err);
      setError("Failed to load lesson");
    }
  };

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

  const hasPurchasedLesson = () => {
    if (!user || !lesson) return false;
    if (user.userType !== "student") return false;

    return user.purchasedLessons?.some(
      (purchase) => String(purchase.lessonId) === String(lesson.id)
    );
  };

  const handleReviewSubmitted = () => {
    setReviewSubmitted(true);
    setShowReviewForm(false);
    fetchLessonSmart();
  };

  // ✅ ADDED: AI generation handler for LessonViewPage
  const handleAIGenerate = async () => {
    if (!lesson || !lesson.id) return;
    
    setIsGenerating(true);
    try {
      await api.post(`/lessons/${lesson.id}/generate-revision`, {});
      await fetchLessonSmart(); // Refresh the lesson data
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Error generating revision content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePurchase = async () => {
    if (!user || !lesson) return;

    // ✅ Legacy UUID lessons are not purchasable/viewable anymore
    if (isUuid(lesson.id)) {
      navigate("/subscription");
      return;
    }

    // Legacy Mongo purchase route (kept)
    if (user.userType !== "student") {
      alert("Only students can purchase lessons");
      return;
    }

    if (hasPurchasedLesson()) {
      alert("You have already purchased this lesson!");
      return;
    }

    if (user.shamCoins < lesson.shamCoinPrice) {
      alert(
        `You need ${lesson.shamCoinPrice} ShamCoins to purchase this lesson. You have ${user.shamCoins} ShamCoins.`
      );
      return;
    }

    if (
      !window.confirm(
        `Purchase "${lesson.title}" for ${lesson.shamCoinPrice} ShamCoins?`
      )
    )
      return;

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `http://localhost:5000/api/lessons/${lesson.id}/purchase`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if ((response.data as any).success === false)
        throw new Error((response.data as any).error || "Purchase failed");

      const updatedUser = (response.data as any).user || {
        ...user,
        shamCoins: (response.data as any).remainingShamCoins,
        purchasedLessons:
          (response.data as any).purchasedLessons || user.purchasedLessons,
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);

      alert(
        `✅ Purchase successful! You now have ${updatedUser.shamCoins} ShamCoins remaining.`
      );
      fetchLessonSmart();
    } catch (error: any) {
      console.error("Purchase failed:", error);
      if (error.response?.data?.msg) alert(`❌ ${error.response.data.msg}`);
      else if (error.response?.data?.error)
        alert(`❌ ${error.response.data.error}`);
      else if (error.message) alert(`❌ ${error.message}`);
      else alert("❌ Purchase failed. Please try again.");
    }
  };

  const handleUnlock = async () => {
    if (!lesson?.id || unlocking) return;
    setUnlockError(null);
    setUnlocking(true);
    try {
      const res = await api.post(`/lessons/${lesson.id}/unlock`);
      const data = (res as any)?.data;
      if (data?.shamCoins !== undefined && data?.purchasedLessons) {
        const updatedUser = { ...user, shamCoins: data.shamCoins, purchasedLessons: data.purchasedLessons };
        setUser(updatedUser);
        try {
          localStorage.setItem("user", JSON.stringify(updatedUser));
        } catch (_) {}
      }
      setUnlockError(null);
      await fetchLessonSmart();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.msg || "";
      if (status === 400 && msg === "Not enough ShamCoins") {
        setUnlockError("Not enough ShamCoins");
      } else {
        setUnlockError(err?.message || "Unlock failed. Please try again.");
      }
    } finally {
      setUnlocking(false);
    }
  };

  // ============================
  // Structured pages UI helpers
  // ============================

  const goToPage = (p: LessonPage) => {
    if (!p?.pageId) return;
    setSearchParams({ page: String(p.pageId) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevPage =
    currentPageIndex > 0 ? orderedPages[currentPageIndex - 1] : null;
  const nextPage =
    currentPageIndex < orderedPages.length - 1
      ? orderedPages[currentPageIndex + 1]
      : null;

  // ✅ Ensure ALL revision text is left-aligned (but we do NOT change radio layout below)
  const markdownComponents = useMemo(() => {
    const leftBlock: React.CSSProperties = { textAlign: "left" };

    const headingBase: React.CSSProperties = {
      ...leftBlock,
      color: "#111827",
      fontWeight: 900,
      lineHeight: 1.2,
      marginTop: 12,
      marginBottom: 8,
    };

    return {
      h1: ({ children, ...props }: any) => (
        <h1
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "2.4rem",
            marginTop: 10,
          }}
        >
          {children}
        </h1>
      ),
      h2: ({ children, ...props }: any) => (
        <h2
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "2.0rem",
          }}
        >
          {children}
        </h2>
      ),
      h3: ({ children, ...props }: any) => (
        <h3
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "1.65rem",
          }}
        >
          {children}
        </h3>
      ),
      h4: ({ children, ...props }: any) => (
        <h4
          {...props}
          style={{
            ...(props.style || {}),
            ...headingBase,
            fontSize: "1.35rem",
          }}
        >
          {children}
        </h4>
      ),
      ul: ({ ...props }: any) => (
        <ul
          style={{ 
            paddingLeft: 22, 
            margin: "8px 0", 
            listStyleType: "disc",
            textAlign: "left",
            lineHeight: 1.8,
          }} 
          {...props} 
        />
      ),
      ol: ({ ...props }: any) => (
        <ol
          style={{ 
            paddingLeft: 22, 
            margin: "8px 0", 
            listStyleType: "decimal",
            textAlign: "left",
            lineHeight: 1.8,
          }} 
          {...props} 
        />
      ),
      li: ({ ...props }: any) => (
        <li
          style={{ 
            margin: "4px 0",
            textAlign: "left",
          }} 
          {...props} 
        />
      ),
      blockquote: ({ ...props }: any) => (
        <blockquote
          {...props}
          style={{
            ...(props.style || {}),
            ...leftBlock,
            borderLeft: "4px solid rgba(59,130,246,0.35)",
            paddingLeft: 12,
            marginLeft: 0,
            color: "rgba(0,0,0,0.75)",
          }}
        />
      ),
      img: ({ node, ...props }: any) => {
        const rawSrc = safeStr(props.src, "");
        const srcAbs = rawSrc ? makeAbsoluteAssetUrl(rawSrc) : "";
        const caption = props.title || "";

        return (
          <figure style={{ margin: "12px auto", textAlign: "center" }}>
            <img
              {...props}
              src={srcAbs || rawSrc}
              style={{
                maxWidth: "100%",
                height: "auto",
                borderRadius: 10,
                display: "block",
                margin: "0 auto",
                background: "white",
                border: "1px solid rgba(0,0,0,0.08)",
              }}
              alt={props.alt || "Lesson image"}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {caption && (
              <figcaption
                style={{
                  marginTop: 6,
                  fontSize: "0.9rem",
                  color: "#6b7280",
                }}
              >
                {caption}
              </figcaption>
            )}
          </figure>
        );
      },
      p: ({ node, children, ...props }: any) => {
        const hasImageChild = node?.children?.some(
          (child: any) => child.tagName === "img"
        );
        
        if (hasImageChild) {
          return <>{children}</>;
        }
        
        return <p style={{ textAlign: "left" }} {...props}>{children}</p>;
      },
      a: ({ ...props }: any) => (
        <a {...props} target="_blank" rel="noopener noreferrer">
          {props.children}
        </a>
      ),
    };
  }, []);

  const renderCallout = (
    kind: LessonPageBlock["type"],
    text: string,
    idx: number
  ) => {
    const base: React.CSSProperties = {
      padding: "14px",
      borderRadius: "12px",
      margin: "14px 0",
      lineHeight: 1.8,
      background: "white",
      textAlign: "left",
      fontSize: BASE_FONT_SIZE,
    };

    if (kind === "keyIdea") {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "#f0fff4",
            border: "2px solid rgba(34,197,94,0.40)",
            boxShadow: "0 0 0 2px rgba(34,197,94,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#065f46" }}>
            🔑 Key idea
          </div>
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
        </div>
      );
    }
    if (kind === "examTip") {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "#eef2ff",
            border: "2px solid rgba(99,102,241,0.40)",
            boxShadow: "0 0 0 2px rgba(99,102,241,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#3730a3" }}>
            🧠 Exam insight
          </div>
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
        </div>
      );
    }
    if (kind === "commonMistake") {
      return (
        <div
          key={idx}
          style={{
            ...base,
            background: "#fff7ed",
            border: "2px solid rgba(249,115,22,0.45)",
            boxShadow: "0 0 0 2px rgba(249,115,22,0.10)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#9a3412" }}>
            ⚠️ Common mistake
          </div>
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
        </div>
      );
    }
    if (kind === "stretch") {
      return (
        <div
          key={idx}
          style={{
            padding: 14,
            borderRadius: 14,
            marginBottom: 12,
            border: "2px solid rgba(124,58,237,0.35)",
            background: "rgba(124,58,237,0.08)",
            lineHeight: 1.8,
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, color: "#5b21b6" }}>
            🔍 Deeper knowledge (stretch)
          </div>
          <ReactMarkdown components={markdownComponents as any}>
            {text}
          </ReactMarkdown>
        </div>
      );
    }

    // ✅ TEXT BLOCK:
    // - Markdown supports images inline: ![caption](url)
    // - Text is forced left-aligned (images can still be centered)
    return (
      <div
        key={idx}
        style={{
          ...base,
          padding: "12px 14px",
          background: "#fbfbfc",
          border: "2px solid rgba(0,0,0,0.10)",
          boxShadow: "0 0 0 2px rgba(0,0,0,0.03)",
        }}
      >
        <ReactMarkdown components={markdownComponents as any}>
          {text}
        </ReactMarkdown>
      </div>
    );
  };

  const renderHero = (hero?: LessonPageHero) => {
    const h = hero || { type: "none", src: "", caption: "" };
    const src = normalizeHeroSrc(h);

    // ✅ If there is no valid src, do NOT render the hero at all (prevents broken image icon)
    if (!h || h.type === "none" || !src) return null;

    const boxStyle: React.CSSProperties = {
      background: "#f8f9fa",
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      border: "2px solid rgba(59,130,246,0.25)",
      boxShadow: "0 0 0 2px rgba(59,130,246,0.10)",
      textAlign: "left",
    };

    const captionStyle: React.CSSProperties = {
      marginTop: 10,
      color: "#6b7280",
      fontSize: "0.95rem",
      textAlign: "center",
    };

    if (h.type === "video" || h.type === "animation") {
      return (
        <div style={boxStyle}>
          <video
            controls
            style={{ width: "100%", borderRadius: 12, background: "#000" }}
            src={src}
          />
          {h.caption ? <div style={captionStyle}>{h.caption}</div> : null}
        </div>
      );
    }

    if (h.type === "image") {
      return (
        <div style={boxStyle}>
          <img
            src={src}
            alt={h.caption || "Lesson visual"}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 12,
              display: "block",
            }}
            onError={(e) => {
              // hide broken image if URL is invalid
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          {h.caption ? <div style={captionStyle}>{h.caption}</div> : null}
        </div>
      );
    }

    return null;
  };

  const renderVisualBox = () => {
    if (!visualData?.visual) return null;

    const wrapper: React.CSSProperties = {
      margin: "14px 0",
      padding: 14,
      borderRadius: 14,
      border: "2px solid rgba(0,0,0,0.10)",
      background: "#ffffff",
      textAlign: "left",
    };

    const headerRow: React.CSSProperties = {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10,
    };

    const badge: React.CSSProperties = {
      fontWeight: 950 as any,
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
    };

    // -------- static diagram --------
    if (visualData.visual.type === "staticDiagram") {
      const srcAbs = makeAbsoluteAssetUrl((visualData.visual as any).src);
      if (!srcAbs) return null;

      return (
        <div style={wrapper}>
          <div style={headerRow}>
            <div style={badge}>📌 Visual</div>
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              (Auto-maps to the current page)
            </div>
          </div>

          <img
            src={srcAbs}
            alt={`${lesson?.topic || "Lesson"} diagram`}
            style={{ width: "100%", height: "auto", borderRadius: 12 }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />

          {Array.isArray((visualData.visual as any).labels) &&
          (visualData.visual as any).labels.length > 0 ? (
            <div style={{ marginTop: 10, color: "#6b7280", fontSize: "0.95rem" }}>
              Labels: {(visualData.visual as any).labels.join(", ")}
            </div>
          ) : null}
        </div>
      );
    }

        // -------- step animation (page → step) --------
    if (visualData.visual.type === "stepAnimation") {
      const steps = Array.isArray((visualData.visual as any).steps)
        ? ((visualData.visual as any).steps as any[])
        : [];

      // 1) guards
      if (steps.length === 0) return null;
      if (visualStepIndex < 0) return null;

      const step = steps[visualStepIndex];
      if (!step) return null;

      // 2) compute once
      const title = safeStr(step.title, `Step ${visualStepIndex + 1}`);
      const text =
        safeStr(step.text, "") || safeStr((step as any).description, "");
      const caption = safeStr(step.caption, "");

      // 3) navigation state
      const canPrev = visualStepIndex > 0;
      const canNext = visualStepIndex < steps.length - 1;

      const hasSvgInline =
        typeof step.svg === "string" && step.svg.trim().startsWith("<svg");

      // 4) derived image path MUST use visualStepIndex + 1 (not idx)
      const derived = `/visuals/${visualData.conceptKey}/step-${
        visualStepIndex + 1
      }.png`;
      const src = makeAbsoluteAssetUrl(step.image || derived);

      return (
        <div style={wrapper}>
          <div style={headerRow}>
            <div style={badge}>📌 Visual</div>
            <div style={{ color: "#6b7280", fontSize: "0.9rem" }}>
              Step {visualStepIndex + 1} of {steps.length}
            </div>
          </div>

          <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>
            {title}
          </div>

          <img
            src={src}
            alt={title}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: 12,
              marginBottom: 10,
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />

          {hasSvgInline ? (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                padding: 10,
                marginBottom: 10,
                overflow: "auto",
              }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: step.svg }}
            />
          ) : null}

          {text ? (
            <div style={{ color: "#111827", lineHeight: 1.8, marginBottom: 10 }}>
              {text}
            </div>
          ) : null}

          {caption ? (
            <div
              style={{
                color: "#6b7280",
                fontSize: "0.95rem",
                marginBottom: 10,
              }}
            >
              {caption}
            </div>
          ) : (
            <div
              style={{
                color: "#6b7280",
                fontSize: "0.95rem",
                marginBottom: 10,
              }}
            >
              (This visual auto-maps to the current page.)
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              disabled={!canPrev}
              onClick={() =>
                setVisualStepIndex((p) => clamp(p - 1, 0, steps.length - 1))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "2px solid rgba(0,0,0,0.18)",
                background: canPrev ? "white" : "#f3f4f6",
                cursor: canPrev ? "pointer" : "not-allowed",
                fontWeight: 850,
              }}
            >
              ← Prev step
            </button>

            <button
              disabled={!canNext}
              onClick={() =>
                setVisualStepIndex((p) => clamp(p + 1, 0, steps.length - 1))
              }
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "none",
                background: canNext ? "#48bb78" : "#9ca3af",
                cursor: canNext ? "pointer" : "not-allowed",
                color: "white",
                fontWeight: 950 as any,
              }}
            >
              Next step →
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ============================
  // Render states
  // ============================

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lesson...</h2>
      </div>
    );
  }

  if (subscriptionRequired) {
    return (
      <div style={{ padding: "40px 16px", maxWidth: 900, margin: "0 auto" }}>
        <SubscriptionRequired />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>{error || "Lesson not found"}</h2>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ============================
  // ✅ Check if user is teacher or admin
  // ============================
  const isTeacherOrAdmin =
    user?.userType === "admin" ||
    user?.userType === "teacher" ||
    (user as any)?.isAdmin === true;

  // ============================
  // ✅ New Student View (Pages)
  // ============================
  if (hasStructuredPages && currentPage) {
    const progressCount = Math.min(currentPageIndex + 1, orderedPages.length);
    const progressPct =
      orderedPages.length > 0
        ? Math.round((progressCount / orderedPages.length) * 100)
        : 0;

    const currentSelection =
      checkpointSelectionByPage[currentPage.pageId] || "";
    const correctAnswer = safeStr(currentPage.checkpoint?.answer, "");

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%)",
          padding: "18px",
          fontSize: BASE_FONT_SIZE,
        }}
      >
        <div style={{ maxWidth: 1750, margin: "0 auto" }}>
          {/* ✅ PROOF PANEL REMOVED FROM HERE */}

          <div style={{ marginBottom: 12 }}>
            <Link
              to="/dashboard"
              style={{ color: "#667eea", textDecoration: "none" }}
            >
              ← Back to Dashboard
            </Link>
          </div>

          {previewMode && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 10,
                backgroundColor: "#fff7ed",
                border: "1px solid rgba(249,115,22,0.35)",
                color: "#9a3412",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: "0.95rem", fontWeight: 500 }}>
                Preview mode: subscribe to unlock the full lesson
              </div>
              <button
                onClick={() => navigate("/subscription")}
                style={{
                  padding: "0.4rem 0.9rem",
                  backgroundColor: "#f97316",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                View plans
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "260px minmax(0, 1fr) 280px",
              gap: 18,
              alignItems: "start",
            }}
          >
            {/* LEFT SIDEBAR */}
            <aside
              style={{
                position: "sticky",
                top: 16,
                alignSelf: "start",
                background: "white",
                borderRadius: 14,
                padding: 14,
                boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                border: "2px solid rgba(59,130,246,0.35)",
                textAlign: "left",
              }}
            >
              <div
                style={{ fontWeight: "bold", color: "#111827", marginBottom: 6 }}
              >
                {lesson.subject || "Subject"}
              </div>
              <div
                style={{
                  color: "#6b7280",
                  fontSize: "0.95rem",
                  marginBottom: 10,
                }}
              >
                {lesson.level || "Level"}
                {lesson.examBoardName ? ` · ${lesson.examBoardName}` : ""}
              </div>

              <div
                style={{ fontWeight: "bold", marginBottom: 8, color: "#111827" }}
              >
                {lesson.topic || "Topic"}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {orderedPages.map((p, idx) => {
                  const isCurrent = idx === currentPageIndex;
                  const isCompleted = idx < currentPageIndex;
                  const icon = isCurrent ? "→" : isCompleted ? "✔" : "○";

                  return (
                    <button
                      key={p.pageId || idx}
                      onClick={() => goToPage(p)}
                      style={{
                        textAlign: "left",
                        padding: "10px 10px",
                        borderRadius: 10,
                        border: "2px solid rgba(59,130,246,0.25)",
                        background: isCurrent ? "#eef2ff" : "white",
                        cursor: "pointer",
                        color: "#111827",
                        fontWeight: isCurrent ? 800 : 600,
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ width: 18, textAlign: "center" }}>
                        {icon}
                      </span>
                      <span style={{ flex: 1 }}>
                        {p.title || `Page ${p.order}`}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontWeight: "bold",
                    marginBottom: 6,
                    color: "#111827",
                  }}
                >
                  Progress
                </div>
                <div
                  style={{
                    height: 10,
                    background: "#e5e7eb",
                    borderRadius: 999,
                    overflow: "hidden",
                    border: "2px solid rgba(59,130,246,0.20)",
                  }}
                >
                  <div
                    style={{
                      width: `${progressPct}%`,
                      height: "100%",
                      background: "#48bb78",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: "#6b7280",
                    fontSize: "0.95rem",
                  }}
                >
                  {progressCount} of {orderedPages.length} pages
                </div>
              </div>
            </aside>

            {/* MAIN CONTENT CARD */}
            <main>
              <div
                style={{
                  background: "white",
                  borderRadius: 16,
                  padding: "28px",
                  maxWidth: 1100,
                  margin: "0 auto",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.08)",
                  border: "3px solid rgba(59,130,246,0.45)",
                  textAlign: "left",
                  fontSize: BASE_FONT_SIZE,
                  lineHeight: 1.8,
                }}
              >
                {/* ✅ Header fix: Lesson title is the main title; page title is secondary */}
                <div style={{ marginBottom: 14, textAlign: "left" }}>
                  <h1
                    style={{
                      margin: 0,
                      color: "#111827",
                      textAlign: "left",
                      fontSize: "2.4rem",
                      fontWeight: 950 as any,
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {lesson.title}
                  </h1>
                  <div
                    style={{
                      color: "#6b7280",
                      marginTop: 8,
                      fontSize: "1rem",
                      textAlign: "left",
                    }}
                  >
                    {lesson.topic} · {lesson.level}
                    {lesson.examBoardName ? ` · ${lesson.examBoardName}` : ""}
                  </div>

                  <h2
                    style={{
                      margin: "16px 0 0",
                      color: "#111827",
                      textAlign: "left",
                      fontSize: "2.0rem",
                      fontWeight: 900,
                      lineHeight: 1.2,
                    }}
                  >
                    {currentPage.title || `Page ${currentPageIndex + 1}`}
                  </h2>
                </div>

                {renderHero(currentPage.hero)}

                {/* ✅ Visual (changes per page) */}
                {renderVisualBox()}

                {/* Deeper knowledge toggle */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowDeeperKnowledge((v) => !v)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "2px solid rgba(124,58,237,0.25)",
                      background: showDeeperKnowledge ? "rgba(124,58,237,0.10)" : "white",
                      cursor: "pointer",
                      fontWeight: 900,
                      color: "#5b21b6",
                    }}
                  >
                    {showDeeperKnowledge ? "Hide deeper knowledge" : "Show deeper knowledge"}
                  </button>
                </div>

                {/* Blocks */}
                <div>
                  {(currentPage.blocks || [])
                    .filter((b) => (b.type === "stretch" ? showDeeperKnowledge : true))
                    .map((b, idx) => renderCallout(b.type, safeStr(b.content, ""), idx))}
                </div>

                {/* Checkpoint - UPDATED WITH LARGER FONTS */}
                {currentPage.checkpoint?.question &&
                  Array.isArray(currentPage.checkpoint?.options) &&
                  (currentPage.checkpoint?.options?.length || 0) > 0 && (
                    <div
                      style={{
                        marginTop: 18,
                        padding: 16,
                        borderRadius: 14,
                        background: "#f8f9fa",
                        border: "3px solid rgba(59,130,246,0.25)",
                        boxShadow: "0 0 0 2px rgba(59,130,246,0.08)",
                        textAlign: "left",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 900,
                          marginBottom: 10,
                          color: "#111827",
                          textAlign: "left",
                          fontSize: "1.2rem",
                        }}
                      >
                        ✅ Check your understanding
                      </div>
                      <div
                        style={{
                          marginBottom: 10,
                          color: "#111827",
                          fontWeight: 700,
                          textAlign: "left",
                          fontSize: BASE_FONT_SIZE,
                          lineHeight: 1.8,
                        }}
                      >
                        {currentPage.checkpoint.question}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        {currentPage.checkpoint.options!.map((opt, idx) => {
                          const optText = safeStr(opt, "");
                          const selected =
                            optText.trim() === currentSelection.trim();

                          const hasAnswer = Boolean(correctAnswer.trim());
                          const isCorrect = hasAnswer
                            ? optText.trim() === correctAnswer.trim()
                            : false;

                          const selectedIsCorrect = selected && isCorrect;
                          const selectedIsWrong =
                            selected && hasAnswer && !isCorrect;

                          const borderColor = selectedIsCorrect
                            ? "rgba(16,185,129,0.70)"
                            : selectedIsWrong
                            ? "rgba(239,68,68,0.55)"
                            : "rgba(0,0,0,0.14)";

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setCheckpointSelectionByPage((prev) => ({
                                  ...prev,
                                  [currentPage.pageId]: optText,
                                }));

                                if (!hasAnswer) {
                                  setCheckpointFeedback({
                                    open: true,
                                    correct: true,
                                    message: "✅ Answer saved!",
                                  });
                                  return;
                                }

                                setCheckpointFeedback({
                                  open: true,
                                  correct: isCorrect,
                                  message: isCorrect
                                    ? "✅ Correct!"
                                    : "❌ Not quite — try again.",
                                });
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "12px 12px",
                                borderRadius: 12,
                                border: `2px solid ${borderColor}`,
                                background: "white",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                fontWeight: 650,
                                fontSize: BASE_FONT_SIZE,
                                lineHeight: 1.8,
                                boxShadow: selectedIsCorrect
                                  ? "0 0 0 2px rgba(16,185,129,0.12)"
                                  : selectedIsWrong
                                  ? "0 0 0 2px rgba(239,68,68,0.10)"
                                  : "none",
                              }}
                            >
                              <span style={{ flex: 1 }}>{opt}</span>

                              <span
                                style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 999,
                                  border: `2px solid ${
                                    selectedIsCorrect
                                      ? "rgba(16,185,129,0.90)"
                                      : selectedIsWrong
                                      ? "rgba(239,68,68,0.70)"
                                      : "rgba(0,0,0,0.35)"
                                  }`,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  background: selectedIsCorrect
                                    ? "rgba(16,185,129,0.90)"
                                    : "white",
                                }}
                              >
                                {selected && !selectedIsCorrect ? (
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 999,
                                      background: selectedIsWrong
                                        ? "rgba(239,68,68,0.80)"
                                        : "rgba(0,0,0,0.35)",
                                      display: "inline-block",
                                    }}
                                  />
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Prev / Next */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 22,
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    disabled={!prevPage}
                    onClick={() => prevPage && goToPage(prevPage)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "2px solid rgba(0,0,0,0.20)",
                      background: prevPage ? "white" : "#f3f4f6",
                      cursor: prevPage ? "pointer" : "not-allowed",
                      color: "#111827",
                      fontWeight: 800,
                    }}
                  >
                    ← Previous
                  </button>

                  <button
                    disabled={!nextPage}
                    onClick={() => nextPage && goToPage(nextPage)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: nextPage ? "#48bb78" : "#9ca3af",
                      cursor: nextPage ? "pointer" : "not-allowed",
                      color: "white",
                      fontWeight: 900,
                    }}
                  >
                    Next →
                  </button>
                </div>

                {/* Phase C3: Preview mode CTA block */}
                {previewMode && (
                  <div
                    style={{
                      marginTop: "32px",
                      padding: "24px",
                      borderRadius: "14px",
                      backgroundColor: "#fff7ed",
                      border: "2px solid rgba(249,115,22,0.40)",
                      boxShadow: "0 4px 12px rgba(249,115,22,0.15)",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 12px 0",
                        fontSize: "1.5rem",
                        fontWeight: 800,
                        color: "#9a3412",
                      }}
                    >
                      Unlock the full lesson
                    </h3>
                    <p
                      style={{
                        margin: "0 0 20px 0",
                        fontSize: "1rem",
                        color: "#7c2d12",
                        lineHeight: 1.6,
                      }}
                    >
                      You're viewing a preview. Unlock the complete lesson to access all pages, flashcards, and quiz questions.
                    </p>
                    {unlockError && (
                      <div
                        style={{
                          marginBottom: "12px",
                          padding: "12px",
                          borderRadius: "10px",
                          backgroundColor: unlockError === "Not enough ShamCoins" ? "#fef2f2" : "#f8fafc",
                          border: unlockError === "Not enough ShamCoins" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                          color: unlockError === "Not enough ShamCoins" ? "#991b1b" : "#475569",
                        }}
                      >
                        {unlockError === "Not enough ShamCoins" ? (
                          <>
                            <p style={{ margin: "0 0 10px 0", fontWeight: 600 }}>Not enough ShamCoins to unlock this lesson.</p>
                            <Link to="/subscription">
                              <button
                                type="button"
                                style={{
                                  padding: "8px 16px",
                                  borderRadius: "8px",
                                  border: "none",
                                  backgroundColor: "#4f46e5",
                                  color: "white",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Subscribe to get ShamCoins
                              </button>
                            </Link>
                          </>
                        ) : (
                          <p style={{ margin: 0 }}>{unlockError}</p>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={handleUnlock}
                        disabled={unlocking}
                        style={{
                          padding: "12px 24px",
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: unlocking ? "#94a3b8" : "#f97316",
                          color: "white",
                          fontSize: "1rem",
                          fontWeight: 700,
                          cursor: unlocking ? "not-allowed" : "pointer",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!unlocking) e.currentTarget.style.backgroundColor = "#ea580c";
                        }}
                        onMouseLeave={(e) => {
                          if (!unlocking) e.currentTarget.style.backgroundColor = "#f97316";
                        }}
                      >
                        {unlocking ? "Unlocking…" : "Unlock full lesson (1 ShamCoin)"}
                      </button>
                      <Link
                        to="/subscription"
                        style={{
                          padding: "12px 24px",
                          borderRadius: "10px",
                          border: "2px solid rgba(249,115,22,0.50)",
                          backgroundColor: "transparent",
                          color: "#9a3412",
                          fontSize: "1rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-block",
                          transition: "background-color 0.2s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.10)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        Subscribe to unlock all lessons
                      </Link>
                    </div>
                  </div>
                )}

                {/* ✅ REVISION SECTION - ADDED */}
                <div
                  style={{
                    marginTop: "40px",
                    paddingTop: "30px",
                    borderTop: "1px solid #e2e8f0",
                    textAlign: "left",
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "20px" 
                  }}>
                    <h2 style={{ color: "#333", fontSize: "1.65rem", margin: 0 }}>
                      Revision
                    </h2>
                    
                    {/* ✅ UPDATED: AI generation button - only show for teachers/admins */}
                    {isTeacherOrAdmin ? (
                      <button
                        onClick={handleAIGenerate}
                        disabled={isGenerating}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "10px",
                          border: "2px solid #10b981",
                          background: isGenerating ? "#e5e7eb" : "#10b981",
                          color: "white",
                          cursor: isGenerating ? "not-allowed" : "pointer",
                          fontWeight: "bold",
                          fontSize: "14px"
                        }}
                      >
                        {isGenerating ? "Generating..." : "Generate revision with AI"}
                      </button>
                    ) : null}
                  </div>

                  <div style={{ display: "grid", gap: "16px" }}>
                    {/* ✅ RESTORED: Flashcard component using single source of truth */}
                    <FlashcardsView
                      title="Flashcards"
                      cards={flashcards.map((flashcard: any, i: number) => ({
                        id: flashcard.id ?? flashcard._id ?? String(i),
                        front: flashcard.front ?? flashcard.question ?? "",
                        back: flashcard.back ?? flashcard.answer ?? "",
                        difficulty: (flashcard.difficulty && [1, 2, 3].includes(flashcard.difficulty))
                          ? (flashcard.difficulty as 1 | 2 | 3)
                          : 1,
                        tags: Array.isArray(flashcard.tags) ? flashcard.tags : [],
                      }))}
                    />

                    {/* ✅ FIXED: Quiz component using single source of truth */}
                    <QuizView
                      title="Quiz"
                      questions={
                        quizQuestions.map((q: any, i: number) => {
                          const base = {
                            id: q.id ?? `q_${String(i + 1).padStart(3, "0")}`,
                            question: q.question ?? "",
                            explanation: q.explanation,
                            tags: q.tags,
                            difficulty: q.difficulty,
                            marks: q.marks
                          };

                          if (q.type === "mcq") {
                            return {
                              ...base,
                              type: "mcq" as const,
                              options: Array.isArray(q.options) ? q.options : [],
                              correctAnswer: q.correctAnswer ?? ""
                            };
                          }

                          if (q.type === "exam") {
                            return {
                              ...base,
                              type: "exam" as const,
                              markScheme: Array.isArray(q.markScheme) ? q.markScheme : [],
                              correctAnswer: q.correctAnswer ?? "See mark scheme."
                            };
                          }

                          return {
                            ...base,
                            type: "short" as const,
                            correctAnswer: q.correctAnswer ?? ""
                          };
                        })
                      }
                    />
                  </div>
                </div>

                {/* Reviews block */}
                <div
                  style={{
                    marginTop: "40px",
                    paddingTop: "30px",
                    borderTop: "1px solid #e2e8f0",
                    textAlign: "left",
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
                    <h2 style={{ color: "#333", fontSize: "1.65rem" }}>
                      Student Reviews
                    </h2>

                    {reviewsEnabled ? (
                      <button
                        onClick={() => setShowReviewForm(true)}
                        style={{
                          padding: "10px 20px",
                          background: "#48bb78",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: "bold",
                        }}
                      >
                        ✏️ TEST: Write a Review
                      </button>
                    ) : null}
                  </div>

                  {!reviewsEnabled && (
                    <div
                      style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "#f7f7ff",
                        color: "rgba(0,0,0,0.75)",
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      Reviews are coming soon for these lessons.
                    </div>
                  )}

                  {reviewsEnabled && showReviewForm && (
                    <div style={{ marginBottom: "30px" }}>
                      <ReviewForm
                        lessonId={lesson.id}
                        onReviewSubmitted={handleReviewSubmitted}
                      />
                      <div style={{ textAlign: "right", marginTop: "10px" }}>
                        <button
                          onClick={() => setShowReviewForm(false)}
                          style={{
                            padding: "8px 16px",
                            background: "#e2e8f0",
                            color: "#4a5568",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {reviewsEnabled && reviewSubmitted && (
                    <div
                      style={{
                        backgroundColor: "#d4edda",
                        color: "#155724",
                        padding: "1rem",
                        borderRadius: "0.375rem",
                        marginBottom: "1.5rem",
                        border: "1px solid #c3e6cb",
                      }}
                    >
                      ✅ Thank you for your review!
                    </div>
                  )}

                  {reviewsEnabled ? <ReviewList lessonId={lesson.id} /> : null}
                </div>
              </div>
            </main>

            {/* RIGHT RAIL */}
            <aside
              style={{
                position: "sticky",
                top: 16,
                alignSelf: "start",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  border: "2px solid rgba(59,130,246,0.25)",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: "bold", marginBottom: 6 }}>
                  Topic progress
                </div>
                <div style={{ color: "#6b7280" }}>
                  Page {currentPageIndex + 1} of {orderedPages.length}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* ✅ Non-blocking feedback modal */}
        {checkpointFeedback.open && (
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.30)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              zIndex: 9999,
              fontSize: BASE_FONT_SIZE,
            }}
            onClick={() =>
              setCheckpointFeedback((p) => ({ ...p, open: false }))
            }
          >
            <div
              style={{
                width: "min(520px, 95vw)",
                background: "white",
                borderRadius: 14,
                padding: 16,
                border: `3px solid ${
                  checkpointFeedback.correct
                    ? "rgba(16,185,129,0.55)"
                    : "rgba(239,68,68,0.45)"
                }`,
                boxShadow: "0 18px 46px rgba(0,0,0,0.18)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontWeight: 950 as any,
                  fontSize: "1.1rem",
                  marginBottom: 10,
                }}
              >
                {checkpointFeedback.message}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() =>
                    setCheckpointFeedback((p) => ({ ...p, open: false }))
                  }
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "2px solid rgba(0,0,0,0.16)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================
  // Legacy view (no pages)
  // ============================
  return (
    <div
      style={{
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "20px",
        fontSize: BASE_FONT_SIZE,
      }}
    >
      {/* ✅ PROOF PANEL REMOVED FROM LEGACY VIEW TOO */}

      <Link to="/dashboard" style={{ color: "#667eea", textDecoration: "none" }}>
        ← Back to Dashboard
      </Link>

      <div
        style={{
          marginTop: "30px",
          background: "white",
          padding: "30px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          textAlign: "left",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1
              style={{
                marginBottom: "10px",
                color: "#111827",
                fontSize: "2.4rem",
                fontWeight: 950 as any,
                lineHeight: 1.15,
              }}
            >
              {lesson.title}
            </h1>
            <p style={{ color: "#666" }}>By {lesson.teacherName}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <span
              style={{
                padding: "6px 16px",
                borderRadius: "20px",
                background: lesson.isPublished ? "#d4edda" : "#fff3cd",
                color: lesson.isPublished ? "#155724" : "#856404",
                fontWeight: "bold",
                fontSize: "0.95rem",
              }}
            >
              {lesson.isPublished ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: "30px" }}>
          <h3
            style={{
              color: "#111827",
              marginBottom: "10px",
              fontSize: "1.65rem",
              fontWeight: 900,
            }}
          >
            Lesson Content
          </h3>
          <div
            style={{
              background: "#f8f9fa",
              padding: "20px",
              borderRadius: "8px",
              lineHeight: "1.8",
              minHeight: "200px",
              textAlign: "left",
              fontSize: BASE_FONT_SIZE,
            }}
          >
            <ReactMarkdown components={markdownComponents as any}>
              {lesson.content || ""}
            </ReactMarkdown>
          </div>
        </div>

        {/* Phase C3: Preview mode CTA block for legacy view */}
        {previewMode && (
          <div
            style={{
              marginTop: "32px",
              padding: "24px",
              borderRadius: "14px",
              backgroundColor: "#fff7ed",
              border: "2px solid rgba(249,115,22,0.40)",
              boxShadow: "0 4px 12px rgba(249,115,22,0.15)",
            }}
          >
            <h3
              style={{
                margin: "0 0 12px 0",
                fontSize: "1.5rem",
                fontWeight: 800,
                color: "#9a3412",
              }}
            >
              Unlock the full lesson
            </h3>
            <p
              style={{
                margin: "0 0 20px 0",
                fontSize: "1rem",
                color: "#7c2d12",
                lineHeight: 1.6,
              }}
            >
              You're viewing a preview. Unlock the complete lesson to access all pages, flashcards, and quiz questions.
            </p>
            {unlockError && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "12px",
                  borderRadius: "10px",
                  backgroundColor: unlockError === "Not enough ShamCoins" ? "#fef2f2" : "#f8fafc",
                  border: unlockError === "Not enough ShamCoins" ? "1px solid #fecaca" : "1px solid #e2e8f0",
                  color: unlockError === "Not enough ShamCoins" ? "#991b1b" : "#475569",
                }}
              >
                {unlockError === "Not enough ShamCoins" ? (
                  <>
                    <p style={{ margin: "0 0 10px 0", fontWeight: 600 }}>Not enough ShamCoins to unlock this lesson.</p>
                    <Link to="/subscription">
                      <button
                        type="button"
                        style={{
                          padding: "8px 16px",
                          borderRadius: "8px",
                          border: "none",
                          backgroundColor: "#4f46e5",
                          color: "white",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        Subscribe to get ShamCoins
                      </button>
                    </Link>
                  </>
                ) : (
                  <p style={{ margin: 0 }}>{unlockError}</p>
                )}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <button
                onClick={handleUnlock}
                disabled={unlocking}
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: unlocking ? "#94a3b8" : "#f97316",
                  color: "white",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: unlocking ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!unlocking) e.currentTarget.style.backgroundColor = "#ea580c";
                }}
                onMouseLeave={(e) => {
                  if (!unlocking) e.currentTarget.style.backgroundColor = "#f97316";
                }}
              >
                {unlocking ? "Unlocking…" : "Unlock full lesson (1 ShamCoin)"}
              </button>
              <Link
                to="/subscription"
                style={{
                  padding: "12px 24px",
                  borderRadius: "10px",
                  border: "2px solid rgba(249,115,22,0.50)",
                  backgroundColor: "transparent",
                  color: "#9a3412",
                  fontSize: "1rem",
                  fontWeight: 700,
                  textDecoration: "none",
                  display: "inline-block",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(249,115,22,0.10)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                Subscribe to unlock all lessons
              </Link>
            </div>
          </div>
        )}

        {/* ✅ REVISION SECTION - ADDED FOR LEGACY VIEW */}
        <div
          style={{
            marginTop: "40px",
            paddingTop: "30px",
            borderTop: "1px solid #e2e8f0",
            textAlign: "left",
          }}
        >
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "20px" 
          }}>
            <h2 style={{ color: "#333", fontSize: "1.65rem", margin: 0 }}>
              Revision
            </h2>
            
            {/* ✅ UPDATED: AI generation button for legacy view - only show for teachers/admins */}
            {isTeacherOrAdmin ? (
              <button
                onClick={handleAIGenerate}
                disabled={isGenerating}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "2px solid #10b981",
                  background: isGenerating ? "#e5e7eb" : "#10b981",
                  color: "white",
                  cursor: isGenerating ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                  fontSize: "14px"
                }}
              >
                {isGenerating ? "Generating..." : "Generate revision with AI"}
              </button>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {/* ✅ RESTORED: Flashcard component with updated props in legacy view too */}
            <FlashcardsView
              title="Flashcards"
              cards={flashcards.map((flashcard: any, i: number) => ({
                id: flashcard.id ?? flashcard._id ?? String(i),
                front: flashcard.front ?? flashcard.question ?? "",
                back: flashcard.back ?? flashcard.answer ?? "",
                difficulty: (flashcard.difficulty && [1, 2, 3].includes(flashcard.difficulty))
                  ? (flashcard.difficulty as 1 | 2 | 3)
                  : 1,
                tags: Array.isArray(flashcard.tags) ? flashcard.tags : [],
              }))}
            />

            {/* ✅ FIXED: Quiz component using single source of truth in legacy view */}
            <QuizView
              title="Quiz"
              questions={
                quizQuestions.map((q: any, i: number) => {
                  const base = {
                    id: q.id ?? `q_${String(i + 1).padStart(3, "0")}`,
                    question: q.question ?? "",
                    explanation: q.explanation,
                    tags: q.tags,
                    difficulty: q.difficulty,
                    marks: q.marks
                  };

                  if (q.type === "mcq") {
                    return {
                      ...base,
                      type: "mcq" as const,
                      options: Array.isArray(q.options) ? q.options : [],
                      correctAnswer: q.correctAnswer ?? ""
                    };
                  }

                  if (q.type === "exam") {
                    return {
                      ...base,
                      type: "exam" as const,
                      markScheme: Array.isArray(q.markScheme) ? q.markScheme : [],
                      correctAnswer: q.correctAnswer ?? "See mark scheme."
                    };
                  }

                  return {
                    ...base,
                    type: "short" as const,
                    correctAnswer: q.correctAnswer ?? ""
                  };
                })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonViewPage;