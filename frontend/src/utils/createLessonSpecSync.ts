/**
 * Shared spec / topic selection helpers for manual Create Lesson and AI generator.
 * Single client-side companion to /api/taxonomy/create-lesson-options + SPEC_IDENTITY.
 */
import type { CreateLessonOptionsResponse } from "../api/taxonomy";
import { getSpecIdentity } from "./specIdentity";
import { TopicSelectionValue } from "../types/topicSelection";

export function formatSpecOptionLabel(specKey: string, apiLabel?: string): string {
  const identity = getSpecIdentity(specKey);
  const base = (apiLabel && apiLabel.trim()) || specKey;
  if (identity?.examCode && !base.includes(identity.examCode)) {
    return `${base} (${identity.examCode})`;
  }
  return base;
}

/** Find a topic selection row from create-lesson-options (shared by manual + AI flows). */
export function findTopicSelectionInOptions(
  options: CreateLessonOptionsResponse | null | undefined,
  specKey: string,
  topicKey: string
): TopicSelectionValue | null {
  const targetSpecKey = specKey.trim();
  const targetTopicKey = topicKey.trim();
  if (!options || !targetSpecKey || !targetTopicKey) return null;

  for (const subj of options.subjects ?? []) {
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
            return {
              subject: subj.subject,
              specKey: spec.specKey,
              mainTopicTitle: main.title,
              topicKey: sub.topicKey,
              topic: sub.title,
            };
          }
        }
      }
    }
  }
  return null;
}

/** Match specKey from board + level within a subject (e.g. Edexcel + IGCSE → edexcel-igcse-biology). */
export function findSpecKeyForBoardAndLevel(
  options: CreateLessonOptionsResponse | null | undefined,
  subject: string,
  board: string,
  level: string
): string | null {
  const subj = options?.subjects?.find((s) => s.subject === subject);
  if (!subj) return null;
  const b = board.trim().toLowerCase();
  const lv = level.trim().toLowerCase();
  if (!b || !lv) return null;
  for (const spec of subj.specs ?? []) {
    const identity = getSpecIdentity(spec.specKey);
    if (
      identity &&
      identity.board.toLowerCase() === b &&
      identity.level.toLowerCase() === lv
    ) {
      return spec.specKey;
    }
  }
  return null;
}

export function applySpecIdentityFields(
  specKey: string,
  current: { board: string; level: string; tier: string }
): { board: string; level: string; tier: string } {
  const identity = getSpecIdentity(specKey);
  if (!identity) return current;
  return {
    board: identity.board,
    level: identity.level,
    tier: identity.level === "GCSE" ? current.tier : "",
  };
}
