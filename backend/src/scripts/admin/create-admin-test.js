const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Check if admin@example.com exists
    console.log('Checking for existing admin...');
    const existing = await User.findOne({ email: 'admin@example.com' });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      console.log('User Type:', existing.userType);
      await mongoose.disconnect();
      return;
    }
    
    // Create admin
    console.log('Creating admin user...');
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
    console.log('✅ Admin user created successfully!');
    console.log('Email: admin@example.com');
    console.log('Password: Password123');
    console.log('User Type: admin');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch(err) {
    console.error('❌ Error:', err.message);
    console.error('Full error:', err);
  }
}

createAdmin();
