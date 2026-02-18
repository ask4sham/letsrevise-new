import React, { useMemo, useEffect, useState, useRef } from "react";
import { useParams, Link, useSearchParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabaseClient";
import api, { listVisuals, getVisualById } from "../services/api";
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
  content?: string;
  /** Checkpoint block fields (when type === "checkpoint") */
  prompt?: string;
  questionType?: "mcq" | "short";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  /** Diagram block fields (when type === "diagram") */
  visualId?: string;
  caption?: string;
  /** PR11: diagram depth */
  mode?: "static" | "annotated" | "step";
  annotations?: Array<{ id: string; kind?: "label" | "callout"; text?: string; x?: number; y?: number; color?: string; align?: "left" | "center" | "right" }>;
  steps?: Array<{ id: string; title?: string; showAnnotationIds?: string[] }>;
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

/** PR7: readiness from backend (computed) */
interface LessonReadiness {
  status: "DRAFT" | "NEEDS_REVIEW" | "READY";
  score?: number;
  signals?: {
    hasCheckpoints?: boolean;
    checkpointCount?: number;
    hasDiagrams?: boolean;
    diagramCount?: number;
    hasPracticeQuestions?: boolean;
    practiceCount?: number;
    isReviewed?: boolean;
    missing?: string[];
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
  examBoardName: string | null;
  teacherName: string;
  teacherId: string;
  estimatedDuration: number;
  shamCoinPrice: number;
  isFreePreview?: boolean;
  isPublished: boolean;
  status?: string;
  /** GCSE tier: foundation | higher (PR21 diagram defaults) */
  tier?: string;
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
  /** PR7 */
  readiness?: LessonReadiness;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
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
  const [diagramPickerTarget, setDiagramPickerTarget] = useState<{ pageId: string; blockIndex: number } | null>(null);
  const [visualsList, setVisualsList] = useState<Array<{ _id: string; conceptKey: string; topic?: string }>>([]);

  const [attachedExamQuestions, setAttachedExamQuestions] = useState<Array<{ _id: string; question: string; type?: string; marks?: number; topicKey?: string; topic?: string }>>([]);
  const [addFromBankModalOpen, setAddFromBankModalOpen] = useState(false);
  const [taxonomyUnits, setTaxonomyUnits] = useState<Array<{ unit: string; topics: { topic: string; key: string }[] }>>([]);
  const [bankTopicKey, setBankTopicKey] = useState("");
  const [bankQuestions, setBankQuestions] = useState<Array<{ _id: string; question: string; type?: string; marks?: number; topicKey?: string }>>([]);
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<Set<string>>(new Set());
  const [autoAttachLoading, setAutoAttachLoading] = useState(false);
  const [autoAttachLimit, setAutoAttachLimit] = useState(10);
  const [autoAttachMessage, setAutoAttachMessage] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  /** PR13.1: Misconceptions panel (question insights in editor) */
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [misconceptionItems, setMisconceptionItems] = useState<Array<{
    questionId: string;
    question?: string;
    marks?: number;
    topicKey?: string;
    topic?: string;
    type?: string;
    attempts: number;
    correct: number;
    wrong: number;
    accuracy: number | null;
    highConfidenceWrong: number;
    avgConfidence?: number;
  }>>([]);
  const [hotspotTopics, setHotspotTopics] = useState<Array<{
    topicKey: string;
    topic?: string;
    attempts: number;
    wrong: number;
    correct: number;
    highConfidenceWrong: number;
  }>>([]);
  const [insightsDays, setInsightsDays] = useState(7);
  const [attachToast, setAttachToast] = useState<string | null>(null);
  const [attachByTopicToast, setAttachByTopicToast] = useState<string | null>(null);
  const [attachingQuestionId, setAttachingQuestionId] = useState<string | null>(null);
  const [attachingTopicKey, setAttachingTopicKey] = useState<string | null>(null);
  /** PR16: One-click fix (attach + regenerate plan) loading and per-topic error */
  const [fixingTopicKey, setFixingTopicKey] = useState<string | null>(null);
  const [fixErrorByTopic, setFixErrorByTopic] = useState<Record<string, string>>({});
  /** PR17: Bulk fix top hotspots loading + error */
  const [bulkFixLoading, setBulkFixLoading] = useState(false);
  const [bulkFixError, setBulkFixError] = useState<string | null>(null);
  /** PR20: Publish gate modal + Make classroom-ready + Post-publish CTA */
  const [publishGateOpen, setPublishGateOpen] = useState(false);
  const [publishGateIssues, setPublishGateIssues] = useState<string[]>([]);
  const [postPublishClassroomModalOpen, setPostPublishClassroomModalOpen] = useState(false);
  const [makeClassroomReadyLoading, setMakeClassroomReadyLoading] = useState(false);
  const [makeClassroomReadyError, setMakeClassroomReadyError] = useState<string | null>(null);
  /** PR20.1: Copy student link feedback */
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);
  /** PR14/PR15: Reteach plan in sidebar (latest plan for lesson) */
  const [reteachPlan, setReteachPlan] = useState<{ content: string; pinned: boolean; generatedAt?: string; days?: number; studentSummary?: string } | null>(null);
  const [reteachPlanLoading, setReteachPlanLoading] = useState(false);
  const [reteachPlanGenerateLoading, setReteachPlanGenerateLoading] = useState(false);
  /** PR8: diagram suggestions when lesson has no diagrams */
  const [diagramSuggestionsLoading, setDiagramSuggestionsLoading] = useState(false);
  const [diagramSuggestionsError, setDiagramSuggestionsError] = useState<string | null>(null);
  const [diagramSuggestions, setDiagramSuggestions] = useState<Array<{ id: string; conceptKey: string; title: string; subject?: string; level?: string; examBoard?: string; imageUrl?: string; isPublished?: boolean }>>([]);
  const [diagramAddedHint, setDiagramAddedHint] = useState(false);

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

  /** PR11.1: drag-to-position diagram annotations */
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [placeMode, setPlaceMode] = useState(false);
  const [diagramPreviewUrls, setDiagramPreviewUrls] = useState<Record<string, string>>({});
  /** PR11.2: nudge step 1% | 2% | 5% */
  const [nudgeStepPct, setNudgeStepPct] = useState(2);
  const diagramRef = useRef<Record<string, HTMLDivElement | null>>({});
  /** Ref for "Edit diagram" scroll-into-view (teacher note + affordance) */
  const diagramBlockContainerRef = useRef<Record<string, HTMLDivElement | null>>({});
  const draggingIdRef = useRef<string | null>(null);
  const draggingPageIdRef = useRef<string | null>(null);
  const draggingBlockIndexRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!diagramPickerTarget) {
      setVisualsList([]);
      return;
    }
    listVisuals("Biology")
      .then((res: any) => {
        const list = Array.isArray(res?.data?.visuals) ? res.data.visuals : [];
        setVisualsList(list.map((v: any) => ({ _id: String(v._id), conceptKey: String(v.conceptKey || ""), topic: v.topic })));
      })
      .catch(() => setVisualsList([]));
  }, [diagramPickerTarget]);

  useEffect(() => {
    if (!id || !lesson) return;
    api.get(`/lessons/${id}/exam-questions`).then((res: any) => {
      setAttachedExamQuestions(Array.isArray(res?.data?.questions) ? res.data.questions : []);
    }).catch(() => setAttachedExamQuestions([]));
  }, [id, lesson?.id]);

  /** PR13.1: Fetch question insights when lesson id present and user is teacher/admin */
  useEffect(() => {
    const canSeeInsights = userType === "teacher" || userType === "admin";
    if (!id || !canSeeInsights) {
      setMisconceptionItems([]);
      setHotspotTopics([]);
      setInsightsError(null);
      return;
    }
    let cancelled = false;
    setInsightsLoading(true);
    setInsightsError(null);
    api
      .get<{ ok: boolean; items?: typeof misconceptionItems; topics?: typeof hotspotTopics }>(
        `/reports/lessons/${id}/question-insights`,
        { params: { days: insightsDays, limit: 10 } }
      )
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.ok) {
          setMisconceptionItems(Array.isArray(res.data.items) ? res.data.items : []);
          setHotspotTopics(Array.isArray(res.data.topics) ? res.data.topics : []);
        }
      })
      .catch((e: any) => {
        if (cancelled) return;
        const status = e?.response?.status;
        const msg = e?.response?.data?.error ?? e?.message ?? "Failed to load insights";
        setInsightsError(status === 403 ? "Insights are only available to the lesson owner." : msg);
        setMisconceptionItems([]);
        setHotspotTopics([]);
      })
      .finally(() => {
        if (!cancelled) setInsightsLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, userType, insightsDays]);

  /** PR14: Fetch latest reteach plan for sidebar (teacher/admin only) */
  useEffect(() => {
    const canSee = userType === "teacher" || userType === "admin";
    if (!id || !canSee) {
      setReteachPlan(null);
      return;
    }
    let cancelled = false;
    setReteachPlanLoading(true);
    api
      .get<{ ok: boolean; plan?: { content: string; pinned: boolean; generatedAt?: string; days?: number } }>(
        `/reports/lessons/${id}/reteach-plan`
      )
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.ok && res.data.plan) setReteachPlan(res.data.plan);
        else setReteachPlan(null);
      })
      .catch(() => {
        if (!cancelled) setReteachPlan(null);
      })
      .finally(() => {
        if (!cancelled) setReteachPlanLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, userType]);

  useEffect(() => {
    if (!addFromBankModalOpen) return;
    api.get("/taxonomy/aqa-gcse-biology").then((res: any) => {
      setTaxonomyUnits(Array.isArray(res?.data?.units) ? res.data.units : []);
    }).catch(() => setTaxonomyUnits([]));
  }, [addFromBankModalOpen]);

  useEffect(() => {
    if (!addFromBankModalOpen) return;
    if (!bankTopicKey) {
      setBankQuestions([]);
      return;
    }
    api.get("/exam-questions", { params: { topicKey: bankTopicKey } }).then((res: any) => {
      setBankQuestions(Array.isArray(res?.data?.questions) ? res.data.questions : []);
      setSelectedBankQuestionIds(new Set());
    }).catch(() => setBankQuestions([]));
  }, [addFromBankModalOpen, bankTopicKey]);

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
        examBoardName: (data.examBoard ?? data.board) ? safeStr((data.examBoard ?? data.board) as string, "") : null,
        teacherName: safeStr(data.teacherName, "Teacher"),
        teacherId: safeStr(data.teacherId?._id || data.teacherId, ""),
        estimatedDuration: Number.isFinite(Number(data.estimatedDuration))
          ? Number(data.estimatedDuration)
          : 0,
        shamCoinPrice: Number.isFinite(Number(data.shamCoinPrice))
          ? Number(data.shamCoinPrice)
          : 0,
        isFreePreview: Boolean(data.isFreePreview),
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
        readiness: data.readiness ?? undefined,
        reviewedAt: data.reviewedAt ?? undefined,
        reviewedBy: data.reviewedBy ?? undefined,
        tier: typeof data.tier === "string" ? data.tier : undefined,
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
            ? (p as any).blocks.map((b: any) => {
                if (b?.type === "checkpoint") {
                  return {
                    type: "checkpoint" as const,
                    prompt: safeStr(b.prompt, ""),
                    questionType: b?.questionType === "short" ? "short" : "mcq",
                    options: Array.isArray(b.options)
                      ? b.options.map((o: any) => String(o ?? ""))
                      : ["", "", "", ""],
                    correctAnswer: safeStr(b.correctAnswer, ""),
                    explanation: safeStr(b.explanation, ""),
                  };
                }
                if (b?.type === "diagram") {
                  const mode = b.mode === "annotated" || b.mode === "step" ? b.mode : "static";
                  const annotations = Array.isArray(b.annotations) ? b.annotations.map((a: any) => ({
                    id: String(a?.id ?? ""),
                    kind: a?.kind === "callout" ? "callout" : "label",
                    text: typeof a?.text === "string" ? a.text : "",
                    x: typeof a?.x === "number" ? a.x : 0.5,
                    y: typeof a?.y === "number" ? a.y : 0.5,
                    color: typeof a?.color === "string" ? a.color : "",
                    align: a?.align === "left" || a?.align === "right" ? a.align : "center",
                  })) : [];
                  const steps = Array.isArray(b.steps) ? b.steps.map((s: any) => ({
                    id: String(s?.id ?? ""),
                    title: typeof s?.title === "string" ? s.title : "",
                    showAnnotationIds: Array.isArray(s?.showAnnotationIds) ? s.showAnnotationIds.map((id: any) => String(id)) : [],
                  })) : [];
                  return {
                    type: "diagram" as const,
                    visualId: b.visualId != null ? String(b.visualId) : "",
                    caption: safeStr(b.caption, ""),
                    mode,
                    annotations,
                    steps,
                  };
                }
                return {
                  type: normalizeBlockType(b?.type),
                  content: safeStr(b?.content, ""),
                };
              })
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
        isFreePreview: false,
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

  /** PR11.1: clamp number to [min, max] */
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  /** PR11.1: get normalized 0..1 point from pointer/mouse event relative to container */
  const getNormalizedPointFromEvent = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    return { x, y };
  };
  /** PR11.1: update one annotation's x/y (or other fields) in a diagram block */
  const updateDiagramAnnotation = (
    pageId: string,
    blockIndex: number,
    annId: string,
    patch: Partial<{ x: number; y: number }>
  ) => {
    const clamp01 = (v: number) => clamp(v, 0, 1);
    setLesson((prev) => {
      if (!prev?.pages) return prev;
      const pages = prev.pages.map((p) => ({ ...p }));
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const page = pages[pIdx];
      const blocks = Array.isArray(page.blocks) ? [...page.blocks] : [];
      const block = blocks[blockIndex];
      if (!block || block.type !== "diagram" || !Array.isArray(block.annotations)) return prev;
      const annotations = block.annotations.map((a) => {
        if (a.id !== annId) return a;
        const next = { ...a };
        if (typeof patch.x === "number") next.x = clamp01(patch.x);
        if (typeof patch.y === "number") next.y = clamp01(patch.y);
        return next;
      });
      blocks[blockIndex] = { ...block, annotations };
      pages[pIdx] = { ...page, blocks };
      return { ...prev, pages };
    });
  };

  /** PR11.2: reduce overlap between annotations (normalized 0..1), returns new array */
  const autoSpreadAnnotations = (
    anns: Array<{ id: string; text?: string; x?: number; y?: number; [k: string]: unknown }>
  ): Array<{ id: string; text?: string; x?: number; y?: number; [k: string]: unknown }> => {
    const out = anns.map((a) => ({ ...a, x: typeof a.x === "number" ? a.x : 0.5, y: typeof a.y === "number" ? a.y : 0.5 }));
    const clamp01 = (v: number) => clamp(v, 0, 1);
    const dist2 = (i: number, j: number) => {
      const dx = out[i].x! - out[j].x!;
      const dy = out[i].y! - out[j].y!;
      return dx * dx + dy * dy;
    };
    for (let iter = 0; iter < 20; iter++) {
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          if (dist2(i, j) >= 0.003) continue;
          const dx = out[i].x! - out[j].x!;
          const dy = out[i].y! - out[j].y!;
          const push = 0.01;
          out[i].x = clamp01(out[i].x! + push * dx);
          out[i].y = clamp01(out[i].y! + push * dy);
          out[j].x = clamp01(out[j].x! - push * dx);
          out[j].y = clamp01(out[j].y! - push * dy);
        }
      }
    }
    return out;
  };

  /** PR11.1: fetch diagram image URLs for blocks that have visualId */
  useEffect(() => {
    if (!lesson?.pages) return;
    const level = lesson?.level ?? "GCSE";
    let cancelled = false;
    (async () => {
      for (const page of lesson.pages ?? []) {
        for (const b of page.blocks ?? []) {
          if (b?.type !== "diagram" || !b.visualId) continue;
          const vid = String(b.visualId);
          if (diagramPreviewUrls[vid]) continue;
          try {
            const res = await getVisualById(vid, level);
            if (cancelled) return;
            const url = res?.data?.visual?.src;
            if (url && typeof url === "string")
              setDiagramPreviewUrls((prev) => (prev[vid] ? prev : { ...prev, [vid]: url }));
          } catch {
            /* ignore */
          }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [lesson?.pages, lesson?.level]);

  const addBlock = (pageId: string, type: LessonBlockType) => {
    setLesson((prev) => {
      if (!prev) return prev;
      const pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
      const pIdx = pages.findIndex((p) => String(p.pageId) === String(pageId));
      if (pIdx < 0) return prev;
      const blocks = Array.isArray(pages[pIdx].blocks)
        ? [...(pages[pIdx].blocks as any[])]
        : [];
      if (type === "checkpoint") {
        blocks.push({
          type: "checkpoint",
          prompt: "",
          questionType: "mcq",
          options: ["", "", "", ""],
          correctAnswer: "",
          explanation: "",
        });
      } else if (type === "diagram") {
        blocks.push({
          type: "diagram",
          visualId: "",
          caption: "",
          mode: "static",
          annotations: [],
          steps: [],
        });
      } else {
        blocks.push({ type, content: "" });
      }
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
        blocks: (p.blocks || []).map((b: any) => {
          if (b.type === "checkpoint") {
            const opts = Array.isArray(b.options) ? b.options.map((o: string) => String(o ?? "").trim()) : [];
            return {
              type: "checkpoint",
              prompt: String(b.prompt ?? "").trim(),
              questionType: b.questionType === "short" ? "short" : "mcq",
              options: opts,
              correctAnswer: String(b.correctAnswer ?? "").trim(),
              explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
            };
          }
          if (b.type === "diagram") {
            const mode = b.mode === "annotated" || b.mode === "step" ? b.mode : "static";
            const annotations = Array.isArray(b.annotations) ? b.annotations : [];
            const steps = Array.isArray(b.steps) ? b.steps : [];
            return {
              type: "diagram",
              visualId: b.visualId != null && String(b.visualId).trim() ? String(b.visualId).trim() : undefined,
              caption: b.caption != null ? String(b.caption).trim() : undefined,
              mode,
              annotations: annotations.length ? annotations : undefined,
              steps: steps.length ? steps : undefined,
            };
          }
          return {
            type: toLegacyBlockType(b.type),
            content: sanitizeTeacherMarkdown(String(b.content || "")),
          };
        }),
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
        isFreePreview: !!lesson.isFreePreview,
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

  /** PR20: Compute local publish issues for gate modal (checkpoints, diagrams, practice, reviewed). */
  function computeLocalPublishIssues(
    l: Lesson | null,
    attachedCount: number
  ): { issues: string[]; checkpointsCount: number; diagramsCount: number; practiceAttachedCount: number; notReviewed: boolean } {
    const pages = l?.pages ?? [];
    let checkpointsCount = 0;
    let diagramsCount = 0;
    for (const p of pages) {
      for (const b of p.blocks ?? []) {
        if (b?.type === "checkpoint") checkpointsCount++;
        if (b?.type === "diagram") diagramsCount++;
      }
    }
    const practiceAttachedCount = attachedCount;
    const notReviewed = !l?.reviewedAt;
    const issues: string[] = [];
    if (checkpointsCount === 0) issues.push("No checkpoints");
    if (diagramsCount === 0) issues.push("No diagrams");
    if (practiceAttachedCount === 0) issues.push("No practice questions attached");
    if (notReviewed) issues.push("Lesson not marked as reviewed");
    return { issues, checkpointsCount, diagramsCount, practiceAttachedCount, notReviewed };
  }

  const handlePublishToggle = async (skipGate?: boolean) => {
    if (!lesson || !id || !isMongoObjectId(id)) return;

    const newStatus = !lesson.isPublished;
    /** PR20: Readiness gate — when publishing, if issues exist open modal unless skipGate */
    if (newStatus && !skipGate) {
      const { issues } = computeLocalPublishIssues(lesson, attachedExamQuestions.length);
      if (issues.length > 0) {
        setPublishGateIssues(issues);
        setPublishGateOpen(true);
        return;
      }
    }

    if (lesson?.createdFromTemplate && !lesson.isPublished) {
      const ok = window.confirm(
        "This lesson was created from a template.\n\nHave you reviewed and customised it before publishing?"
      );
      if (!ok) return;
    }

    try {
      setPublishing(true);
      setSaveMsg("");

      const sanitizedPages = (lesson.pages || []).map((p: any) => ({
        ...p,
        blocks: (p.blocks || []).map((b: any) => {
          if (b.type === "checkpoint") {
            const opts = Array.isArray(b.options) ? b.options.map((o: string) => String(o ?? "").trim()) : [];
            return {
              type: "checkpoint",
              prompt: String(b.prompt ?? "").trim(),
              questionType: b.questionType === "short" ? "short" : "mcq",
              options: opts,
              correctAnswer: String(b.correctAnswer ?? "").trim(),
              explanation: b.explanation != null ? String(b.explanation).trim() : undefined,
            };
          }
          if (b.type === "diagram") {
            const mode = b.mode === "annotated" || b.mode === "step" ? b.mode : "static";
            const annotations = Array.isArray(b.annotations) ? b.annotations : [];
            const steps = Array.isArray(b.steps) ? b.steps : [];
            return {
              type: "diagram",
              visualId: b.visualId != null && String(b.visualId).trim() ? String(b.visualId).trim() : undefined,
              caption: b.caption != null ? String(b.caption).trim() : undefined,
              mode,
              annotations: annotations.length ? annotations : undefined,
              steps: steps.length ? steps : undefined,
            };
          }
          return {
            type: toLegacyBlockType(b.type),
            content: sanitizeTeacherMarkdown(String(b.content || "")),
          };
        }),
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
        isFreePreview: !!lesson.isFreePreview,
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
      if (newStatus) setPostPublishClassroomModalOpen(true);
      setPublishGateOpen(false);
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
              onClick={() => handlePublishToggle()}
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

                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 8,
                      border: "1px dashed #d0d7de",
                      background: "#f8fafc",
                    }}
                  >
                    <label style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <input
                        type="checkbox"
                        checked={!!lesson.isFreePreview}
                        onChange={(e) =>
                          updateLessonField("isFreePreview", e.target.checked)
                        }
                        style={{ marginTop: 4 }}
                      />

                      <div>
                        <div style={{ fontWeight: 600, display: "flex", gap: 6 }}>
                          🔓 Free preview
                        </div>

                        <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>
                          When enabled, non-subscribed students can view the first page
                          <strong> (no answers)</strong>.{" "}
                          Useful for increasing conversion from preview → subscription.
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* PR7: Readiness panel */}
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Readiness</div>
                    {(() => {
                      const r = lesson?.readiness;
                      const status = r?.status ?? "DRAFT";
                      const sig = r?.signals ?? {};
                      const isReviewed = !!lesson?.reviewedAt || sig.isReviewed;
                      return (
                        <>
                          <div style={{ marginBottom: 10 }}>
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
                          </div>
                          <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                            <li>Checkpoints: {sig.checkpointCount ?? 0}</li>
                            <li>Diagrams: {sig.diagramCount ?? 0}</li>
                            <li>Practice questions attached: {sig.practiceCount ?? 0}</li>
                            <li>Reviewed: {isReviewed ? "Yes" : "No"}</li>
                          </ul>
                          {/* PR20.1: When READY, show Open Classroom mode + Copy student link */}
                          {status === "READY" && (
                            <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                              <button
                                type="button"
                                disabled={!id}
                                onClick={() => id && navigate(`/teacher/classroom/${id}`)}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: 8,
                                  border: "2px solid #2563eb",
                                  background: "rgba(37,99,235,0.12)",
                                  color: "#2563eb",
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: id ? "pointer" : "not-allowed",
                                }}
                              >
                                Open Classroom mode
                              </button>
                              <button
                                type="button"
                                disabled={!id}
                                onClick={async () => {
                                  if (!id) return;
                                  const url = `${window.location.origin}/lesson/${id}`;
                                  try {
                                    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
                                      await navigator.clipboard.writeText(url);
                                    } else {
                                      const ta = document.createElement("textarea");
                                      ta.value = url;
                                      ta.style.position = "fixed";
                                      ta.style.opacity = "0";
                                      document.body.appendChild(ta);
                                      ta.select();
                                      document.execCommand("copy");
                                      document.body.removeChild(ta);
                                    }
                                    setCopyLinkFeedback(true);
                                    setTimeout(() => setCopyLinkFeedback(false), 2000);
                                  } catch (_) {
                                    setCopyLinkFeedback(false);
                                  }
                                }}
                                style={{
                                  padding: "8px 14px",
                                  borderRadius: 8,
                                  border: "2px solid #64748b",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  fontWeight: 700,
                                  fontSize: 13,
                                  cursor: id ? "pointer" : "not-allowed",
                                }}
                              >
                                Copy student link
                              </button>
                              {copyLinkFeedback && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>Copied</span>}
                            </div>
                          )}
                          <button
                            type="button"
                            disabled={reviewLoading}
                            onClick={async () => {
                              if (!id) return;
                              setReviewLoading(true);
                              try {
                                const res = await api.post(`/lessons/${id}/review`, {
                                  reviewed: !isReviewed,
                                });
                                const data = res?.data;
                                setLesson((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        readiness: data?.readiness ?? prev.readiness,
                                        reviewedAt: data?.reviewedAt !== undefined ? data.reviewedAt : prev.reviewedAt,
                                        reviewedBy: data?.reviewedBy !== undefined ? data.reviewedBy : prev.reviewedBy,
                                      }
                                    : prev
                                );
                              } finally {
                                setReviewLoading(false);
                              }
                            }}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 8,
                              border: isReviewed ? "2px solid #94a3b8" : "2px solid #22c55e",
                              background: isReviewed ? "#f1f5f9" : "rgba(34,197,94,0.12)",
                              cursor: reviewLoading ? "not-allowed" : "pointer",
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {reviewLoading ? "Updating…" : isReviewed ? "Unmark review" : "Mark as reviewed"}
                          </button>
                          {/* PR20: One-click Make classroom-ready */}
                          <div style={{ marginTop: 12 }}>
                            <button
                              type="button"
                              disabled={makeClassroomReadyLoading || !id}
                              onClick={async () => {
                                if (!id) return;
                                setMakeClassroomReadyError(null);
                                setMakeClassroomReadyLoading(true);
                                try {
                                  const res = await api.post<{
                                    ok: boolean;
                                    attach?: { added: number; addedIds?: string[] };
                                    diagram?: { status: string };
                                    plan?: { status: string };
                                    review?: { status: string };
                                    readiness?: { status: string; signals?: Record<string, unknown> };
                                  }>(`/reports/lessons/${id}/make-classroom-ready`, {
                                    days: insightsDays ?? 7,
                                    attachPractice: true,
                                    attachLimit: 10,
                                    ensureDiagram: true,
                                    regeneratePlan: true,
                                    planLimit: 10,
                                    markReviewed: true,
                                  });
                                  const d = res?.data;
                                  if (!d?.ok) {
                                    setMakeClassroomReadyError("Request failed");
                                    return;
                                  }
                                  const added = d?.attach?.added ?? 0;
                                  const diagramStatus = d?.diagram?.status ?? "";
                                  const planStatus = d?.plan?.status ?? "";
                                  const reviewStatus = d?.review?.status ?? "";
                                  if (d?.attach?.addedIds?.length) {
                                    setAttachedExamQuestions((prev) => {
                                      const ids = new Set(d.attach!.addedIds!);
                                      const existing = new Set(prev.map((q) => q._id));
                                      const newOnes = d.attach!.addedIds!.filter((id) => !existing.has(id)).map((id) => ({ _id: id, question: "", type: "mcq" as const }));
                                      return [...prev, ...newOnes];
                                    });
                                  }
                                  const listRes = await api.get(`/lessons/${id}/exam-questions`);
                                  setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                                  const planRes = await api.get(`/reports/lessons/${id}/reteach-plan`);
                                  if (planRes?.data?.ok && planRes.data.plan) setReteachPlan(planRes.data.plan);
                                  setLesson((prev) =>
                                    prev && d?.readiness
                                      ? ({
                                          ...prev,
                                          readiness: d.readiness as Lesson["readiness"],
                                          reviewedAt: d.review?.status === "MARKED" || d.review?.status === "ALREADY_REVIEWED" ? new Date().toISOString() : prev.reviewedAt,
                                        } as Lesson)
                                      : prev
                                  );
                                  await fetchLessonSmart();
                                  const diagramMsg = diagramStatus === "ATTACHED" ? "diagram attached" : diagramStatus === "ALREADY_PRESENT" ? "diagram already" : "no diagram";
                                  const planMsg =
                                    planStatus === "UPDATED" ? "plan updated" : planStatus === "CACHED" ? "plan reused" : planStatus === "NOT_CONFIGURED" ? "plan not generated" : planStatus === "RATE_LIMIT" ? "plan rate limited" : "plan skipped";
                                  const baseMsg = `Done: +${added} practice · ${diagramMsg} · ${planMsg} · ${reviewStatus === "MARKED" ? "reviewed" : reviewStatus === "ALREADY_REVIEWED" ? "already reviewed" : "review skipped"}`;
                                  setSaveMsg(d?.readiness?.status === "READY" ? `${baseMsg}. Ready. Open Classroom mode to start collecting attempts.` : baseMsg);
                                  setTimeout(() => setSaveMsg(""), 4000);
                                } catch (e: any) {
                                  const msg = e?.response?.data?.error ?? e?.response?.data?.message ?? e?.message ?? "Make classroom-ready failed";
                                  setMakeClassroomReadyError(msg === "Lesson topic isn't mapped to Biology taxonomy yet — set a valid topicKey." ? "Set a valid topic (topicKey) for this lesson." : msg);
                                } finally {
                                  setMakeClassroomReadyLoading(false);
                                }
                              }}
                              style={{
                                padding: "8px 14px",
                                borderRadius: 8,
                                border: "2px solid #059669",
                                background: makeClassroomReadyLoading ? "#e5e7eb" : "rgba(5,150,105,0.12)",
                                cursor: makeClassroomReadyLoading ? "not-allowed" : "pointer",
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#047857",
                              }}
                            >
                              {makeClassroomReadyLoading ? "Preparing…" : "Make classroom-ready"}
                            </button>
                            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                              Attaches practice, adds a diagram if missing, refreshes reteach plan, marks reviewed.
                            </p>
                            {makeClassroomReadyError && (
                              <div style={{ marginTop: 6, fontSize: 13, color: "#b91c1c" }}>{makeClassroomReadyError}</div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* PR8: Suggested diagrams when lesson has no diagrams */}
                  {lesson?.readiness?.signals?.hasDiagrams === false && (
                    <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
                      <div style={{ fontWeight: 900, marginBottom: 8 }}>Suggested diagrams</div>
                      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
                        Add a diagram to improve readiness. Choose one below and add it to page 1.
                      </p>
                      <button
                        type="button"
                        disabled={diagramSuggestionsLoading || !id}
                        onClick={async () => {
                          if (!id) return;
                          setDiagramSuggestionsError(null);
                          setDiagramSuggestionsLoading(true);
                          try {
                            const res = await api.get(`/lessons/${id}/diagram-suggestions`);
                            const data = res?.data;
                            setDiagramSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
                          } catch (e: any) {
                            setDiagramSuggestionsError(e?.response?.data?.msg || e?.message || "Failed to load suggestions");
                            setDiagramSuggestions([]);
                          } finally {
                            setDiagramSuggestionsLoading(false);
                          }
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "2px solid rgba(59,130,246,0.4)",
                          background: "rgba(59,130,246,0.08)",
                          cursor: diagramSuggestionsLoading ? "not-allowed" : "pointer",
                          fontWeight: 700,
                          marginBottom: 10,
                        }}
                      >
                        {diagramSuggestionsLoading ? "Loading…" : "Load suggestions"}
                      </button>
                      {diagramSuggestionsError && (
                        <div style={{ color: "#b91c1c", fontSize: 13, marginBottom: 8 }}>{diagramSuggestionsError}</div>
                      )}
                      {diagramAddedHint && (
                        <div style={{ color: "#15803d", fontSize: 13, marginBottom: 8 }}>Added. Click Save changes.</div>
                      )}
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                        {diagramSuggestions.map((s) => {
                          const existingVisualIds = (lesson?.pages ?? [])
                            .flatMap((p) => p.blocks ?? [])
                            .filter((b: LessonPageBlock) => b.type === "diagram" && b.visualId)
                            .map((b: LessonPageBlock) => String((b as { visualId?: string }).visualId));
                          const alreadyAdded = existingVisualIds.includes(String(s.id));
                          return (
                            <li key={s.id} style={{ marginBottom: 8, listStyle: "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span>{s.title || s.conceptKey || s.id}</span>
                              {s.imageUrl && (
                                <img src={s.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: "contain", border: "1px solid #e2e8f0", borderRadius: 4 }} />
                              )}
                              <button
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => {
                                  setLesson((prev) => {
                                    if (!prev) return prev;
                                    let pages = Array.isArray(prev.pages) ? [...prev.pages] : [];
                                    if (pages.length === 0) {
                                      pages = [{
                                        pageId: newId(),
                                        title: "Page 1",
                                        order: 1,
                                        pageType: "",
                                        hero: { type: "none", src: "", caption: "" },
                                        blocks: [],
                                        checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
                                      }];
                                    }
                                    const blocks = Array.isArray(pages[0].blocks) ? [...pages[0].blocks] : [];
                                    blocks.unshift({ type: "diagram" as const, visualId: s.id, caption: "" });
                                    pages[0] = { ...pages[0], blocks };
                                    return { ...prev, pages };
                                  });
                                  setDiagramAddedHint(true);
                                  setTimeout(() => setDiagramAddedHint(false), 5000);
                                }}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #94a3b8",
                                  background: alreadyAdded ? "#e2e8f0" : "#f1f5f9",
                                  cursor: alreadyAdded ? "not-allowed" : "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {alreadyAdded ? "Already added" : "Add to page 1"}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Past paper questions</div>
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "#64748b" }}>
                      Attach questions from your Question Bank to this lesson. Students can use them for practice.
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => { setAddFromBankModalOpen(true); setBankTopicKey(""); setBankQuestions([]); setSelectedBankQuestionIds(new Set()); }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: "2px solid rgba(59,130,246,0.4)",
                          background: "rgba(59,130,246,0.08)",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Add from Question Bank
                      </button>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          disabled={autoAttachLoading}
                          onClick={async () => {
                            if (!id) return;
                            setAutoAttachMessage(null);
                            setAutoAttachLoading(true);
                            try {
                              const res = await api.post(`/lessons/${id}/exam-questions/attach-by-topic`, {
                                limit: autoAttachLimit,
                              });
                              const data = res?.data;
                              const added = data?.added ?? 0;
                              const topicName = data?.topic ?? lesson?.topic ?? "topic";
                              if (added > 0) {
                                const listRes = await api.get(`/lessons/${id}/exam-questions`);
                                setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                              }
                              setAutoAttachMessage(added > 0 ? `Added ${added} question${added !== 1 ? "s" : ""} for ${topicName}` : "No new questions to add (all already attached).");
                            } catch (err: any) {
                              const msg = err?.response?.data?.msg ?? err?.response?.data?.error;
                              const is400 = err?.response?.status === 400;
                              setAutoAttachMessage(
                                is400 && msg
                                  ? (typeof msg === "string" ? msg : "Lesson topic isn't mapped to Biology taxonomy yet — set a valid topicKey.")
                                  : "Failed to attach questions."
                              );
                            } finally {
                              setAutoAttachLoading(false);
                              setTimeout(() => setAutoAttachMessage(null), 5000);
                            }
                          }}
                          style={{
                            padding: "8px 14px",
                            borderRadius: 8,
                            border: "2px solid rgba(34,197,94,0.4)",
                            background: "rgba(34,197,94,0.08)",
                            cursor: autoAttachLoading ? "not-allowed" : "pointer",
                            fontWeight: 700,
                            opacity: autoAttachLoading ? 0.7 : 1,
                          }}
                        >
                          {autoAttachLoading ? "Attaching…" : `Auto-attach (Top ${autoAttachLimit})`}
                        </button>
                        <select
                          value={autoAttachLimit}
                          onChange={(e) => setAutoAttachLimit(Number(e.target.value))}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          <option value={5}>5</option>
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                        </select>
                      </span>
                    </div>
                    {autoAttachMessage && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: "8px 12px",
                          borderRadius: 8,
                          fontSize: 13,
                          background: autoAttachMessage.startsWith("Added") ? "#dcfce7" : autoAttachMessage.includes("isn't mapped") ? "#fef3c7" : "#fee2e2",
                          color: "#166534",
                        }}
                      >
                        {autoAttachMessage}
                      </div>
                    )}
                    {attachedExamQuestions.length > 0 && (
                      <ul style={{ marginTop: 12, paddingLeft: 20, listStyle: "disc" }}>
                        {attachedExamQuestions.map((q) => (
                          <li key={q._id} style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <span style={{ fontSize: 13, color: "#374151", flex: 1, overflow: "hidden", textOverflow: "ellipsis" }} title={q.question}>
                              {q.question?.slice(0, 60)}{(q.question?.length ?? 0) > 60 ? "…" : ""} {q.marks != null ? `(${q.marks} marks)` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                api.delete(`/lessons/${id}/exam-questions/${q._id}`).then(() => {
                                  setAttachedExamQuestions((prev) => prev.filter((x) => x._id !== q._id));
                                }).catch(() => {});
                              }}
                              style={{
                                padding: "4px 8px",
                                fontSize: 12,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderRadius: 6,
                                cursor: "pointer",
                                flexShrink: 0,
                              }}
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* PR13.1: Misconceptions panel — top wrong questions + topic hot-spots, one-click attach */}
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Misconceptions (last {insightsDays} days)</div>
                    {(() => {
                      const isPublished = lesson?.isPublished === true || String(lesson?.status || "").toLowerCase() === "published";
                      if (!isPublished) {
                        return (
                          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                            Publish to start collecting attempts.
                          </p>
                        );
                      }
                      if (insightsLoading) {
                        return <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Loading insights…</p>;
                      }
                      if (insightsError) {
                        return (
                          <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{insightsError}</p>
                        );
                      }
                      if (misconceptionItems.length === 0 && hotspotTopics.length === 0) {
                        return (
                          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                            No practice attempts recorded yet.
                          </p>
                        );
                      }
                      const attachedIds = new Set(attachedExamQuestions.map((q) => String(q._id)));
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>Period:</span>
                            {([7, 14, 30] as const).map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setInsightsDays(d)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: insightsDays === d ? "2px solid #2563eb" : "1px solid #e2e8f0",
                                  background: insightsDays === d ? "rgba(37,99,235,0.1)" : "#fff",
                                  cursor: "pointer",
                                  fontSize: 12,
                                  fontWeight: 600,
                                }}
                              >
                                {d} days
                              </button>
                            ))}
                            <button
                              type="button"
                              disabled={fixingTopicKey !== null || bulkFixLoading}
                              onClick={async () => {
                                if (!id) return;
                                setBulkFixLoading(true);
                                setBulkFixError(null);
                                try {
                                  const res = await api.post<{
                                    ok: boolean;
                                    lessonId: string;
                                    days: number;
                                    topics: Array<{ topicKey: string; topic?: string; requested: number; added: number; addedIds: string[] }>;
                                    attach: { requested: number; added: number; addedIds: string[] };
                                    plan: { status: string; id?: string | null; pinned?: boolean; updatedAt?: string | null; cached?: boolean };
                                  }>(`/reports/lessons/${id}/one-click-fix-bulk`, {
                                    days: insightsDays,
                                    attachByTopic: true,
                                    attachLimitPerTopic: 10,
                                    regeneratePlan: true,
                                    planLimit: 10,
                                  });
                                  const data = res?.data;
                                  if (!data?.ok) {
                                    setBulkFixError("Bulk fix failed");
                                    return;
                                  }
                                  const addedIds = Array.isArray(data?.attach?.addedIds) ? data.attach.addedIds : [];
                                  if (addedIds.length > 0) {
                                    setAttachedExamQuestions((prev) => {
                                      const existingIds = new Set(prev.map((q: any) => String(q?._id ?? q?.id ?? "")));
                                      const next = [...prev];
                                      for (const qid of addedIds) {
                                        if (!existingIds.has(String(qid))) {
                                          next.push({ _id: qid, question: "(attached)", marks: undefined });
                                        }
                                      }
                                      return next;
                                    });
                                  }
                                  const planStatus = data?.plan?.status || "SKIPPED";
                                  let planMsg = "plan updated";
                                  if (planStatus === "CACHED") planMsg = "plan reused";
                                  if (planStatus === "NOT_CONFIGURED") planMsg = "plan not generated (AI not configured)";
                                  if (planStatus === "RATE_LIMIT") planMsg = "plan not generated (rate limited)";
                                  if (planStatus === "ERROR") planMsg = "plan not generated";
                                  if (planStatus === "SKIPPED") planMsg = "plan skipped";
                                  const added = data?.attach?.added ?? 0;
                                  setAttachByTopicToast(`Done: +${added} question${added !== 1 ? "s" : ""} · ${planMsg}`);
                                  setTimeout(() => setAttachByTopicToast(null), 4000);
                                  try {
                                    const listRes = await api.get(`/lessons/${id}/exam-questions`);
                                    setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                                  } catch {}
                                  try {
                                    const planRes = await api.get(`/reports/lessons/${id}/reteach-plan`);
                                    if (planRes?.data?.ok && planRes.data.plan) setReteachPlan(planRes.data.plan);
                                  } catch {}
                                } catch (e: any) {
                                  setBulkFixError(e?.response?.data?.error || e?.response?.data?.message || "Failed to run bulk fix.");
                                } finally {
                                  setBulkFixLoading(false);
                                }
                              }}
                              style={{
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "2px solid #059669",
                                background: bulkFixLoading || fixingTopicKey ? "#e5e7eb" : "rgba(5,150,105,0.12)",
                                cursor: bulkFixLoading || fixingTopicKey ? "not-allowed" : "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#047857",
                              }}
                            >
                              {bulkFixLoading ? "Fixing…" : "Fix top hotspots (3)"}
                            </button>
                          </div>
                          {bulkFixError && (
                            <div style={{ marginBottom: 8, fontSize: 12, color: "#dc2626" }}>{bulkFixError}</div>
                          )}
                          {misconceptionItems.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#374151" }}>Top misconceptions</div>
                              <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
                                {misconceptionItems.map((item) => {
                                  const snippet = (item.question ?? "").slice(0, 120);
                                  const isAttached = attachedIds.has(item.questionId);
                                  const isAttaching = attachingQuestionId === item.questionId;
                                  return (
                                    <li key={item.questionId} style={{ marginBottom: 10, padding: 8, borderRadius: 6, background: "#fff", border: "1px solid #e2e8f0" }}>
                                      <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>
                                        {snippet}{snippet.length >= 120 ? "…" : ""}
                                      </div>
                                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                                        High-conf wrong: {item.highConfidenceWrong} · Accuracy: {item.accuracy != null ? Math.round(item.accuracy * 100) : "—"}% · {item.topic ?? item.topicKey ?? "—"}
                                      </div>
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          disabled={isAttached || isAttaching}
                                          onClick={async () => {
                                            if (!id) return;
                                            setAttachingQuestionId(item.questionId);
                                            try {
                                              await api.post(`/lessons/${id}/exam-questions`, { questionIds: [item.questionId] });
                                              const listRes = await api.get(`/lessons/${id}/exam-questions`);
                                              setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                                              setAttachToast("Attached");
                                              setTimeout(() => setAttachToast(null), 2500);
                                            } finally {
                                              setAttachingQuestionId(null);
                                            }
                                          }}
                                          style={{
                                            padding: "4px 10px",
                                            borderRadius: 6,
                                            border: "1px solid #22c55e",
                                            background: isAttached ? "#e2e8f0" : "rgba(34,197,94,0.12)",
                                            cursor: isAttached || isAttaching ? "not-allowed" : "pointer",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: isAttached ? "#64748b" : "#166534",
                                          }}
                                        >
                                          {isAttaching ? "Attaching…" : isAttached ? "Attached" : "Attach to lesson"}
                                        </button>
                                        <Link
                                          to={item.topicKey ? `/teacher/exam-question-bank?topicKey=${encodeURIComponent(item.topicKey)}` : "/teacher/exam-question-bank"}
                                          style={{ fontSize: 11, color: "#2563eb", fontWeight: 600 }}
                                        >
                                          Open in Question Bank
                                        </Link>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                              {attachToast && (
                                <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}>{attachToast}</div>
                              )}
                            </div>
                          )}
                          {hotspotTopics.length > 0 && (
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, color: "#374151" }}>Topic hot-spots</div>
                              <ul style={{ margin: 0, paddingLeft: 16, listStyle: "none" }}>
                                {hotspotTopics.map((t) => {
                                  const isAttaching = attachingTopicKey === t.topicKey;
                                  return (
                                    <li key={t.topicKey} style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 12, color: "#374151" }}>
                                        {t.topic ?? t.topicKey} · Wrong {t.wrong}/{t.attempts}
                                        {t.highConfidenceWrong > 0 && (
                                          <span style={{ color: "#b91c1c", marginLeft: 4 }}>· High-conf wrong: {t.highConfidenceWrong}</span>
                                        )}
                                      </span>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <button
                                          type="button"
                                          disabled={isAttaching}
                                          onClick={async () => {
                                            if (!id) return;
                                            setAttachingTopicKey(t.topicKey);
                                            try {
                                              const res = await api.post(`/lessons/${id}/exam-questions/attach-by-topic`, {
                                                topicKey: t.topicKey,
                                                limit: 10,
                                              });
                                              const data = res?.data;
                                              const added = data?.added ?? 0;
                                              if (added > 0) {
                                                const listRes = await api.get(`/lessons/${id}/exam-questions`);
                                                setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                                              }
                                              setAttachByTopicToast(added > 0 ? `Added ${added} question${added !== 1 ? "s" : ""}` : "No new questions to add");
                                              setTimeout(() => setAttachByTopicToast(null), 3000);
                                            } finally {
                                              setAttachingTopicKey(null);
                                            }
                                          }}
                                          style={{
                                            padding: "4px 10px",
                                            borderRadius: 6,
                                            border: "1px solid #94a3b8",
                                            background: "#f1f5f9",
                                            cursor: isAttaching ? "not-allowed" : "pointer",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "#475569",
                                          }}
                                        >
                                          {isAttaching ? "Attaching…" : "Attach top 10"}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={fixingTopicKey === t.topicKey}
                                          onClick={async () => {
                                            if (!id) return;
                                            const topicKey = String(t.topicKey || "");

                                            setFixingTopicKey(topicKey);
                                            setFixErrorByTopic((prev) => ({ ...prev, [topicKey]: "" }));

                                            try {
                                              const res = await api.post<{
                                                ok: boolean;
                                                lessonId: string;
                                                topicKey?: string;
                                                topic?: string;
                                                attach?: { requested: number; added: number; addedIds: string[] };
                                                plan?: {
                                                  status: "UPDATED" | "CACHED" | "NOT_CONFIGURED" | "RATE_LIMIT" | "ERROR" | "SKIPPED";
                                                  id?: string | null;
                                                  pinned?: boolean;
                                                  updatedAt?: string | null;
                                                  cached?: boolean;
                                                };
                                              }>(`/reports/lessons/${id}/one-click-fix`, {
                                                days: insightsDays,
                                                topicKey,
                                                attachByTopic: true,
                                                attachLimit: 10,
                                                regeneratePlan: true,
                                                planLimit: 10,
                                              });

                                              const data = res?.data;
                                              if (!data?.ok) {
                                                setFixErrorByTopic((prev) => ({ ...prev, [topicKey]: "One-click fix failed" }));
                                                return;
                                              }

                                              const added = data?.attach?.added ?? 0;
                                              const addedIds = Array.isArray(data?.attach?.addedIds) ? data.attach.addedIds : [];

                                              if (addedIds.length > 0) {
                                                setAttachedExamQuestions((prev) => {
                                                  const existingIds = new Set(prev.map((q: any) => String(q?._id ?? q?.id ?? "")));
                                                  const next = [...prev];
                                                  for (const qid of addedIds) {
                                                    if (!existingIds.has(String(qid))) {
                                                      next.push({ _id: qid, question: "(attached)", marks: undefined });
                                                    }
                                                  }
                                                  return next;
                                                });
                                              }

                                              const planStatus = data?.plan?.status || "SKIPPED";
                                              let planMsg = "plan updated";
                                              if (planStatus === "CACHED") planMsg = "plan reused";
                                              if (planStatus === "NOT_CONFIGURED") planMsg = "plan not generated (AI not configured)";
                                              if (planStatus === "RATE_LIMIT") planMsg = "plan not generated (rate limited)";
                                              if (planStatus === "ERROR") planMsg = "plan not generated";
                                              if (planStatus === "SKIPPED") planMsg = "plan skipped";

                                              setAttachByTopicToast(`Done: added ${added} question${added !== 1 ? "s" : ""} · ${planMsg}`);
                                              setTimeout(() => setAttachByTopicToast(null), 4000);

                                              try {
                                                const listRes = await api.get(`/lessons/${id}/exam-questions`);
                                                setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                                              } catch {}

                                              try {
                                                const planRes = await api.get(`/reports/lessons/${id}/reteach-plan`);
                                                if (planRes?.data?.ok && planRes.data.plan) {
                                                  setReteachPlan(planRes.data.plan);
                                                }
                                              } catch {}
                                            } catch (e: any) {
                                              const msg =
                                                e?.response?.data?.error ||
                                                e?.response?.data?.message ||
                                                "Failed to run one-click fix.";
                                              setFixErrorByTopic((prev) => ({ ...prev, [topicKey]: msg }));
                                            } finally {
                                              setFixingTopicKey(null);
                                            }
                                          }}
                                          style={{
                                            padding: "4px 10px",
                                            borderRadius: 6,
                                            border: "2px solid #059669",
                                            background: "rgba(5,150,105,0.12)",
                                            cursor: fixingTopicKey === t.topicKey ? "not-allowed" : "pointer",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "#047857",
                                          }}
                                        >
                                          {fixingTopicKey === t.topicKey ? "Fixing…" : "One-click fix"}
                                        </button>
                                      </div>
                                      {fixErrorByTopic[t.topicKey] && (
                                        <div style={{ width: "100%", fontSize: 11, color: "#dc2626", marginTop: 4 }}>{fixErrorByTopic[t.topicKey]}</div>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                              {attachByTopicToast && (
                                <div style={{ marginTop: 6, fontSize: 12, color: "#166534", fontWeight: 600 }}>{attachByTopicToast}</div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* PR14: Reteach plan compact panel — pinned snippet + Open full report + optional Generate */}
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "2px solid rgba(0,0,0,0.08)", background: "#f8fafc" }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Reteach plan</div>
                    {reteachPlanLoading ? (
                      <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>Loading…</p>
                    ) : reteachPlan ? (
                      <>
                        {reteachPlan.pinned && reteachPlan.content && (
                          <div style={{ fontSize: 12, color: "#374151", marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {reteachPlan.content.replace(/#+\s/g, "").slice(0, 220)}
                            {reteachPlan.content.length > 220 ? "…" : ""}
                          </div>
                        )}
                        {!reteachPlan.pinned && (
                          <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b" }}>Plan available — open report to view or pin.</p>
                        )}
                        <p style={{ margin: "0 0 8px 0", fontSize: 12, color: "#374151" }}>
                          Student next steps: {reteachPlan.studentSummary?.trim() ? "✓" : "—"}
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <Link
                            to={`/teacher/reports/lesson/${id}`}
                            style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}
                          >
                            Edit in report
                          </Link>
                          <button
                            type="button"
                            disabled={reteachPlanGenerateLoading}
                            onClick={async () => {
                              if (!id) return;
                              setReteachPlanGenerateLoading(true);
                              try {
                                const res = await api.post<{ ok: boolean; plan?: { content: string; pinned: boolean; generatedAt?: string; days?: number } }>(
                                  `/reports/lessons/${id}/reteach-plan`,
                                  { days: insightsDays, limit: 10 }
                                );
                                if (res?.data?.ok && res.data.plan) setReteachPlan(res.data.plan);
                              } finally {
                                setReteachPlanGenerateLoading(false);
                              }
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #2563eb",
                              background: "rgba(37,99,235,0.1)",
                              cursor: reteachPlanGenerateLoading ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#2563eb",
                              alignSelf: "flex-start",
                            }}
                          >
                            {reteachPlanGenerateLoading ? "Generating…" : "Generate"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#64748b" }}>No plan yet. Generate from report or here.</p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <Link to={`/teacher/reports/lesson/${id}`} style={{ fontSize: 12, color: "#2563eb", fontWeight: 600 }}>
                            Edit in report
                          </Link>
                          <button
                            type="button"
                            disabled={reteachPlanGenerateLoading}
                            onClick={async () => {
                              if (!id) return;
                              setReteachPlanGenerateLoading(true);
                              try {
                                const res = await api.post<{ ok: boolean; plan?: { content: string; pinned: boolean; generatedAt?: string; days?: number } }>(
                                  `/reports/lessons/${id}/reteach-plan`,
                                  { days: insightsDays, limit: 10 }
                                );
                                if (res?.data?.ok && res.data.plan) setReteachPlan(res.data.plan);
                              } finally {
                                setReteachPlanGenerateLoading(false);
                              }
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 6,
                              border: "1px solid #2563eb",
                              background: "rgba(37,99,235,0.1)",
                              cursor: reteachPlanGenerateLoading ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 600,
                              color: "#2563eb",
                              alignSelf: "flex-start",
                            }}
                          >
                            {reteachPlanGenerateLoading ? "Generating…" : "Generate"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
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
                      const isCheckpoint = b.type === "checkpoint";
                      const isDiagram = b.type === "diagram";
                      const cp = isCheckpoint ? b : null;
                      const d = isDiagram ? b : null;
                      const opts = (cp?.options ?? ["", "", "", ""]).slice(0, 6);
                      const cpWarnings: string[] = [];
                      if (isCheckpoint && cp) {
                        if (!(String(cp.prompt ?? "").trim())) cpWarnings.push("Prompt is required.");
                        if (cp.questionType === "mcq") {
                          const filled = (cp.options ?? []).filter((o) => String(o ?? "").trim()).length;
                          if (filled < 2) cpWarnings.push("MCQ needs at least 2 options.");
                          if (!(String(cp.correctAnswer ?? "").trim())) cpWarnings.push("Correct answer is required.");
                        } else {
                          if (!(String(cp.correctAnswer ?? "").trim())) cpWarnings.push("Correct answer is required.");
                        }
                      }

                      return (
                        <div key={key} style={getBlockStyle(b.type)}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>
                              {isCheckpoint ? "Checkpoint" : BLOCK_META[b.type].label}
                            </div>

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

                              {!isCheckpoint && !isDiagram && (
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
                              )}

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

                          {isCheckpoint && cp ? (
                            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                              {cpWarnings.length > 0 && (
                                <div style={{ color: "#b45309", fontSize: 13, fontWeight: 600 }}>
                                  {cpWarnings.join(" ")}
                                </div>
                              )}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Prompt</div>
                                <textarea
                                  value={cp.prompt ?? ""}
                                  onChange={(e) =>
                                    updateBlock(currentPage!.pageId, idx, { prompt: e.target.value })
                                  }
                                  placeholder="Question or instruction..."
                                  rows={2}
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                    resize: "vertical",
                                  }}
                                />
                              </label>
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Question type</div>
                                <select
                                  value={cp.questionType ?? "mcq"}
                                  onChange={(e) =>
                                    updateBlock(currentPage!.pageId, idx, {
                                      questionType: e.target.value === "short" ? "short" : "mcq",
                                      ...(e.target.value === "short" ? { options: undefined } : { options: opts.length ? opts : ["", "", "", ""] }),
                                    })
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                >
                                  <option value="mcq">Multiple choice (MCQ)</option>
                                  <option value="short">Short answer</option>
                                </select>
                              </label>
                              {cp.questionType === "short" ? (
                                <label style={{ display: "block" }}>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Correct answer</div>
                                  <input
                                    type="text"
                                    value={cp.correctAnswer ?? ""}
                                    onChange={(e) =>
                                      updateBlock(currentPage!.pageId, idx, { correctAnswer: e.target.value })
                                    }
                                    placeholder="Expected short answer"
                                    style={{
                                      width: "100%",
                                      padding: "10px 12px",
                                      borderRadius: 10,
                                      border: "2px solid rgba(0,0,0,0.14)",
                                    }}
                                  />
                                </label>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Options (correct answer)</div>
                                  {(cp.options ?? ["", "", "", ""]).map((opt, oi) => (
                                    <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                                      <input
                                        type="radio"
                                        name={`${key}-correct`}
                                        checked={(cp.correctAnswer ?? "").trim() === String(opt ?? "").trim() && String(opt ?? "").trim() !== ""}
                                        onChange={() =>
                                          updateBlock(currentPage!.pageId, idx, { correctAnswer: String(opt ?? "").trim() })
                                        }
                                        style={{ flexShrink: 0 }}
                                      />
                                      <input
                                        type="text"
                                        value={opt ?? ""}
                                        onChange={(e) => {
                                          const next = [...(cp.options ?? ["", "", "", ""])];
                                          while (next.length <= oi) next.push("");
                                          next[oi] = e.target.value;
                                          updateBlock(currentPage!.pageId, idx, { options: next });
                                        }}
                                        placeholder={`Option ${oi + 1}`}
                                        style={{
                                          flex: 1,
                                          padding: "8px 10px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(0,0,0,0.14)",
                                        }}
                                      />
                                    </div>
                                  ))}
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {(cp.options ?? []).length < 6 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...(cp.options ?? ["", "", "", ""]), ""];
                                          updateBlock(currentPage!.pageId, idx, { options: next });
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(59,130,246,0.35)",
                                          background: "rgba(59,130,246,0.08)",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                        }}
                                      >
                                        + option
                                      </button>
                                    )}
                                    {(cp.options ?? []).length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (cp.options ?? ["", "", "", ""]).slice(0, -1);
                                          const wasCorrect = (cp.correctAnswer ?? "").trim();
                                          const removed = (cp.options ?? [])[(cp.options ?? []).length - 1] ?? "";
                                          updateBlock(currentPage!.pageId, idx, {
                                            options: next,
                                            ...(String(removed).trim() === wasCorrect ? { correctAnswer: (next[0] ?? "").trim() } : {}),
                                          });
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(0,0,0,0.2)",
                                          background: "white",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                        }}
                                      >
                                        Remove option
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Explanation (optional)</div>
                                <textarea
                                  value={cp.explanation ?? ""}
                                  onChange={(e) =>
                                    updateBlock(currentPage!.pageId, idx, { explanation: e.target.value })
                                  }
                                  placeholder="Why this answer is correct..."
                                  rows={2}
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
                          ) : isDiagram && d ? (
                            <div
                              ref={(el) => {
                                const diagramKey = `${currentPage!.pageId}-${idx}`;
                                diagramBlockContainerRef.current[diagramKey] = el;
                              }}
                              style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}
                            >
                              <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
                                Check this diagram is correct. Edit if needed.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  const diagramKey = `${currentPage!.pageId}-${idx}`;
                                  diagramBlockContainerRef.current[diagramKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                style={{
                                  alignSelf: "flex-start",
                                  padding: "8px 14px",
                                  borderRadius: 8,
                                  border: "2px solid #2563eb",
                                  background: "rgba(37,99,235,0.08)",
                                  color: "#2563eb",
                                  fontWeight: 600,
                                  fontSize: 13,
                                  cursor: "pointer",
                                }}
                              >
                                Edit diagram
                              </button>
                              {d.visualId ? (
                                <>
                                  {/* PR11.1: diagram preview canvas (when annotated/step) */}
                                  {(d.mode === "annotated" || d.mode === "step") && (() => {
                                    const diagramKey = `${currentPage!.pageId}-${idx}`;
                                    const rawUrl = diagramPreviewUrls[String(d.visualId)] ?? "";
                                    const baseOrigin = (api as any)?.defaults?.baseURL
                                      ? String((api as any).defaults.baseURL).replace(/\/api\/?$/i, "").replace(/\/+$/, "")
                                      : window.location.origin;
                                    const diagramUrl = rawUrl
                                      ? (rawUrl.startsWith("http") ? rawUrl : baseOrigin + (rawUrl.startsWith("/") ? rawUrl : "/" + rawUrl))
                                      : "";
                                    return (
                                      <div style={{ marginTop: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                                          <button
                                            type="button"
                                            onClick={() => setPlaceMode((v) => !v)}
                                            style={{
                                              padding: "6px 10px",
                                              borderRadius: 6,
                                              border: placeMode ? "2px solid #2563eb" : "1px solid #d1d5db",
                                              background: placeMode ? "#eff6ff" : "#fff",
                                              cursor: "pointer",
                                              fontSize: 12,
                                              fontWeight: 600,
                                            }}
                                          >
                                            Place labels: {placeMode ? "ON" : "OFF"}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const anns = Array.isArray(d.annotations) ? d.annotations : [];
                                              if (anns.length < 2) return;
                                              const next = autoSpreadAnnotations(anns);
                                              updateBlock(currentPage!.pageId, idx, { annotations: next });
                                            }}
                                            disabled={(d.annotations ?? []).length < 2}
                                            style={{
                                              padding: "6px 10px",
                                              borderRadius: 6,
                                              border: "1px solid #22c55e",
                                              background: "rgba(34,197,94,0.1)",
                                              cursor: (d.annotations ?? []).length >= 2 ? "pointer" : "not-allowed",
                                              fontSize: 12,
                                              fontWeight: 600,
                                            }}
                                          >
                                            Auto-spread labels
                                          </button>
                                          {placeMode && !selectedAnnotationId && (
                                            <span style={{ fontSize: 12, color: "#64748b" }}>Select a label first.</span>
                                          )}
                                        </div>
                                        {(d.annotations ?? []).length > 0 && selectedAnnotationId && (
                                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                                            <span style={{ fontSize: 12, color: "#64748b" }}>Nudge:</span>
                                            <select
                                              value={nudgeStepPct}
                                              onChange={(e) => setNudgeStepPct(Number(e.target.value))}
                                              style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 12 }}
                                            >
                                              <option value={1}>1%</option>
                                              <option value={2}>2%</option>
                                              <option value={5}>5%</option>
                                            </select>
                                            {([["⬆", 0, -1], ["⬇", 0, 1], ["⬅", -1, 0], ["➡", 1, 0]] as const).map(([label, dx, dy]) => (
                                              <button
                                                key={label}
                                                type="button"
                                                onClick={() => {
                                                  const sel = (d.annotations ?? []).find((a) => a.id === selectedAnnotationId);
                                                  if (!sel) return;
                                                  const step = nudgeStepPct / 100;
                                                  updateDiagramAnnotation(currentPage!.pageId, idx, selectedAnnotationId, {
                                                    x: clamp((sel.x ?? 0.5) + dx * step, 0, 1),
                                                    y: clamp((sel.y ?? 0.5) + dy * step, 0, 1),
                                                  });
                                                }}
                                                style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: 14 }}
                                              >
                                                {label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        <div
                                          ref={(el) => { diagramRef.current[diagramKey] = el; }}
                                          tabIndex={0}
                                          role="group"
                                          aria-label="Diagram label preview"
                                          style={{
                                            position: "relative",
                                            width: "100%",
                                            maxWidth: 520,
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            border: "1px solid #e5e7eb",
                                            marginTop: 4,
                                            touchAction: "none",
                                            outline: "none",
                                          }}
                                          onClick={(e) => {
                                            if (!placeMode || !selectedAnnotationId) return;
                                            const el = diagramRef.current[diagramKey];
                                            if (!el) return;
                                            const { x, y } = getNormalizedPointFromEvent(e.nativeEvent, el);
                                            updateDiagramAnnotation(currentPage!.pageId, idx, selectedAnnotationId, { x, y });
                                          }}
                                          onKeyDown={(e) => {
                                            if (selectedAnnotationId == null) return;
                                            const sel = (d.annotations ?? []).find((a) => a.id === selectedAnnotationId);
                                            if (!sel) return;
                                            const step = (e.shiftKey ? 2 : 1) * (nudgeStepPct / 100);
                                            let dx = 0;
                                            let dy = 0;
                                            if (e.key === "ArrowUp") { dy = -step; e.preventDefault(); }
                                            if (e.key === "ArrowDown") { dy = step; e.preventDefault(); }
                                            if (e.key === "ArrowLeft") { dx = -step; e.preventDefault(); }
                                            if (e.key === "ArrowRight") { dx = step; e.preventDefault(); }
                                            if (dx !== 0 || dy !== 0)
                                              updateDiagramAnnotation(currentPage!.pageId, idx, selectedAnnotationId, {
                                                x: clamp((sel.x ?? 0.5) + dx, 0, 1),
                                                y: clamp((sel.y ?? 0.5) + dy, 0, 1),
                                              });
                                          }}
                                        >
                                          {diagramUrl ? (
                                            <>
                                              <img src={diagramUrl} alt="Diagram preview" style={{ width: "100%", height: "auto", display: "block" }} />
                                              <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
                                                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
                                                  {(d.annotations ?? []).map((a) => {
                                                    const x = (a.x ?? 0.5);
                                                    const y = (a.y ?? 0.5);
                                                    const y2 = clamp(y - 0.035, 0, 1);
                                                    return (
                                                      <line
                                                        key={a.id}
                                                        x1={`${x * 100}%`}
                                                        y1={`${y * 100}%`}
                                                        x2={`${x * 100}%`}
                                                        y2={`${y2 * 100}%`}
                                                        stroke="#111827"
                                                        strokeWidth="2"
                                                        opacity="0.55"
                                                      />
                                                    );
                                                  })}
                                                </svg>
                                                {(d.annotations ?? []).map((ann) => (
                                                  <div
                                                    key={`pin-${ann.id}`}
                                                    style={{
                                                      position: "absolute",
                                                      left: `${((ann.x ?? 0.5) * 100)}%`,
                                                      top: `${((ann.y ?? 0.5) * 100)}%`,
                                                      transform: "translate(-50%, -50%)",
                                                      width: 10,
                                                      height: 10,
                                                      borderRadius: 999,
                                                      background: "#111827",
                                                      border: "2px solid #fff",
                                                      boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                                                    }}
                                                  />
                                                ))}
                                              </div>
                                              {(d.annotations ?? []).map((ann) => (
                                                <div
                                                  key={ann.id}
                                                  onPointerDown={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    draggingIdRef.current = ann.id;
                                                    draggingPageIdRef.current = currentPage!.pageId;
                                                    draggingBlockIndexRef.current = idx;
                                                    setSelectedAnnotationId(ann.id);
                                                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                                                  }}
                                                  onPointerMove={(e) => {
                                                    if (draggingIdRef.current !== ann.id) return;
                                                    const container = diagramRef.current[diagramKey];
                                                    if (!container) return;
                                                    const { x, y } = getNormalizedPointFromEvent(e.nativeEvent, container);
                                                    const pageId = draggingPageIdRef.current;
                                                    const blockIdx = draggingBlockIndexRef.current;
                                                    if (pageId != null && blockIdx != null) updateDiagramAnnotation(pageId, blockIdx, ann.id, { x, y });
                                                  }}
                                                  onPointerUp={(e) => {
                                                    if (draggingIdRef.current === ann.id) draggingIdRef.current = null;
                                                  }}
                                                  onPointerCancel={(e) => {
                                                    if (draggingIdRef.current === ann.id) draggingIdRef.current = null;
                                                  }}
                                                  style={{
                                                    position: "absolute",
                                                    left: `${((ann.x ?? 0.5) * 100)}%`,
                                                    top: `${((ann.y ?? 0.5) * 100)}%`,
                                                    transform: "translate(-50%, -50%)",
                                                    padding: "4px 8px",
                                                    borderRadius: 999,
                                                    border: ann.id === selectedAnnotationId ? "2px solid #2563eb" : "1px solid #d1d5db",
                                                    background: ann.id === selectedAnnotationId ? "#eff6ff" : "#fff",
                                                    fontSize: 12,
                                                    cursor: draggingIdRef.current === ann.id ? "grabbing" : "grab",
                                                    userSelect: "none",
                                                    boxShadow: draggingIdRef.current === ann.id ? "0 4px 10px rgba(0,0,0,0.12)" : "none",
                                                    whiteSpace: "nowrap",
                                                    maxWidth: 200,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                  }}
                                                >
                                                  {(ann.text ?? "").trim() ? ann.text.trim() : "Label"}
                                                </div>
                                              ))}
                                            </>
                                          ) : (
                                            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>Loading diagram…</div>
                                          )}
                                        </div>
                                        <p style={{ margin: "8px 0 0 0", fontSize: 12, color: "#64748b" }}>
                                          Drag labels on the diagram to position them. Nudge with arrows or buttons. Saved with the lesson.
                                        </p>
                                      </div>
                                    );
                                  })()}
                                  {(!d.visualId || (d.mode !== "annotated" && d.mode !== "step")) && (
                                    <div style={{ padding: 16, borderRadius: 10, background: "#f1f5f9", border: "2px dashed rgba(34,197,94,0.3)", textAlign: "center", color: "#64748b", fontSize: 14 }}>
                                      {d.visualId ? <span>Diagram: {String(d.visualId)}</span> : <span>No diagram selected</span>}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div style={{ padding: 16, borderRadius: 10, background: "#f1f5f9", border: "2px dashed rgba(34,197,94,0.3)", textAlign: "center", color: "#64748b", fontSize: 14 }}>
                                  <span>No diagram selected</span>
                                </div>
                              )}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Caption (optional)</div>
                                <input
                                  type="text"
                                  value={d.caption ?? ""}
                                  onChange={(e) =>
                                    updateBlock(currentPage!.pageId, idx, { caption: e.target.value })
                                  }
                                  placeholder="Diagram caption..."
                                  style={{
                                    width: "100%",
                                    padding: "10px 12px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(0,0,0,0.14)",
                                  }}
                                />
                              </label>
                              {/* PR11: diagram mode */}
                              <label style={{ display: "block" }}>
                                <div style={{ fontWeight: 800, marginBottom: 6 }}>Mode</div>
                                <select
                                  value={d.mode === "annotated" || d.mode === "step" ? d.mode : "static"}
                                  onChange={(e) => {
                                    const v = e.target.value as "static" | "annotated" | "step";
                                    updateBlock(currentPage!.pageId, idx, {
                                      mode: v,
                                      annotations: v !== "static" ? (d.annotations ?? []) : [],
                                      steps: v === "step" ? (d.steps ?? []) : [],
                                    });
                                  }}
                                  style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "2px solid rgba(0,0,0,0.14)" }}
                                >
                                  <option value="static">Static</option>
                                  <option value="annotated">Annotated</option>
                                  <option value="step">Step-by-step</option>
                                </select>
                              </label>
                              {/* PR21: Apply tier defaults — recovery path for mode/steps */}
                              <button
                                type="button"
                                onClick={() => {
                                  const annotations = Array.isArray(d.annotations) ? [...d.annotations] : [];
                                  const isHigher = (lesson?.tier ?? "").toLowerCase() === "higher";
                                  if (isHigher) {
                                    const existing = Array.isArray(d.steps) ? d.steps : [];
                                    const steps = [
                                      existing[0] ?? { id: newId(), title: "Step 1", showAnnotationIds: [] as string[] },
                                      existing[1] ?? { id: newId(), title: "Step 2", showAnnotationIds: [] as string[] },
                                      existing[2] ?? { id: newId(), title: "Step 3", showAnnotationIds: [] as string[] },
                                    ].map((s) => ({
                                      id: typeof s.id === "string" ? s.id : newId(),
                                      title: typeof s.title === "string" ? s.title : "Step",
                                      showAnnotationIds: Array.isArray(s.showAnnotationIds) ? s.showAnnotationIds : [],
                                    }));
                                    updateBlock(currentPage!.pageId, idx, { mode: "step", annotations, steps });
                                  } else {
                                    updateBlock(currentPage!.pageId, idx, { mode: "annotated", annotations, steps: [] });
                                  }
                                }}
                                style={{
                                  marginTop: 8,
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: "2px solid #94a3b8",
                                  background: "#f1f5f9",
                                  color: "#475569",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Apply tier defaults
                              </button>
                              {(d.mode === "annotated" || d.mode === "step") && (
                                <>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Annotations</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const anns = Array.isArray(d.annotations) ? [...d.annotations] : [];
                                      anns.push({ id: newId(), kind: "label" as const, text: "", x: 0.5, y: 0.5, align: "center" as const });
                                      updateBlock(currentPage!.pageId, idx, { annotations: anns });
                                    }}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "2px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)", cursor: "pointer", fontWeight: 700, marginBottom: 8 }}
                                  >
                                    + Add label
                                  </button>
                                  {(d.annotations ?? []).map((a, ai) => (
                                    <div
                                      key={a.id}
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => setSelectedAnnotationId(a.id)}
                                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedAnnotationId(a.id); }}
                                      style={{
                                        marginBottom: 12,
                                        padding: 10,
                                        background: a.id === selectedAnnotationId ? "#eff6ff" : "#f8fafc",
                                        borderRadius: 8,
                                        border: a.id === selectedAnnotationId ? "2px solid #2563eb" : "1px solid #e2e8f0",
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="text"
                                        value={a.text ?? ""}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                          const next = [...(d.annotations ?? [])];
                                          if (next[ai]) next[ai] = { ...next[ai], text: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { annotations: next });
                                        }}
                                        placeholder="Label text"
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", marginBottom: 6 }}
                                      />
                                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }} onClick={(e) => e.stopPropagation()}>
                                        <span style={{ fontSize: 12, color: "#64748b" }}>X %</span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={Math.round((a.x ?? 0.5) * 100)}
                                          onChange={(e) => {
                                            const v = clamp(Number(e.target.value) || 0, 0, 100) / 100;
                                            updateDiagramAnnotation(currentPage!.pageId, idx, a.id, { x: v });
                                          }}
                                          style={{ width: 56, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                        <span style={{ fontSize: 12, color: "#64748b" }}>Y %</span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={100}
                                          value={Math.round((a.y ?? 0.5) * 100)}
                                          onChange={(e) => {
                                            const v = clamp(Number(e.target.value) || 0, 0, 100) / 100;
                                            updateDiagramAnnotation(currentPage!.pageId, idx, a.id, { y: v });
                                          }}
                                          style={{ width: 56, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1" }}
                                        />
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); const next = (d.annotations ?? []).filter((_, i) => i !== ai); updateBlock(currentPage!.pageId, idx, { annotations: next }); if (selectedAnnotationId === a.id) setSelectedAnnotationId(null); }}
                                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #f87171", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </>
                              )}
                              {d.mode === "step" && (
                                <>
                                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Steps</div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const st = Array.isArray(d.steps) ? [...d.steps] : [];
                                      st.push({ id: newId(), title: "", showAnnotationIds: [] });
                                      updateBlock(currentPage!.pageId, idx, { steps: st });
                                    }}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "2px solid rgba(59,130,246,0.35)", background: "rgba(59,130,246,0.08)", cursor: "pointer", fontWeight: 700, marginBottom: 8 }}
                                  >
                                    + Add step
                                  </button>
                                  {(d.steps ?? []).map((s, si) => (
                                    <div key={s.id} style={{ marginBottom: 12, padding: 10, background: "#eff6ff", borderRadius: 8, border: "1px solid #bfdbfe" }}>
                                      <input
                                        type="text"
                                        value={s.title ?? ""}
                                        onChange={(e) => {
                                          const next = [...(d.steps ?? [])];
                                          if (next[si]) next[si] = { ...next[si], title: e.target.value };
                                          updateBlock(currentPage!.pageId, idx, { steps: next });
                                        }}
                                        placeholder="Step title"
                                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #93c5fd", marginBottom: 8 }}
                                      />
                                      <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 4 }}>Show annotations:</div>
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                        {(d.annotations ?? []).map((ann) => {
                                          const showIds = s.showAnnotationIds ?? [];
                                          const checked = showIds.includes(ann.id);
                                          return (
                                            <label key={ann.id} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                              <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                  const next = [...(d.steps ?? [])];
                                                  const nextShow = checked ? showIds.filter((id) => id !== ann.id) : [...showIds, ann.id];
                                                  if (next[si]) next[si] = { ...next[si], showAnnotationIds: nextShow };
                                                  updateBlock(currentPage!.pageId, idx, { steps: next });
                                                }}
                                              />
                                              <span>{ann.text?.trim() || ann.id.slice(0, 8)}</span>
                                            </label>
                                          );
                                        })}
                                        {(d.annotations ?? []).length === 0 && <span style={{ color: "#64748b" }}>Add annotations above first.</span>}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = (d.steps ?? []).filter((_, i) => i !== si);
                                          updateBlock(currentPage!.pageId, idx, { steps: next });
                                        }}
                                        style={{ marginTop: 6, padding: "4px 10px", borderRadius: 6, border: "1px solid #f87171", background: "#fef2f2", color: "#b91c1c", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                                      >
                                        Remove step
                                      </button>
                                    </div>
                                  ))}
                                </>
                              )}
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => setDiagramPickerTarget({ pageId: currentPage!.pageId, blockIndex: idx })}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid rgba(34,197,94,0.35)",
                                    background: "rgba(34,197,94,0.08)",
                                    cursor: "pointer",
                                    fontWeight: 700,
                                  }}
                                >
                                  Replace diagram
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const diagramKey = `${currentPage!.pageId}-${idx}`;
                                    diagramBlockContainerRef.current[diagramKey]?.scrollIntoView({ behavior: "smooth", block: "start" });
                                  }}
                                  style={{
                                    padding: "8px 14px",
                                    borderRadius: 10,
                                    border: "2px solid #64748b",
                                    background: "#f1f5f9",
                                    color: "#475569",
                                    cursor: "pointer",
                                    fontWeight: 600,
                                    fontSize: 13,
                                  }}
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
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
                            </>
                          )}
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

      {addFromBankModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: 20,
          }}
          onClick={() => setAddFromBankModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 20,
              maxWidth: 520,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Add from Question Bank</div>
            <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 600 }}>Topic</label>
            <select
              value={bankTopicKey}
              onChange={(e) => setBankTopicKey(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "2px solid #e2e8f0", marginBottom: 14 }}
            >
              <option value="">— Select topic —</option>
              {taxonomyUnits.map((u) => (
                <optgroup key={u.unit} label={u.unit}>
                  {(u.topics || []).map((t) => (
                    <option key={t.key} value={t.key}>{t.topic}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {bankTopicKey && (
              <>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Questions</div>
                <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
                  {bankQuestions.length === 0 ? (
                    <div style={{ color: "#64748b", fontSize: 13 }}>No questions with this topic.</div>
                  ) : (
                    bankQuestions.map((q) => (
                      <label
                        key={q._id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                          padding: "8px 0",
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBankQuestionIds.has(q._id)}
                          onChange={(e) => {
                            setSelectedBankQuestionIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(q._id);
                              else next.delete(q._id);
                              return next;
                            });
                          }}
                        />
                        <span style={{ fontSize: 13, color: "#374151" }}>
                          {q.question?.slice(0, 80)}{(q.question?.length ?? 0) > 80 ? "…" : ""} {q.marks != null ? `(${q.marks})` : ""}
                        </span>
                      </label>
                    ))
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!id || selectedBankQuestionIds.size === 0) return;
                      api.post(`/lessons/${id}/exam-questions`, { questionIds: Array.from(selectedBankQuestionIds) }).then((res: any) => {
                        const added = res?.data?.added ?? 0;
                        if (added > 0) {
                          api.get(`/lessons/${id}/exam-questions`).then((r: any) => {
                            setAttachedExamQuestions(Array.isArray(r?.data?.questions) ? r.data.questions : []);
                          });
                        }
                        setAddFromBankModalOpen(false);
                      }).catch(() => {});
                    }}
                    disabled={selectedBankQuestionIds.size === 0}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "none",
                      background: selectedBankQuestionIds.size > 0 ? "#4f46e5" : "#e5e7eb",
                      color: selectedBankQuestionIds.size > 0 ? "white" : "#9ca3af",
                      fontWeight: 700,
                      cursor: selectedBankQuestionIds.size > 0 ? "pointer" : "not-allowed",
                    }}
                  >
                    Attach to lesson
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddFromBankModalOpen(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "2px solid #e2e8f0",
                      background: "white",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {diagramPickerTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
          }}
          onClick={() => setDiagramPickerTarget(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 20,
              maxWidth: 420,
              maxHeight: "80vh",
              overflow: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12 }}>Choose diagram</div>
            {visualsList.length === 0 ? (
              <p style={{ color: "#64748b", fontSize: 14 }}>Loading…</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {visualsList.map((v) => (
                  <li key={v._id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (diagramPickerTarget)
                          updateBlock(diagramPickerTarget.pageId, diagramPickerTarget.blockIndex, {
                            visualId: v._id,
                          });
                        setDiagramPickerTarget(null);
                      }}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        textAlign: "left",
                        borderRadius: 8,
                        border: "2px solid #e2e8f0",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      {v.conceptKey}
                      {v.topic ? ` — ${v.topic}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => setDiagramPickerTarget(null)}
              style={{
                marginTop: 14,
                padding: "8px 14px",
                borderRadius: 8,
                border: "2px solid #e2e8f0",
                background: "#f1f5f9",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* PR20: Publish readiness gate modal */}
      {publishGateOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 20,
          }}
          onClick={() => setPublishGateOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 24,
              maxWidth: 440,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 18 }}>This lesson isn't classroom-ready yet</div>
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "#374151", fontWeight: 600 }}>What's missing?</p>
            <ul style={{ margin: "0 0 20px", paddingLeft: 20, fontSize: 14, color: "#4b5563" }}>
              {publishGateIssues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={makeClassroomReadyLoading || !id}
                onClick={async () => {
                  if (!id) return;
                  setMakeClassroomReadyError(null);
                  setMakeClassroomReadyLoading(true);
                  try {
                    const res = await api.post<{
                      ok: boolean;
                      attach?: { added: number; addedIds?: string[] };
                      diagram?: { status: string };
                      plan?: { status: string };
                      review?: { status: string };
                      readiness?: { status: string; signals?: Record<string, unknown> };
                    }>(`/reports/lessons/${id}/make-classroom-ready`, {
                      days: insightsDays ?? 7,
                      attachPractice: true,
                      attachLimit: 10,
                      ensureDiagram: true,
                      regeneratePlan: true,
                      planLimit: 10,
                      markReviewed: true,
                    });
                    const d = res?.data;
                    if (d?.ok) {
                      const listRes = await api.get(`/lessons/${id}/exam-questions`);
                      setAttachedExamQuestions(Array.isArray(listRes?.data?.questions) ? listRes.data.questions : []);
                      const planRes = await api.get(`/reports/lessons/${id}/reteach-plan`);
                      if (planRes?.data?.ok && planRes.data.plan) setReteachPlan(planRes.data.plan);
                      setLesson((prev) =>
                        prev && d?.readiness
                          ? ({ ...prev, readiness: d.readiness as Lesson["readiness"], reviewedAt: d.review?.status === "MARKED" || d.review?.status === "ALREADY_REVIEWED" ? new Date().toISOString() : prev.reviewedAt } as Lesson)
                          : prev
                      );
                      await fetchLessonSmart();
                      const sig = d?.readiness?.signals ?? {};
                      const nextIssues: string[] = [];
                      if ((sig.checkpointCount ?? 0) === 0) nextIssues.push("No checkpoints");
                      if ((sig.diagramCount ?? 0) === 0) nextIssues.push("No diagrams");
                      if ((sig.practiceCount ?? 0) === 0) nextIssues.push("No practice questions attached");
                      if (!sig.isReviewed) nextIssues.push("Lesson not marked as reviewed");
                      setPublishGateIssues(nextIssues);
                      if (nextIssues.length === 0) {
                        setPublishGateOpen(false);
                        setSaveMsg("Ready. Open Classroom mode to start collecting attempts. Or click Publish Lesson when you're ready.");
                        setTimeout(() => setSaveMsg(""), 4000);
                      }
                    }
                  } catch (e: any) {
                    setMakeClassroomReadyError(e?.response?.data?.error ?? e?.message ?? "Failed");
                  } finally {
                    setMakeClassroomReadyLoading(false);
                  }
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #059669",
                  background: "rgba(5,150,105,0.12)",
                  color: "#047857",
                  fontWeight: 700,
                  cursor: makeClassroomReadyLoading ? "not-allowed" : "pointer",
                }}
              >
                {makeClassroomReadyLoading ? "Preparing…" : "Make classroom-ready"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setPublishGateOpen(false);
                  await handlePublishToggle(true);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #94a3b8",
                  background: "#f1f5f9",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Publish anyway
              </button>
              <button
                type="button"
                onClick={() => setPublishGateOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  background: "#f8fafc",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            {makeClassroomReadyError && (
              <div style={{ marginTop: 12, fontSize: 13, color: "#b91c1c" }}>{makeClassroomReadyError}</div>
            )}
          </div>
        </div>
      )}

      {/* PR20: Post-publish "Start classroom mode" CTA */}
      {postPublishClassroomModalOpen && id && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10002,
            padding: 20,
          }}
          onClick={() => setPostPublishClassroomModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 14,
              padding: 24,
              maxWidth: 380,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 900, marginBottom: 12, fontSize: 18 }}>Published.</div>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "#374151" }}>Start Classroom mode?</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setPostPublishClassroomModalOpen(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #e2e8f0",
                  background: "#f8fafc",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setPostPublishClassroomModalOpen(false);
                  navigate(`/teacher/classroom/${id}`);
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "2px solid #2563eb",
                  background: "rgba(37,99,235,0.12)",
                  color: "#2563eb",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Start classroom mode
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EditLessonPage;