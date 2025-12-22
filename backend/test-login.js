const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLogin(email, password) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Testing login for: ${email}`);
    
    const User = require('./models/User');
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found');
      return false;
    }
    
    console.log(`✅ User found: ${user.email}, userType: ${user.userType}`);
    
    // Test password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`Password match: ${isMatch ? '✅ YES' : '❌ NO'}`);
    
    if (!isMatch) {
      console.log('Note: Stored hash:', user.password.substring(0, 30) + '...');
    }
    
    return isMatch;
    
  } catch (err) {
    console.error('Error:', err.message);
    return false;
  } finally {
    await mongoose.disconnect();
  }
}

// Test all possible accounts
async function testAll() {
  console.log('=== Testing Logins ===\n');
  
  // Test accounts from your frontend
  await testLogin('student@example.com', 'Password123');
  console.log('---');
  await testLogin('teacher@example.com', 'Password123');
  console.log('---');
  
  // Existing accounts in DB
  await testLogin('jane@example.com', 'Password123');
  console.log('---');
  await testLogin('john@example.com', 'Password123');
  console.log('---');
  
  // Try common passwords
  await testLogin('teacher@example.com', 'password');
  console.log('---');
  await testLogin('teacher@example.com', '123456');
}

testAll();