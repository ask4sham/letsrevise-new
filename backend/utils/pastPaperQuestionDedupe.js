const crypto = require("crypto");

function normalizeText(v) {
  return String(v || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pastPaperQuestionFingerprint({ pastPaperId, topicKey, question, markScheme, questionNumber }) {
  const payload = {
    pastPaperId: normalizeText(pastPaperId),
    topicKey: normalizeText(topicKey),
    questionNumber: normalizeText(questionNumber),
    question: normalizeText(question),
    markScheme: normalizeText(markScheme),
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

module.exports = { pastPaperQuestionFingerprint };
