/**
 * Block 28 Phase 2 — selection-first final practice set proposals (read-only).
 */
const { extractCommandWord } = require("./classifyRepair");
const { jaccardSimilarity, normalizeForCompare } = require("./qualityGates");
const { assessConceptualOverlap } = require("./conceptualOverlap");
const { isSimpleRecallStem } = require("./repairProposals");

const SELECTION = Object.freeze({
  RETAIN: "RETAIN",
  REVIEW_FOR_RETAIN: "REVIEW_FOR_RETAIN",
  DETACH_UNSUPPORTED: "DETACH_UNSUPPORTED",
  DETACH_DUPLICATE: "DETACH_DUPLICATE",
  DETACH_EXCESS: "DETACH_EXCESS",
  REJECT_CONTENT: "REJECT_CONTENT",
});

const MAX_FINAL = 10;
const MIN_STRONG_SET = 6;

function objectiveAlignmentScore(question, boundary) {
  const q = String(question || "").toLowerCase();
  const title = String(boundary?.lessonTitle || "").toLowerCase();
  let score = 0;

  if (/\b(evolution|natural selection)\b/.test(q) && !title.includes("evolution")) score -= 3.5;
  if (/\benvironmental\b/.test(q) || /\bsame alleles\b.*\bdifferent traits\b/.test(q)) score -= 4;
  if (/\bjustify why understanding\b/.test(q) || /\bessential for studying genetics\b/.test(q)) score -= 2.5;
  if (/\bevaluate how the study of alleles\b/.test(q)) score -= 4;
  if (/\bevaluate the importance of alleles in causing variation\b/.test(q)) score -= 1.5;

  if (title.includes("allele")) {
    if (/\b(gene|allele)\b/.test(q) && /\b(compare|relationship|roles)\b/.test(q)) score += 2.5;
    if (/\b(inherit|each parent|gamete|offspring)\b/.test(q)) score += 2;
    if (/\boutline the process by which alleles are inherited\b/.test(q)) score -= 2;
    if (/\banalyse the relationship between alleles and the concept of dominant\b/.test(q)) score -= 2;
    if (/\b(dominant|recessive|phenotype)\b/.test(q)) score += 2.5;
    if (/\bptc\b|\btaste\b/.test(q)) score += 2.5;
    if (/\bvariation\b/.test(q) && /\b(inherited characteristic|within a species|allele)/.test(q)) score += 2;
  }

  if (title.includes("meiosis") && /\bmitosis\b/.test(q) && !/\bmeiosis\b/.test(q)) score -= 1;
  if (title.includes("dna structure") && /\brna\b/.test(q) && !/\bdna\b/.test(q)) score -= 2;

  if (title.includes("dna structure")) {
    if (/\b(structure of dna|dna and its components)\b/.test(q) && /\b(explain|describe)\b/.test(q)) {
      score += 3.5;
    }
    if (/\bstructure of dna and its components\b/.test(q)) score += 1.5;
    if (/\bsugar[\s-]?phosphate backbone\b/.test(q) && /\b(nitrogenous bases|compare)\b/.test(q)) {
      score += 3.5;
    }
    if (/\bhydrogen bonds\b/.test(q) && /\bbases\b/.test(q)) score += 3.5;
    if (/\b(enables it to be copied|copied during cell division)\b/.test(q)) score += 4;
    if (/\b(sequence of bases|role in protein synthesis)\b/.test(q) && /\bprotein\b/.test(q)) score += 2.5;
    if (/\berrors in dna replication\b/.test(q) || /\bsuggest how errors\b.*\breplication\b/.test(q)) {
      score -= 5;
    }
    if (/\bjustify the role of dna in inheritance\b/.test(q)) score -= 4;
    if (/\banalyse the significance of dna's double helix\b/.test(q)) score -= 3;
    if (/\bevaluate the importance of complementary base pairing in dna replication\b/.test(q)) {
      score -= 3.5;
    }
    if (/\boutline the process of dna replication and its importance\b/.test(q)) score -= 2.5;
  }

  return score;
}

function candidateTotalScore(att, boundary) {
  return (
    qualityScore(att) +
    curriculumOverlapScore(att.question, boundary) * 3 +
    objectiveAlignmentScore(att.question, boundary) +
    (att.studentServedPosition ? 0.1 : 0)
  );
}

function curriculumOverlapScore(question, boundary) {
  const qTokens = new Set(normalizeForCompare(question).split(" ").filter((w) => w.length > 3));
  const lessonTerms = new Set((boundary?.meaningfulKeyTerms || boundary?.keyTerms || []).map((t) => t.toLowerCase()));
  if (!qTokens.size || !lessonTerms.size) return 0.2;
  let hit = 0;
  for (const t of qTokens) if (lessonTerms.has(t)) hit++;
  return Math.min(1, hit / Math.max(3, qTokens.size * 0.35));
}

function qualityScore(att) {
  let score = 0;
  const q = String(att.question || "");
  if (q.length >= 40) score += 1;
  if (q.length >= 80) score += 0.5;
  if (extractCommandWord(q)) score += 0.5;
  if (att.invariant === "PASS") score += 1.5;
  if (att.marks >= 2 && att.markSchemeCount >= 2) score += 0.5;
  if (att.usageCount === 1) score += 0.25;
  if (isSimpleRecallStem(q) || att.marks === 1) score -= 0.75;
  return score;
}

function isOutOfScope(question, boundary) {
  const q = question.toLowerCase();
  const title = String(boundary?.lessonTitle || "").toLowerCase();
  if (title.includes("dna structure") && /\brna\b/.test(q) && !/\bdna\b/.test(q)) return true;
  if (title.includes("rna structure") && /\bdna\b/.test(q) && !/\brna\b/.test(q)) return true;
  if (title.includes("allele")) {
    if (/\benvironmental\b/.test(q) || /\bsame alleles\b.*\bdifferent traits\b/.test(q)) return true;
    if (/\bevolution\b/.test(q) && /\b(evaluate|study of alleles)\b/.test(q)) return true;
    if (/\bjustify why understanding alleles is essential\b/.test(q)) return true;
  }
  if (title.includes("dna structure")) {
    if (/\berrors in dna replication\b/.test(q) || /\bsuggest how errors\b.*\breplication\b/.test(q)) {
      return true;
    }
    if (/\bjustify the role of dna in inheritance\b/.test(q)) return true;
  }
  return false;
}

function wouldConceptuallyDuplicate(candidate, selected) {
  return selected.some((s) => assessConceptualOverlap(s.question, candidate.question).severity === "HIGH");
}

function classifyAttachments(audit, boundary) {
  const duplicatePairs = [];
  const supported = audit.attachments.filter((a) => a.supported && a.type === "short");
  const classified = audit.attachments.map((att) => {
    let selection = SELECTION.REVIEW_FOR_RETAIN;
    let note = "";

    if (!att.supported) {
      selection = SELECTION.DETACH_UNSUPPORTED;
      note = att.unsupportedReason || "Unsupported Block 28 type";
    } else if (isOutOfScope(att.question, boundary)) {
      selection = SELECTION.REJECT_CONTENT;
      note = "Question appears outside lesson scope";
    } else if (!String(att.question || "").trim()) {
      selection = SELECTION.REJECT_CONTENT;
      note = "Empty question stem";
    } else {
      selection = SELECTION.REVIEW_FOR_RETAIN;
      note = "Candidate for final set";
    }

    return { ...att, selection, selectionNote: note };
  });

  for (let i = 0; i < supported.length; i++) {
    for (let j = i + 1; j < supported.length; j++) {
      const assessment = assessConceptualOverlap(supported[i].question, supported[j].question);
      if (assessment.severity !== "LOW") {
        duplicatePairs.push({
          a: supported[i].questionId,
          b: supported[j].questionId,
          similarity: assessment.similarity,
          severity: assessment.severity,
          reason: assessment.reason,
        });
      }
    }
  }

  const loserIds = new Set();
  for (const pair of duplicatePairs.filter((p) => p.severity === "HIGH")) {
    const attA = classified.find((c) => c.questionId === pair.a);
    const attB = classified.find((c) => c.questionId === pair.b);
    const scoreA = candidateTotalScore(attA, boundary);
    const scoreB = candidateTotalScore(attB, boundary);
    const loser = scoreA >= scoreB ? pair.b : pair.a;
    loserIds.add(loser);
  }

  for (const row of classified) {
    if (loserIds.has(row.questionId)) {
      row.selection = SELECTION.DETACH_DUPLICATE;
      row.selectionNote = "Conceptual duplicate — weaker duplicate detached";
    }
  }

  return { classified, duplicatePairs };
}

function proposeFinalSet(classified, boundary) {
  const candidates = classified
    .filter((a) => a.supported && a.type === "short")
    .filter((a) => a.selection !== SELECTION.DETACH_DUPLICATE && a.selection !== SELECTION.REJECT_CONTENT)
    .map((a) => ({
      ...a,
      totalScore: candidateTotalScore(a, boundary),
      objectiveScore: objectiveAlignmentScore(a.question, boundary),
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  const selected = [];
  const rankedForOverlap = candidates.slice(0, MAX_FINAL);

  for (const cand of candidates) {
    if (selected.length >= MAX_FINAL) break;
    if (wouldConceptuallyDuplicate(cand, selected)) continue;
    if (jaccardSimilarity(cand.question, selected.map((s) => s.question).join(" ")) > 0.85) continue;
    if ((isSimpleRecallStem(cand.question) || cand.marks === 1) && selected.length >= 7) continue;
    selected.push(cand);
    cand.selection = SELECTION.RETAIN;
    cand.selectionNote = "Selected for proposed final practice set";
  }

  for (const row of classified) {
    if (!row.supported) continue;
    if (row.selection === SELECTION.DETACH_DUPLICATE || row.selection === SELECTION.REJECT_CONTENT) continue;
    const inFinal = selected.some((s) => s.questionId === row.questionId);
    if (!inFinal) {
      row.selection = SELECTION.DETACH_EXCESS;
      row.selectionNote = "Supported but not in quality final set (excess or conceptual duplicate)";
    }
  }

  selected.sort((a, b) => {
    const recall = /^(define|state|name|give|identify|list|what is|where does|how many)\b/i;
    const aRecall = recall.test(a.question) ? 0 : 1;
    const bRecall = recall.test(b.question) ? 0 : 1;
    if (aRecall !== bRecall) return aRecall - bRecall;
    return b.totalScore - a.totalScore;
  });

  const result = selected.map((s, i) => ({ ...s, proposedStudentPosition: i + 1 }));
  const rankedOverlapPairs = [];
  for (let i = 0; i < rankedForOverlap.length; i++) {
    for (let j = i + 1; j < rankedForOverlap.length; j++) {
      const assessment = assessConceptualOverlap(rankedForOverlap[i].question, rankedForOverlap[j].question);
      if (assessment.severity !== "LOW") {
        rankedOverlapPairs.push({
          questionIdA: rankedForOverlap[i].questionId,
          questionIdB: rankedForOverlap[j].questionId,
          questionA: rankedForOverlap[i].question,
          questionB: rankedForOverlap[j].question,
          ...assessment,
        });
      }
    }
  }

  return {
    selected: result,
    rankedOverlapPairs,
    belowRecommendedSize: result.length < MIN_STRONG_SET,
    selectionNote:
      result.length < MAX_FINAL
        ? `Only ${result.length} strong non-duplicative questions supported — not padded to 10.`
        : null,
  };
}

function findRankedConceptualOverlaps(audit, boundary, limit = MAX_FINAL) {
  const ranked = audit.attachments
    .filter((a) => a.supported && a.type === "short")
    .map((a) => ({
      ...a,
      totalScore: candidateTotalScore(a, boundary),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit);

  const pairs = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const assessment = assessConceptualOverlap(ranked[i].question, ranked[j].question);
      if (assessment.severity !== "LOW") {
        pairs.push({
          questionIdA: ranked[i].questionId,
          questionIdB: ranked[j].questionId,
          questionA: ranked[i].question,
          questionB: ranked[j].question,
          ...assessment,
        });
      }
    }
  }
  return pairs;
}

module.exports = {
  SELECTION,
  MAX_FINAL,
  MIN_STRONG_SET,
  classifyAttachments,
  proposeFinalSet,
  findRankedConceptualOverlaps,
  curriculumOverlapScore,
  objectiveAlignmentScore,
  candidateTotalScore,
  qualityScore,
  wouldConceptuallyDuplicate,
};
