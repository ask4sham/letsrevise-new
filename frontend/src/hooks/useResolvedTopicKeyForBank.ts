/**
 * Resolve lesson topic to namespaced topicKeyForBank.
 * When lesson.topicKey is missing, fetches /api/taxonomy/resolve-topic to map display name (e.g. "Animal and plant cells")
 * to canonical key (e.g. "aqa-gcse-biology:animal-plant-cells"). Avoids wrong slugify like "animal-and-plant-cells".
 */
import { useEffect, useState } from "react";
import {
  resolveLessonTopicKeyForBankFromLesson,
  getSpecKeyFromLesson,
} from "../utils/resolveLessonTopicKey";
import { resolveTopicDisplayToKey } from "../api/taxonomy";

export function useResolvedTopicKeyForBank(lesson: {
  topicKey?: string | null;
  specKey?: string | null;
  topic?: string | null;
  examBoardName?: string | null;
  level?: string | null;
  subject?: string | null;
} | null): string | null {
  const [resolvedFromDisplay, setResolvedFromDisplay] = useState<string | null | undefined>(undefined);

  const specKey =
    (typeof (lesson as { specKey?: string })?.specKey === "string" && (lesson as { specKey?: string }).specKey?.trim())
      ? (lesson as { specKey?: string }).specKey!.trim()
      : getSpecKeyFromLesson(lesson);
  const hasTopicKey = typeof lesson?.topicKey === "string" && lesson.topicKey.trim().length > 0;

  useEffect(() => {
    if (!lesson || hasTopicKey || !specKey || !(typeof lesson.topic === "string" && lesson.topic.trim())) {
      setResolvedFromDisplay(null);
      return;
    }
    let mounted = true;
    setResolvedFromDisplay(undefined);
    resolveTopicDisplayToKey(specKey, lesson.topic.trim())
      .then((key) => mounted && setResolvedFromDisplay(key))
      .catch(() => mounted && setResolvedFromDisplay(null));
    return () => {
      mounted = false;
    };
  }, [lesson, lesson?.topic, specKey, hasTopicKey]);

  // Sync path: lesson has topicKey
  if (hasTopicKey) {
    return resolveLessonTopicKeyForBankFromLesson(lesson);
  }
  // Async path: resolved from API (correct mapping for "Animal and plant cells" → "animal-plant-cells")
  if (resolvedFromDisplay !== undefined) {
    return resolvedFromDisplay;
  }
  // Loading: return null to avoid enabling buttons with wrong slugify-derived key
  return null;
}
