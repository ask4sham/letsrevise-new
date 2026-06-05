/**
 * Phase 3E — concept priority engine unit tests.
 */

const {
  isPriorityEngineEnabled,
  getPriorityTier,
  scoreConceptPriority,
  sortConceptsByPriority,
  pickHighestPriorityConceptId,
  formatConceptPriorityAppendix,
  buildConceptPriorityDistribution,
  filterForbiddenFromPriorityCandidates,
} = require("../lib/teacherBrain/conceptPriorityEngine");
const { resolveConceptPriorityProfile } = require("../lib/teacherBrain/conceptPriorityProfiles");
const { resolveSubTopicProfile } = require("../lib/teacherBrain/subTopicProfiles");
const { classifyConcept } = require("../lib/teacherBrain/subTopicBoundaryGuard");

const STRUCTURE_INPUT = {
  topicKey: "aqa-gcse-biology:nervous-system-structure",
  subTopic: "Structure and function of the nervous system",
};

describe("conceptPriorityEngine (Phase 3E)", () => {
  const prevPriority = process.env.TEACHER_BRAIN_PRIORITY_ENGINE;
  const prevBoundary = process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;

  afterEach(() => {
    if (prevPriority === undefined) delete process.env.TEACHER_BRAIN_PRIORITY_ENGINE;
    else process.env.TEACHER_BRAIN_PRIORITY_ENGINE = prevPriority;
    if (prevBoundary === undefined) delete process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY;
    else process.env.TEACHER_BRAIN_SUBTOPIC_BOUNDARY = prevBoundary;
  });

  test("engine off by default", () => {
    delete process.env.TEACHER_BRAIN_PRIORITY_ENGINE;
    expect(isPriorityEngineEnabled()).toBe(false);
    expect(formatConceptPriorityAppendix(resolveConceptPriorityProfile(STRUCTURE_INPUT))).toBe("");
  });

  test("Tier 1 concepts rank above Tier 2", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    const profile = resolveConceptPriorityProfile(STRUCTURE_INPUT);
    const sorted = sortConceptsByPriority(
      [
        { id: "cns", taughtCount: 0, testedCount: 0 },
        { id: "myelin_sheath", taughtCount: 2, testedCount: 2 },
        { id: "axons", taughtCount: 1, testedCount: 1 },
      ],
      profile
    );
    expect(getPriorityTier(sorted[0].id, profile)).toBe(1);
    expect(getPriorityTier(sorted[1].id, profile)).toBeLessThanOrEqual(2);
    expect(scoreConceptPriority("myelin_sheath", profile)).toBeLessThan(
      scoreConceptPriority("cns", profile)
    );
  });

  test("Tier 2 ranks above Tier 4", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    const profile = resolveConceptPriorityProfile(STRUCTURE_INPUT);
    expect(getPriorityTier("cns", profile)).toBe(2);
    expect(getPriorityTier("reflex_arc", profile)).toBe(4);
    expect(scoreConceptPriority("cns", profile)).toBeLessThan(
      scoreConceptPriority("reflex_arc", profile)
    );
  });

  test("forbidden concepts never gain priority boost", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    const subProfile = resolveSubTopicProfile(STRUCTURE_INPUT);
    const filtered = filterForbiddenFromPriorityCandidates(
      ["myelin_sheath", "thermoregulation", "reflex_arc_pathway"],
      subProfile
    );
    expect(filtered).not.toContain("thermoregulation");
    expect(filtered).not.toContain("reflex_arc_pathway");
    expect(classifyConcept("thermoregulation", subProfile)).toBe("forbidden");
  });

  test("pickHighestPriorityConceptId prefers tier 1", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    const priorityProfile = resolveConceptPriorityProfile(STRUCTURE_INPUT);
    const pick = pickHighestPriorityConceptId(
      ["impulse_transmission", "dendrites", "cns"],
      priorityProfile
    );
    expect(pick).toBe("dendrites");
    expect(getPriorityTier(pick, priorityProfile)).toBe(1);
  });

  test("formatConceptPriorityAppendix includes marker and tier 1 concepts", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    const text = formatConceptPriorityAppendix(resolveConceptPriorityProfile(STRUCTURE_INPUT));
    expect(text).toMatch(/CONCEPT PRIORITY/);
    expect(text).toMatch(/myelin|neurone structure|axon/i);
  });

  test("buildConceptPriorityDistribution flags underrepresented tier 1", () => {
    process.env.TEACHER_BRAIN_PRIORITY_ENGINE = "1";
    const priorityProfile = resolveConceptPriorityProfile(STRUCTURE_INPUT);
    const dist = buildConceptPriorityDistribution({
      priorityProfile,
      coverageMap: {
        concepts: [
          { id: "cns", name: "CNS", taughtCount: 2, testedCount: 1 },
          { id: "pns", name: "PNS", taughtCount: 1, testedCount: 1 },
          { id: "myelin_sheath", name: "Myelin", taughtCount: 0, testedCount: 0 },
        ],
      },
    });
    expect(dist.enabled).toBe(true);
    expect(dist.underrepresented.some((u) => /myelin/i.test(u.name))).toBe(true);
  });
});
