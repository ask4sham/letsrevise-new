/**
 * Taxonomy fields for Create Lesson save payload (Generator import + manual).
 * Keeps IGCSE Higher tier and always emits specKey when known.
 */
import { getSpecIdentity } from "./specIdentity";

export type CreateLessonTaxonomyInput = {
  level: string;
  tier?: string;
  topicKey?: string;
  canonicalTopicKey?: string;
  specKey?: string;
  mainTopicTitle?: string;
  subTopic?: string;
};

export function applyCreateLessonTaxonomyPayloadFields(
  payload: Record<string, unknown>,
  input: CreateLessonTaxonomyInput
): Record<string, unknown> {
  const resolvedSpecKey = String(input.specKey || "").trim();
  if (resolvedSpecKey) {
    payload.specKey = resolvedSpecKey;
    const identity = getSpecIdentity(resolvedSpecKey);
    if (identity?.examCode) payload.examCode = identity.examCode;
  }

  const topicKey = String(input.topicKey || "").trim();
  if (topicKey) {
    payload.topicKey = topicKey;
    if (input.mainTopicTitle) payload.mainTopic = input.mainTopicTitle;
    if (input.subTopic) payload.subTopic = input.subTopic;
  }

  const canonical = String(input.canonicalTopicKey || "").trim();
  if (canonical) payload.canonicalTopicKey = canonical;

  const level = String(input.level || "").trim();
  const tier = String(input.tier || "").trim();
  if ((level === "GCSE" || level === "IGCSE") && tier) {
    payload.tier = tier;
  }

  return payload;
}
