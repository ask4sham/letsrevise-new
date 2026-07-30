/**
 * Unit tests: V2.2 MCQ rationale inventory classification (read-only).
 */
const {
  classifyCompositeMcqPart,
  NEUTRAL_WHY_CORRECT,
  GENERIC_PATTERN_SOURCES,
  isAdministrativeMarkingLine,
} = require('../utils/classifyMcqRationaleInventory');
const {
  buildMcqRationaleInventoryPipeline,
} = require('../services/examQuestionRationaleInventoryService');
const fs = require('fs');
const path = require('path');

function baseMcq(overrides = {}) {
  return {
    label: 'a',
    type: 'mcq',
    marks: 1,
    questionText: 'Which factor is not essential for seed germination?',
    options: ['Water', 'Oxygen', 'Light', 'Temperature'],
    correctIndex: 2,
    markScheme: ['Award 1 mark for selecting Option C / Light.'],
    ...overrides,
  };
}

describe('classifyCompositeMcqPart', () => {
  test('missing: no partData / no explanation / null', () => {
    expect(classifyCompositeMcqPart(baseMcq()).bucket).toBe('missing');
    expect(classifyCompositeMcqPart(baseMcq({ partData: {} })).bucket).toBe('missing');
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: null } })).bucket).toBe('missing');
  });

  test('empty: empty string / spaces / newlines', () => {
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: '' } })).bucket).toBe('empty');
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: '   ' } })).bucket).toBe('empty');
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: '\n\t' } })).bucket).toBe('empty');
  });

  test('generic patterns', () => {
    const cases = [
      'Light',
      'C',
      'Option C',
      'C — Light',
      'Correct answer: C — Light',
      'The answer is C.',
      'This is correct.',
      'It is the right answer.',
      'Award 1 mark for selecting Light.',
      NEUTRAL_WHY_CORRECT,
    ];
    for (const explanation of cases) {
      const res = classifyCompositeMcqPart(baseMcq({ partData: { explanation } }), {
        subject: 'Biology',
        topicKey: 'edexcel-igcse-biology:germination',
      });
      expect(res.bucket).toBe('generic');
      expect(res.potentiallyEligibleForBackfill).toBe(true);
    }
  });

  test('substantive: concise teacher text and Accepting… scientific wording', () => {
    const cases = [
      'Water activates enzymes.',
      'Seeds use stored food reserves before photosynthesis begins.',
      'The area is 12 cm² because 3 × 4 = 12.',
      'Sodium loses one electron to form a positive ion.',
      'The metaphor creates a vivid image of isolation.',
      'Accepting electrons gives the atom a negative charge.',
      'The correct use of imagery makes the setting feel isolated.',
      'This answer gains the mark because both stages are explained.',
    ];
    for (const explanation of cases) {
      const res = classifyCompositeMcqPart(
        baseMcq({
          partData: { explanation },
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
        }),
        { subject: 'Biology', topicKey: 'bio:x' }
      );
      expect(res.bucket).toBe('substantive');
      expect(res.potentiallyEligibleForBackfill).toBe(false);
    }
  });

  test('Accept mark-scheme lines remain administrative; Accepting science is not', () => {
    expect(isAdministrativeMarkingLine('Accept answers that mention enzymes.')).toBe(true);
    expect(isAdministrativeMarkingLine('Accepting electrons gives the atom a negative charge.')).toBe(false);
    expect(GENERIC_PATTERN_SOURCES.acceptMarkScheme).toMatch(/answers/);
  });

  test('malformed structures', () => {
    expect(classifyCompositeMcqPart(baseMcq({ questionText: '' })).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart(baseMcq({ options: undefined })).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart(baseMcq({ options: 'x' })).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart(baseMcq({ options: ['Only'] })).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart(baseMcq({ correctIndex: -1 })).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart(baseMcq({ correctIndex: 9 })).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart({ type: 'short', questionText: 'x' }).bucket).toBe('malformed');
    expect(classifyCompositeMcqPart(baseMcq({ partData: { explanation: 12 } })).bucket).toBe('malformed');
  });

  test('eligibility requires context and non-archived', () => {
    const missing = classifyCompositeMcqPart(baseMcq(), { subject: 'Biology', topicKey: 't' });
    expect(missing.potentiallyEligibleForBackfill).toBe(true);
    const noCtx = classifyCompositeMcqPart(baseMcq(), { subject: 'Biology' });
    expect(noCtx.potentiallyEligibleForBackfill).toBe(false);
    const archived = classifyCompositeMcqPart(baseMcq(), {
      subject: 'Biology',
      topicKey: 't',
      isArchived: true,
    });
    expect(archived.potentiallyEligibleForBackfill).toBe(false);
  });
});

describe('inventory aggregation pipeline structure', () => {
  test('uses DB pagination — no find/populate/slice full-scan path', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../services/examQuestionRationaleInventoryService.js'),
      'utf8'
    );
    expect(src).toMatch(/aggregate\s*\(/);
    expect(src).not.toMatch(/ExamQuestion\.find\s*\(/);
    expect(src).not.toMatch(/\.populate\s*\(/);
    expect(src).not.toMatch(/\.slice\s*\(/);
    expect(src).not.toMatch(/\ballRows\b/);

    const pipeline = buildMcqRationaleInventoryPipeline({ page: 2, pageSize: 25 });
    expect(pipeline.some((s) => s.$unwind)).toBe(true);
    const facet = pipeline[pipeline.length - 1].$facet;
    expect(facet).toHaveProperty('summaryBuckets');
    expect(facet).toHaveProperty('summaryQuestions');
    expect(facet).toHaveProperty('totalMatching');
    expect(facet).toHaveProperty('items');
    const itemKeys = facet.items.map((s) => Object.keys(s)[0]);
    expect(itemKeys).toEqual(expect.arrayContaining(['$sort', '$skip', '$limit', '$lookup', '$project']));
    const skipIdx = itemKeys.indexOf('$skip');
    const limitIdx = itemKeys.indexOf('$limit');
    const lookupIdx = itemKeys.indexOf('$lookup');
    expect(skipIdx).toBeLessThan(limitIdx);
    expect(limitIdx).toBeLessThan(lookupIdx);
    expect(facet.items[skipIdx].$skip).toBe(25);
    expect(facet.items[limitIdx].$limit).toBe(25);
    const sort = facet.items.find((s) => s.$sort).$sort;
    expect(sort).toHaveProperty('updatedAt', -1);
    expect(sort).toHaveProperty('_id');
    expect(sort['parts.label']).toBe(1);
  });
});
