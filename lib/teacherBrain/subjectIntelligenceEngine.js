/**
 * Phase 4.0 — Subject Intelligence Engine (prompt-only + read-only scoring).
 * Orchestrates subject profile + concept archetype + assessment skill guidance.
 * Flag: TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1=1 (default OFF).
 */

const { resolveSubjectIntelligence } = require("./subjectIntelligenceResolver");
const { resolveTeachingQualityProfile } = require("./teachingQualityProfiles");
const { isTeacherFirstSs1Enabled } = require("./teacherFirstSs1Architecture");
const { getSs1BlockNumber } = require("./teacherFirstSs1Architecture");

const SUBJECT_INTELLIGENCE_MARKER = "SUBJECT INTELLIGENCE V1 (4.0):";

function isTeachingQualityUpgradeEnabled() {
  return String(process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE || "0").trim() === "1";
}

function isSubjectIntelligenceEnabled() {
  return (
    isTeacherFirstSs1Enabled() &&
    String(process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 || "0").trim() === "1"
  );
}

function isSubjectIntelligenceTeachingQualityEnabled() {
  return isSubjectIntelligenceEnabled() && isTeachingQualityUpgradeEnabled();
}

function hasTopicSpecificTeachingProfile(meta = {}) {
  return Boolean(resolveTeachingQualityProfile(meta));
}

function buildSubjectIntelligenceCoreSection(resolved) {
  const { subjectProfile, archetype, primarySkill, emphasisSkills } = resolved;

  const lines = [
    "--------------------------------",
    SUBJECT_INTELLIGENCE_MARKER,
    "--------------------------------",
    "",
    `SUBJECT: ${subjectProfile.label} (${resolved.subjectKey})`,
    `CONCEPT ARCHETYPE: ${archetype.label} (${resolved.archetypeKey})`,
    `PRIMARY ASSESSMENT SKILL: ${primarySkill.label} (${resolved.primarySkillKey})`,
    "",
    "LAYER 1 — SUBJECT INTELLIGENCE:",
    `- Explanation style: ${subjectProfile.explanationStyle}`,
    `- Common command words: ${subjectProfile.commandWords.join(", ")}`,
    `- Examiner language: ${subjectProfile.examinerLanguagePatterns.slice(0, 2).join(" ")}`,
    `- Common misconceptions to address: ${subjectProfile.commonMisconceptions.slice(0, 3).join("; ")}`,
    `- Typical diagrams: ${subjectProfile.typicalDiagrams.slice(0, 3).join("; ")}`,
    `- Assessment priorities: ${subjectProfile.assessmentPriorities.slice(0, 3).join("; ")}`,
    "",
    "LAYER 2 — CONCEPT ARCHETYPE:",
    `- Core model pattern: ${archetype.coreModelPattern}`,
    `- Progression: ${archetype.progressionSteps.join(" → ")}`,
    `- Reasoning template: ${archetype.reasoningTemplate}`,
    `- Archetype misconceptions: ${archetype.commonMisconceptions.slice(0, 2).join("; ")}`,
    "",
    "LAYER 3 — ASSESSMENT SKILLS:",
    ...emphasisSkills.map(
      (s) =>
        `- ${s.label}: ${s.examinerExpectation} (creditworthy: ${s.creditworthyPattern})`
    ),
    "",
    "QUALITY RULES:",
    "- Do NOT add, remove, or reorder SS1 blocks.",
    "- Apply subject + archetype guidance inside existing block purposes only.",
    "- Use causal connectives (because / therefore / leading to) in explain questions.",
    "- Address at least one listed misconception in Common Mistake or Exam Technique.",
  ];

  return lines.join("\n");
}

function buildSubjectIntelligencePromptSection(meta = {}) {
  if (!isSubjectIntelligenceEnabled()) return "";
  const resolved = resolveSubjectIntelligence(meta);
  return buildSubjectIntelligenceCoreSection(resolved);
}

function buildSubjectIntelligenceTeacherFirstSupplement(meta = {}) {
  if (!isSubjectIntelligenceEnabled()) return "";
  if (hasTopicSpecificTeachingProfile(meta)) return "";

  const resolved = resolveSubjectIntelligence(meta);
  const { subjectProfile, archetype } = resolved;

  const lines = [
    "",
    "LAYER 2 — SUBJECT INTELLIGENCE (no topic profile matched):",
    `Subject: ${subjectProfile.label}`,
    `Archetype: ${archetype.label}`,
    "",
    "Derive opening slots from subject + archetype (not placeholders):",
    `- Definition: precise GCSE ${subjectProfile.label} definition`,
    `- Core model: ${archetype.coreModelPattern}`,
    `- Key examples: 2–3 ${subjectProfile.label} examples from the sub-topic`,
    `- Exam vocabulary: use ${subjectProfile.commandWords.slice(0, 4).join(", ")} command words appropriately`,
    "",
    subjectProfile.explanationStyle,
  ];

  return lines.join("\n");
}

function buildSubjectIntelligenceReasoningFallback(meta = {}) {
  if (!isSubjectIntelligenceTeachingQualityEnabled()) return "";
  if (hasTopicSpecificTeachingProfile(meta)) return "";

  const resolved = resolveSubjectIntelligence(meta);
  const { archetype } = resolved;
  const coreModelBlock = getSs1BlockNumber("coreModel") || 6;
  const coreTeachingBlock = getSs1BlockNumber("coreTeaching") || 9;
  const workedExampleBlock = getSs1BlockNumber("workedExample") || 20;

  const lines = [
    "--------------------------------",
    "GCSE REASONING CHAIN — SUBJECT INTELLIGENCE FALLBACK (4.0):",
    "--------------------------------",
    "",
    `Archetype: ${archetype.label} — model this reasoning template:`,
    archetype.reasoningTemplate,
    "",
    "REQUIRED PLACEMENT:",
    `- Block ${coreModelBlock}: full chain using → or numbered steps (minimum 4).`,
    `- Block ${coreTeachingBlock}: Explain how… with mechanism → outcome.`,
    `- Block ${workedExampleBlock}: exam stem + numbered marking-point steps.`,
    "",
    `Progression to cover: ${archetype.progressionSteps.join(" → ")}`,
  ];

  return lines.join("\n");
}

function buildSubjectIntelligenceExaminerFallback(meta = {}) {
  if (!isSubjectIntelligenceTeachingQualityEnabled()) return "";
  if (hasTopicSpecificTeachingProfile(meta)) return "";

  const resolved = resolveSubjectIntelligence(meta);
  const { subjectProfile, primarySkill } = resolved;

  const lines = [
    "--------------------------------",
    "EXAMINER LANGUAGE V2 — SUBJECT INTELLIGENCE FALLBACK (4.0):",
    "--------------------------------",
    "",
    `Subject examiner style (${subjectProfile.label}):`,
    ...subjectProfile.examinerLanguagePatterns.map((p) => `- ${p}`),
    "",
    `Primary skill (${primarySkill.label}):`,
    `- Examiners expect: ${primarySkill.examinerExpectation}`,
    `- Students often write: ${primarySkill.studentsOftenWrite}`,
    `- Creditworthy pattern: ${primarySkill.creditworthyPattern}`,
    `- Mark-losing pattern: ${primarySkill.markLosingPattern}`,
    `- Use connectives: ${primarySkill.connectives.join(", ")}`,
  ];

  return lines.join("\n");
}

function buildSubjectIntelligenceGrade89Fallback(meta = {}) {
  if (!isSubjectIntelligenceTeachingQualityEnabled()) return "";
  if (hasTopicSpecificTeachingProfile(meta)) return "";

  const resolved = resolveSubjectIntelligence(meta);
  const higherOrder = resolved.emphasisSkills.find((s) => (s.cognitiveLevel || 0) >= 4) ||
    resolved.primarySkill;

  const lines = [
    "--------------------------------",
    "GRADE 8/9 CHALLENGE — SUBJECT INTELLIGENCE FALLBACK (4.0):",
    "--------------------------------",
    "",
    `Archetype: ${resolved.archetype.label}`,
    `Higher-order skill: ${higherOrder.label}`,
    "",
    "Include at least one Grade 8/9 stretch element:",
    "- Unfamiliar context applying the archetype reasoning template",
    `- ${higherOrder.commandWords.join("/")} command word in Exam Practice`,
    "- Evaluate or compare with evidence — not recall only",
    `- Address misconception: ${resolved.archetype.commonMisconceptions[0] || "vague definitions"}`,
  ];

  return lines.join("\n");
}

function buildSubjectIntelligenceCoreDisciplineFallback(meta = {}) {
  if (!isSubjectIntelligenceTeachingQualityEnabled()) return "";
  if (hasTopicSpecificTeachingProfile(meta)) return "";

  const resolved = resolveSubjectIntelligence(meta);
  const { archetype } = resolved;

  const progressionMap = {
    definition: archetype.progressionSteps[0] || "definition",
    coreModel: archetype.progressionSteps[1] || "core model",
    coreTeaching: archetype.progressionSteps[2] || "mechanism",
    workedExample: archetype.progressionSteps[3] || "application",
    examPractice: archetype.progressionSteps[4] || "evaluation",
    summary: "takeaway",
  };

  const lines = [
    "--------------------------------",
    "CORE LEARNING DISCIPLINE — SUBJECT INTELLIGENCE FALLBACK (4.0):",
    "--------------------------------",
    "",
    "RULE 1 — NO REPEATED DEFINITIONS: define once in Definition block only.",
    "RULE 2 — EXPLANATION PROGRESSION:",
    ...Object.entries(progressionMap).map(([block, role]) => `- ${block}: ${role}`),
    "RULE 3 — DIAGRAM COMPLEMENTARITY:",
    `- Caption diagrams for: ${archetype.typicalDiagrams.slice(0, 2).join("; ")}`,
    "RULE 4 — SUMMARY DISCIPLINE: exam takeaways only — no re-definition.",
    "RULE 5 — EXAM PRACTICE DISCIPLINE: match command word to assessment skill profile.",
  ];

  return lines.join("\n");
}

function buildSubjectIntelligenceWorkedReasoningFallback(meta = {}) {
  if (!isSubjectIntelligenceTeachingQualityEnabled()) return "";
  if (hasTopicSpecificTeachingProfile(meta)) return "";

  const resolved = resolveSubjectIntelligence(meta);
  const skill = resolved.primarySkill;

  const lines = [
    "--------------------------------",
    "WORKED REASONING V2 — SUBJECT INTELLIGENCE FALLBACK (4.0):",
    "--------------------------------",
    "",
    `Command word focus: ${skill.commandWords[0] || "explain"}`,
    `Reasoning template: ${resolved.archetype.reasoningTemplate}`,
    "",
    "Worked Example must show:",
    "- Question stem using the command word",
    "- Numbered steps with marking-point language",
    `- Connectives: ${skill.connectives.slice(0, 4).join(", ")}`,
    `- Avoid: ${skill.markLosingPattern}`,
  ];

  return lines.join("\n");
}

function scoreSubjectIntelligenceCoverage(text = "", meta = {}) {
  const resolved = resolveSubjectIntelligence(meta);
  const plain = String(text || "").toLowerCase();
  const subjectHits = resolved.subjectProfile.assessmentPriorities.filter((p) =>
    plain.includes(p.toLowerCase().slice(0, 12))
  ).length;
  const archetypeHits = resolved.archetype.progressionSteps.filter((s) =>
    plain.includes(s.toLowerCase().slice(0, 8))
  ).length;

  return {
    skipped: !isSubjectIntelligenceEnabled(),
    subjectKey: resolved.subjectKey,
    archetypeKey: resolved.archetypeKey,
    primarySkillKey: resolved.primarySkillKey,
    isFallback: resolved.isFallback,
    subjectSignal: subjectHits,
    archetypeSignal: archetypeHits,
    pass: isSubjectIntelligenceEnabled(),
  };
}

module.exports = {
  SUBJECT_INTELLIGENCE_MARKER,
  isSubjectIntelligenceEnabled,
  isSubjectIntelligenceTeachingQualityEnabled,
  hasTopicSpecificTeachingProfile,
  buildSubjectIntelligencePromptSection,
  buildSubjectIntelligenceTeacherFirstSupplement,
  buildSubjectIntelligenceReasoningFallback,
  buildSubjectIntelligenceExaminerFallback,
  buildSubjectIntelligenceGrade89Fallback,
  buildSubjectIntelligenceCoreDisciplineFallback,
  buildSubjectIntelligenceWorkedReasoningFallback,
  scoreSubjectIntelligenceCoverage,
  resolveSubjectIntelligence,
};
