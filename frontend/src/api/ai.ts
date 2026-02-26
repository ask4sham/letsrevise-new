/**
 * Step 1 (LLM Roadmap): AI API — explain chunk, etc.
 */
import api from "../services/api";

export type ExplainChunkParams = {
  text: string;
  level?: string;
  subject?: string;
};

export type ExplainChunkResponse = {
  explanation: string;
  _disabled?: boolean;
};

export async function explainChunk(params: ExplainChunkParams): Promise<ExplainChunkResponse> {
  const res = await api.post<ExplainChunkResponse>("/ai/explain-chunk", {
    text: params.text,
    level: params.level,
    subject: params.subject,
  });
  return res.data;
}

// Step 2: Explain my mistake
export type ExplainMistakeParams = {
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  topic?: string;
  markScheme?: string[] | string;
  level?: string;
  subject?: string;
};

export type ExplainMistakeResponse = {
  explanation: string;
  _disabled?: boolean;
};

export async function explainMistake(params: ExplainMistakeParams): Promise<ExplainMistakeResponse> {
  const res = await api.post<ExplainMistakeResponse>("/ai/explain-mistake", {
    questionText: params.questionText,
    userAnswer: params.userAnswer,
    correctAnswer: params.correctAnswer,
    topic: params.topic,
    markScheme: params.markScheme,
    level: params.level,
    subject: params.subject,
  });
  return res.data;
}

// Step 3: Quiz me (LLM) — generate practice quiz
export type GeneratePracticeQuizParams = {
  topic: string;
  subject?: string;
  level?: string;
  numQuestions?: number;
};

export type PracticeQuizQuestion = {
  id: string;
  type: "mcq" | "short";
  question: string;
  options?: string[];
  correctAnswer: string;
  marks?: number;
};

export type GeneratePracticeQuizResponse = {
  questions: PracticeQuizQuestion[];
  _disabled?: boolean;
};

export async function generatePracticeQuiz(
  params: GeneratePracticeQuizParams
): Promise<GeneratePracticeQuizResponse> {
  const res = await api.post<GeneratePracticeQuizResponse>("/ai/generate-practice-quiz", {
    topic: params.topic,
    subject: params.subject,
    level: params.level,
    numQuestions: params.numQuestions,
  });
  return res.data;
}

// Step 4: RAG — ask about lesson content
export type AskRAGParams = {
  question: string;
  lessonId: string;
};

export type AskRAGResponse = {
  answer: string;
  _disabled?: boolean;
};

export async function askRAG(params: AskRAGParams): Promise<AskRAGResponse> {
  const res = await api.post<AskRAGResponse>("/ai/ask", {
    question: params.question,
    lessonId: params.lessonId,
  });
  return res.data;
}

// Step 5: Summarise / key points
export type SummariseParams = {
  lessonId: string;
};

export type SummariseResponse = {
  summary: string;
  keyPoints: string[];
  _disabled?: boolean;
};

export async function summariseLesson(params: SummariseParams): Promise<SummariseResponse> {
  const res = await api.post<SummariseResponse>("/ai/summarise", {
    lessonId: params.lessonId,
  });
  return res.data;
}

// Step 7: Structure my notes (user input → summary + flashcards)
export type StructureNotesParams = {
  notes: string;
};

export type StructureNotesResponse = {
  summary: string;
  flashcards: { front: string; back: string }[];
  _disabled?: boolean;
};

export async function structureNotes(params: StructureNotesParams): Promise<StructureNotesResponse> {
  const res = await api.post<StructureNotesResponse>("/ai/structure-notes", {
    notes: params.notes,
  });
  return res.data;
}
