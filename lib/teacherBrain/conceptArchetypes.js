/**
 * Phase 4.0 — Concept Archetypes (reusable across topics within a subject family).
 * Phase 4.2 — Specialised maths archetypes + refined history consequence/significance.
 */

const { historyFrameworkMethodology } = require("./archetypeMethodology");
const { MATHS_ARCHETYPES_V42 } = require("./mathsArchetypesV42");

/** @typedef {object} ConceptArchetype
 * @property {string} archetypeKey
 * @property {string} label
 * @property {string[]} subjectKeys
 * @property {RegExp[]} matchPatterns
 * @property {string} coreModelPattern
 * @property {string[]} progressionSteps
 * @property {string[]} typicalDiagrams
 * @property {string[]} commonMisconceptions
 * @property {string[]} defaultAssessmentSkills
 * @property {string} reasoningTemplate
 */

const BIOLOGY_PROCESS = {
  archetypeKey: "biology-process",
  label: "Process",
  subjectKeys: ["biology"],
  matchPatterns: [
    /photosynthesis/i,
    /respiration/i,
    /digestion/i,
    /transpiration/i,
    /osmosis/i,
    /active transport/i,
    /protein synthesis/i,
    /metabolism/i,
  ],
  coreModelPattern: "Input → staged process → output (name each stage and location)",
  progressionSteps: ["definition", "inputs/outputs", "staged mechanism", "factors affecting rate", "application"],
  typicalDiagrams: ["labelled pathway diagram", "before/after comparison", "rate graph"],
  commonMisconceptions: [
    "Confusing inputs with outputs",
    "Missing the role of enzymes or organelles",
    "Describing without linking stages",
  ],
  defaultAssessmentSkills: ["describe", "explain", "interpret-data"],
  reasoningTemplate: "Trigger → process step → product → effect on organism",
};

const BIOLOGY_CYCLE = {
  archetypeKey: "biology-cycle",
  label: "Cycle",
  subjectKeys: ["biology"],
  matchPatterns: [/carbon cycle/i, /nitrogen cycle/i, /water cycle/i, /life cycle/i, /menstrual cycle/i],
  coreModelPattern: "Reservoir → transfer → transformation → return to reservoir",
  progressionSteps: ["definition", "stores/reservoirs", "transfer processes", "human impact", "evaluation"],
  typicalDiagrams: ["cycle diagram with arrows", "flow between compartments"],
  commonMisconceptions: ["Linear not cyclic thinking", "Confusing decomposition with respiration only"],
  defaultAssessmentSkills: ["describe", "explain", "evaluate"],
  reasoningTemplate: "Store A → process → Store B → process → return to Store A",
};

const BIOLOGY_TRANSPORT = {
  archetypeKey: "biology-transport",
  label: "Transport",
  subjectKeys: ["biology"],
  matchPatterns: [
    /transport/i,
    /circulatory/i,
    /blood/i,
    /xylem/i,
    /phloem/i,
    /diffusion/i,
    /osmosis/i,
    /exchange surface/i,
  ],
  coreModelPattern: "Source → transport mechanism → destination (concentration/pressure gradient where relevant)",
  progressionSteps: ["definition", "structures", "mechanism", "adaptations", "application"],
  typicalDiagrams: ["cross-section of exchange surface", "pathway diagram", "concentration gradient"],
  commonMisconceptions: ["Active transport confused with diffusion", "Missing adaptation links to surface area"],
  defaultAssessmentSkills: ["describe", "explain", "compare"],
  reasoningTemplate: "Gradient/difference → transport mechanism → movement to destination",
};

const BIOLOGY_CONTROL_SYSTEM = {
  archetypeKey: "biology-control-system",
  label: "Control System",
  subjectKeys: ["biology"],
  matchPatterns: [
    /homeostasis/i,
    /nervous system/i,
    /hormone/i,
    /endocrine/i,
    /reflex/i,
    /negative feedback/i,
    /control/i,
    /the eye/i,
    /accommodation/i,
  ],
  coreModelPattern: "Stimulus → receptor → coordination centre → effector → response → return to optimum",
  progressionSteps: ["definition", "components", "mechanism", "negative feedback", "exam application"],
  typicalDiagrams: ["reflex arc", "feedback loop", "structure-function diagram"],
  commonMisconceptions: ["Brain as vague controller", "Missing return to optimum in feedback"],
  defaultAssessmentSkills: ["explain", "describe", "evaluate"],
  reasoningTemplate: "Change detected → signal → coordinated response → condition restored",
};

const BIOLOGY_INHERITANCE = {
  archetypeKey: "biology-inheritance",
  label: "Inheritance",
  subjectKeys: ["biology"],
  matchPatterns: [/genetic/i, /inheritance/i, /dna/i, /gene/i, /allele/i, /punnett/i, /variation/i],
  coreModelPattern: "DNA → gene → allele → phenotype (dominant/recessive where relevant)",
  progressionSteps: ["definition", "genetic terms", "inheritance patterns", "genetic cross", "application"],
  typicalDiagrams: ["Punnett square", "DNA structure", "family pedigree"],
  commonMisconceptions: ["Mixing genotype and phenotype", "Assuming blended inheritance"],
  defaultAssessmentSkills: ["describe", "explain", "calculate"],
  reasoningTemplate: "Parent genotypes → gametes → offspring ratios → phenotype outcome",
};

const BIOLOGY_DISEASE = {
  archetypeKey: "biology-disease",
  label: "Disease",
  subjectKeys: ["biology"],
  matchPatterns: [
    /disease/i,
    /infection/i,
    /pathogen/i,
    /immune/i,
    /vaccin/i,
    /communicable/i,
    /non-communicable/i,
    /cancer/i,
  ],
  coreModelPattern: "Pathogen/cause → transmission/mechanism → symptoms → prevention/treatment",
  progressionSteps: ["definition", "cause", "spread/mechanism", "defence", "prevention"],
  typicalDiagrams: ["pathogen cycle", "immune response", "transmission route"],
  commonMisconceptions: ["Antibiotics for viruses", "Confusing immune memory with immediate response"],
  defaultAssessmentSkills: ["describe", "explain", "evaluate"],
  reasoningTemplate: "Cause → entry/spread → body response → outcome/prevention",
};

const BIOLOGY_PRACTICAL = {
  archetypeKey: "biology-practical",
  label: "Practical / Investigation",
  subjectKeys: ["biology"],
  matchPatterns: [
    /required practical/i,
    /investigation/i,
    /reaction time/i,
    /fieldwork/i,
    /experiment/i,
    /practical/i,
  ],
  coreModelPattern: "Aim → variables → method → results → analysis → evaluation",
  progressionSteps: ["scientific context", "variables", "method", "results", "analysis", "evaluation"],
  typicalDiagrams: ["equipment setup", "results table/graph", "method steps"],
  commonMisconceptions: ["Confusing IV and DV", "Evaluation as mere repetition of results"],
  defaultAssessmentSkills: ["describe", "explain", "evaluate", "interpret-data"],
  reasoningTemplate: "Hypothesis → controlled test → data → conclusion → limitation",
};

const CHEMISTRY_PARTICLE_MODEL = {
  archetypeKey: "chemistry-particle-model",
  label: "Particle Model",
  subjectKeys: ["chemistry"],
  matchPatterns: [/atomic structure/i, /particle/i, /atom/i, /element/i, /periodic/i, /isotope/i],
  coreModelPattern: "Particle arrangement → properties → macroscopic behaviour",
  progressionSteps: ["definition", "particle model", "structure", "properties", "application"],
  typicalDiagrams: ["Bohr model", "particle arrangement in states", "periodic table trends"],
  commonMisconceptions: ["Electrons in fixed orbits as solid shells only", "Confusing atom and ion"],
  defaultAssessmentSkills: ["describe", "explain", "recall"],
  reasoningTemplate: "Particle level change → property change → observable effect",
};

const CHEMISTRY_REACTION = {
  archetypeKey: "chemistry-reaction",
  label: "Reaction",
  subjectKeys: ["chemistry"],
  matchPatterns: [/reaction/i, /bonding/i, /ionic/i, /covalent/i, /metallic/i, /electrolysis/i, /rates/i],
  coreModelPattern: "Reactants → conditions → products (+ energy profile where relevant)",
  progressionSteps: ["definition", "reactants/products", "mechanism", "conditions", "application"],
  typicalDiagrams: ["symbol equation", "dot-and-cross", "electrolysis cell"],
  commonMisconceptions: ["Balancing without understanding conservation", "Ionic/covalent bonding confusion"],
  defaultAssessmentSkills: ["describe", "explain", "calculate"],
  reasoningTemplate: "Bond breaking → rearrangement → bond forming → energy change",
};

const CHEMISTRY_ENERGY_CHANGE = {
  archetypeKey: "chemistry-energy-change",
  label: "Energy Change",
  subjectKeys: ["chemistry"],
  matchPatterns: [/exothermic/i, /endothermic/i, /energy change/i, /enthalpy/i, /calorimetry/i],
  coreModelPattern: "Bond energies → net energy transfer → temperature change",
  progressionSteps: ["definition", "energy diagram", "calculation", "everyday application"],
  typicalDiagrams: ["reaction profile", "energy level diagram"],
  commonMisconceptions: ["Exothermic means no activation energy", "Confusing ΔH sign"],
  defaultAssessmentSkills: ["explain", "calculate", "interpret-data"],
  reasoningTemplate: "Bonds broken (endothermic) vs bonds made (exothermic) → net energy",
};

const CHEMISTRY_EQUILIBRIUM = {
  archetypeKey: "chemistry-equilibrium",
  label: "Equilibrium",
  subjectKeys: ["chemistry"],
  matchPatterns: [/equilibrium/i, /reversible/i, /le chatelier/i, /dynamic equilibrium/i],
  coreModelPattern: "Forward rate = reverse rate → closed system → position shift",
  progressionSteps: ["definition", "dynamic equilibrium", "Le Chatelier", "industrial application"],
  typicalDiagrams: ["equilibrium diagram", "concentration-time graph"],
  commonMisconceptions: ["Equal concentrations not equal rates", "Catalyst shifts position"],
  defaultAssessmentSkills: ["explain", "evaluate"],
  reasoningTemplate: "Stress applied → system opposes → new equilibrium position",
};

const CHEMISTRY_CALCULATION = {
  archetypeKey: "chemistry-calculation",
  label: "Calculation",
  subjectKeys: ["chemistry"],
  matchPatterns: [/mole/i, /concentration/i, /titration/i, /yield/i, /percentage/i, /mass/i, /volume/i],
  coreModelPattern: "Formula → substitute → unit conversion → answer with sf",
  progressionSteps: ["recall formula", "identify given/unknown", "working", "unit check"],
  typicalDiagrams: ["titration setup", "mole triangle"],
  commonMisconceptions: ["Unit conversion errors", "Rounding too early"],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Given data → formula selection → working → unit-checked answer",
};

const CHEMISTRY_PRACTICAL = {
  archetypeKey: "chemistry-practical",
  label: "Practical / Investigation",
  subjectKeys: ["chemistry"],
  matchPatterns: [/required practical/i, /titration/i, /investigation/i, /experiment/i, /practical/i],
  coreModelPattern: "Aim → variables → method → results → analysis → evaluation",
  progressionSteps: ["context", "variables", "method", "results", "analysis", "evaluation"],
  typicalDiagrams: ["apparatus diagram", "results graph"],
  commonMisconceptions: ["Imprecise burette readings", "Evaluation without improvement suggestion"],
  defaultAssessmentSkills: ["describe", "evaluate", "interpret-data"],
  reasoningTemplate: "Controlled test → accurate measurement → valid conclusion",
};

const PHYSICS_FORCE_SYSTEM = {
  archetypeKey: "physics-force-system",
  label: "Force System",
  subjectKeys: ["physics"],
  matchPatterns: [/force/i, /motion/i, /newton/i, /friction/i, /momentum/i, /pressure/i],
  coreModelPattern: "Forces acting → resultant → acceleration/equilibrium → outcome",
  progressionSteps: ["definition", "force diagram", "calculation", "application"],
  typicalDiagrams: ["free-body diagram", "force arrows"],
  commonMisconceptions: ["Motion requires continuous force", "Confusing mass and weight"],
  defaultAssessmentSkills: ["describe", "explain", "calculate"],
  reasoningTemplate: "Force applied → unbalanced resultant → acceleration (F=ma)",
};

const PHYSICS_ENERGY_TRANSFER = {
  archetypeKey: "physics-energy-transfer",
  label: "Energy Transfer",
  subjectKeys: ["physics"],
  matchPatterns: [/energy/i, /work done/i, /power/i, /kinetic/i, /potential/i, /efficiency/i],
  coreModelPattern: "Energy store → transfer pathway → useful/wasted output",
  progressionSteps: ["stores", "transfer", "conservation", "efficiency", "application"],
  typicalDiagrams: ["Sankey diagram", "energy transfer pathway"],
  commonMisconceptions: ["Energy used up not transferred", "Efficiency > 100%"],
  defaultAssessmentSkills: ["explain", "calculate", "evaluate"],
  reasoningTemplate: "Input energy → transfer mechanism → useful + wasted output",
};

const PHYSICS_WAVE = {
  archetypeKey: "physics-wave",
  label: "Wave Behaviour",
  subjectKeys: ["physics"],
  matchPatterns: [/wave/i, /sound/i, /light/i, /reflection/i, /refraction/i, /electromagnetic/i],
  coreModelPattern: "Source → medium → wave properties → interaction → detection",
  progressionSteps: ["definition", "properties", "behaviour", "application"],
  typicalDiagrams: ["wave diagram", "ray diagram", "EM spectrum"],
  commonMisconceptions: ["Waves carry matter", "All EM waves same speed in vacuum confusion in applications"],
  defaultAssessmentSkills: ["describe", "explain", "calculate"],
  reasoningTemplate: "Wave property → interaction with boundary/medium → observed effect",
};

const PHYSICS_CIRCUIT = {
  archetypeKey: "physics-circuit",
  label: "Circuit",
  subjectKeys: ["physics"],
  matchPatterns: [/circuit/i, /electricity/i, /current/i, /voltage/i, /resistance/i, /ohm/i],
  coreModelPattern: "Supply → components in series/parallel → current/voltage rules → power",
  progressionSteps: ["symbols", "series/parallel rules", "calculation", "application"],
  typicalDiagrams: ["circuit diagram", "IV graph"],
  commonMisconceptions: ["Current used up in series", "Voltage and current conflated"],
  defaultAssessmentSkills: ["describe", "calculate", "explain"],
  reasoningTemplate: "Circuit arrangement → rule applied → calculated quantity",
};

const PHYSICS_FIELD = {
  archetypeKey: "physics-field",
  label: "Field",
  subjectKeys: ["physics"],
  matchPatterns: [/field/i, /magnet/i, /electromagnet/i, /gravitational/i, /electrostatic/i],
  coreModelPattern: "Field source → field lines/strength → force on object in field",
  progressionSteps: ["definition", "field representation", "force rule", "application"],
  typicalDiagrams: ["field line diagram", " Fleming's rules"],
  commonMisconceptions: ["Field lines as paths of motion", "Poles confused with charges"],
  defaultAssessmentSkills: ["describe", "explain"],
  reasoningTemplate: "Field source → interaction → force direction/magnitude",
};

const PHYSICS_PRACTICAL = {
  archetypeKey: "physics-practical",
  label: "Practical / Investigation",
  subjectKeys: ["physics"],
  matchPatterns: [/required practical/i, /investigation/i, /experiment/i, /practical/i],
  coreModelPattern: "Aim → variables → method → graph → analysis → evaluation",
  progressionSteps: ["context", "variables", "method", "graph", "analysis", "evaluation"],
  typicalDiagrams: ["setup diagram", "graph with line of best fit"],
  commonMisconceptions: ["Anomalous results ignored", "Gradient/intercept not linked to physics"],
  defaultAssessmentSkills: ["describe", "interpret-data", "evaluate"],
  reasoningTemplate: "Measurement → graph → relationship → physics principle",
};

const HISTORY_CAUSE = {
  archetypeKey: "history-cause",
  label: "Cause",
  subjectKeys: ["history"],
  matchPatterns: [/cause/i, /why did/i, /reasons? for/i, /outbreak/i, /world war/i, /origins/i],
  coreModelPattern: "Long-term → short-term → trigger → linked consequence",
  progressionSteps: ["context", "long-term causes", "short-term causes", "trigger", "link to event"],
  typicalDiagrams: ["timeline", "causation web"],
  commonMisconceptions: ["Single cause oversimplification", "Narrative without categorising cause types"],
  defaultAssessmentSkills: ["explain", "analyse", "use-evidence"],
  reasoningTemplate: "Factor → mechanism → contribution to event",
};

const HISTORY_CONSEQUENCE = {
  archetypeKey: "history-consequence",
  label: "Consequence",
  subjectKeys: ["history"],
  matchPatterns: [
    /consequence/i,
    /impact/i,
    /result/i,
    /treaty/i,
    /versailles/i,
    /aftermath/i,
    /legacy of/i,
  ],
  coreModelPattern: "Short-term impact → Long-term impact → Importance → Judgement",
  progressionSteps: ["short-term impact", "long-term impact", "importance", "judgement"],
  typicalDiagrams: ["timeline of consequences", "impact on groups table"],
  commonMisconceptions: [
    "Only political consequences listed",
    "No short-term vs long-term distinction",
    "Judgement missing at end of answer",
  ],
  defaultAssessmentSkills: ["explain", "evaluate", "use-evidence"],
  reasoningTemplate: "Event → short-term effect → long-term legacy → why it mattered → weighed judgement",
  teachingMethodology: historyFrameworkMethodology(
    ["Short-term impact", "Long-term impact", "Importance", "Judgement"],
    {
      "Short-term impact":
        "Immediate effects on people, countries, or groups — use specific dates and evidence.",
      "Long-term impact":
        "Legacy over decades — structural changes, treaties, borders, attitudes.",
      Importance: "Why these consequences mattered for future events or groups affected.",
      Judgement:
        "Weighed conclusion: which consequences were most significant and why (not a list without evaluation).",
    }
  ),
};

const HISTORY_CHANGE = {
  archetypeKey: "history-change",
  label: "Change",
  subjectKeys: ["history"],
  matchPatterns: [/change/i, /revolution/i, /reform/i, /development/i, /medicine through time/i],
  coreModelPattern: "Before → turning point → after (with evidence for degree of change)",
  progressionSteps: ["starting point", "drivers of change", "nature of change", "extent evaluation"],
  typicalDiagrams: ["continuity-change spectrum", "timeline"],
  commonMisconceptions: ["Whig narrative of inevitable progress", "Change described without evidence"],
  defaultAssessmentSkills: ["describe", "explain", "evaluate"],
  reasoningTemplate: "Condition before → agent of change → condition after → extent judgement",
};

const HISTORY_CONTINUITY = {
  archetypeKey: "history-continuity",
  label: "Continuity",
  subjectKeys: ["history"],
  matchPatterns: [/continuity/i, /remained/i, /still/i, /persist/i],
  coreModelPattern: "Feature persists despite change elsewhere — explain why",
  progressionSteps: ["identify continuity", "evidence", "explanation", "significance"],
  typicalDiagrams: ["comparison table"],
  commonMisconceptions: ["Ignoring continuity in favour of change narrative"],
  defaultAssessmentSkills: ["explain", "use-evidence"],
  reasoningTemplate: "Feature → evidence of persistence → reason it endured",
};

const HISTORY_SIMILARITY_DIFFERENCE = {
  archetypeKey: "history-similarity-difference",
  label: "Similarity / Difference",
  subjectKeys: ["history"],
  matchPatterns: [/compare/i, /similar/i, /differ/i, /contrast/i],
  coreModelPattern: "Point of comparison → similarity AND difference with evidence",
  progressionSteps: ["criteria", "similarity", "difference", "significance"],
  typicalDiagrams: ["comparison table"],
  commonMisconceptions: ["Two separate descriptions without comparison language"],
  defaultAssessmentSkills: ["compare", "use-evidence"],
  reasoningTemplate: "Feature on both sides → similarity → difference → so what",
};

const HISTORY_SIGNIFICANCE = {
  archetypeKey: "history-significance",
  label: "Significance",
  subjectKeys: ["history"],
  matchPatterns: [/significance/i, /significant/i, /important/i, /legacy/i, /holocaust/i],
  coreModelPattern: "Importance at the time → Importance later → Overall significance",
  progressionSteps: ["importance at the time", "importance later", "overall significance judgement"],
  typicalDiagrams: ["significance criteria diagram", "timeline of impact"],
  commonMisconceptions: [
    "Significance asserted without criteria",
    "Only describing events without judging importance",
    "No distinction between contemporary and later significance",
  ],
  defaultAssessmentSkills: ["evaluate", "use-evidence"],
  reasoningTemplate: "Criteria → importance then → importance later → overall significance judgement",
  teachingMethodology: historyFrameworkMethodology(
    ["Importance at the time", "Importance later", "Overall significance"],
    {
      "Importance at the time":
        "How contemporaries viewed the event; immediate political, social, economic impact with evidence.",
      "Importance later":
        "How hindsight and later events changed our view; long-term legacy and memorialisation.",
      "Overall significance":
        "Judgement using criteria (e.g. depth, duration, number affected) — not just 'it was important'.",
    }
  ),
};

const HISTORY_SOURCE = {
  archetypeKey: "history-source-analysis",
  label: "Source Analysis",
  subjectKeys: ["history"],
  matchPatterns: [/source/i, /cartoon/i, /provenance/i, /reliability/i, /useful/i],
  coreModelPattern: "Content + provenance + context → supported judgement",
  progressionSteps: ["content", "provenance", "contextual knowledge", "judgement"],
  typicalDiagrams: ["source with annotations"],
  commonMisconceptions: ["Content-only analysis", "Dismissal without provenance"],
  defaultAssessmentSkills: ["source-analysis", "use-evidence", "evaluate"],
  reasoningTemplate: "What source shows → who/when/why → how far trustworthy",
};

const HISTORY_INTERPRETATION = {
  archetypeKey: "history-interpretation",
  label: "Interpretation",
  subjectKeys: ["history"],
  matchPatterns: [/interpretation/i, /historian/i, /view/i, /debate/i],
  coreModelPattern: "Interpretation claim → evidence for → evidence against → reasoned view",
  progressionSteps: ["state interpretation", "support", "challenge", "conclusion"],
  typicalDiagrams: ["interpretation comparison table"],
  commonMisconceptions: ["Accepting one historian uncritically"],
  defaultAssessmentSkills: ["evaluate", "use-evidence", "essay-planning"],
  reasoningTemplate: "Claim → evidence → counter → weighed conclusion",
};

const GEOGRAPHY_PHYSICAL = {
  archetypeKey: "geography-physical-process",
  label: "Physical Process",
  subjectKeys: ["geography"],
  matchPatterns: [/river/i, /coast/i, /weather/i, /climate/i, /tectonic/i, /glaciation/i, /erosion/i],
  coreModelPattern: "Inputs → process → landform/outcome (with named stages)",
  progressionSteps: ["definition", "process stages", "landform", "human interaction"],
  typicalDiagrams: ["cross-profile diagram", "process sequence"],
  commonMisconceptions: ["Process stages out of order", "Confusing weather and climate"],
  defaultAssessmentSkills: ["describe", "explain", "interpret-data"],
  reasoningTemplate: "Energy/material → process → landform change",
};

const GEOGRAPHY_HUMAN = {
  archetypeKey: "geography-human-process",
  label: "Human Process",
  subjectKeys: ["geography"],
  matchPatterns: [/urban/i, /migration/i, /development/i, /population/i, /globalisation/i],
  coreModelPattern: "Driver → process → spatial pattern → impact",
  progressionSteps: ["definition", "drivers", "process", "spatial pattern", "impact"],
  typicalDiagrams: ["model diagram (e.g. DTM)", "choropleth map"],
  commonMisconceptions: ["Single driver oversimplification", "No named place example"],
  defaultAssessmentSkills: ["explain", "evaluate", "use-evidence"],
  reasoningTemplate: "Driver → human response → spatial outcome",
};

const GEOGRAPHY_CASE_STUDY = {
  archetypeKey: "geography-case-study",
  label: "Case Study",
  subjectKeys: ["geography"],
  matchPatterns: [/case study/i, /named example/i, /ledc/i, /medc/i, /hic/i, /lic/i],
  coreModelPattern: "Location → key facts → causes → impacts → management/responses",
  progressionSteps: ["locate", "key facts", "causes", "effects", "responses", "evaluation"],
  typicalDiagrams: ["locator map", "impact diagram"],
  commonMisconceptions: ["Generic place with no named data", "Effects without categorising social/economic/environmental"],
  defaultAssessmentSkills: ["describe", "explain", "evaluate"],
  reasoningTemplate: "Place → process → specific impact → response",
};

const GEOGRAPHY_DATA = {
  archetypeKey: "geography-data-interpretation",
  label: "Data Interpretation",
  subjectKeys: ["geography"],
  matchPatterns: [/data/i, /graph/i, /map/i, /statistics/i, /trend/i],
  coreModelPattern: "Describe trend → explain using geography → evaluate limitation",
  progressionSteps: ["describe data", "explain pattern", "link to theory", "evaluate"],
  typicalDiagrams: ["graph", "map extract"],
  commonMisconceptions: ["Description without explanation", "Inventing data not on figure"],
  defaultAssessmentSkills: ["interpret-data", "explain", "evaluate"],
  reasoningTemplate: "Pattern in data → geographical explanation → limitation",
};

const GEOGRAPHY_DECISION = {
  archetypeKey: "geography-decision-making",
  label: "Decision Making",
  subjectKeys: ["geography"],
  matchPatterns: [/decision/i, /management/i, /strategy/i, /sustainability/i],
  coreModelPattern: "Options → criteria → best option justified with evidence",
  progressionSteps: ["stakeholders", "options", "criteria", "decision", "evaluation"],
  typicalDiagrams: ["decision matrix"],
  commonMisconceptions: ["One option with no alternatives", "No stakeholder view"],
  defaultAssessmentSkills: ["evaluate", "justify", "use-evidence"],
  reasoningTemplate: "Option → advantage/disadvantage → justified recommendation",
};

const GEOGRAPHY_SUSTAINABILITY = {
  archetypeKey: "geography-sustainability",
  label: "Sustainability",
  subjectKeys: ["geography"],
  matchPatterns: [/sustainab/i, /climate change/i, /resource/i, /renewable/i, /carbon/i],
  coreModelPattern: "Environmental + economic + social dimensions → trade-offs → sustainable solution",
  progressionSteps: ["define sustainability", "issue", "impacts", "responses", "evaluate trade-offs"],
  typicalDiagrams: ["sustainability Venn", "cause-effect diagram"],
  commonMisconceptions: ["Environmental only definition of sustainability"],
  defaultAssessmentSkills: ["explain", "evaluate"],
  reasoningTemplate: "Issue → three pillars affected → trade-off → balanced response",
};

const ENGLISH_TEXT_ANALYSIS = {
  archetypeKey: "english-text-analysis",
  label: "Text Analysis",
  subjectKeys: ["english"],
  matchPatterns: [/macbeth/i, /novel/i, /character/i, /theme/i, /shakespeare/i, /literature/i],
  coreModelPattern: "Point → evidence (quote) → analysis of writer's method → link to theme",
  progressionSteps: ["context", "identify feature", "evidence", "analysis", "link to theme"],
  typicalDiagrams: ["character map", "theme web"],
  commonMisconceptions: ["Plot retelling", "Quote without analysis"],
  defaultAssessmentSkills: ["analyse", "use-evidence", "explain"],
  reasoningTemplate: "Writer choice → method → effect on reader → theme",
};

const ENGLISH_LANGUAGE = {
  archetypeKey: "english-language-analysis",
  label: "Language Analysis",
  subjectKeys: ["english"],
  matchPatterns: [/language analysis/i, /unseen/i, /writer/i, /technique/i, /poetry/i],
  coreModelPattern: "Identify method → quote → analyse effect → evaluate overall impact",
  progressionSteps: ["overview", "method identification", "analysis", "evaluation"],
  typicalDiagrams: ["annotated extract"],
  commonMisconceptions: ["Feature spotting without effect", "No subject terminology"],
  defaultAssessmentSkills: ["analyse", "use-evidence"],
  reasoningTemplate: "Language feature → quotation → effect on reader",
};

const ENGLISH_STRUCTURE = {
  archetypeKey: "english-structure-analysis",
  label: "Structure Analysis",
  subjectKeys: ["english"],
  matchPatterns: [/structure/i, /form/i, /layout/i, /shift/i, /narrative/i],
  coreModelPattern: "Structural feature at point in text → effect → link to whole",
  progressionSteps: ["whole text overview", "structural moment", "effect", "link to meaning"],
  typicalDiagrams: ["structure timeline"],
  commonMisconceptions: ["Confusing structure with language", "Beginning/middle/end only"],
  defaultAssessmentSkills: ["analyse", "explain"],
  reasoningTemplate: "Position in text → structural choice → effect on meaning",
};

const ENGLISH_COMPARISON = {
  archetypeKey: "english-comparison",
  label: "Comparison",
  subjectKeys: ["english"],
  matchPatterns: [/compar/i, /both texts/i, /similar/i, /contrast/i],
  coreModelPattern: "Similarity in method/theme → difference → significance",
  progressionSteps: ["identify shared focus", "similarity", "difference", "evaluative link"],
  typicalDiagrams: ["comparison table"],
  commonMisconceptions: ["Two separate analyses without comparison connectives"],
  defaultAssessmentSkills: ["compare", "analyse"],
  reasoningTemplate: "Both writers … however … whereas … overall",
};

const ENGLISH_WRITING = {
  archetypeKey: "english-writing-technique",
  label: "Writing Technique",
  subjectKeys: ["english"],
  matchPatterns: [/persuasive/i, /writing/i, /creative/i, /speech/i, /letter/i, /article/i],
  coreModelPattern: "Purpose → audience → form → deliberate language/structure choices",
  progressionSteps: ["purpose/audience", "form conventions", "techniques", "modelled example"],
  typicalDiagrams: ["planning frame"],
  commonMisconceptions: ["No audience awareness", "Informal register in formal task"],
  defaultAssessmentSkills: ["explain", "justify"],
  reasoningTemplate: "Purpose → technique chosen → intended effect on reader",
};

const ENGLISH_ARGUMENT = {
  archetypeKey: "english-argument",
  label: "Argument",
  subjectKeys: ["english"],
  matchPatterns: [/argument/i, /viewpoint/i, /discuss/i, /opinion/i],
  coreModelPattern: "Thesis → developed points → counter → conclusion",
  progressionSteps: ["thesis", "PEEL paragraphs", "counter", "conclusion"],
  typicalDiagrams: ["argument map"],
  commonMisconceptions: ["One-sided argument", "No discourse markers"],
  defaultAssessmentSkills: ["justify", "evaluate", "essay-planning"],
  reasoningTemplate: "Claim → evidence → explanation → link back",
};

const CS_ALGORITHM = {
  archetypeKey: "cs-algorithm",
  label: "Algorithms",
  subjectKeys: ["computer-science"],
  matchPatterns: [/algorithm/i, /pseudocode/i, /flowchart/i, /sort/i, /search/i],
  coreModelPattern: "Input → step → decision → output (trace table for verification)",
  progressionSteps: ["problem", "algorithm design", "trace", "efficiency note"],
  typicalDiagrams: ["flowchart", "trace table"],
  commonMisconceptions: ["Syntax confused with logic", "Infinite loop undetected"],
  defaultAssessmentSkills: ["explain", "evaluate"],
  reasoningTemplate: "Step → condition → next step → output",
};

const CS_BINARY = {
  archetypeKey: "cs-binary",
  label: "Binary / Data Representation",
  subjectKeys: ["computer-science"],
  matchPatterns: [/binary/i, /hex/i, /denary/i, /ascii/i, /bitmap/i, /sound sampling/i],
  coreModelPattern: "Denary ↔ binary ↔ hex conversion with place value",
  progressionSteps: ["place value", "conversion method", "application", "limitation"],
  typicalDiagrams: ["conversion table", "bit pattern"],
  commonMisconceptions: ["Confusing bit and byte", "Padding errors in conversion"],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Value → place value breakdown → converted form",
};

const CS_NETWORK = {
  archetypeKey: "cs-network",
  label: "Networks",
  subjectKeys: ["computer-science"],
  matchPatterns: [/network/i, /protocol/i, /internet/i, /packet/i, /topolog/i],
  coreModelPattern: "Device → protocol/layer → transmission → destination",
  progressionSteps: ["components", "topology", "protocols", "security"],
  typicalDiagrams: ["network topology", "packet switching diagram"],
  commonMisconceptions: ["Internet vs WWW conflated", "Protocol purpose unclear"],
  defaultAssessmentSkills: ["describe", "explain"],
  reasoningTemplate: "Sender → protocol step → receiver",
};

const BUSINESS_MARKETING = {
  archetypeKey: "business-marketing",
  label: "Marketing / Business Model",
  subjectKeys: ["business"],
  matchPatterns: [/marketing/i, /mix/i, /product/i, /price/i, /promotion/i, /place/i],
  coreModelPattern: "Element of mix → business decision → impact on customer/sales",
  progressionSteps: ["define term", "business context", "decision", "impact", "evaluation"],
  typicalDiagrams: ["marketing mix diagram"],
  commonMisconceptions: ["Promotion only view of marketing", "No link to target market"],
  defaultAssessmentSkills: ["explain", "evaluate", "justify"],
  reasoningTemplate: "Mix element → business choice → customer impact",
};

const BUSINESS_FINANCE = {
  archetypeKey: "business-finance",
  label: "Finance / Cash Flow",
  subjectKeys: ["business"],
  matchPatterns: [/cash flow/i, /profit/i, /revenue/i, /cost/i, /break.?even/i, /finance/i],
  coreModelPattern: "Inflows → outflows → net position → business implication",
  progressionSteps: ["define terms", "calculate", "interpret", "recommendation"],
  typicalDiagrams: ["cash flow forecast", "break-even chart"],
  commonMisconceptions: ["Profit vs cash flow confusion", "Fixed/variable cost misclassification"],
  defaultAssessmentSkills: ["calculate", "interpret-data", "evaluate"],
  reasoningTemplate: "Figure → calculation → what it means for the business",
};

const ECONOMICS_SUPPLY_DEMAND = {
  archetypeKey: "economics-supply-demand",
  label: "Supply and Demand",
  subjectKeys: ["economics"],
  matchPatterns: [/supply/i, /demand/i, /market/i, /equilibrium/i, /price/i],
  coreModelPattern: "Shift in curve → new equilibrium → stakeholder effect",
  progressionSteps: ["define terms", "diagram", "shift factor", "new equilibrium", "evaluation"],
  typicalDiagrams: ["supply-demand diagram"],
  commonMisconceptions: ["Shift vs movement along curve", "Supply confused with quantity supplied"],
  defaultAssessmentSkills: ["explain", "analyse", "evaluate"],
  reasoningTemplate: "Change in condition → curve shift → price/quantity outcome",
};

const ECONOMICS_MACRO = {
  archetypeKey: "economics-macro",
  label: "Macroeconomic Indicator",
  subjectKeys: ["economics"],
  matchPatterns: [/inflation/i, /gdp/i, /unemployment/i, /interest rate/i, /fiscal/i, /monetary/i],
  coreModelPattern: "Indicator definition → measurement → cause → government response → evaluation",
  progressionSteps: ["define", "measurement", "causes", "policy response", "evaluate"],
  typicalDiagrams: ["AD-AS diagram", "inflation trend graph"],
  commonMisconceptions: ["Inflation defined as rising prices only with no index", "Policy time lag ignored"],
  defaultAssessmentSkills: ["explain", "evaluate", "interpret-data"],
  reasoningTemplate: "Indicator change → cause → policy → limitation",
};

const GENERIC_CONCEPT = {
  archetypeKey: "generic-concept",
  label: "General Concept",
  subjectKeys: ["general"],
  matchPatterns: [],
  coreModelPattern: "Definition → key features → mechanism or application → exam link",
  progressionSteps: ["definition", "core model", "mechanism/application", "exam practice"],
  typicalDiagrams: ["labelled diagram", "process flow"],
  commonMisconceptions: ["Vague definitions", "Facts without linking connectives"],
  defaultAssessmentSkills: ["describe", "explain"],
  reasoningTemplate: "Concept → mechanism → outcome → exam application",
};

const ALL_ARCHETYPES = [
  BIOLOGY_PROCESS,
  BIOLOGY_CYCLE,
  BIOLOGY_TRANSPORT,
  BIOLOGY_CONTROL_SYSTEM,
  BIOLOGY_INHERITANCE,
  BIOLOGY_DISEASE,
  BIOLOGY_PRACTICAL,
  CHEMISTRY_PARTICLE_MODEL,
  CHEMISTRY_REACTION,
  CHEMISTRY_ENERGY_CHANGE,
  CHEMISTRY_EQUILIBRIUM,
  CHEMISTRY_CALCULATION,
  CHEMISTRY_PRACTICAL,
  PHYSICS_FORCE_SYSTEM,
  PHYSICS_ENERGY_TRANSFER,
  PHYSICS_WAVE,
  PHYSICS_CIRCUIT,
  PHYSICS_FIELD,
  PHYSICS_PRACTICAL,
  ...MATHS_ARCHETYPES_V42,
  HISTORY_CAUSE,
  HISTORY_CONSEQUENCE,
  HISTORY_CHANGE,
  HISTORY_CONTINUITY,
  HISTORY_SIMILARITY_DIFFERENCE,
  HISTORY_SIGNIFICANCE,
  HISTORY_SOURCE,
  HISTORY_INTERPRETATION,
  GEOGRAPHY_PHYSICAL,
  GEOGRAPHY_HUMAN,
  GEOGRAPHY_CASE_STUDY,
  GEOGRAPHY_DATA,
  GEOGRAPHY_DECISION,
  GEOGRAPHY_SUSTAINABILITY,
  ENGLISH_TEXT_ANALYSIS,
  ENGLISH_LANGUAGE,
  ENGLISH_STRUCTURE,
  ENGLISH_COMPARISON,
  ENGLISH_WRITING,
  ENGLISH_ARGUMENT,
  CS_ALGORITHM,
  CS_BINARY,
  CS_NETWORK,
  BUSINESS_MARKETING,
  BUSINESS_FINANCE,
  ECONOMICS_SUPPLY_DEMAND,
  ECONOMICS_MACRO,
  GENERIC_CONCEPT,
];

const ARCHETYPES_BY_KEY = Object.fromEntries(ALL_ARCHETYPES.map((a) => [a.archetypeKey, a]));

function listArchetypesForSubject(subjectKey) {
  const key = String(subjectKey || "general").toLowerCase();
  return ALL_ARCHETYPES.filter(
    (a) => a.subjectKeys.includes(key) || a.archetypeKey === "generic-concept"
  );
}

function getConceptArchetype(archetypeKey) {
  return ARCHETYPES_BY_KEY[archetypeKey] || GENERIC_CONCEPT;
}

module.exports = {
  ALL_ARCHETYPES,
  ARCHETYPES_BY_KEY,
  GENERIC_CONCEPT,
  listArchetypesForSubject,
  getConceptArchetype,
};
