const axios = require('axios');

async function testApiLogin(email, password, userType) {
  try {
    console.log(`\n🔐 Testing ${userType} login: ${email}`);
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: email,
      password: password
    }, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log(`✅ SUCCESS! Status: ${response.status}`);
    console.log(`   Token received: ${response.data.token ? 'Yes' : 'No'}`);
    console.log(`   User type in response: ${response.data.user.userType}`);
    console.log(`   User ID: ${response.data.user.id}`);
    
    return true;
    
  } catch (error) {
    console.log(`❌ FAILED! Status: ${error.response?.status || 'No response'}`);
    console.log(`   Error: ${error.response?.data?.msg || error.message}`);
    
    if (error.response?.data?.errors) {
      console.log('   Validation errors:', error.response.data.errors);
    }
    
    return false;
  }
}

async function runTests() {
  console.log('=== API LOGIN TESTS ===\n');
  
  // Test accounts from your frontend
  await testApiLogin('student@example.com', 'Password123', 'Student');
  await testApiLogin('teacher@example.com', 'Password123', 'Teacher');
  
  // Also test the other accounts
  await testApiLogin('jane@example.com', 'Password123', 'Jane (Student)');
  await testApiLogin('john@example.com', 'Password123', 'John (Student)');
  
  console.log('\n=== TESTS COMPLETE ===');
}

runTests();