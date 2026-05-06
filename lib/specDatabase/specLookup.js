import { specEntries as aqaEntries } from "./aqa.js";
import { specEntries as edexcelEntries } from "./edexcel.js";
import { specEntries as ocrEntries } from "./ocr.js";
import { specEntries as eduqasEntries } from "./eduqas.js";
import { specEntries as cceaEntries } from "./ccea.js";

/** @type {import("./schema.js").SpecTopicEntry[]} */
const ALL_ENTRIES = [
  ...aqaEntries,
  ...edexcelEntries,
  ...ocrEntries,
  ...eduqasEntries,
  ...cceaEntries,
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "how",
  "why",
  "not",
  "can",
  "into",
]);

/** Strip tier suffix from topic string (form passes "Topic (Higher Tier)"). */
export function normaliseTopicInput(topic = "") {
  return String(topic || "")
    .replace(/\(\s*(higher|foundation)\s+tier\s*\)/gi, "")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .trim();
}

/** Same-word variants for GCSE topic titles (plurals, common board phrasing). */
const TOKEN_ALIASES = {
  bacteria: ["bacterial"],
  bacterial: ["bacteria"],
  disease: ["diseases"],
  diseases: ["disease"],
  tissue: ["tissues"],
  tissues: ["tissue"],
  microscope: ["microscopy"],
  microscopy: ["microscope"],
};

function addExpandedTopicTokens(set, word) {
  const w = String(word || "").toLowerCase();
  if (!w || w.length < 2) return;
  set.add(w);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) {
    set.add(w.slice(0, -1));
  }
  const aliases = TOKEN_ALIASES[w];
  if (aliases) {
    for (const a of aliases) set.add(a);
  }
}

/** Tokens used for overlap: de-pluralise + alias (e.g. AQA “Infection and Response” titles). */
function topicMatchTokenSet(words) {
  const set = new Set();
  for (const raw of words) {
    const w = String(raw || "").toLowerCase();
    if (w.length <= 2 || STOP_WORDS.has(w)) continue;
    addExpandedTopicTokens(set, w);
  }
  return set;
}

export function normaliseBoardKey(raw = "") {
  const titled = String(raw || "").trim();
  const b = titled.toLowerCase();
  if (!b) return "";
  // WJEC, Eduqas, and combined labels (incl. slash or space) → canonical UI board key
  if (b === "eduqas" || b === "wjec" || b.includes("wjec") || b.includes("eduqas")) {
    return "WJEC / Eduqas";
  }
  if (/\bocr\b/i.test(titled)) return "OCR";
  if (b === "aqa") return "AQA";
  if (b.includes("edexcel")) return "Edexcel";
  if (b === "pearson") return "Edexcel";
  if (b === "ccea") return "CCEA";
  return titled;
}

export function normaliseSubjectKey(raw = "") {
  return String(raw || "").trim();
}

export function normaliseKeyStageKey(raw = "") {
  return String(raw || "").trim();
}

function slugWords(s = "") {
  return normaliseTopicInput(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Extra tokens so alternate phrasing matches canonical topic titles (e.g. Pearson boards).
 * @param {string} topicClean
 * @param {string[]} words
 */
function augmentQueryWords(topicClean, words) {
  const t = topicClean.toLowerCase();
  const out = [...words];
  const has = (w) => out.includes(w);
  if (t.includes("chemistry") && t.includes("atmosphere") && !has("earth")) {
    out.push("earth");
  }
  if (
    (/\bradioactivity\b/.test(t) || /\bradioactive\b/.test(t)) &&
    !has("radiation")
  ) {
    out.push("radiation", "nuclear", "decay");
  }
  if (
    (/\batomic\b/.test(t) && /\bradiation\b/.test(t)) ||
    /\batomic structure and radiation\b/.test(t)
  ) {
    if (!has("radioactivity")) out.push("radioactivity");
  }
  return out;
}

function tokenOverlapScore(a, b) {
  const sa = topicMatchTokenSet(a);
  const sb = topicMatchTokenSet(b);
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const w of sa) {
    if (sb.has(w)) inter += 1;
  }
  const union = new Set([...sa, ...sb]).size;
  return inter / union;
}

/** Extra phrases → canonical topic; keys match entry.topic lowercased (Phase 2 AQA Biology + legacy). */
const TOPIC_EXTRA_SIGNALS = {
  "cell structure": [
    "eukaryote",
    "eukaryotes",
    "prokaryote",
    "prokaryotes",
    "nucleus",
    "mitochondria",
    "chloroplast",
    "cell",
    "wall",
    "membrane",
  ],
  "cell differentiation": [
    "differentiate",
    "specialised",
    "specialized",
    "stem",
    "meristem",
  ],
  microscopy: [
    "microscope",
    "magnification",
    "resolution",
    "electron",
    "light",
    "image",
    "eyepiece",
    "objective",
    "scale",
    "required",
    "practical",
  ],
  "plant cell organisation": [
    "plant",
    "tissue",
    "tissues",
    "palisade",
    "mesophyll",
    "epidermal",
    "xylem",
    "phloem",
    "leaf",
    "guard",
    "stomata",
    "organisation",
    "organization",
    "meristem",
  ],
  "transport in plants": [
    "transpiration",
    "translocation",
    "xylem",
    "phloem",
    "stomata",
    "guard",
    "root",
    "hair",
    "water",
    "mineral",
    "transpire",
  ],
  "communicable diseases": [
    "communicable",
    "infectious",
    "infection",
    "response",
    "pathogen",
    "pathogens",
    "spread",
    "direct",
    "air",
    "water",
    "virus",
    "bacteria",
    "fungal",
    "protist",
  ],
  "bacterial diseases": [
    "bacterial",
    "bacteria",
    "salmonella",
    "gonorrhoea",
    "gonorrhea",
    "toxin",
    "food",
    "poisoning",
    "resistant",
  ],
  "viral diseases": [
    "viral",
    "virus",
    "measles",
    "hiv",
    "aids",
    "tmv",
    "mosaic",
    "tobacco",
  ],
  "fungal diseases": [
    "fungal",
    "fungus",
    "fungi",
    "black",
    "spot",
    "rose",
    "fungicide",
  ],
  "protist diseases": [
    "protist",
    "malaria",
    "mosquito",
    "vector",
    "fever",
  ],
  "human defence systems": [
    "defence",
    "defense",
    "immune",
    "white",
    "blood",
    "phagocytosis",
    "antibody",
    "antitoxin",
    "skin",
    "stomach",
  ],
  vaccination: [
    "vaccine",
    "immunis",
    "immuniz",
    "herd",
    "antibody",
    "inactive",
  ],
  "antibiotics and painkillers": [
    "antibiotic",
    "penicillin",
    "painkiller",
    "paracetamol",
    "symptom",
    "virus",
    "resistant",
  ],
  "drug development": [
    "clinical",
    "trial",
    "trials",
    "placebo",
    "preclinical",
    "toxicity",
    "peer",
    "review",
    "fleming",
  ],
  "monoclonal antibodies": [
    "monoclonal",
    "hybridoma",
    "antibody",
    "clone",
    "pregnancy",
    "fluorescent",
    "cancer",
  ],
  photosynthesis: [
    "chlorophyll",
    "chloroplast",
    "glucose",
    "carbon",
    "dioxide",
    "oxygen",
    "light",
    "limiting",
    "pondweed",
  ],
  respiration: [
    "aerobic",
    "anaerobic",
    "lactic",
    "ethanol",
    "fermentation",
    "glucose",
    "oxygen",
    "exercise",
    "mitochondria",
  ],
  homeostasis: [
    "receptor",
    "effector",
    "internal",
    "temperature",
    "optimum",
    "blood",
    "glucose",
  ],
  "nervous system": [
    "neurone",
    "neuron",
    "synapse",
    "cns",
    "reflex",
    "brain",
    "spinal",
    "impulse",
    "receptor",
  ],
  "hormonal control": [
    "hormone",
    "endocrine",
    "pituitary",
    "insulin",
    "glucagon",
    "pancreas",
    "menstrual",
    "adrenal",
    "thyroid",
  ],
  inheritance: [
    "allele",
    "gene",
    "dna",
    "chromosome",
    "genotype",
    "phenotype",
    "punnett",
    "dominant",
    "recessive",
    "gamete",
  ],
  "variation and evolution": [
    "variation",
    "mutation",
    "natural",
    "selection",
    "evolution",
    "species",
    "selective",
    "breeding",
    "darwin",
    "wallace",
    "mendel",
  ],
  ecology: [
    "ecosystem",
    "habitat",
    "biodiversity",
    "food",
    "chain",
    "web",
    "biotic",
    "abiotic",
    "carbon",
    "cycle",
    "quadrat",
    "transect",
    "pyramid",
    "biomass",
  ],
  enzymes: [
    "catalyst",
    "catalyse",
    "active",
    "site",
    "substrate",
    "denature",
    "lock",
    "temperature",
    "ph",
  ],
  "periodic table": [
    "group",
    "period",
    "trend",
    "reactivity",
    "shell",
    "noble",
    "metal",
    "halogen",
    "alkali",
  ],
  "earth and atmosphere": [
    "atmosphere",
    "greenhouse",
    "climate",
    "carbon",
    "oxygen",
    "pollution",
    "combustion",
    "ozone",
    "chemistry",
    "air",
    "nitrogen",
  ],
  "particle model": [
    "matter",
    "kinetic",
    "internal",
    "energy",
    "gas",
    "pressure",
    "state",
    "solid",
    "liquid",
    "heat",
    "temperature",
    "latent",
    "density",
  ],
  "atomic structure and radiation": [
    "radioactive",
    "radioactivity",
    "nuclear",
    "decay",
    "half",
    "alpha",
    "beta",
    "gamma",
    "ionis",
    "isotope",
  ],
  radioactivity: [
    "radioactive",
    "radiation",
    "nuclear",
    "decay",
    "half",
    "alpha",
    "beta",
    "gamma",
    "ionis",
    "isotope",
    "atom",
  ],
  "space physics": [
    "orbit",
    "satellite",
    "star",
    "planet",
    "galaxy",
    "universe",
    "shift",
    "hubble",
    "main",
    "sequence",
    "black",
    "hole",
    "neutron",
    "red",
    "dwarf",
  ],
};

/**
 * Normalise tier for filtering (Foundation / Higher / unspecified).
 * @param {string} tier
 * @returns {"foundation" | "higher" | ""}
 */
export function normaliseTierFilter(tier = "") {
  const t = String(tier || "").toLowerCase();
  if (/\bhigher\b/.test(t)) return "higher";
  if (/\bfoundation\b/.test(t)) return "foundation";
  return "";
}

/**
 * Infer qualificationType from UI subject label.
 * @param {string} subject
 * @returns {"single-science" | "combined-science" | ""}
 */
export function inferQualificationTypeFromSubject(subject = "") {
  const s = String(subject || "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("combined")) return "combined-science";
  if (s === "biology" || s === "chemistry" || s === "physics") return "single-science";
  return "";
}

function tierFromTopicString(topic = "") {
  return normaliseTierFilter(topic);
}

/**
 * @param {import("./schema.js").SpecRequiredContentEntry | string} item
 */
export function normalizeContentItem(item) {
  if (typeof item === "string") {
    return {
      text: item,
      tier: null,
      qualificationType: null,
      flags: {},
    };
  }
  if (item && typeof item === "object" && item !== null && "text" in item) {
    return {
      text: String(item.text),
      tier: item.tier || null,
      qualificationType: item.qualificationType || null,
      flags: item.flags || {},
    };
  }
  return { text: String(item), tier: null, qualificationType: null, flags: {} };
}

function includeRequiredContentItem(n, ctx) {
  const { tierMode, qualificationType } = ctx;
  if (tierMode === "foundation") {
    if (n.tier === "higher") return false;
    if (n.flags?.higherOnly) return false;
  }
  if (qualificationType === "combined-science") {
    if (n.flags?.biologyOnly) return false;
    if (n.qualificationType === "single-science") return false;
  }
  return true;
}

function filterRequiredPracticals(practicals, ctx) {
  const list = practicals || [];
  if (ctx.qualificationType !== "combined-science") {
    return { list: [...list], excluded: 0 };
  }
  const out = [];
  let excluded = 0;
  for (const p of list) {
    const s = String(p);
    if (/\bbiology\s+only\b/i.test(s)) {
      excluded++;
      continue;
    }
    out.push(p);
  }
  return { list: out, excluded };
}

/**
 * @param {import("./schema.js").SpecTopicEntry} entry
 * @param {{ tierMode: string, qualificationType: string }} ctx
 */
export function filterSpecEntryForContext(entry, ctx) {
  if (!entry) {
    return { entry: null, excludedItemsCount: 0, excludedPracticalsCount: 0 };
  }
  let excludedItemsCount = 0;
  const requiredContent = [];
  for (const item of entry.requiredContent || []) {
    const n = normalizeContentItem(item);
    if (!includeRequiredContentItem(n, ctx)) {
      excludedItemsCount++;
      continue;
    }
    requiredContent.push(n.text);
  }
  const practResult = filterRequiredPracticals(entry.requiredPracticals, ctx);

  return {
    entry: {
      ...entry,
      requiredContent,
      requiredPracticals: practResult.list,
    },
    excludedItemsCount,
    excludedPracticalsCount: practResult.excluded,
  };
}

function entryEligibleForTier(entry, tierMode) {
  if (!tierMode || tierMode === "higher") return true;
  const et = entry.tier || "both";
  if (tierMode === "foundation" && et === "higher") return false;
  return true;
}

function entryEligibleForCombined(entry) {
  if (entry.contentFlags?.biologyOnly) return false;
  if (entry.contentFlags?.singleScienceOnly) return false;
  return true;
}

function scoreCandidate(
  e,
  qWords,
  topicClean,
  bacterialDiseaseIntent,
  viralIntent,
  atomicRadiationIntent
) {
  const entryWords = slugWords(e.topic);
  let score = tokenOverlapScore(qWords, entryWords);

  const extra = TOPIC_EXTRA_SIGNALS[e.topic.toLowerCase()];
  if (extra) {
    const qTokens = topicMatchTokenSet(qWords);
    let hit = 0;
    for (const w of extra) {
      if (qTokens.has(w)) hit += 1;
    }
    const ratioScore = (hit / Math.max(extra.length, 1)) * 0.85;
    const strongSignal = hit >= 3 ? 0.9 : ratioScore;
    score = Math.max(score, strongSignal);
  }

  if (e.topic.toLowerCase() === topicClean.toLowerCase()) {
    score = Math.max(score, 1);
  }

  if (atomicRadiationIntent && e.topic === "Atomic structure" && e.route === "chemistry") {
    score *= 0.5;
  }
  if (atomicRadiationIntent && e.topic === "Radioactivity") {
    score = Math.max(score, 0.97);
  }
  if (atomicRadiationIntent && e.topic === "Atomic structure and radiation") {
    score = Math.max(score, 0.97);
  }

  if (bacterialDiseaseIntent && e.topic === "Bacterial diseases") {
    score = Math.max(score, 0.96);
  }
  if (bacterialDiseaseIntent && e.topic === "Communicable diseases") {
    score *= 0.62;
  }
  if (viralIntent && e.topic === "Viral diseases") {
    score = Math.max(score, 0.96);
  }
  if (viralIntent && e.topic === "Communicable diseases") {
    score *= 0.72;
  }

  return score;
}

/**
 * @param {{
 *   subject?: string;
 *   keyStage?: string;
 *   examBoard?: string;
 *   topic?: string;
 *   tier?: string;
 *   qualification?: string;
 *   qualificationType?: string;
 * }} params
 * @returns {import("./schema.js").SpecLookupResult}
 */
export function findSpecEntry(params = {}) {
  const {
    subject = "",
    keyStage = "",
    examBoard = "",
    topic = "",
    tier: tierParam = "",
    qualification = "",
    qualificationType: qualificationTypeParam = "",
  } = params;

  const emptyMatch = (reason) => ({
    entry: null,
    matchInfo: {
      exact: false,
      partial: false,
      reason,
      excludedItemsCount: 0,
      combinedScienceFallback: false,
      combinedScienceRejected: false,
      contentFilteredNote: false,
    },
  });

  const subj = normaliseSubjectKey(subject);
  const ks = normaliseKeyStageKey(keyStage);
  const board = normaliseBoardKey(examBoard);
  const topicClean = normaliseTopicInput(topic);
  if (!subj || !ks || !board || !topicClean) {
    return emptyMatch("Missing subject, key stage, exam board, or topic.");
  }

  const tierFromParam = normaliseTierFilter(tierParam);
  const tierFromTop = tierFromTopicString(topic);
  const tierMode = tierFromParam || tierFromTop;

  const qualificationType =
    qualificationTypeParam ||
    inferQualificationTypeFromSubject(subj) ||
    (String(qualification || "").toLowerCase().includes("combined")
      ? "combined-science"
      : "");

  const qWords = augmentQueryWords(topicClean, slugWords(topicClean));
  const qJoined = qWords.join(" ");
  const bacterialDiseaseIntent =
    /\bbacteria\b|\bbacterial\b/.test(qJoined) &&
    (/disease|diseases|infection/.test(topicClean.toLowerCase()) ||
      /response/.test(topicClean.toLowerCase()));
  const viralIntent = /\bviral\b|\bvirus\b|\bmeasles\b|\bhiv\b|\btmv\b/.test(
    topicClean.toLowerCase()
  );
  const atomicRadiationIntent =
    /\batomic\b/i.test(topicClean) && /\bradiation\b/i.test(topicClean);

  let candidates = ALL_ENTRIES.filter((e) => e.board === board && e.keyStage === ks);

  if (subj === "Combined Science") {
    candidates = candidates.filter(
      (e) => e.subject === "Combined Science" || e.subject === "Biology"
    );
  } else {
    candidates = candidates.filter((e) => e.subject === subj);
  }

  let combinedScienceFallback = false;

  if (qualificationType === "combined-science") {
    const nonBioOnly = candidates.filter((e) => entryEligibleForCombined(e));
    if (!nonBioOnly.length) {
      return {
        entry: null,
        matchInfo: {
          exact: false,
          partial: true,
          reason:
            "No Combined Science (Trilogy) — safe database row for this topic. Local rows are Biology-only (separate science) for this topic.",
          excludedItemsCount: 0,
          combinedScienceFallback: false,
          combinedScienceRejected: true,
          contentFilteredNote: false,
        },
      };
    }
    candidates = nonBioOnly;

    const combinedRows = candidates.filter(
      (e) =>
        e.subject === "Combined Science" ||
        e.qualificationType === "combined-science" ||
        e.qualificationType === "both"
    );
    if (combinedRows.length) {
      candidates = combinedRows;
    } else {
      combinedScienceFallback = true;
    }
  } else if (qualificationType === "single-science") {
    candidates = candidates.filter((e) =>
      ["single-science", "both", "", undefined].includes(e.qualificationType)
    );
  }

  const candidatesBeforeTierFilter = candidates;

  if (tierMode === "foundation") {
    candidates = candidates.filter((e) => entryEligibleForTier(e, tierMode));
  }

  if (!candidates.length) {
    return {
      entry: null,
      matchInfo: {
        exact: false,
        partial: true,
        reason:
          tierMode === "foundation"
            ? "No specification rows remain after Foundation-tier filters (topic may be higher-tier only in the local database)."
            : "No candidate rows after subject/tier filters.",
        excludedItemsCount: 0,
        combinedScienceFallback,
        combinedScienceRejected: false,
        contentFilteredNote: false,
      },
    };
  }

  let best = null;
  let bestScore = 0;

  for (const e of candidates) {
    const score = scoreCandidate(
      e,
      qWords,
      topicClean,
      bacterialDiseaseIntent,
      viralIntent,
      atomicRadiationIntent
    );
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }

  if (!best || bestScore < 0.35) {
    if (tierMode === "foundation" && candidatesBeforeTierFilter.length) {
      let bestAll = null;
      let bestAllScore = 0;
      for (const e of candidatesBeforeTierFilter) {
        const score = scoreCandidate(
          e,
          qWords,
          topicClean,
          bacterialDiseaseIntent,
          viralIntent,
          atomicRadiationIntent
        );
        if (score > bestAllScore) {
          bestAllScore = score;
          bestAll = e;
        }
      }
      if (
        bestAll &&
        bestAllScore >= 0.35 &&
        !entryEligibleForTier(bestAll, tierMode)
      ) {
        return {
          entry: null,
          matchInfo: {
            exact: false,
            partial: true,
            reason:
              "The best-matching specification row for this topic is Higher-tier only in the local database; it is omitted for Foundation Tier lessons.",
            excludedItemsCount: 0,
            combinedScienceFallback,
            combinedScienceRejected: false,
            contentFilteredNote: false,
          },
        };
      }
    }
    return emptyMatch("No close topic match in the local specification database.");
  }

  const ctx = { tierMode, qualificationType };
  const filtered = filterSpecEntryForContext(best, ctx);
  const totalExcluded =
    filtered.excludedItemsCount + (filtered.excludedPracticalsCount || 0);

  const combinedScienceRejected = false;
  const exact =
    best.topic.toLowerCase() === topicClean.toLowerCase() &&
    !combinedScienceFallback &&
    !combinedScienceRejected &&
    totalExcluded === 0;
  const partial = combinedScienceFallback || combinedScienceRejected || totalExcluded > 0;

  let reason = "Matched local specification row for this topic context.";
  if (combinedScienceFallback) {
    reason =
      "Local database has no Combined Science-specific entry for this topic; using Biology entry as a partial guide — verify before publishing.";
  }
  if (totalExcluded > 0) {
    reason += ` ${totalExcluded} specification bullet(s)/practical line(s) omitted for tier/qualification context.`;
  }

  return {
    entry: filtered.entry,
    matchInfo: {
      exact,
      partial,
      reason,
      excludedItemsCount: totalExcluded,
      combinedScienceFallback,
      combinedScienceRejected,
      contentFilteredNote: totalExcluded > 0,
    },
  };
}

/**
 * @param {import("./schema.js").SpecTopicEntry | import("./schema.js").SpecLookupResult | null} specOrResult
 * @returns {string}
 */
export function buildSpecPromptSection(specOrResult) {
  const matchInfo =
    specOrResult &&
    typeof specOrResult === "object" &&
    specOrResult !== null &&
    "matchInfo" in specOrResult
      ? specOrResult.matchInfo
      : null;
  const specEntry =
    specOrResult &&
    typeof specOrResult === "object" &&
    specOrResult !== null &&
    "entry" in specOrResult
      ? specOrResult.entry
      : specOrResult;

  if (!specEntry) {
    let extra = "";
    if (matchInfo?.combinedScienceRejected) {
      extra = `
Context note: ${matchInfo.reason}
`;
    }
    return `
--------------------------------
SPECIFICATION ALIGNMENT
--------------------------------
No local specification entry found for this exact topic.
Use exam-board appropriate GCSE content, but avoid claiming exact specification coverage.
${extra}
`;
  }

  const lines = (specEntry.requiredContent || []).map((p) => `- ${p}`).join("\n");
  const skills = (specEntry.requiredSkills || []).filter(Boolean);
  const pract = (specEntry.requiredPracticals || []).filter(Boolean);
  const misc = (specEntry.commonMisconceptions || []).filter(Boolean);
  const linked = (specEntry.linkedTopics || []).filter(Boolean);

  const skillsBlock =
    skills.length > 0
      ? `\nRequired exam skills:\n${skills.map((s) => `- ${s}`).join("\n")}\n`
      : "";
  const practBlock =
    pract.length > 0
      ? `\nRequired practical links:\n${pract.map((s) => `- ${s}`).join("\n")}\n`
      : "";
  const miscBlock =
    misc.length > 0
      ? `\nCommon misconceptions to address:\n${misc.map((s) => `- ${s}`).join("\n")}\n`
      : "";
  const linkedBlock =
    linked.length > 0
      ? `\nLinked topics:\n${linked.map((s) => `- ${s}`).join("\n")}\n`
      : "";

  let filterNotes = "";
  if (matchInfo?.contentFilteredNote) {
    filterNotes += `
Note: Some higher-only or single-science-only specification bullets were excluded for this lesson context.
`;
  }
  if (matchInfo?.combinedScienceFallback) {
    filterNotes += `
Warning: Local database has no Combined Science-specific entry for this topic. Using Biology entry as a partial guide; verify before publishing.
`;
  }

  const qualLine = specEntry.qualification
    ? `Qualification: ${specEntry.qualification}\n`
    : "";
  const routeLine = specEntry.route
    ? `Strand: ${specEntry.route}\n`
    : "";

  return `
--------------------------------
SPECIFICATION ALIGNMENT
--------------------------------
Exam Board: ${specEntry.board}
${qualLine}${routeLine}Topic: ${specEntry.topic}
Spec Code: ${specEntry.specCode}
Source note: ${specEntry.sourceNote}
${filterNotes}
You MUST explicitly cover:
${lines || "- (no required content bullets in starter row)"}
${skillsBlock}${practBlock}${miscBlock}${linkedBlock}
`;
}

export { ALL_ENTRIES };
