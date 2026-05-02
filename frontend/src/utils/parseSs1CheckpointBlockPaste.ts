/**
 * Parse LetsRevise Lesson Generator "Copy Block" checkpoint text into structured MCQ fields.
 * Handles Question:/Option N:/Answer: with labels on their own lines (SS1 format).
 */

const ANSWER_HEADING = /^(?:Answer|Correct\s+answer|Answer\s+key)\s*:/i;

function normLines(raw: string): string[] {
  return String(raw || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim());
}

function padFour(opts: string[]): [string, string, string, string] {
  const a = opts.map((s) => String(s ?? "").trim());
  while (a.length < 4) a.push("");
  return [a[0] ?? "", a[1] ?? "", a[2] ?? "", a[3] ?? ""];
}

function alignAnswerToOptions(answer: string, options: string[]): string {
  const a = answer.trim();
  if (!a) return "";
  const exact = options.find((o) => o === a);
  if (exact) return exact;
  const loose = options.find((o) => o.toLowerCase() === a.toLowerCase());
  if (loose) return loose;
  const letter = a.match(/^([A-Da-d])[\).\s:]\s*(.*)$/);
  if (letter) {
    const idx = letter[1]!.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    if (idx >= 0 && idx < 4 && options[idx]) return options[idx]!;
  }
  const num = a.match(/^(\d)[\).\s:]\s*(.*)$/);
  if (num) {
    const idx = parseInt(num[1]!, 10) - 1;
    if (idx >= 0 && idx < 4 && options[idx]) return options[idx]!;
  }
  return a;
}

/**
 * Returns structured fields if the paste looks like an SS1 checkpoint; otherwise null.
 */
export function parseSs1CheckpointBlockPaste(raw: string): {
  prompt: string;
  options: [string, string, string, string];
  correctAnswer: string;
} | null {
  const lines = normLines(raw);
  if (!lines.some((l) => /^question\s*:/i.test(l))) return null;
  if (!lines.some((l) => /^option\s+1\s*:/i.test(l))) return null;

  let i = 0;
  while (i < lines.length) {
    const L = lines[i]!;
    if (!L) {
      i++;
      continue;
    }
    if (/^paste\s+into:/i.test(L)) {
      i++;
      continue;
    }
    if (/^\d+\s*[\u2014\u2013\-]\s*.+/i.test(L) && /quick\s+check|checkpoint/i.test(L)) {
      i++;
      continue;
    }
    break;
  }

  let qi = -1;
  for (let k = i; k < lines.length; k++) {
    if (/^question\s*:/i.test(lines[k]!)) {
      qi = k;
      break;
    }
  }
  if (qi < 0) return null;

  let prompt = lines[qi]!.replace(/^question\s*:/i, "").trim();
  let k = qi + 1;
  while (k < lines.length) {
    const L = lines[k]!;
    if (!L) {
      k++;
      continue;
    }
    if (/^option\s+\d+\s*:/i.test(L) || ANSWER_HEADING.test(L)) break;
    prompt = prompt ? `${prompt} ${L}` : L;
    k++;
  }

  const optBodies: string[] = ["", "", "", ""];
  let j = k;
  while (j < lines.length) {
    const L = lines[j]!;
    if (!L) {
      j++;
      continue;
    }
    if (ANSWER_HEADING.test(L)) break;
    const m = L.match(/^option\s+(\d+)\s*:\s*(.*)$/i);
    if (!m) {
      j++;
      continue;
    }
    const idx = parseInt(m[1]!, 10) - 1;
    if (idx < 0 || idx > 3) {
      j++;
      continue;
    }
    let body = (m[2] || "").trim();
    j++;
    while (j < lines.length) {
      const N = lines[j]!;
      if (!N) {
        j++;
        continue;
      }
      if (/^option\s+\d+\s*:/i.test(N) || ANSWER_HEADING.test(N)) break;
      body = body ? `${body} ${N}` : N;
      j++;
    }
    optBodies[idx] = body;
  }

  const options = padFour(optBodies);
  const nonEmpty = options.filter((o) => o.length > 0);
  if (nonEmpty.length < 2 || !prompt.trim()) return null;

  let ai = -1;
  for (let t = 0; t < lines.length; t++) {
    if (ANSWER_HEADING.test(lines[t]!)) {
      ai = t;
      break;
    }
  }
  let correctAnswer = "";
  if (ai >= 0) {
    correctAnswer = lines[ai]!.replace(ANSWER_HEADING, "").trim();
    let t = ai + 1;
    while (t < lines.length) {
      const N = lines[t]!;
      if (!N) break;
      if (/^option\s+\d+\s*:/i.test(N) || /^question\s*:/i.test(N)) break;
      correctAnswer = correctAnswer ? `${correctAnswer} ${N}` : N;
      t++;
    }
  }
  correctAnswer = alignAnswerToOptions(correctAnswer, [...options]);
  if (!correctAnswer.trim()) return null;

  return { prompt: prompt.trim(), options, correctAnswer: correctAnswer.trim() };
}
