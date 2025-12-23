const axios = require('axios');

async function debugLogin() {
  console.log('Testing admin login...');
  
  try {
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@example.com',
      password: 'Password123'
    }, {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: function (status) {
        return true; // Accept all status codes
      }
    });
    
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', JSON.stringify(response.headers, null, 2));
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('Axios Error:');
    console.log('Message:', error.message);
    console.log('Code:', error.code);
    
    if (error.response) {
      console.log('\\nResponse Error:');
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
      console.log('Headers:', JSON.stringify(error.response.headers, null, 2));
    }
    
    if (error.request) {
      console.log('\\nRequest Error:');
      console.log('Request:', error.request);
    }
  }
}

debugLogin();
