/**
 * Phase 4.0 — Subject Intelligence Architecture tests.
 */

const {
  resolveSubjectIntelligence,
  resolveSubjectKey,
  resolveArchetypeKey,
} = require("../lib/teacherBrain/subjectIntelligenceResolver");
const {
  buildSubjectIntelligencePromptSection,
  buildSubjectIntelligenceTeacherFirstSupplement,
  buildSubjectIntelligenceReasoningFallback,
  buildSubjectIntelligenceExaminerFallback,
  buildSubjectIntelligenceGrade89Fallback,
  buildSubjectIntelligenceCoreDisciplineFallback,
  isSubjectIntelligenceEnabled,
  SUBJECT_INTELLIGENCE_MARKER,
} = require("../lib/teacherBrain/subjectIntelligenceEngine");
const { resolveTeachingQualityProfile } = require("../lib/teacherBrain/teachingQualityProfiles");
const {
  buildTeachingQualityUpgradePromptSection,
} = require("../lib/teacherBrain/teachingQualityUpgrade");
const {
  buildTeacherFirstOpeningPlan,
  formatTeacherFirstOpeningAppendix,
} = require("../lib/teacherBrain/teacherFirstKnowledgeEngine");
const {
  buildExaminerLanguageV2PromptSection,
  EXAMINER_LANGUAGE_V2_MARKER,
} = require("../lib/teacherBrain/examinerLanguageV2Engine");
const {
  buildCoreLearningDisciplinePromptSection,
  CORE_LEARNING_DISCIPLINE_MARKER,
} = require("../lib/teacherBrain/coreLearningDisciplineEngine");
const {
  REQUIRED_PRACTICAL_MODE_VERSION,
} = require("../lib/teacherBrain/requiredPracticalMode");
const { listSubjectIntelligenceKeys } = require("../lib/teacherBrain/subjectIntelligenceProfiles");
const { listAssessmentSkillKeys } = require("../lib/teacherBrain/assessmentSkillProfiles");
const { ALL_ARCHETYPES } = require("../lib/teacherBrain/conceptArchetypes");

const SAMPLE_TOPICS = [
  { label: "Photosynthesis", subject: "biology", expectSubject: "biology", expectArchetype: "biology-process" },
  { label: "Respiration", subject: "biology", expectSubject: "biology", expectArchetype: "biology-process" },
  { label: "Enzymes", subject: "biology", expectSubject: "biology" },
  { label: "Genetics", subject: "biology", expectSubject: "biology", expectArchetype: "biology-inheritance" },
  { label: "Ecology", subject: "biology", expectSubject: "biology" },
  { label: "Atomic Structure", subject: "chemistry", expectSubject: "chemistry", expectArchetype: "chemistry-particle-model" },
  { label: "Bonding", subject: "chemistry", expectSubject: "chemistry" },
  { label: "Rates of Reaction", subject: "chemistry", expectSubject: "chemistry" },
  { label: "Electrolysis", subject: "chemistry", expectSubject: "chemistry" },
  { label: "Forces", subject: "physics", expectSubject: "physics", expectArchetype: "physics-force-system" },
  { label: "Energy", subject: "physics", expectSubject: "physics" },
  { label: "Waves", subject: "physics", expectSubject: "physics", expectArchetype: "physics-wave" },
  { label: "Electricity", subject: "physics", expectSubject: "physics", expectArchetype: "physics-circuit" },
  { label: "Algebra", subject: "maths", expectSubject: "maths", expectArchetype: "maths-algebra" },
  { label: "Graphs", subject: "maths", expectSubject: "maths", expectArchetype: "maths-graph" },
  { label: "Probability", subject: "maths", expectSubject: "maths", expectArchetype: "maths-probability" },
  { label: "Simultaneous Equations", subject: "maths", expectSubject: "maths", expectArchetype: "maths-simultaneous" },
  { label: "Quadratics", subject: "maths", expectSubject: "maths", expectArchetype: "maths-quadratics" },
  { label: "Ratio", subject: "maths", expectSubject: "maths", expectArchetype: "maths-ratio" },
  { label: "Trigonometry", subject: "maths", expectSubject: "maths", expectArchetype: "maths-trigonometry" },
  { label: "Causes of WW1", subject: "history", expectSubject: "history", expectArchetype: "history-cause" },
  { label: "Treaty of Versailles", subject: "history", expectSubject: "history", expectArchetype: "history-consequence" },
  { label: "Medicine Through Time", subject: "history", expectSubject: "history", expectArchetype: "history-change" },
  { label: "Rivers", subject: "geography", expectSubject: "geography", expectArchetype: "geography-physical-process" },
  { label: "Coasts", subject: "geography", expectSubject: "geography" },
  { label: "Urbanisation", subject: "geography", expectSubject: "geography", expectArchetype: "geography-human-process" },
  { label: "Climate Change", subject: "geography", expectSubject: "geography" },
  { label: "Macbeth", subject: "english", expectSubject: "english", expectArchetype: "english-text-analysis" },
  { label: "Unseen Poetry", subject: "english", expectSubject: "english" },
  { label: "Persuasive Writing", subject: "english", expectSubject: "english", expectArchetype: "english-writing-technique" },
  { label: "Algorithms", subject: "computer-science", expectSubject: "computer-science", expectArchetype: "cs-algorithm" },
  { label: "Binary", subject: "computer-science", expectSubject: "computer-science", expectArchetype: "cs-binary" },
  { label: "Networks", subject: "computer-science", expectSubject: "computer-science", expectArchetype: "cs-network" },
  { label: "Marketing Mix", subject: "business", expectSubject: "business", expectArchetype: "business-marketing" },
  { label: "Cash Flow", subject: "business", expectSubject: "business", expectArchetype: "business-finance" },
  { label: "Supply and Demand", subject: "economics", expectSubject: "economics", expectArchetype: "economics-supply-demand" },
  { label: "Inflation", subject: "economics", expectSubject: "economics", expectArchetype: "economics-macro" },
];

describe("Phase 4.0 — Subject Intelligence Architecture", () => {
  const envKeys = [
    "TEACHER_BRAIN_TEACHER_FIRST_OPENING",
    "TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1",
    "TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE",
    "TEACHER_BRAIN_EXAMINER_LANGUAGE_V2",
    "TEACHER_BRAIN_GRADE89_CHALLENGE_V1",
    "TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1",
    "TEACHER_BRAIN_WORKED_REASONING_V2",
  ];
  const prev = {};

  beforeEach(() => {
    for (const k of envKeys) prev[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  test("disabled by default — no appendix change", () => {
    delete process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1;
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    expect(isSubjectIntelligenceEnabled()).toBe(false);
    expect(buildSubjectIntelligencePromptSection({ topic: "Photosynthesis", subject: "biology" })).toBe(
      ""
    );
  });

  test("10 subject profiles registered", () => {
    expect(listSubjectIntelligenceKeys()).toHaveLength(10);
    expect(listSubjectIntelligenceKeys()).toEqual(
      expect.arrayContaining([
        "biology",
        "chemistry",
        "physics",
        "maths",
        "history",
        "geography",
        "english",
        "computer-science",
        "business",
        "economics",
      ])
    );
  });

  test("12 assessment skills registered", () => {
    expect(listAssessmentSkillKeys()).toHaveLength(12);
  });

  test("archetypes include generic fallback", () => {
    expect(ALL_ARCHETYPES.some((a) => a.archetypeKey === "generic-concept")).toBe(true);
  });

  test.each(SAMPLE_TOPICS)(
    "resolver: $label ($subject)",
    ({ label, subject, expectSubject, expectArchetype }) => {
      const resolved = resolveSubjectIntelligence({ topic: label, subject });
      expect(resolved.subjectKey).toBe(expectSubject);
      expect(resolved.subjectProfile).toBeTruthy();
      expect(resolved.archetypeKey).toBeTruthy();
      expect(resolved.archetype).toBeTruthy();
      expect(resolved.primarySkillKey).toBeTruthy();
      expect(resolved.primarySkill).toBeTruthy();
      expect(resolved.emphasisSkillKeys.length).toBeGreaterThan(0);
      expect(resolved.emphasisSkills.length).toBeGreaterThan(0);
      if (expectArchetype) {
        expect(resolved.archetypeKey).toBe(expectArchetype);
      }
    }
  );

  test("empty meta still resolves — never null", () => {
    const resolved = resolveSubjectIntelligence({});
    expect(resolved.subjectKey).toBe("general");
    expect(resolved.archetypeKey).toBeTruthy();
    expect(resolved.primarySkillKey).toBeTruthy();
  });

  test("appendix never empty when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";

    for (const sample of SAMPLE_TOPICS) {
      const section = buildSubjectIntelligencePromptSection({
        topic: sample.label,
        subject: sample.subject,
      });
      expect(section.length).toBeGreaterThan(100);
      expect(section).toMatch(SUBJECT_INTELLIGENCE_MARKER);
    }
  });

  test("quality engine fallbacks never empty when flags on (non-topic-profile topics)", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";
    process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";
    process.env.TEACHER_BRAIN_GRADE89_CHALLENGE_V1 = "1";
    process.env.TEACHER_BRAIN_CORE_LEARNING_DISCIPLINE_V1 = "1";
    process.env.TEACHER_BRAIN_WORKED_REASONING_V2 = "1";

    const meta = { topic: "Photosynthesis", subject: "biology" };
    expect(buildSubjectIntelligenceReasoningFallback(meta).length).toBeGreaterThan(50);
    expect(buildSubjectIntelligenceExaminerFallback(meta).length).toBeGreaterThan(50);
    expect(buildSubjectIntelligenceGrade89Fallback(meta).length).toBeGreaterThan(50);
    expect(buildSubjectIntelligenceCoreDisciplineFallback(meta).length).toBeGreaterThan(50);
    expect(buildExaminerLanguageV2PromptSection(meta).length).toBeGreaterThan(50);
    expect(buildCoreLearningDisciplinePromptSection(meta).length).toBeGreaterThan(50);
  });

  test("existing Biology topic profiles take precedence over fallbacks", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";
    process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2 = "1";

    const meta = { topic: "Homeostasis" };
    expect(resolveTeachingQualityProfile(meta)?.taxonomyKey).toBe("homeostasis");

    const examiner = buildExaminerLanguageV2PromptSection(meta);
    expect(examiner).toMatch(EXAMINER_LANGUAGE_V2_MARKER);
    expect(examiner).toMatch(/thermoreceptor/i);
    expect(examiner).not.toMatch(/SUBJECT INTELLIGENCE FALLBACK/);
  });

  test("Teacher-First supplement only when no topic profile", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";

    const noProfilePlan = buildTeacherFirstOpeningPlan({
      topic: "Photosynthesis",
      subject: "biology",
    });
    expect(noProfilePlan.usesUniversalFrameworkOnly).toBe(true);
    const noProfileAppendix = formatTeacherFirstOpeningAppendix(noProfilePlan);
    expect(noProfileAppendix).toMatch(/SUBJECT INTELLIGENCE/);

    const profilePlan = buildTeacherFirstOpeningPlan({ topic: "Homeostasis", subject: "biology" });
    expect(profilePlan.topicProfile).toBeTruthy();
    const profileAppendix = formatTeacherFirstOpeningAppendix(profilePlan);
    expect(profileAppendix).not.toMatch(/SUBJECT INTELLIGENCE \(no topic profile/);
  });

  test("Required Practical mode unchanged — version stable", () => {
    expect(REQUIRED_PRACTICAL_MODE_VERSION).toBeTruthy();
  });

  test("teaching quality upgrade includes subject intelligence when flag on", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";

    const section = buildTeachingQualityUpgradePromptSection({
      topic: "Atomic Structure",
      subject: "chemistry",
    });
    expect(section).toMatch(SUBJECT_INTELLIGENCE_MARKER);
  });

  test("flags off — teaching quality unchanged for Photosynthesis", () => {
    delete process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1;
    delete process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE;
    delete process.env.TEACHER_BRAIN_EXAMINER_LANGUAGE_V2;

    expect(buildExaminerLanguageV2PromptSection({ topic: "Photosynthesis" })).toBe("");
    expect(buildSubjectIntelligencePromptSection({ topic: "Photosynthesis" })).toBe("");
  });

  test("inferred subject from topic keywords when subject omitted", () => {
    expect(resolveSubjectKey({}, "Photosynthesis light chloroplast")).toBe("biology");
    expect(resolveSubjectKey({}, "Supply and Demand equilibrium price")).toBe("economics");
    expect(resolveArchetypeKey("physics", "Forces Newton motion", {})).toBe("physics-force-system");
  });

  test("Phase 4.2 — maths archetypes include methodology chain in appendix", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";

    const section = buildSubjectIntelligencePromptSection({
      topic: "Simultaneous Equations",
      subject: "maths",
    });
    expect(section).toMatch(/ARCHETYPE METHODOLOGY \(4\.2\)/);
    expect(section).toMatch(/Examiner Method Marks/);
    expect(section).toMatch(/Method → show every step of working/);
  });

  test("Phase 4.2 — history consequence and significance frameworks", () => {
    process.env.TEACHER_BRAIN_TEACHER_FIRST_OPENING = "1";
    process.env.TEACHER_BRAIN_SUBJECT_INTELLIGENCE_V1 = "1";
    process.env.TEACHER_BRAIN_TEACHING_QUALITY_UPGRADE = "1";

    const consequence = buildSubjectIntelligenceReasoningFallback({
      topic: "Treaty of Versailles",
      subject: "history",
    });
    expect(consequence).toMatch(/Short-term impact/);
    expect(consequence).toMatch(/Long-term impact/);

    const significance = buildSubjectIntelligenceReasoningFallback({
      topic: "Significance of the Holocaust",
      subject: "history",
    });
    expect(significance).toMatch(/Importance at the time/);
    expect(significance).toMatch(/Overall significance/);
  });
});
