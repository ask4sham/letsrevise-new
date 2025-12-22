const axios = require('axios');

async function getToken() {
  try {
    // Try with admin@example.com / Password123
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@example.com',
      password: 'Password123'
    });
    
    console.log('Token:', response.data.token);
    console.log('User Type:', response.data.user.userType);
    
    // Save to test file
    const fs = require('fs');
    fs.writeFileSync('test-token.txt', response.data.token);
    console.log('Token saved to test-token.txt');
    
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    console.log('\\nTrying teacher@example.com...');
    
    try {
      const teacherResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'teacher@example.com',
        password: 'Password123'
      });
      
      console.log('Teacher Token:', teacherResponse.data.token);
      const fs = require('fs');
      fs.writeFileSync('test-token.txt', teacherResponse.data.token);
      console.log('Teacher token saved to test-token.txt');
      
    } catch (err2) {
      console.error('Teacher login also failed:', err2.response?.data || err2.message);
    }
  }
}

getToken();
