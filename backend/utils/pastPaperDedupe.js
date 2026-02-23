const crypto = require("crypto");

function normalizeText(v) {
  return String(v || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function pastPaperFingerprint({ specKey, examBoard, level, year, series, paperCode, tier }) {
  const payload = {
    specKey: normalizeText(specKey),
    examBoard: normalizeText(examBoard),
    level: normalizeText(level),
    year: normalizeText(year),
    series: normalizeText(series),
    paperCode: normalizeText(paperCode),
    tier: normalizeText(tier),
  };

  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

module.exports = { pastPaperFingerprint };
