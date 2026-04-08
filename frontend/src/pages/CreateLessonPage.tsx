// frontend/src/pages/CreateLesson.tsx — PR-AUTH-UI-3: use useCurrentUser for token/user.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { defaultUrlTransform } from "react-markdown";
import api from "../services/api";
import { toAbsoluteAssetUrl } from "../services/mediaUrl";
import { preprocessMarkdownAssetUrls } from "../utils/assetUrl";
import { LessonMarkdown } from "../components/lesson/LessonMarkdown";
import { LessonBlockContentTextarea } from "../components/lesson/LessonBlockContentTextarea";
import { hasRenderableLessonImageSrc } from "../constants/lessonImageDisplay";
import { hideBrokenLessonImage, LessonImageFrame } from "../components/lesson/LessonImageFrame";
import { LessonImageLightboxProvider } from "../components/lesson/LessonImageLightbox";
import { LessonAutoTextarea } from "../components/lesson/LessonAutoTextarea";
import { sanitizeTeacherMarkdown } from "../utils/lessonTeacherMarkdown";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCreateLessonTaxonomyOptions } from "../hooks/useCreateLessonTaxonomyOptions";
import { CreateLessonTopicSelectors, type TopicSelectionValue } from "../components/TopicSelectors/CreateLessonTopicSelectors";
import { ExistingLessonsPanel } from "../components/ExistingLessonsPanel";
import {
  type LessonBlockType,
  BLOCK_META,
  getBlockStyle,
  toLegacyBlockType,
  PAGE_TYPE_OPTIONS,
} from "../types/lessonBlocks";
import { HowToCreateLessonCallout } from "../components/teacher/HowToCreateLessonCallout";
import { CreateLessonPracticePanel } from "../components/lesson/CreateLessonPracticePanel";
import { AddBlockByRoleSelect } from "../components/lesson/AddBlockByRoleSelect";
import {
  collapseExactDuplicatePaste,
  guardLessonBlockPatchForDuplicatePaste,
  getLessonPasteInsertText,
} from "../utils/lessonEditorPaste";
import { evaluateLessonReadiness } from "../utils/lessonReadiness";
import { LESSON_DESCRIPTION_MAX_LENGTH } from "../constants/lessonDescription";

type HeroType = "none" | "image" | "video" | "animation";

type LessonPageBlock = {
  type: LessonBlockType;
  content: string;
  title?: string;
  role?: string;
};

// Kept for backward compatibility only (UI removed)
type LessonPageHero = {
  type: HeroType;
  src: string;
  caption?: string;
};

type LessonPage = {
  pageId: string;
  title: string;
  order: number;
  pageType?: string;
  hero?: LessonPageHero; // legacy compat
  blocks: LessonPageBlock[];
  checkpoint?: {
    question?: string;
    options?: string[];
    answer?: string;
  };
};

type GcseTier = "" | "foundation" | "higher";

const EXAM_BOARDS = ["AQA", "OCR", "Edexcel", "WJEC"] as const;
const SUBJECTS = [
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "English",
  "History",
  "Geography",
  "Computer Science",
  "Business",
  "Economics",
] as const;

function buildDefaultTitle({
  subTopic,
  mainTopic,
  examBoard,
  level,
}: {
  subTopic?: string;
  mainTopic?: string;
  examBoard?: string;
  level?: string;
}) {
  if (!subTopic) return "";
  const parts = [subTopic];
  if (mainTopic) parts.push(`– ${mainTopic}`);
  const suffix = [examBoard, level].filter(Boolean).join(" ");
  if (suffix) parts.push(`(${suffix})`);
  return parts.join(" ");
}

function buildStarterDescription({
  subTopic,
  mainTopic,
  level,
  examBoard,
}: {
  subTopic?: string;
  mainTopic?: string;
  level?: string;
  examBoard?: string;
}) {
  if (!subTopic) return "";

  const parts = [];
  parts.push(
    `Students will learn the key ideas in ${subTopic}${mainTopic ? ` within ${mainTopic}` : ""}.`
  );
  parts.push(
    `They will be able to explain key terms and apply their understanding to exam-style questions.`
  );

  const ctx = [examBoard, level].filter(Boolean).join(" ");
  if (ctx) parts.push(`(${ctx})`);

  return parts.join(" ");
}

// Shared UI: Phase 2 – youthful modern polish (one radius + spacing scale)
const radius = 10;
const space = 12;
const ui = {
  page: {
    minHeight: "100vh",
    padding: "6px 16px 14px",
    background:
      "linear-gradient(165deg, #f8fafc 0%, #f1f5f9 40%, #ede9fe 100%), radial-gradient(800px 600px at 10% 10%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(600px 500px at 90% 20%, rgba(34,197,94,0.06) 0%, transparent 45%), radial-gradient(500px 400px at 70% 80%, rgba(236,72,153,0.05) 0%, transparent 45%)",
  },
  /** Full-width up to large desktops; was 1200px and felt cramped with preview. */
  shell: {
    width: "100%",
    maxWidth: 1800,
    margin: "0 auto",
    boxSizing: "border-box" as const,
  },
  card: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.88)",
    border: "1.5px solid rgba(15,23,42,0.28)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
    padding: space,
    backdropFilter: "blur(12px)",
  },
  lessonDetailsSection: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.92)",
    border: "1.5px solid rgba(15,23,42,0.22)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
    padding: space,
  },
  pageEditorSection: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.95)",
    border: "1.5px solid rgba(15,23,42,0.22)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
    padding: space,
  },
  section: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.92)",
    border: "1.5px solid rgba(15,23,42,0.22)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
    padding: space,
  },
  sidebar: {
    borderRadius: radius,
    background: "rgba(255,255,255,0.9)",
    border: "1.5px solid rgba(15,23,42,0.28)",
    boxShadow: "0 2px 10px rgba(15,23,42,0.06)",
    padding: 10,
  },
  sectionTitle: { fontWeight: 700, fontSize: "0.9rem", color: "#0f172a", marginBottom: 8 },
  label: { fontWeight: 600, fontSize: "0.8125rem", color: "#475569", marginBottom: 4 },
  labelPrimary: { fontWeight: 600, fontSize: "0.875rem", color: "#0f172a", marginBottom: 6 },
  input: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: radius,
    border: "1.5px solid rgba(15,23,42,0.22)",
    background: "rgba(255,255,255,0.95)",
    outline: "none",
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: radius,
    border: "none",
    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #22c55e 100%)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: "0.9rem",
    boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
  },
  btnSecondary: {
    padding: "8px 12px",
    borderRadius: radius,
    border: "1.5px solid rgba(15,23,42,0.22)",
    background: "rgba(255,255,255,0.7)",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.8125rem",
  },
  btnDanger: {
    padding: "8px 12px",
    borderRadius: radius,
    border: "1px solid rgba(239,68,68,0.2)",
    background: "rgba(239,68,68,0.06)",
    color: "#b91c1c",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.8125rem",
  },
};

function safeStr(v: any, fallback = "") {
  const s = v === undefined || v === null ? "" : String(v);
  return s.trim() ? s : fallback;
}

function newId() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Manual create only: one empty text block; teacher adds further blocks via the editor. */
const MANUAL_CREATE_INITIAL_BLOCKS: LessonPageBlock[] = [{ type: "text", content: "" }];

function sortPages(pages: LessonPage[]) {
  return [...pages].sort((a, b) => (a.order || 0) - (b.order || 0));
}

function blockEditorSizeVariant(type: LessonBlockType): "default" | "long" {
  return type === "keyIdeas" ||
    type === "misconceptions" ||
    type === "examTips" ||
    type === "deeperKnowledge"
    ? "long"
    : "default";
}

function clampOptions(raw: string[]) {
  return raw.map((s) => safeStr(s, "")).slice(0, 4);
}

// ============================
// Upload helpers (per-block)
// ============================

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

const CreateLessonPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useCurrentUser({ watchLocation: true });
  const isAdmin = Boolean(user?.isAdmin || user?.role === "admin" || user?.userType === "admin");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null);
  /** Set when teacher uses practice tools — final submit updates this draft instead of POSTing again. */
  const [draftLessonId, setDraftLessonId] = useState<string | null>(null);
  const [ensuringDraft, setEnsuringDraft] = useState(false);
  /** Loaded when a draft exists — drives Readiness counts + review state (same as Edit lesson). */
  const [draftLessonSnapshot, setDraftLessonSnapshot] = useState<Record<string, unknown> | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [makeClassroomReadyLoading, setMakeClassroomReadyLoading] = useState(false);
  const [makeClassroomReadyError, setMakeClassroomReadyError] = useState<string | null>(null);
  /** Bump to remount practice panel after make-classroom-ready attaches questions. */
  const [practicePanelRefreshKey, setPracticePanelRefreshKey] = useState(0);

  // Upload UI
  const [uploadingKey, setUploadingKey] = useState<string>(""); // pageId:blockIndex
  const [uploadMsg, setUploadMsg] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  // refs for cursor insertion + file picking
  const blockTextareasRef = useRef<Record<string, HTMLTextAreaElement | null>>(
    {}
  );
  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const { options: taxonomyOptions, loading: taxonomyLoading, error: taxonomyError } = useCreateLessonTaxonomyOptions();
  const [titleTouched, setTitleTouched] = useState(false);
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [descriptionTooltipVisible, setDescriptionTooltipVisible] = useState(false);
  const [topicSelection, setTopicSelection] = useState<TopicSelectionValue>({
    subject: "",
    specKey: "",
    mainTopicTitle: "",
    topicKey: "",
    topic: "",
  });

  // Lesson details
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subject: "",
    level: "GCSE",
    board: "" as "" | (typeof EXAM_BOARDS)[number],
    tier: "" as GcseTier,
    topic: "",
    topicKey: "",
    tags: "",
    externalResources: "",
    estimatedDuration: 60,
    shamCoinPrice: 0,
    autoGenerateFromBanks: true,
  });

  // Pages editor (same data model as EditLessonPage)
  const VALID_STARTER_CHECKPOINT = {
    question: "Which statement is correct?",
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
    answer: "Option 1",
  };

  const [pages, setPages] = useState<LessonPage[]>([
    {
      pageId: newId(),
      title: "Page 1",
      order: 1,
      pageType: "",
      hero: { type: "none", src: "", caption: "" }, // legacy compat
      blocks: [...MANUAL_CREATE_INITIAL_BLOCKS],
      checkpoint: { ...VALID_STARTER_CHECKPOINT },
    },
  ]);

  const orderedPages = useMemo(() => sortPages(pages), [pages]);

  const createPreviewMarkdownComponents = useMemo(
    () => ({
      img: ({ ...props }: Record<string, unknown> & { src?: string; alt?: string }) => {
        const rawSrc = safeStr(props.src, "");
        let decoded = rawSrc;
        try {
          if (rawSrc && rawSrc.includes("%")) decoded = decodeURIComponent(rawSrc);
        } catch {
          /* keep decoded */
        }
        const srcAbs = decoded ? (toAbsoluteAssetUrl(decoded) ?? "") : "";
        const finalSrc = srcAbs || decoded || rawSrc;
        if (!hasRenderableLessonImageSrc(rawSrc) || !hasRenderableLessonImageSrc(finalSrc)) return null;
        return (
          <figure className="lesson-image-card-figure">
            <LessonImageFrame variant="secondary" lightboxSrc={finalSrc}>
              <img {...props} src={finalSrc} alt={props.alt || "Lesson image"} onError={hideBrokenLessonImage} />
            </LessonImageFrame>
          </figure>
        );
      },
    }),
    []
  );

  useEffect(() => {
    if (titleTouched) return;
    const autoTitle = buildDefaultTitle({
      subTopic: topicSelection.topic || undefined,
      mainTopic: topicSelection.mainTopicTitle || undefined,
      examBoard: formData.board || undefined,
      level: formData.level || undefined,
    });
    if (autoTitle) {
      setFormData((prev) => ({ ...prev, title: autoTitle }));
    }
  }, [
    topicSelection.topic,
    topicSelection.mainTopicTitle,
    formData.board,
    formData.level,
    titleTouched,
  ]);

  useEffect(() => {
    if (descriptionTouched) return;

    const starter = buildStarterDescription({
      subTopic: topicSelection.topic || undefined,
      mainTopic: topicSelection.mainTopicTitle || undefined,
      level: formData.level || undefined,
      examBoard: formData.board || undefined,
    });

    if (!starter) return;

    setFormData((prev) => ({
      ...prev,
      description: starter.slice(0, LESSON_DESCRIPTION_MAX_LENGTH),
    }));
  }, [
    topicSelection.topic,
    topicSelection.mainTopicTitle,
    formData.level,
    formData.board,
    descriptionTouched,
  ]);

  const handleTopicSelectionChange = (value: TopicSelectionValue) => {
    setTopicSelection(value);
    setFormData((prev) => ({
      ...prev,
      subject: value.subject,
      topic: value.topic,
      topicKey: value.topicKey,
    }));
  };

  // Prefill from Gap Priorities: location.state { specKey, topicKey } from create_lesson action
  const prefilledFromGapRef = useRef(false);
  useEffect(() => {
    if (prefilledFromGapRef.current || taxonomyLoading || !taxonomyOptions) return;
    const state = location.state as { specKey?: string; topicKey?: string } | null;
    const targetSpecKey = state?.specKey?.trim();
    const targetTopicKey = (state?.topicKey ?? "").trim();
    if (!targetSpecKey || !targetTopicKey) return;

    for (const subj of taxonomyOptions.subjects ?? []) {
      for (const spec of subj.specs ?? []) {
        if (spec.specKey !== targetSpecKey) continue;
        for (const main of spec.mainTopics ?? []) {
          for (const sub of main.subTopics ?? []) {
            const matches =
              sub.topicKey === targetTopicKey ||
              (!targetTopicKey.includes(":") &&
                sub.topicSlug === targetTopicKey &&
                sub.topicKey.startsWith(`${targetSpecKey}:`));
            if (matches) {
              prefilledFromGapRef.current = true;
              const val: TopicSelectionValue = {
                subject: subj.subject,
                specKey: spec.specKey,
                mainTopicTitle: main.title,
                topicKey: sub.topicKey,
                topic: sub.title,
              };
              handleTopicSelectionChange(val);
              return;
            }
          }
        }
      }
    }
    prefilledFromGapRef.current = true;
  }, [taxonomyLoading, taxonomyOptions, location.state]);

  const normalizeOrders = (arr: LessonPage[]) =>
    arr
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((p, idx) => ({ ...p, order: idx + 1 }));

  /** Same readiness model as Edit lesson left rail (local draft only — no saved quiz/flashcards until create/draft). */
  const lessonDraftForReadiness = useMemo(
    () => ({
      pages: normalizeOrders(pages),
      topicKey: formData.topicKey || topicSelection.topicKey || "",
      quiz: { questions: [] },
      flashcards: [],
    }),
    [pages, formData.topicKey, topicSelection.topicKey]
  );

  const readinessEval = useMemo(
    () => evaluateLessonReadiness(lessonDraftForReadiness),
    [lessonDraftForReadiness]
  );

  const topicKeyForBankLinks = (formData.topicKey || topicSelection.topicKey || "").trim();

  const readinessDisplay = useMemo(() => {
    if (draftLessonSnapshot && typeof draftLessonSnapshot === "object") {
      try {
        return evaluateLessonReadiness(draftLessonSnapshot);
      } catch {
        return readinessEval;
      }
    }
    return readinessEval;
  }, [draftLessonSnapshot, readinessEval]);

  const isDraftReviewed = useMemo(() => {
    const snap = draftLessonSnapshot as {
      reviewedAt?: string | null;
      readiness?: { signals?: { isReviewed?: boolean } };
    } | null;
    if (!snap) return false;
    return !!snap.reviewedAt || !!snap.readiness?.signals?.isReviewed;
  }, [draftLessonSnapshot]);

  useEffect(() => {
    if (!draftLessonId) {
      setDraftLessonSnapshot(null);
      return;
    }
    let cancelled = false;
    api
      .get(`/lessons/${draftLessonId}`)
      .then((res) => {
        if (!cancelled && res?.data && typeof res.data === "object") {
          setDraftLessonSnapshot(res.data as Record<string, unknown>);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [draftLessonId, practicePanelRefreshKey]);

  // ---------------------------
  // Basic handlers
  // ---------------------------
  const onChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "estimatedDuration" || name === "shamCoinPrice"
          ? Number(value)
          : (value as any),
    }));
  };

  // ---------------------------
  // Pages editor helpers
  // ---------------------------
  const addPage = () => {
    setPages((prev) => {
      const next = normalizeOrders(prev);
      const nextOrder = next.length + 1;
      return [
        ...next,
        {
          pageId: newId(),
          title: `Page ${nextOrder}`,
          order: nextOrder,
          pageType: "",
          hero: { type: "none", src: "", caption: "" }, // legacy compat
          blocks: [{ type: "text", content: "" }],
          checkpoint: { question: "", options: ["", "", "", ""], answer: "" },
        },
      ];
    });
  };

  const removePage = (pageId: string) => {
    if (!window.confirm("Delete this page?")) return;

    setPages((prev) => {
      const next = prev.filter((p) => p.pageId !== pageId);
      const normalized = normalizeOrders(next);
      return normalized.length
        ? normalized
        : [
            {
              pageId: newId(),
              title: "Page 1",
              order: 1,
              pageType: "",
              hero: { type: "none", src: "", caption: "" },
              blocks: [{ type: "text", content: "" }],
              checkpoint: { ...VALID_STARTER_CHECKPOINT },
            },
          ];
    });
  };

  const movePage = (pageId: string, dir: -1 | 1) => {
    setPages((prev) => {
      const ordered = normalizeOrders(prev);
      const idx = ordered.findIndex((p) => p.pageId === pageId);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= ordered.length) return ordered;

      const copy = [...ordered];
      const tmp = copy[idx];
      copy[idx] = copy[to];
      copy[to] = tmp;

      return normalizeOrders(copy);
    });
  };

  const updatePage = (pageId: string, patch: Partial<LessonPage>) => {
    setPages((prev) =>
      prev.map((p) => (p.pageId === pageId ? { ...p, ...patch } : p))
    );
  };

  const addBlock = (
    pageId: string,
    type: LessonBlockType,
    opts?: { role?: string; title?: string; initialContent?: string; insertAt?: number }
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        const block: LessonPageBlock = {
          type,
          content: opts?.initialContent ?? "",
        };
        if (opts?.role?.trim()) block.role = opts.role.trim();
        if (opts?.title !== undefined) block.title = opts.title ?? "";
        const insertAt = opts?.insertAt;
        if (typeof insertAt === "number" && insertAt >= 0 && insertAt <= blocks.length) {
          blocks.splice(insertAt, 0, block);
        } else {
          blocks.push(block);
        }
        return { ...p, blocks };
      })
    );
  };

  const removeBlock = (pageId: string, blockIndex: number) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        blocks.splice(blockIndex, 1);
        return {
          ...p,
          blocks: blocks.length ? blocks : [{ type: "text", content: "" }],
        };
      })
    );
  };

  const moveBlock = (pageId: string, from: number, dir: -1 | 1) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        const to = from + dir;
        if (
          from < 0 ||
          from >= blocks.length ||
          to < 0 ||
          to >= blocks.length
        )
          return p;
        const tmp = blocks[from];
        blocks[from] = blocks[to];
        blocks[to] = tmp;
        return { ...p, blocks };
      })
    );
  };

  const updateBlock = (
    pageId: string,
    blockIndex: number,
    patch: Partial<LessonPageBlock>
  ) => {
    const guarded = guardLessonBlockPatchForDuplicatePaste(patch as Record<string, unknown>);
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        if (blockIndex < 0 || blockIndex >= blocks.length) return p;
        blocks[blockIndex] = { ...blocks[blockIndex], ...guarded };
        return { ...p, blocks };
      })
    );
  };

  const updateCheckpoint = (
    pageId: string,
    patch: Partial<NonNullable<LessonPage["checkpoint"]>>
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const cp = p.checkpoint || {
          question: "",
          options: ["", "", "", ""],
          answer: "",
        };
        return { ...p, checkpoint: { ...cp, ...patch } };
      })
    );
  };

  const updateCheckpointOption = (
    pageId: string,
    optIndex: number,
    value: string
  ) => {
    const collapsed = collapseExactDuplicatePaste(value);
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const cp = p.checkpoint || {
          question: "",
          options: ["", "", "", ""],
          answer: "",
        };
        const options = Array.isArray(cp.options) ? [...cp.options] : [];
        while (options.length < 4) options.push("");
        options[optIndex] = collapsed;
        return { ...p, checkpoint: { ...cp, options } };
      })
    );
  };

  // ---------------------------
  // Block upload (Supabase Storage)
  // ---------------------------
  const uploadIntoBlock = async (
    file: File,
    pageId: string,
    blockIndex: number,
    getCurrentValue: () => string,
    setValue: (next: string) => void
  ) => {
    if (!file) return;

    const ok =
      file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!ok) {
      alert("Please upload an image (png/jpg/gif/webp) or a video (mp4/webm).");
      return;
    }

    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }

    const teacherId = user?._id ? String(user._id) : "teacher_unknown";
    const folder = `lesson-media/teacher_${teacherId}/lesson_new/page_${pageId}/block_${blockIndex}`;
    const key = `${pageId}:${blockIndex}`;

    try {
      setUploadingKey(key);
      setUploadMsg("");

      const form = new FormData();
      form.append("file", file);
      const isVideo = file.type.startsWith("video/");
      if (!isVideo) form.append("folder", folder);

      const endpoint = isVideo
        ? "uploads/video"
        : `uploads/image?folder=${encodeURIComponent(folder)}`;

      const res = await api.post(endpoint, form);
      const publicUrl = res.data?.url;
      if (!publicUrl) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      const absoluteUrl = toAbsoluteAssetUrl(publicUrl);
      const insert = buildMarkdownForFile(absoluteUrl, file);
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
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.details ?? data.msg ?? data.message)
          : undefined;
      const msg =
        typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
      alert(`Upload failed. ${msg}`);
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

  // ---------------------------
  // Validation + Submit
  // ---------------------------
  const validate = () => {
    if (!formData.title.trim()) return "Lesson Title is required.";
    if (!formData.description.trim()) return "Short Description is required.";
    if (!formData.subject.trim()) return "Subject is required.";
    if (!formData.level.trim()) return "Level is required.";
    if (!formData.board.trim())
      return "Board is required (AQA/OCR/Edexcel/WJEC).";
    if (!formData.topic.trim() && !formData.topicKey.trim()) return "Select a sub-topic (or enter Topic) is required.";

    if (formData.level === "GCSE" && !formData.tier.trim()) {
      return "Tier is required for GCSE lessons (Foundation or Higher).";
    }

    const p = normalizeOrders(pages);
    if (p.length === 0) return "Add at least 1 page.";

    const anyContent = p.some((pg) =>
      (pg.blocks || []).some((b) => safeStr(b.content, "").length > 0)
    );
    if (!anyContent) return "Add some content in the page blocks.";

    // checkpoint sanity (optional)
    const badCheckpoint = p.find((pg) => {
      const q = safeStr(pg.checkpoint?.question, "");
      const opts = clampOptions((pg.checkpoint?.options || []) as string[]);
      const ans = safeStr(pg.checkpoint?.answer, "");
      if (!q && !opts.join("").trim() && !ans) return false;
      const nonEmptyOpts = opts.filter((x) => safeStr(x, "").length > 0);
      if (!q) return true;
      if (nonEmptyOpts.length < 2) return true;
      if (ans && !nonEmptyOpts.some((o) => o.trim() === ans.trim()))
        return true;
      return false;
    });
    if (badCheckpoint)
      return `Checkpoint on "${badCheckpoint.title}" needs question + at least 2 options (and answer must match an option).`;

    const placeholderPrompts = /^(which statement is correct\??\s*|choose the correct\??\s*|option [1234]\??\s*|quick check\??\s*)$/i;
    const checkpointPages = p.filter((pg) => (pg.blocks || []).some((b) => toLegacyBlockType(b.type) === "checkpoint"));
    for (const pg of checkpointPages) {
      const q = safeStr(pg.checkpoint?.question, "").trim();
      if (q && placeholderPrompts.test(q)) {
        return "Replace the placeholder checkpoint question with a real exam-style question (e.g. 'Explain why...', 'Describe...', 'Compare...').";
      }
    }

    return "";
  };

  /** Minimum fields for POST /lessons (draft) — used by practice tools; does not require worked example or block content. */
  const validateForDraftTools = (): string => {
    if (!formData.title.trim()) return "Lesson title is required.";
    if (!formData.description.trim()) return "Short description is required.";
    if (!formData.subject.trim()) return "Subject is required.";
    if (!formData.level.trim()) return "Level is required.";
    if (!formData.board.trim()) return "Board is required (AQA/OCR/Edexcel/WJEC).";
    if (!formData.topic.trim() && !formData.topicKey.trim()) return "Select a sub-topic (or enter Topic).";
    if (formData.level === "GCSE" && !formData.tier.trim()) {
      return "Tier is required for GCSE lessons (Foundation or Higher).";
    }
    const p = normalizeOrders(pages);
    if (p.length === 0) return "Add at least 1 page.";
    return "";
  };

  const buildLessonPayload = (): Record<string, unknown> => {
    const sanitizedPages = normalizeOrders(pages).map((p) => ({
      pageId: p.pageId,
      title: safeStr(p.title, `Page ${p.order}`),
      order: p.order,
      pageType: safeStr(p.pageType, ""),
      hero: { type: "none" as const, src: "", caption: "" },
      blocks: (p.blocks || []).map((b) => {
        const blockType = toLegacyBlockType(b.type);
        const out: Record<string, unknown> = {
          type: blockType,
          content: sanitizeTeacherMarkdown(String(b.content || "")),
        };
        if (typeof b.title === "string" && b.title.trim()) out.title = b.title.trim();
        if (typeof b.role === "string" && b.role.trim()) out.role = b.role.trim();
        if (blockType === "checkpoint" && p.checkpoint) {
          out.prompt = safeStr(p.checkpoint.question, "");
          out.options = clampOptions((p.checkpoint.options || []) as string[]);
          out.correctAnswer = safeStr(p.checkpoint.answer, "");
        }
        return out;
      }),
      checkpoint: p.checkpoint
        ? {
            question: safeStr(p.checkpoint.question, ""),
            options: clampOptions((p.checkpoint.options || []) as string[]),
            answer: safeStr(p.checkpoint.answer, ""),
          }
        : { question: "", options: ["", "", "", ""], answer: "" },
    }));

    const payload: Record<string, unknown> = {
      title: formData.title,
      description: formData.description,
      subject: formData.subject,
      level: formData.level,
      board: formData.board,
      topic: formData.topic || topicSelection.mainTopicTitle || "",
      tags: formData.tags,
      content: "Structured lesson (see pages)",
      externalResources: formData.externalResources,
      estimatedDuration: formData.estimatedDuration,
      shamCoinPrice: formData.shamCoinPrice,
      pages: sanitizedPages,
    };
    if (formData.topicKey.trim()) {
      payload.topicKey = formData.topicKey.trim();
      if (topicSelection.specKey) payload.specKey = topicSelection.specKey;
      if (topicSelection.mainTopicTitle) payload.mainTopic = topicSelection.mainTopicTitle;
      if (topicSelection.topic) payload.subTopic = topicSelection.topic;
    }

    if (formData.level === "GCSE" && formData.tier) payload.tier = formData.tier;
    payload.autoGenerateFromBanks = !!formData.autoGenerateFromBanks;
    return payload;
  };

  const ensureLessonId = async (): Promise<
    { ok: true; id: string } | { ok: false; message: string }
  > => {
    if (draftLessonId) return { ok: true, id: draftLessonId };
    const err = validateForDraftTools();
    if (err) return { ok: false, message: err };
    try {
      setEnsuringDraft(true);
      setError("");
      const payload = buildLessonPayload();
      const res = await api.post(`/lessons`, payload);
      const id = res?.data?.lesson?._id || res?.data?.lesson?.id;
      if (!id) return { ok: false, message: "Lesson saved but no id returned." };
      const sid = String(id);
      setDraftLessonId(sid);
      return { ok: true, id: sid };
    } catch (e: unknown) {
      const errObj = e as { response?: { data?: { message?: string; msg?: string } } };
      const msg =
        errObj?.response?.data?.message ||
        errObj?.response?.data?.msg ||
        (e instanceof Error ? e.message : null) ||
        "Failed to save draft lesson.";
      return { ok: false, message: typeof msg === "string" ? msg : "Failed to save draft lesson." };
    } finally {
      setEnsuringDraft(false);
    }
  };

  const handleSubmit = async () => {
    const msg = validate();
    if (msg) {
      setError(msg);
      setSuccess("");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const payload = buildLessonPayload();

      const res = draftLessonId
        ? await api.put(`/lessons/${draftLessonId}`, payload)
        : await api.post(`/lessons`, payload);
      const data = res?.data;

      const gen = data?.autoGenerateResult;
      const lessonId =
        data?.lesson?._id || data?.lesson?.id || (draftLessonId ? draftLessonId : undefined);
      if (gen) {
        const parts: string[] = [];
        if (gen.flashcardsAdded) parts.push(`${gen.flashcardsAdded} flashcards`);
        if (gen.quizAdded) parts.push(`${gen.quizAdded} quiz questions`);
        if (gen.assessmentAdded) parts.push(`${gen.assessmentAdded} assessment questions`);
        if (gen.pastPapersAdded) parts.push(`${gen.pastPapersAdded} past papers`);
        const genMsg = parts.length > 0 ? ` Attached ${parts.join(", ")}.` : "";
        setSuccess(`✅ Lesson created successfully!${genMsg}`);
        if (lessonId) setCreatedLessonId(String(lessonId));
      } else {
        setSuccess("✅ Lesson created successfully!");
        if (lessonId) setCreatedLessonId(String(lessonId));
      }
      setTimeout(() => navigate("/teacher-dashboard"), 700);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.message || err?.message || "Failed to create lesson."
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // Render
  // ---------------------------
  return (
    <LessonImageLightboxProvider>
    <>
      <style>{`.create-lesson-page input:focus, .create-lesson-page select:focus, .create-lesson-page textarea:focus { border-color: rgba(59,130,246,0.5); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); outline: none; }`}</style>
      <div className="create-lesson-page" data-lesson-editor="true" style={ui.page}>
      <div className="create-lesson-shell" style={ui.shell}>
        {/* Top bar: Back + Create Lesson only */}
        <div
          style={{
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Link
            to="/teacher-dashboard"
            style={{ color: "#6366f1", textDecoration: "none", fontWeight: 600, fontSize: "0.875rem" }}
          >
            ← Back to Teacher Dashboard
          </Link>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...ui.btnPrimary,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Creating..." : "Create Lesson"}
          </button>
        </div>
        {/* Status line: error/success/upload (compact) */}
        {(error || success || uploadMsg) ? (
          <div style={{ marginBottom: 8, fontSize: "0.8125rem", color: error ? "#b91c1c" : "#15803d" }}>
            {error || success || uploadMsg}
            {success && createdLessonId ? (
              <span style={{ marginLeft: 6 }}>
                <Link to={`/edit-lesson/${createdLessonId}`} style={{ color: "#2563eb", fontWeight: 600 }}>
                  Edit Lesson → Revision Materials / Quiz
                </Link>
              </span>
            ) : null}
          </div>
        ) : null}

        <div style={ui.card} className="create-lesson-editor-column">
            <div className="create-lesson-editor-grid">
            {/* LEFT: Pages sidebar — desktop: sticky in wide layout (see App.css) */}
            <aside
              className="lesson-editor-sidebar-sticky create-lesson-left-rail"
              style={{
                minWidth: 0,
                ...ui.sidebar,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#0f172a", marginBottom: 6 }}>
                Teacher editor
              </div>
              <HowToCreateLessonCallout bodyCopy="Start here before filling in exam board, subject, topic, quizzes and practice." />
              <div style={{ ...ui.sectionTitle, marginBottom: 2 }}>Pages</div>
              <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: 8 }}>
                Add pages → edit in main area.
              </div>

              <button
                onClick={addPage}
                style={{ ...ui.btnSecondary, width: "100%", marginBottom: 8 }}
              >
                + Add page
              </button>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {orderedPages.map((p, idx) => (
                  <div
                    key={p.pageId || idx}
                    style={{
                      borderRadius: radius,
                      padding: 8,
                      background: "rgba(248,250,252,0.8)",
                      border: "1.5px solid rgba(15,23,42,0.22)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#0f172a", marginBottom: 6 }}>
                      {p.title || `Page ${p.order}`}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => movePage(p.pageId, -1)}
                        disabled={p.order === 1}
                        style={{ ...ui.btnSecondary, flex: 1, padding: "6px 8px" }}
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => movePage(p.pageId, 1)}
                        disabled={p.order === orderedPages.length}
                        style={{ ...ui.btnSecondary, flex: 1, padding: "6px 8px" }}
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removePage(p.pageId)}
                        disabled={orderedPages.length === 1}
                        style={{ ...ui.btnDanger, flex: 1, padding: "6px 8px" }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 14,
                  border: "2px solid rgba(0,0,0,0.08)",
                  background: "white",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: "0.875rem", color: "#111827" }}>Readiness</span>
                  <a
                    href="/docs/TEACHER_LESSON_GUIDES_INDEX.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "#64748b" }}
                  >
                    What is this?
                  </a>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: "0.8rem",
                      fontWeight: "bold",
                      background: readinessDisplay.classroomReady
                        ? "#c6f6d5"
                        : readinessDisplay.minimumPublishable
                          ? "#fef3c7"
                          : "#e5e7eb",
                      color: readinessDisplay.classroomReady
                        ? "#22543d"
                        : readinessDisplay.minimumPublishable
                          ? "#92400e"
                          : "#4b5563",
                    }}
                  >
                    {readinessDisplay.classroomReady
                      ? "Classroom-ready"
                      : readinessDisplay.minimumPublishable
                        ? "Ready to publish"
                        : "Needs review"}
                  </span>
                </div>
                <ul style={{ margin: "0 0 10px", paddingLeft: 20, fontSize: 13, color: "#374151" }}>
                  <li>Pages: {readinessDisplay.counts.pages}</li>
                  <li>Checkpoints: {readinessDisplay.counts.checkpoints}</li>
                  <li>Diagrams: {readinessDisplay.counts.diagrams}</li>
                  <li>Quiz: {readinessDisplay.counts.quizQuestions}</li>
                  <li>Flashcards: {readinessDisplay.counts.flashcards}</li>
                  <li>Practice: {readinessDisplay.counts.practiceAttached}</li>
                  <li>Misconceptions: {readinessDisplay.counts.misconceptions}</li>
                  <li>Reviewed: {isDraftReviewed ? "Yes" : "No"}</li>
                </ul>
                {draftLessonId ? (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    <Link
                      to={`/teacher/misconceptions?lessonId=${draftLessonId}`}
                      style={{ color: "#2563eb", textDecoration: "none", marginRight: 12 }}
                    >
                      View misconceptions →
                    </Link>
                    <Link
                      to={`/teacher/reteach-plans?lessonId=${draftLessonId}`}
                      style={{ color: "#2563eb", textDecoration: "none" }}
                    >
                      View reteach plan →
                    </Link>
                  </div>
                ) : null}
                {draftLessonId ? (
                  <>
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={reviewLoading}
                        onClick={async () => {
                          if (!draftLessonId) return;
                          setReviewLoading(true);
                          try {
                            const res = await api.post(`/lessons/${draftLessonId}/review`, {
                              reviewed: !isDraftReviewed,
                            });
                            const data = res?.data as {
                              reviewedAt?: string | null;
                              readiness?: unknown;
                            };
                            setDraftLessonSnapshot((prev) => {
                              const base = (prev || {}) as Record<string, unknown>;
                              return {
                                ...base,
                                reviewedAt: data?.reviewedAt ?? base.reviewedAt,
                                readiness: data?.readiness ?? base.readiness,
                              };
                            });
                          } finally {
                            setReviewLoading(false);
                          }
                        }}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 8,
                          border: isDraftReviewed ? "2px solid #94a3b8" : "2px solid #22c55e",
                          background: isDraftReviewed ? "#f1f5f9" : "rgba(34,197,94,0.12)",
                          cursor: reviewLoading ? "not-allowed" : "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {reviewLoading ? "Updating…" : isDraftReviewed ? "Unmark review" : "Mark as reviewed"}
                      </button>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={makeClassroomReadyLoading}
                        onClick={async () => {
                          if (!draftLessonId) return;
                          setMakeClassroomReadyError(null);
                          setMakeClassroomReadyLoading(true);
                          try {
                            const res = await api.post<{
                              ok?: boolean;
                              readiness?: unknown;
                              review?: { status?: string };
                              attach?: { added?: number };
                            }>(`/reports/lessons/${draftLessonId}/make-classroom-ready`, {
                              days: 7,
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
                            setDraftLessonSnapshot((prev) => {
                              if (!prev) return prev;
                              const p = prev as { reviewedAt?: string; readiness?: unknown };
                              return {
                                ...prev,
                                readiness: d.readiness ?? p.readiness,
                                reviewedAt:
                                  d.review?.status === "MARKED" || d.review?.status === "ALREADY_REVIEWED"
                                    ? new Date().toISOString()
                                    : p.reviewedAt,
                              };
                            });
                            setPracticePanelRefreshKey((k) => k + 1);
                            setUploadMsg(
                              `Done: +${d.attach?.added ?? 0} practice · diagram · plan · reviewed`
                            );
                            setTimeout(() => setUploadMsg(""), 5000);
                          } catch (e: unknown) {
                            const err = e as { response?: { data?: { error?: string; message?: string } } };
                            setMakeClassroomReadyError(
                              err?.response?.data?.error ??
                                err?.response?.data?.message ??
                                (e instanceof Error ? e.message : null) ??
                                "Make classroom-ready failed"
                            );
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
                    </div>
                    {makeClassroomReadyError ? (
                      <div style={{ marginTop: 6, fontSize: 13, color: "#b91c1c" }}>{makeClassroomReadyError}</div>
                    ) : null}
                  </>
                ) : (
                  <p style={{ margin: "8px 0 0", fontSize: "0.68rem", color: "#64748b", lineHeight: 1.45 }}>
                    Save a draft lesson first (use Practice questions below). Then counts and actions match the server,
                    same as Edit lesson.
                  </p>
                )}
              </div>

              <div style={{ ...ui.sectionTitle, marginTop: 16, marginBottom: 4 }}>Topic banks</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 4 }}>
                <Link
                  to={
                    topicKeyForBankLinks
                      ? `/teacher/topic-banks/flashcards?topicKey=${encodeURIComponent(topicKeyForBankLinks)}`
                      : "/teacher/topic-banks/flashcards"
                  }
                  style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                >
                  Flashcards bank →
                </Link>
                <Link
                  to={
                    topicKeyForBankLinks
                      ? `/teacher/topic-banks/quizzes?topicKey=${encodeURIComponent(topicKeyForBankLinks)}`
                      : "/teacher/topic-banks/quizzes"
                  }
                  style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                >
                  Quiz bank →
                </Link>
                <Link
                  to={
                    topicKeyForBankLinks
                      ? `/teacher/topic-banks/past-papers?topicKey=${encodeURIComponent(topicKeyForBankLinks)}`
                      : "/teacher/topic-banks/past-papers"
                  }
                  style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2563eb", textDecoration: "none" }}
                >
                  Past papers bank →
                </Link>
              </div>
              {!topicKeyForBankLinks ? (
                <p style={{ margin: "0 0 10px", fontSize: "0.68rem", color: "#64748b", lineHeight: 1.45 }}>
                  Select a sub-topic above to open banks with this topic pre-selected.
                </p>
              ) : null}

              <CreateLessonPracticePanel
                key={practicePanelRefreshKey}
                lessonId={draftLessonId}
                parentEnsuring={ensuringDraft}
                ensureLessonId={ensureLessonId}
              />
            </aside>

            {/* MIDDLE: lesson details + page editors */}
            <main className="create-lesson-main-column" style={{ minWidth: 0 }}>
              {/* Lesson details (lighter weight so Page editor is main canvas) */}
              <div style={ui.lessonDetailsSection}>
                <div>
                <div style={ui.sectionTitle}>Lesson details</div>

                {/* SS2 layout: 3-column grid, no external CSS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 16,
                    alignItems: "end",
                    marginBottom: 16,
                  }}
                >
                  {/* Row 1: Title (2 cols) + Exam board (1 col) */}
                  <div style={{ gridColumn: "1 / span 2" }}>
                    <label style={{ display: "block" }}>
                      <div style={ui.labelPrimary}>Title *</div>
                      <input
                        name="title"
                        value={formData.title}
                        onChange={(e) => {
                          onChange(e);
                          setTitleTouched(true);
                        }}
                        placeholder="Lesson title"
                        style={ui.input}
                      />
                    </label>
                  </div>
                  <div style={{ gridColumn: "3 / span 1" }}>
                    <label style={{ display: "block" }}>
                      <div style={ui.labelPrimary}>Exam board *</div>
                      <select
                        name="board"
                        value={formData.board}
                        onChange={onChange}
                        style={ui.input}
                      >
                        <option value="">Select board…</option>
                        {EXAM_BOARDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Row 2: Subject + Spec + Level */}
                  <CreateLessonTopicSelectors
                    options={taxonomyOptions}
                    loading={taxonomyLoading}
                    error={taxonomyError}
                    value={topicSelection}
                    onChange={handleTopicSelectionChange}
                    showTopicDisplay={true}
                    selectStyle={ui.input}
                    labelStyle={ui.label}
                    renderGridCells={({ subject, spec, mainTopic, subTopic, topicDisplay, errorNode }) => (
                      <>
                        {/* Row 2: Subject | Topic (display) | Level */}
                        <div style={{ gridColumn: "1 / span 1" }}>{subject}</div>
                        <div style={{ gridColumn: "2 / span 1" }}>{topicDisplay}</div>
                        <div style={{ gridColumn: "3 / span 1" }}>
                          <label style={{ display: "block" }}>
                            <div style={ui.label}>Level *</div>
                            <select
                              name="level"
                              value={formData.level}
                              onChange={(e) => {
                                const value = e.target.value;
                                setFormData((prev) => ({
                                  ...prev,
                                  level: value,
                                  tier: value === "GCSE" ? prev.tier : "",
                                }));
                              }}
                              style={ui.input}
                            >
                              <option value="KS3">KS3</option>
                              <option value="GCSE">GCSE</option>
                              <option value="A-Level">A-Level</option>
                            </select>
                          </label>
                        </div>
                        {/* Row 3: Spec | Main topic | Sub-topic */}
                        <div style={{ gridColumn: "1 / span 1" }}>{spec}</div>
                        <div style={{ gridColumn: "2 / span 1" }}>{mainTopic}</div>
                        <div style={{ gridColumn: "3 / span 1" }}>{subTopic}</div>
                        {errorNode ? (
                          <div style={{ gridColumn: "1 / -1" }}>{errorNode}</div>
                        ) : null}
                      </>
                    )}
                  />

                  {/* Row 4: GCSE Tier (2 cols) + Estimated duration (1 col) */}
                  <div style={{ gridColumn: "1 / span 2" }}>
                    {formData.level === "GCSE" ? (
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>GCSE Tier *</div>
                        <select
                          name="tier"
                          value={formData.tier}
                          onChange={onChange}
                          style={ui.input}
                        >
                          <option value="">Select tier…</option>
                          <option value="foundation">Foundation</option>
                          <option value="higher">Higher</option>
                        </select>
                      </label>
                    ) : (
                      <div />
                    )}
                  </div>
                  <div style={{ gridColumn: "3 / span 1" }}>
                    <label style={{ display: "block" }}>
                      <div style={ui.label}>Estimated duration (mins)</div>
                      <input
                        name="estimatedDuration"
                        type="number"
                        value={formData.estimatedDuration}
                        onChange={onChange}
                        style={ui.input}
                      />
                    </label>
                  </div>
                </div>

                {formData.topicKey.trim() ? (
                  <ExistingLessonsPanel
                    topicKey={formData.topicKey}
                    currentUserId={user?._id ? String(user._id) : undefined}
                    layout="inline"
                    style={{ marginBottom: 16 }}
                  />
                ) : null}

                {isAdmin && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block" }}>
                      <div style={ui.label}>ShamCoin price</div>
                      <input
                        name="shamCoinPrice"
                        type="number"
                        value={formData.shamCoinPrice}
                        onChange={onChange}
                        style={ui.input}
                      />
                    </label>
                  </div>
                )}

                <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      background: "#f9fafb",
                      padding: "10px 12px",
                      marginTop: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#111827" }}>
                        Auto-generate from topic banks
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#4b5563", marginTop: 2 }}>
                        Attaches starter quizzes and flashcards from published banks (editable). Only questions for the selected sub-topic will be attached.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      style={{ width: 16, height: 16, flexShrink: 0 }}
                      checked={formData.autoGenerateFromBanks}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          autoGenerateFromBanks: e.target.checked,
                        }))
                      }
                    />
                  </div>

                <label style={{ display: "block", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={ui.label}>
                      Short lesson summary (max {LESSON_DESCRIPTION_MAX_LENGTH} characters) *
                    </span>
                    <span
                      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
                      onMouseEnter={() => setDescriptionTooltipVisible(true)}
                      onMouseLeave={() => setDescriptionTooltipVisible(false)}
                    >
                      <button
                        type="button"
                        aria-label="Good example"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          border: "1px solid #d1d5db",
                          fontSize: "0.75rem",
                          color: "#4b5563",
                          background: descriptionTooltipVisible ? "#f3f4f6" : "transparent",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        i
                      </button>
                      {descriptionTooltipVisible && (
                        <div
                          style={{
                            pointerEvents: "none",
                            position: "absolute",
                            left: "50%",
                            top: "100%",
                            zIndex: 50,
                            marginTop: 8,
                            width: "min(384px, 90vw)",
                            transform: "translateX(-50%)",
                            borderRadius: 6,
                            border: "1px solid #e5e7eb",
                            background: "white",
                            padding: 12,
                            fontSize: "0.75rem",
                            color: "#374151",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Good example</div>
                          <div>
                            Students will learn about the structure of animal and plant cells, identify key organelles, and explain how each organelle supports cell function. They will apply this knowledge to GCSE-style questions.
                          </div>
                          <div style={{ marginTop: 8, color: "#6b7280" }}>
                            Keep it to 2–3 sentences. Focus on what students will learn.
                          </div>
                        </div>
                      )}
                    </span>
                  </div>
                  <LessonAutoTextarea
                    editorVariant="plain"
                    name="description"
                    value={formData.description}
                    maxLength={LESSON_DESCRIPTION_MAX_LENGTH}
                    minHeightPx={160}
                    onChange={(v) => {
                      setDescriptionTouched(true);
                      setFormData((prev) => ({ ...prev, description: v }));
                    }}
                    placeholder="Students will learn…"
                    style={{ fontSize: "0.9375rem" }}
                  />
                  <div
                    style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}
                    aria-live="polite"
                  >
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Lesson objective — what students will learn in this lesson.
                    </span>
                    <span
                      style={{
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color:
                          formData.description.length >= LESSON_DESCRIPTION_MAX_LENGTH
                            ? "#b45309"
                            : formData.description.length >= LESSON_DESCRIPTION_MAX_LENGTH * 0.9
                              ? "#b45309"
                              : "#64748b",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formData.description.length} / {LESSON_DESCRIPTION_MAX_LENGTH} characters
                    </span>
                  </div>
                  {formData.description.length >= LESSON_DESCRIPTION_MAX_LENGTH ? (
                    <div
                      role="status"
                      style={{
                        marginTop: 6,
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "#b45309",
                      }}
                    >
                      Character limit reached
                    </div>
                  ) : null}
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setDescriptionTouched(false)}
                      style={{
                        fontSize: "0.75rem",
                        color: "#2563eb",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Reset to suggested description
                    </button>
                  </div>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                  <label style={{ display: "block" }}>
                    <div style={ui.label}>Tags (comma separated)</div>
                    <input
                      name="tags"
                      value={formData.tags}
                      onChange={onChange}
                      style={ui.input}
                    />
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                      Use tags to help organise and find lessons later (e.g. microscopy, exam-practice, higher-tier).
                    </div>
                  </label>

                  <label style={{ display: "block" }}>
                    <div style={ui.label}>External resources (comma URLs)</div>
                    <input
                      name="externalResources"
                      value={formData.externalResources}
                      onChange={onChange}
                      style={ui.input}
                    />
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                      Optional links to useful external resources (e.g. BBC Bitesize, videos, simulations). These support the lesson but are not required.
                    </div>
                  </label>
                </div>
                </div>
              </div>

              {/* Editing Page cards (main canvas – stronger emphasis) */}
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                {orderedPages.map((pg) => (
                  <div key={pg.pageId} style={ui.pageEditorSection}>
                    <div style={{ ...ui.sectionTitle, marginBottom: 12 }}>
                      Editing Page: {pg.title || `Page ${pg.order}`}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                      <AddBlockByRoleSelect
                        placeholderLabel="+ Add block by role…"
                        selectStyle={{
                          ...ui.input,
                          minWidth: 200,
                          padding: "8px 12px",
                          fontWeight: 600,
                        }}
                        onChoose={(opt) =>
                          addBlock(pg.pageId, opt.type, {
                            role: opt.role,
                            title: opt.title,
                            initialContent: opt.type === "checkpoint" ? "" : "",
                          })
                        }
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>Page title</div>
                        <input
                          value={safeStr(pg.title, "")}
                          onChange={(e) => updatePage(pg.pageId, { title: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>Page type</div>
                        <select
                          value={safeStr(pg.pageType, "")}
                          onChange={(e) => updatePage(pg.pageId, { pageType: e.target.value })}
                          style={ui.input}
                        >
                          <option value="">Select…</option>
                          {PAGE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          {safeStr(pg.pageType, "").trim() &&
                            !PAGE_TYPE_OPTIONS.includes(safeStr(pg.pageType, "")) && (
                              <option value={safeStr(pg.pageType, "")}>{safeStr(pg.pageType, "")}</option>
                            )}
                        </select>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                          Optional: helps organise pages (e.g. Explanation, Checkpoint, Misconceptions).
                        </div>
                      </label>
                    </div>

                    {/* Blocks */}
                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      {(pg.blocks || []).map((b, idx) => {
                        const key = `${pg.pageId}:${idx}`;
                        const isUploading = uploadingKey === key;

                        return (
                          <div key={key} style={getBlockStyle(b.type)}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              {b.type !== "text" && (
                                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#334155" }}>{BLOCK_META[b.type].label}</div>
                              )}
                              <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  onClick={() => moveBlock(pg.pageId, idx, -1)}
                                  disabled={idx === 0}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px", opacity: idx === 0 ? 0.5 : 1 }}
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => moveBlock(pg.pageId, idx, 1)}
                                  disabled={idx === (pg.blocks?.length || 0) - 1}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px", opacity: idx === (pg.blocks?.length || 0) - 1 ? 0.5 : 1 }}
                                >
                                  ↓
                                </button>
                                <AddBlockByRoleSelect
                                  compact
                                  placeholderLabel="+ Add below"
                                  onChoose={(opt) =>
                                    addBlock(pg.pageId, opt.type, {
                                      role: opt.role,
                                      title: opt.title,
                                      initialContent: opt.type === "checkpoint" ? "" : "",
                                      insertAt: idx + 1,
                                    })
                                  }
                                />
                                <button
                                  onClick={() => triggerBlockUpload(pg.pageId, idx)}
                                  disabled={isUploading}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px" }}
                                >
                                  {isUploading ? "Uploading..." : "Upload image / video"}
                                </button>
                                <button
                                  onClick={() => removeBlock(pg.pageId, idx)}
                                  style={{ ...ui.btnDanger, padding: "6px 10px" }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {/* hidden file input per block */}
                            <input
                              ref={(el) => {
                                fileInputRef.current[key] = el;
                              }}
                              type="file"
                              accept="image/*,video/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;

                                uploadIntoBlock(
                                  f,
                                  pg.pageId,
                                  idx,
                                  () => safeStr(pg.blocks?.[idx]?.content, ""),
                                  (next) => updateBlock(pg.pageId, idx, { content: next })
                                );
                              }}
                            />

                            <LessonBlockContentTextarea
                              sizeVariant={blockEditorSizeVariant(b.type)}
                              assignTextareaRef={(el) => {
                                blockTextareasRef.current[key] = el;
                              }}
                              getTextarea={() => blockTextareasRef.current[key] ?? null}
                              value={safeStr(b.content, "")}
                              onChange={(next) => updateBlock(pg.pageId, idx, { content: next })}
                              onPaste={(e) => {
                                const insert = getLessonPasteInsertText(e.clipboardData);
                                if (!insert) return;

                                e.preventDefault();

                                const text = insert.text;
                                const el = e.currentTarget;
                                const start = el.selectionStart ?? el.value.length;
                                const end = el.selectionEnd ?? el.value.length;
                                const before = el.value.slice(0, start);
                                const after = el.value.slice(end);
                                const nextValue = collapseExactDuplicatePaste(
                                  before + text + after
                                );

                                updateBlock(pg.pageId, idx, { content: nextValue });

                                setTimeout(() => {
                                  try {
                                    el.focus();
                                    const pos = start + text.length;
                                    el.setSelectionRange(pos, pos);
                                  } catch {}
                                }, 0);
                              }}
                              placeholder="Write markdown here... Use the toolbar for size, colour, and lists. Blank lines are kept."
                            />
                            <div style={{ marginTop: 8, color: "#64748b", fontSize: "0.8rem", lineHeight: 1.5 }}>
                              <strong>Editing tips:</strong>
                              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                                <li>
                                  Use <b>**double asterisks**</b> for bold — list bullets use <code>* word</code> with a space, not{" "}
                                  <code>**</code>
                                </li>
                                <li>Use <b>*single asterisks*</b> for italic</li>
                                <li>Toolbar: underline, headings, lists, font size, and safe text colours</li>
                                <li>Line breaks and empty lines are preserved in preview and when saved</li>
                              </ul>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Checkpoint */}
                    <div style={{ marginTop: 12, ...ui.section }}>
                      <div style={ui.sectionTitle}>Checkpoint</div>
                      <label style={{ display: "block" }}>
                        <div style={ui.label}>Question</div>
                        <input
                          value={safeStr(pg.checkpoint?.question, "")}
                          onChange={(e) => updateCheckpoint(pg.pageId, { question: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        {[0, 1, 2, 3].map((i) => (
                          <label key={i} style={{ display: "block" }}>
                            <div style={ui.label}>Option {i + 1}</div>
                            <input
                              value={safeStr(pg.checkpoint?.options?.[i], "")}
                              onChange={(e) => updateCheckpointOption(pg.pageId, i, e.target.value)}
                              style={ui.input}
                            />
                          </label>
                        ))}
                      </div>
                      <label style={{ display: "block", marginTop: 12 }}>
                        <div style={ui.label}>Answer (text must match one option)</div>
                        <input
                          value={safeStr(pg.checkpoint?.answer, "")}
                          onChange={(e) => updateCheckpoint(pg.pageId, { answer: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Advanced (optional) – collapsed by default */}
              <div style={{ marginTop: space, border: "1.5px solid rgba(15,23,42,0.22)", borderRadius: radius, overflow: "hidden", background: "rgba(255,255,255,0.6)" }}>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((o) => !o)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: "rgba(248,250,252,0.8)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    color: "#475569",
                  }}
                >
                  <span>Advanced (optional)</span>
                  <span style={{ fontSize: "0.75rem" }}>{advancedOpen ? "▼" : "▶"}</span>
                </button>
                {advancedOpen && (
                  <div style={{ padding: space, background: "rgba(255,255,255,0.9)", borderTop: "1.5px solid rgba(15,23,42,0.22)" }}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                      Revision materials, flashcards, quiz questions, and student review settings can be added here in a future update.
                    </p>
                  </div>
                )}
              </div>
            </main>

            {/* RIGHT: Preview */}
            <aside
              id="create-lesson-preview"
              className="lesson-editor-preview-sticky create-lesson-preview-rail"
              style={{
                minWidth: 0,
                ...ui.sidebar,
              }}
            >
              <div style={{ ...ui.sectionTitle, marginBottom: 8 }}>Preview</div>
              <div style={{ fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.5 }}>
                {formData.title ? (
                  <>
                    <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>{formData.title}</div>
                    {formData.description && (
                      <div style={{ marginBottom: 8 }}>{formData.description.slice(0, 120)}{formData.description.length > 120 ? "…" : ""}</div>
                    )}
                    <div style={{ marginTop: 8 }}>{orderedPages.length} page{orderedPages.length !== 1 ? "s" : ""}</div>
                    {orderedPages.length > 0 && (orderedPages[0].blocks?.length ?? 0) > 0 && (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        {(orderedPages[0].blocks || []).map((b, idx) => (
                          <div key={`prev-${idx}`} style={getBlockStyle(b.type)}>
                            {b.type !== "text" && (
                              <div style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#334155", marginBottom: 4 }}>
                                {BLOCK_META[b.type].icon} {BLOCK_META[b.type].label}
                              </div>
                            )}
                            <div
                              className="lesson-content"
                              style={{ fontSize: "0.8rem", color: "#334155", wordBreak: "break-word" }}
                            >
                              <LessonMarkdown
                                className="lesson-md-body"
                                components={createPreviewMarkdownComponents}
                                urlTransform={(url) => {
                                  try {
                                    const decoded = url?.includes("%") ? decodeURIComponent(url) : (url ?? "");
                                    const abs = toAbsoluteAssetUrl(decoded);
                                    if (abs) return abs;
                                    return defaultUrlTransform(url ?? "");
                                  } catch {
                                    return defaultUrlTransform(url ?? "");
                                  }
                                }}
                              >
                                {preprocessMarkdownAssetUrls(safeStr(b.content, ""))}
                              </LessonMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <span>Lesson title and content will appear here.</span>
                )}
              </div>
            </aside>
            </div>
        </div>
      </div>
    </div>
    </>
    </LessonImageLightboxProvider>
  );
};

export default CreateLessonPage;