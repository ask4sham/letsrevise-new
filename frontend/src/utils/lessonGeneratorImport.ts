import {
  GENERATOR_KIND_TO_EDITOR_SPEC,
  LESSON_GENERATOR_EXPORT_FORMAT_V1,
} from "../constants/lessonGeneratorExchange.v1";
import { logImportDebug, isImportDebugEnabled } from "./lessonGeneratorImportDebug";
import { normalizeBlockType, type LessonBlockType } from "../types/lessonBlocks";
import {
  parseDragDropDiagramImageFit,
  parseDragDropDiagramImagePosition,
  normalizeDragDropPairRow,
  resolveDragDropMatchModeForPersist,
  sanitizeDiagramDropZonesForAuthoring,
  readDragDropMatchModeFromBlock,
  resolveDragDropPersistMode,
} from "./dragDropMatchDiagram";
import {
  graphBlockForPersist,
  mergeGraphBlockFromExportContent,
} from "../components/lesson/graphBlockTypes";
import { coerceLessonMcqOptionsFour } from "./parseFlexibleCheckpointPaste";
import { applyDifficultyToMarkScheme, normalizeCheckpointDifficultyTier } from "./checkpointDifficulty";
import {
  isPlaceholderMcqOptions,
  recoverMcqFieldsFromBlockContent,
} from "./mcqPlaceholderOptions";
import { stripSs1PrefixFromTitle } from "./formatBlockHeading";
import { mergeLessonBlockIntroFields } from "./lessonRichText";
import { canonicalSlugFromText } from "./normalizeLessonTopicKey";
import { cleanSequenceStepDescription } from "./cleanSequenceStepDescription";
import { checkpointMarkSchemeForBlockPersist } from "./checkpointFeedback";
import {
  buildHotspotsFromGeneratorScript,
  hydrateInteractiveSequenceStepsForEditor,
} from "./parseGeneratorVisualScript";
import { formatExamPracticeContentForImport } from "./formatExamPracticeContent";
import { formatLessonBlockContentForImport } from "./formatLessonBlockContent";
import { resolveImportedCheckpointExplanation } from "./deriveCheckpointWhyExplanation";

const VALID_STARTER_PAGE_CHECKPOINT = {
  question: "Which statement is correct?",
  options: ["Option 1", "Option 2", "Option 3", "Option 4"],
  answer: "Option 1",
  explanation: "",
  markScheme: [] as string[],
};

export type GeneratorExportV1Block = {
  generatorBlockKind?: string;
  blockNumber?: number | null;
  pasteTargetLabel?: string;
  headingTitle?: string;
  editorType: string;
  role?: string;
  title?: string;
  payload?: Record<string, unknown>;
};

export type GeneratorExportV1Page = {
  title?: string;
  order?: number;
  blocks: GeneratorExportV1Block[];
};

export type GeneratorExportV1Document = {
  formatVersion: string;
  exportedAt?: string;
  source?: string;
  teacherBrainInjection?: {
    injectionCount?: number;
    injections?: unknown[];
  };
  lesson?: {
    title?: string;
    subject?: string;
    keyStage?: string;
    examBoard?: string;
    topic?: string;
    tier?: string;
    topicKey?: string;
    canonicalTopicKey?: string;
    topicResolvedFrom?: string;
  };
  pages: GeneratorExportV1Page[];
};

function newPid() {
  return `p_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function isGeneratorExportV1(doc: unknown): doc is GeneratorExportV1Document {
  if (!doc || typeof doc !== "object") return false;
  const o = doc as { formatVersion?: unknown; pages?: unknown };
  return (
    o.formatVersion === LESSON_GENERATOR_EXPORT_FORMAT_V1 &&
    Array.isArray(o.pages)
  );
}

function padOptions(raw: unknown): string[] {
  return [...coerceLessonMcqOptionsFour(raw)];
}

/** Persisted title: clean label only; student view adds `blockNumber —` via formatStudentBlockHeading. */
function generatorImportBlockTitle(record: GeneratorExportV1Block): string {
  const label = stripSs1PrefixFromTitle(
    String(record.headingTitle ?? record.title ?? "").trim()
  );
  return label;
}

function importNoteFromPayload(payload: Record<string, unknown>): string | undefined {
  const note = String(payload.note ?? "").trim();
  return note || undefined;
}

function attachBlockNumber(
  block: Record<string, unknown>,
  record: GeneratorExportV1Block
): Record<string, unknown> {
  const n = record.blockNumber;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) {
    return { ...block, number: Math.trunc(n) };
  }
  return block;
}

function enrichMcqFromContentIfNeeded(
  fields: {
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    content?: string;
  },
  contentRaw: unknown
): typeof fields {
  if (!isPlaceholderMcqOptions(fields.options)) return fields;
  const recovered = recoverMcqFieldsFromBlockContent(contentRaw);
  if (!recovered) return fields;
  return {
    ...fields,
    prompt: recovered.prompt || fields.prompt,
    options: recovered.options,
    correctAnswer: recovered.correctAnswer || fields.correctAnswer,
    explanation: recovered.explanation || fields.explanation,
  };
}


function normalizeMcqCorrectAnswer(correctAnswer: string, options: string[]): string {
  const ca = String(correctAnswer ?? "").trim();
  if (!ca) return options.find((o) => String(o).trim())?.trim() || "";
  const match = options.find(
    (o) => String(o).trim().toLowerCase() === ca.toLowerCase()
  );
  return match != null ? String(match).trim() : ca;
}

/** Prefer editorType; recover from generatorBlockKind when export downgraded to text. */
function resolveImportEditorType(record: GeneratorExportV1Block): LessonBlockType {
  const fromEditor = normalizeBlockType(record.editorType);
  if (fromEditor !== "text") return fromEditor;
  const kind = String(record.generatorBlockKind ?? "").trim();
  const spec = kind ? GENERATOR_KIND_TO_EDITOR_SPEC[kind] : undefined;
  if (spec?.editorType) return normalizeBlockType(spec.editorType);
  return fromEditor;
}

/** Page.checkpoint must mirror the first inline checkpoint block for CreateLesson save + student view. */
function pageCheckpointFromFirstBlock(
  blocks: Record<string, unknown>[]
): CreateLessonPageShape["checkpoint"] {
  const fallback: CreateLessonPageShape["checkpoint"] = {
    ...VALID_STARTER_PAGE_CHECKPOINT,
  };
  const cp = blocks.find((b) => b && String(b.type) === "checkpoint");
  if (!cp) return fallback;
  let opts = padOptions(cp.options);
  let q = String(cp.prompt ?? (cp as { question?: unknown }).question ?? "").trim();
  let ans = String(cp.correctAnswer ?? (cp as { answer?: unknown }).answer ?? "").trim();
  let expl = String(cp.explanation ?? "").trim();
  const enrichedCp = enrichMcqFromContentIfNeeded(
    { prompt: q, options: opts, correctAnswer: ans, explanation: expl },
    cp.content
  );
  opts = enrichedCp.options;
  q = enrichedCp.prompt;
  ans = enrichedCp.correctAnswer;
  expl = enrichedCp.explanation;
  const msRaw = cp.markScheme;
  const markScheme = Array.isArray(msRaw)
    ? msRaw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 20)
    : ([] as string[]);
  const hasMcqBody =
    opts.filter((o) => o.trim() && !isPlaceholderMcqOptions([o])).length >= 2 && q.length > 0;
  if (!hasMcqBody) return fallback;
  return {
    question: q || fallback.question,
    options: opts,
    answer: ans || opts.find(Boolean) || fallback.answer,
    explanation: expl,
    markScheme,
  };
}

type ImportLessonMeta = { topic?: string; title?: string };

/**
 * Persist at most one `checkpoint` block per page — Create Lesson mirrors page.checkpoint from that slot.
 * Additional generator checkpoints stay full MCQs as `selfCheck` (answers hidden until reveal/check).
 * If the elevated self-check would keep the same stem/options as the first checkpoint, rewrite it
 * into a short retrieval self-check so import does not create duplicate questions.
 */
function normalizeImportStem(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function importStemsNearDuplicate(a: string, b: string): boolean {
  const na = normalizeImportStem(a);
  const nb = normalizeImportStem(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 20 && nb.length >= 20 && (na.includes(nb) || nb.includes(na))) return true;
  const sa = new Set(na.split(" ").filter((w) => w.length > 2));
  const sb = new Set(nb.split(" ").filter((w) => w.length > 2));
  if (!sa.size || !sb.size) return false;
  let inter = 0;
  Array.from(sa).forEach((w) => {
    if (sb.has(w)) inter += 1;
  });
  const union = sa.size + sb.size - inter;
  return union ? inter / union >= 0.72 : false;
}

function elevateExtraImportedCheckpointsToSelfCheck(
  blocks: Record<string, unknown>[],
  lessonMeta: ImportLessonMeta = {}
): Record<string, unknown>[] {
  let seenCheckpoint = false;
  let firstCheckpointStem = "";
  let firstOptionsKey = "";
  let elevatedIndex = 0;
  const topicHint = String(lessonMeta.topic || lessonMeta.title || "this topic").trim();

  return blocks.map((raw) => {
    if (!raw || String(raw.type) !== "checkpoint") return raw;
    if (!seenCheckpoint) {
      seenCheckpoint = true;
      firstCheckpointStem = String(
        raw.prompt ?? (raw as { question?: unknown }).question ?? ""
      ).trim();
      const opts0 = padOptions(raw.options as unknown[]);
      firstOptionsKey = opts0
        .map((o) => normalizeImportStem(o))
        .filter(Boolean)
        .sort()
        .join("|");
      return raw;
    }
    elevatedIndex += 1;
    let opts = padOptions(raw.options as unknown[]);
    let prompt = String(raw.prompt ?? (raw as { question?: unknown }).question ?? "").trim();
    let ca = String(
      raw.correctAnswer ?? (raw as { answer?: unknown }).answer ?? ""
    ).trim();
    let expl = String(raw.explanation ?? "").trim();
    const enriched = enrichMcqFromContentIfNeeded(
      { prompt, options: opts, correctAnswer: ca, explanation: expl },
      raw.content
    );
    opts = enriched.options;
    prompt = enriched.prompt;
    ca = enriched.correctAnswer;
    expl = enriched.explanation;
    const msRaw = raw.markScheme;
    const msPersist = checkpointMarkSchemeForBlockPersist(
      Array.isArray(msRaw)
        ? msRaw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 20)
        : typeof msRaw === "string"
          ? msRaw
          : undefined
    );
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const role = typeof raw.role === "string" ? raw.role.trim() : "";

    const optionsKey = opts
      .map((o) => normalizeImportStem(o))
      .filter(Boolean)
      .sort()
      .join("|");
    const duplicateOfCheckpoint =
      importStemsNearDuplicate(prompt, firstCheckpointStem) ||
      (optionsKey && optionsKey === firstOptionsKey);

    if (duplicateOfCheckpoint) {
      const rewritten = `Self-check: explain one cause → effect link for ${topicHint} (do not only name terms). [${elevatedIndex}]`;
      return {
        type: "selfCheck",
        content: "",
        ...(title ? { title } : {}),
        ...(role ? { role } : {}),
        prompt: rewritten,
        questionType: "short",
        options: [],
        correctAnswer: "",
        explanation:
          "<details><summary>Reveal Answer</summary><p>Use precise GCSE vocabulary in a because → therefore chain.</p></details>",
      };
    }

    const out: Record<string, unknown> = {
      type: "selfCheck",
      content: "",
      ...(title ? { title } : {}),
      ...(role ? { role } : {}),
      prompt: prompt || "Question",
      questionType: "mcq",
      options: opts,
      correctAnswer: ca || opts.find(Boolean) || "",
      explanation: expl,
    };
    if (msPersist) out.markScheme = msPersist;
    return out;
  });
}

function recordToLessonBlock(
  record: GeneratorExportV1Block,
  lessonMeta: ImportLessonMeta = {}
): Record<string, unknown> {
  const t = resolveImportEditorType(record);
  const payload = record.payload ?? {};
  const title = generatorImportBlockTitle(record);
  const role = typeof record.role === "string" ? record.role : undefined;

  if (isImportDebugEnabled()) {
    const missing: string[] = [];
    if (t === "selfCheck" || t === "checkpoint") {
      if (!String(payload.prompt ?? "").trim()) missing.push("prompt");
      if (payload.questionType !== "short") {
        const opts = Array.isArray(payload.options) ? payload.options : [];
        if (opts.filter((o) => String(o).trim() && !/^\[Option \d/i.test(String(o))).length < 2) {
          missing.push("options");
        }
      }
      if (!String(payload.correctAnswer ?? "").trim()) missing.push("correctAnswer");
    }
    if (t === "interactiveDiagram" && !String(payload.imageUrl ?? "").trim()) {
      missing.push("imageUrl");
    }
    if (t === "interactiveSequence") {
      const steps = Array.isArray(payload.sequenceSteps) ? payload.sequenceSteps : [];
      if (!steps.some((s) => String((s as { imageUrl?: string })?.imageUrl ?? "").trim())) {
        missing.push("sequenceSteps.imageUrl");
      }
    }
    if (t === "diagram" && !String(payload.imageUrl ?? "").trim()) {
      missing.push("imageUrl");
    }
    logImportDebug("block", {
      generatorBlockKind: record.generatorBlockKind,
      exportedEditorType: record.editorType,
      importedType: t,
      role: role ?? null,
      missing,
      downgraded:
        String(record.generatorBlockKind ?? "").includes("step-by-step") &&
        record.editorType === "text",
    });
  }

  switch (t) {
    case "checkpoint": {
      let opts = padOptions(payload.options);
      let prompt = String(
        payload.prompt ?? (payload as { question?: unknown }).question ?? "Question"
      );
      let correctAnswer = String(payload.correctAnswer ?? payload.answer ?? opts[0] ?? "").trim();
      let explanation = String(payload.explanation ?? "");
      const enriched = enrichMcqFromContentIfNeeded(
        { prompt, options: opts, correctAnswer, explanation },
        payload.content
      );
      opts = enriched.options;
      prompt = enriched.prompt;
      correctAnswer = enriched.correctAnswer || opts[0] || "";
      explanation = resolveImportedCheckpointExplanation(
        enriched.explanation,
        correctAnswer,
        lessonMeta
      );
      const tier = normalizeCheckpointDifficultyTier(
        (payload as { difficultyTier?: unknown; difficulty?: unknown }).difficultyTier ??
          (payload as { difficulty?: unknown }).difficulty
      );
      const markScheme = checkpointMarkSchemeForBlockPersist(
        applyDifficultyToMarkScheme(
          Array.isArray(payload.markScheme)
            ? (payload.markScheme as string[]).map((x) => String(x ?? ""))
            : undefined,
          tier
        )
      );
      return attachBlockNumber(
        {
          type: "checkpoint" as LessonBlockType,
          content: String(payload.content ?? ""),
          title,
          ...(role ? { role } : {}),
          prompt,
          questionType: "mcq" as const,
          options: opts,
          correctAnswer,
          explanation,
          ...(markScheme ? { markScheme } : {}),
        },
        record
      );
    }
    case "selfCheck": {
      const qType = payload.questionType === "short" ? "short" : "mcq";
      let opts = qType === "mcq" ? padOptions(payload.options) : [];
      let prompt = String(payload.prompt ?? "Question");
      let correctAnswer =
        qType === "mcq"
          ? normalizeMcqCorrectAnswer(String(payload.correctAnswer ?? "").trim(), opts)
          : String(payload.correctAnswer ?? "").trim();
      let explanation = String(payload.explanation ?? "");
      if (qType === "mcq") {
        const enriched = enrichMcqFromContentIfNeeded(
          { prompt, options: opts, correctAnswer, explanation },
          payload.content
        );
        opts = enriched.options;
        prompt = enriched.prompt;
        correctAnswer = normalizeMcqCorrectAnswer(enriched.correctAnswer, opts);
        explanation = resolveImportedCheckpointExplanation(
          enriched.explanation,
          correctAnswer,
          lessonMeta
        );
      } else {
        explanation = resolveImportedCheckpointExplanation(
          explanation,
          correctAnswer,
          lessonMeta
        );
      }
      const tier = normalizeCheckpointDifficultyTier(
        (payload as { difficultyTier?: unknown; difficulty?: unknown }).difficultyTier ??
          (payload as { difficulty?: unknown }).difficulty
      );
      const markScheme = checkpointMarkSchemeForBlockPersist(
        applyDifficultyToMarkScheme(
          Array.isArray(payload.markScheme)
            ? (payload.markScheme as string[]).map((x) => String(x ?? ""))
            : undefined,
          tier
        )
      );
      return attachBlockNumber(
        {
          type: "selfCheck" as const,
          content: String(payload.content ?? ""),
          title,
          ...(role ? { role } : {}),
          prompt,
          questionType: qType,
          options: qType === "short" ? ["", "", "", ""] : opts,
          correctAnswer,
          explanation,
          ...(markScheme ? { markScheme } : {}),
        },
        record
      );
    }
    case "graph": {
      const graphSource = mergeGraphBlockFromExportContent({
        ...payload,
        title: stripSs1PrefixFromTitle(String(payload.title ?? title ?? "").trim()),
        content: payload.content,
      });
      const persisted = graphBlockForPersist(graphSource, { role: role || "graph" });
      return attachBlockNumber(
        {
          ...persisted,
          type: "graph" as const,
        },
        record
      );
    }
    case "dragDropMatch": {
      const pairsRaw = Array.isArray(payload.pairs) ? payload.pairs : [];
      const pairs = pairsRaw
        .map((row: unknown, i: number) =>
          normalizeDragDropPairRow(row, i, `imp_dnd_${i + 1}`)
        )
        .filter((row): row is NonNullable<typeof row> => Boolean(row));
      const p = payload as Record<string, unknown>;
      const pairIdsImp = pairs.map((row) => row.id);
      const rawDz = Array.isArray(p.dropZones) ? p.dropZones : [];
      const dropZonesImp = sanitizeDiagramDropZonesForAuthoring(rawDz, pairIdsImp);
      const imgI = typeof p.imageUrl === "string" ? p.imageUrl.trim() : "";
      const imageFit = parseDragDropDiagramImageFit(p.imageFit);
      const imagePosition = parseDragDropDiagramImagePosition(p.imagePosition);
      const resolvedMode = resolveDragDropPersistMode(p);
      return attachBlockNumber(
        {
          type: "dragDropMatch" as const,
          content: "",
          title: String(payload.title ?? title ?? "").trim(),
          ...(role ? { role } : { role: "match" }),
          intro: mergeLessonBlockIntroFields(
            String(payload.intro ?? ""),
            String(payload.content ?? "")
          ),
          instructions: String(payload.instructions ?? ""),
          pairs,
          ...(importNoteFromPayload(payload) ? { note: importNoteFromPayload(payload) } : {}),
          ...(resolvedMode === "diagram"
            ? {
                matchMode: "diagram" as const,
                ...(imgI ? { imageUrl: imgI } : {}),
                ...(imageFit ? { imageFit } : {}),
                ...(imagePosition ? { imagePosition } : {}),
                dropZones: dropZonesImp,
              }
            : {}),
          ...(resolvedMode === "text" ? { matchMode: "text" as const } : {}),
          ...(resolvedMode === "text-to-image" ? { matchMode: "text-to-image" as const } : {}),
        },
        record
      );
    }
    case "interactiveDiagram": {
      const introMerged = mergeLessonBlockIntroFields(
        String(payload.intro ?? ""),
        String(payload.content ?? "")
      );
      const hsRaw = Array.isArray(payload.hotspots) ? payload.hotspots : [];
      let hotspots = hsRaw.map((h: unknown, i: number) => {
        if (!h || typeof h !== "object") {
          return { id: `imp_hs_${i + 1}`, label: "", description: "" };
        }
        const o = h as {
          id?: unknown;
          label?: unknown;
          description?: unknown;
          explanation?: unknown;
          x?: unknown;
          y?: unknown;
        };
        const label = String(o.label ?? "").trim();
        const description = String(
          o.explanation ?? o.description ?? label
        ).trim();
        const x = o.x;
        const y = o.y;
        const isPlaceholderCenter =
          typeof x === "number" &&
          typeof y === "number" &&
          Math.abs(x - 0.5) < 0.001 &&
          Math.abs(y - 0.5) < 0.001;
        return {
          id: String(o.id ?? "").trim() || `imp_hs_${i + 1}`,
          ...(!isPlaceholderCenter && typeof x === "number" ? { x } : {}),
          ...(!isPlaceholderCenter && typeof y === "number" ? { y } : {}),
          label: label || `Part ${i + 1}`,
          description,
          explanation: description,
        };
      });
      if (
        hotspots.length === 0 ||
        hotspots.every((h) => !String(h.label ?? "").trim())
      ) {
        const fromScript = buildHotspotsFromGeneratorScript(introMerged, "");
        if (fromScript.length > 0) {
          hotspots = fromScript.map((spec, i) => ({
            id: `imp_hs_${i + 1}`,
            label: spec.label,
            description: spec.description,
            explanation: spec.description,
          }));
        }
      }
      return attachBlockNumber(
        {
          type: "interactiveDiagram" as const,
          content: "",
          title: String(payload.title ?? title ?? "").trim(),
          ...(role ? { role } : { role: "hotspot" }),
          intro: introMerged,
          imageUrl: String(payload.imageUrl ?? ""),
          hotspots,
          ...(importNoteFromPayload(payload) ? { note: importNoteFromPayload(payload) } : {}),
        },
        record
      );
    }
    case "interactiveSequence": {
      const introStr = String(payload.intro ?? "");
      const contentStr = String(payload.content ?? "");
      const introMerged = mergeLessonBlockIntroFields(introStr, contentStr);
      const stepsRaw = Array.isArray(payload.sequenceSteps) ? payload.sequenceSteps : [];
      const sequenceSteps = hydrateInteractiveSequenceStepsForEditor(
        introStr,
        contentStr,
        stepsRaw
      ).map((row, i) => {
        const o = stepsRaw[i];
        const tq =
          o && typeof o === "object" && typeof (o as { testQuestion?: unknown }).testQuestion === "string"
            ? String((o as { testQuestion: string }).testQuestion).trim()
            : "";
        return {
          id: row.id ?? `imp_seq_${i + 1}`,
          title: row.title,
          description: cleanSequenceStepDescription(row.description ?? "", {
            stepTitle: row.title,
            stepIndex: i,
          }),
          imageUrl: row.imageUrl,
          caption: row.caption,
          ...(tq ? { testQuestion: tq } : {}),
          ...(row.testExplanation ? { testExplanation: row.testExplanation } : {}),
        };
      });
      return attachBlockNumber(
        {
          type: "interactiveSequence" as const,
          content: contentStr,
          title: String(payload.title ?? title ?? "").trim(),
          ...(role ? { role } : { role: "sequence" }),
          intro: introMerged,
          sequenceSteps,
          ...(importNoteFromPayload(payload) ? { note: importNoteFromPayload(payload) } : {}),
        },
        record
      );
    }
    case "diagram": {
      const imageUrl = String(payload.imageUrl ?? "").trim();
      const caption = String(payload.caption ?? "").trim();
      const subtitle = String(payload.subtitle ?? "").trim();
      const studentTask = String(payload.studentTask ?? "").trim();
      return attachBlockNumber(
        {
          type: "diagram" as const,
          content: String(payload.content ?? ""),
          title,
          ...(role ? { role } : { role: "concept" }),
          ...(imageUrl ? { imageUrl } : {}),
          ...(caption ? { caption } : {}),
          ...(subtitle ? { subtitle } : {}),
          ...(studentTask ? { studentTask } : {}),
          ...(payload.diagramVariant === "featured" ? { diagramVariant: "featured" as const } : {}),
          ...(importNoteFromPayload(payload) ? { note: importNoteFromPayload(payload) } : {}),
        },
        record
      );
    }
    case "keyIdeas":
    case "keyWords":
    case "examTips":
    case "misconceptions":
    case "deeperKnowledge": {
      const contentRaw = String(payload.content ?? "");
      const content =
        role === "examPractice"
          ? formatExamPracticeContentForImport(contentRaw)
          : formatLessonBlockContentForImport(contentRaw);
      return attachBlockNumber(
        {
          type: t,
          content,
          title,
          ...(role ? { role } : {}),
        },
        record
      );
    }
    default: {
      const contentRaw = String(payload.content ?? "");
      const content =
        role === "examPractice"
          ? formatExamPracticeContentForImport(contentRaw)
          : formatLessonBlockContentForImport(contentRaw);
      return attachBlockNumber(
        {
          type: t,
          content,
          title,
          ...(role ? { role } : {}),
        },
        record
      );
    }
  }
}

export type CreateLessonPageShape = {
  pageId: string;
  title: string;
  order: number;
  pageType?: string;
  hero?: { type: "none"; src: string; caption?: string };
  blocks: Record<string, unknown>[];
  checkpoint: typeof VALID_STARTER_PAGE_CHECKPOINT;
};

/** Convert validated v1 JSON into CreateLesson `pages` state rows. */
export function buildPagesFromGeneratorExport(doc: GeneratorExportV1Document): CreateLessonPageShape[] {
  const sorted = [...doc.pages].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );
  let lessonBlockOrdinal = 0;
  return sorted.map((pg, idx) => {
    const numberedRecords = (pg.blocks || []).map((record) => {
      lessonBlockOrdinal += 1;
      const blockNumber =
        typeof record.blockNumber === "number" && Number.isFinite(record.blockNumber)
          ? record.blockNumber
          : lessonBlockOrdinal;
      return { ...record, blockNumber };
    });
    const lessonMeta: ImportLessonMeta = {
      topic: doc.lesson?.topic,
      title: doc.lesson?.title,
    };
    const blocksRaw = numberedRecords
      .map((record) => recordToLessonBlock(record, lessonMeta))
      .filter(Boolean) as Record<string, unknown>[];
    const blocks = elevateExtraImportedCheckpointsToSelfCheck(blocksRaw, lessonMeta);
    return {
      pageId: newPid(),
      title: String(pg.title || `Page ${idx + 1}`).trim() || `Page ${idx + 1}`,
      order: idx + 1,
      pageType: "",
      hero: { type: "none", src: "", caption: "" },
      blocks:
        blocks.length > 0 ? blocks : [{ type: "text", content: "", role: "concept" }],
      checkpoint: pageCheckpointFromFirstBlock(blocks),
    };
  });
}

export type LessonMetaApply = {
  title?: string;
  description?: string;
  subject?: string;
  topic?: string;
  topicKey?: string;
  canonicalTopicKey?: string;
  specKey?: string;
  board?: string;
  level?: string;
  tier?: "" | "foundation" | "higher";
};

function inferSpecKeyFromExport(L: GeneratorExportV1Document["lesson"]): string | undefined {
  const subject = String(L?.subject || "")
    .trim()
    .toLowerCase();
  const board = String(L?.examBoard || "AQA").trim();
  const ks = String(L?.keyStage || "").toUpperCase();
  if (ks.includes("GCSE") || ks === "" || ks.includes("KEY STAGE 4")) {
    if (board === "AQA" || board === "") {
      if (subject === "biology") return "aqa-gcse-biology";
      if (subject === "chemistry") return "aqa-gcse-chemistry";
      if (subject === "physics") return "aqa-gcse-physics";
    }
  }
  return undefined;
}

/** Resolve taxonomy topic slug from generator export lesson metadata (never slugify full title). */
export function topicKeyFromGeneratorExport(doc: GeneratorExportV1Document): {
  topicKey: string;
  canonicalTopicKey?: string;
  specKey?: string;
} | null {
  const L = doc.lesson ?? {};
  const specKey = inferSpecKeyFromExport(L);
  const canonicalHint = String(L.canonicalTopicKey || "").trim();
  const exportTopicKey = String(L.topicKey || "").trim();
  const candidates = [
    canonicalHint,
    exportTopicKey,
    String(L.topic || "").trim(),
    String(L.title || "").trim(),
  ].filter(Boolean);

  for (const c of candidates) {
    const slug = canonicalSlugFromText(c);
    if (slug) {
      const namespaced = specKey ? `${specKey}:${slug}` : slug;
      return {
        topicKey: namespaced,
        canonicalTopicKey: slug,
        ...(specKey ? { specKey } : {}),
      };
    }
  }

  if (exportTopicKey && !exportTopicKey.includes(" ")) {
    const slug = exportTopicKey.includes(":") ? exportTopicKey.split(":").pop()! : exportTopicKey;
    if (slug.length <= 48 && !/\b(higher|foundation)-tier\b/.test(slug)) {
      return {
        topicKey: specKey && !exportTopicKey.includes(":") ? `${specKey}:${slug}` : exportTopicKey,
        ...(canonicalHint ? { canonicalTopicKey: canonicalHint } : {}),
        ...(specKey ? { specKey } : {}),
      };
    }
  }

  return null;
}

export function lessonMetaFromExport(doc: GeneratorExportV1Document): LessonMetaApply {
  const L = doc.lesson ?? {};
  const levelGcse =
    String(L.keyStage || "")
      .toUpperCase()
      .includes("A-LEVEL") || String(L.keyStage || "").includes("A-Level")
      ? "A-Level"
      : "GCSE";
  let board =
    typeof L.examBoard === "string" && L.examBoard.trim()
      ? L.examBoard.trim()
      : "";
  const boards = ["AQA", "OCR", "Edexcel", "WJEC"] as const;
  const boardNorm = boards.find((b) => b.toLowerCase() === board.toLowerCase());
  if (boardNorm) board = boardNorm;
  else if (board && !boards.includes(board as (typeof boards)[number])) {
    board = "";
  }

  const title = String(L.title || L.topic || "").trim();
  const topic = String(L.topic || "").trim();
  const subject = String(L.subject || "").trim();

  const tierRaw = String(L.tier || "").toLowerCase();
  let tier: "" | "foundation" | "higher" = "";
  if (tierRaw.includes("foundation")) tier = "foundation";
  else if (tierRaw.includes("higher")) tier = "higher";
  const descParts = [
    topic ? `Topic: ${topic}` : "",
    L.keyStage ? `Key stage: ${L.keyStage}` : "",
    tierRaw.trim() ? `Tier: ${String(L.tier || "").trim()}` : "",
  ].filter(Boolean);

  const topicResolution = topicKeyFromGeneratorExport(doc);
  const displayTopic =
    topic && topic !== title ? topic : topicResolution?.canonicalTopicKey === "photosynthesis" ? "Photosynthesis" : topic;

  return {
    title,
    description: descParts.length ? descParts.join(" · ") : undefined,
    subject,
    topic: displayTopic,
    topicKey: topicResolution?.topicKey,
    canonicalTopicKey: topicResolution?.canonicalTopicKey,
    specKey: topicResolution?.specKey,
    board: board || undefined,
    level: levelGcse,
    tier,
  };
}
