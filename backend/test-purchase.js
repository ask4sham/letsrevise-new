const axios = require('axios');

async function testPurchase() {
  try {
    // First login as student
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'student@example.com',
      password: 'Password123'
    });
    
    console.log('Login successful, token:', loginRes.data.token.substring(0, 50) + '...');
    
    // Get a lesson ID (you need to have at least one lesson)
    const lessonsRes = await axios.get('http://localhost:5000/api/lessons', {
      headers: { Authorization: `Bearer ${loginRes.data.token}` }
    });
    
    if (lessonsRes.data.length === 0) {
      console.log('No lessons available. Need to create a lesson first.');
      return;
    }
    
    const lessonId = lessonsRes.data[0]._id;
    console.log('Testing purchase for lesson:', lessonId);
    
    // Try to purchase
    const purchaseRes = await axios.post(
      `http://localhost:5000/api/lessons/${lessonId}/purchase`,
      {},
      { headers: { Authorization: `Bearer ${loginRes.data.token}` } }
    );
    
    console.log('Purchase successful:', purchaseRes.data);
    
  } catch (error) {
    console.error('Test failed:');
    console.error('Status:', error.response?.status);
    console.error('Error message:', error.response?.data?.msg || error.message);
    console.error('Full error:', error.response?.data);
  }
}

testPurchase();
