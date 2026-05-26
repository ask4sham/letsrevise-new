/**
 * Resolve lesson topic to namespaced topicKeyForBank.
 * When lesson.topicKey is missing or title-derived, repairs via normalize + /api/taxonomy/resolve-topic.
 */
import { useEffect, useState } from "react";
import {
  resolveLessonTopicKeyForBankFromLesson,
  getSpecKeyFromLesson,
} from "../utils/resolveLessonTopicKey";
import {
  extractTopicSlug,
  isLikelyInvalidTopicSlug,
  normalizeLessonTopicSlugFromLesson,
} from "../utils/normalizeLessonTopicKey";
import { resolveTopicDisplayToKey } from "../api/taxonomy";
import type { TaxonomyUnit } from "../api/taxonomy";
import { logTopicMappingDebug } from "../utils/resolveTopicLabelToKey";

function displayTextForTopicResolve(lesson: {
  topic?: string | null;
  subTopic?: string | null;
  title?: string | null;
} | null): string {
  if (!lesson) return "";
  const topic = typeof lesson.topic === "string" ? lesson.topic.trim() : "";
  if (topic) return topic;
  const sub = typeof lesson.subTopic === "string" ? lesson.subTopic.trim() : "";
  if (sub) return sub;
  return typeof lesson.title === "string" ? lesson.title.trim() : "";
}

export function useResolvedTopicKeyForBank(
  lesson: {
    id?: string;
    topicKey?: string | null;
    canonicalTopicKey?: string | null;
    title?: string | null;
    specKey?: string | null;
    topic?: string | null;
    subTopic?: string | null;
    examBoardName?: string | null;
    level?: string | null;
    subject?: string | null;
  } | null,
  taxonomyUnits?: TaxonomyUnit[]
): string | null {
  const [resolvedFromDisplay, setResolvedFromDisplay] = useState<string | null | undefined>(undefined);

  const specKey =
    (typeof (lesson as { specKey?: string })?.specKey === "string" && (lesson as { specKey?: string }).specKey?.trim())
      ? (lesson as { specKey?: string }).specKey!.trim()
      : getSpecKeyFromLesson(lesson);
  const storedTopicKey = typeof lesson?.topicKey === "string" ? lesson.topicKey.trim() : "";
  const storedSlugInvalid =
    storedTopicKey.length > 0 && isLikelyInvalidTopicSlug(extractTopicSlug(storedTopicKey));
  const hasTopicKey = storedTopicKey.length > 0 && !storedSlugInvalid;
  const displayForResolve = displayTextForTopicResolve(lesson);

  useEffect(() => {
    if (!lesson || hasTopicKey || !specKey || !displayForResolve) {
      setResolvedFromDisplay(null);
      return;
    }
    let mounted = true;
    resolveTopicDisplayToKey(specKey, displayForResolve, {
      subTopic: lesson?.subTopic,
      title: lesson?.title,
    })
      .then((key) => mounted && setResolvedFromDisplay(key))
      .catch(() => mounted && setResolvedFromDisplay(null));
    return () => {
      mounted = false;
    };
  }, [lesson?.id, lesson?.topicKey, lesson?.title, lesson?.topic, lesson?.subTopic, hasTopicKey, specKey, displayForResolve]);

  const normalized = normalizeLessonTopicSlugFromLesson(lesson, taxonomyUnits);
  const resolved =
    normalized.namespaced ||
    (hasTopicKey ? resolveLessonTopicKeyForBankFromLesson(lesson, undefined, taxonomyUnits) : null) ||
    (resolvedFromDisplay !== undefined ? resolvedFromDisplay : null);

  logTopicMappingDebug("topicKeyForBank", {
    specKey,
    storedTopicKey: storedTopicKey || null,
    topicLabel: displayForResolve || null,
    normalizedTopicKey: normalized.namespaced,
    taxonomyLookup: normalized.slug,
    resolvedTopicKey: resolved,
    graphLookup: "client-only",
  });

  if (normalized.namespaced) {
    return normalized.namespaced;
  }
  if (hasTopicKey) {
    return resolveLessonTopicKeyForBankFromLesson(lesson, undefined, taxonomyUnits);
  }
  if (resolvedFromDisplay !== undefined) {
    return resolvedFromDisplay;
  }
  return null;
}
