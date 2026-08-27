/**
 * Derive required/supporting concepts, exclusions, and conflicts from lesson evidence.
 */

const { classifyBlockToArchitectureSlot } = require("../../lessonBlockAnalysis");
const {
  blockToPlainText,
  extractBoldTerms,
  extractBoldTermDefinitions,
  extractTermDefinitionPairs,
  safeStr,
} = require("../briefs/lessonContentExtractor");
const { listProfileConcepts } = require("../subTopicProfiles");
const {
  createConceptRef,
  dedupeConceptRefs,
  textMentionsConcept,
  normalizeConceptId,
} = require("./conceptNormalization");
const { isTeachingAuthorityBlock, HIGH_AUTHORITY_SLOTS, GENERIC_BLOCK_TITLES } = require("./taughtEvidenceBuilder");

/**
 * @param {object} lesson
 * @returns {import("./types").LearningObjective[]}
 */
function extractLearningObjectives(lesson) {
  const candidates = [];

  const pushCandidate = (text, source) => {
    const t = safeStr(text);
    if (!t) return;
    candidates.push({ text: t, source });
  };

  if (Array.isArray(lesson?.learningObjectives)) {
    for (const obj of lesson.learningObjectives) {
      if (typeof obj === "string") pushCandidate(obj, "lesson.learningObjectives");
      else if (obj && typeof obj === "object") pushCandidate(obj.text || obj.objective, "lesson.learningObjectives");
    }
  }
  if (Array.isArray(lesson?.objectives)) {
    for (const obj of lesson.objectives) pushCandidate(typeof obj === "string" ? obj : obj?.text, "lesson.objectives");
  }
  pushCandidate(lesson?.walt, "lesson.walt");
  pushCandidate(lesson?.wilf, "lesson.wilf");
  if (Array.isArray(lesson?.successCriteria)) {
    for (const sc of lesson.successCriteria) pushCandidate(sc, "lesson.successCriteria");
  }

  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  for (const page of pages) {
    for (const block of page?.blocks || []) {
      const slot = classifyBlockToArchitectureSlot(block);
      const role = safeStr(block.role).toLowerCase();
      if (slot !== "objectives" && role !== "lessonobjectives") continue;
      const plain = blockToPlainText(block);
      const blockTitle = safeStr(block.title).toLowerCase();
      for (const line of plain.split(/\n+/)) {
        const cleaned = safeStr(line).replace(/^[-•*]\s*/, "");
        if (!cleaned) continue;
        if (cleaned.toLowerCase() === blockTitle) continue;
        if (/^lesson objectives$/i.test(cleaned)) continue;
        pushCandidate(cleaned, "block.objectives");
      }
    }
  }

  const seen = new Set();
  const objectives = [];
  for (const item of candidates) {
    const key = item.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const matchTerms = [
      ...new Set(
        [
          ...extractBoldTerms(item.text),
          ...item.text
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 3),
        ].map((t) => safeStr(t).toLowerCase())
      ),
    ]
      .filter(Boolean)
      .sort();
    objectives.push({
      objectiveId: `obj-${objectives.length + 1}`,
      text: item.text,
      matchTerms,
    });
  }

  return objectives;
}

/**
 * @param {object} block
 * @returns {number}
 */
function blockAuthorityWeight(block) {
  const slot = classifyBlockToArchitectureSlot(block);
  const type = safeStr(block.type).toLowerCase();
  if (slot === "objectives") return 5;
  if (slot === "definition") return 4;
  if (slot === "coreModel" || slot === "keyExamples") return 3;
  if (type === "keyidea" || type === "worked-example") return 3;
  if (HIGH_AUTHORITY_SLOTS.has(slot)) return 2;
  return 1;
}

/**
 * Score concept presence across teaching blocks.
 * @param {object} lesson
 * @param {import("./types").LearningObjective[]} learningObjectives
 * @returns {Map<string, { ref: import("./types").ConceptRef, score: number, hasDefinition: boolean }>}
 */
function scoreConceptCandidates(lesson, learningObjectives) {
  const scores = new Map();
  const pages = Array.isArray(lesson?.pages) ? lesson.pages : [];
  const objectiveText = learningObjectives.map((o) => o.text).join("\n");

  const bump = (ref, delta, hasDefinition = false) => {
    if (!ref?.id) return;
    const existing = scores.get(ref.id) || { ref, score: 0, hasDefinition: false };
    existing.score += delta;
    if (hasDefinition) existing.hasDefinition = true;
    if (!existing.ref.name && ref.name) existing.ref = ref;
    scores.set(ref.id, existing);
  };

  for (const page of pages) {
    for (const block of page?.blocks || []) {
      if (!isTeachingAuthorityBlock(block)) continue;
      const plain = blockToPlainText(block);
      if (!plain) continue;
      const weight = blockAuthorityWeight(block);
      const slot = classifyBlockToArchitectureSlot(block);
      const type = safeStr(block.type).toLowerCase();

      for (const pair of extractTermDefinitionPairs(plain)) {
        bump(createConceptRef(pair.term), weight + 2, true);
      }
      for (const pair of extractBoldTermDefinitions(plain)) {
        bump(createConceptRef(pair.term), weight + 2, true);
      }
      for (const term of extractBoldTerms(plain)) {
        const wordCount = term.split(/\s+/).length;
        const centralPhrase = wordCount >= 3 && (type === "keyidea" || slot === "definition");
        bump(createConceptRef(term), weight, centralPhrase);
      }
      const titleLower = safeStr(block.title).toLowerCase();
      if (block.title && !GENERIC_BLOCK_TITLES.has(titleLower)) {
        bump(createConceptRef(block.title), weight, false);
      }
    }
  }

  for (const [id, entry] of scores.entries()) {
    if (textMentionsConcept(objectiveText, entry.ref)) {
      entry.score += 5;
    }
    scores.set(id, entry);
  }

  return scores;
}

/**
 * @param {object} params
 * @returns {{
 *   requiredConcepts: import("./types").ConceptRef[],
 *   supportingConcepts: import("./types").ConceptRef[],
 *   outOfScopeConcepts: import("./types").ConceptRef[],
 *   assessmentExclusions: import("./types").ConceptRef[],
 *   authorityConflicts: import("./types").AuthorityConflict[],
 * }}
 */
function deriveConceptAuthority({
  lesson,
  learningObjectives,
  taughtEvidence,
  teachConceptRefs,
  profile,
}) {
  const taughtConceptIds = new Set(
    (taughtEvidence || []).flatMap((ev) => ev.conceptIds || [])
  );
  const scores = scoreConceptCandidates(lesson, learningObjectives);

  const required = [];
  const supporting = [];

  for (const [id, entry] of scores.entries()) {
    if (!taughtConceptIds.has(id)) continue;
    const isRequired = entry.hasDefinition || entry.score >= 4;
    if (isRequired) required.push(entry.ref);
    else if (entry.score >= 1) supporting.push(entry.ref);
  }

  let requiredConcepts = dedupeConceptRefs(required);
  let supportingConcepts = dedupeConceptRefs(
    supporting.filter((s) => !requiredConcepts.some((r) => r.id === s.id))
  );

  if (profile) {
    const profileConcepts = listProfileConcepts(profile);
    for (const pc of profileConcepts.filter((c) => c.scope === "in_scope" || c.id === profile.centralConceptId)) {
      if (!taughtConceptIds.has(pc.id) && !scores.has(pc.id)) continue;
      const ref = createConceptRef(pc.name, { id: pc.id, matchTerms: pc.matchTerms });
      if (taughtConceptIds.has(pc.id) || [...scores.values()].some((e) => e.ref.id === pc.id)) {
        if (!requiredConcepts.some((r) => r.id === ref.id)) {
          requiredConcepts.push(ref);
        }
      }
    }
    requiredConcepts = dedupeConceptRefs(requiredConcepts);
    supportingConcepts = dedupeConceptRefs(
      supportingConcepts.filter((s) => !requiredConcepts.some((r) => r.id === s.id))
    );
  }

  const outOfScopeConcepts = [];
  const assessmentExclusions = [];
  const authorityConflicts = [];

  if (profile) {
    for (const nc of profile.neighbouringConcepts || []) {
      outOfScopeConcepts.push(createConceptRef(nc.name, { id: nc.id, matchTerms: nc.matchTerms }));
    }
    for (const fc of profile.forbiddenConcepts || []) {
      assessmentExclusions.push(createConceptRef(fc.name, { id: fc.id, matchTerms: fc.matchTerms }));
      if (requiredConcepts.some((r) => r.id === fc.id)) {
        authorityConflicts.push({
          conflictId: `conflict-${normalizeConceptId(fc.id)}`,
          kind: "taught_vs_forbidden",
          conceptId: fc.id,
          message: `Taught evidence supports "${fc.name}" but sub-topic profile marks it forbidden.`,
          source: profile.taxonomyKey,
        });
      }
    }
  }

  return {
    requiredConcepts,
    supportingConcepts,
    outOfScopeConcepts: dedupeConceptRefs(outOfScopeConcepts),
    assessmentExclusions: dedupeConceptRefs(assessmentExclusions),
    authorityConflicts,
  };
}

module.exports = {
  extractLearningObjectives,
  deriveConceptAuthority,
  scoreConceptCandidates,
};
