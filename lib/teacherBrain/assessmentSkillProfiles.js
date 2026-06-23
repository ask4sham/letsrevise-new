/**
 * Phase 4.0 — Assessment Skill Profiles (cross-subject).
 * Reusable command-word and marking guidance for GCSE teaching quality engines.
 */

/** @typedef {object} AssessmentSkillProfile
 * @property {string} skillKey
 * @property {string} label
 * @property {string[]} commandWords
 * @property {string} examinerExpectation
 * @property {string} studentsOftenWrite
 * @property {string} creditworthyPattern
 * @property {string} markLosingPattern
 * @property {string[]} connectives
 * @property {number} [cognitiveLevel] 1=recall … 5=evaluate
 */

const RECALL = {
  skillKey: "recall",
  label: "Recall",
  commandWords: ["state", "name", "list", "identify", "give", "define"],
  examinerExpectation:
    "Precise terminology with no vague nouns. One mark per correct point unless the stem asks for a linked list.",
  studentsOftenWrite: '"It is important" or "It helps the body" without naming the term.',
  creditworthyPattern: "Named term + brief qualifier (e.g. 'Mitochondria — site of aerobic respiration').",
  markLosingPattern: "Synonyms that are not GCSE-approved (e.g. 'brain cell' for neurone).",
  connectives: ["is", "are", "called", "known as"],
  cognitiveLevel: 1,
};

const DESCRIBE = {
  skillKey: "describe",
  label: "Describe",
  commandWords: ["describe", "outline", "give an account of"],
  examinerExpectation:
    "What happens — sequence or features — without explaining why. Use observable features and order.",
  studentsOftenWrite: '"Because it needs energy" when the question only asks what happens.',
  creditworthyPattern: "Feature or step → next feature or step (no causal because unless asked).",
  markLosingPattern: "Mixing explain-language into a describe question.",
  connectives: ["first", "then", "next", "finally", "during", "when"],
  cognitiveLevel: 2,
};

const EXPLAIN = {
  skillKey: "explain",
  label: "Explain",
  commandWords: ["explain", "explain how", "explain why", "account for", "suggest why"],
  examinerExpectation:
    "Cause → mechanism → effect. Each step must link with because / therefore / leading to.",
  studentsOftenWrite: '"It happens because it needs to" without naming the mechanism.',
  creditworthyPattern: "Stimulus → process → outcome with causal connectives at each link.",
  markLosingPattern: "Bullet facts with no linking connectives.",
  connectives: ["because", "therefore", "leading to", "as a result", "so that", "this means"],
  cognitiveLevel: 3,
};

const COMPARE = {
  skillKey: "compare",
  label: "Compare",
  commandWords: ["compare", "contrast", "similarities and differences"],
  examinerExpectation:
    "Point-by-point comparison — state similarity AND difference for each feature, not two separate lists.",
  studentsOftenWrite: "Two unrelated paragraphs with no explicit comparison language.",
  creditworthyPattern: "Both X and Y … however … whereas … in contrast …",
  markLosingPattern: "Describing only one side or listing features without linking.",
  connectives: ["whereas", "however", "in contrast", "similarly", "both", "while"],
  cognitiveLevel: 4,
};

const EVALUATE = {
  skillKey: "evaluate",
  label: "Evaluate",
  commandWords: ["evaluate", "assess", "to what extent", "judge", "how far"],
  examinerExpectation:
    "Balanced argument + supported judgement. Weigh evidence on both sides before conclusion.",
  studentsOftenWrite: "One-sided opinion with no evidence or counter-argument.",
  creditworthyPattern: "On one hand … however … therefore the most convincing view is …",
  markLosingPattern: "Asserting without evidence or ignoring the counter-case.",
  connectives: ["however", "nevertheless", "on the other hand", "therefore", "overall"],
  cognitiveLevel: 5,
};

const ANALYSE = {
  skillKey: "analyse",
  label: "Analyse",
  commandWords: ["analyse", "analyze", "examine", "break down"],
  examinerExpectation:
    "Separate into parts, show relationships, identify patterns or causes within the material.",
  studentsOftenWrite: "Retelling content without breaking it into components.",
  creditworthyPattern: "Component → relationship → implication for the whole argument or system.",
  markLosingPattern: "Summary disguised as analysis.",
  connectives: ["this suggests", "this indicates", "as a result", "therefore", "leading to"],
  cognitiveLevel: 4,
};

const JUSTIFY = {
  skillKey: "justify",
  label: "Justify",
  commandWords: ["justify", "give reasons for", "support", "defend"],
  examinerExpectation: "Claim + evidence + link back to the claim. Reasons must be relevant and developed.",
  studentsOftenWrite: "Repeating the claim without new supporting evidence.",
  creditworthyPattern: "Decision because evidence X shows … which means …",
  markLosingPattern: "Unsupported assertion.",
  connectives: ["because", "since", "as shown by", "this demonstrates", "therefore"],
  cognitiveLevel: 4,
};

const CALCULATE = {
  skillKey: "calculate",
  label: "Calculate",
  commandWords: ["calculate", "work out", "find", "determine", "compute"],
  examinerExpectation:
    "Formula stated → substitution → working → unit. Show every step; do not skip to the answer.",
  studentsOftenWrite: "Answer only with no working or wrong unit.",
  creditworthyPattern: "Formula → substitute → rearrange → answer with correct unit and sf.",
  markLosingPattern: "Correct number, wrong unit or no working shown.",
  connectives: ["using", "substituting", "therefore", "so"],
  cognitiveLevel: 3,
};

const INTERPRET_DATA = {
  skillKey: "interpret-data",
  label: "Interpret Data",
  commandWords: ["interpret", "use the data", "refer to the graph", "from the table", "trends"],
  examinerExpectation:
    "Quote or describe the trend → link to the scientific or geographical concept → avoid inventing data.",
  studentsOftenWrite: "Describing the graph shape without linking to the concept.",
  creditworthyPattern: "The data shows … which indicates … because …",
  markLosingPattern: "Reading values incorrectly or extrapolating beyond the data.",
  connectives: ["the data shows", "this indicates", "therefore", "suggesting", "as shown by"],
  cognitiveLevel: 3,
};

const USE_EVIDENCE = {
  skillKey: "use-evidence",
  label: "Use Evidence",
  commandWords: ["use evidence", "support with evidence", "refer to", "using information"],
  examinerExpectation:
    "Select relevant evidence → explain how it supports the point → do not quote without explanation.",
  studentsOftenWrite: "Long quote with no explanation of relevance.",
  creditworthyPattern: "Evidence from … shows … which supports … because …",
  markLosingPattern: "Evidence listed but not linked to the argument.",
  connectives: ["this shows", "this supports", "as evidence", "demonstrates", "therefore"],
  cognitiveLevel: 4,
};

const SOURCE_ANALYSIS = {
  skillKey: "source-analysis",
  label: "Source Analysis",
  commandWords: ["how useful", "how reliable", "what can you learn", "evaluate the source"],
  examinerExpectation:
    "Content (what it says) + provenance (who/when/why) + contextual knowledge → balanced judgement.",
  studentsOftenWrite: "Only describing content with no provenance or context.",
  creditworthyPattern: "The source suggests … however its reliability is limited because …",
  markLosingPattern: "Dismissive judgement with no provenance analysis.",
  connectives: ["however", "although", "this suggests", "the provenance indicates", "therefore"],
  cognitiveLevel: 5,
};

const ESSAY_PLANNING = {
  skillKey: "essay-planning",
  label: "Essay Planning",
  commandWords: ["discuss", "examine", "explore", "write an essay"],
  examinerExpectation:
    "Thesis → themed paragraphs → counter-argument → conclusion. Each paragraph: point → evidence → link.",
  studentsOftenWrite: "Narrative chronology with no argument structure.",
  creditworthyPattern: "Introduction states line of argument → PEEL paragraphs → conclusion weighs evidence.",
  markLosingPattern: "Descriptive story with no evaluative conclusion.",
  connectives: ["furthermore", "however", "consequently", "in conclusion", "overall"],
  cognitiveLevel: 5,
};

const ALL_ASSESSMENT_SKILLS = [
  RECALL,
  DESCRIBE,
  EXPLAIN,
  COMPARE,
  EVALUATE,
  ANALYSE,
  JUSTIFY,
  CALCULATE,
  INTERPRET_DATA,
  USE_EVIDENCE,
  SOURCE_ANALYSIS,
  ESSAY_PLANNING,
];

const SKILLS_BY_KEY = Object.fromEntries(ALL_ASSESSMENT_SKILLS.map((s) => [s.skillKey, s]));

function getAssessmentSkillProfile(skillKey) {
  return SKILLS_BY_KEY[skillKey] || EXPLAIN;
}

function listAssessmentSkillKeys() {
  return ALL_ASSESSMENT_SKILLS.map((s) => s.skillKey);
}

module.exports = {
  RECALL,
  DESCRIBE,
  EXPLAIN,
  COMPARE,
  EVALUATE,
  ANALYSE,
  JUSTIFY,
  CALCULATE,
  INTERPRET_DATA,
  USE_EVIDENCE,
  SOURCE_ANALYSIS,
  ESSAY_PLANNING,
  ALL_ASSESSMENT_SKILLS,
  SKILLS_BY_KEY,
  getAssessmentSkillProfile,
  listAssessmentSkillKeys,
};
