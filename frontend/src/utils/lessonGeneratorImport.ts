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
import {
  isLearnTeachingPage,
  stripLearnPageTestingBlocks,
} from "./lessonPageGuards";
import { stripSs1PrefixFromTitle } from "./formatBlockHeading";
import { mergeLessonBlockIntroFields } from "./lessonRichText";
import { canonicalSlugFromText } from "./normalizeLessonTopicKey";
import { getSpecIdentity } from "./specIdentity";
import { cleanSequenceStepDescription } from "./cleanSequenceStepDescription";
import { checkpointMarkSchemeForBlockPersist } from "./checkpointFeedback";
import {
  buildHotspotsFromGeneratorScript,
  hydrateInteractiveSequenceStepsForEditor,
} from "./parseGeneratorVisualScript";
import { formatExamPracticeContentForImport } from "./formatExamPracticeContent";
import { filterExamPracticeBlocksOnPage } from "./activityQuestionsFromBlock";
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
    level?: string;
    examBoard?: string;
    topic?: string;
    tier?: string;
    specKey?: string;
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

/** Page.checkpoint must mirror the first inline checkpoint block for CreateLesson save + student view.
 * Learn pages never get a page.checkpoint (teaching-only guard rail).
 */
function pageCheckpointFromFirstBlock(
  blocks: Record<string, unknown>[],
  pageMeta: { title?: string; pageType?: string } = {}
): CreateLessonPageShape["checkpoint"] | undefined {
  if (isLearnTeachingPage(pageMeta)) return undefined;
  const empty: CreateLessonPageShape["checkpoint"] = {
    question: "",
    options: ["", "", "", ""],
    answer: "",
    explanation: "",
    markScheme: [],
  };
  const fallback: CreateLessonPageShape["checkpoint"] = {
    ...VALID_STARTER_PAGE_CHECKPOINT,
  };
  const cp = blocks.find((b) => b && String(b.type) === "checkpoint");
  // Pages with no checkpoint blocks must not inherit the starter placeholder —
  // that triggers Create Lesson "replace placeholder checkpoint" warnings and
  // backend Option 1–4 invent (legacy).
  if (!cp) return empty;
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
  if (!hasMcqBody) return empty;
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
      const qType = payload.questionType === "short" ? "short" : "mcq";
      let opts = qType === "mcq" ? padOptions(payload.options) : [];
      let prompt = String(
        payload.prompt ?? (payload as { question?: unknown }).question ?? "Question"
      );
      let correctAnswer =
        qType === "mcq"
          ? normalizeMcqCorrectAnswer(
              String(payload.correctAnswer ?? payload.answer ?? "").trim(),
              opts
            )
          : String(payload.correctAnswer ?? payload.answer ?? "").trim();
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
          type: "checkpoint" as LessonBlockType,
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
    case "pageQuiz": {
      const bankRaw = Array.isArray(payload.questions) ? payload.questions : [];
      const questions = bankRaw
        .map((raw, i) => {
          if (!raw || typeof raw !== "object") return null;
          const q = raw as Record<string, unknown>;
          const qType = String(q.questionType ?? q.type ?? "mcq").toLowerCase() === "short" ? "short" : "mcq";
          let opts = qType === "mcq" ? padOptions(q.options) : [];
          let prompt = String(q.prompt ?? q.question ?? q.stem ?? "").trim();
          let correctAnswer =
            qType === "mcq"
              ? normalizeMcqCorrectAnswer(String(q.correctAnswer ?? q.answer ?? "").trim(), opts)
              : String(q.correctAnswer ?? q.answer ?? "").trim();
          let explanation = String(q.explanation ?? "").trim();
          if (!prompt || !correctAnswer) return null;
          if (qType === "mcq" && opts.filter((o) => o.trim()).length < 2) return null;
          return {
            id: String(q.id || `pq_${i + 1}`),
            prompt,
            question: prompt,
            questionType: qType,
            type: qType,
            options: qType === "mcq" ? opts : [],
            correctAnswer,
            explanation,
            purpose: q.purpose != null ? String(q.purpose) : "exam",
            marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
            ...(Array.isArray(q.markScheme)
              ? {
                  markScheme: q.markScheme
                    .map((x) => String(x ?? "").trim())
                    .filter(Boolean)
                    .slice(0, 20),
                }
              : {}),
          };
        })
        .filter(Boolean) as Record<string, unknown>[];
      const first = questions[0];
      return attachBlockNumber(
        {
          type: "pageQuiz" as const,
          content: String(payload.content ?? ""),
          title: title || "Quiz / revision",
          ...(role ? { role } : { role: "pageQuiz" }),
          questions,
          ...(first
            ? {
                prompt: String(first.prompt ?? ""),
                questionType: first.questionType === "short" ? "short" : "mcq",
                options: Array.isArray(first.options) ? (first.options as string[]) : [],
                correctAnswer: String(first.correctAnswer ?? ""),
                explanation: String(first.explanation ?? ""),
              }
            : {
                prompt: "",
                questionType: "mcq" as const,
                options: ["", "", "", ""],
                correctAnswer: "",
                explanation: "",
              }),
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
  checkpoint?: typeof VALID_STARTER_PAGE_CHECKPOINT;
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
    const pageTitle = String(pg.title || `Page ${idx + 1}`).trim() || `Page ${idx + 1}`;
    const pageMeta = {
      title: pageTitle,
      pageType: String((pg as { pageType?: string }).pageType || ""),
    };
    const blocksRaw = numberedRecords
      .map((record) => recordToLessonBlock(record, lessonMeta))
      .filter(Boolean) as Record<string, unknown>[];
    // Guard rail: Learn is teaching-only — drop checkpoint / selfCheck / pageQuiz if present.
    const blocksForPage = filterExamPracticeBlocksOnPage(
      isLearnTeachingPage(pageMeta)
        ? stripLearnPageTestingBlocks(blocksRaw)
        : elevateExtraImportedCheckpointsToSelfCheck(blocksRaw, lessonMeta)
    ) as Record<string, unknown>[];
    return {
      pageId: newPid(),
      title: pageTitle,
      order: idx + 1,
      pageType: isLearnTeachingPage(pageMeta) ? "learn" : "",
      hero: { type: "none", src: "", caption: "" },
      blocks:
        blocksForPage.length > 0
          ? blocksForPage
          : [{ type: "text", content: "", role: "concept" }],
      checkpoint: pageCheckpointFromFirstBlock(blocksForPage, pageMeta),
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

/** Word-boundary level checks — never treat "IGCSE" as "GCSE" via substring includes. */
function exportTextLooksIgcse(...parts: Array<string | undefined | null>): boolean {
  const blob = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");
  return /\bIGCSE\b/i.test(blob);
}

function exportTextLooksGcse(...parts: Array<string | undefined | null>): boolean {
  if (exportTextLooksIgcse(...parts)) return false;
  const blob = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");
  return /\bGCSE\b/i.test(blob) || /\bKS\s*4\b/i.test(blob) || /\bKEY\s*STAGE\s*4\b/i.test(blob);
}

function normalizeExportBoard(raw: string): string {
  const boards = ["AQA", "OCR", "Edexcel", "WJEC"] as const;
  const t = String(raw || "").trim();
  if (!t) return "";
  const hit = boards.find((b) => b.toLowerCase() === t.toLowerCase());
  return hit || "";
}

/**
 * Infer specKey from Generator export lesson metadata.
 * Priority: valid explicit specKey → board+level → never default Edexcel/IGCSE to AQA.
 */
export function inferSpecKeyFromExport(L: GeneratorExportV1Document["lesson"]): string | undefined {
  const explicit = String(L?.specKey || "").trim();
  if (explicit) return explicit;

  const subject = String(L?.subject || "")
    .trim()
    .toLowerCase();
  const board = normalizeExportBoard(String(L?.examBoard || "").trim());
  const level = String(L?.level || "").trim();
  const keyStage = String(L?.keyStage || "").trim();

  if (
    board === "Edexcel" &&
    subject === "biology" &&
    exportTextLooksIgcse(level, keyStage)
  ) {
    return "edexcel-igcse-biology";
  }

  if (exportTextLooksGcse(level, keyStage) || (!level && !keyStage)) {
    // Only AQA GCSE fallback when board is AQA or genuinely unset (never overwrite Edexcel).
    if (board === "Edexcel") return undefined;
    if (board === "AQA" || board === "") {
      if (subject === "biology") return "aqa-gcse-biology";
      if (subject === "chemistry") return "aqa-gcse-chemistry";
      if (subject === "physics") return "aqa-gcse-physics";
    }
  }
  return undefined;
}

/**
 * Path-style export keys (e.g. reproduction/adaptations-for-pollination) → slug candidates.
 * Prefer exact path, then final segment (taxonomy leaf), never the first segment alone.
 */
export function topicSlugCandidatesFromExportKey(raw: string): string[] {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return [];
  const unprefixed = trimmed.includes(":") ? trimmed.slice(trimmed.indexOf(":") + 1).trim() : trimmed;
  if (!unprefixed) return [];
  const out: string[] = [];
  const push = (s: string) => {
    const v = String(s || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  push(unprefixed);
  if (unprefixed.includes("/")) {
    const parts = unprefixed.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length) {
      push(parts[parts.length - 1]);
      for (let i = parts.length - 2; i >= 0; i--) {
        push(parts.slice(i).join("/"));
      }
    }
  }
  return out;
}

function looksLikeTopicSlug(slug: string): boolean {
  const s = String(slug || "").trim();
  if (!s || s.includes(" ")) return false;
  if (s.length > 80) return false;
  if (/\b(higher|foundation)-tier\b/i.test(s)) return false;
  return true;
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

  // Preserve a valid existing namespaced topicKey for this spec.
  if (exportTopicKey.includes(":") && specKey) {
    const prefix = `${specKey}:`;
    if (exportTopicKey.startsWith(prefix)) {
      const after = exportTopicKey.slice(prefix.length).trim();
      const leaf =
        topicSlugCandidatesFromExportKey(after).find((c) => !c.includes("/")) || after;
      if (looksLikeTopicSlug(leaf)) {
        return {
          topicKey: `${specKey}:${leaf}`,
          canonicalTopicKey: leaf,
          specKey,
        };
      }
    }
  }

  const pathAndHintCandidates = [
    ...topicSlugCandidatesFromExportKey(canonicalHint),
    ...topicSlugCandidatesFromExportKey(exportTopicKey),
  ];

  // Prefer non-path leaf slugs (final segment) when a path-style key was exported.
  const orderedSlugs = [
    ...pathAndHintCandidates.filter((c) => !c.includes("/")),
    ...pathAndHintCandidates.filter((c) => c.includes("/")),
  ];

  for (const slug of orderedSlugs) {
    if (!looksLikeTopicSlug(slug) || slug.includes("/")) continue;
    const namespaced = specKey ? `${specKey}:${slug}` : slug;
    return {
      topicKey: namespaced,
      canonicalTopicKey: slug,
      ...(specKey ? { specKey } : {}),
    };
  }

  // Alias repair (photosynthesis / respiration) — never invent board from title.
  const aliasSources = [
    canonicalHint,
    exportTopicKey,
    String(L.topic || "").trim(),
    String(L.title || "").trim(),
  ].filter(Boolean);
  for (const c of aliasSources) {
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

  if (exportTopicKey && looksLikeTopicSlug(exportTopicKey.replace(/^[^:]+:/, ""))) {
    const slug = exportTopicKey.includes(":")
      ? exportTopicKey.slice(exportTopicKey.indexOf(":") + 1)
      : exportTopicKey;
    const leaf = topicSlugCandidatesFromExportKey(slug).find((c) => !c.includes("/")) || slug;
    if (looksLikeTopicSlug(leaf) && !leaf.includes("/")) {
      return {
        topicKey: specKey ? `${specKey}:${leaf}` : leaf,
        canonicalTopicKey: leaf,
        ...(specKey ? { specKey } : {}),
      };
    }
  }

  // Topic mapping failed — still return specKey so board/level identity is not lost.
  if (specKey) {
    return { topicKey: "", canonicalTopicKey: undefined, specKey };
  }
  return null;
}

function levelFromGeneratorExport(L: GeneratorExportV1Document["lesson"]): string {
  const explicit = String(L?.level || "").trim();
  if (/^IGCSE$/i.test(explicit)) return "IGCSE";
  if (/^GCSE$/i.test(explicit)) return "GCSE";
  if (/^KS3$/i.test(explicit)) return "KS3";
  if (/^A-?Level$/i.test(explicit)) return "A-Level";

  const ks = String(L?.keyStage || "").trim();
  if (exportTextLooksIgcse(ks)) return "IGCSE";
  if (/A-?Level/i.test(ks) || /\bA\s*LEVEL\b/i.test(ks)) return "A-Level";
  if (/^KS3$/i.test(ks) || /\bKEY\s*STAGE\s*3\b/i.test(ks)) return "KS3";
  if (exportTextLooksGcse(ks)) return "GCSE";
  if (explicit) return explicit;
  if (ks) return ks;
  return "GCSE";
}

export function lessonMetaFromExport(doc: GeneratorExportV1Document): LessonMetaApply {
  const L = doc.lesson ?? {};
  const levelGcse = levelFromGeneratorExport(L);
  let board = normalizeExportBoard(
    typeof L.examBoard === "string" && L.examBoard.trim() ? L.examBoard.trim() : ""
  );

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
  const specKey = topicResolution?.specKey || inferSpecKeyFromExport(L);
  if (!board && specKey) {
    const identity = getSpecIdentity(specKey);
    if (identity?.board) board = identity.board;
  }
  const displayTopic =
    topic && topic !== title ? topic : topicResolution?.canonicalTopicKey === "photosynthesis" ? "Photosynthesis" : topic;

  return {
    title,
    description: descParts.length ? descParts.join(" · ") : undefined,
    subject,
    topic: displayTopic,
    topicKey: topicResolution?.topicKey || undefined,
    canonicalTopicKey: topicResolution?.canonicalTopicKey,
    specKey,
    board: board || undefined,
    level: levelGcse,
    tier,
  };
}
