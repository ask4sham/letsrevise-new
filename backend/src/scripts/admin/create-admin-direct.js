const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdminDirect() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Use mongoose directly without the model middleware
    const db = mongoose.connection.db;
    
    // Check if admin exists
    const existing = await db.collection('users').findOne({ email: 'admin@example.com' });
    if (existing) {
      console.log('Admin already exists:', existing.email);
      console.log('User Type:', existing.userType);
      await mongoose.disconnect();
      return;
    }
    
    // Create admin directly
    console.log('Creating admin user...');
    const hashedPassword = await bcrypt.hash('Password123', 10);
    
    const adminDoc = {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      userType: 'admin',
      verificationStatus: 'verified',
      shamCoins: 10000,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('users').insertOne(adminDoc);
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

createAdminDirect();
