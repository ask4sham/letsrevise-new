// backend/tests/assessmentAttempts.integration.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app'); // Assuming your Express app is exported from app.js
const AssessmentAttempt = require('../models/AssessmentAttempt');
const AssessmentPaper = require('../models/AssessmentPaper');
const AssessmentItem = require('../models/AssessmentItem');
const User = require('../models/User');
const bcrypt = require('bcryptjs'); // ✅ ADDED THIS LINE

describe('Assessment Attempts API - Full Lifecycle', () => {
  let studentToken;
  let teacherToken;
  let adminToken;
  let studentId;
  let teacherId;
  let paperId;
  let questionId1;
  let questionId2;
  let attemptId;

  // Setup test data before all tests
  beforeAll(async () => {
    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);

    const student = await User.create({
      firstName: 'Test',
      lastName: 'Student',
      email: 'student@test.com',
      password: hashedPassword,
      userType: 'student'
    });
    studentId = student._id;
    
    const teacher = await User.create({
      firstName: 'Test',
      lastName: 'Teacher',
      email: 'teacher@test.com',
      password: hashedPassword,  // Use the SAME hashedPassword variable
      userType: 'teacher'
    });
    teacherId = teacher._id;
    
    const admin = await User.create({
      firstName: 'Test',
      lastName: 'Admin',
      email: 'admin@test.com',
      password: hashedPassword,  // Use the SAME hashedPassword variable
      userType: 'admin'
    });
    
    // Get tokens (assuming you have auth endpoints)
    const studentRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'student@test.com',
        password: 'password123'
      });
    studentToken = studentRes.body.token;
    
    const teacherRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'teacher@test.com',
        password: 'password123'
      });
    teacherToken = teacherRes.body.token;
    
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123'
      });
    adminToken = adminRes.body.token;
    
    // Create test assessment items with all required fields
    const item1 = await AssessmentItem.create({
      title: 'Test Question 1',
      description: 'Basic addition question',
      question: 'What is 2 + 2?',
      type: 'multiple-choice', // Correct enum value
      options: ['3', '4', '5', '6'],
      correctAnswer: '4', // Using correctAnswer field instead of correctIndex
      explanation: 'Basic addition',
      marks: 1,
      difficulty: 'Easy',
      // Required fields
      subject: 'Mathematics',
      level: 'GCSE',
      createdBy: teacherId,
      // Optional fields
      examBoard: 'CIE',
      tags: ['addition', 'basic-math'],
      isPublished: true
    });
    questionId1 = item1._id;
    
    const item2 = await AssessmentItem.create({
      title: 'Test Question 2',
      description: 'European capital question',
      question: 'What is the capital of France?',
      type: 'multiple-choice', // Correct enum value
      options: ['London', 'Berlin', 'Paris', 'Madrid'],
      correctAnswer: 'Paris', // Using correctAnswer field instead of correctIndex
      explanation: 'Famous European capital',
      marks: 1,
      difficulty: 'Easy',
      // Required fields
      subject: 'Geography',
      level: 'GCSE',
      createdBy: teacherId,
      // Optional fields
      examBoard: 'CIE',
      tags: ['geography', 'europe', 'capitals'],
      isPublished: true
    });
    questionId2 = item2._id;
    
    // Create test assessment paper with all required fields
    const paper = await AssessmentPaper.create({
      title: 'Integration Test Paper',
      subject: 'Mathematics',
      examBoard: 'CIE',
      level: 'GCSE',
      tier: 'foundation',           // ✅ Changed to lowercase
      kind: 'practice_set',         // ✅ Changed to 'practice_set'
      timeSeconds: 3600, // 1 hour
      totalMarks: 2,
      isPublished: true,
      
      // Required creator fields
      createdBy: teacherId,
      createdByRole: 'teacher',
      
      // ✅ Correct items structure
      items: [
        { 
          itemId: questionId1, 
          order: 1, 
          marksOverride: 1 
        },
        { 
          itemId: questionId2, 
          order: 2, 
          marksOverride: 1 
        }
      ]
    });
    paperId = paper._id;
  });

  // Clean up before each test is handled by tests/setup.js
  beforeEach(async () => {
    // tests/setup.js handles collection cleanup after each test
    attemptId = null;
    
    // ✅ Refresh tokens to avoid JWT expiration between tests
    try {
      const studentLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'student@test.com',
          password: 'password123'
        });
      studentToken = studentLogin.body.token;
      
      const teacherLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'teacher@test.com',
          password: 'password123'
        });
      teacherToken = teacherLogin.body.token;
      
      console.log('✅ Tokens refreshed before test');
    } catch (error) {
      console.error('❌ Failed to refresh tokens:', error.message);
    }
  });

  describe('SS4: Full Assessment Attempt Lifecycle', () => {
    test('Step 1: POST /api/assessment-attempts → creates attempt', async () => {
      console.log('📝 Step 1: Creating assessment attempt...');
      
      const response = await request(app)
        .post('/api/assessment-attempts')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          paperId: paperId.toString()
        });
      
      console.log('📊 Response:', JSON.stringify(response.body, null, 2));
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.attempt).toBeDefined();
      expect(response.body.attempt._id).toBeDefined();
      expect(response.body.attempt.paperId).toBe(paperId.toString());
      expect(response.body.attempt.status).toBe('in_progress');
      
      attemptId = response.body.attempt._id;
      console.log(`✅ Step 1 PASSED: Created attempt ${attemptId}`);
    });

    test('Step 2: PUT /api/assessment-attempts/:id/answer → saves answer', async () => {
      console.log('📝 Step 2: Saving answer to question 1...');
      
      // First, create an attempt if not already created
      if (!attemptId) {
        const createResponse = await request(app)
          .post('/api/assessment-attempts')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ paperId: paperId.toString() });
        
        console.log('Create response for answer test:', {
          status: createResponse.status,
          body: createResponse.body,
          token: studentToken ? 'Token exists' : 'NO TOKEN'
        });
        
        attemptId = createResponse.body.attempt._id;
      }
      
      const response = await request(app)
        .put(`/api/assessment-attempts/${attemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: questionId1.toString(),
          selectedIndex: 1, // Correct answer for question 1 (index 1 = '4')
          timeUsedSeconds: 300 // 5 minutes used
        });
      
      console.log('📊 Response:', JSON.stringify(response.body, null, 2));
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.attempt).toBeDefined();
      expect(response.body.attempt.answers).toBeDefined();
      expect(response.body.attempt.answers.length).toBe(1);
      expect(response.body.attempt.timeUsedSeconds).toBe(300);
      
      console.log('✅ Step 2 PASSED: Answer saved successfully');
    });

    test('Step 3: POST /api/assessment-attempts/:id/submit → submits attempt', async () => {
      console.log('📝 Step 3: Submitting assessment attempt...');
      
      // First, create attempt and add answer
      if (!attemptId) {
        const createResponse = await request(app)
          .post('/api/assessment-attempts')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ paperId: paperId.toString() });
        
        attemptId = createResponse.body.attempt._id;
        
        await request(app)
          .put(`/api/assessment-attempts/${attemptId}/answer`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            questionId: questionId1.toString(),
            selectedIndex: 1,
            timeUsedSeconds: 300
          });
      }
      
      const response = await request(app)
        .post(`/api/assessment-attempts/${attemptId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          timeUsedSeconds: 600 // 10 minutes total
        });
      
      console.log('📊 Response:', JSON.stringify(response.body, null, 2));
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.attempt).toBeDefined();
      expect(response.body.attempt.status).toBe('submitted');
      expect(response.body.attempt.submittedAt).toBeDefined();
      expect(response.body.attempt.score).toBeDefined();
      expect(response.body.attempt.score.totalQuestions).toBe(2);
      expect(response.body.attempt.score.answered).toBe(1);
      expect(response.body.attempt.score.correct).toBe(1);
      expect(response.body.attempt.score.percentage).toBe(50);
      expect(response.body.attempt.timeUsedSeconds).toBe(600);
      
      console.log('✅ Step 3 PASSED: Attempt submitted successfully');
    });

    test('Step 4: PUT /api/assessment-attempts/:id/answer after submit → must return 409', async () => {
      console.log('📝 Step 4: Attempting to modify answer after submission (should fail)...');
      
      // First, create, answer, and submit an attempt
      if (!attemptId) {
        const createResponse = await request(app)
          .post('/api/assessment-attempts')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ paperId: paperId.toString() });
        
        attemptId = createResponse.body.attempt._id;
        
        await request(app)
          .put(`/api/assessment-attempts/${attemptId}/answer`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            questionId: questionId1.toString(),
            selectedIndex: 1,
            timeUsedSeconds: 300
          });
        
        await request(app)
          .post(`/api/assessment-attempts/${attemptId}/submit`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ timeUsedSeconds: 600 });
      }
      
      const response = await request(app)
        .put(`/api/assessment-attempts/${attemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: questionId1.toString(),
          selectedIndex: 0, // Trying to change answer
          timeUsedSeconds: 700
        });
      
      console.log('📊 Response:', JSON.stringify(response.body, null, 2));
      
      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.msg).toBe('Attempt is already submitted');
      
      console.log('✅ Step 4 PASSED: Correctly prevented answer modification after submission');
    });

    test('Step 5: GET /api/assessment-attempts/:id/results → returns questionResults', async () => {
      console.log('📝 Step 5: Getting detailed results...');
      
      // First, create, answer, and submit an attempt
      if (!attemptId) {
        const createResponse = await request(app)
          .post('/api/assessment-attempts')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ paperId: paperId.toString() });
        
        attemptId = createResponse.body.attempt._id;
        
        await request(app)
          .put(`/api/assessment-attempts/${attemptId}/answer`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            questionId: questionId1.toString(),
            selectedIndex: 1,
            timeUsedSeconds: 300
          });
        
        await request(app)
          .post(`/api/assessment-attempts/${attemptId}/submit`)
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ timeUsedSeconds: 600 });
      }
      
      const response = await request(app)
        .get(`/api/assessment-attempts/${attemptId}/results`)
        .set('Authorization', `Bearer ${studentToken}`);
      
      console.log('📊 Response structure:', {
        success: response.body.success,
        hasAttempt: !!response.body.attempt,
        hasPaper: !!response.body.paper,
        questionResultsCount: response.body.questionResults?.length
      });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.attempt).toBeDefined();
      expect(response.body.attempt._id).toBe(attemptId);
      expect(response.body.attempt.status).toBe('submitted');
      expect(response.body.paper).toBeDefined();
      expect(response.body.paper._id).toBe(paperId.toString());
      expect(response.body.questionResults).toBeDefined();
      expect(response.body.questionResults.length).toBe(2);
      
      // Verify question 1 result - UPDATED: using itemId instead of _id
      const q1Result = response.body.questionResults.find(q => 
        q.itemId === questionId1.toString()
      );
      expect(q1Result).toBeDefined();
      expect(q1Result.userAnswer.selectedIndex).toBe(1);
      expect(q1Result.isCorrect).toBe(true);
      expect(q1Result.correctIndex).toBe(1);
      
      // Verify question 2 result (unanswered) - UPDATED: using itemId instead of _id
      const q2Result = response.body.questionResults.find(q => 
        q.itemId === questionId2.toString()
      );
      expect(q2Result).toBeDefined();
      expect(q2Result.userAnswer).toBeNull();
      expect(q2Result.isCorrect).toBe(false);
      
      console.log('✅ Step 5 PASSED: Results retrieved successfully');
    });

    test('Complete Lifecycle Run', async () => {
      console.log('\n🚀 ========================================');
      console.log('🚀 COMPLETE ASSESSMENT LIFECYCLE TEST');
      console.log('🚀 ========================================\n');
      
      // Step 1: Create attempt
      console.log('📝 1. Creating assessment attempt...');
      const createRes = await request(app)
        .post('/api/assessment-attempts')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          paperId: paperId.toString()
        });
      
      console.log('Create attempt response:', {
        status: createRes.status,
        body: createRes.body,
        headers: createRes.headers
      });
      
      expect(createRes.status).toBe(201);
      const newAttemptId = createRes.body.attempt._id;
      console.log(`✅ Created attempt: ${newAttemptId}`);
      
      // Step 2: Save answers
      console.log('📝 2. Saving answers...');
      const answerRes1 = await request(app)
        .put(`/api/assessment-attempts/${newAttemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: questionId1.toString(),
          selectedIndex: 1,
          timeUsedSeconds: 300
        });
      
      expect(answerRes1.status).toBe(200);
      console.log('✅ Answer 1 saved');
      
      const answerRes2 = await request(app)
        .put(`/api/assessment-attempts/${newAttemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: questionId2.toString(),
          selectedIndex: 2,
          timeUsedSeconds: 450
        });
      
      expect(answerRes2.status).toBe(200);
      console.log('✅ Answer 2 saved');
      
      // Step 3: Submit attempt
      console.log('📝 3. Submitting attempt...');
      const submitRes = await request(app)
        .post(`/api/assessment-attempts/${newAttemptId}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          timeUsedSeconds: 600
        });
      
      expect(submitRes.status).toBe(200);
      expect(submitRes.body.attempt.score.percentage).toBe(100); // Both answers correct
      console.log(`✅ Submitted! Score: ${submitRes.body.attempt.score.percentage}%`);
      
      // Step 4: Verify cannot modify after submission
      console.log('📝 4. Attempting to modify after submission...');
      const modifyRes = await request(app)
        .put(`/api/assessment-attempts/${newAttemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: questionId1.toString(),
          selectedIndex: 0,
          timeUsedSeconds: 700
        });
      
      expect(modifyRes.status).toBe(409);
      console.log('✅ Correctly prevented modification (409 Conflict)');
      
      // Step 5: Get results
      console.log('📝 5. Getting detailed results...');
      const resultsRes = await request(app)
        .get(`/api/assessment-attempts/${newAttemptId}/results`)
        .set('Authorization', `Bearer ${studentToken}`);
      
      expect(resultsRes.status).toBe(200);
      expect(resultsRes.body.questionResults.length).toBe(2);
      
      // UPDATED: Find questions by itemId instead of _id
      const q1Result = resultsRes.body.questionResults.find(q => 
        q.itemId === questionId1.toString()
      );
      const q2Result = resultsRes.body.questionResults.find(q => 
        q.itemId === questionId2.toString()
      );
      
      expect(q1Result).toBeDefined();
      expect(q2Result).toBeDefined();
      expect(q1Result.isCorrect).toBe(true);
      expect(q2Result.isCorrect).toBe(true);
      console.log('✅ Results retrieved successfully');
      
      console.log('\n🎉 ========================================');
      console.log('🎉 ALL TESTS PASSED!');
      console.log('🎉 Assessment lifecycle works correctly.');
      console.log('🎉 ========================================\n');
    });
  });

  describe('Additional Security Tests', () => {
    test('Teacher cannot create attempt', async () => {
      const response = await request(app)
        .post('/api/assessment-attempts')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ paperId: paperId.toString() });
      
      expect(response.status).toBe(403);
      expect(response.body.msg).toContain('Only students can start assessment attempts');
    });

    test('Student cannot access another student\'s attempt', async () => {
      // Create another student
      const anotherHashedPassword = await bcrypt.hash('password123', 10);

      const anotherStudent = await User.create({
        firstName: 'Another',
        lastName: 'Student',
        email: 'another@test.com',
        password: anotherHashedPassword,
        userType: 'student'
      });
      
      const anotherStudentRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'another@test.com',
          password: 'password123'
        });
      
      const anotherToken = anotherStudentRes.body.token;
      
      // First student creates attempt
      const createRes = await request(app)
        .post('/api/assessment-attempts')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paperId: paperId.toString() });
      
      const attemptId = createRes.body.attempt._id;
      
      // Second student tries to access it
      const accessRes = await request(app)
        .get(`/api/assessment-attempts/${attemptId}`)
        .set('Authorization', `Bearer ${anotherToken}`);
      
      expect(accessRes.status).toBe(403);
    });

    test('Time clamping works correctly', async () => {
      // Create attempt
      const createRes = await request(app)
        .post('/api/assessment-attempts')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ paperId: paperId.toString() });
      
      const attemptId = createRes.body.attempt._id;
      
      // Try to set time beyond duration (3600 seconds)
      const answerRes = await request(app)
        .put(`/api/assessment-attempts/${attemptId}/answer`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          questionId: questionId1.toString(),
          selectedIndex: 1,
          timeUsedSeconds: 4000 // Exceeds 3600
        });
      
      expect(answerRes.status).toBe(200);
      expect(answerRes.body.attempt.timeUsedSeconds).toBe(3600); // Clamped to duration
    });
  });
});