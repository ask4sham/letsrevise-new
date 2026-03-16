/**
 * Actionable Revision Flow: Determine recommended learning action from mastery.
 * Used by StudentMyProgressPage and Recommended Next panel.
 * No new mastery logic — uses existing masteryScore from dashboard.
 */
export type RevisionActionType = "flashcards" | "quiz" | "exam" | "review";

export type TopicRevisionActionInput = {
  masteryScore: number | null;
  difficulty?: string;
  attempts?: number;
  topicKey: string;
};

export type TopicRevisionActionOutput = {
  label: string;
  type: RevisionActionType;
  route: string;
};

/**
 * Get the recommended action for a topic based on mastery.
 * Routes use topicKey as provided (can be namespaced or slug).
 */
export function getTopicRevisionAction(input: TopicRevisionActionInput): TopicRevisionActionOutput {
  const { masteryScore, topicKey } = input;
  const score = masteryScore ?? 0;
  const key = topicKey || "";

  if (score < 40) {
    return {
      label: "Start Flashcards",
      type: "flashcards",
      route: `/practice/flashcards/${encodeURIComponent(key)}`,
    };
  }
  if (score >= 40 && score < 70) {
    return {
      label: "Start Quiz",
      type: "quiz",
      route: `/practice/quiz/${encodeURIComponent(key)}`,
    };
  }
  if (score >= 70 && score < 85) {
    return {
      label: "Exam Practice",
      type: "exam",
      route: `/practice/exam/${encodeURIComponent(key)}`,
    };
  }
  return {
    label: "Review",
    type: "review",
    route: `/practice/flashcards/${encodeURIComponent(key)}`,
  };
}
