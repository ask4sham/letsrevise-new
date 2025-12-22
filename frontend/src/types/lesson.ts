// /src/types/lesson.ts

export type LessonStage = "KS3" | "GCSE" | "A-Level";
export type LessonDifficulty = "Foundation" | "Higher" | "Advanced";

export type LessonBlock =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | TableBlock
  | QuizBlock
  | FlashcardsBlock
  | CallToActionBlock;

export interface Lesson {
  id: string;
  title: string;
  stage: LessonStage;
  subject: string;
  topic?: string;
  difficulty?: LessonDifficulty;
  estimatedTime?: number; // minutes
  blocks: LessonBlock[];
}

/** Blocks */
export interface HeadingBlock {
  type: "heading";
  level: 1 | 2 | 3;
  text: string;
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface ImageBlock {
  type: "image";
  src?: string;      // if pre-generated and hosted
  prompt?: string;   // if to be generated later
  caption?: string;
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index into options[]
  explanation?: string;
}

export interface QuizBlock {
  type: "quiz";
  questions: QuizQuestion[];
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface FlashcardsBlock {
  type: "flashcards";
  cards: Flashcard[];
}

export type CallToActionAction = "next-lesson" | "dashboard" | "subject-library";

export interface CallToActionBlock {
  type: "cta";
  label: string;
  action: CallToActionAction;
}
