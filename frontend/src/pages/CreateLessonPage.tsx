// frontend/src/pages/CreateLesson.tsx — PR-AUTH-UI-3: use useCurrentUser for token/user.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { defaultUrlTransform } from "react-markdown";
import api from "../services/api";
import { toAbsoluteAssetUrl } from "../services/mediaUrl";
import { makeAbsoluteAssetUrl, preprocessMarkdownAssetUrls } from "../utils/assetUrl";
import { LessonMarkdown } from "../components/lesson/LessonMarkdown";
import { LessonBlockContentTextarea } from "../components/lesson/LessonBlockContentTextarea";
import { hasRenderableLessonImageSrc } from "../constants/lessonImageDisplay";
import {
  hideBrokenLessonImage,
  LessonImageFrame,
  lessonImageFrameImgStyle,
} from "../components/lesson/LessonImageFrame";
import { LessonImageLightboxProvider } from "../components/lesson/LessonImageLightbox";
import { LessonAutoTextarea } from "../components/lesson/LessonAutoTextarea";
import { sanitizeTeacherMarkdown } from "../utils/lessonTeacherMarkdown";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useCreateLessonTaxonomyOptions } from "../hooks/useCreateLessonTaxonomyOptions";
import { getSpecIdentity } from "../api/taxonomy";
import {
  applySpecIdentityFields,
  findSpecKeyForBoardAndLevel,
  findTopicSelectionInOptions,
} from "../utils/createLessonSpecSync";
import {
  CreateLessonTopicSelectors,
  type TopicSelectionValue,
} from "../components/TopicSelectors/CreateLessonTopicSelectors";
import { ExistingLessonsPanel } from "../components/ExistingLessonsPanel";
import {
  type LessonBlockType,
  type AddBlockOption,
  BLOCK_META,
  getBlockStyle,
  toLegacyBlockType,
  normalizeBlockType,
  resolveLessonDisplayBlockType,
  PAGE_TYPE_OPTIONS,
} from "../types/lessonBlocks";
import {
  InteractiveBlockCreationDialog,
  INTERACTIVE_TYPES_WITH_CREATION_DIALOG,
} from "../components/lesson/InteractiveBlockCreationDialog";
import { HowToCreateLessonCallout } from "../components/teacher/HowToCreateLessonCallout";
import { CreateLessonPracticePanel } from "../components/lesson/CreateLessonPracticePanel";
import { AddBlockByRoleSelect } from "../components/lesson/AddBlockByRoleSelect";
import {
  collapseExactDuplicatePaste,
  guardLessonBlockPatchForDuplicatePaste,
  getLessonPasteInsertText,
} from "../utils/lessonEditorPaste";
import { evaluateLessonReadiness } from "../utils/lessonReadiness";
import { normalizeInteractiveDiagramHotspot } from "../utils/interactiveDiagramHotspots";
import {
  buildDragDropMatchBlockForPersist,
  coerceDiagramZonePct,
  type DragDropMatchAuthoringMatchMode,
  dragDropMatchModeFromBlockForProps,
  mapDragDropPairForBlockRender,
  readDragDropPairAnswerImageUrl,
  TEXT_TO_IMAGE_PAIR_LIMIT,
} from "../utils/dragDropMatchDiagram";
import { DragDropMatchBlock } from "../components/lesson/DragDropMatchBlock";
import { GraphBlock } from "../components/lesson/GraphBlock";
import { GraphBlockAuthoring } from "../components/lesson/GraphBlockAuthoring";
import { DragDropMatchDiagramAuthoring } from "../components/lesson/DragDropMatchDiagramAuthoring";
import { CheckpointCard } from "../components/lesson/CheckpointCard";
import { InlineSelfCheckBlock } from "../components/lesson/InlineSelfCheckBlock";
import { InteractiveSequenceBlock } from "../components/lesson/InteractiveSequenceBlock";
import { InteractiveDiagramBlock } from "../components/lesson/InteractiveDiagramBlock";
import {
  checkpointMarkSchemeForBlockPersist,
  checkpointMarkSchemeLines,
  mergeCheckpointExplanationParts,
} from "../utils/checkpointFeedback";
import {
  attachPersistedBlockNumber,
  diagramBlockForPersist,
  graphBlockForLessonSave,
  logLessonSaveBlocksDebug,
  withPersistedBlockNote,
} from "../utils/lessonBlockPersist";
import { LESSON_DESCRIPTION_MAX_LENGTH } from "../constants/lessonDescription";
import {
  extractSequenceStepImagePromptFromDescription,
  mergeSequenceStepDescriptionAndImagePrompt,
  stripSequenceStepImagePromptFromDescription,
} from "../utils/interactiveSequenceStepImagePrompt";
import { normalizeInteractiveSequenceBlockForEditor } from "../utils/normalizeInteractiveSequenceBlock";
import {
  isGeneratorExportV1,
  buildPagesFromGeneratorExport,
  lessonMetaFromExport,
} from "../utils/lessonGeneratorImport";
import {
  isLearnTeachingPage,
  stripLearnPageTestingBlocks,
  emptyPageQuizBankEditorWarning,
} from "../utils/lessonPageGuards";
import {
  coerceLessonMcqOptionsFour,
  lessonCheckpointWholeCellPaste,
  tryParseFlexibleCheckpointMcq,
  markSchemeFromFlexibleCheckpointParse,
} from "../utils/parseFlexibleCheckpointPaste";
import { lessonBlockDisplayLabel } from "../utils/lessonBlockDisplayLabel";
import { generateDragDropPairsFromText } from "../api/ai";
import { injectTeacherBrainBriefs } from "../api/teacherBrainBriefs";
import { TeacherBrainDesignBriefPanel } from "../components/lesson/TeacherBrainDesignBriefPanel";
import {
  countTeacherBrainBriefsInPages,
  countTeacherBrainEligibleActivityBlocks,
} from "../utils/teacherBrainBriefPages";
import { CELL_ORGANELLES_DRAG_DROP_TEMPLATE } from "../components/lesson/dragDropMatchTemplates";
import {
  diagramImageUrlForPreview,
  diagramMarkdownContentForPreview,
} from "../utils/diagramBlockPreview";
import {
  attachLearningMetaForPersist,
  warnLearningMetaIfMissing,
  type LearningMeta,
} from "../utils/learningMeta";
import { LearningIntelligenceSummaryPanel } from "../components/lesson/LearningIntelligenceSummaryPanel";

function newLessonBlockId() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

type HeroType = "none" | "image" | "video" | "animation";

type LessonPageBlock = {
  type: LessonBlockType;
  content: string;
  title?: string;
  /** Teacher-only (e.g. Teacher Brain design brief) — not shown to students. */
  note?: string;
  role?: string;
  intro?: string;
  instructions?: string;
  pairs?: Array<{ id: string; prompt: string; answer: string; explanation?: string; answerImageUrl?: string }>;
  sequenceSteps?: Array<{
    title: string;
    description: string;
    imageUrl: string;
    caption: string;
    testExplanation?: string;
  }>;
  imageUrl?: string;
  caption?: string;
  hotspots?: Array<{ id: string; x?: number; y?: number; label: string; description: string }>;
  matchMode?: DragDropMatchAuthoringMatchMode;
  dragDropLayout?: string;
  dropZones?: Array<{
    id: string;
    x?: number;
    y?: number;
    correctPairId: string;
    explanation?: string;
  }>;
  prompt?: string;
  questionType?: "mcq" | "short";
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  markScheme?: string[] | string;
  graphType?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  xUnits?: string;
  yUnits?: string;
  graphSeries?: Array<{
    id: string;
    label: string;
    color?: string;
    points: Array<{ x: number | string; y: number }>;
  }>;
  graphAnnotations?: Array<{
    id: string;
    text: string;
    kind?: string;
    seriesId?: string;
    pointIndex?: number;
  }>;
  examQuestion?: string;
  examinerTip?: string;
  learningMeta?: LearningMeta;
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
    explanation?: string;
    markScheme?: string[];
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

/** Coerce importer output into LessonPage blocks (canonical `type`). */
function normalizeImportedLessonPageBlock(b: Record<string, unknown>): LessonPageBlock {
  const t = normalizeBlockType(String(b.type ?? ""));
  if (t === "interactiveSequence") {
    return normalizeInteractiveSequenceBlockForEditor({
      ...b,
      type: t,
    }) as LessonPageBlock;
  }
  return { ...b, type: t } as LessonPageBlock;
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
  const [searchParams] = useSearchParams();
  const { token, user } = useCurrentUser({ watchLocation: true });

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
  const generatorImportInputRef = useRef<HTMLInputElement | null>(null);

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
    autoGenerateFromBanks: true,
  });

  // Pages editor (same data model as EditLessonPage)
  const VALID_STARTER_CHECKPOINT = {
    question: "Which statement is correct?",
    options: ["Option 1", "Option 2", "Option 3", "Option 4"],
    answer: "Option 1",
    explanation: "",
    markScheme: [] as string[],
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

  /** Per block `pageId:idx`: AI drag-drop pair generation (Create flow) */
  const [dragDropPairAiUi, setDragDropPairAiUi] = useState<
    Record<string, { loading: boolean; message: string | null }>
  >({});
  const [dragDropAiTopicPrompt, setDragDropAiTopicPrompt] = useState<Record<string, string>>({});
  const [dragDropDiagramPlacingId, setDragDropDiagramPlacingId] = useState<Record<string, string | null>>({});
  const [interactiveBlockCreation, setInteractiveBlockCreation] = useState<
    null | { pageId: string; insertAt?: number; option: AddBlockOption }
  >(null);
  const isInteractiveCreationType = (t: LessonBlockType) =>
    (INTERACTIVE_TYPES_WITH_CREATION_DIALOG as readonly string[]).includes(t);

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
    const identityFields = value.specKey
      ? applySpecIdentityFields(value.specKey, {
          board: formData.board,
          level: formData.level,
          tier: formData.tier,
        })
      : null;
    setFormData((prev) => ({
      ...prev,
      subject: value.subject,
      topic: value.topic,
      topicKey: value.topicKey,
      ...(identityFields
        ? {
            board: identityFields.board as typeof prev.board,
            level: identityFields.level,
            tier: identityFields.tier as GcseTier,
          }
        : {}),
    }));
  };

  const syncSpecFromBoardAndLevel = (
    subject: string,
    board: string,
    level: string,
    current: TopicSelectionValue
  ) => {
    const matchedSpecKey = findSpecKeyForBoardAndLevel(taxonomyOptions, subject, board, level);
    if (!matchedSpecKey || matchedSpecKey === current.specKey) return;
    handleTopicSelectionChange({
      ...current,
      subject,
      specKey: matchedSpecKey,
      mainTopicTitle: "",
      topicKey: "",
      topic: "",
    });
  };

  const handleGeneratorImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (generatorImportInputRef.current) generatorImportInputRef.current.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const doc = JSON.parse(text) as unknown;
      if (!isGeneratorExportV1(doc)) {
        setError(
          "That file is not a LetsRevise Generator lesson export (expected format letsrevise.generator.export.v1)."
        );
        setTimeout(() => setError(""), 8000);
        return;
      }

      const meta = lessonMetaFromExport(doc);

      setTitleTouched(true);
      if (meta.title) {
        setFormData((prev) => ({
          ...prev,
          title: meta.title!.slice(0, 280),
        }));
      }

      setDescriptionTouched(true);
      if (meta.description) {
        const d = meta.description.slice(0, LESSON_DESCRIPTION_MAX_LENGTH);
        setFormData((prev) => ({
          ...prev,
          description: d,
        }));
      }

      if (meta.board && EXAM_BOARDS.includes(meta.board as (typeof EXAM_BOARDS)[number])) {
        setFormData((prev) => ({
          ...prev,
          board: meta.board as (typeof EXAM_BOARDS)[number],
        }));
      }

      if (meta.level) {
        const lv = meta.level.trim();
        if (lv === "GCSE" || lv === "A-Level" || lv === "KS3" || lv === "IGCSE") {
          setFormData((prev) => ({
            ...prev,
            level: lv,
            ...(lv !== "GCSE" ? { tier: "" as GcseTier } : {}),
          }));
        }
      }

      if (meta.tier === "foundation" || meta.tier === "higher") {
        setFormData((prev) => ({
          ...prev,
          ...(prev.level === "GCSE" || prev.level === "IGCSE"
            ? { tier: meta.tier }
            : {}),
        }));
      }

      if (meta.subject || meta.topic) {
        const nextTopic = meta.topic ?? topicSelection.topic;
        const nextSubject = meta.subject ?? topicSelection.subject;
        setTopicSelection((prev) => ({
          ...prev,
          ...(meta.subject ? { subject: meta.subject } : {}),
          ...(meta.topic ? { topic: meta.topic } : {}),
          ...(meta.topicKey ? { topicKey: meta.topicKey } : {}),
          ...(meta.specKey ? { specKey: meta.specKey } : {}),
        }));
        setFormData((prev) => ({
          ...prev,
          ...(nextSubject !== prev.subject ? { subject: nextSubject } : {}),
          ...(nextTopic !== prev.topic ? { topic: nextTopic } : {}),
          ...(meta.topicKey ? { topicKey: meta.topicKey } : {}),
        }));
      } else if (meta.topicKey) {
        setFormData((prev) => ({
          ...prev,
          topicKey: meta.topicKey!,
        }));
        setTopicSelection((prev) => ({
          ...prev,
          topicKey: meta.topicKey!,
          ...(meta.specKey ? { specKey: meta.specKey } : {}),
        }));
      }

      const built = buildPagesFromGeneratorExport(doc);
      if (!built.length) {
        setError("That export contains no lesson pages.");
        setTimeout(() => setError(""), 8000);
        return;
      }
      let nextPages: LessonPage[] = built.map((row): LessonPage => ({
        pageId: row.pageId,
        title: row.title,
        order: row.order,
        pageType: row.pageType ?? "",
        hero:
          row.hero?.type === "none"
            ? {
                type: "none",
                src: typeof row.hero.src === "string" ? row.hero.src : "",
                caption:
                  typeof row.hero.caption === "string" ? row.hero.caption : undefined,
              }
            : { type: "none", src: "", caption: "" },
        checkpoint: row.checkpoint
          ? {
              question: row.checkpoint.question,
              options: clampOptions(row.checkpoint.options),
              answer: row.checkpoint.answer,
              explanation: safeStr(row.checkpoint.explanation),
              markScheme: Array.isArray(row.checkpoint.markScheme)
                ? [...row.checkpoint.markScheme]
                : [],
            }
          : { question: "", options: ["", "", "", ""], answer: "", explanation: "", markScheme: [] },
        blocks: (row.blocks ?? []).map((b) =>
          normalizeImportedLessonPageBlock(b as Record<string, unknown>)
        ),
      }));

      const exportBriefCount =
        typeof doc.teacherBrainInjection?.injectionCount === "number"
          ? doc.teacherBrainInjection.injectionCount
          : countTeacherBrainBriefsInPages(nextPages);
      let briefCount = countTeacherBrainBriefsInPages(nextPages);
      const eligibleActivity = countTeacherBrainEligibleActivityBlocks(nextPages);
      const topicForBrief =
        meta.topic?.trim() ||
        formData.topic?.trim() ||
        doc.lesson?.topic?.trim() ||
        "";

      if (briefCount === 0 && eligibleActivity > 0 && topicForBrief) {
        try {
          const injected = await injectTeacherBrainBriefs({
            pages: nextPages,
            topic: topicForBrief,
            subject: meta.subject ?? formData.subject,
            examBoard: meta.board ?? formData.board,
            tier: meta.tier,
          });
          nextPages = injected.pages as LessonPage[];
          briefCount = countTeacherBrainBriefsInPages(nextPages);
        } catch {
          /* import still succeeds; teacher can inject from Edit Lesson */
        }
      }

      setPages(nextPages);
      if (briefCount > 0) {
        setSuccess(
          `Imported lesson — ${briefCount} Teacher Brain design brief${briefCount === 1 ? "" : "s"} on diagram/activity blocks.`
        );
      } else if (exportBriefCount > 0) {
        setSuccess(
          "Imported lesson — export listed briefs but none were found on blocks. Re-export with V4 or use Inject on Edit Lesson."
        );
      } else if (eligibleActivity > 0) {
        setSuccess(
          "Imported lesson — no Teacher Brain briefs yet. Enable V4 on export, or open Edit Lesson and use Inject Teacher Brain briefs."
        );
      } else {
        setSuccess("Imported lesson from LetsRevise Generator.");
      }
      setTimeout(() => setSuccess(""), 6500);
    } catch {
      setError("Could not read or parse that JSON file.");
      setTimeout(() => setError(""), 8000);
    }
  };

  // Prefill from Gap Priorities / coverage links: ?specKey=&topicKey= or location.state
  const prefilledFromGapRef = useRef(false);
  useEffect(() => {
    if (prefilledFromGapRef.current || taxonomyLoading || !taxonomyOptions) return;
    const state = location.state as { specKey?: string; topicKey?: string } | null;
    const targetSpecKey = (searchParams.get("specKey") || state?.specKey || "").trim();
    const targetTopicKey = (searchParams.get("topicKey") || state?.topicKey || "").trim();
    if (!targetSpecKey || !targetTopicKey) return;

    const match = findTopicSelectionInOptions(taxonomyOptions, targetSpecKey, targetTopicKey);
    prefilledFromGapRef.current = true;
    if (match) handleTopicSelectionChange(match);
  }, [taxonomyLoading, taxonomyOptions, location.state, searchParams]);

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
        name === "estimatedDuration"
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
          checkpoint: { question: "", options: ["", "", "", ""], answer: "", explanation: "", markScheme: [] },
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
        let block: LessonPageBlock;
        if (type === "selfCheck") {
          block = {
            type: "selfCheck",
            content: "",
            prompt: "[Enter question]",
            questionType: "mcq",
            options: ["[Option 1]", "[Option 2]", "[Option 3]", "[Option 4]"],
            correctAnswer: "[Option 1]",
            explanation: "",
            markScheme: [],
          };
        } else if (type === "interactiveSequence") {
          block = {
            type: "interactiveSequence",
            content: "",
            title: "",
            intro: "",
            sequenceSteps: [],
          };
        } else if (type === "interactiveDiagram") {
          block = {
            type: "interactiveDiagram",
            content: "",
            title: "",
            intro: "",
            imageUrl: "",
            hotspots: [],
          };
        } else if (type === "dragDropMatch") {
          block = {
            type: "dragDropMatch",
            content: "",
            title: "",
            intro: "",
            instructions: "",
            pairs: [],
          };
        } else if (type === "graph") {
          block = {
            type: "graph",
            content: "",
            title: "",
            intro: "",
            graphType: "line",
            xAxisLabel: "",
            yAxisLabel: "",
            xUnits: "",
            yUnits: "",
            graphSeries: [
              {
                id: `gs_${Date.now()}`,
                label: "Series 1",
                points: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 },
                  { x: 2, y: 2 },
                ],
              },
            ],
            graphAnnotations: [],
            examQuestion: "",
            markScheme: "",
            examinerTip: "",
          };
        } else {
          block = {
            type,
            content: opts?.initialContent ?? "",
          };
        }
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

  /** Insert from creation dialog (templates / AI) without hidden defaults. */
  const insertPreparedLessonBlockCreate = (
    pageId: string,
    raw: Record<string, unknown>,
    opts?: { insertAt?: number; role?: string; title?: string }
  ) => {
    setPages((prev) =>
      prev.map((p) => {
        if (p.pageId !== pageId) return p;
        const blocks = Array.isArray(p.blocks) ? [...p.blocks] : [];
        const block = { ...raw } as LessonPageBlock;
        if (opts?.role?.trim()) {
          block.role = opts.role.trim();
        } else if (block.type === "dragDropMatch") {
          block.role = "match";
        } else if (block.type === "graph") {
          block.role = "graph";
        }
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
          explanation: "",
          markScheme: [],
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
          explanation: "",
          markScheme: [],
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

  /** dragDropMatch pair answer thumbnail — same uploads/image as Edit lesson; teacher draft folder. */
  const uploadImageForDragDropMatchPairAnswer = async (
    file: File,
    pageId: string,
    blockIndex: number,
    pairIndex: number,
    onUrl: (url: string) => void
  ) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image (png/jpg/gif/webp).");
      return;
    }
    if (!token) {
      alert("You must be signed in to upload media.");
      return;
    }
    const teacherId = user?._id ? String(user._id) : "teacher_unknown";
    const uploadKey = `${pageId}:${blockIndex}:ddm-pair:${pairIndex}`;
    try {
      setUploadingKey(uploadKey);
      setUploadMsg("");
      const form = new FormData();
      form.append("file", file);
      const folder = `lesson-media/teacher_${teacherId}/lesson_new/page_${pageId}/block_${blockIndex}_ddm_pair_${pairIndex}`;
      const endpoint = `uploads/image?folder=${encodeURIComponent(folder)}`;
      form.append("folder", folder);
      const res = await api.post(endpoint, form);
      const url = res.data?.url as string | undefined;
      if (!url) {
        alert("Upload succeeded but no URL returned.");
        return;
      }
      onUrl(toAbsoluteAssetUrl(url));
      setUploadMsg("✅ Answer image uploaded.");
      setTimeout(() => setUploadMsg(""), 2000);
    } catch (e: any) {
      console.error(e);
      const data = e?.response?.data;
      const raw =
        typeof data === "object" && data !== null
          ? (data.error ?? data.details ?? data.msg ?? data.message)
          : undefined;
      const msg = typeof raw === "string" && raw ? raw : e?.message || "Upload failed";
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
        const blockType = toLegacyBlockType(normalizeBlockType(String(b?.type ?? "")));
        if (blockType === "interactiveSequence") {
          const normalizedSeq = normalizeInteractiveSequenceBlockForEditor(
            b as unknown as Record<string, unknown>
          );
          const sequenceSteps = (
            Array.isArray(normalizedSeq.sequenceSteps) ? normalizedSeq.sequenceSteps : []
          )
            .map((s) => {
              const te = s.testExplanation != null ? String(s.testExplanation).trim() : "";
              return {
                ...(s.id ? { id: s.id } : {}),
                title: s.title,
                description: s.description,
                imageUrl: s.imageUrl,
                caption: s.caption,
                ...(te ? { testExplanation: te } : {}),
              };
            })
            .filter(
              (s) =>
                s.title.length > 0 ||
                s.description.length > 0 ||
                s.imageUrl.length > 0 ||
                s.caption.length > 0 ||
                Boolean((s as { testExplanation?: string }).testExplanation)
            );
          const isOut: Record<string, unknown> = withPersistedBlockNote(
            {
              type: "interactiveSequence",
              title: typeof b.title === "string" ? b.title.trim() : "",
              intro: b.intro != null ? String(b.intro).trim() : "",
              content: "",
              sequenceSteps,
            },
            b
          );
          if (typeof b.role === "string" && b.role.trim()) isOut.role = b.role.trim();
          return isOut;
        }
        if (blockType === "interactiveDiagram") {
          const rawH = Array.isArray(b.hotspots) ? b.hotspots : [];
          const hotspots = rawH.map((h, i) => normalizeInteractiveDiagramHotspot(h, i));
          const idOut: Record<string, unknown> = withPersistedBlockNote(
            {
              type: "interactiveDiagram",
              title: typeof b.title === "string" ? b.title.trim() : "",
              intro: b.intro != null ? String(b.intro).trim() : "",
              content: "",
              imageUrl: b.imageUrl != null ? String(b.imageUrl).trim() : "",
              hotspots,
            },
            b
          );
          if (typeof b.role === "string" && b.role.trim()) idOut.role = b.role.trim();
          return idOut;
        }
        {
          const ddmPersist = buildDragDropMatchBlockForPersist(b, { newId: newLessonBlockId });
          if (ddmPersist) {
            return { ...ddmPersist, content: "" };
          }
        }
        if (blockType === "diagram") {
          return attachPersistedBlockNumber(diagramBlockForPersist(b), b);
        }
        if (
          blockType === "graph" ||
          resolveLessonDisplayBlockType(b) === "graph"
        ) {
          return graphBlockForLessonSave(b);
        }
        const out: Record<string, unknown> = {
          type: blockType,
          content:
            blockType === "checkpoint"
              ? ""
              : sanitizeTeacherMarkdown(String(b.content || "")),
        };
        if (typeof b.title === "string" && b.title.trim()) out.title = b.title.trim();
        const blockNum = (b as { number?: unknown }).number;
        if (typeof blockNum === "number" && Number.isFinite(blockNum) && blockNum > 0) {
          out.number = Math.trunc(blockNum);
        }
        if (typeof b.role === "string" && b.role.trim()) out.role = b.role.trim();
        if (blockType === "checkpoint" && p.checkpoint) {
          const bcp = b as LessonPageBlock;
          const qType = bcp.questionType === "short" ? "short" : "mcq";
          out.prompt = safeStr(p.checkpoint.question, "");
          out.questionType = qType;
          out.options =
            qType === "short"
              ? []
              : clampOptions((p.checkpoint.options || []) as string[]);
          out.correctAnswer = safeStr(p.checkpoint.answer, "");
          const chkExpl = safeStr(p.checkpoint.explanation, "").trim();
          if (chkExpl) out.explanation = chkExpl;
          const chkMs = checkpointMarkSchemeForBlockPersist(p.checkpoint.markScheme);
          if (chkMs) out.markScheme = chkMs;
        }
        if (blockType === "selfCheck") {
          const bsc = b as LessonPageBlock;
          const chkExpl = bsc.explanation != null ? String(bsc.explanation).trim() : "";
          const chkMs = checkpointMarkSchemeForBlockPersist(bsc.markScheme);
          if (chkExpl) out.explanation = chkExpl;
          if (chkMs) out.markScheme = chkMs;
          out.prompt = String(bsc.prompt ?? "").trim();
          out.questionType = bsc.questionType === "short" ? "short" : "mcq";
          const scOpts = Array.isArray(bsc.options) ? bsc.options.map((o: string) => String(o ?? "").trim()) : [];
          out.options = scOpts;
          out.correctAnswer = String(bsc.correctAnswer ?? "").trim();
        }
        if (blockType === "pageQuiz") {
          const bpq = b as LessonPageBlock & { questions?: unknown[] };
          const bank = Array.isArray(bpq.questions) ? bpq.questions : [];
          const questions = bank
            .map((raw, qi) => {
              if (!raw || typeof raw !== "object") return null;
              const q = raw as Record<string, unknown>;
              const prompt = String(q.prompt ?? q.question ?? "").trim();
              const correctAnswer = String(q.correctAnswer ?? q.answer ?? "").trim();
              if (!prompt || !correctAnswer) return null;
              const qt =
                String(q.questionType ?? q.type ?? "").toLowerCase() === "short" ? "short" : "mcq";
              const opts = Array.isArray(q.options)
                ? q.options.map((o) => String(o ?? "").trim()).filter(Boolean)
                : [];
              if (qt === "mcq" && opts.length < 2) return null;
              return {
                id: String(q.id || `pq_${qi + 1}`),
                prompt,
                question: prompt,
                questionType: qt,
                type: qt,
                options: qt === "mcq" ? opts : [],
                correctAnswer,
                ...(q.explanation != null && String(q.explanation).trim()
                  ? { explanation: String(q.explanation).trim() }
                  : {}),
                ...(q.purpose != null ? { purpose: String(q.purpose) } : {}),
                marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
              };
            })
            .filter(Boolean);
          out.questions = questions;
          const first = questions[0] as
            | { prompt?: string; questionType?: string; options?: string[]; correctAnswer?: string; explanation?: string }
            | undefined;
          if (first) {
            out.prompt = first.prompt || "";
            out.questionType = first.questionType === "short" ? "short" : "mcq";
            out.options = Array.isArray(first.options) ? first.options : [];
            out.correctAnswer = first.correctAnswer || "";
            if (first.explanation) out.explanation = first.explanation;
          }
        }
        return out;
      })
        .map((out, idx) =>
          attachLearningMetaForPersist(out, (p.blocks || [])[idx])
        ),
      checkpoint: (() => {
        if (isLearnTeachingPage(p)) {
          return undefined as unknown as LessonPage["checkpoint"];
        }
        if (!p.checkpoint) {
          return { question: "", options: ["", "", "", ""], answer: "" };
        }
        const expl = safeStr(p.checkpoint.explanation, "").trim();
        const ms = Array.isArray(p.checkpoint.markScheme)
          ? p.checkpoint.markScheme.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 20)
          : [];
        return {
          question: safeStr(p.checkpoint.question, ""),
          options: clampOptions((p.checkpoint.options || []) as string[]),
          answer: safeStr(p.checkpoint.answer, ""),
          ...(expl ? { explanation: expl } : {}),
          ...(ms.length ? { markScheme: ms } : {}),
        };
      })(),
    })).map((page) => {
      if (!isLearnTeachingPage(page)) return page;
      return {
        ...page,
        blocks: stripLearnPageTestingBlocks(page.blocks || []),
        checkpoint: undefined as unknown as LessonPage["checkpoint"],
      };
    });

    warnLearningMetaIfMissing(sanitizedPages, "create lesson");

    // Build quiz.questions from imported/authored pageQuiz banks (parity with Edit Lesson).
    const pageQuizQuestions: Array<Record<string, unknown>> = [];
    for (const p of sanitizedPages) {
      const pageId = String(p.pageId || "").trim();
      if (!pageId) continue;
      for (const b of p.blocks || []) {
        if (String((b as { type?: string }).type) !== "pageQuiz") continue;
        const bank = Array.isArray((b as { questions?: unknown[] }).questions)
          ? ((b as { questions: unknown[] }).questions as Array<Record<string, unknown>>)
          : [];
        bank.forEach((raw, qi) => {
          const qText = String(raw.prompt ?? raw.question ?? "").trim();
          const correctAnswer = String(raw.correctAnswer ?? "").trim();
          if (!qText || !correctAnswer) return;
          const qt =
            String(raw.questionType ?? raw.type ?? "").toLowerCase() === "short" ? "short" : "mcq";
          const opts = Array.isArray(raw.options)
            ? raw.options.map((o) => String(o ?? "").trim()).filter(Boolean)
            : [];
          if (qt === "mcq" && opts.length < 2) return;
          pageQuizQuestions.push({
            id: String(raw.id || `pq_${pageId}_${qi}`),
            type: qt,
            question: qText,
            options: qt === "mcq" ? opts : undefined,
            correctAnswer,
            explanation:
              raw.explanation != null ? String(raw.explanation).trim() : undefined,
            purpose: raw.purpose != null ? String(raw.purpose).trim() : undefined,
            marks: Number(raw.marks) > 0 ? Number(raw.marks) : 1,
            pageId,
            tags: ["page-quiz"],
            sourceType: "pageQuiz",
            metadata: { source: "pageQuiz" },
          });
        });
      }
    }

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
      pages: sanitizedPages,
      quiz: {
        timeSeconds: 600,
        questions: pageQuizQuestions,
      },
    };
    if (formData.topicKey.trim()) {
      payload.topicKey = formData.topicKey.trim();
      if (topicSelection.specKey) payload.specKey = topicSelection.specKey;
      if (topicSelection.mainTopicTitle) payload.mainTopic = topicSelection.mainTopicTitle;
      if (topicSelection.topic) payload.subTopic = topicSelection.topic;
      const identity = topicSelection.specKey ? getSpecIdentity(topicSelection.specKey) : null;
      if (identity?.examCode) payload.examCode = identity.examCode;
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
      logLessonSaveBlocksDebug(payload, "CreateLesson draft save");
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
      logLessonSaveBlocksDebug(payload, "CreateLesson save");

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

              <LearningIntelligenceSummaryPanel pages={pages ?? []} />

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
                lessonSpecKey={topicSelection.specKey || undefined}
              />
            </aside>

            {/* MIDDLE: lesson details + page editors */}
            <main className="create-lesson-main-column" style={{ minWidth: 0 }}>
              {/* Lesson details (lighter weight so Page editor is main canvas) */}
              <div style={ui.lessonDetailsSection}>
                <div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ ...ui.sectionTitle, marginBottom: 0 }}>Revision Lesson Details</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      ref={generatorImportInputRef}
                      type="file"
                      accept=".json,application/json"
                      aria-label="Import lesson JSON from LetsRevise Generator"
                      style={{ display: "none" }}
                      onChange={handleGeneratorImportFile}
                    />
                    <button
                      type="button"
                      style={ui.btnSecondary}
                      onClick={() => generatorImportInputRef.current?.click()}
                    >
                      Import from LetsRevise Generator…
                    </button>
                  </div>
                </div>

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
                        onChange={(e) => {
                          const board = e.target.value as typeof formData.board;
                          setFormData((prev) => ({ ...prev, board }));
                          if (topicSelection.subject) {
                            syncSpecFromBoardAndLevel(
                              topicSelection.subject,
                              board,
                              formData.level,
                              topicSelection
                            );
                          }
                        }}
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
                                if (topicSelection.subject && formData.board) {
                                  syncSpecFromBoardAndLevel(
                                    topicSelection.subject,
                                    formData.board,
                                    value,
                                    topicSelection
                                  );
                                }
                              }}
                              style={ui.input}
                            >
                              <option value="KS3">KS3</option>
                              <option value="GCSE">GCSE</option>
                              <option value="IGCSE">IGCSE</option>
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

                  {topicSelection.specKey ? (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0",
                        fontSize: "0.875rem",
                        color: "#065f46",
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>Syllabus selection</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", color: "#047857" }}>
                        <span>Spec: {topicSelection.specKey}</span>
                        {getSpecIdentity(topicSelection.specKey)?.examCode ? (
                          <span>Exam code: {getSpecIdentity(topicSelection.specKey)!.examCode}</span>
                        ) : null}
                        <span>Board: {formData.board || "—"}</span>
                        <span>Level: {formData.level || "—"}</span>
                        {topicSelection.mainTopicTitle ? (
                          <span>Main topic: {topicSelection.mainTopicTitle}</span>
                        ) : null}
                        {topicSelection.topic ? <span>Sub-topic: {topicSelection.topic}</span> : null}
                      </div>
                    </div>
                  ) : null}

                  {taxonomyError ? (
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        fontSize: "0.8125rem",
                        color: "#b91c1c",
                      }}
                    >
                      Could not load syllabus options ({taxonomyError}). Restart the backend so
                      /api/taxonomy/create-lesson-options includes Edexcel IGCSE Biology.
                    </div>
                  ) : null}

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
                    showExpandButton
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
                        onChoose={(opt) => {
                          if (isInteractiveCreationType(opt.type)) {
                            setInteractiveBlockCreation({ pageId: pg.pageId, option: opt });
                            return;
                          }
                          addBlock(pg.pageId, opt.type, {
                            role: opt.role,
                            title: opt.title,
                            initialContent: opt.type === "checkpoint" ? "" : "",
                          });
                        }}
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
                                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#334155" }}>{lessonBlockDisplayLabel(b.type, idx, b.title)}</div>
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
                                  onChoose={(opt) => {
                                    if (isInteractiveCreationType(opt.type)) {
                                      setInteractiveBlockCreation({
                                        pageId: pg.pageId,
                                        insertAt: idx + 1,
                                        option: opt,
                                      });
                                      return;
                                    }
                                    addBlock(pg.pageId, opt.type, {
                                      role: opt.role,
                                      title: opt.title,
                                      initialContent: opt.type === "checkpoint" ? "" : "",
                                      insertAt: idx + 1,
                                    });
                                  }}
                                />
                                {b.type !== "interactiveSequence" &&
                                  b.type !== "interactiveDiagram" &&
                                  b.type !== "dragDropMatch" &&
                                  b.type !== "graph" && (
                                <button
                                  onClick={() => triggerBlockUpload(pg.pageId, idx)}
                                  disabled={isUploading}
                                  style={{ ...ui.btnSecondary, padding: "6px 10px" }}
                                >
                                  {isUploading ? "Uploading..." : "Upload image / video"}
                                </button>
                                )}
                                <button
                                  onClick={() => removeBlock(pg.pageId, idx)}
                                  style={{ ...ui.btnDanger, padding: "6px 10px" }}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {(() => {
                              const pqWarn = emptyPageQuizBankEditorWarning(b);
                              if (!pqWarn) return null;
                              return (
                              <div
                                style={{
                                  marginTop: 8,
                                  padding: "8px 12px",
                                  borderRadius: 8,
                                  background: "#fffbeb",
                                  border: "1px solid #f59e0b",
                                  fontSize: 13,
                                  color: "#92400e",
                                  lineHeight: 1.45,
                                }}
                                role="status"
                              >
                                {pqWarn}
                              </div>
                              );
                            })()}

                            {b.type === "interactiveSequence" ||
                            b.type === "interactiveDiagram" ||
                            b.type === "dragDropMatch" ||
                            b.type === "graph" ? (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 12,
                                  background: "#f5f3ff",
                                  borderRadius: 8,
                                  border: "1px solid #c4b5fd",
                                }}
                              >
                                {b.type === "interactiveSequence" ||
                                b.type === "interactiveDiagram" ||
                                b.type === "dragDropMatch" ? (
                                  <TeacherBrainDesignBriefPanel
                                    blockType={b.type}
                                    note={b.note}
                                    onNoteChange={(note) => updateBlock(pg.pageId, idx, { note })}
                                  />
                                ) : null}
                                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#5b21b6", lineHeight: 1.5 }}>
                                  {b.type === "interactiveSequence" ? (
                                    <>
                                      Step images are optional, but recommended — upload one image per step in{" "}
                                      <strong>Edit lesson</strong> for best results. Use explanation, optional Test me
                                      content, and image URL fields there.
                                    </>
                                  ) : b.type === "interactiveDiagram" ? (
                                    <>
                                      Configure the diagram image and hotspots in <strong>Edit lesson</strong> after
                                      you save. You can set title and intro here first.
                                    </>
                                  ) : b.type === "graph" ? (
                                    <>
                                      Set axes and data below, or use <strong>Generate graph with AI</strong>. Students
                                      see an interactive chart with optional interpretation questions.
                                    </>
                                  ) : (
                                    <>
                                      Edit <strong>match pairs</strong> below — or use{' '}
                                      <strong>Generate pairs with AI</strong> from a topic (8+ characters) or from lesson
                                      details + intro/instructions.
                                    </>
                                  )}
                                </p>
                                <label style={{ display: "block", marginBottom: 8 }}>
                                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Activity title</div>
                                  <input
                                    value={safeStr(b.title, "")}
                                    onChange={(e) => updateBlock(pg.pageId, idx, { title: e.target.value })}
                                    style={{
                                      width: "100%",
                                      padding: "8px 10px",
                                      borderRadius: 8,
                                      border: "1px solid #c4b5fd",
                                    }}
                                  />
                                </label>
                                <label style={{ display: "block" }}>
                                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Intro</div>
                                  <LessonAutoTextarea
                                    editorVariant="plain"
                                    value={safeStr(b.intro, "")}
                                    onChange={(v) => updateBlock(pg.pageId, idx, { intro: v })}
                                    placeholder="Optional"
                                    minHeightPx={80}
                                    style={{ fontSize: "0.875rem" }}
                                  />
                                </label>
                                {b.type === "interactiveSequence" ? (
                                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const cur = Array.isArray(b.sequenceSteps) ? [...b.sequenceSteps] : [];
                                          cur.push({
                                            title: "",
                                            description: "",
                                            imageUrl: "",
                                            caption: "",
                                            testExplanation: "",
                                          });
                                          updateBlock(pg.pageId, idx, { sequenceSteps: cur });
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(99,102,241,0.35)",
                                          background: "rgba(99,102,241,0.08)",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                          fontSize: 13,
                                        }}
                                      >
                                        + Add step
                                      </button>
                                    </div>
                                    {(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : []).map((step, si) => {
                                      const seqLen = Array.isArray(b.sequenceSteps) ? b.sequenceSteps.length : 0;
                                      const stepDescRaw = String(step.description ?? "");
                                      const stepExplanationMain =
                                        stripSequenceStepImagePromptFromDescription(stepDescRaw);
                                      const stepImagePrompt = extractSequenceStepImagePromptFromDescription(stepDescRaw);
                                      return (
                                        <div
                                          key={`${key}-seq-${si}`}
                                          style={{
                                            padding: 12,
                                            borderRadius: 10,
                                            border: "1px solid #e2e8f0",
                                            background: "#fafafa",
                                          }}
                                        >
                                          <div
                                            style={{
                                              display: "flex",
                                              flexWrap: "wrap",
                                              alignItems: "center",
                                              justifyContent: "space-between",
                                              gap: 8,
                                              marginBottom: 8,
                                            }}
                                          >
                                            <div style={{ fontWeight: 800, color: "#3730a3" }}>Step {si + 1}</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                                              <button
                                                type="button"
                                                title="Move step up"
                                                disabled={si === 0}
                                                onClick={() => {
                                                  if (si <= 0) return;
                                                  const steps = [
                                                    ...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : []),
                                                  ];
                                                  const t = steps[si - 1];
                                                  steps[si - 1] = steps[si]!;
                                                  steps[si] = t!;
                                                  updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                                }}
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: 4,
                                                  padding: "5px 10px",
                                                  borderRadius: 6,
                                                  border: "1px solid #c4b5fd",
                                                  background: si === 0 ? "#f1f5f9" : "white",
                                                  color: si === 0 ? "#94a3b8" : "#5b21b6",
                                                  cursor: si === 0 ? "not-allowed" : "pointer",
                                                  fontWeight: 700,
                                                  fontSize: 12,
                                                }}
                                              >
                                                <span aria-hidden>↑</span>
                                                <span>Move up</span>
                                              </button>
                                              <button
                                                type="button"
                                                title="Move step down"
                                                disabled={si >= seqLen - 1}
                                                onClick={() => {
                                                  if (si >= seqLen - 1) return;
                                                  const steps = [
                                                    ...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : []),
                                                  ];
                                                  const t = steps[si + 1];
                                                  steps[si + 1] = steps[si]!;
                                                  steps[si] = t!;
                                                  updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                                }}
                                                style={{
                                                  display: "inline-flex",
                                                  alignItems: "center",
                                                  gap: 4,
                                                  padding: "5px 10px",
                                                  borderRadius: 6,
                                                  border: "1px solid #c4b5fd",
                                                  background: si >= seqLen - 1 ? "#f1f5f9" : "white",
                                                  color: si >= seqLen - 1 ? "#94a3b8" : "#5b21b6",
                                                  cursor: si >= seqLen - 1 ? "not-allowed" : "pointer",
                                                  fontWeight: 700,
                                                  fontSize: 12,
                                                }}
                                              >
                                                <span aria-hidden>↓</span>
                                                <span>Move down</span>
                                              </button>
                                            </div>
                                          </div>
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                              Step title
                                            </div>
                                            <input
                                              value={step.title ?? ""}
                                              onChange={(e) => {
                                                const steps = [...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : [])];
                                                if (steps[si]) steps[si] = { ...steps[si], title: e.target.value };
                                                updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                              }}
                                              style={{
                                                width: "100%",
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: "1px solid #cbd5e1",
                                              }}
                                            />
                                          </label>
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                              Explanation
                                            </div>
                                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                                              Shown to students as the main step explanation.
                                            </div>
                                            <LessonAutoTextarea
                                              editorVariant="plain"
                                              value={stepExplanationMain}
                                              onChange={(v) => {
                                                const steps = [...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : [])];
                                                if (steps[si]) {
                                                  const ip = extractSequenceStepImagePromptFromDescription(
                                                    String(steps[si]?.description ?? "")
                                                  );
                                                  steps[si] = {
                                                    ...steps[si],
                                                    description: mergeSequenceStepDescriptionAndImagePrompt(v, ip),
                                                  };
                                                }
                                                updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                              }}
                                              placeholder="What happens in this step…"
                                              minHeightPx={100}
                                              style={{ fontSize: "0.875rem" }}
                                            />
                                          </label>
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                              Image URL (optional)
                                            </div>
                                            <input
                                              value={step.imageUrl ?? ""}
                                              onChange={(e) => {
                                                const steps = [...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : [])];
                                                if (steps[si]) steps[si] = { ...steps[si], imageUrl: e.target.value };
                                                updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                              }}
                                              style={{
                                                width: "100%",
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: "1px solid #cbd5e1",
                                              }}
                                              placeholder="https://… — upload in Edit lesson"
                                            />
                                          </label>
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                              Image prompt (optional)
                                            </div>
                                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                                              Teacher-only image generation idea. Not shown to students.
                                            </div>
                                            <LessonAutoTextarea
                                              editorVariant="plain"
                                              value={stepImagePrompt}
                                              onChange={(v) => {
                                                const steps = [...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : [])];
                                                if (steps[si]) {
                                                  const main = stripSequenceStepImagePromptFromDescription(
                                                    String(steps[si]?.description ?? "")
                                                  );
                                                  steps[si] = {
                                                    ...steps[si],
                                                    description: mergeSequenceStepDescriptionAndImagePrompt(main, v),
                                                  };
                                                }
                                                updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                              }}
                                              placeholder="e.g. Simple diagram showing this stage…"
                                              minHeightPx={56}
                                              style={{ fontSize: "0.875rem" }}
                                            />
                                          </label>
                                          <div
                                            style={{
                                              marginTop: 10,
                                              padding: "14px 14px 16px",
                                              borderRadius: 12,
                                              border: "2px solid #a78bfa",
                                              background: "linear-gradient(180deg,#faf5ff 0%,#ffffff 52%)",
                                              boxShadow:
                                                "0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 18px rgba(91,33,182,0.09)",
                                              marginBottom: 8,
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontWeight: 900,
                                                fontSize: 13,
                                                color: "#5b21b6",
                                                marginBottom: 10,
                                                letterSpacing: "0.02em",
                                              }}
                                            >
                                              Test me · reveal feedback (students)
                                            </div>
                                            <label style={{ display: "block", marginBottom: 10 }}>
                                              <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
                                                Test me answer / key idea
                                              </div>
                                              <div
                                                style={{
                                                  fontSize: 12,
                                                  color: "#64748b",
                                                  marginBottom: 6,
                                                  lineHeight: 1.4,
                                                }}
                                              >
                                                Optional. Shown when students choose “Reveal answer / key idea”.
                                              </div>
                                              <textarea
                                                value={step.caption ?? ""}
                                                rows={4}
                                                onChange={(e) => {
                                                  const steps = [...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : [])];
                                                  const v = e.target.value;
                                                  if (steps[si]) steps[si] = { ...steps[si], caption: v };
                                                  updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                                }}
                                                placeholder="Answer or key idea (leave blank for no reveal on this step)"
                                                spellCheck={true}
                                                style={{
                                                  width: "100%",
                                                  padding: "10px 12px",
                                                  borderRadius: 10,
                                                  border: "2px solid rgba(124,58,237,0.45)",
                                                  fontSize: "0.9375rem",
                                                  fontFamily: "inherit",
                                                  lineHeight: 1.55,
                                                  resize: "vertical",
                                                  minHeight: 96,
                                                  boxSizing: "border-box",
                                                }}
                                              />
                                            </label>
                                            <div
                                              style={{
                                                paddingTop: 12,
                                                marginTop: 4,
                                                borderTop: "2px dashed rgba(91,33,182,0.28)",
                                              }}
                                            >
                                              <label style={{ display: "block", marginBottom: 0 }}>
                                                <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
                                                  Test me explanation (optional)
                                                </div>
                                                <div
                                                  style={{
                                                    fontSize: 12,
                                                    color: "#64748b",
                                                    marginBottom: 6,
                                                    lineHeight: 1.4,
                                                  }}
                                                >
                                                  Shown together with the key idea after reveal.
                                                </div>
                                                <textarea
                                                  value={step.testExplanation ?? ""}
                                                  rows={5}
                                                  onChange={(e) => {
                                                    const steps = [...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : [])];
                                                    const v = e.target.value;
                                                    if (steps[si])
                                                      steps[si] = { ...steps[si], testExplanation: v };
                                                    updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                                  }}
                                                  placeholder="Extra explanation after reveal (optional)"
                                                  spellCheck={true}
                                                  style={{
                                                    width: "100%",
                                                    padding: "10px 12px",
                                                    borderRadius: 10,
                                                    border: "2px solid rgba(91,33,182,0.55)",
                                                    fontSize: "0.9375rem",
                                                    fontFamily: "inherit",
                                                    lineHeight: 1.55,
                                                    resize: "vertical",
                                                    minHeight: 120,
                                                    boxSizing: "border-box",
                                                    background: "#fff",
                                                  }}
                                                />
                                              </label>
                                            </div>
                                          </div>
                                          <div
                                            style={{
                                              marginTop: 10,
                                              display: "flex",
                                              flexWrap: "wrap",
                                              gap: 8,
                                              alignItems: "center",
                                            }}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const steps = [
                                                  ...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : []),
                                                ];
                                                steps.splice(si + 1, 0, {
                                                  title: "",
                                                  description: "",
                                                  imageUrl: "",
                                                  caption: "",
                                                  testExplanation: "",
                                                });
                                                updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                              }}
                                              style={{
                                                padding: "5px 12px",
                                                borderRadius: 8,
                                                border: "2px solid rgba(34,197,94,0.4)",
                                                background: "rgba(220,252,231,0.5)",
                                                color: "#166534",
                                                cursor: "pointer",
                                                fontWeight: 700,
                                                fontSize: 12,
                                              }}
                                            >
                                              + Insert step below
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const steps = [
                                                  ...(Array.isArray(b.sequenceSteps) ? b.sequenceSteps : []),
                                                ];
                                                if (steps.length <= 1) return;
                                                steps.splice(si, 1);
                                                updateBlock(pg.pageId, idx, { sequenceSteps: steps });
                                              }}
                                              disabled={(b.sequenceSteps?.length ?? 0) <= 1}
                                              style={{
                                                padding: "4px 10px",
                                                borderRadius: 6,
                                                border: "1px solid #f87171",
                                                background: "#fef2f2",
                                                color: "#b91c1c",
                                                cursor:
                                                  (b.sequenceSteps?.length ?? 0) <= 1 ? "not-allowed" : "pointer",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                opacity: (b.sequenceSteps?.length ?? 0) <= 1 ? 0.5 : 1,
                                              }}
                                            >
                                              Remove step
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {b.type === "dragDropMatch" ? (
                                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
                                    <label style={{ display: "block", marginBottom: 8 }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                        Instructions (students)
                                      </div>
                                      <LessonAutoTextarea
                                        editorVariant="plain"
                                        value={safeStr(b.instructions, "")}
                                        onChange={(v) => updateBlock(pg.pageId, idx, { instructions: v })}
                                        placeholder="What students should do…"
                                        minHeightPx={64}
                                        style={{ fontSize: "0.875rem" }}
                                      />
                                    </label>
                                    <DragDropMatchDiagramAuthoring
                                      blk={b}
                                      newId={newLessonBlockId}
                                      onPatch={(patch) => updateBlock(pg.pageId, idx, patch)}
                                      placingZoneId={dragDropDiagramPlacingId[key] ?? null}
                                      onPlacingZoneId={(id) =>
                                        setDragDropDiagramPlacingId((p) => ({ ...p, [key]: id }))
                                      }
                                      resolveImageUrlForPreview={(u) => makeAbsoluteAssetUrl(u) ?? u}
                                      safeStr={safeStr}
                                    />
                                    <label style={{ display: "block" }}>
                                      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                        AI topic or prompt (optional)
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          color: "#64748b",
                                          marginBottom: 6,
                                          lineHeight: 1.45,
                                        }}
                                      >
                                        With <strong>8+ characters</strong>, Generate pairs builds{" "}
                                        <strong>4–6</strong> GCSE-style pairs from this alone. Otherwise AI uses lesson
                                        title, page title, activity title/intro/instructions above (up to 8 pairs).
                                      </div>
                                      <textarea
                                        value={dragDropAiTopicPrompt[key] ?? ""}
                                        onChange={(e) =>
                                          setDragDropAiTopicPrompt((prev) => ({
                                            ...prev,
                                            [key]: e.target.value,
                                          }))
                                        }
                                        rows={3}
                                        placeholder="e.g. Quantitative chemistry — mole, Avogadro, concentration…"
                                        style={{
                                          width: "100%",
                                          boxSizing: "border-box",
                                          padding: "10px 12px",
                                          borderRadius: 10,
                                          border: "1.5px solid rgba(148,163,184,0.55)",
                                          fontSize: "0.875rem",
                                          fontFamily: "inherit",
                                          lineHeight: 1.45,
                                        }}
                                      />
                                    </label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                                      {(() => {
                                        const ddmMode = dragDropMatchModeFromBlockForProps(b);
                                        const pairCap =
                                          ddmMode === "text-to-image" ? TEXT_TO_IMAGE_PAIR_LIMIT : 20;
                                        const curPairs = Array.isArray(b.pairs) ? b.pairs : [];
                                        const atPairCap = curPairs.length >= pairCap;
                                        return (
                                      <button
                                        type="button"
                                        disabled={atPairCap}
                                        onClick={() => {
                                          const cur = [...curPairs];
                                          cur.push({
                                            id: newLessonBlockId(),
                                            prompt: "",
                                            answer: "",
                                            explanation: "",
                                          });
                                          updateBlock(pg.pageId, idx, { pairs: cur });
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(14,165,233,0.45)",
                                          background: "rgba(224,242,254,0.5)",
                                          cursor: atPairCap ? "not-allowed" : "pointer",
                                          fontWeight: 700,
                                          fontSize: "0.8125rem",
                                          opacity: atPairCap ? 0.55 : 1,
                                        }}
                                      >
                                        + Add pair
                                      </button>
                                        );
                                      })()}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (
                                            !window.confirm("This will replace existing pairs with the template. Continue?")
                                          )
                                            return;
                                          updateBlock(pg.pageId, idx, {
                                            pairs: CELL_ORGANELLES_DRAG_DROP_TEMPLATE.map((row) => ({
                                              id: newLessonBlockId(),
                                              prompt: row.prompt,
                                              answer: row.answer,
                                              explanation: row.explanation,
                                            })),
                                          });
                                        }}
                                        style={{
                                          padding: "6px 12px",
                                          borderRadius: 8,
                                          border: "2px solid rgba(59,130,246,0.35)",
                                          background: "rgba(59,130,246,0.08)",
                                          cursor: "pointer",
                                          fontWeight: 700,
                                          fontSize: "0.8125rem",
                                        }}
                                      >
                                        Use cell organelles template
                                      </button>
                                      {(() => {
                                        const dndAi = dragDropPairAiUi[key] ?? { loading: false, message: null };
                                        const topicTrim = String(dragDropAiTopicPrompt[key] ?? "").trim();
                                        const useTopicMode = topicTrim.length >= 8;
                                        const excerptText = [
                                          safeStr(formData.title, ""),
                                          safeStr(pg.title, ""),
                                          safeStr(b.title, ""),
                                          safeStr(b.intro, ""),
                                          safeStr(b.instructions, ""),
                                        ]
                                          .map((s) => String(s).trim())
                                          .filter((s) => s.length > 0)
                                          .join("\n\n");
                                        const dndAiDisabled =
                                          dndAi.loading || (!useTopicMode && excerptText.length < 12);
                                        return (
                                          <>
                                            <button
                                              type="button"
                                              disabled={dndAiDisabled}
                                              onClick={async () => {
                                                if (
                                                  !window.confirm("Replace existing pairs with AI-generated ones?")
                                                )
                                                  return;
                                                setDragDropPairAiUi((prev) => ({
                                                  ...prev,
                                                  [key]: { loading: true, message: null },
                                                }));
                                                try {
                                                  const aiPairs = await generateDragDropPairsFromText({
                                                    lessonTitle:
                                                      safeStr(formData.title, "").trim() || undefined,
                                                    pageTitle: safeStr(pg.title, "").trim() || undefined,
                                                    subject: safeStr(formData.subject, "").trim() || undefined,
                                                    level: safeStr(formData.level, "").trim() || undefined,
                                                    text: useTopicMode ? topicTrim : excerptText,
                                                    source: useTopicMode ? "topic" : "lessonExcerpt",
                                                  });
                                                  if (aiPairs.length === 0) {
                                                    setDragDropPairAiUi((prev) => ({
                                                      ...prev,
                                                      [key]: { loading: false, message: "empty" },
                                                    }));
                                                    return;
                                                  }
                                                  const pairCap =
                                                    dragDropMatchModeFromBlockForProps(b) === "text-to-image"
                                                      ? TEXT_TO_IMAGE_PAIR_LIMIT
                                                      : 20;
                                                  const newPairs = aiPairs.slice(0, pairCap).map((p) => ({
                                                    id: newLessonBlockId(),
                                                    prompt: p.prompt,
                                                    answer: p.answer,
                                                    explanation: p.explanation || "",
                                                  }));
                                                  updateBlock(pg.pageId, idx, { pairs: newPairs });
                                                  setDragDropPairAiUi((prev) => ({
                                                    ...prev,
                                                    [key]: { loading: false, message: null },
                                                  }));
                                                } catch (err: unknown) {
                                                  const msg =
                                                    err && typeof err === "object" && "message" in err
                                                      ? String((err as { message?: string }).message || "")
                                                      : "";
                                                  setDragDropPairAiUi((prev) => ({
                                                    ...prev,
                                                    [key]: {
                                                      loading: false,
                                                      message:
                                                        msg &&
                                                        /OPENAI|LLM_API_KEY|not configured|disabled/i.test(msg)
                                                          ? msg
                                                          : "error",
                                                    },
                                                  }));
                                                }
                                              }}
                                              style={{
                                                padding: "6px 12px",
                                                borderRadius: 8,
                                                border: "2px solid rgba(124,58,237,0.4)",
                                                background: "rgba(243,232,255,0.75)",
                                                cursor: dndAiDisabled ? "not-allowed" : "pointer",
                                                fontWeight: 700,
                                                fontSize: "0.8125rem",
                                                opacity: dndAiDisabled ? 0.55 : 1,
                                              }}
                                            >
                                              {dndAi.loading ? "Generating…" : "Generate pairs with AI"}
                                            </button>
                                            {dndAi.message === "error" ? (
                                              <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                                                Could not generate pairs. Try again.
                                              </span>
                                            ) : dndAi.message === "empty" ? (
                                              <span style={{ fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                                                No suitable pairs generated.
                                              </span>
                                            ) : dndAi.message ? (
                                              <span style={{ fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>
                                                {dndAi.message}
                                              </span>
                                            ) : null}
                                          </>
                                        );
                                      })()}
                                    </div>
                                    {(Array.isArray(b.pairs) ? b.pairs : []).map((pair, pi) => {
                                      const pairsList = (Array.isArray(b.pairs) ? b.pairs : []) as NonNullable<
                                        LessonPageBlock["pairs"]
                                      >;
                                      return (
                                        <div
                                          key={pair.id || `pair-${pi}`}
                                          style={{
                                            padding: 12,
                                            borderRadius: 10,
                                            border: "1px solid #e2e8f0",
                                            background: "#fafafa",
                                          }}
                                        >
                                          <div style={{ fontWeight: 800, marginBottom: 8, color: "#0369a1" }}>
                                            Pair {pi + 1}
                                          </div>
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Prompt</div>
                                            <input
                                              value={pair.prompt ?? ""}
                                              onChange={(e) => {
                                                const next = [...pairsList];
                                                if (next[pi]) next[pi] = { ...next[pi], prompt: e.target.value };
                                                updateBlock(pg.pageId, idx, { pairs: next });
                                              }}
                                              style={{
                                                width: "100%",
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: "1px solid #cbd5e1",
                                                fontSize: "0.875rem",
                                              }}
                                            />
                                          </label>
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>Answer</div>
                                            <input
                                              value={pair.answer ?? ""}
                                              onChange={(e) => {
                                                const next = [...pairsList];
                                                if (next[pi]) next[pi] = { ...next[pi], answer: e.target.value };
                                                updateBlock(pg.pageId, idx, { pairs: next });
                                              }}
                                              style={{
                                                width: "100%",
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: "1px solid #cbd5e1",
                                                fontSize: "0.875rem",
                                              }}
                                            />
                                          </label>
                                          {(() => {
                                            const ddmPairKey = `${key}:ddm-pair:${pi}`;
                                            const pairImgUploading = uploadingKey === ddmPairKey;
                                            const rawPairImg = String(pair.answerImageUrl ?? "").trim();
                                            const pairImgSrc =
                                              rawPairImg && hasRenderableLessonImageSrc(rawPairImg)
                                                ? makeAbsoluteAssetUrl(rawPairImg) ?? rawPairImg
                                                : "";
                                            return (
                                              <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                                  Answer image (optional)
                                                </div>
                                                <div
                                                  style={{
                                                    fontSize: 12,
                                                    color: "#64748b",
                                                    marginBottom: 6,
                                                    lineHeight: 1.4,
                                                  }}
                                                >
                                                  Paste a URL or upload — stored under{" "}
                                                  <code style={{ fontSize: 11 }}>lesson-media/teacher_…/lesson_new/…</code>.
                                                </div>
                                                <input
                                                  ref={(el) => {
                                                    fileInputRef.current[ddmPairKey] = el;
                                                  }}
                                                  type="file"
                                                  accept="image/*"
                                                  style={{ display: "none" }}
                                                  onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (!f) return;
                                                    uploadImageForDragDropMatchPairAnswer(
                                                      f,
                                                      pg.pageId,
                                                      idx,
                                                      pi,
                                                      (url) => {
                                                        const next = [...pairsList];
                                                        if (next[pi]) next[pi] = { ...next[pi], answerImageUrl: url };
                                                        updateBlock(pg.pageId, idx, { pairs: next });
                                                      }
                                                    );
                                                    e.target.value = "";
                                                  }}
                                                />
                                                <div
                                                  style={{
                                                    display: "flex",
                                                    flexWrap: "wrap",
                                                    gap: 8,
                                                    alignItems: "stretch",
                                                    marginBottom: rawPairImg ? 8 : 0,
                                                  }}
                                                >
                                                  <label style={{ flex: "1 1 220px", minWidth: 0, margin: 0 }}>
                                                    <span
                                                      style={{
                                                        display: "block",
                                                        fontWeight: 600,
                                                        fontSize: 12,
                                                        marginBottom: 4,
                                                      }}
                                                    >
                                                      Image URL
                                                    </span>
                                                    <input
                                                      value={pair.answerImageUrl ?? ""}
                                                      onChange={(e) => {
                                                        const next = [...pairsList];
                                                        if (next[pi])
                                                          next[pi] = { ...next[pi], answerImageUrl: e.target.value };
                                                        updateBlock(pg.pageId, idx, { pairs: next });
                                                      }}
                                                      placeholder="https://… or path after upload"
                                                      style={{
                                                        width: "100%",
                                                        padding: "8px 10px",
                                                        borderRadius: 8,
                                                        border: "1px solid #cbd5e1",
                                                        boxSizing: "border-box",
                                                        fontSize: "0.875rem",
                                                      }}
                                                    />
                                                  </label>
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      flexDirection: "column",
                                                      justifyContent: "flex-end",
                                                      flex: "0 0 auto",
                                                    }}
                                                  >
                                                    <span
                                                      style={{
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        marginBottom: 4,
                                                        opacity: 0,
                                                      }}
                                                    >
                                                      &nbsp;
                                                    </span>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const input = fileInputRef.current[ddmPairKey];
                                                        if (input) {
                                                          input.value = "";
                                                          input.click();
                                                        }
                                                      }}
                                                      disabled={pairImgUploading}
                                                      style={{
                                                        padding: "8px 14px",
                                                        borderRadius: 8,
                                                        border: "2px solid rgba(99,102,241,0.35)",
                                                        background: "white",
                                                        cursor: pairImgUploading ? "not-allowed" : "pointer",
                                                        fontWeight: 700,
                                                        fontSize: 13,
                                                        whiteSpace: "nowrap",
                                                      }}
                                                    >
                                                      {pairImgUploading ? "Uploading…" : "Upload image"}
                                                    </button>
                                                  </div>
                                                </div>
                                                {rawPairImg && pairImgSrc ? (
                                                  <div
                                                    style={{
                                                      display: "flex",
                                                      flexWrap: "wrap",
                                                      alignItems: "center",
                                                      gap: 12,
                                                      padding: 10,
                                                      borderRadius: 10,
                                                      border: "1px solid #e2e8f0",
                                                      background: "#fff",
                                                    }}
                                                  >
                                                    <img
                                                      src={pairImgSrc}
                                                      alt=""
                                                      style={{
                                                        width: 72,
                                                        height: 72,
                                                        objectFit: "contain",
                                                        borderRadius: 8,
                                                        border: "1px solid #cbd5e1",
                                                        background: "#f8fafc",
                                                      }}
                                                    />
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                                      <span
                                                        style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}
                                                      >
                                                        Preview — upload again to replace
                                                      </span>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const next = [...pairsList];
                                                          if (next[pi])
                                                            next[pi] = { ...next[pi], answerImageUrl: "" };
                                                          updateBlock(pg.pageId, idx, { pairs: next });
                                                        }}
                                                        style={{
                                                          alignSelf: "flex-start",
                                                          padding: "6px 12px",
                                                          borderRadius: 8,
                                                          border: "1px solid #f87171",
                                                          background: "#fef2f2",
                                                          color: "#b91c1c",
                                                          fontWeight: 700,
                                                          fontSize: 12,
                                                          cursor: "pointer",
                                                        }}
                                                      >
                                                        Clear image
                                                      </button>
                                                    </div>
                                                  </div>
                                                ) : null}
                                              </div>
                                            );
                                          })()}
                                          <label style={{ display: "block", marginBottom: 8 }}>
                                            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
                                              Explanation (optional)
                                            </div>
                                            <LessonAutoTextarea
                                              editorVariant="plain"
                                              value={pair.explanation ?? ""}
                                              onChange={(v) => {
                                                const next = [...pairsList];
                                                if (next[pi]) next[pi] = { ...next[pi], explanation: v };
                                                updateBlock(pg.pageId, idx, { pairs: next });
                                              }}
                                              placeholder="Shown after checking…"
                                              minHeightPx={72}
                                              style={{ fontSize: "0.875rem" }}
                                            />
                                          </label>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (pairsList.length <= 1) return;
                                              const next = pairsList.filter((_, i) => i !== pi);
                                              updateBlock(pg.pageId, idx, { pairs: next });
                                            }}
                                            disabled={pairsList.length <= 1}
                                            style={{
                                              marginTop: 4,
                                              padding: "4px 10px",
                                              borderRadius: 6,
                                              border: "1px solid #f87171",
                                              background: "#fef2f2",
                                              color: "#b91c1c",
                                              cursor: pairsList.length <= 1 ? "not-allowed" : "pointer",
                                              fontSize: 12,
                                              fontWeight: 600,
                                              opacity: pairsList.length <= 1 ? 0.5 : 1,
                                            }}
                                          >
                                            Delete pair
                                          </button>
                                        </div>
                                      );
                                    })}
                                    <div style={{ marginTop: 8 }}>
                                      <div
                                        style={{
                                          fontWeight: 700,
                                          marginBottom: 6,
                                          fontSize: "0.8125rem",
                                          color: "#475569",
                                        }}
                                      >
                                        Student preview
                                      </div>
                                      <DragDropMatchBlock
                                        resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                                        block={{
                                          title: safeStr(b.title, ""),
                                          intro: safeStr(b.intro, ""),
                                          instructions: safeStr(b.instructions, ""),
                                          ...(() => {
                                            const mm = dragDropMatchModeFromBlockForProps(b);
                                            return mm ? { matchMode: mm } : {};
                                          })(),
                                          ...(dragDropMatchModeFromBlockForProps(b) === "diagram" &&
                                          safeStr(b.imageUrl, "")
                                            ? { imageUrl: safeStr(b.imageUrl, "") }
                                            : {}),
                                          pairs: (Array.isArray(b.pairs) ? b.pairs : []).map((p, i) =>
                                            mapDragDropPairForBlockRender(p, i)
                                          ),
                                          ...(dragDropMatchModeFromBlockForProps(b) === "diagram" &&
                                          Array.isArray(b.dropZones)
                                            ? {
                                                dropZones: b.dropZones.map((z, zi) => {
                                                  const x = coerceDiagramZonePct(z?.x);
                                                  const y = coerceDiagramZonePct(z?.y);
                                                  return {
                                                    id: String(z?.id ?? "").trim() || `dz${zi}`,
                                                    ...(x !== undefined ? { x } : {}),
                                                    ...(y !== undefined ? { y } : {}),
                                                    correctPairId: String(z?.correctPairId ?? "").trim(),
                                                    ...(z?.explanation != null && String(z.explanation).trim()
                                                      ? { explanation: String(z.explanation).trim() }
                                                      : {}),
                                                  };
                                                }),
                                              }
                                            : {}),
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : null}
                                {b.type === "graph" ? (
                                  <GraphBlockAuthoring
                                    blk={b as import("../components/lesson/GraphBlockAuthoring").GraphBlockAuthoringBlock}
                                    onPatch={(patch) =>
                                      updateBlock(
                                        pg.pageId,
                                        idx,
                                        patch as unknown as Partial<LessonPageBlock>
                                      )
                                    }
                                    lessonTitle={safeStr(formData.title, "")}
                                    pageTitle={pg.title}
                                    subject={topicSelection.subject}
                                    level={formData.level}
                                    compact
                                  />
                                ) : null}
                              </div>
                            ) : (
                              <>
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
                                if (!insert?.text?.trim()) return;

                                const text = insert.text;
                                const el = e.currentTarget;
                                const start = el.selectionStart ?? el.value.length;
                                const end = el.selectionEnd ?? el.value.length;
                                const before = el.value.slice(0, start);
                                const after = el.value.slice(end);
                                const combinedTrim = (before + text + after).trim();

                                let structured = tryParseFlexibleCheckpointMcq(text.trim());
                                if (
                                  !structured &&
                                  lessonCheckpointWholeCellPaste(el, start, end, before, after)
                                ) {
                                  structured = tryParseFlexibleCheckpointMcq(combinedTrim);
                                }

                                const blockLegacy = normalizeBlockType(String(b.type ?? "text"));
                                if (
                                  structured &&
                                  blockLegacy === "text" &&
                                  lessonCheckpointWholeCellPaste(el, start, end, before, after)
                                ) {
                                  e.preventDefault();
                                  const prevCpBlock = (pg.blocks ?? []).slice(0, idx).some((xb) => {
                                    const t = normalizeBlockType(String(xb?.type ?? "text"));
                                    return t === "checkpoint";
                                  });
                                  const optsFour = coerceLessonMcqOptionsFour(structured.options);
                                  const opts = [...optsFour];
                                  const parsedMarkScheme = markSchemeFromFlexibleCheckpointParse(structured);
                                  const clearInteractive: Partial<LessonPageBlock> = {
                                    pairs: [],
                                    sequenceSteps: [],
                                    intro: "",
                                    instructions: "",
                                    imageUrl: "",
                                    hotspots: [],
                                    title: "",
                                    dropZones: [],
                                  };
                                  if (!prevCpBlock) {
                                    updateBlock(pg.pageId, idx, {
                                      ...clearInteractive,
                                      type: "checkpoint",
                                      content: "",
                                      prompt: structured.prompt,
                                      questionType: "mcq",
                                      options: opts,
                                      correctAnswer: structured.correctAnswer,
                                      explanation: structured.explanation || "",
                                      role: "quickCheck",
                                      ...(parsedMarkScheme?.length
                                        ? { markScheme: parsedMarkScheme }
                                        : { markScheme: [] }),
                                    });
                                    updateCheckpoint(pg.pageId, {
                                      question: structured.prompt,
                                      options: clampOptions(opts),
                                      answer: structured.correctAnswer,
                                      explanation: structured.explanation || "",
                                      ...(parsedMarkScheme?.length
                                        ? { markScheme: parsedMarkScheme }
                                        : Array.isArray(pg.checkpoint?.markScheme) &&
                                            pg.checkpoint!.markScheme!.length
                                          ? { markScheme: [...pg.checkpoint!.markScheme] }
                                          : {}),
                                    });
                                  } else {
                                    updateBlock(pg.pageId, idx, {
                                      ...clearInteractive,
                                      type: "selfCheck",
                                      content: "",
                                      prompt: structured.prompt,
                                      questionType: "mcq",
                                      options: clampOptions(opts),
                                      correctAnswer: structured.correctAnswer,
                                      explanation: structured.explanation || "",
                                      role: "selfCheck",
                                      ...(parsedMarkScheme?.length
                                        ? { markScheme: parsedMarkScheme }
                                        : {}),
                                    });
                                  }
                                  setTimeout(() => {
                                    try {
                                      el.focus();
                                      el.setSelectionRange(0, 0);
                                    } catch {}
                                  }, 0);
                                  return;
                                }

                                e.preventDefault();

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
                              </>
                            )}
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
                        <div style={ui.label}>Correct answer (must match an option)</div>
                        <input
                          value={safeStr(pg.checkpoint?.answer, "")}
                          onChange={(e) => updateCheckpoint(pg.pageId, { answer: e.target.value })}
                          style={ui.input}
                        />
                      </label>
                      <label style={{ display: "block", marginTop: 12 }}>
                        <div style={ui.label}>Explanation (optional)</div>
                        <div style={{ marginTop: 4, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
                          Shown after students check or reveal the answer
                        </div>
                        <LessonAutoTextarea
                          editorVariant="plain"
                          value={safeStr(pg.checkpoint?.explanation, "")}
                          onChange={(v) => updateCheckpoint(pg.pageId, { explanation: v })}
                          minHeightPx={80}
                          style={{ fontSize: "0.875rem" }}
                        />
                      </label>
                      <label style={{ display: "block", marginTop: 12 }}>
                        <div style={ui.label}>Mark scheme (optional)</div>
                        <div style={{ marginTop: 4, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
                          One point per line — appended to the explanation for students when present.
                        </div>
                        <LessonAutoTextarea
                          editorVariant="plain"
                          value={(pg.checkpoint?.markScheme ?? []).join("\n")}
                          onChange={(v) =>
                            updateCheckpoint(pg.pageId, {
                              markScheme: v
                                .split("\n")
                                .map((line) => line.trim())
                                .filter(Boolean)
                                .slice(0, 20),
                            })
                          }
                          minHeightPx={72}
                          style={{ fontSize: "0.875rem" }}
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
                        {(orderedPages[0].blocks || []).map((b, idx) => {
                          const blockType = normalizeBlockType(String(b?.type ?? "text"));
                          const pg0 = orderedPages[0];
                          const labelRow =
                            blockType !== "text" ? (
                              <div
                                style={{ fontWeight: 600, fontSize: "0.8125rem", color: "#334155", marginBottom: 4 }}
                              >
                                {BLOCK_META[blockType]?.icon ?? "📝"}{" "}
                                {lessonBlockDisplayLabel(
                                  blockType,
                                  idx,
                                  (b as LessonPageBlock).title
                                )}
                              </div>
                            ) : null;

                          if (blockType === "checkpoint") {
                            const cp = pg0.checkpoint;
                            const q = safeStr(b.prompt ?? cp?.question, "");
                            const toFour = (o: unknown): string[] => {
                              const a = Array.isArray(o)
                                ? o.map((x) => safeStr(String(x ?? ""), ""))
                                : [];
                              while (a.length < 4) a.push("");
                              return a.slice(0, 4);
                            };
                            const opts = toFour(b.options as unknown);
                            const optsCp = toFour(cp?.options as unknown);
                            const useOpts = opts.filter(Boolean).length >= 2 ? opts : optsCp;
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                <CheckpointCard
                                  question={q}
                                  options={useOpts}
                                  answer={safeStr(b.correctAnswer ?? cp?.answer, "")}
                                  explanation={
                                    safeStr(b.explanation ?? cp?.explanation, "") || undefined
                                  }
                                  markScheme={
                                    Array.isArray(b.markScheme)
                                      ? b.markScheme
                                      : Array.isArray(cp?.markScheme)
                                        ? cp.markScheme
                                        : undefined
                                  }
                                />
                              </div>
                            );
                          }

                          if (blockType === "selfCheck") {
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                <InlineSelfCheckBlock
                                  prompt={safeStr((b as LessonPageBlock).prompt, "")}
                                  questionType={
                                    (b as LessonPageBlock).questionType === "short" ? "short" : "mcq"
                                  }
                                  options={Array.isArray((b as LessonPageBlock).options) ? b.options ?? [] : []}
                                  correctAnswer={safeStr((b as LessonPageBlock).correctAnswer, "")}
                                  explanation={mergeCheckpointExplanationParts({
                                    explanation:
                                      (b as LessonPageBlock).explanation != null
                                        ? String((b as LessonPageBlock).explanation)
                                        : undefined,
                                    markScheme: (() => {
                                      const lines = checkpointMarkSchemeLines(
                                        (b as LessonPageBlock).markScheme
                                      );
                                      return lines.length ? lines : undefined;
                                    })(),
                                  })}
                                />
                              </div>
                            );
                          }

                          if (blockType === "interactiveSequence") {
                            const isq = b as LessonPageBlock;
                            const rawSteps = Array.isArray(isq.sequenceSteps) ? isq.sequenceSteps : [];
                            const steps = rawSteps.map((s) => {
                              const te =
                                typeof s?.testExplanation === "string"
                                  ? String(s.testExplanation).trim()
                                  : "";
                              return {
                                title: String(s?.title ?? ""),
                                description: String(s?.description ?? ""),
                                imageUrl: String(s?.imageUrl ?? ""),
                                caption: String(s?.caption ?? ""),
                                ...(te ? { testExplanation: te } : {}),
                              };
                            });
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                <InteractiveSequenceBlock
                                  blockTitle={safeStr(isq.title, "")}
                                  intro={safeStr(isq.intro, "")}
                                  steps={steps}
                                  resolveImageUrl={(u) => toAbsoluteAssetUrl(u) ?? u}
                                />
                              </div>
                            );
                          }

                          if (blockType === "interactiveDiagram") {
                            const idg = b as LessonPageBlock & {
                              hotspots?: Array<{
                                id?: string;
                                x?: number;
                                y?: number;
                                label?: string;
                                description?: string;
                                explanation?: string;
                              }>;
                            };
                            const hs = (Array.isArray(idg.hotspots) ? idg.hotspots : []).map((h, i) =>
                              normalizeInteractiveDiagramHotspot(h, i)
                            );
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                <InteractiveDiagramBlock
                                  blockTitle={safeStr(idg.title, "")}
                                  intro={[
                                    safeStr(idg.intro, ""),
                                    safeStr(idg.content, ""),
                                  ]
                                    .filter(Boolean)
                                    .join("\n\n")}
                                  imageUrl={String(idg.imageUrl ?? "")}
                                  hotspots={hs}
                                  resolveImageUrl={(u) => toAbsoluteAssetUrl(u) ?? u}
                                />
                              </div>
                            );
                          }

                          if (blockType === "graph") {
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                <GraphBlock block={b} showAnswers />
                              </div>
                            );
                          }

                          if (blockType === "diagram") {
                            const d = b as LessonPageBlock;
                            const img = diagramImageUrlForPreview(d.imageUrl);
                            const caption = safeStr(d.caption, "");
                            const md = diagramMarkdownContentForPreview(d.content, img);
                            const imgSrc = img ? toAbsoluteAssetUrl(img) ?? img : "";
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                {imgSrc && hasRenderableLessonImageSrc(imgSrc) ? (
                                  <LessonImageFrame variant="secondary" lightboxSrc={imgSrc}>
                                    <img
                                      src={imgSrc}
                                      alt={caption || "Diagram"}
                                      style={lessonImageFrameImgStyle}
                                      onError={hideBrokenLessonImage}
                                    />
                                  </LessonImageFrame>
                                ) : null}
                                {md ? (
                                  <div
                                    className="lesson-content"
                                    style={{ fontSize: "0.8rem", color: "#334155", wordBreak: "break-word" }}
                                  >
                                    <LessonMarkdown
                                      className="lesson-md-body"
                                      components={createPreviewMarkdownComponents}
                                      urlTransform={(url) => {
                                        try {
                                          const decoded = url?.includes("%")
                                            ? decodeURIComponent(url)
                                            : (url ?? "");
                                          const abs = toAbsoluteAssetUrl(decoded);
                                          if (abs) return abs;
                                          return defaultUrlTransform(url ?? "");
                                        } catch {
                                          return defaultUrlTransform(url ?? "");
                                        }
                                      }}
                                    >
                                      {preprocessMarkdownAssetUrls(md)}
                                    </LessonMarkdown>
                                  </div>
                                ) : !imgSrc ? (
                                  <p
                                    style={{
                                      margin: "6px 0 0",
                                      fontSize: "0.75rem",
                                      color: "#94a3b8",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    Diagram image not set
                                  </p>
                                ) : null}
                              </div>
                            );
                          }

                          if (blockType === "dragDropMatch") {
                            const ddm = b as LessonPageBlock;
                            return (
                              <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                                {labelRow}
                                <DragDropMatchBlock
                                  resolveImageUrl={(u) => makeAbsoluteAssetUrl(u) ?? u}
                                  block={{
                                    title: safeStr(ddm.title, ""),
                                    intro: safeStr(ddm.intro, ""),
                                    instructions: safeStr(ddm.instructions, ""),
                                    ...(() => {
                                      const mm = dragDropMatchModeFromBlockForProps(ddm);
                                      return mm ? { matchMode: mm } : {};
                                    })(),
                                    ...(dragDropMatchModeFromBlockForProps(ddm) === "diagram" &&
                                    safeStr(ddm.imageUrl, "")
                                      ? { imageUrl: safeStr(ddm.imageUrl, "") }
                                      : {}),
                                    pairs: (Array.isArray(ddm.pairs) ? ddm.pairs : []).map((p, i) =>
                                      mapDragDropPairForBlockRender(p, i)
                                    ),
                                    ...(Array.isArray(ddm.dropZones)
                                      ? {
                                          dropZones: ddm.dropZones.map((z, zi) => {
                                            const x = coerceDiagramZonePct(z?.x);
                                            const y = coerceDiagramZonePct(z?.y);
                                            return {
                                              id: String(z?.id ?? "").trim() || `dz${zi}`,
                                              ...(x !== undefined ? { x } : {}),
                                              ...(y !== undefined ? { y } : {}),
                                              correctPairId: String(z?.correctPairId ?? "").trim(),
                                              ...(z?.explanation != null && String(z.explanation).trim()
                                                ? { explanation: String(z.explanation).trim() }
                                                : {}),
                                            };
                                          }),
                                        }
                                      : {}),
                                  }}
                                />
                              </div>
                            );
                          }

                          return (
                            <div key={`prev-${idx}`} style={getBlockStyle(blockType)}>
                              {blockType !== "text" ? labelRow : null}
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
                          );
                        })}
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
      {interactiveBlockCreation ? (
        <InteractiveBlockCreationDialog
          open
          blockType={
            interactiveBlockCreation.option.type as
              | "interactiveSequence"
              | "interactiveDiagram"
              | "dragDropMatch"
          }
          lessonTitle={formData.title}
          pageTitle={
            orderedPages.find((p) => p.pageId === interactiveBlockCreation.pageId)?.title
          }
          subject={formData.subject}
          level={formData.level}
          onCancel={() => setInteractiveBlockCreation(null)}
          onConfirm={(raw) => {
            const ctx = interactiveBlockCreation;
            if (!ctx) return;
            insertPreparedLessonBlockCreate(ctx.pageId, raw, {
              insertAt: ctx.insertAt,
              role: ctx.option.role,
              title: ctx.option.title,
            });
            setInteractiveBlockCreation(null);
          }}
        />
      ) : null}
    </>
    </LessonImageLightboxProvider>
  );
};

export default CreateLessonPage;