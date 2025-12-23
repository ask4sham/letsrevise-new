const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testDatabaseQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Test 1: Find by email exactly as entered
    const email = 'admin@example.com';
    console.log('\\n=== TEST 1: Find by email ===');
    console.log('Looking for:', JSON.stringify(email));
    
    const user = await User.findOne({ email: email });
    console.log('User found:', !!user);
    
    if (user) {
      console.log('User email:', user.email);
      console.log('User email (raw):', JSON.stringify(user.email));
      console.log('User type:', user.userType);
      console.log('Password exists:', !!user.password);
      console.log('Password length:', user.password?.length);
      console.log('Password first 10 chars:', user.password?.substring(0, 10));
      
      // Test 2: bcrypt compare
      console.log('\\n=== TEST 2: bcrypt compare ===');
      const password = 'Password123';
      console.log('Testing password:', password);
      
      const isMatch = await bcrypt.compare(password, user.password);
      console.log('bcrypt.compare result:', isMatch);
      
      // Test 3: Try alternative email formats
      console.log('\\n=== TEST 3: Alternative email queries ===');
      const variations = [
        'admin@example.com',
        'ADMIN@EXAMPLE.COM',
        ' admin@example.com ',
        'Admin@Example.com'
      ];
      
      for (const variant of variations) {
        const found = await User.findOne({ email: variant });
        console.log(\Query "\": \\);
      }
    }
    
    await mongoose.disconnect();
    
  } catch(err) {
    console.error('❌ Error:', err.message);
  }
}

testDatabaseQuery();
