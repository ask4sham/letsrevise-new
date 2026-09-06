const { MARKING_SYSTEM_PROMPT } = require("./constants");

function buildMarkingUserPrompt({
  effectiveQuestion,
  effectiveMarks,
  effectiveMarkScheme,
  studentAnswer,
  subject,
  board,
  level,
  topic,
}) {
  const bullets = effectiveMarkScheme
    .map((line, i) => `${i + 1}. ${line}`)
    .join("\n");

  const meta = [
    subject ? `Subject: ${subject}` : null,
    level ? `Level: ${level}` : null,
    board ? `Exam board: ${board}` : null,
    topic ? `Topic: ${topic}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `${meta ? `${meta}\n\n` : ""}Question:
${effectiveQuestion}

Marks: ${effectiveMarks}

Mark scheme (sole authority — judge each bullet independently):
${bullets}

Student answer:
${studentAnswer}`;
}

function buildCorrectiveUserPrompt(baseUserPrompt, validationErrors) {
  return `${baseUserPrompt}

Your previous response failed structural validation:
${validationErrors.map((e) => `- ${e}`).join("\n")}

Return ONLY valid JSON with exactly the required points array. Each index 1..N must appear once. judgement must be SATISFIED, NOT_EVIDENCED, or CONTRADICTED. Do not output awarded, score, maxMarks, or isCorrect.`;
}

module.exports = {
  MARKING_SYSTEM_PROMPT,
  buildMarkingUserPrompt,
  buildCorrectiveUserPrompt,
};
