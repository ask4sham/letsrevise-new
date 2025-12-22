// check-users.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');
    
    // Get ALL users
    const users = await User.find({});
    
    console.log(`\n📋 TOTAL USERS IN DATABASE: ${users.length}`);
    console.log('=========================================');
    
    users.forEach((user, i) => {
      console.log(`\n${i+1}. ${user.email}`);
      console.log(`   Type: ${user.userType}`);
      console.log(`   Name: ${user.firstName} ${user.lastName}`);
      console.log(`   Password hash: ${user.password.substring(0, 25)}...`);
      console.log(`   Hash length: ${user.password.length} chars`);
      console.log(`   Created: ${user.createdAt}`);
    });
    
    // Check for test users
    console.log('\n🔍 SPECIFIC TEST USERS:');
    const testUsers = ['student@example.com', 'teacher@example.com'];
    
    for (const email of testUsers) {
      const user = await User.findOne({ email });
      if (user) {
        console.log(`✓ FOUND: ${email} (${user.userType})`);
      } else {
        console.log(`✗ MISSING: ${email}`);
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUsers();