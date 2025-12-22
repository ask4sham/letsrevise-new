const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Get all users
    const users = await User.find({});
    
    console.log('\n=== ALL USERS ===');
    users.forEach((user, i) => {
      console.log(\\. \ - Type: \\);
    });
    
    // Check for admin users
    const admins = await User.find({userType: 'admin'});
    console.log('\n=== ADMIN USERS ===');
    console.log(\Found \ admin users\);
    
    await mongoose.disconnect();
  } catch(err) {
    console.error('Error:', err.message);
  }
}

check();
