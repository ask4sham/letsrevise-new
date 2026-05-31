/**
 * Isolated GCSE topic profiles for Teacher Brain (Phase 1 — analysis only).
 * Self-contained; does not import V2/V3/V4.
 */

const METABOLISM_PROFILE = {
  topicKey: "metabolism",
  patterns: [/metabolism/i, /catabolism/i, /anabolism/i, /deamination/i, /atp.*metabol/i],
  coreConcepts: [
    {
      id: "metabolism",
      name: "Metabolism",
      importance: "critical",
      teachingOrder: 1,
      summary: "All enzyme-controlled reactions in cells — breakdown and build-up.",
      examPhrase: "enzyme-controlled reactions in a cell or body",
      linksTo: ["catabolism", "anabolism"],
    },
    {
      id: "catabolism",
      name: "Catabolism",
      importance: "high",
      teachingOrder: 2,
      summary: "Breaks larger molecules into smaller ones; often releases usable energy.",
      examPhrase: "breaks down molecules",
      linksTo: ["respiration_link", "atp"],
    },
    {
      id: "anabolism",
      name: "Anabolism",
      importance: "high",
      teachingOrder: 3,
      summary: "Builds larger molecules from smaller ones; requires energy input.",
      examPhrase: "builds larger molecules",
      linksTo: ["atp", "proteins_lipids"],
    },
    {
      id: "atp",
      name: "ATP",
      importance: "critical",
      teachingOrder: 4,
      summary: "Immediate energy currency — energy transferred to ATP, not 'made' as energy.",
      examPhrase: "transfers energy to ATP",
      linksTo: ["respiration_link", "anabolism"],
    },
    {
      id: "respiration_link",
      name: "Respiration (energy transfer)",
      importance: "high",
      teachingOrder: 5,
      summary: "Transfers energy from glucose to ATP; links catabolism to cell work.",
      examPhrase: "transfers energy from glucose to ATP",
      linksTo: ["atp", "catabolism"],
    },
    {
      id: "proteins_lipids",
      name: "Proteins and lipids in metabolism",
      importance: "medium",
      teachingOrder: 6,
      summary: "Excess amino acids and lipids enter metabolic pathways.",
      examPhrase: "excess amino acids / lipids",
      linksTo: ["deamination_urea", "anabolism"],
    },
    {
      id: "deamination_urea",
      name: "Deamination and urea",
      importance: "high",
      teachingOrder: 7,
      summary: "Toxic ammonia converted to urea for excretion — HT emphasis.",
      examPhrase: "deamination produces urea",
      linksTo: ["proteins_lipids"],
    },
  ],
  lessonChain: "Glucose → respiration → ATP → anabolic reactions → protein synthesis → growth",
};

const GENERIC_BIOLOGY_PROFILE = {
  topicKey: "generic_biology",
  patterns: [/.*/],
  coreConcepts: [
    {
      id: "core_idea",
      name: "Core topic idea",
      importance: "critical",
      teachingOrder: 1,
      summary: "Central specification concept for this topic.",
      examPhrase: "precise AQA terminology",
      linksTo: [],
    },
  ],
  lessonChain: "Prior knowledge → core idea → application → exam practice",
};

const PROFILES = [METABOLISM_PROFILE, GENERIC_BIOLOGY_PROFILE];

function resolveTopicProfile(input = {}) {
  const topic = String(input.topic || "").trim();
  for (const profile of PROFILES) {
    if (profile.patterns.some((re) => re.test(topic))) {
      return { ...profile, matchedTopic: topic };
    }
  }
  return { ...GENERIC_BIOLOGY_PROFILE, matchedTopic: topic };
}

module.exports = {
  METABOLISM_PROFILE,
  resolveTopicProfile,
};
