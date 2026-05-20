/** True when field value is HTML from the generator (not plain markdown). */
export function lessonFieldLooksLikeHtml(text: string): boolean {
  const t = String(text ?? "").trim();
  return /<[a-z][\s\S]*>/i.test(t);
}

/** Combine intro + legacy content fields for display (generator may use either). */
export function mergeLessonBlockIntroFields(intro?: string, content?: string): string {
  const a = String(intro ?? "").trim();
  const b = String(content ?? "").trim();
  if (!a) return b;
  if (!b) return a;
  if (a === b) return a;
  return `${a}\n\n${b}`;
}
