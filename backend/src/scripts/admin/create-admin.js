const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Try the test email first (admin@example.com)
    const existing = await User.findOne({ email: 'admin@example.com' });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      console.log('User Type:', existing.userType);
      await mongoose.disconnect();
      return;
    }
    
    // Create admin with test credentials
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
    console.log('✅ Admin user created!');
    console.log('Email: admin@example.com');
    console.log('Password: Password123');
    console.log('User Type: admin');
    
    await mongoose.disconnect();
  } catch(err) {
    console.error('Error:', err.message);
  }
}

createAdmin();
