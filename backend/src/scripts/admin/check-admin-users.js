// check-admin-users.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkAdminUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/letsrevise');
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    const adminUsers = await User.find({ userType: 'admin' });
    
    console.log('\n=== ADMIN USERS ===');
    if (adminUsers.length === 0) {
      console.log('No admin users found in database.');
    } else {
      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
        console.log(`   User Type: ${user.userType}, ID: ${user._id}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('---');
      });
    }
    
    // Simple count by type instead of aggregate
    const allUsers = await User.find({}, 'userType');
    const counts = {};
    allUsers.forEach(user => {
      counts[user.userType] = (counts[user.userType] || 0) + 1;
    });
    
    console.log('\n=== USER COUNT BY TYPE ===');
    Object.entries(counts).forEach(([type, count]) => {
      console.log(`${type}: ${count} users`);
    });
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkAdminUsers();