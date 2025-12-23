const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function simpleTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Find user
    const user = await User.findOne({ email: 'admin@example.com' });
    console.log('User found:', !!user);
    
    if (user) {
      console.log('Email:', user.email);
      console.log('UserType:', user.userType);
      console.log('Password length:', user.password.length);
      
      // Test bcrypt
      const match = await bcrypt.compare('Password123', user.password);
      console.log('Password match:', match);
      
      if (!match) {
        console.log('Testing wrong passwords to debug:');
        console.log('Wrong pass match:', await bcrypt.compare('wrong', user.password));
        console.log('Empty match:', await bcrypt.compare('', user.password));
        
        // Try to hash the same password again
        const newHash = await bcrypt.hash('Password123', 10);
        console.log('New hash:', newHash.substring(0, 30) + '...');
        console.log('Compare with new hash:', await bcrypt.compare('Password123', newHash));
      }
    } else {
      console.log('User not found. Checking all users:');
      const allUsers = await User.find({});
      console.log('Total users:', allUsers.length);
      allUsers.forEach(u => {
        console.log('-', u.email, '(', u.userType, ')');
      });
    }
    
    await mongoose.disconnect();
    
  } catch(err) {
    console.error('Error:', err.message);
  }
}

simpleTest();
