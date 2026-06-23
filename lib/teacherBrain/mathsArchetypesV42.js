/**
 * Phase 4.2 — Specialised Maths archetypes (method-mark methodology).
 */

const { mathsMethodology } = require("./archetypeMethodology");

const MATHS_ALGEBRA = {
  archetypeKey: "maths-algebra",
  label: "Algebra",
  subjectKeys: ["maths"],
  matchPatterns: [
    /^algebra$/i,
    /linear equation/i,
    /rearrang/i,
    /simplif/i,
    /expand/i,
    /expression/i,
    /formula/i,
  ],
  coreModelPattern: "Identify unknown → inverse operations → isolate variable → substitute to check",
  progressionSteps: ["formula/rule", "method steps", "worked example", "common error", "method marks", "challenge"],
  typicalDiagrams: ["balance scale for equations", "number line"],
  commonMisconceptions: [
    "Sign errors when rearranging",
    "Confusing expression simplification with solving an equation",
    "Skipping inverse operations",
  ],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "State operation → apply to both sides → simplify → verify by substitution",
  teachingMethodology: mathsMethodology({
    Formula: "State the rule (e.g. inverse operations, balance both sides, collect like terms).",
    Method:
      "Line-by-line working: write each operation explicitly; never jump from question to answer.",
    "Worked Example":
      "Full solution with every step labelled (e.g. 'subtract 4 from both sides', 'divide by 3').",
    "Common Error": "Sign errors; treating expressions as equations; missing the equals sign discipline.",
    "Examiner Method Marks":
      "M marks for correct method even if arithmetic slips; A marks for accurate final answer with units/sf.",
    "Challenge Question": "Rearrange a formula for a different subject or solve with fractions/brackets.",
  }),
};

const MATHS_SIMULTANEOUS = {
  archetypeKey: "maths-simultaneous",
  label: "Simultaneous Equations",
  subjectKeys: ["maths"],
  matchPatterns: [/simultaneous/i, /two equations/i, /elimination method/i, /substitution method/i],
  coreModelPattern: "Choose method → rearrange/substitute OR eliminate → solve one variable → solve second → check both equations",
  progressionSteps: ["choose method", "eliminate/substitute", "solve", "check", "method marks", "challenge"],
  typicalDiagrams: ["step table for substitution", "elimination working column"],
  commonMisconceptions: [
    "Not checking solutions in both original equations",
    "Elimination without matching coefficients",
    "Arithmetic slips when substituting",
  ],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Method chosen → variable eliminated/isolated → values found → verified in both equations",
  teachingMethodology: mathsMethodology({
    Formula: "Substitution: rearrange one equation for x or y. Elimination: match coefficients and add/subtract.",
    Method:
      "Label each step ('Substituting equation 2 into 1', 'Adding equations to eliminate y'); show all algebra.",
    "Worked Example":
      "Complete pair (x, y) with check: substitute back into BOTH originals and show they balance.",
    "Common Error": "Finding one value but not the second; no verification step; sign errors in elimination.",
    "Examiner Method Marks":
      "Marks for correct method selection, elimination/substitution step, and both values; check earns reasoning marks.",
    "Challenge Question": "Non-integer coefficients or one linear + one quadratic (Higher Tier).",
  }),
};

const MATHS_QUADRATICS = {
  archetypeKey: "maths-quadratics",
  label: "Quadratics",
  subjectKeys: ["maths"],
  matchPatterns: [/quadratic/i, /discriminant/i, /completing the square/i],
  coreModelPattern: "Identify a, b, c → choose method (factorise / formula / complete square) → find roots → interpret graph features",
  progressionSteps: ["identify coefficients", "select method", "solve", "interpret roots/vertex", "challenge"],
  typicalDiagrams: ["parabola sketch", "discriminant cases table"],
  commonMisconceptions: [
    "Wrong signs in quadratic formula",
    "Discriminant confusion",
    "Factorising when not possible",
  ],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Standard form → method → roots → link to graph (vertex, roots, axis of symmetry)",
  teachingMethodology: mathsMethodology({
    Formula: "ax² + bx + c = 0; quadratic formula; discriminant b² − 4ac; vertex at x = −b/(2a).",
    Method: "Always identify a, b, c first; state chosen method before working; show discriminant when using formula.",
    "Worked Example": "Full substitution into formula OR factorisation with expansion check; state both roots.",
    "Common Error": "Sign errors in formula; skipping discriminant; not linking roots to x-intercepts on graph.",
    "Examiner Method Marks": "M marks for formula setup and substitution; A marks for correct roots and interpretation.",
    "Challenge Question": "Complete the square or interpret how changing c shifts the graph.",
  }),
};

const MATHS_GRAPH = {
  archetypeKey: "maths-graph",
  label: "Graphs",
  subjectKeys: ["maths"],
  matchPatterns: [/graph/i, /plot/i, /gradient/i, /coordinate/i, /y\s*=\s*mx/i, /intercept/i],
  coreModelPattern: "Axes & scale → plot/sketch → read gradient/intercept/turning point → interpret in context",
  progressionSteps: ["axes", "plot", "features", "calculate gradient/intercept", "interpret", "challenge"],
  typicalDiagrams: ["coordinate grid", "gradient triangle rise/run"],
  commonMisconceptions: [
    "Gradient as rise only without run",
    "Scale errors on axes",
    "Confusing intercept with gradient",
  ],
  defaultAssessmentSkills: ["interpret-data", "calculate", "explain"],
  reasoningTemplate: "Graph feature identified → calculation (gradient = Δy/Δx) → meaning in context",
  teachingMethodology: mathsMethodology({
    Formula: "Gradient = change in y / change in x; y = mx + c for linear graphs.",
    Method: "Draw gradient triangle; show coordinates used; label axes with units and consistent scale.",
    "Worked Example": "Find gradient and intercept from graph OR plot from equation with table of values.",
    "Common Error": "Gradient without dividing by Δx; wrong scale reading; unlabelled axes.",
    "Examiner Method Marks": "M marks for method of finding gradient; A marks for correct values and interpretation.",
    "Challenge Question": "Real-world graph (distance-time, conversion graph) with unit interpretation.",
  }),
};

const MATHS_RATIO = {
  archetypeKey: "maths-ratio",
  label: "Ratio",
  subjectKeys: ["maths"],
  matchPatterns: [/ratio/i, /proportion/i, /share/i, /divide in the ratio/i],
  coreModelPattern: "Simplify ratio → find total parts → value of one part → multiply for each share → check sum",
  progressionSteps: ["simplify", "total parts", "one part", "share", "check", "challenge"],
  typicalDiagrams: ["bar model for sharing", "ratio table"],
  commonMisconceptions: [
    "Adding parts incorrectly",
    "Not simplifying first",
    "Confusing ratio with fraction of total wrongly",
  ],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Ratio simplified → total parts → unit share → each part calculated → verification",
  teachingMethodology: mathsMethodology({
    Formula: "Total parts = sum of ratio numbers; one part = total amount ÷ total parts.",
    Method: "Always simplify ratio first; show 'total parts = …'; then 'one part = …'; then each share.",
    "Worked Example": "Full sharing problem with check that shares add to total.",
    "Common Error": "Dividing by wrong total; mixing part-to-part and part-to-whole; no simplification.",
    "Examiner Method Marks": "M marks for correct total parts and one-part calculation; A marks for all shares correct.",
    "Challenge Question": "Combined ratio (e.g. money split between three with given constraints).",
  }),
};

const MATHS_PROBABILITY = {
  archetypeKey: "maths-probability",
  label: "Probability",
  subjectKeys: ["maths"],
  matchPatterns: [/probability/i, /chance/i, /tree diagram/i, /conditional/i, /expected frequency/i],
  coreModelPattern: "Sample space → P(event) = favourable/total → apply AND (×) / OR (+) rules → interpret",
  progressionSteps: ["sample space", "single probability", "combined events", "tree/table", "challenge"],
  typicalDiagrams: ["tree diagram", "Venn diagram", "sample space table"],
  commonMisconceptions: [
    "Adding when should multiply (independent events)",
    "Gambler's fallacy",
    "Probability greater than 1",
  ],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Outcomes listed → favourable/total → rule stated (independent / mutually exclusive) → answer",
  teachingMethodology: mathsMethodology({
    Formula:
      "P(A) = favourable/total; P(A and B) = P(A) × P(B) if independent; P(A or B) adds if mutually exclusive.",
    Method: "Always state event type; show sample space or tree.",
    "Worked Example": "Tree diagram OR two-stage calculation with rule stated at each branch.",
    "Common Error": "Adding independent probabilities; forgetting without-replacement changes second branch.",
    "Examiner Method Marks": "M marks for correct rule stated; A marks for correct probability fraction/decimal.",
    "Challenge Question": "Conditional probability or expected frequency from many trials.",
  }),
};

const MATHS_TRIGONOMETRY = {
  archetypeKey: "maths-trigonometry",
  label: "Trigonometry",
  subjectKeys: ["maths"],
  matchPatterns: [/trigonometry/i, /\bsin\b/i, /\bcos\b/i, /\btan\b/i, /sohcahtoa/i, /sine rule/i, /cosine rule/i],
  coreModelPattern: "Label triangle → choose sin/cos/tan → rearrange formula → calculate → check sensible",
  progressionSteps: ["label sides", "choose ratio", "formula", "rearrange", "calculate", "challenge"],
  typicalDiagrams: ["labelled right-angled triangle", "SOHCAHTOA reference"],
  commonMisconceptions: [
    "Wrong ratio for given sides",
    "Calculator in wrong mode (degrees/radians)",
    "Not labelling opposite/adjacent relative to angle",
  ],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Triangle labelled → ratio chosen → formula rearranged → length/angle found",
  teachingMethodology: mathsMethodology({
    Formula: "sin θ = opp/hyp; cos θ = adj/hyp; tan θ = opp/adj.",
    Method: "Draw and label triangle first; write formula; rearrange before substituting.",
    "Worked Example": "Find missing side with full rearrangement shown.",
    "Common Error": "Using wrong ratio; using wrong angle's opposite; premature rounding.",
    "Examiner Method Marks": "M marks for correct formula and substitution setup; A marks for accurate answer with units.",
    "Challenge Question": "Multi-step problem (angle of elevation, bearings).",
  }),
};

const MATHS_STATISTICS = {
  archetypeKey: "maths-statistics",
  label: "Statistics",
  subjectKeys: ["maths"],
  matchPatterns: [/statistic/i, /mean/i, /median/i, /mode/i, /histogram/i, /cumulative frequency/i, /box plot/i],
  coreModelPattern: "Data → choose measure → calculate with working → interpret → compare groups",
  progressionSteps: ["represent data", "calculate", "interpret", "compare", "challenge"],
  typicalDiagrams: ["histogram", "box plot", "cumulative frequency curve"],
  commonMisconceptions: [
    "Mean vs median in skewed data",
    "Frequency density vs frequency in histograms",
    "Confusing grouped data boundaries",
  ],
  defaultAssessmentSkills: ["calculate", "interpret-data", "compare"],
  reasoningTemplate: "Data type identified → measure calculated → what it shows → comparison/conclusion",
  teachingMethodology: mathsMethodology({
    Formula: "Mean = Σx/n; median = middle value; frequency density = frequency / class width.",
    Method: "Show table of calculations; for grouped data show midpoints × frequency.",
    "Worked Example": "Calculate mean/median from table with all working visible.",
    "Common Error": "Using mean when median more appropriate; histogram area confusion.",
    "Examiner Method Marks": "M marks for correct method column; A marks for accurate measure and interpretation.",
    "Challenge Question": "Compare two datasets using appropriate averages and spread.",
  }),
};

const MATHS_PROOF = {
  archetypeKey: "maths-proof",
  label: "Proof / Reasoning",
  subjectKeys: ["maths"],
  matchPatterns: [/proof/i, /show that/i, /justify/i, /geometric proof/i],
  coreModelPattern: "Given information → logical step with reason → therefore → conclusion",
  progressionSteps: ["state given", "deductive steps with reasons", "therefore", "conclusion"],
  typicalDiagrams: ["annotated geometric diagram"],
  commonMisconceptions: [
    "Assuming what must be proved",
    "Gaps in logic between steps",
    "No reasons given for geometry steps",
  ],
  defaultAssessmentSkills: ["justify", "explain"],
  reasoningTemplate: "Given → deduction with reason → next fact → therefore conclusion",
  teachingMethodology: mathsMethodology({
    Formula: "Geometric reasons: alternate angles, corresponding angles, isosceles triangle, etc.",
    Method: "Every step needs a reason; never assume the conclusion.",
    "Worked Example": "Show that … proof with reasons in brackets for each line.",
    "Common Error": "Circular reasoning; missing reasons; measuring instead of proving.",
    "Examiner Method Marks": "M marks for correct logical step; A marks for complete proof with all reasons.",
    "Challenge Question": "Algebraic proof (e.g. show sum of two odd numbers is even).",
  }),
};

const MATHS_GENERAL = {
  archetypeKey: "maths-general",
  label: "General Maths",
  subjectKeys: ["maths"],
  matchPatterns: [],
  coreModelPattern: "Identify problem type → select method → show working → check → state answer with units/sf",
  progressionSteps: ["identify", "method", "working", "check", "answer"],
  typicalDiagrams: ["worked calculation layout"],
  commonMisconceptions: ["Answer only with no working", "Wrong units or rounding"],
  defaultAssessmentSkills: ["calculate", "explain"],
  reasoningTemplate: "Problem type → method → working → check → answer",
  teachingMethodology: mathsMethodology({
    Formula: "State relevant formula before substituting.",
    Method: "Show every step; do not skip to answer.",
    "Worked Example": "Fully worked with method marks annotated.",
    "Common Error": "No working shown; arithmetic slip uncorrected.",
    "Examiner Method Marks": "Method marks for correct approach; accuracy marks for final answer.",
    "Challenge Question": "Unfamiliar context requiring method selection.",
  }),
};

const MATHS_ARCHETYPES_V42 = [
  MATHS_ALGEBRA,
  MATHS_SIMULTANEOUS,
  MATHS_QUADRATICS,
  MATHS_GRAPH,
  MATHS_RATIO,
  MATHS_PROBABILITY,
  MATHS_TRIGONOMETRY,
  MATHS_STATISTICS,
  MATHS_PROOF,
  MATHS_GENERAL,
];

module.exports = {
  MATHS_ALGEBRA,
  MATHS_SIMULTANEOUS,
  MATHS_QUADRATICS,
  MATHS_GRAPH,
  MATHS_RATIO,
  MATHS_PROBABILITY,
  MATHS_TRIGONOMETRY,
  MATHS_STATISTICS,
  MATHS_PROOF,
  MATHS_GENERAL,
  MATHS_ARCHETYPES_V42,
};
