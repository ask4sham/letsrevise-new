const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createProperAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Delete existing admin if it exists
    const db = mongoose.connection.db;
    await db.collection('users').deleteOne({ email: 'admin@example.com' });
    console.log('Cleaned up existing admin user');
    
    // Now create using the fixed model
    const User = require('./models/User');
    
    console.log('Creating new admin user...');
    const hashedPassword = await bcrypt.hash('Password123', 10);
    
    const admin = new User({
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      userType: 'admin',
      verificationStatus: 'verified',
      shamCoins: 10000
    });
    
    await admin.save();
    console.log('🎉 ADMIN USER CREATED SUCCESSFULLY!');
    console.log('Email: admin@example.com');
    console.log('Password: Password123');
    console.log('User Type: admin');
    
    // Verify it was saved
    const savedAdmin = await User.findOne({ email: 'admin@example.com' });
    console.log('\\nVerification:');
    console.log('Found in DB:', !!savedAdmin);
    console.log('Password hash length:', savedAdmin?.password?.length);
    console.log('Password hash starts with:', savedAdmin?.password?.substring(0, 10));
    
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
    
  } catch(err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

createProperAdmin();
