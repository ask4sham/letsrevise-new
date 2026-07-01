/**
 * Assessment intent validator — rejects generic placeholders and educational duplicates.
 */
const { isGenericPlaceholderStem, questionsAreNearDuplicate } = require("../../lib/questionDeduplicationGuard");
const { SLOT_ORDER } = require("./assessmentJourneyPlanner");

const BANNED_OPTION_FRAGMENTS = [
  /precise cause\s*→\s*effect explanation linked to the topic/i,
  /unrelated process from another topic/i,
  /common misconception stated as if it were true/i,
  /vague name with no mechanism/i,
  /^option\s*[1-4]$/i,
];

const COMMAND_WORDS = /\b(describe|explain|compare|evaluate|analyse|analyze|state|suggest|calculate|label)\b/i;

function stripHtml(html = "") {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function blockText(block) {
  return [block?.prompt, block?.question, block?.content, block?.explanation, block?.answer]
    .filter(Boolean)
    .join(" ");
}

function containsBannedPlaceholder(text = "") {
  const plain = stripHtml(text);
  if (!plain) return false;
  if (isGenericPlaceholderStem(plain)) return true;
  if (/which option is most accurate/i.test(plain)) return true;
  return BANNED_OPTION_FRAGMENTS.some((re) => re.test(plain));
}

function hasTopicVocabulary(text, vocabulary = []) {
  if (!vocabulary.length) return true;
  const hay = stripHtml(text).toLowerCase();
  return vocabulary.some((v) => {
    const term = String(v).toLowerCase().trim();
    if (!term) return false;
    if (hay.includes(term)) return true;
    if (term.endsWith("s") && hay.includes(term.slice(0, -1))) return true;
    return false;
  });
}

function classifyBlockSlot(block) {
  const role = String(block?.role || "").toLowerCase();
  const type = String(block?.type || "").toLowerCase();
  if (type === "selfcheck") return "selfCheck";
  if (role === "quickcheck") return "quickCheck";
  if (role === "workedexample") return "workedExample";
  if (role === "exampractice" || /exam practice/i.test(block?.content || "")) return "examPractice";
  if (type === "checkpoint") return "checkpoint";
  return null;
}

function extractSlotsFromDraft(draft) {
  const slots = [];
  for (const page of draft?.pages || []) {
    for (const block of page?.blocks || []) {
      const slot = classifyBlockSlot(block);
      if (!slot) continue;
      const text = blockText(block);
      const isMcq =
        block?.questionType === "mcq" ||
        (Array.isArray(block?.options) && block.options.length >= 2);
      slots.push({
        slot,
        block,
        text,
        isMcq,
        skill: inferSkillFromBlock(block, slot),
        concept: normalizeConceptKey(text),
      });
    }
  }
  return slots;
}

function inferSkillFromBlock(block, slot) {
  const planSkill = {
    checkpoint: "recall",
    quickCheck: "explain",
    selfCheck: "apply",
    workedExample: "analyse",
    examPractice: "exam-style",
  }[slot];
  return planSkill;
}

function normalizeConceptKey(text) {
  return stripHtml(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

function validateAssessmentIntent(draft, opts = {}) {
  const plan = opts.plan || [];
  const vocabulary = opts.vocabulary || [];
  const misconceptions = opts.misconceptions || [];
  const issues = [];
  const slots = extractSlotsFromDraft(draft);

  for (const s of slots) {
    if (containsBannedPlaceholder(s.text)) {
      issues.push(`Generic placeholder in ${s.slot}: ${stripHtml(s.text).slice(0, 80)}`);
    }
    for (const opt of s.block?.options || []) {
      if (containsBannedPlaceholder(opt)) {
        issues.push(`Generic placeholder option in ${s.slot}`);
      }
    }
    if (!hasTopicVocabulary(s.text, vocabulary) && vocabulary.length > 0) {
      const miscHay = stripHtml(s.text).toLowerCase();
      const miscMatch = misconceptions.some((m) =>
        miscHay.includes(String(m).toLowerCase().split(" ")[0])
      );
      if (!(s.slot === "selfCheck" && miscMatch)) {
        issues.push(`${s.slot} lacks topic-specific vocabulary`);
      }
    }
  }

  const mcqCount = slots.filter((s) => s.isMcq).length;
  if (slots.length >= 3 && mcqCount === slots.length) {
    issues.push("All assessment blocks are MCQs — vary question types");
  }

  const selfCheck = slots.find((s) => s.slot === "selfCheck");
  const checkpoint = slots.find((s) => s.slot === "checkpoint");
  if (selfCheck && checkpoint) {
    if (
      selfCheck.isMcq &&
      checkpoint.isMcq &&
      questionsAreNearDuplicate(selfCheck.text, checkpoint.text)
    ) {
      issues.push("Self-check is just another checkpoint MCQ");
    }
    if (selfCheck.skill === checkpoint.skill && selfCheck.concept === checkpoint.concept) {
      issues.push("Self-check repeats same concept + skill as checkpoint");
    }
  }

  const exam = slots.find((s) => s.slot === "examPractice");
  if (exam) {
    const examText = stripHtml(exam.text);
    if (!COMMAND_WORDS.test(examText)) {
      issues.push("Exam practice lacks a command word");
    }
    if (!/\(\d+\s*marks?\)/i.test(examText) && !/\b\d+\s*marks?\b/i.test(examText)) {
      issues.push("Exam practice lacks marks");
    }
  }

  const worked = slots.find((s) => s.slot === "workedExample");
  if (worked) {
    const ans = stripHtml(worked.block?.answer || worked.block?.explanation || "");
    if (!ans || ans.length < 20) {
      issues.push("Worked example lacks a model answer");
    }
  }

  const pairs = slots.map((s) => `${s.concept}::${s.skill}`);
  const dupPairs = pairs.filter((p, i) => pairs.indexOf(p) !== i);
  if (dupPairs.length) {
    issues.push("Two assessment blocks share the same concept + skill pair");
  }

  if (plan.length) {
    for (const expected of SLOT_ORDER) {
      if (!slots.some((s) => s.slot === expected)) {
        issues.push(`Missing assessment slot: ${expected}`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    slotsPresent: slots.map((s) => s.slot),
    slotDetails: slots,
  };
}

function buildAssessmentValidatorFeedback(validation) {
  return (validation?.issues || []).map((issue) => `ASSESSMENT: ${issue}`);
}

module.exports = {
  validateAssessmentIntent,
  buildAssessmentValidatorFeedback,
  containsBannedPlaceholder,
  extractSlotsFromDraft,
};
