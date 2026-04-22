/** Minimal flashcard shape from lesson.flashcards */
export type GlossaryFlashcardLite = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
};

function topicKeysCompatible(kwTopicRaw: string, lessonTopicRaw: string): boolean {
  const a = kwTopicRaw.trim().toLowerCase();
  const b = lessonTopicRaw.trim().toLowerCase();
  if (!a || !b) return true;
  if (a === b) return true;
  const tailB = b.includes(":") ? b.slice(b.indexOf(":") + 1) : b;
  const tailA = a.includes(":") ? a.slice(a.indexOf(":") + 1) : a;
  return a === tailB || b === tailA || tailA === tailB;
}

export function pickRelatedFlashcardsForKeyword(
  kw: { term: string; topicKey?: string; specKey?: string; flashcardIds?: string[] },
  all: GlossaryFlashcardLite[],
  lessonDefaults: { topicKey?: string | null; specKey?: string | null },
  max = 3
): GlossaryFlashcardLite[] {
  if (!all?.length || max <= 0) return [];

  const byId = new Map<string, GlossaryFlashcardLite>();
  for (const c of all) {
    const id = String((c as { _id?: string; id?: string }).id ?? (c as { _id?: string })._id ?? "").trim();
    if (id) byId.set(id, { ...c, id });
  }

  if (Array.isArray(kw.flashcardIds) && kw.flashcardIds.length > 0) {
    const out: GlossaryFlashcardLite[] = [];
    const seen = new Set<string>();
    for (const rawId of kw.flashcardIds) {
      const id = String(rawId ?? "").trim();
      if (!id) continue;
      const c = byId.get(id);
      if (c && !seen.has(c.id)) {
        out.push(c);
        seen.add(c.id);
      }
      if (out.length >= max) return out;
    }
    if (out.length > 0) return out;
  }

  const term = kw.term.toLowerCase().trim();
  if (!term) return [];
  const termWords = term.split(/\s+/).filter((w) => w.length > 1);
  const lessonTopic = (lessonDefaults.topicKey ?? "").toLowerCase().trim();
  const topicTail = lessonTopic.includes(":") ? lessonTopic.slice(lessonTopic.indexOf(":") + 1) : lessonTopic;

  const kwTopic = (kw.topicKey ?? "").trim().toLowerCase();
  const kwSpec = (kw.specKey ?? "").trim().toLowerCase();
  const lessonSpec = (lessonDefaults.specKey ?? "").trim().toLowerCase();

  if (kwSpec && lessonSpec && kwSpec !== lessonSpec) {
    return [];
  }
  if (kwTopic && lessonTopic && !topicKeysCompatible(kw.topicKey ?? "", lessonDefaults.topicKey ?? "")) {
    return [];
  }

  /** Fuzzy matches only: avoid surfacing cards that merely share a topic slug or a very short substring. */
  const MIN_SCORE = 12;
  const scored = all.map((c, i) => {
    const front = String(c.front ?? "").toLowerCase();
    const back = String(c.back ?? "").toLowerCase();
    const tags = (c.tags ?? []).map((t) => String(t).toLowerCase());
    const phraseHit = front.includes(term) || back.includes(term);
    let score = 0;
    if (phraseHit) score += 14;
    for (const w of termWords) {
      if (w.length >= 4 && (front.includes(w) || back.includes(w))) score += 4;
    }
    if (phraseHit && topicTail) {
      if (tags.some((t) => t.includes(topicTail) || topicTail.includes(t))) score += 3;
      if (front.includes(topicTail) || back.includes(topicTail)) score += 1;
    }
    const id =
      String((c as { _id?: string; id?: string }).id ?? (c as { _id?: string })._id ?? "").trim() || `fc-${i}`;
    return { c: { ...c, id }, score };
  });

  return scored
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.c);
}
