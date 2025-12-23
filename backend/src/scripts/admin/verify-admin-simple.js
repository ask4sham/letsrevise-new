const mongoose = require('mongoose');
require('dotenv').config();

async function verifyAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Find the admin user
    const admin = await db.collection('users').findOne({ 
      email: 'admin@example.com',
      userType: 'admin'
    });
    
    console.log('\n=== ADMIN USER VERIFICATION ===');
    if (admin) {
      console.log('✅ Admin user found!');
      console.log('Email:', admin.email);
      console.log('User Type:', admin.userType);
      console.log('First Name:', admin.firstName);
      console.log('Last Name:', admin.lastName);
      console.log('Verification Status:', admin.verificationStatus);
      console.log('Sham Coins:', admin.shamCoins);
      console.log('Created:', admin.createdAt);
    } else {
      console.log('❌ Admin user not found!');
    }
    
    // Simple count by iterating through users
    console.log('\n=== ALL USERS ===');
    const allUsers = await db.collection('users').find({}).toArray();
    const typeCount = {};
    
    allUsers.forEach(user => {
      console.log(\- \ (\)\);
      typeCount[user.userType] = (typeCount[user.userType] || 0) + 1;
    });
    
    console.log('\n=== USER TYPE SUMMARY ===');
    Object.keys(typeCount).forEach(type => {
      console.log(\\: \ users\);
    });
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
  } catch(err) {
    console.error('❌ Error:', err.message);
  }
}

verifyAdmin();
