/**
 * Hidden teacher UI helpers for Lesson Generator V2 draft generation.
 * Distinct from V1 "useLessonGeneratorV2" planner flags on /ai/generate-and-save.
 */

export function isLessonGeneratorV2UiEnabled(
  env: { REACT_APP_LESSON_GENERATOR_V2_UI?: string } = process.env as any
): boolean {
  const raw = String(env.REACT_APP_LESSON_GENERATOR_V2_UI || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type V2DraftFormFields = {
  subject?: string;
  level?: string;
  topic?: string;
  topicKey?: string;
  board?: string;
  tier?: string;
};

/**
 * Build body for POST /ai/generate-and-save-v2 (persist draft only).
 * Must not include V1 planner flags.
 */
export function buildV2DraftGeneratePayload(
  form: V2DraftFormFields,
  topicFallback = ""
): Record<string, unknown> {
  const topic = String(form.topic || "").trim() || String(topicFallback || "").trim();
  const topicKey = String(form.topicKey || "").trim();
  const level = String(form.level || "").trim();
  const payload: Record<string, unknown> = {
    subject: String(form.subject || "").trim(),
    level,
    topic,
    board: String(form.board || "").trim(),
    persist: true,
  };
  if (level === "GCSE") {
    payload.tier = String(form.tier || "").trim();
  }
  if (topicKey) payload.topicKey = topicKey;
  return payload;
}

/**
 * Map V2 API errors to teacher-facing copy.
 */
export function formatV2GenerateError(err: any): string {
  const data = err?.response?.data ?? err?.data ?? {};
  const code = String(data?.code || "").trim();
  const serverMsg = String(data?.msg || data?.message || err?.message || "").trim();

  switch (code) {
    case "LESSON_GENERATOR_V2_DISABLED":
      return "V2 pipeline is not enabled on the server.";
    case "LESSON_V2_PERSIST_DISABLED":
      return "V2 draft save is not enabled on the server.";
    case "LESSON_V2_PHASE1_FAILED":
    case "LESSON_V2_PHASE2_FAILED":
    case "LESSON_V2_PHASE3_FAILED":
    case "LESSON_V2_ASSEMBLY_FAILED":
    case "LESSON_V2_CRITIC_FAILED":
      return `V2 quality check failed${code ? ` (${code})` : ""}${serverMsg ? `: ${serverMsg}` : "."}`;
    case "LESSON_V2_PERSIST_FAILED":
      return "Draft save failed. Nothing was published.";
    default:
      if (serverMsg) {
        return code ? `${serverMsg} (${code})` : serverMsg;
      }
      return "V2 generation failed. Nothing was published.";
  }
}

export function isSuccessfulV2DraftSave(data: any): data is { saved: true; lessonId: string } {
  return data?.saved === true && Boolean(String(data?.lessonId || "").trim());
}
