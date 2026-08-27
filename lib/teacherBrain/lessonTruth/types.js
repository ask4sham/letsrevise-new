/**
 * Lesson Truth — semantic authority types (JSDoc only, Phase 1).
 *
 * Lesson Truth is an allow-list authority: direct assessment must map to
 * requiredConcept + taughtEvidence. Operational metadata lives outside semantic.
 */

/**
 * @typedef {object} ConceptRef
 * @property {string} id Stable normalized slug
 * @property {string} name Human-readable label
 * @property {string[]} matchTerms Lower-case match terms for alignment
 */

/**
 * @typedef {object} LearningObjective
 * @property {string} objectiveId Stable objective identifier
 * @property {string} text Objective statement
 * @property {string[]} [matchTerms] Normalized terms linked to the objective
 */

/**
 * @typedef {object} TaughtEvidence
 * @property {string} evidenceId Stable evidence record id
 * @property {number} pageIndex Zero-based page index
 * @property {string} blockId Block identifier within the page
 * @property {string} blockRole Block role when present
 * @property {string} blockType Block type when present
 * @property {string[]} conceptIds Concept refs evidenced by this block
 * @property {string[]} objectiveIds Linked objective ids when applicable
 * @property {string} summary Short bounded summary of teaching content
 * @property {string[]} matchTerms Terms used for traceability
 */

/**
 * @typedef {object} MisconceptionRecord
 * @property {string} id Stable id
 * @property {string} text Misconception or correction line
 * @property {string[]} [conceptIds] Related concept ids when known
 */

/**
 * @typedef {object} AuthorityConflict
 * @property {string} conflictId Stable conflict id
 * @property {string} kind Conflict category (e.g. taught_vs_forbidden)
 * @property {string} conceptId Affected concept id
 * @property {string} message Deterministic description
 * @property {string} [source] Profile or boundary source when applicable
 */

/**
 * @typedef {object} LessonTruthSemantic
 * @property {string} version Semantic schema version
 * @property {string} lessonTitle
 * @property {string} subject
 * @property {string} level
 * @property {string} examBoard
 * @property {string} tier
 * @property {string} topicKey
 * @property {string} specKey
 * @property {LearningObjective[]} learningObjectives
 * @property {ConceptRef[]} requiredConcepts
 * @property {ConceptRef[]} supportingConcepts
 * @property {ConceptRef[]} outOfScopeConcepts Informational only — not auto-derived from absence
 * @property {ConceptRef[]} assessmentExclusions Explicit/high-confidence hard exclusions only
 * @property {MisconceptionRecord[]} misconceptions
 * @property {string[]} vocabulary
 * @property {TaughtEvidence[]} taughtEvidence
 * @property {object[]} assessmentTargets Phase 1: always empty (deferred)
 * @property {AuthorityConflict[]} authorityConflicts
 */

/**
 * @typedef {object} LessonTruthMeta
 * @property {string} generatedAt ISO timestamp — operational only, excluded from semantic hash
 * @property {string} builderVersion Builder implementation version
 * @property {string} contentHash SHA-256 of canonical semantic payload
 * @property {string} inputContentHash SHA-256 of normalized lesson input relevant to truth
 * @property {string|null} subTopicProfileKey Matched sub-topic profile key if any
 * @property {string|null} topicProfileKey Matched topic profile key if any
 * @property {boolean} targetsDeferred Whether assessment target planning is deferred
 */

/**
 * @typedef {object} LessonTruthEnvelope
 * @property {LessonTruthSemantic} semantic Deterministic pedagogical authority payload
 * @property {LessonTruthMeta} meta Operational metadata envelope
 */

module.exports = {};
