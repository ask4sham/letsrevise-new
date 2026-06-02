import {
  cloneLessonPagesForState,
  type TeacherBrainInjectionMeta,
} from "../utils/teacherBrainBriefPages";
import { injectTeacherBrainBriefsInProcess } from "../utils/teacherBrainInjectInProcess";

export type InjectTeacherBrainBriefsInput = {
  pages: Array<{ title?: string; blocks?: unknown[] }>;
  topic: string;
  topicKey?: string;
  subTopic?: string;
  subject?: string;
  examBoard?: string;
  tier?: string;
};

export type InjectTeacherBrainBriefsResult = {
  pages: Array<{ title?: string; blocks?: unknown[] }>;
  teacherBrainInjection: TeacherBrainInjectionMeta;
};

/**
 * Regenerate Teacher Brain design briefs from current editor block state.
 * Always overwrites existing briefs (not insert-if-missing).
 */
export async function injectTeacherBrainBriefs(
  input: InjectTeacherBrainBriefsInput
): Promise<InjectTeacherBrainBriefsResult> {
  const topic = String(input.topic ?? "").trim();
  if (!topic) {
    throw new Error("Topic is required to inject Teacher Brain briefs.");
  }

  const meta = {
    topic,
    topicKey: input.topicKey,
    subTopic: input.subTopic,
    subject: input.subject,
    examBoard: input.examBoard,
    tier: input.tier,
  };

  console.log("[TeacherBrainUI] regenerating briefs in-process from editor state");
  const local = injectTeacherBrainBriefsInProcess(input.pages, meta);
  return {
    pages: cloneLessonPagesForState(local.pages),
    teacherBrainInjection: local.teacherBrainInjection,
  };
}
