/**
 * Teacher Brain Brief generator — frontend entry (re-exports shared package).
 */
export {
  generateTeacherBrainBrief,
  formatTeacherBrainBriefNote,
  normalizeActivityType,
  isGenericPlaceholder,
  extractLessonVocabulary,
  collectSurroundingBlocks,
  pairsAreGeneric,
} from "letsrevise-teacher-brain";

export type TeacherBrainBriefCard = {
  prompt: string;
  answer: string;
  explanation?: string;
};

export type TeacherBrainBriefStep = {
  label: string;
  explanation?: string;
  misconception?: string;
};

export type TeacherBrainBrief = {
  activityType: string;
  purpose: string;
  suggestedCards: TeacherBrainBriefCard[];
  suggestedSteps: TeacherBrainBriefStep[];
  commonMisconceptions: string[];
  assessmentFocus: string[];
  studentTask: string;
  qualityChecks: string[];
  vocabulary: string[];
  correctAnswer?: string;
  distractorRationale?: string | string[];
  examinerReason?: string;
  targetSkill?: string;
  marksLogic?: string;
  expectedAnswerStructure?: string;
};
