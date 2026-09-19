/**
 * Feature-gated Lesson Synthesiser (Phase P1) — separate from legacy /ai/generate-and-save.
 */

export function isLessonSynthesiserV1UiEnabled(
  env: { REACT_APP_LESSON_SYNTHESISER_V1?: string } = process.env as any
): boolean {
  const raw = String(env.REACT_APP_LESSON_SYNTHESISER_V1 || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type SynthesiserV1FormFields = {
  subject?: string;
  level?: string;
  topic?: string;
  topicKey?: string;
  board?: string;
  tier?: string;
  specKey?: string;
};

export function buildLessonSynthesiserV1GeneratePayload(
  form: SynthesiserV1FormFields,
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
  };
  if (topicKey) payload.topicKey = topicKey;
  const specKey = String(form.specKey || "").trim();
  if (specKey) payload.specKey = specKey;
  if (level === "GCSE") {
    payload.tier = String(form.tier || "").trim();
  }
  return payload;
}

export function formatLessonSynthesiserV1Error(err: any): string {
  const data = err?.response?.data ?? err?.data;
  const code = typeof data?.code === "string" ? data.code : "";
  const message =
    (typeof data?.message === "string" ? data.message : null) ||
    (typeof data?.error === "string" ? data.error : null) ||
    err?.message ||
    "Lesson Synthesiser generation failed.";
  if (code === "SYNTHESISER_TOPIC_UNSUPPORTED") {
    return `${message} Use legacy AI generate for this topic.`;
  }
  if (code === "LESSON_SYNTHESISER_V1_DISABLED") {
    return "Lesson Synthesiser is not enabled in this environment.";
  }
  return message;
}
