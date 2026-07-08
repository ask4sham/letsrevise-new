import type { ExamQuestionPart } from "../../../api/examQuestions";
import { isCompositePartTypeEnabled } from "./featureFlags";
import type { CompositeInteractionPlugin } from "./interactionTypes";
import { mcqInteraction } from "./interactions/mcqInteraction";
import { shortInteraction } from "./interactions/shortInteraction";
import { unknownInteraction } from "./interactions/unknownInteraction";
import { CompositePartType } from "./types";

const TYPED_REGISTRY: Partial<Record<(typeof CompositePartType)[keyof typeof CompositePartType], CompositeInteractionPlugin>> = {
  [CompositePartType.MCQ]: mcqInteraction,
  [CompositePartType.SHORT]: shortInteraction,
};

function normalizePartType(raw: string): (typeof CompositePartType)[keyof typeof CompositePartType] | null {
  const key = raw.toLowerCase();
  const values = Object.values(CompositePartType) as string[];
  return values.includes(key) ? (key as (typeof CompositePartType)[keyof typeof CompositePartType]) : null;
}

export function resolveCompositeInteraction(part: ExamQuestionPart): CompositeInteractionPlugin {
  if (mcqInteraction.matchesPart(part)) {
    return mcqInteraction;
  }

  const raw = String(part.type ?? "").toLowerCase();
  const typed = normalizePartType(raw);

  if (typed && typed !== CompositePartType.MCQ) {
    if (!isCompositePartTypeEnabled(typed)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(`[CompositeExam] Part type "${raw}" is disabled by feature flag.`);
      }
      return unknownInteraction;
    }
    const plugin = TYPED_REGISTRY[typed];
    if (plugin) return plugin;
  }

  if (shortInteraction.matchesPart(part)) {
    return shortInteraction;
  }

  if (process.env.NODE_ENV === "development") {
    console.warn(`[CompositeExam] Unknown part type "${raw}" — using fallback renderer.`);
  }
  return unknownInteraction;
}

export { TYPED_REGISTRY as compositeInteractionRegistry };
