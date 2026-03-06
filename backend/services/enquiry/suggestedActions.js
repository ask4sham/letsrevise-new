/**
 * PR-016a: Build suggested learning actions from enquiry response data.
 * PR-032: Add "Create practice set (draft)" for teacher/admin when confidence moderate/strong or weak+allowExternal.
 *
 * @param {{
 *   role: string,
 *   specKey: string,
 *   topicKey?: string | null,
 *   usedSources: Array<{ sourceType: string, sourceId?: string }>,
 *   answer: { practice?: Array<any>, warnings?: string[] },
 *   lessonId?: string | null,
 *   confidenceLevel?: string,
 *   allowExternal?: boolean
 * }} opts
 * @returns {Array<{ id: string, label: string, description?: string, href?: string, type: "link"|"intent", payload?: any }>}
 */
function buildSuggestedActions(opts) {
  const role = (opts?.role || "").toString().toLowerCase();
  const specKey = (opts?.specKey || "").trim();
  const topicKey = opts?.topicKey ? String(opts.topicKey).trim() : null;
  const usedSources = opts?.usedSources || [];
  const answer = opts?.answer || {};
  const practice = answer.practice || [];
  const warnings = answer.warnings || [];
  const lessonId = opts?.lessonId ? String(opts.lessonId).trim() : null;
  const confidenceLevel = (opts?.confidenceLevel || "").toString().toLowerCase();
  const allowExternal = !!opts?.allowExternal;

  const isTeacherOrAdmin = role === "teacher" || role === "admin";
  const hasWeakEvidence = warnings.some(
    (w) => typeof w === "string" && w.toLowerCase().includes("insufficient trusted sources")
  );
  const lessonSource = usedSources.find((s) => s.sourceType === "lessonBlock" || s.sourceType === "lessonDiagram");

  const actions = [];

  // A) Practice — scroll to practice section
  if (practice.length > 0) {
    actions.push({
      id: "practice",
      label: "Try a practice question",
      description: "Scroll to practice section",
      type: "intent",
      payload: { action: "practice" },
    });
  }

  // B) View lesson
  const lessonSourceId = lessonSource?.sourceId ? String(lessonSource.sourceId) : null;
  if (lessonSourceId) {
    actions.push({
      id: "lesson",
      label: "Open the lesson section",
      description: "See this explained in your lesson",
      href: `/lesson/${lessonSourceId}`,
      type: "link",
    });
  } else if (topicKey && isTeacherOrAdmin) {
    actions.push({
      id: "find-lessons",
      label: "Find lessons on this topic",
      href: `/browse-lessons?topicKey=${encodeURIComponent(topicKey)}`,
      type: "link",
    });
  }

  // C) Revise flashcards
  if (topicKey) {
    if (isTeacherOrAdmin) {
      actions.push({
        id: "flashcards",
        label: "Revise flashcards",
        href: `/teacher/topic-banks/flashcards?topicKey=${encodeURIComponent(topicKey)}`,
        type: "link",
      });
    } else if (lessonId) {
      actions.push({
        id: "flashcards",
        label: "Revise flashcards",
        href: `/lessons/${lessonId}/flashcards`,
        type: "link",
      });
    }
  }

  // D) Quiz yourself
  if (topicKey) {
    if (isTeacherOrAdmin) {
      actions.push({
        id: "quiz",
        label: "Quiz yourself",
        href: `/teacher/topic-banks/quizzes?topicKey=${encodeURIComponent(topicKey)}`,
        type: "link",
      });
    } else if (lessonId) {
      actions.push({
        id: "quiz",
        label: "Check your understanding",
        description: "Quiz for this lesson",
        href: `/lesson/${lessonId}#check-understanding`,
        type: "link",
      });
    }
  }

  // E) Coverage drilldown — teacher/admin only, when weak evidence
  if (isTeacherOrAdmin && hasWeakEvidence && specKey && topicKey) {
    actions.push({
      id: "coverage",
      label: "Fix coverage for this topic",
      description: "See missing spec statements and weak questions",
      href: `/coverage?specKey=${encodeURIComponent(specKey)}&focusTopicKey=${encodeURIComponent(topicKey)}`,
      type: "link",
    });
  }

  // F) Create practice set (draft) — teacher/admin only, when confidence moderate/strong OR weak+allowExternal
  const showPracticeSet =
    isTeacherOrAdmin &&
    specKey &&
    topicKey &&
    (confidenceLevel === "moderate" ||
      confidenceLevel === "strong" ||
      (confidenceLevel === "weak" && allowExternal));
  if (showPracticeSet && actions.length < 5) {
    actions.push({
      id: "practice-set",
      label: "Create practice set (draft)",
      description: "Generate flashcards, quiz, exam questions for this topic",
      href: `/coverage?specKey=${encodeURIComponent(specKey)}&focusTopicKey=${encodeURIComponent(topicKey)}&openPracticeSet=1`,
      type: "link",
    });
  }

  // G) Download sprint order — teacher/admin only (optional)
  if (isTeacherOrAdmin && specKey && actions.length < 5) {
    actions.push({
      id: "sprint",
      label: "Download sprint order",
      href: `/coverage?specKey=${encodeURIComponent(specKey)}`,
      type: "link",
    });
  }

  return actions.slice(0, 5);
}

module.exports = { buildSuggestedActions };
