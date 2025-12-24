// test-review.js
const axios = require('axios');

async function testReviewSystem() {
  try {
    // 1. Login as student
    console.log('1. Logging in as student...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'john@example.com',
      password: 'Password123'
    });
    
    const token = loginRes.data.token;
    console.log('Login successful. Token received.');
    
    // 2. Get a lesson ID (you need to get this from your database)
    // For testing, let's get published lessons first
    const lessonsRes = await axios.get('http://localhost:5000/api/lessons', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (lessonsRes.data.length === 0) {
      console.log('No lessons available. Create a lesson first.');
      return;
    }
    
    const lessonId = lessonsRes.data[0]._id;
    console.log(`Using lesson ID: ${lessonId}`);
    
    // 3. Submit a review
    console.log('3. Submitting review...');
    const reviewRes = await axios.post(
      `http://localhost:5000/api/reviews/${lessonId}`,
      {
        rating: 5,
        review: 'Great lesson! Very helpful for my studies.'
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    console.log('Review submitted successfully:', reviewRes.data);
    
    // 4. Get reviews for the lesson
    console.log('4. Fetching reviews for lesson...');
    const reviewsRes = await axios.get(
      `http://localhost:5000/api/reviews/lesson/${lessonId}`
    );
    
    console.log('Reviews:', reviewsRes.data);
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testReviewSystem();