// backend/routes/ai.js
const express = require('express');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/auth'); // Changed to default import

// @route   POST /api/ai/generate-lesson
// @desc    Generate a lesson draft using AI (PROTECTED ROUTE)
// @access  Private (Teachers & Admins only)
router.post('/generate-lesson', auth, async (req, res) => {
  try {
    // 1. VALIDATE USER INPUT
    const { topic, subject, level } = req.body;
    if (!topic || !subject || !level) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Please provide topic, subject, and level.' 
      });
    }

    // 2. CONSTRUCT THE PROMPT
    const systemPrompt = `You are an expert UK curriculum educator for ${subject}. Create structured, engaging, and pedagogically sound lesson content for ${level} level students.`;
    
    const userPrompt = `Create a detailed lesson plan on "${topic}" for ${level} level ${subject}.

    Provide the response as a valid JSON object with the following structure:
    {
      "title": "A compelling lesson title",
      "description": "A 2-3 sentence engaging overview",
      "objectives": ["Objective 1", "Objective 2", "Objective 3"],
      "content": "# Introduction\\n\\n## Learning Objectives\\n- List objectives here\\n\\n## Main Content\\nDetailed explanation here...\\n\\n## Summary\\nKey takeaways",
      "quizQuestions": [
        {
          "question": "Question 1?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0
        }
      ]
    }`;

    console.log(`🔍 AI Request from User ${req.user.id}: ${topic} | ${subject} | ${level}`);

    // 3. CALL OPENAI API
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo', // CHEAPER for testing - change to gpt-4 later
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );

    // 4. PARSE & VALIDATE RESPONSE
    const aiContent = openaiResponse.data.choices[0].message.content;
    console.log('📄 Raw AI Response (first 200 chars):', aiContent.substring(0, 200));
    
    const lessonDraft = JSON.parse(aiContent);
    
    // Basic validation
    if (!lessonDraft.title || !lessonDraft.content) {
      throw new Error('AI response missing required fields (title or content)');
    }

    // 5. SEND SUCCESS RESPONSE
    res.json({
      success: true,
      message: 'Lesson draft generated successfully.',
      draft: lessonDraft,
      usage: openaiResponse.data.usage,
      generatedBy: req.user.id // Track which user generated this
    });

  } catch (error) {
    console.error('❌ AI Route Error:', error.message);
    
    // User-friendly error messages
    if (error.code === 'ENOTFOUND') {
      return res.status(500).json({ error: 'Network error. Check your internet connection.' });
    }
    
    if (error.response) {
      // OpenAI API error
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 401) {
        return res.status(500).json({ error: 'Invalid OpenAI API key. Check your .env file.' });
      }
      if (status === 429) {
        return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again in a minute.' });
      }
      if (status === 400) {
        return res.status(500).json({ error: 'OpenAI API error: ' + (data.error?.message || 'Bad request') });
      }
    }
    
    // Generic error
    res.status(500).json({ 
      error: 'Failed to generate lesson draft.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @route   GET /api/ai/health
// @desc    Check if AI service is working
// @access  Public
router.get('/health', (req, res) => {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.json({
    status: hasKey ? 'OK' : 'ERROR',
    message: hasKey ? 'AI service is configured' : 'Missing OpenAI API key',
    hasOpenAIKey: hasKey,
    keyPreview: hasKey ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : null
  });
});

module.exports = router;