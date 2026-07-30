/**
 * Integration: DB-paginated read-only MCQ rationale inventory.
 */
const request = require('supertest');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = require('../app');
const User = require('../models/User');
const ExamQuestion = require('../models/ExamQuestion');
const { classifyCompositeMcqPart, NEUTRAL_WHY_CORRECT } = require('../utils/classifyMcqRationaleInventory');
const { buildMcqRationaleInventoryPipeline } = require('../services/examQuestionRationaleInventoryService');

const hashedPassword = bcrypt.hashSync('password123', 10);
jest.setTimeout(60000);

async function loginAs(email, userType = 'admin', staffRole) {
  await User.deleteMany({ email });
  const doc = {
    email,
    password: hashedPassword,
    firstName: 'Inv',
    lastName: 'Tester',
    userType,
    isEmailVerified: true,
  };
  if (staffRole) doc.staffRole = staffRole;
  await User.create(doc);
  const res = await request(app).post('/api/auth/login').send({ email, password: 'password123' });
  expect(res.status).toBe(200);
  return res.body.token || res.body.accessToken || res.body.jwt;
}

function mcqPart(label, explanation, overrides = {}) {
  const part = {
    label,
    type: 'mcq',
    marks: 1,
    questionText: overrides.questionText || ("Which factor is not essential? (" + label + ")"),
    options: overrides.options || ['Water', 'Oxygen', 'Light', 'Temperature'],
    correctIndex: overrides.correctIndex != null ? overrides.correctIndex : 2,
    markScheme: ['Award 1 mark for selecting Option C / Light.'],
  };
  if (explanation === undefined) {
    // omit partData
  } else if (explanation === null) {
    part.partData = { explanation: null };
  } else {
    part.partData = { explanation };
  }
  Object.assign(part, overrides.partExtras || {});
  return part;
}

function compositeDoc(teacherId, overrides = {}) {
  return {
    teacherId,
    subject: 'Biology',
    examBoard: 'Edexcel',
    level: 'IGCSE',
    topic: 'Germination',
    topicKey: 'edexcel-igcse-biology:germination',
    type: 'composite',
    questionMode: 'composite',
    title: 'Seeds',
    sharedStem: 'Seeds need conditions to germinate.',
    question: 'Seeds need conditions to germinate.',
    status: 'published',
    totalMarks: 3,
    marks: 3,
    parts: overrides.parts || [
      mcqPart('a', overrides.explanation),
      {
        label: 'b',
        type: 'short',
        marks: 2,
        questionText: 'Explain why water is needed.',
        markScheme: ['Award 1 mark for activates enzymes.'],
      },
    ],
    ...overrides.doc,
  };
}

describe('GET /api/admin/exam-question-rationale-inventory', () => {
  let adminToken;
  let teacherId;
  let contentManagerToken;

  beforeAll(async () => {
    adminToken = await loginAs('rationale-inv-admin@test.com', 'admin');
    contentManagerToken = await loginAs(
      'rationale-inv-cm@test.com',
      'teacher',
      'content_manager'
    );
    const teacher = await User.create({
      email: 'rationale-inv-owner@test.com',
      password: hashedPassword,
      firstName: 'Owner',
      lastName: 'Teacher',
      userType: 'teacher',
      isEmailVerified: true,
    });
    teacherId = teacher._id;
  });

  beforeEach(async () => {
    await ExamQuestion.deleteMany({ teacherId });
  });

  test('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/admin/exam-question-rationale-inventory');
    expect(res.status).toBe(401);
  });

  test('rejects student', async () => {
    const token = await loginAs('rationale-inv-student@test.com', 'student');
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .set('Authorization', `Bearer ` + token);
    expect(res.status).toBe(403);
  });

  test('rejects ordinary teacher', async () => {
    const token = await loginAs('rationale-inv-teacher@test.com', 'teacher');
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .set('Authorization', `Bearer ` + token);
    expect(res.status).toBe(403);
  });

  test('rejects parent', async () => {
    const token = await loginAs('rationale-inv-parent@test.com', 'parent');
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .set('Authorization', `Bearer ` + token);
    expect(res.status).toBe(403);
  });

  test('rejects unsupported role safely', async () => {
    const token = await loginAs('rationale-inv-weird@test.com', 'student');
    // Force a weird role string on token bearer — login still student → 403
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .set('Authorization', `Bearer ` + token);
    expect(res.status).toBe(403);
  });

  test('content_manager accepted', async () => {
    await ExamQuestion.create(compositeDoc(teacherId, { explanation: undefined }));
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId) })
      .set('Authorization', `Bearer ` + contentManagerToken);
    expect(res.status).toBe(200);
    expect(res.body.readOnly).toBe(true);
  });

  test('admin summary, no writes, no sensitive fields, no owner email', async () => {
    await ExamQuestion.create([
      compositeDoc(teacherId, { explanation: undefined }),
      compositeDoc(teacherId, {
        explanation: '   ',
        doc: { topic: 'Germination 2', topicKey: 'edexcel-igcse-biology:germination-2' },
      }),
      compositeDoc(teacherId, {
        explanation: 'Light',
        doc: { topic: 'Germination 3', topicKey: 'edexcel-igcse-biology:germination-3' },
      }),
      compositeDoc(teacherId, {
        explanation:
          'Light is not essential because the seed uses stored food reserves before photosynthesis.',
        doc: {
          topic: 'Germination 4',
          topicKey: 'edexcel-igcse-biology:germination-4',
          status: 'draft',
        },
      }),
    ]);
    const before = await ExamQuestion.countDocuments({ teacherId });

    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), pageSize: 25 })
      .set('Authorization', `Bearer ` + adminToken);

    expect(res.status).toBe(200);
    expect(res.body.readOnly).toBe(true);
    expect(res.body.summary.countUnit).toBe('mcq_parts');
    expect(res.body.summary.totalCompositeQuestions).toBe(4);
    expect(res.body.summary.totalCompositeMcqParts).toBe(4);
    expect(res.body.summary.missing).toBe(1);
    expect(res.body.summary.empty).toBe(1);
    expect(res.body.summary.generic).toBe(1);
    expect(res.body.summary.substantive).toBe(1);
    expect(res.body.summary.potentiallyEligible).toBe(3);
    expect(res.body.linkedLessonCount.deferred).toBe(true);
    expect(await ExamQuestion.countDocuments({ teacherId })).toBe(before);

    for (const item of res.body.items) {
      expect(item).not.toHaveProperty('password');
      expect(item).not.toHaveProperty('passwordHash');
      expect(item).not.toHaveProperty('token');
      expect(item).not.toHaveProperty('subscription');
      expect(item).not.toHaveProperty('purchases');
      expect(item).not.toHaveProperty('metadata');
      expect(item).not.toHaveProperty('email');
      expect(JSON.stringify(item)).not.toMatch(/@test\.com/);
    }
  });

  test('bucket filter changes rows/totalMatching but not summary coverage', async () => {
    await ExamQuestion.create([
      compositeDoc(teacherId, { explanation: undefined, doc: { topicKey: 'tk-miss' } }),
      compositeDoc(teacherId, { explanation: 'Light', doc: { topicKey: 'tk-gen' } }),
      compositeDoc(teacherId, {
        explanation: 'Water activates enzymes.',
        doc: { topicKey: 'tk-sub' },
      }),
    ]);
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), rationaleBucket: 'missing' })
      .set('Authorization', `Bearer ` + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.totalMatchingParts).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].rationaleBucket).toBe('missing');
    expect(res.body.summary.missing).toBe(1);
    expect(res.body.summary.generic).toBe(1);
    expect(res.body.summary.substantive).toBe(1);
    expect(res.body.summary.totalCompositeMcqParts).toBe(3);
  });

  test('eligibility filter does not collapse summary', async () => {
    await ExamQuestion.create([
      compositeDoc(teacherId, { explanation: undefined, doc: { topicKey: 'tk-e1' } }),
      compositeDoc(teacherId, {
        explanation: 'Water activates enzymes.',
        doc: { topicKey: 'tk-e2' },
      }),
    ]);
    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), potentiallyEligibleForBackfill: 'true' })
      .set('Authorization', `Bearer ` + adminToken);
    expect(res.body.totalMatchingParts).toBe(1);
    expect(res.body.summary.totalCompositeMcqParts).toBe(2);
    expect(res.body.summary.substantive).toBe(1);
    expect(res.body.summary.missing).toBe(1);
  });

  test('bounded pagination: pageSize 25 returns 25 of many; page 2 distinct; max 100', async () => {
    const docs = [];
    const fixedDate = new Date('2024-01-15T12:00:00.000Z');
    for (let i = 0; i < 40; i += 1) {
      docs.push(
        compositeDoc(teacherId, {
          explanation: undefined,
          parts: [
            mcqPart('a', undefined),
            mcqPart('c', 'Light'),
            {
              label: 'b',
              type: 'short',
              marks: 1,
              questionText: 'short',
              markScheme: ['x'],
            },
          ],
          doc: {
            topicKey: `v22-page-` + i,
            topic: `T` + i,
            updatedAt: fixedDate,
          },
        })
      );
    }
    await ExamQuestion.insertMany(docs);
    // 40 questions × 2 MCQ parts = 80 parts

    const pipeline = buildMcqRationaleInventoryPipeline({
      teacherId: String(teacherId),
      page: 1,
      pageSize: 25,
    });
    const itemsFacet = pipeline[pipeline.length - 1].$facet.items;
    expect(itemsFacet.some((s) => s.$limit === 25)).toBe(true);
    expect(itemsFacet.some((s) => s.$skip === 0)).toBe(true);

    const page1 = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), page: 1, pageSize: 25 })
      .set('Authorization', `Bearer ` + adminToken);
    expect(page1.status).toBe(200);
    expect(page1.body.items).toHaveLength(25);
    expect(page1.body.totalMatchingParts).toBe(80);
    expect(page1.body.summary.totalCompositeMcqParts).toBe(80);
    expect(page1.body.summary.totalCompositeQuestions).toBe(40);

    const page2 = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), page: 2, pageSize: 25 })
      .set('Authorization', `Bearer ` + adminToken);
    expect(page2.body.items).toHaveLength(25);
    const keys1 = new Set(page1.body.items.map((i) => i.questionId + ':' + i.partLabel));
    const overlap = page2.body.items.filter((i) => keys1.has(i.questionId + ':' + i.partLabel));
    expect(overlap).toHaveLength(0);

    // Deterministic order with tied updatedAt: sort by _id then part label
    const page1Ids = page1.body.items.map((i) => i.questionId + ':' + i.partLabel);
    const page1b = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), page: 1, pageSize: 25 })
      .set('Authorization', `Bearer ` + adminToken);
    expect(page1b.body.items.map((i) => i.questionId + ':' + i.partLabel)).toEqual(page1Ids);

    const capped = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), pageSize: 500 })
      .set('Authorization', `Bearer ` + adminToken);
    expect(capped.body.pageSize).toBe(100);
    expect(capped.body.items.length).toBeLessThanOrEqual(100);
  });

  test('filter safety: invalid teacherId / bucket / status / regex topic / objects ignored', async () => {
    await ExamQuestion.create(compositeDoc(teacherId, { explanation: undefined }));

    const badTeacher = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: 'not-an-objectid' })
      .set('Authorization', `Bearer ` + adminToken);
    expect(badTeacher.status).toBe(200);
    expect(badTeacher.body.totalMatchingParts).toBe(0);

    const badBucket = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), rationaleBucket: 'nope' })
      .set('Authorization', `Bearer ` + adminToken);
    expect(badBucket.status).toBe(200);
    expect(badBucket.body.summary.totalCompositeMcqParts).toBe(1);

    const regexTopic = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), topic: 'Germ.*(' })
      .set('Authorization', `Bearer ` + adminToken);
    expect(regexTopic.status).toBe(200);

    const objInjection = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), subject: { $gt: '' } })
      .set('Authorization', `Bearer ` + adminToken);
    expect(objInjection.status).toBe(200);
  });

  test('malformed MCQ does not crash; JS/aggregation bucket parity for fixtures', async () => {
    const fixtures = [
      { explanation: undefined, expect: 'missing' },
      { explanation: null, expect: 'missing' },
      { explanation: '', expect: 'empty' },
      { explanation: '   ', expect: 'empty' },
      { explanation: 'Light', expect: 'generic' },
      { explanation: 'C', expect: 'generic' },
      { explanation: 'Option C', expect: 'generic' },
      { explanation: 'C — Light', expect: 'generic' },
      { explanation: 'Correct answer: C — Light', expect: 'generic' },
      { explanation: 'The answer is C.', expect: 'generic' },
      { explanation: 'This is correct.', expect: 'generic' },
      { explanation: 'It is the right answer.', expect: 'generic' },
      { explanation: 'Award 1 mark for selecting Light.', expect: 'generic' },
      { explanation: NEUTRAL_WHY_CORRECT, expect: 'generic' },
      { explanation: 'Water activates enzymes.', expect: 'substantive' },
      {
        explanation: 'Seeds use stored food reserves before photosynthesis begins.',
        expect: 'substantive',
      },
      { explanation: 'The area is 12 cm² because 3 × 4 = 12.', expect: 'substantive' },
      {
        explanation: 'Sodium loses one electron to form a positive ion.',
        expect: 'substantive',
      },
      {
        explanation: 'The metaphor creates a vivid image of isolation.',
        expect: 'substantive',
      },
      {
        explanation: 'Accepting electrons gives the atom a negative charge.',
        expect: 'substantive',
      },
      {
        explanation: 'The correct use of imagery makes the setting feel isolated.',
        expect: 'substantive',
      },
      {
        explanation: 'This answer gains the mark because both stages are explained.',
        expect: 'substantive',
      },
    ];

    for (let i = 0; i < fixtures.length; i += 1) {
      const f = fixtures[i];
      const part = mcqPart('a', f.explanation);
      const js = classifyCompositeMcqPart(part, {
        subject: 'Biology',
        topicKey: `parity-` + i,
      });
      expect(js.bucket).toBe(f.expect);

      await ExamQuestion.create(
        compositeDoc(teacherId, {
          parts: [part],
          doc: { topicKey: `parity-` + i, topic: `P` + i },
        })
      );
    }

    // malformed
    await ExamQuestion.create({
      teacherId,
      subject: 'Biology',
      examBoard: 'Edexcel',
      level: 'IGCSE',
      topic: 'X',
      topicKey: 'v22-inv-malformed-unique:x',
      type: 'composite',
      questionMode: 'composite',
      question: 'Stem',
      sharedStem: 'Stem',
      status: 'published',
      marks: 1,
      parts: [
        {
          label: 'a',
          type: 'mcq',
          marks: 1,
          questionText: '',
          options: ['Only one'],
          correctIndex: 0,
        },
      ],
    });

    const res = await request(app)
      .get('/api/admin/exam-question-rationale-inventory')
      .query({ teacherId: String(teacherId), pageSize: 100 })
      .set('Authorization', `Bearer ` + adminToken);
    expect(res.status).toBe(200);

    for (let i = 0; i < fixtures.length; i += 1) {
      const row = res.body.items.find((it) => it.topicKey === `parity-` + i);
      expect(row).toBeTruthy();
      expect(row.rationaleBucket).toBe(fixtures[i].expect);
    }
    expect(res.body.summary.malformed).toBeGreaterThanOrEqual(1);
  });
});
