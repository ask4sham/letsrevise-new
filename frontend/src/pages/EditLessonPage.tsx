import React, { useMemo, useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabaseClient";
import api from "../services/api";
import FlashcardsEditor from "../components/revision/FlashcardsEditor";
import {
  type LessonBlockType,
  BLOCK_META,
  getBlockStyle,
  getBlockButtonStyle,
  normalizeBlockType,
  toLegacyBlockType,
  BLOCK_TYPES_FOR_BUTTONS,
} from "../types/lessonBlocks";

interface LessonPageBlock {
  type: LessonBlockType;
  content: string;
}

interface LessonPageHero {
  type: "none" | "image" | "video" | "animation";
  src: any;
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

interface Flashcard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: number;
}

interface QuizQuestion {
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
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  subject: string;
  level: string;
  topic: string;
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
  pages?: LessonPage[];
  createdFromTemplate?: boolean;
  flashcards?: Flashcard[];
  quiz?: {
    timeSeconds?: number;
    questions?: QuizQuestion[];
  };
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

function newId() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function generateRevisionId() {
  return `rev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function sanitizeTeacherMarkdown(input: string) {
  let text = (input || "").replace(/\r\n/g, "\n");
  text = text.replace(/^[ \t]*[•·–—*]\s*/gm, "- ");
  text = text.replace(/^[ \t]*-\s*(?=\S)/gm, "- ");
  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    const next = lines[i + 1].trim();
    const looksLikeHeading =
      cur.length > 0 &&
      cur.length <= 60 &&
      !cur.startsWith("#") &&
      !cur.startsWith("-") &&
      !cur.startsWith("*") &&
      !cur.endsWith(".") &&
      !cur.endsWith(":");
    const nextIsList = next.startsWith("- ");
    if (looksLikeHeading && nextIsList) {
      lines[i] = `### ${cur}`;
    }
  }
  return lines.join("\n").trimEnd();
}

const MEDIA_BUCKET =
  (process.env.REACT_APP_SUPABASE_MEDIA_BUCKET as string) || "lesson-media";

function slugifyFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-_]/g, "");
}

function buildMarkdownForFile(url: string, file: File) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const alt = file.name.replace(/\.[^/.]+$/, "");
  if (isImage) return `\n\n![${alt}](${url})\n\n`;
  if (isVideo) return `\n\n[Video: ${alt}](${url})\n\n`;
  return `\n\n[${file.name}](${url})\n\n`;
}

function makeAbsoluteAssetUrl(maybeRelativeUrl: string) {
  const s = safeStr(maybeRelativeUrl, "");
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const apiBase = safeStr((api as any)?.defaults?.baseURL, "");
  const apiOrigin = apiBase
    ? apiBase.replace(/\/api\/?$/i, "").replace(/\/+$/i, "")
    : "";
  let origin = window.location.origin;
  if (/:\d+$/.test(origin) && origin.endsWith(":3000")) {
    origin = origin.replace(":3000", ":5000");
  }
  const base = apiOrigin || origin;
  return `${base}${s.startsWith("/") ? "" : "/"}${s}`;
}

// Function to download quiz CSV template
const downloadQuizCSVTemplate = () => {
  const csvContent = `question,type,correctAnswer,markScheme,marks,tags
"What is the function of mitochondria in a cell?","short","Generate ATP (energy) for the cell","Cellular respiration;ATP production;Energy conversion",2,"biology;cells;gcse"
"Which of the following is NOT a function of the cell membrane?","mcq","A) Photosynthesis","",1,"biology;cells;membrane"
"Explain how diffusion occurs across a cell membrane","exam","Movement of particles from high to low concentration through the membrane","Particles move randomly;Concentration gradient drives movement;Passive process;No energy required",4,"biology;cells;diffusion;transport"`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'quiz_template.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Robust CSV Parser that handles quoted fields, escaped quotes, and various newlines
const parseCSV = (csvText: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  while (i < csvText.length) {
    const char = csvText[i];
    const nextChar = i + 1 < csvText.length ? csvText[i + 1] : '';

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !insideQuotes) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    currentField += char;
    i++;
  }

  // Add the last row if there's any content
  if (currentField.trim() || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
  }

  return rows;
};

// Parse markScheme field (could be plain text with semicolons or JSON array)
const parseMarkScheme = (markSchemeStr: string): string[] => {
  if (!markSchemeStr || markSchemeStr.trim() === '') {
    return [];
  }

  const trimmed = markSchemeStr.trim();
  
  // Try to parse as JSON first
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item).trim()).filter(item => item);
      }
    } catch (e) {
      // Not valid JSON, fall through to plain text parsing
    }
  }

  // Parse as plain text with semicolon separator
  return trimmed.split(';').map(item => item.trim()).filter(item => item);
};

const EditLessonPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [uploadingKey, setUploadingKey] = useState<string>("");
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [revisionTab, setRevisionTab] = useState<"flashcards" | "quizzes">("flashcards");
  const [isGenerating, setIsGenerating] = useState(false);
  const [newFlashcard, setNewFlashcard] = useState({ front: "", back: "", tags: "" });
  const [newQuizQuestion, setNewQuizQuestion] = useState({
    type: "mcq" as "mcq" | "short" | "exam",
    question: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    explanation: ""
  });
  const [isQuizCollapsed, setIsQuizCollapsed] = useState(false);
  const [isFlashcardsCollapsed, setIsFlashcardsCollapsed] = useState(false);
  const [examBulkText, setExamBulkText] = useState("");
  const [showQuizList, setShowQuizList] = useState(true);
  
  // State for CSV import
  const [csvImportData, setCsvImportData] = useState<{
    parsedQuestions: QuizQuestion[];
    previewVisible: boolean;
    rowsParsed: number;
    rowsSkipped: number;
  }>({
    parsedQuestions: [],
    previewVisible: false,
    rowsParsed: 0,
    rowsSkipped: 0
  });
  
  // State for mark preview expansion
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set());

  const blockTextareasRef = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const userType = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      return String(u?.userType || u?.type || "").toLowerCase();
    } catch {
      return "";
    }
  }, []);
  const isAdmin = userType === "admin";
  const backHref = isAdmin ? "/admin" : "/teacher-dashboard";

  const pageParam = useMemo(
    () => searchParams.get("page") || "",
    [searchParams]
  );

  const hasStructuredPages = useMemo(
    () =>
      Boolean(
        lesson?.pages &&
          Array.isArray(lesson.pages) &&
          lesson.pages.length > 0
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

  const flashcards = useMemo(() => lesson?.flashcards || [], [lesson]);
  const quizQuestions = useMemo(() => lesson?.quiz?.questions || [], [lesson]);

  useEffect(() => {
    fetchLessonSmart();
  }, [id]);

  useEffect(() => {
    if (lesson?.createdFromTemplate && titleRef.current) {
      titleRef.current.focus();
    }
  }, [lesson?.createdFromTemplate]);

  const fetchLessonSmart = async () => {
    try {
      setLoading(true);
      setError("");
      setSaveMsg("");

      if (!id) {
        setError("Lesson id missing");
        return;
      }

      if (isMongoObjectId(id)) {
        await fetchLessonFromBackend(id);
        return;
      }

      if (isUuid(id)) {
        await fetchLessonFromSupabase(id);
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

  const fetchLessonFromBackend = async (lessonId: string) => {
    try {
      let data: any = null;
      if (isAdmin) {
        try {
          const resAdmin = await api.get(`/admin/lessons/${lessonId}`);
          data = resAdmin?.data?.lesson || resAdmin?.data || null;
        } catch {}
      }

      if (!data) {
        const res = await api.get(`/lessons/${lessonId}`);
        data = res?.data || null;
      }

      if (!data) {
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
        teacherId: safeStr(data.teacherId?._id || data.teacherId, ""),
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
        flashcards: Array.isArray(data.flashcards) ? data.flashcards : [],
        quiz: data.quiz || { timeSeconds: 600, questions: [] },
        createdFromTemplate: Boolean(data.createdFromTemplate),
      };

      if (Array.isArray(mapped.pages)) {
        mapped.pages = mapped.pages.map((p, idx) => ({
          pageId: safeStr((p as any).pageId, newId()),
          title: safeStr((p as any).title, `Page ${idx + 1}`),
          order: Number.isFinite(Number((p as any).order))
            ? Number((p as any).order)
            : idx + 1,
          pageType: (p as any).pageType,
          hero: (p as any).hero
            ? (p as any).hero
            : { type: "none", src: "", caption: "" },
          blocks: Array.isArray((p as any).blocks)
            ? (p as any).blocks.map((b: any) => ({
                type: normalizeBlockType(b?.type),
                content: safeStr(b?.content, ""),
              }))
            : [{ type: "text", content: "" }],
          checkpoint: (p as any).checkpoint
            ? {
                question: safeStr((p as any).checkpoint.question, ""),
                options: Array.isArray((p as any).checkpoint.options)
                  ? (p as any).checkpoint.options
                  : ["", "", "", ""],
                answer: safeStr((p as any).checkpoint.answer, ""),
              }
            : { question: "", options: ["", "", "", ""], answer: "" },
        }));
      }

      setLesson(mapped);

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
      setError(err?.message || "Failed to load lesson");
    }
  };

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
        createdFromTemplate: false,
      };

      setLesson(mapped);
    } catch (err: any) {
      console.error("Error fetching lesson from Supabase:", err);
      setError("Failed to load lesson");
    }
  };

  const cleanupBadQuizEntries = () => {
    setLesson((prev: any) => {
      if (!prev) return prev;
      const prevQuiz = prev.quiz || { timeSeconds: 600, questions: [] };
      const prevQs = Array.isArray(prevQuiz.questions) ? prevQuiz.questions : [];

      const cleaned = prevQs.filter((q: any) => {
        const text = String(q?.question ?? "").trim();
        if (!text) return false;

        if (/^ANSWER\s*:/i.test(text)) return false;
        if (/^MARKS\s*:/i.test(text)) return false;
        if (/^TYPE\s*:/i.test(text)) return false;
        if (/^TAGS\s*:/i.test(text)) return false;
        if (/^MARKSCHEME\s*:/i.test(text)) return false;

        return true;
      });

      return {
        ...prev,
        quiz: {
          ...prevQuiz,
          questions: cleaned,
        },
      };
    });
  };

  const goToPage = (p: LessonPage) => {
    if (!p?.pageId) return;
    setSearchParams({ page: String(p.pageId) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateLessonField = (key: keyof Lesson, value: any) => {
    setLesson((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updatePage = (pageId: string, patch: Partial<LessonPage>) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const idx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (idx < 0) return prev;
      pages[idx] = { ...pages[idx], ...patch };
      return { ...prev, pages };
    });
  };

  const updateBlock = (
    pageId: string,
    blockIndex: number,
    patch: Partial<LessonPageBlock>
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      if (blockIndex < 0 || blockIndex >= blocks.length) return prev;
      blocks[blockIndex] = { ...blocks[blockIndex], ...patch };
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const addBlock = (pageId: string, type: LessonBlockType) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      blocks.push({ type, content: "" });
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const removeBlock = (pageId: string, blockIndex: number) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      blocks.splice(blockIndex, 1);
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const moveBlock = (pageId: string, from: number, dir: -1 | 1) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      const to = from + dir;
      if (from < 0 || from >= blocks.length || to < 0 || to >= blocks.length)
        return prev;
      const tmp = blocks[from];
      blocks[from] = blocks[to];
      blocks[to] = tmp;
      pages[pIdx] = { ...pages[pIdx], blocks };
      return { ...prev, pages };
    });
  };

  const addPage = () => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const nextOrder =
        pages.length > 0
          ? Math.max(...pages.map((p) => Number(p.order || 0))) + 1
          : 1;

      const p: LessonPage = {
        pageId: newId(),
        title: `Page ${nextOrder}`,
        order: nextOrder,
        pageType: "",
        hero: { type: "none", src: "", caption: "" },
        blocks: [{ type: "text", content: "" }],
        checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
      };

      const next = { ...prev, pages: [...pages, p] };
      setTimeout(() => setSearchParams({ page: String(p.pageId) }), 0);
      return next;
    });
  };

  const removePage = (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const nextPages = pages.filter((p) => String(p.pageId) !== String(pageId));
      const renum = nextPages
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((p, idx) => ({ ...p, order: idx + 1 }));
      setTimeout(() => {
        if (renum.length > 0) setSearchParams({ page: String(renum[0].pageId) });
        else setSearchParams({}, { replace: true });
      }, 0);
      return { ...prev, pages: renum };
    });
  };

  const movePage = (pageId: string, dir: -1 | 1) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const ordered = pages.sort((a, b) => (a.order || 0) - (b.order || 0));
      const idx = ordered.findIndex((p) => String(p.pageId) === String(pageId));
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= ordered.length) return prev;
      const tmp = ordered[idx];
      ordered[idx] = ordered[to];
      ordered[to] = tmp;
      const renum = ordered.map((p, i) => ({ ...p, order: i + 1 }));
      return { ...prev, pages: renum };
    });
  };

  const updateCheckpoint = (
    pageId: string,
    patch: Partial<NonNullable<LessonPage["checkpoint"]>>
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const cp =
        pages[pIdx].checkpoint || { question: "", options: ["", "", "", ""], answer: "" };
      pages[pIdx] = { ...pages[pIdx], checkpoint: { ...cp, ...patch } };
      return { ...prev, pages };
    });
  };

  const updateCheckpointOption = (
    pageId: string,
    optIndex: number,
    value: string
  ) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const cp =
        pages[pIdx].checkpoint || { question: "", options: ["", "", "", ""], answer: "" };
      const options = Array.isArray(cp.options) ? [...cp.options] : [];
      while (options.length < 4) options.push("");
      options[optIndex] = value;
      pages[pIdx] = { ...pages[pIdx], checkpoint: { ...cp, options } };
      return { ...prev, pages };
    });
  };

  const saveRevision = async (flashcards: Flashcard[], quizQuestions: QuizQuestion[]) => {
    if (!id || !isMongoObjectId(id)) return false;
    
    try {
      // CSV import is append-only. Deletion is admin-only and enforced server-side.
      const payload = {
        flashcards,
        quiz: {
          timeSeconds: 600,
          questions: quizQuestions
        },
        // 🔒 INTENT ASSERTION FLAG: Makes it explicit that CSV import is add-only by design
        // Future-proofs backend enforcement and prevents silent refactors breaking security
        importIntent: "append_only" as const
      };
      
      await api.post(`/lessons/${id}/revision`, payload);
      return true;
    } catch (error: any) {
      console.error("Error saving revision:", error);
      
      // Handle 403 permission error for teachers trying to delete
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.error || error.response?.data?.message || "Permission denied";
        
        if (errorMessage.includes("delete") || errorMessage.includes("permission") || errorMessage.includes("admin")) {
          // Show styled banner instead of alert
          setSaveMsg("🚫 You don't have permission to delete existing quiz questions. You can add new ones, but only admins can delete.");
          setTimeout(() => setSaveMsg(""), 5000);
        } else {
          setSaveMsg(`❌ ${errorMessage}`);
          setTimeout(() => setSaveMsg(""), 5000);
        }
      } else {
        setSaveMsg("❌ Failed to save revision data");
        setTimeout(() => setSaveMsg(""), 5000);
      }
      
      return false;
    }
  };

  const handleAIGenerate = async () => {
    if (!id || !isMongoObjectId(id)) return;
    
    setIsGenerating(true);
    try {
      const response = await api.post(`/lessons/${id}/generate-revision`);
      const data = response.data;
      
      if (data.success) {
        await fetchLessonSmart();
        alert(`Generated ${data.flashcardsCount} flashcards and ${data.quizQuestionsCount} quiz questions!`);
      } else {
        alert(data.error || 'Failed to generate revision');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      alert('Error generating revision content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddFlashcard = async () => {
    if (!newFlashcard.front.trim() || !newFlashcard.back.trim()) {
      alert("Please fill in both front and back of the flashcard");
      return;
    }
    
    const newFlashcardWithId = {
      ...newFlashcard,
      id: generateRevisionId(),
      tags: newFlashcard.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      difficulty: 1
    };
    
    const updatedFlashcards = [...flashcards, newFlashcardWithId];
    
    if (await saveRevision(updatedFlashcards, quizQuestions)) {
      setNewFlashcard({ front: "", back: "", tags: "" });
      setLesson(prev => prev ? {
        ...prev,
        flashcards: updatedFlashcards
      } : null);
    }
  };

  const handleAddQuizQuestion = async () => {
    if (!newQuizQuestion.question.trim()) {
      alert("Please enter a question");
      return;
    }
    
    if (newQuizQuestion.type === "mcq" && newQuizQuestion.options.some(opt => !opt.trim())) {
      alert("Please fill in all options for MCQ");
      return;
    }
    
    const newQuestionWithId = {
      ...newQuizQuestion,
      id: generateRevisionId(),
      difficulty: 1
    };
    
    const updatedQuizQuestions = [...quizQuestions, newQuestionWithId];
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setNewQuizQuestion({
        type: "mcq",
        question: "",
        options: ["", "", "", ""],
        correctAnswer: "",
        explanation: ""
      });
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
    }
  };

  const handleDeleteFlashcard = async (flashcardId: string) => {
    if (!window.confirm("Delete this flashcard?")) return;
    
    const updatedFlashcards = flashcards.filter(f => f.id !== flashcardId);
    
    if (await saveRevision(updatedFlashcards, quizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        flashcards: updatedFlashcards
      } : null);
    }
  };

  const handleDeleteQuizQuestion = async (questionId: string) => {
    if (!window.confirm("Delete this quiz question?")) return;
    
    const updatedQuizQuestions = quizQuestions.filter(q => q.id !== questionId);
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
    }
  };

  // Toggle mark preview expansion
  const toggleMarkPreview = (questionId: string) => {
    setExpandedPreviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  // ✅ CSV Import Functions
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const csvText = e.target?.result as string;
      if (!csvText) {
        alert("Failed to read CSV file");
        return;
      }

      try {
        // Parse CSV with robust parser
        const rows = parseCSV(csvText);
        
        if (rows.length === 0) {
          alert("CSV file is empty");
          return;
        }

        // Extract headers (first row)
        const headers = rows[0].map(h => h.toLowerCase().trim());
        
        // Find column indices
        const questionIdx = headers.indexOf('question');
        const typeIdx = headers.indexOf('type');
        const correctAnswerIdx = headers.indexOf('correctanswer');
        const markSchemeIdx = headers.indexOf('markscheme');
        const marksIdx = headers.indexOf('marks');
        const tagsIdx = headers.indexOf('tags');

        if (questionIdx === -1 || typeIdx === -1 || correctAnswerIdx === -1) {
          alert("CSV must contain columns: question, type, correctAnswer");
          return;
        }

        const parsedQuestions: QuizQuestion[] = [];
        let rowsSkipped = 0;

        // Process data rows (skip header row)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          
          // Skip empty rows
          if (row.every(cell => !cell.trim())) {
            rowsSkipped++;
            continue;
          }

          const question = row[questionIdx]?.trim();
          const type = row[typeIdx]?.trim().toLowerCase() as "mcq" | "short" | "exam";
          const correctAnswer = row[correctAnswerIdx]?.trim();
          const markSchemeStr = markSchemeIdx !== -1 ? row[markSchemeIdx]?.trim() : '';
          const marksStr = marksIdx !== -1 ? row[marksIdx]?.trim() : '1';
          const tagsStr = tagsIdx !== -1 ? row[tagsIdx]?.trim() : '';

          // Skip rows missing required fields
          if (!question || !type || !correctAnswer) {
            rowsSkipped++;
            continue;
          }

          // Validate question type
          const validType = type === "mcq" || type === "short" || type === "exam" ? type : "short";

          // Parse marks (default to 1)
          const marks = Math.max(1, parseInt(marksStr) || 1);

          // Parse tags (split by semicolon)
          const tags = tagsStr ? tagsStr.split(';').map(tag => tag.trim()).filter(tag => tag) : [];

          // Parse markScheme (could be JSON array or semicolon-separated)
          const markScheme = parseMarkScheme(markSchemeStr);

          parsedQuestions.push({
            id: generateRevisionId(),
            type: validType,
            question,
            correctAnswer,
            markScheme,
            marks,
            tags,
            difficulty: 1
          });
        }

        // Show preview
        setCsvImportData({
          parsedQuestions,
          previewVisible: true,
          rowsParsed: parsedQuestions.length,
          rowsSkipped
        });

      } catch (error) {
        console.error("Error parsing CSV:", error);
        alert("Error parsing CSV file. Please check the format.");
      }
    };

    reader.readAsText(file);
  };

  const applyCSVImport = () => {
    const { parsedQuestions } = csvImportData;
    
    if (parsedQuestions.length === 0) {
      alert("No questions to import");
      return;
    }

    setLesson(prev => {
      if (!prev) return prev;
      
      const prevQuiz = prev.quiz || { timeSeconds: 600, questions: [] };
      const prevQs = Array.isArray(prevQuiz.questions) ? prevQuiz.questions : [];
      
      // 🔒 SECURITY CHECK: CSV import can only add questions, never delete or replace
      // This maintains parity with backend 403 rules and prevents accidental "replace" refactors
      const currentCount = prevQs.length;
      const newCount = currentCount + parsedQuestions.length;
      
      // Safety check: ensure we're only appending (should always be true with +)
      if (newCount < currentCount) {
        setSaveMsg("🚫 CSV import can only add questions. Deleting is admin-only.");
        setTimeout(() => setSaveMsg(""), 5000);
        return prev; // Return unchanged lesson
      }
      
      return {
        ...prev,
        quiz: {
          ...prevQuiz,
          questions: [...prevQs, ...parsedQuestions]
        },
        // 🔒 INTENT ASSERTION FLAG: CSV import is append-only by design
        // Self-documents intent and makes future refactors obvious
        _csvImportIntent: "append_only" as const
      };
    });

    // Close preview and show success message
    setCsvImportData({
      parsedQuestions: [],
      previewVisible: false,
      rowsParsed: 0,
      rowsSkipped: 0
    });

    setSaveMsg(`✅ Successfully imported ${parsedQuestions.length} questions from CSV!`);
    setTimeout(() => setSaveMsg(""), 5000);
  };

  const cancelCSVImport = () => {
    setCsvImportData({
      parsedQuestions: [],
      previewVisible: false,
      rowsParsed: 0,
      rowsSkipped: 0
    });
  };

  // ✅ Structured parser for quiz bulk upload with MARKSCHEME support
  const handleSimpleQuizBulkUpload = () => {
    const text = (examBulkText || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!text) return;

    // Split into question blocks by blank lines
    const blocks = text.split(/\n\s*\n+/g).map((b) => b.trim()).filter(Boolean);
    if (!blocks.length) return;

    const newQs = blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

      let type: "mcq" | "short" | "exam" = "short";
      let questionLines: string[] = [];
      let correctAnswer = "";
      let explanation = "";
      let marks = 1;
      let tags: string[] = [];
      let options: string[] | undefined = undefined;
      let markScheme: string[] | undefined = undefined;

      const optionMap: Record<string, string> = {};

      for (const line of lines) {
        // Metadata
        if (/^TYPE\s*:/i.test(line)) {
          const v = line.replace(/^TYPE\s*:\s*/i, "").trim().toLowerCase();
          if (v === "mcq" || v === "short" || v === "exam") type = v as any;
          continue;
        }
        if (/^MARKS\s*:/i.test(line)) {
          const v = Number(line.replace(/^MARKS\s*:\s*/i, "").trim());
          if (Number.isFinite(v) && v > 0) marks = Math.round(v);
          continue;
        }
        if (/^TAGS\s*:/i.test(line)) {
          const raw = line.replace(/^TAGS\s*:\s*/i, "").trim();
          tags = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12);
          continue;
        }
        if (/^ANSWER\s*:/i.test(line)) {
          correctAnswer = line.replace(/^ANSWER\s*:\s*/i, "").trim();
          continue;
        }
        if (/^EXPLANATION\s*:/i.test(line)) {
          explanation = line.replace(/^EXPLANATION\s*:\s*/i, "").trim();
          continue;
        }
        // ✅ Added: MARKSCHEME support
        if (/^MARKSCHEME\s*:/i.test(line)) {
          const raw = line.replace(/^MARKSCHEME\s*:\s*/i, "").trim();
          const parts = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20);
          markScheme = parts.length ? parts : undefined;
          continue;
        }

        // MCQ options: A) ... or A. ...
        const optMatch = line.match(/^([A-D])[\)\.]\s*(.+)$/i);
        if (optMatch) {
          const k = optMatch[1].toUpperCase();
          optionMap[k] = optMatch[2].trim();
          continue;
        }

        // Otherwise assume it's part of the question stem
        questionLines.push(line);
      }

      // If options exist, set MCQ
      const optionKeys = Object.keys(optionMap);
      if (optionKeys.length) {
        type = "mcq";
        options = ["A", "B", "C", "D"].filter((k) => optionMap[k]).map((k) => `${k}) ${optionMap[k]}`);
        // If ANSWER: was "B", convert to the option text if possible
        if (correctAnswer && /^[A-D]$/i.test(correctAnswer) && optionMap[correctAnswer.toUpperCase()]) {
          correctAnswer = optionMap[correctAnswer.toUpperCase()];
        }
      }

      const question = questionLines.join("\n").trim();

      return {
        id: `q_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`,
        type,
        question: question || "(missing question)",
        options,
        correctAnswer: correctAnswer || "",
        markScheme, // ✅ Now includes markScheme array
        explanation,
        tags,
        difficulty: 1,
        marks,
      };
    });

    // ✅ Enhanced filter to clean up wrongly-imported metadata lines
    const filtered = newQs.filter((q) => {
      if (!q.question || q.question === "(missing question)") return false;

      // ❌ reject legacy junk accidentally imported as questions
      if (/^ANSWER\s*:/i.test(q.question)) return false;
      if (/^MARKS\s*:/i.test(q.question)) return false;
      if (/^TYPE\s*:/i.test(q.question)) return false;
      if (/^TAGS\s*:/i.test(q.question)) return false;
      if (/^MARKSCHEME\s*:/i.test(q.question)) return false;

      return true;
    });

    setLesson((prev: any) => {
      if (!prev) return prev;
      const prevQuiz = prev.quiz || { timeSeconds: 600, questions: [] };
      const prevQs = Array.isArray(prevQuiz.questions) ? prevQuiz.questions : [];
      
      // 🔒 SECURITY CHECK: Bulk upload can only add questions, never delete or replace
      const currentCount = prevQs.length;
      const newCount = currentCount + filtered.length;
      
      if (newCount < currentCount) {
        setSaveMsg("🚫 Bulk upload can only add questions. Deleting is admin-only.");
        setTimeout(() => setSaveMsg(""), 5000);
        return prev;
      }
      
      return {
        ...prev,
        quiz: {
          ...prevQuiz,
          questions: [...prevQs, ...filtered],
        },
        // 🔒 INTENT ASSERTION FLAG: Bulk upload is append-only
        _bulkUploadIntent: "append_only" as const
      };
    });

    setExamBulkText("");
  };

  const handleBulkUpload = async () => {
    if (!examBulkText.trim()) {
      alert("Please paste some exam questions in the text area");
      return;
    }

    const lines = examBulkText.split('\n').filter(line => line.trim());
    const newQuestions: QuizQuestion[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      const hasOptions = trimmedLine.includes('A)') || trimmedLine.includes('a)') || 
                         trimmedLine.includes('1)') || trimmedLine.includes('1.');
      
      if (hasOptions) {
        const questionMatch = trimmedLine.match(/^([^A1a][^:]*):?(.*)/);
        if (questionMatch) {
          const questionText = questionMatch[0];
          newQuestions.push({
            id: generateRevisionId(),
            type: "mcq",
            question: questionText,
            options: ["", "", "", ""],
            correctAnswer: "",
            explanation: "",
            difficulty: 1
          });
        }
      } else {
        newQuestions.push({
          id: generateRevisionId(),
          type: "short",
          question: trimmedLine,
          correctAnswer: "",
          explanation: "",
          difficulty: 1
        });
      }
    }

    if (newQuestions.length === 0) {
      alert("No valid questions found in the text");
      return;
    }

    const confirmed = window.confirm(`Found ${newQuestions.length} questions. Add them to the lesson?`);
    if (!confirmed) return;

    const updatedQuizQuestions = [...quizQuestions, ...newQuestions];
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
      
      setExamBulkText("");
      alert(`Successfully added ${newQuestions.length} questions!`);
    }
  };

  const parseStructuredExamQuestions = (text: string): QuizQuestion[] => {
    const questions: QuizQuestion[] = [];
    const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
    
    for (const block of blocks) {
      const lines = block.split('\n').filter(line => line.trim());
      if (lines.length === 0) continue;
      
      const questionText = lines[0].trim();
      let options: string[] = [];
      let correctAnswer = "";
      let explanation = "";
      let markScheme: string[] | undefined = undefined;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.toLowerCase().startsWith('answer:') || 
            line.toLowerCase().startsWith('correct:')) {
          correctAnswer = line.substring(line.indexOf(':') + 1).trim();
        }
        else if (line.toLowerCase().startsWith('explanation:')) {
          explanation = line.substring(line.indexOf(':') + 1).trim();
        }
        else if (line.toLowerCase().startsWith('markscheme:')) {
          const raw = line.substring(line.indexOf(':') + 1).trim();
          const parts = raw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 20);
          markScheme = parts.length ? parts : undefined;
        }
        else if (/^[A-Da-d][).]|^[1-4][).]/.test(line)) {
          options.push(line);
        }
      }
      
      let type: "mcq" | "short" | "exam" = "short";
      if (options.length >= 2) {
        type = "mcq";
      } else if (questionText.toLowerCase().includes('exam') || 
                 questionText.toLowerCase().includes('question') && 
                 questionText.length > 100) {
        type = "exam";
      }
      
      questions.push({
        id: generateRevisionId(),
        type,
        question: questionText,
        options: options.length > 0 ? options : undefined,
        correctAnswer,
        explanation,
        markScheme,
        difficulty: 1
      });
    }
    
    return questions;
  };

  const handleStructuredBulkUpload = async () => {
    if (!examBulkText.trim()) {
      alert("Please paste exam questions in the text area");
      return;
    }

    const newQuestions = parseStructuredExamQuestions(examBulkText);
    
    if (newQuestions.length === 0) {
      alert("No valid questions found. Please use this format:\n\nQuestion text\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nAnswer: A\nExplanation: Optional explanation\nMARKSCHEME: point 1, point 2, point 3");
      return;
    }

    const confirmed = window.confirm(`Found ${newQuestions.length} structured questions. Add them to the lesson?`);
    if (!confirmed) return;

    const updatedQuizQuestions = [...quizQuestions, ...newQuestions];
    
    if (await saveRevision(flashcards, updatedQuizQuestions)) {
      setLesson(prev => prev ? {
        ...prev,
        quiz: {
          ...prev.quiz,
          questions: updatedQuizQuestions
        }
      } : null);
      
      setExamBulkText("");
      alert(`Successfully added ${newQuestions.length} structured questions!`);
    }
  };

  const saveQuizQuestions = async () => {
    if (!lesson?.quiz?.questions || lesson.quiz.questions.length === 0) {
      alert("No quiz questions to save");
      return;
    }

    try {
      const success = await saveRevision(flashcards, lesson.quiz.questions);
      if (success) {
        setSaveMsg(`✅ Successfully saved ${lesson.quiz.questions.length} quiz questions!`);
        setTimeout(() => setSaveMsg(""), 5000);
        await fetchLessonSmart();
      }
    } catch (error) {
      console.error("Error saving quiz questions:", error);
      setSaveMsg("❌ Failed to save quiz questions");
      setTimeout(() => setSaveMsg(""), 5000);
    }
  };

  const uploadIntoBlock = async (
    file: File,
    pageId: string,
    blockIndex: number,
    getCurrentValue: () => string,
    setValue: (next: string) => void
  ) => {
    if (!file) return;
    const ok = file.type.startsWith("image/");
    if (!ok) {
      alert("Please upload an image (png/jpg/gif/webp). Video upload is not enabled yet.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }

    const key = `${pageId}:${blockIndex}`;

    try {
      setUploadingKey(key);
      setUploadMsg("");

      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/lesson_${safeStr(
        lesson?.id,
        "unknown_lesson"
      )}/page_${pageId}/block_${blockIndex}`;

      const res = await api.post(`/uploads/image?folder=${encodeURIComponent(folder)}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }

      const insert = buildMarkdownForFile(url, file);
      const textarea = blockTextareasRef.current[key];
      const current = getCurrentValue();

      if (!textarea) {
        setValue(current + insert);
        setUploadMsg("✅ Uploaded and inserted.");
        return;
      }

      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;

      const next = current.slice(0, start) + insert + current.slice(end);
      setValue(next);

      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + insert.length;
        textarea.setSelectionRange(pos, pos);
      });

      setUploadMsg("✅ Uploaded and inserted.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      alert(
        e?.response?.data?.error ||
          e?.data?.error ||
          e?.message ||
          "Upload failed"
      );
    } finally {
      setUploadingKey("");
    }
  };

  const triggerBlockUpload = (pageId: string, blockIndex: number) => {
    const key = `${pageId}:${blockIndex}`;
    const input = fileInputRef.current[key];
    if (!input) return;
    input.value = "";
    input.click();
  };

  const triggerCSVUpload = () => {
    if (csvFileInputRef.current) {
      csvFileInputRef.current.value = '';
      csvFileInputRef.current.click();
    }
  };

  const saveToBackend = async () => {
    if (!lesson || !id) return;
    if (!isMongoObjectId(id)) {
      setSaveMsg(
        "This lesson is a legacy (Supabase) lesson. (UUID). Editing pages is currently supported for Mongo lessons."
      );
      return;
    }

    try {
      setSaving(true);
      setSaveMsg("");

      const sanitizedPages = (lesson.pages || []).map((p: any) => ({
        ...p,
        blocks: (p.blocks || []).map((b: any) => ({
          type: toLegacyBlockType(b.type),
          content: sanitizeTeacherMarkdown(String(b.content || "")),
        })),
      }));

      const payload: any = {
        title: lesson.title,
        description: lesson.description,
        subject: lesson.subject,
        level: lesson.level,
        topic: lesson.topic,
        board: lesson.examBoardName || "",
        estimatedDuration: lesson.estimatedDuration,
        shamCoinPrice: lesson.shamCoinPrice,
        pages: sanitizedPages,
      };

      let saved = false;

      if (isAdmin) {
        try {
          await api.put(`/admin/lessons/${id}`, payload);
          saved = true;
        } catch {}
      }

      if (!saved) {
        await api.put(`/lessons/${id}`, payload);
      }

      setSaveMsg("✅ Saved!");
      await fetchLessonSmart();
    } catch (e: any) {
      console.error(e);
      setSaveMsg(e?.message || "❌ Save failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 2500);
    }
  };

  const handlePublishToggle = async () => {
    if (!lesson || !id || !isMongoObjectId(id)) return;

    if (lesson?.createdFromTemplate && !lesson.isPublished) {
      const ok = window.confirm(
        "This lesson was created from a template.\n\nHave you reviewed and customised it before publishing?"
      );
      if (!ok) return;
    }

    const newStatus = !lesson.isPublished;
    
    try {
      setPublishing(true);
      setSaveMsg("");

      const sanitizedPages = (lesson.pages || []).map((p: any) => ({
        ...p,
        blocks: (p.blocks || []).map((b: any) => ({
          type: toLegacyBlockType(b.type),
          content: sanitizeTeacherMarkdown(String(b.content || "")),
        })),
      }));

      const payload: any = {
        isPublished: newStatus,
        title: lesson.title,
        description: lesson.description,
        subject: lesson.subject,
        level: lesson.level,
        topic: lesson.topic,
        board: lesson.examBoardName || "",
        estimatedDuration: lesson.estimatedDuration,
        shamCoinPrice: lesson.shamCoinPrice,
        pages: sanitizedPages,
      };

      let updated = false;

      if (isAdmin) {
        try {
          await api.put(`/admin/lessons/${id}`, payload);
          updated = true;
        } catch {}
      }

      if (!updated) {
        await api.put(`/lessons/${id}`, payload);
      }

      setSaveMsg(newStatus ? "✅ Lesson published!" : "✅ Lesson unpublished.");
      setLesson(prev => prev ? { ...prev, isPublished: newStatus } : null);
      
      await fetchLessonSmart();
    } catch (e: any) {
      console.error(e);
      setSaveMsg(e?.message || "❌ Publish/unpublish failed.");
    } finally {
      setPublishing(false);
      setTimeout(() => setSaveMsg(""), 2500);
    }
  };

  const previewBox: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "2px solid rgba(0,0,0,0.14)",
    background: "white",
    marginTop: 10,
  };

  const markdownComponents = {
    img: ({ ...props }: any) => {
      const rawSrc = safeStr(props.src, "");
      const srcAbs = rawSrc ? makeAbsoluteAssetUrl(rawSrc) : "";

      return (
        <img
          {...props}
          src={srcAbs || rawSrc}
          style={{
            maxWidth: "100%",
            height: "auto",
            borderRadius: 10,
            display: "block",
            margin: "12px auto",
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
          alt={props.alt || "Lesson image"}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      );
    },
    a: ({ ...props }: any) => (
      <a {...props} target="_blank" rel="noopener noreferrer">
        {props.children}
      </a>
    ),
  };

  if (loading) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>Loading Lesson...</h2>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div style={{ padding: "50px", textAlign: "center" }}>
        <h2>{error || "Lesson not found"}</h2>
        <Link to={backHref} style={{ color: "#667eea", textDecoration: "none" }}>
          ← Back
        </Link>
      </div>
    );
  }

  if (isUuid(lesson.id)) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
        <Link to={backHref} style={{ color: "#667eea", textDecoration: "none" }}>
          ← Back
        </Link>

        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 12,
            border: "2px solid rgba(0,0,0,0.14)",
            background: "white",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Edit Lesson (Legacy)</h2>
          <p style={{ margin: 0, color: "rgba(0,0,0,0.75)" }}>
            This lesson is stored in the older Supabase system. The new Pages/Blocks editor is currently enabled for Mongo lessons.
            If you want, recreate this lesson using "Create Lesson" (Pages mode) and publish that version.
          </p>
        </div>
      </div>
    );
  }

  const pagesReady = hasStructuredPages && currentPage;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f5f7fa 0%, #e4efe9 100%)",
        padding: "18px",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        {lesson?.createdFromTemplate && (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fed7aa",
              color: "#9a3412",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontWeight: 600,
            }}
          >
            ⚠️ This lesson was created from a template. Review and customise before publishing.
          </div>
        )}

        <div
          style={{
            marginBottom: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link to={backHref} style={{ color: "#667eea", textDecoration: "none" }}>
            ← Back
          </Link>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {uploadMsg ? <span style={{ fontWeight: 900, color: "#15803d" }}>{uploadMsg}</span> : null}

            {saveMsg ? (
              <span style={{ fontWeight: 800, color: saveMsg.startsWith("✅") ? "#15803d" : (saveMsg.startsWith("🚫") ? "#b45309" : "#b91c1c") }}>
                {saveMsg}
              </span>
            ) : null}

            <button
              onClick={handlePublishToggle}
              disabled={publishing}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: lesson.isPublished ? "2px solid rgba(239,68,68,0.5)" : "2px solid rgba(16,185,129,0.5)",
                background: publishing ? "#e5e7eb" : (lesson.isPublished ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.1)"),
                cursor: publishing ? "not-allowed" : "pointer",
                fontWeight: 900,
                color: lesson.isPublished ? "#b91c1c" : "#15803d",
              }}
            >
              {publishing ? "Processing..." : (lesson.isPublished ? "Unpublish Lesson" : "Publish Lesson")}
            </button>

            <button
              onClick={saveToBackend}
              disabled={saving}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "2px solid rgba(0,0,0,0.18)",
                background: saving ? "#e5e7eb" : "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 900,
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <div
          style={{
            border: "4px solid rgba(17,24,39,0.35)",
            borderRadius: 18,
            background: "rgba(255,255,255,0.78)",
            boxShadow: "0 18px 46px rgba(0,0,0,0.14)",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "280px minmax(0, 1fr) 320px",
              gap: 18,
              alignItems: "start",
            }}
          >
            <aside
              style={{
                position: "sticky",
                top: 16,
                alignSelf: "start",
                background: "white",
                borderRadius: 14,
                padding: 14,
                boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                border: "2px solid rgba(0,0,0,0.16)",
              }}
            >
              <div style={{ fontWeight: 900, color: "#111827", marginBottom: 6 }}>
                {isAdmin ? "Admin editor" : "Teacher editor"}
              </div>

              <div style={{ color: "#6b7280", fontSize: "0.92rem", marginBottom: 12 }}>
                Edit pages/blocks. Use "Upload image / video" inside blocks to insert media exactly where your cursor is.
              </div>

              <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>Pages</div>

              <button
                onClick={addPage}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "2px solid rgba(0,0,0,0.16)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                  marginBottom: 10,
                }}
              >
                + Add page
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(orderedPages || []).map((p, idx) => {
                  const isCurrent = pagesReady ? idx === currentPageIndex : false;

                  return (
                    <div
                      key={p.pageId || idx}
                      style={{
                        border: "2px solid rgba(0,0,0,0.14)",
                        borderRadius: 12,
                        padding: 10,
                        background: isCurrent ? "#eef2ff" : "white",
                      }}
                    >
                      <button
                        onClick={() => goToPage(p)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          fontWeight: 900,
                          color: "#111827",
                          padding: 0,
                          marginBottom: 6,
                        }}
                      >
                        {p.title || `Page ${p.order}`}
                      </button>

                      <div style={{ display: "flex", gap: 6, justifyContent: "space-between" }}>
                        <button
                          onClick={() => movePage(p.pageId, -1)}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "2px solid rgba(0,0,0,0.12)",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 800,
                          }}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => movePage(p.pageId, 1)}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "2px solid rgba(0,0,0,0.12)",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 800,
                          }}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removePage(p.pageId)}
                          style={{
                            flex: 1,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "2px solid rgba(239,68,68,0.35)",
                            background: "rgba(239,68,68,0.06)",
                            cursor: "pointer",
                            fontWeight: 900,
                            color: "#b91c1c",
                          }}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            <main>
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                  border: "2px solid rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 10, color: "#111827" }}>
                  Lesson details
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Title</div>
                    <input
                      ref={titleRef}
                      value={lesson.title}
                      onChange={(e) => updateLessonField("title", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Exam board</div>
                    <input
                      value={lesson.examBoardName ?? ""}
                      onChange={(e) =>
                        updateLessonField("examBoardName", e.target.value || null)
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Subject</div>
                    <input
                      value={lesson.subject}
                      onChange={(e) => updateLessonField("subject", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Level</div>
                    <input
                      value={lesson.level}
                      onChange={(e) => updateLessonField("level", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Topic</div>
                    <input
                      value={lesson.topic}
                      onChange={(e) => updateLessonField("topic", e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>
                      Estimated duration (mins)
                    </div>
                    <input
                      type="number"
                      value={lesson.estimatedDuration}
                      onChange={(e) =>
                        updateLessonField("estimatedDuration", Number(e.target.value || 0))
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>ShamCoin price</div>
                    <input
                      type="number"
                      value={lesson.shamCoinPrice}
                      onChange={(e) =>
                        updateLessonField("shamCoinPrice", Number(e.target.value || 0))
                      }
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "2px solid rgba(0,0,0,0.14)",
                      }}
                    />
                  </label>
                </div>

                <label style={{ display: "block", marginTop: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Description</div>
                  <textarea
                    value={lesson.description}
                    onChange={(e) => updateLessonField("description", e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "2px solid rgba(0,0,0,0.14)",
                      resize: "vertical",
                    }}
                  />
                </label>
              </div>

              {!pagesReady ? (
                <div
                  style={{
                    marginTop: 14,
                    background: "white",
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                    border: "2px solid rgba(0,0,0,0.16)",
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>No pages yet</div>
                  <div style={{ color: "#6b7280" }}>
                    Click "Add page" on the left to start.
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      background: "white",
                      borderRadius: 14,
                      padding: 14,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                      border: "2px solid rgba(0,0,0,0.16)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 900, color: "#111827" }}>
                        Editing: {currentPage?.title || `Page ${currentPage?.order}`}
                      </div>

                      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {BLOCK_TYPES_FOR_BUTTONS.map((blockType) => {
                          const meta = BLOCK_META[blockType];
                          return (
                            <button
                              key={blockType}
                              onClick={() => addBlock(currentPage!.pageId, blockType)}
                              style={getBlockButtonStyle(blockType)}
                            >
                              + {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                      <label style={{ display: "block" }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Page title</div>
                        <input
                          value={safeStr(currentPage?.title, "")}
                          onChange={(e) =>
                            updatePage(currentPage!.pageId, { title: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "2px solid rgba(0,0,0,0.14)",
                          }}
                        />
                      </label>

                      <label style={{ display: "block" }}>
                        <div style={{ fontWeight: 800, marginBottom: 6 }}>Page type</div>
                        <input
                          value={safeStr(currentPage?.pageType, "")}
                          onChange={(e) =>
                            updatePage(currentPage!.pageId, { pageType: e.target.value })
                          }
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "2px solid rgba(0,0,0,0.14)",
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                    {(currentPage?.blocks || []).map((b, idx) => {
                      const key = `${currentPage!.pageId}:${idx}`;
                      const isUploading = uploadingKey === key;

                      return (
                        <div key={key} style={getBlockStyle(b.type)}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>{BLOCK_META[b.type].label}</div>

                            <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                onClick={() => moveBlock(currentPage!.pageId, idx, -1)}
                                disabled={idx === 0}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(0,0,0,0.14)",
                                  background: "white",
                                  cursor: idx === 0 ? "not-allowed" : "pointer",
                                  fontWeight: 900,
                                  opacity: idx === 0 ? 0.5 : 1,
                                }}
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moveBlock(currentPage!.pageId, idx, 1)}
                                disabled={idx === (currentPage?.blocks?.length || 0) - 1}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(0,0,0,0.14)",
                                  background: "white",
                                  cursor:
                                    idx === (currentPage?.blocks?.length || 0) - 1
                                      ? "not-allowed"
                                      : "pointer",
                                  fontWeight: 900,
                                  opacity:
                                    idx === (currentPage?.blocks?.length || 0) - 1 ? 0.5 : 1,
                                }}
                              >
                                ↓
                              </button>

                              <button
                                onClick={() => triggerBlockUpload(currentPage!.pageId, idx)}
                                disabled={isUploading}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(0,0,0,0.14)",
                                  background: "white",
                                  cursor: isUploading ? "not-allowed" : "pointer",
                                  fontWeight: 900,
                                }}
                              >
                                {isUploading ? "Uploading..." : "Upload image / video"}
                              </button>

                              <button
                                onClick={() => removeBlock(currentPage!.pageId, idx)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: "2px solid rgba(239,68,68,0.35)",
                                  background: "rgba(239,68,68,0.06)",
                                  cursor: "pointer",
                                  fontWeight: 900,
                                  color: "#b91c1c",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <input
                            ref={(el) => {
                              fileInputRef.current[key] = el;
                            }}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;

                              uploadIntoBlock(
                                f,
                                currentPage!.pageId,
                                idx,
                                () => safeStr(currentPage?.blocks?.[idx]?.content, ""),
                                (next) =>
                                  updateBlock(currentPage!.pageId, idx, { content: next })
                              );
                            }}
                          />

                          <textarea
                            ref={(el) => {
                              blockTextareasRef.current[key] = el;
                            }}
                            value={safeStr(b.content, "")}
                            onChange={(e) =>
                              updateBlock(currentPage!.pageId, idx, { content: e.target.value })
                            }
                            onPaste={(e) => {
                              const pasted = e.clipboardData?.getData("text/plain") ?? "";
                              if (!pasted) return;

                              const looksLikeBullets =
                                /(^|\n)\s*(•|·|–|—|-|\*)\s+/.test(pasted) || pasted.includes("•");

                              let text = pasted;
                              
                              if (looksLikeBullets) {
                                e.preventDefault();
                                text = pasted.replace(/\s*•\s*/g, "\n• ").trim();
                                text = text
                                  .split("\n")
                                  .map((line) =>
                                    line.replace(/^[•·–—*-]\s*/gm, "- ")
                                  )
                                  .join("\n");
                                text = text.replace(/^-\s*(?=\S)/gm, "- ");
                              }
                              
                              const lines = text.split("\n");
                              
                              for (let i = 0; i < lines.length - 1; i++) {
                                const current = lines[i].trim();
                                const next = lines[i + 1].trim();
                              
                                const looksLikeHeading =
                                  current.length > 0 &&
                                  current.length < 60 &&
                                  !current.startsWith("-") &&
                                  !current.startsWith("*") &&
                                  !current.endsWith(".") &&
                                  /^- /.test(next);
                              
                                if (looksLikeHeading) {
                                  lines[i] = `### ${current}`;
                                }
                              }
                              
                              text = lines.join("\n");

                              const el = e.currentTarget;
                              const start = el.selectionStart ?? el.value.length;
                              const end = el.selectionEnd ?? el.value.length;

                              const before = el.value.slice(0, start);
                              const after = el.value.slice(end);

                              const nextValue = before + text + after;

                              updateBlock(currentPage!.pageId, idx, { content: nextValue });

                              setTimeout(() => {
                                try {
                                  el.focus();
                                  const pos = start + text.length;
                                  el.setSelectionRange(pos, pos);
                                } catch {}
                              }, 0);
                            }}
                            placeholder="Write markdown here... (images/videos you upload will be inserted at your cursor)"
                            rows={6}
                            style={{
                              width: "100%",
                              marginTop: 10,
                              padding: "10px 12px",
                              borderRadius: 12,
                              border: "2px solid rgba(0,0,0,0.14)",
                              resize: "vertical",
                              fontFamily:
                                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                              background: "white",
                            }}
                          />
                          
                          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 13 }}>
                            Tip: paste from Word/Google Docs — bullets (•) become <b>- lists</b>, and headings above bullets become <b>### headings</b>.
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      background: "white",
                      borderRadius: 14,
                      padding: 14,
                      boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                      border: "2px solid rgba(0,0,0,0.16)",
                    }}
                  >
                    <div style={{ fontWeight: 900, marginBottom: 10 }}>Checkpoint</div>

                    <label style={{ display: "block" }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>Question</div>
                      <input
                        value={safeStr(currentPage?.checkpoint?.question, "")}
                        onChange={(e) =>
                          updateCheckpoint(currentPage!.pageId, { question: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "2px solid rgba(0,0,0,0.14)",
                        }}
                      />
                    </label>

                    <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[0, 1, 2, 3].map((i) => (
                        <label key={i} style={{ display: "block" }}>
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>Option {i + 1}</div>
                          <input
                            value={safeStr(currentPage?.checkpoint?.options?.[i], "")}
                            onChange={(e) =>
                              updateCheckpointOption(currentPage!.pageId, i, e.target.value)
                            }
                            style={{
                              width: "100%",
                              padding: "10px 12px",
                              borderRadius: 10,
                              border: "2px solid rgba(0,0,0,0.14)",
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <label style={{ display: "block", marginTop: 10 }}>
                      <div style={{ fontWeight: 800, marginBottom: 6 }}>
                        Answer (text must match one option)
                      </div>
                      <input
                        value={safeStr(currentPage?.checkpoint?.answer, "")}
                        onChange={(e) =>
                          updateCheckpoint(currentPage!.pageId, { answer: e.target.value })
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "2px solid rgba(0,0,0,0.14)",
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </main>

            <aside
              style={{
                position: "sticky",
                top: 16,
                alignSelf: "start",
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                  border: "2px solid rgba(0,0,0,0.16)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8, color: "#111827" }}>
                  Preview
                </div>
                <div style={{ color: "#6b7280", fontSize: "0.92rem" }}>
                  This is how the current page will render.
                </div>
              </div>

              {pagesReady ? (
                <div style={previewBox}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    {currentPage?.title || `Page ${currentPage?.order}`}
                  </div>

                  {(currentPage?.blocks || []).map((b, idx) => {
                    const meta = BLOCK_META[b.type];
                    return (
                      <div key={`${currentPage!.pageId}_prev_${idx}`} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 900, marginBottom: 6, color: "#111827" }}>
                          {meta.icon} {meta.label}
                        </div>
                        <div style={getBlockStyle(b.type)}>
                          <ReactMarkdown components={markdownComponents as any}>
                            {safeStr(b.content, "")}
                          </ReactMarkdown>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={previewBox}>
                  <div style={{ fontWeight: 900, marginBottom: 6 }}>No page selected</div>
                  <div style={{ color: "#6b7280" }}>Add/select a page to see preview.</div>
                </div>
              )}
            </aside>
          </div>

          <div style={{
            gridColumn: "1 / -1",
            marginTop: "30px",
            background: "white",
            borderRadius: "14px",
            padding: "20px",
            boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
            border: "2px solid rgba(0,0,0,0.16)"
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "20px"
            }}>
              <h2 style={{ margin: 0 }}>Revision Materials</h2>
              
              <button
                onClick={handleAIGenerate}
                disabled={isGenerating}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  opacity: isGenerating ? 0.7 : 1,
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {isGenerating ? 'Generating...' : '✨ Generate with AI'}
              </button>
            </div>
            
            <div style={{ 
              display: "flex", 
              gap: "10px", 
              marginBottom: "20px",
              borderBottom: "2px solid #e5e7eb",
              paddingBottom: "10px"
            }}>
              <button
                onClick={() => setRevisionTab("flashcards")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: revisionTab === "flashcards" ? "#3b82f6" : "#f3f4f6",
                  color: revisionTab === "flashcards" ? "white" : "#374151",
                  cursor: "pointer",
                  fontWeight: revisionTab === "flashcards" ? "bold" : "normal"
                }}
              >
                Flashcards ({flashcards.length})
              </button>
              <button
                onClick={() => setRevisionTab("quizzes")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: revisionTab === "quizzes" ? "#3b82f6" : "#f3f4f6",
                  color: revisionTab === "quizzes" ? "white" : "#374151",
                  cursor: "pointer",
                  fontWeight: revisionTab === "quizzes" ? "bold" : "normal"
                }}
              >
                Quiz Questions ({quizQuestions.length})
              </button>
            </div>
            
            <div style={{
              marginBottom: "30px",
              background: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsFlashcardsCollapsed(!isFlashcardsCollapsed)}
                style={{
                  padding: "15px 20px",
                  background: "#e2e8f0",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <h3 style={{ margin: 0, color: "#1e293b" }}>
                  Flashcards (SS2/SS3)
                </h3>
                <span style={{ fontSize: "20px" }}>
                  {isFlashcardsCollapsed ? "▶" : "▼"}
                </span>
              </div>
              
              {!isFlashcardsCollapsed && (
                <div style={{ padding: "20px" }}>
                  {revisionTab === "flashcards" && (
                    <FlashcardsEditor
                      lessonId={id || ""}
                      initialCards={lesson?.flashcards || []}
                      onSaved={() => fetchLessonSmart()}
                      isAdmin={isAdmin}
                    />
                  )}
                </div>
              )}
            </div>
            
            <div style={{
              background: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              overflow: "hidden"
            }}>
              <div 
                onClick={() => setIsQuizCollapsed(!isQuizCollapsed)}
                style={{
                  padding: "15px 20px",
                  background: "#e2e8f0",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <h3 style={{ margin: 0, color: "#1e293b" }}>
                  Quiz Questions (Test Yourself)
                </h3>
                <span style={{ fontSize: "20px" }}>
                  {isQuizCollapsed ? "▶" : "▼"}
                </span>
              </div>
              
              <div style={{ padding: 16, background: "#fff3cd", borderRadius: 8, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>Bulk paste quiz questions</strong>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={downloadQuizCSVTemplate}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #059669",
                        background: "#10b981",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title="Download CSV template for importing quiz questions"
                    >
                      📥 Download CSV Template
                    </button>
                    <button
                      onClick={triggerCSVUpload}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #2563eb",
                        background: "#3b82f6",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                      title="Upload CSV file with quiz questions"
                    >
                      📤 Upload CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setExamBulkText("")}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleSimpleQuizBulkUpload}
                      style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #2563eb", background: "#2563eb", color: "#fff", cursor: "pointer" }}
                    >
                      Import (structured blocks)
                    </button>
                    <button
                      type="button"
                      onClick={cleanupBadQuizEntries}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Clean up bad entries
                    </button>
                    <button
                      type="button"
                      onClick={saveQuizQuestions}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid #2563eb",
                        background: "#2563eb",
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Save quiz questions
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                  Paste questions separated by blank lines. Supports TYPE:, MARKS:, TAGS:, ANSWER:, EXPLANATION:, MARKSCHEME:, and MCQ options A) ... B) ... etc.
                </div>

                <textarea
                  value={examBulkText}
                  onChange={(e) => setExamBulkText(e.target.value)}
                  rows={6}
                  placeholder={`Example:
State one difference between prokaryotic and eukaryotic cells.
ANSWER: Eukaryotic cells have a nucleus, whereas prokaryotic cells do not.
MARKS: 1
TAGS: cells, prokaryotes, eukaryotes
MARKSCHEME: Identify nucleus presence, Compare cell types, State key difference

What is the powerhouse of the cell?
A) Nucleus
B) Mitochondria
C) Ribosome
D) Endoplasmic reticulum
ANSWER: B
EXPLANATION: Mitochondria generate most of the cell's ATP.
TYPE: mcq
MARKS: 2
TAGS: biology, cells
MARKSCHEME: Recall organelle function, Identify energy production site`}
                  style={{
                    width: "100%",
                    marginTop: 10,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    padding: 10,
                    resize: "vertical",
                    background: "#fff",
                    fontFamily: "monospace",
                    fontSize: "13px"
                  }}
                />
                
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800 }}>
                  Current quiz questions: {lesson?.quiz?.questions?.length ?? 0}
                </div>
              </div>

              {/* CSV Import Preview Panel */}
              {csvImportData.previewVisible && csvImportData.parsedQuestions.length > 0 && (
                <div style={{
                  margin: "12px",
                  padding: "16px",
                  background: "#f0f9ff",
                  border: "2px solid #0ea5e9",
                  borderRadius: "10px"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    marginBottom: "12px"
                  }}>
                    <h4 style={{ margin: 0, color: "#0369a1" }}>
                      📋 CSV Import Preview
                    </h4>
                    <button
                      onClick={cancelCSVImport}
                      style={{
                        padding: "4px 8px",
                        background: "transparent",
                        border: "1px solid #94a3b8",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ color: "#475569", fontWeight: 600 }}>
                      Rows parsed: <span style={{ color: "#059669", fontWeight: 800 }}>{csvImportData.rowsParsed}</span>
                    </div>
                    <div style={{ color: "#475569", fontWeight: 600 }}>
                      Rows skipped: <span style={{ color: "#dc2626", fontWeight: 800 }}>{csvImportData.rowsSkipped}</span>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ fontWeight: 700, marginBottom: "8px", color: "#334155" }}>
                      Preview (first {Math.min(5, csvImportData.parsedQuestions.length)} questions):
                    </div>
                    <div style={{ 
                      maxHeight: "200px", 
                      overflowY: "auto",
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      padding: "12px"
                    }}>
                      {csvImportData.parsedQuestions.slice(0, 5).map((q, idx) => (
                        <div key={idx} style={{ 
                          padding: "8px",
                          borderBottom: idx < 4 ? "1px solid #f1f5f9" : "none",
                          fontSize: "13px"
                        }}>
                          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "2px" }}>
                            {q.question.length > 60 ? q.question.substring(0, 60) + "..." : q.question}
                          </div>
                          <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#64748b" }}>
                            <span>Type: {q.type}</span>
                            <span>Marks: {q.marks}</span>
                            <span>Tags: {q.tags?.join(", ") || "none"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                    <button
                      onClick={cancelCSVImport}
                      style={{
                        padding: "8px 16px",
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyCSVImport}
                      style={{
                        padding: "8px 16px",
                        background: "#059669",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600
                      }}
                    >
                      Apply Import ({csvImportData.parsedQuestions.length} questions)
                    </button>
                  </div>
                  
                  <div style={{
                    marginTop: "12px",
                    padding: "8px",
                    background: "#dbeafe",
                    border: "1px solid #60a5fa",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#1e40af"
                  }}>
                    <strong>🔒 Security Note:</strong> CSV import can only add questions. 
                    Deleting existing questions is admin-only and enforced server-side.
                  </div>
                </div>
              )}

              {/* Hidden CSV file input */}
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={handleCSVUpload}
              />

              <div style={{ marginTop: 12, background: "#fff", border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontWeight: 900 }}>
                    Existing Quiz Questions ({lesson?.quiz?.questions?.length ?? 0})
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowQuizList((v) => !v)}
                    style={{
                      border: "1px solid #d1d5db",
                      background: "#ffffff",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontWeight: 900,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {showQuizList ? "Hide" : "Show"}
                  </button>
                </div>

                {showQuizList && (
                  <div style={{ display: "grid", gap: 10 }}>
                    {(lesson?.quiz?.questions ?? []).map((q: any) => (
                      <div
                        key={q.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>{q.question}</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                            <span>Type: {q.type}</span>
                            <span>Difficulty: {q.difficulty ?? 1}/3</span>
                            <span>Marks: {q.marks ?? 1}</span>
                            {(q.tags || []).length ? <span>Tags: {(q.tags || []).join(", ")}</span> : null}
                            {(q.markScheme || []).length ? <span>Mark Scheme: {q.markScheme.length} points</span> : null}
                          </div>
                          
                          {/* ✅ MARK PREVIEW SECTION */}
                          <div style={{ marginTop: 12 }}>
                            <button
                              type="button"
                              onClick={() => toggleMarkPreview(q.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                background: "transparent",
                                border: "none",
                                color: "#2563eb",
                                cursor: "pointer",
                                fontWeight: 900,
                                fontSize: 14,
                                padding: 0,
                              }}
                            >
                              {expandedPreviews.has(q.id) ? "▼" : "▶"} Mark Preview
                            </button>
                            
                            {expandedPreviews.has(q.id) && (
                              <div style={{
                                marginTop: 10,
                                padding: 12,
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                borderRadius: 8,
                                fontSize: 14,
                              }}>
                                <div style={{ fontWeight: 900, marginBottom: 8, color: "#1e293b" }}>
                                  Marking Preview
                                </div>
                                
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 800, color: "#475569" }}>Correct Answer: </span>
                                  <span>{q.correctAnswer || "(No answer provided)"}</span>
                                </div>
                                
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 800, color: "#475569" }}>Mark Scheme: </span>
                                  {q.markScheme && q.markScheme.length > 0 ? (
                                    <ul style={{ margin: "6px 0 6px 16px", padding: 0 }}>
                                      {q.markScheme.map((point: string, idx: number) => (
                                        <li key={idx} style={{ marginBottom: 4 }}>
                                          {point}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span style={{ color: "#64748b", fontStyle: "italic" }}>
                                      (Auto-generated at marking time)
                                    </span>
                                  )}
                                </div>
                                
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontWeight: 800, color: "#475569" }}>Marks: </span>
                                  <span>{q.marks ?? 1}</span>
                                </div>
                                
                                {!q.markScheme?.length && q.correctAnswer && (
                                  <div style={{
                                    marginTop: 10,
                                    padding: 8,
                                    background: "#fef3c7",
                                    border: "1px solid #fbbf24",
                                    borderRadius: 6,
                                    fontSize: 13,
                                    color: "#92400e"
                                  }}>
                                    📝 <strong>Note:</strong> Marks will be split into 1-mark points from the answer at marking time.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ✅ ADMIN-ONLY DELETE BUTTON FOR QUIZ QUESTIONS */}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setLesson((prev: any) => {
                                const prevQs = prev?.quiz?.questions ?? [];
                                return {
                                  ...prev,
                                  quiz: {
                                    ...(prev.quiz || {}),
                                    questions: prevQs.filter((x: any) => String(x.id) !== String(q.id)),
                                  },
                                };
                              });
                            }}
                            style={{
                              border: "1px solid #ef4444",
                              background: "#fee2e2",
                              color: "#b91c1c",
                              borderRadius: 8,
                              padding: "6px 10px",
                              cursor: "pointer",
                              fontWeight: 900,
                              opacity: 1,
                            }}
                            title="Delete quiz question"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {!isQuizCollapsed && (
                <div style={{ padding: "20px" }}>
                  {revisionTab === "quizzes" && (
                    <div>
                      <div style={{
                        background: "#fef3c7",
                        padding: "15px",
                        borderRadius: "10px",
                        marginBottom: "20px",
                        border: "1px solid #fbbf24"
                      }}>
                        <h3 style={{ marginTop: 0, marginBottom: "15px", color: "#92400e" }}>
                          📥 Bulk Upload Exam Questions
                        </h3>
                        <div style={{ marginBottom: "10px" }}>
                          <p style={{ margin: "0 0 10px 0", color: "#78350f" }}>
                            Paste multiple exam questions at once. Each question should be on a new line.
                            For structured questions, use this format:
                          </p>
                          <div style={{
                            background: "#fffbeb",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px dashed #d97706",
                            marginBottom: "10px",
                            fontSize: "13px",
                            color: "#78350f"
                          }}>
                            <strong>Example format:</strong><br/>
                            What is the capital of France?<br/>
                            A) London<br/>
                            B) Berlin<br/>
                            C) Paris<br/>
                            D) Madrid<br/>
                            Answer: C<br/>
                            Explanation: Paris is the capital city of France.<br/>
                            MARKSCHEME: Identify country, Recall capital, Select correct option<br/>
                            <br/>
                            Who wrote "Romeo and Juliet"?<br/>
                            Answer: William Shakespeare<br/>
                            Explanation: Shakespeare wrote this famous play in the late 16th century.<br/>
                            MARKSCHEME: Recall author, Identify play, Name correct playwright
                          </div>
                        </div>
                        <textarea
                          value={examBulkText}
                          onChange={(e) => setExamBulkText(e.target.value)}
                          placeholder="Paste your exam questions here, one per line or in the structured format shown above..."
                          rows={6}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "6px",
                            border: "1px solid #d1d5db",
                            marginBottom: "10px",
                            fontFamily: "monospace",
                            fontSize: "14px"
                          }}
                        />
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            onClick={handleStructuredBulkUpload}
                            disabled={!examBulkText.trim()}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#d97706",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: !examBulkText.trim() ? "not-allowed" : "pointer",
                              opacity: !examBulkText.trim() ? 0.5 : 1,
                              fontWeight: "bold",
                              flex: 1
                            }}
                          >
                            Upload Structured Questions
                          </button>
                          <button
                            onClick={handleBulkUpload}
                            disabled={!examBulkText.trim()}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: !examBulkText.trim() ? "not-allowed" : "pointer",
                              opacity: !examBulkText.trim() ? 0.5 : 1,
                              fontWeight: "bold",
                              flex: 1
                            }}
                          >
                            Upload Simple Questions
                          </button>
                          <button
                            onClick={() => setExamBulkText("")}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#6b7280",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "bold"
                            }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div style={{
                        background: "#ffffff",
                        padding: "15px",
                        borderRadius: "10px",
                        marginBottom: "20px",
                        border: "1px solid #e2e8f0"
                      }}>
                        <h3 style={{ marginTop: 0, marginBottom: "15px" }}>Add New Quiz Question</h3>
                        <div style={{ display: "grid", gap: "10px" }}>
                          <div>
                            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                              Question Type
                            </label>
                            <select
                              value={newQuizQuestion.type}
                              onChange={(e) => setNewQuizQuestion({
                                ...newQuizQuestion, 
                                type: e.target.value as "mcq" | "short" | "exam",
                                options: e.target.value === "mcq" ? ["", "", "", ""] : []
                              })}
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db"
                              }}
                            >
                              <option value="mcq">Multiple Choice (MCQ)</option>
                              <option value="short">Short Answer</option>
                              <option value="exam">Exam Style</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                              Question
                            </label>
                            <textarea
                              value={newQuizQuestion.question}
                              onChange={(e) => setNewQuizQuestion({...newQuizQuestion, question: e.target.value})}
                              rows={3}
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db"
                              }}
                              placeholder="Enter the question..."
                            />
                          </div>
                          
                          {newQuizQuestion.type === "mcq" && (
                            <div>
                              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                                Options
                              </label>
                              {newQuizQuestion.options.map((option, index) => (
                                <div key={index} style={{ marginBottom: "8px" }}>
                                  <input
                                    type="text"
                                    value={option}
                                    onChange={(e) => {
                                      const newOptions = [...newQuizQuestion.options];
                                      newOptions[index] = e.target.value;
                                      setNewQuizQuestion({...newQuizQuestion, options: newOptions});
                                    }}
                                    placeholder={`Option ${index + 1}`}
                                    style={{
                                      width: "100%",
                                      padding: "8px",
                                      borderRadius: "6px",
                                      border: "1px solid #d1d5db"
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div>
                            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                              Correct Answer
                            </label>
                            <input
                              type="text"
                              value={newQuizQuestion.correctAnswer}
                              onChange={(e) => setNewQuizQuestion({...newQuizQuestion, correctAnswer: e.target.value})}
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db"
                              }}
                              placeholder="Enter the correct answer..."
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                              Explanation (Optional)
                            </label>
                            <textarea
                              value={newQuizQuestion.explanation}
                              onChange={(e) => setNewQuizQuestion({...newQuizQuestion, explanation: e.target.value})}
                              rows={2}
                              style={{
                                width: "100%",
                                padding: "8px",
                                borderRadius: "6px",
                                border: "1px solid #d1d5db"
                              }}
                              placeholder="Explain why this answer is correct..."
                            />
                          </div>
                          
                          <button
                            onClick={handleAddQuizQuestion}
                            style={{
                              padding: "8px 16px",
                              backgroundColor: "#3b82f6",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontWeight: "bold"
                            }}
                          >
                            Add Quiz Question
                          </button>
                        </div>
                      </div>
                      
                      <div style={{
                        padding: "20px",
                        textAlign: "center",
                        color: "#6b7280",
                        border: "2px dashed #d1d5db",
                        borderRadius: "10px"
                      }}>
                        ✅ Quiz questions are managed in the "Existing Quiz Questions" section above.
                        <br />
                        <strong>🔒 Security Note:</strong> Teachers can only add new questions. 
                        Deleting existing questions is admin-only and enforced server-side.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditLessonPage;