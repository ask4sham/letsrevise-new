/**
 * PR-METADATA-1: Difficulty / skill metadata for questions.
 */
export const SKILLS = ["recall", "application", "analysis", "exam-technique"] as const;
export type Skill = (typeof SKILLS)[number];

export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 5;

export const SKILL_LABELS: Record<Skill, string> = {
  recall: "Recall",
  application: "Application",
  analysis: "Analysis",
  "exam-technique": "Exam technique",
};
