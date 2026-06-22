/**
 * Phase 4.0 — Subject Intelligence Profiles (Layer 1).
 * Subject-level teaching and assessment defaults for all GCSE subjects.
 */

/** @typedef {object} SubjectIntelligenceProfile
 * @property {string} subjectKey
 * @property {string} label
 * @property {RegExp[]} matchPatterns
 * @property {string} explanationStyle
 * @property {string[]} commandWords
 * @property {string[]} examinerLanguagePatterns
 * @property {string[]} commonMisconceptions
 * @property {string[]} typicalDiagrams
 * @property {string[]} questionTypes
 * @property {string[]} assessmentPriorities
 * @property {string[]} defaultArchetypeKeys
 * @property {string[]} defaultAssessmentSkills
 */

const BIOLOGY = {
  subjectKey: "biology",
  label: "Biology",
  matchPatterns: [
    /biology/i,
    /bio\b/i,
    /photosynthesis/i,
    /respiration/i,
    /enzyme/i,
    /genetic/i,
    /ecology/i,
    /cell/i,
    /organism/i,
    /homeostasis/i,
    /nervous system/i,
  ],
  explanationStyle:
    "Mechanism-first GCSE biology: name structures, state function, link cause → effect with because/therefore. Use precise scientific vocabulary.",
  commandWords: ["describe", "explain", "compare", "evaluate", "suggest", "calculate"],
  examinerLanguagePatterns: [
    "Use named structures and processes — not vague 'the body'.",
    "Link each step: receptor → coordination centre → effector where relevant.",
    "Credit is lost for missing mechanism between stimulus and response.",
    "Use data from graphs/tables when present — do not invent values.",
  ],
  commonMisconceptions: [
    "Confusing aerobic and anaerobic respiration products",
    "Active transport vs diffusion",
    "Mixing genotype and phenotype",
    "Brain as vague controller instead of named coordination centre",
  ],
  typicalDiagrams: [
    "labelled biological diagrams",
    "pathway/process flow",
    "graph of rate vs factor",
    "cross-section of exchange surface",
  ],
  questionTypes: [
    "6-mark explain how",
    "4-mark describe",
    "data interpretation from graph",
    "required practical evaluation",
  ],
  assessmentPriorities: [
    "Mechanism chains with causal connectives",
    "Named structures and functions",
    "Application to unfamiliar contexts",
    "Practical method and variables",
  ],
  defaultArchetypeKeys: ["biology-process", "biology-control-system"],
  defaultAssessmentSkills: ["describe", "explain", "interpret-data"],
};

const CHEMISTRY = {
  subjectKey: "chemistry",
  label: "Chemistry",
  matchPatterns: [
    /chemistry/i,
    /chem\b/i,
    /atomic structure/i,
    /bonding/i,
    /electrolysis/i,
    /rate of reaction/i,
    /mole/i,
    /acid/i,
    /alkali/i,
  ],
  explanationStyle:
    "Particle-level explanation linked to macroscopic observation. State equations, conditions, and energy changes explicitly.",
  commandWords: ["describe", "explain", "calculate", "compare", "evaluate", "predict"],
  examinerLanguagePatterns: [
    "Balance symbol equations where required.",
    "Link particle behaviour to bulk properties.",
    "Show working in all calculations with units.",
    "State conditions (temperature, catalyst, concentration) when explaining rate.",
  ],
  commonMisconceptions: [
    "Ionic vs covalent bonding confusion",
    "Mass lost in reactions (conservation of mass)",
    "Catalyst consumed in reaction",
    "Electrode products swapped in electrolysis",
  ],
  typicalDiagrams: [
    "dot-and-cross diagrams",
    "electrolysis cell",
    "energy profile",
    "rate graph",
  ],
  questionTypes: [
    "explain bonding",
    "calculate moles/concentration",
    "describe preparation method",
    "evaluate industrial process",
  ],
  assessmentPriorities: [
    "Particle model linked to properties",
    "Correct equations and units",
    "Structured practical answers",
    "Application of Le Chatelier/industrial conditions",
  ],
  defaultArchetypeKeys: ["chemistry-reaction", "chemistry-particle-model"],
  defaultAssessmentSkills: ["explain", "calculate", "describe"],
};

const PHYSICS = {
  subjectKey: "physics",
  label: "Physics",
  matchPatterns: [
    /physics/i,
    /force/i,
    /energy/i,
    /wave/i,
    /electricity/i,
    /circuit/i,
    /magnet/i,
    /radioactivity/i,
  ],
  explanationStyle:
    "Quantitative where possible: define quantity, unit, formula, substitute, interpret. Link physical principle to observation.",
  commandWords: ["describe", "explain", "calculate", "compare", "evaluate", "suggest"],
  examinerLanguagePatterns: [
    "Use SI units and show formula before substitution.",
    "Free-body diagrams for forces where appropriate.",
    "Distinguish scalar and vector quantities.",
    "Link graph gradient/area to physical meaning.",
  ],
  commonMisconceptions: [
    "Current used up in circuit",
    "Heavier objects fall faster",
    "Confusion of speed, velocity, acceleration",
    "Voltage and current conflated",
  ],
  typicalDiagrams: [
    "circuit diagram",
    "free-body diagram",
    "wave diagram",
    "Sankey diagram",
  ],
  questionTypes: [
    "multi-step calculation",
    "explain using physics principle",
    "graph interpretation",
    "required practical analysis",
  ],
  assessmentPriorities: [
    "Correct formulae and units",
    "Principle → application chain",
    "Graph skills",
    "Practical data analysis",
  ],
  defaultArchetypeKeys: ["physics-force-system", "physics-energy-transfer"],
  defaultAssessmentSkills: ["calculate", "explain", "interpret-data"],
};

const MATHS = {
  subjectKey: "maths",
  label: "Maths",
  matchPatterns: [
    /maths/i,
    /mathematics/i,
    /algebra/i,
    /graph/i,
    /probability/i,
    /statistic/i,
    /geometry/i,
    /trigonometry/i,
  ],
  explanationStyle:
    "Method-first: identify problem type, show clear working line-by-line, state final answer with appropriate accuracy.",
  commandWords: ["calculate", "solve", "show that", "prove", "interpret", "compare"],
  examinerLanguagePatterns: [
    "Every step of working must be visible.",
    "Final answer in required form (standard form, significant figures).",
    "Geometric reasoning must state theorems/properties used.",
    "Interpret answers in context for word problems.",
  ],
  commonMisconceptions: [
    "Sign errors in algebra",
    "Probability sum ≠ 1",
    "Gradient as Δy only",
    "Mean used when median appropriate",
  ],
  typicalDiagrams: [
    "coordinate grid",
    "tree diagram",
    "histogram/box plot",
    "annotated geometric figure",
  ],
  questionTypes: [
    "multi-step calculation",
    "show that / proof",
    "graph interpretation",
    "probability problem",
  ],
  assessmentPriorities: [
    "Clear logical working",
    "Correct notation and accuracy",
    "Interpretation in context",
    "Method marks for partial progress",
  ],
  defaultArchetypeKeys: ["maths-procedure", "maths-graph"],
  defaultAssessmentSkills: ["calculate", "explain", "interpret-data"],
};

const HISTORY = {
  subjectKey: "history",
  label: "History",
  matchPatterns: [
    /history/i,
    /world war/i,
    /treaty/i,
    /versailles/i,
    /medicine through time/i,
    /causes of/i,
    /nazi/i,
    /cold war/i,
  ],
  explanationStyle:
    "Argument-driven narrative: point → evidence → explanation. Distinguish long-term/short-term/trigger for causes.",
  commandWords: ["explain", "describe", "evaluate", "assess", "how useful", "compare"],
  examinerLanguagePatterns: [
    "Support every claim with specific evidence (date, event, statistic).",
    "Analyse sources: content + provenance + context.",
    "Evaluate — do not just describe both sides.",
    "Use historical terminology accurately.",
  ],
  commonMisconceptions: [
    "Single-cause explanations",
    "Retelling narrative without analysis",
    "Source content only — no provenance",
    "Presentism — judging past by today's values uncritically",
  ],
  typicalDiagrams: ["timeline", "causation web", "comparison table"],
  questionTypes: [
    "explain causes",
    "consequence essay",
    "source analysis",
    " significance judgement",
  ],
  assessmentPriorities: [
    "Evidence-based argument",
    "Categorised causes/consequences",
    "Source provenance analysis",
    "Evaluative conclusion",
  ],
  defaultArchetypeKeys: ["history-cause", "history-consequence"],
  defaultAssessmentSkills: ["explain", "use-evidence", "evaluate"],
};

const GEOGRAPHY = {
  subjectKey: "geography",
  label: "Geography",
  matchPatterns: [
    /geography/i,
    /river/i,
    /coast/i,
    /urban/i,
    /climate/i,
    /tectonic/i,
    /development/i,
    /globalisation/i,
  ],
  explanationStyle:
    "Process → landform/pattern → human impact. Always include named place or data where appropriate.",
  commandWords: ["describe", "explain", "evaluate", "assess", "compare", "suggest"],
  examinerLanguagePatterns: [
    "Name processes and link to landforms or spatial patterns.",
    "Use case study facts — location, data, named example.",
    "Refer to figures — describe trend then explain.",
    "Evaluate sustainability across environmental, economic, social.",
  ],
  commonMisconceptions: [
    "Generic case studies without named places",
    "Weather vs climate confusion",
    "Description without explanation",
    "Single-factor explanations of complex issues",
  ],
  typicalDiagrams: [
    "cross-profile diagram",
    "choropleth map",
    "graph with trend",
    "DTM/stage model",
  ],
  questionTypes: [
    "explain physical process",
    "case study question",
    "data response",
    "decision-making evaluation",
  ],
  assessmentPriorities: [
    "Named examples with data",
    "Process-mechanism links",
    "Balanced evaluation",
    "Figure interpretation",
  ],
  defaultArchetypeKeys: ["geography-physical-process", "geography-case-study"],
  defaultAssessmentSkills: ["explain", "evaluate", "interpret-data"],
};

const ENGLISH = {
  subjectKey: "english",
  label: "English",
  matchPatterns: [
    /english/i,
    /macbeth/i,
    /poetry/i,
    /unseen/i,
    /persuasive/i,
    /writing/i,
    /shakespeare/i,
    /literature/i,
  ],
  explanationStyle:
    "PEEL structure: point → evidence (embedded quote) → analysis of method → link to question/theme.",
  commandWords: ["analyse", "compare", "evaluate", "explain", "discuss"],
  examinerLanguagePatterns: [
    "Embed short quotations — do not drop quotes without analysis.",
    "Analyse writer's methods (language/structure/form) not just 'what happens'.",
    "Use subject terminology: metaphor, juxtaposition, foreshadowing, etc.",
    "Compare with explicit linking connectives.",
  ],
  commonMisconceptions: [
    "Plot summary instead of analysis",
    "Feature spotting without effect on reader",
    "No comparison connectives in comparative tasks",
    "Informal register in formal writing tasks",
  ],
  typicalDiagrams: ["annotated extract", "character/theme web", "structure timeline"],
  questionTypes: [
    "analytical paragraph",
    "comparative essay",
    "unseen analysis",
    "creative/persuasive writing",
  ],
  assessmentPriorities: [
    "Evidence embedded and analysed",
    "Writer's methods linked to effect",
    "Thematic/conceptual focus",
    "Technical accuracy in writing",
  ],
  defaultArchetypeKeys: ["english-text-analysis", "english-language-analysis"],
  defaultAssessmentSkills: ["analyse", "use-evidence", "compare"],
};

const COMPUTER_SCIENCE = {
  subjectKey: "computer-science",
  label: "Computer Science",
  matchPatterns: [
    /computer science/i,
    /computing/i,
    /algorithm/i,
    /binary/i,
    /network/i,
    /program/i,
    /python/i,
    /pseudocode/i,
  ],
  explanationStyle:
    "Logic-first: define term, trace example, state advantage/limitation. Use precise CS vocabulary.",
  commandWords: ["describe", "explain", "state", "compare", "discuss", "write"],
  examinerLanguagePatterns: [
    "Trace algorithms with test data.",
    "Show binary/hex conversion working.",
    "Name protocol purpose and layer where relevant.",
    "Discuss security/ethics with balanced view.",
  ],
  commonMisconceptions: [
    "Internet vs WWW conflated",
    "Confusing bit and byte",
    "Algorithm logic errors in trace tables",
    "Confusing compression lossy vs lossless",
  ],
  typicalDiagrams: ["flowchart", "trace table", "network topology", "logic gate"],
  questionTypes: [
    "algorithm trace",
    "binary conversion",
    "explain protocol/network",
    "discuss ethical issue",
  ],
  assessmentPriorities: [
    "Correct logic and trace",
    "Precise terminology",
    "Conversion accuracy",
    "Balanced discussion",
  ],
  defaultArchetypeKeys: ["cs-algorithm", "cs-binary"],
  defaultAssessmentSkills: ["explain", "calculate", "evaluate"],
};

const BUSINESS = {
  subjectKey: "business",
  label: "Business",
  matchPatterns: [
    /business/i,
    /marketing/i,
    /cash flow/i,
    /enterprise/i,
    /stakeholder/i,
    /finance/i,
  ],
  explanationStyle:
    "Business context first: define term → apply to scenario → analyse impact on stakeholder → evaluate decision.",
  commandWords: ["explain", "analyse", "evaluate", "calculate", "justify", "assess"],
  examinerLanguagePatterns: [
    "Apply concepts to the business scenario named in the question.",
    "Link decisions to stakeholder impact.",
    "Show calculations for financial questions.",
    "Evaluate — consider advantages and disadvantages before recommendation.",
  ],
  commonMisconceptions: [
    "Profit vs cash flow confusion",
    "Marketing mix as promotion only",
    "Generic answers without business context",
    "Recommendation without justification",
  ],
  typicalDiagrams: ["cash flow forecast", "break-even chart", "marketing mix diagram"],
  questionTypes: [
    "scenario application",
    "financial calculation",
    "evaluate business decision",
    "stakeholder analysis",
  ],
  assessmentPriorities: [
    "Contextual application",
    "Financial accuracy",
    "Stakeholder awareness",
    "Evaluative recommendations",
  ],
  defaultArchetypeKeys: ["business-marketing", "business-finance"],
  defaultAssessmentSkills: ["explain", "evaluate", "calculate"],
};

const ECONOMICS = {
  subjectKey: "economics",
  label: "Economics",
  matchPatterns: [
    /economics/i,
    /supply/i,
    /demand/i,
    /inflation/i,
    /gdp/i,
    /market/i,
    /fiscal/i,
    /monetary/i,
  ],
  explanationStyle:
    "Diagram-supported analysis: define → diagram → shift/change → stakeholder impact → evaluate policy.",
  commandWords: ["explain", "analyse", "evaluate", "assess", "calculate", "discuss"],
  examinerLanguagePatterns: [
    "Use correct diagram notation — shift vs movement along curve.",
    "Link macro indicators to policy responses.",
    "Evaluate time lags and unintended consequences.",
    "Apply to UK/current context where asked.",
  ],
  commonMisconceptions: [
    "Shift vs movement along curve",
    "Inflation defined vaguely",
    "Ignoring opportunity cost",
    "Policy benefits without drawbacks",
  ],
  typicalDiagrams: ["supply-demand diagram", "AD-AS diagram", "trend graph"],
  questionTypes: [
    "explain market change",
    "evaluate policy",
    "data response",
    "discuss macro issue",
  ],
  assessmentPriorities: [
    "Correct economic diagrams",
    "Chain of analysis",
    "Evaluative policy judgement",
    "Use of data",
  ],
  defaultArchetypeKeys: ["economics-supply-demand", "economics-macro"],
  defaultAssessmentSkills: ["explain", "evaluate", "interpret-data"],
};

const GENERAL = {
  subjectKey: "general",
  label: "General GCSE",
  matchPatterns: [],
  explanationStyle:
    "Clear GCSE teaching: definition → core model → mechanism/application → exam vocabulary. Use causal connectives.",
  commandWords: ["describe", "explain", "compare", "evaluate", "calculate", "analyse"],
  examinerLanguagePatterns: [
    "Use precise subject vocabulary.",
    "Link steps with because / therefore.",
    "Answer the command word — describe vs explain vs evaluate.",
    "Support claims with evidence or examples.",
  ],
  commonMisconceptions: [
    "Vague definitions",
    "Lists without linking connectives",
    "Wrong command word response type",
  ],
  typicalDiagrams: ["labelled diagram", "process flow", "graph or table"],
  questionTypes: ["describe", "explain", "evaluate", "calculate"],
  assessmentPriorities: [
    "Command word discipline",
    "Linked reasoning",
    "Subject vocabulary",
    "Exam-style application",
  ],
  defaultArchetypeKeys: ["generic-concept"],
  defaultAssessmentSkills: ["describe", "explain"],
};

const ALL_SUBJECT_PROFILES = [
  BIOLOGY,
  CHEMISTRY,
  PHYSICS,
  MATHS,
  HISTORY,
  GEOGRAPHY,
  ENGLISH,
  COMPUTER_SCIENCE,
  BUSINESS,
  ECONOMICS,
  GENERAL,
];

const PROFILES_BY_KEY = Object.fromEntries(ALL_SUBJECT_PROFILES.map((p) => [p.subjectKey, p]));

const SUBJECT_ALIASES = {
  biology: "biology",
  bio: "biology",
  chemistry: "chemistry",
  chem: "chemistry",
  physics: "physics",
  maths: "maths",
  mathematics: "maths",
  math: "maths",
  history: "history",
  geography: "geography",
  geo: "geography",
  english: "english",
  "computer-science": "computer-science",
  computing: "computer-science",
  cs: "computer-science",
  business: "business",
  economics: "economics",
  econ: "economics",
};

function normalizeSubjectIntelligenceKey(subject = "") {
  const key = String(subject || "").trim().toLowerCase();
  return SUBJECT_ALIASES[key] || null;
}

function getSubjectIntelligenceProfile(subjectKey) {
  return PROFILES_BY_KEY[subjectKey] || GENERAL;
}

function listSubjectIntelligenceKeys() {
  return ALL_SUBJECT_PROFILES.filter((p) => p.subjectKey !== "general").map((p) => p.subjectKey);
}

module.exports = {
  BIOLOGY,
  CHEMISTRY,
  PHYSICS,
  MATHS,
  HISTORY,
  GEOGRAPHY,
  ENGLISH,
  COMPUTER_SCIENCE,
  BUSINESS,
  ECONOMICS,
  GENERAL,
  ALL_SUBJECT_PROFILES,
  PROFILES_BY_KEY,
  SUBJECT_ALIASES,
  normalizeSubjectIntelligenceKey,
  getSubjectIntelligenceProfile,
  listSubjectIntelligenceKeys,
};
