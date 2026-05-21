/**
 * Build quiz / flashcard / exam-practice retrieval from lesson blocks when the lesson
 * has no (or few) bank-generated revision items — shown automatically in student view.
 */

type LooseBlock = Record<string, unknown>;

export type DerivedFlashcard = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
};

export type DerivedQuizQuestion = {
  id: string;
  type: "mcq";
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
};

export type DerivedExamQuestion = {
  id: string;
  question: string;
  marks: number;
  modelAnswer?: string;
};

function safeStr(v: unknown): string {
  return v === undefined || v === null ? "" : String(v).trim();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function blockType(b: LooseBlock): string {
  return safeStr(b.type).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function blockRole(b: LooseBlock): string {
  return safeStr(b.role).trim();
}

function isExamPracticeBlock(b: LooseBlock): boolean {
  const role = blockRole(b);
  if (role === "examPractice") return true;
  const t = blockType(b);
  if (t === "exampractice") return true;
  const title = safeStr(b.title).toLowerCase();
  return t === "text" && /exam\s*practice/.test(title);
}

function collectBlocks(pages: Array<{ blocks?: unknown[] }>): LooseBlock[] {
  const out: LooseBlock[] = [];
  for (const p of pages) {
    const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
    for (const b of blocks) {
      if (b && typeof b === "object") out.push(b as LooseBlock);
    }
  }
  return out;
}

function pushMcqFromBlock(
  b: LooseBlock,
  sink: DerivedQuizQuestion[],
  seen: Set<string>
) {
  const prompt = safeStr(b.prompt ?? b.question);
  const opts = Array.isArray(b.options)
    ? b.options.map((o) => safeStr(o)).filter(Boolean)
    : [];
  const ca = safeStr(b.correctAnswer ?? b.answer);
  if (!prompt || opts.length < 2 || !ca) return;
  const key = `${prompt}|${ca}`;
  if (seen.has(key)) return;
  seen.add(key);
  while (opts.length < 4) opts.push("");
  sink.push({
    id: `derived-q-${sink.length + 1}`,
    type: "mcq",
    question: prompt,
    options: opts.slice(0, 4),
    correctAnswer: ca,
    explanation: safeStr(b.explanation) || undefined,
  });
}

function parseKeywordsFromHtml(html: string): DerivedFlashcard[] {
  const cards: DerivedFlashcard[] = [];
  const re = /<strong[^>]*>([^<]+)<\/strong>\s*[–\-]\s*([^<\n]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const front = m[1].trim();
    const back = m[2].trim();
    if (front && back) {
      cards.push({ id: `derived-fc-${cards.length + 1}`, front, back });
    }
  }
  return cards;
}

function parseExamQuestions(text: string): DerivedExamQuestion[] {
  const plain = stripHtml(text);
  const out: DerivedExamQuestion[] = [];
  const re = /Q(\d)\s*\((\d+)\s*marks?\)\s*([\s\S]*?)(?=Q\d\s*\(|Reveal Model Answer|Model Answer:|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    const q = m[3].trim();
    if (q.length > 12) {
      out.push({
        id: `derived-exam-q${m[1]}`,
        question: q,
        marks: Number(m[2]) || 1,
      });
    }
  }
  return out.slice(0, 2);
}

function extractModelAnswers(text: string): string[] {
  const plain = stripHtml(text);
  const answers: string[] = [];
  const re = /Q(\d)[\s\S]*?(?:Reveal Model Answer|Model Answer:)\s*([\s\S]*?)(?=Q\d|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain)) !== null) {
    answers[Number(m[1]) - 1] = m[2].trim();
  }
  return answers;
}

export function deriveLessonRetrieval(
  pages: Array<{ blocks?: unknown[] }> = []
): {
  flashcards: DerivedFlashcard[];
  quizQuestions: DerivedQuizQuestion[];
  examQuestions: DerivedExamQuestion[];
} {
  const blocks = collectBlocks(pages);
  const quizSeen = new Set<string>();
  const quizQuestions: DerivedQuizQuestion[] = [];
  const flashcards: DerivedFlashcard[] = [];
  const fcSeen = new Set<string>();
  let examSource = "";

  for (const b of blocks) {
    const t = blockType(b);
    if (t === "checkpoint" || t === "selfcheck" || t === "quickcheck") {
      pushMcqFromBlock(b, quizQuestions, quizSeen);
      const prompt = safeStr(b.prompt ?? b.question);
      const answer = safeStr(b.correctAnswer ?? b.answer);
      if (t === "selfcheck" && prompt && answer && !Array.isArray(b.options)) {
        const key = `${prompt}|${answer}`.toLowerCase();
        if (!fcSeen.has(key)) {
          fcSeen.add(key);
          flashcards.push({
            id: `derived-fc-sc-${flashcards.length + 1}`,
            front: prompt,
            back: answer,
          });
        }
      }
    }
    if (t === "keywords" || t === "keyword") {
      const html = safeStr(b.content ?? b.html);
      for (const c of parseKeywordsFromHtml(html)) {
        const key = c.front.toLowerCase();
        if (fcSeen.has(key)) continue;
        fcSeen.add(key);
        flashcards.push(c);
      }
    }
    if (t === "graph") {
      const eq = safeStr(b.examQuestion);
      if (eq && quizQuestions.length < 5) {
        pushMcqFromBlock(
          {
            prompt: eq,
            options: [
              "The rate keeps increasing without limit",
              "Another factor becomes limiting",
              "Photosynthesis stops completely",
              "Chlorophyll is destroyed immediately",
            ],
            correctAnswer: "Another factor becomes limiting",
            explanation: safeStr(b.markScheme),
          },
          quizQuestions,
          quizSeen
        );
      }
    }
    if (t === "dragdrop" || t === "draganddrop") {
      const pairs = Array.isArray(b.pairs) ? b.pairs : [];
      for (const p of pairs) {
        if (!p || typeof p !== "object") continue;
        const front = safeStr((p as Record<string, unknown>).term ?? (p as Record<string, unknown>).left);
        const back = safeStr((p as Record<string, unknown>).definition ?? (p as Record<string, unknown>).right);
        if (!front || !back) continue;
        const key = front.toLowerCase();
        if (fcSeen.has(key)) continue;
        fcSeen.add(key);
        flashcards.push({ id: `derived-fc-dd-${flashcards.length + 1}`, front, back });
      }
    }
    if (isExamPracticeBlock(b)) {
      examSource += `\n${safeStr(b.content ?? b.html)}`;
    }
  }

  let examQuestions = parseExamQuestions(examSource);
  const models = extractModelAnswers(examSource);
  examQuestions = examQuestions.map((q, i) => ({
    ...q,
    modelAnswer: models[i] || q.modelAnswer,
  }));

  return {
    flashcards: flashcards.slice(0, 5),
    quizQuestions: quizQuestions.slice(0, 5),
    examQuestions: examQuestions.slice(0, 2),
  };
}
