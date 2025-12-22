// simple-test.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function runTest() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('./models/User');
    
    console.log('\n🔍 Searching for admin user...');
    
    // Find the admin user
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    
    if (!adminUser) {
      console.log('❌ No admin user found with email: admin@example.com');
      
      // Check all users in database
      console.log('\n📋 All users in database:');
      const allUsers = await User.find({});
      allUsers.forEach(user => {
        console.log(`- Email: "${user.email}", Type: ${user.userType}, Password: ${user.password ? 'Set (' + user.password.length + ' chars)' : 'Not Set'}`);
      });
      
      // Search with case-insensitive
      console.log('\n🔍 Searching case-insensitive...');
      const caseInsensitiveUser = await User.findOne({ 
        email: { $regex: /^admin@example.com$/i } 
      });
      if (caseInsensitiveUser) {
        console.log(`Found similar user: "${caseInsensitiveUser.email}"`);
      }
      
      return;
    }
    
    console.log('✅ Admin user found!');
    console.log(`📝 User details:`);
    console.log(`- Email: "${adminUser.email}"`);
    console.log(`- User Type: ${adminUser.userType}`);
    console.log(`- Password hash: ${adminUser.password.substring(0, 25)}...`);
    console.log(`- Hash length: ${adminUser.password.length} chars`);
    console.log(`- Is 60 chars? ${adminUser.password.length === 60}`);
    
    // Test password comparison
    console.log('\n🔐 Testing password comparison...');
    const testPassword = 'Password123';
    
    // Direct bcrypt compare
    const isMatch = await bcrypt.compare(testPassword, adminUser.password);
    console.log(`Password "Password123" matches? ${isMatch}`);
    
    if (!isMatch) {
      console.log('\n⚠️  Password mismatch! Testing alternatives...');
      
      // Test common variations
      const variations = [
        'password123',
        'Password123!',
        'Password123 ',
        ' Password123',
        'password123',
        'PASSWORD123'
      ];
      
      for (const variation of variations) {
        const match = await bcrypt.compare(variation, adminUser.password);
        if (match) {
          console.log(`✓ Found matching password: "${variation}"`);
          break;
        }
      }
      
      // Check hash format
      console.log(`\n🔍 Hash starts with: ${adminUser.password.substring(0, 7)}`);
      console.log(`Expected bcrypt format: $2b$10$...`);
    }
    
    // Check for whitespace in stored email
    console.log('\n🔍 Checking email in database:');
    console.log(`Email char codes: [${Array.from(adminUser.email).map(c => c.charCodeAt(0)).join(',')}]`);
    console.log(`Email length: ${adminUser.email.length}`);
    
    // Test other users
    console.log('\n👥 Checking all users:');
    const allUsers = await User.find({});
    console.log(`Total users: ${allUsers.length}`);
    allUsers.forEach((user, i) => {
      console.log(`${i+1}. ${user.email} (${user.userType})`);
    });
    
    // Test login API
    console.log('\n🌐 Testing login API endpoint...');
    const axios = require('axios');
    
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'admin@example.com',
        password: 'Password123'
      }, {
        timeout: 5000
      });
      console.log('✅ Login API SUCCESS!');
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Login API FAILED!');
      if (error.response) {
        console.log('Status:', error.response.status);
        console.log('Response data:', JSON.stringify(error.response.data, null, 2));
      } else if (error.request) {
        console.log('No response received. Is server running?');
        console.log('Error:', error.message);
      } else {
        console.log('Error:', error.message);
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
runTest();