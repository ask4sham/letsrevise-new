/**
 * Canonical shape for a specification-linked topic row (Phase 1–2b).
 * Phase 1 starter rows use STARTER_SOURCE_NOTE; Phase 2+ board rows use board-specific notes (AQA, Trilogy, Edexcel, OCR, WJEC / Eduqas, etc.).
 *
 * @typedef {"single-science" | "combined-science" | "both"} SpecQualificationType
 * @typedef {"foundation" | "higher" | "both"} SpecTierScope
 * @typedef {"biology" | "chemistry" | "physics" | "combined"} SpecRoute
 *
 * @typedef {Object} SpecContentFlags
 * @property {boolean} [biologyOnly] separate-science / Biology-only statements (not Trilogy-safe)
 * @property {boolean} [singleScienceOnly] entry not suitable for GCSE Combined Science (e.g. some Physics topics)
 * @property {boolean} [higherOnly] higher-tier-only statements
 * @property {boolean} [requiredPractical] row emphasises required practicals (informational)
 * @property {boolean} [mathsSkill] maths skills (MS) emphasis
 * @property {boolean} [workingScientifically] WS emphasis
 *
 * @typedef {Object} SpecRequiredContentItem
 * @property {string} text
 * @property {SpecTierScope} [tier] when set to "higher", item excluded for foundation lessons
 * @property {SpecQualificationType} [qualificationType] e.g. single-science-only bullet
 * @property {SpecContentFlags} [flags] per-item flags (higherOnly, biologyOnly, …)
 *
 * @typedef {string | SpecRequiredContentItem} SpecRequiredContentEntry backward-compatible string or rich item
 *
 * @typedef {Object} SpecMatchInfo
 * @property {boolean} exact
 * @property {boolean} partial
 * @property {string} reason
 * @property {number} excludedItemsCount bullets/practical lines omitted by tier/qualification filters
 * @property {boolean} [combinedScienceFallback] using Biology row where no Combined row exists
 * @property {boolean} [combinedScienceRejected] topic not applied for Combined (e.g. Biology-only topic)
 * @property {boolean} [contentFilteredNote] some bullets were excluded for this lesson context
 *
 * @typedef {Object} SpecLookupResult
 * @property {SpecTopicEntry | null} entry
 * @property {SpecMatchInfo} matchInfo
 *
 * @typedef {Object} SpecTopicEntry
 * @property {string} id
 * @property {string} board
 * @property {string} subject
 * @property {string} keyStage
 * @property {string} qualification
 * @property {string} topic
 * @property {string} specCode
 * @property {string} title
 * @property {SpecRequiredContentEntry[]} requiredContent
 * @property {string[]} requiredSkills
 * @property {string[]} requiredPracticals
 * @property {string[]} commonMisconceptions
 * @property {string[]} examCommandWords
 * @property {string[]} linkedTopics
 * @property {string} sourceNote
 * @property {SpecQualificationType} [qualificationType] default single-science for GCSE Bio rows
 * @property {SpecTierScope} [tier] entry-level tier scope (both | higher | foundation)
 * @property {SpecRoute} [route] strand hint
 * @property {SpecContentFlags} [contentFlags] entry-level flags
 */

export const STARTER_SOURCE_NOTE =
  "Starter entry — verify against official specification before publishing.";

/** Phase 2+ official-board rows: always re-check live PDF/HTML before publishing. */
export const OFFICIAL_AQA_SOURCE_NOTE =
  "Official AQA specification-aligned entry — verify wording against latest AQA specification before publishing.";

/** AQA Combined Science: Trilogy (8464 series) — concise summaries; verify against current AQA PDF/HTML. */
export const OFFICIAL_AQA_TRILOGY_SOURCE_NOTE =
  "Official AQA Combined Science: Trilogy specification-aligned entry — verify wording against latest AQA specification before publishing.";

/** Pearson Edexcel GCSE sciences — concise summaries; verify against live specification materials. */
export const OFFICIAL_EDEXCEL_SOURCE_NOTE =
  "Official Edexcel specification-aligned entry — verify wording against latest Pearson Edexcel specification before publishing.";

/** OCR GCSE sciences — concise summaries; verify against OCR-published specifications. */
export const OFFICIAL_OCR_SOURCE_NOTE =
  "Official OCR specification-aligned entry — verify wording against latest OCR specification before publishing.";

/** WJEC / Eduqas GCSE sciences — verify against current WJEC and Eduqas specification materials. */
export const OFFICIAL_EDUQAS_SOURCE_NOTE =
  "Official WJEC / Eduqas specification-aligned entry — verify wording against latest WJEC / Eduqas specification before publishing.";
