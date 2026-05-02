import {
  LESSON_GENERATOR_EXPORT_FORMAT_V1,
} from "../constants/lessonGeneratorExchange.v1";
import { normalizeBlockType, type LessonBlockType } from "../types/lessonBlocks";

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
  lesson?: {
    title?: string;
    subject?: string;
    keyStage?: string;
    examBoard?: string;
    topic?: string;
    tier?: string;
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
  const a = Array.isArray(raw)
    ? raw.map((x) => String(x ?? "").trim())
    : [];
  while (a.length < 4) a.push("");
  return a.slice(0, 4);
}

function recordToLessonBlock(record: GeneratorExportV1Block): Record<string, unknown> {
  const t = normalizeBlockType(record.editorType);
  const payload = record.payload ?? {};
  const title = typeof record.title === "string" ? record.title : "";
  const role = typeof record.role === "string" ? record.role : undefined;

  switch (t) {
    case "checkpoint": {
      const opts = padOptions(payload.options);
      const answer = String(payload.correctAnswer ?? payload.answer ?? opts[0] ?? "").trim();
      return {
        type: "checkpoint" as LessonBlockType,
        content: String(payload.content ?? ""),
        title,
        ...(role ? { role } : {}),
        prompt: String(payload.prompt ?? "Question"),
        questionType: "mcq" as const,
        options: opts,
        correctAnswer: answer || opts[0] || "",
        explanation: String(payload.explanation ?? ""),
      };
    }
    case "selfCheck": {
      const qType = payload.questionType === "short" ? "short" : "mcq";
      const opts = padOptions(payload.options);
      return {
        type: "selfCheck" as const,
        content: String(payload.content ?? ""),
        title,
        ...(role ? { role } : {}),
        prompt: String(payload.prompt ?? "Question"),
        questionType: qType,
        options: qType === "short" ? ["[Option 1]", "[Option 2]", "[Option 3]", "[Option 4]"] : opts,
        correctAnswer: String(payload.correctAnswer ?? "").trim(),
        explanation: String(payload.explanation ?? ""),
      };
    }
    case "dragDropMatch": {
      const pairsRaw = Array.isArray(payload.pairs) ? payload.pairs : [];
      const pairs = pairsRaw.map((row: unknown, i: number) => {
        if (!row || typeof row !== "object") {
          return { id: `imp_dnd_${i + 1}`, prompt: "", answer: "" };
        }
        const r = row as { id?: unknown; prompt?: unknown; answer?: unknown; explanation?: unknown };
        return {
          id: String(r.id ?? "").trim() || `imp_dnd_${i + 1}`,
          prompt: String(r.prompt ?? "").trim(),
          answer: String(r.answer ?? "").trim(),
          ...(r.explanation != null && String(r.explanation).trim()
            ? { explanation: String(r.explanation) }
            : {}),
        };
      });
      return {
        type: "dragDropMatch" as const,
        content: "",
        title: String(payload.title ?? title ?? "").trim(),
        ...(role ? { role } : { role: "match" }),
        intro: String(payload.intro ?? ""),
        instructions: String(payload.instructions ?? ""),
        pairs,
      };
    }
    case "interactiveDiagram": {
      const hsRaw = Array.isArray(payload.hotspots) ? payload.hotspots : [];
      const hotspots = hsRaw.map((h: unknown, i: number) => {
        if (!h || typeof h !== "object") {
          return { id: `imp_hs_${i + 1}`, label: "", description: "" };
        }
        const o = h as { id?: unknown; label?: unknown; description?: unknown; x?: unknown; y?: unknown };
        const label = String(o.label ?? "").trim();
        const description = String(o.description ?? label).trim();
        return {
          id: String(o.id ?? "").trim() || `imp_hs_${i + 1}`,
          ...(typeof o.x === "number" ? { x: o.x } : {}),
          ...(typeof o.y === "number" ? { y: o.y } : {}),
          label: label || `Part ${i + 1}`,
          description,
        };
      });
      return {
        type: "interactiveDiagram" as const,
        content: String(payload.content ?? ""),
        title: String(payload.title ?? title ?? "").trim(),
        ...(role ? { role } : { role: "hotspot" }),
        intro: String(payload.intro ?? ""),
        imageUrl: String(payload.imageUrl ?? ""),
        hotspots,
      };
    }
    case "interactiveSequence": {
      const stepsRaw = Array.isArray(payload.sequenceSteps) ? payload.sequenceSteps : [];
      const sequenceSteps = stepsRaw.map((s: unknown, i: number) => {
        if (!s || typeof s !== "object") {
          return {
            id: `imp_seq_${i + 1}`,
            title: `Step ${i + 1}`,
            description: "",
            imageUrl: "",
            caption: "",
          };
        }
        const o = s as {
          id?: unknown;
          title?: unknown;
          description?: unknown;
          imageUrl?: unknown;
          caption?: unknown;
        };
        return {
          id: String(o.id ?? "").trim() || `imp_seq_${i + 1}`,
          title: String(o.title ?? `Step ${i + 1}`).trim(),
          description: String(o.description ?? "").trim(),
          imageUrl: String(o.imageUrl ?? "").trim(),
          caption: String(o.caption ?? "").trim(),
        };
      });
      return {
        type: "interactiveSequence" as const,
        content: String(payload.content ?? ""),
        title: String(payload.title ?? title ?? "").trim(),
        ...(role ? { role } : { role: "sequence" }),
        intro: String(payload.intro ?? ""),
        sequenceSteps,
      };
    }
    case "diagram":
      return {
        type: "diagram" as const,
        content: String(payload.content ?? ""),
        title,
        ...(role ? { role } : { role: "concept" }),
      };
    default:
      return {
        type: t,
        content: String(payload.content ?? ""),
        title,
        ...(role ? { role } : {}),
      };
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
  return sorted.map((pg, idx) => {
    const blocks = (pg.blocks || []).map(recordToLessonBlock).filter(Boolean);
    return {
      pageId: newPid(),
      title: String(pg.title || `Page ${idx + 1}`).trim() || `Page ${idx + 1}`,
      order: idx + 1,
      pageType: "",
      hero: { type: "none", src: "", caption: "" },
      blocks:
        blocks.length > 0 ? blocks : [{ type: "text", content: "", role: "concept" }],
      checkpoint: { ...VALID_STARTER_PAGE_CHECKPOINT },
    };
  });
}

export type LessonMetaApply = {
  title?: string;
  description?: string;
  subject?: string;
  topic?: string;
  board?: string;
  level?: string;
  tier?: "" | "foundation" | "higher";
};

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

  return {
    title,
    description: descParts.length ? descParts.join(" · ") : undefined,
    subject,
    topic,
    board: board || undefined,
    level: levelGcse,
    tier,
  };
}
