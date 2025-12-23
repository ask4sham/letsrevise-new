// fix-admin-password.js
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');  // Note: using bcryptjs, not bcrypt
require('dotenv').config();

async function fixAdminPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');
    
    // Find the original admin user
    const adminUser = await User.findOne({ email: 'admin@example.com' });
    
    if (!adminUser) {
      console.log('❌ Original admin user not found');
      return;
    }
    
    console.log('🔍 Found original admin user:');
    console.log(`- Email: ${adminUser.email}`);
    console.log(`- User Type: ${adminUser.userType}`);
    console.log(`- Current password hash: ${adminUser.password.substring(0, 30)}...`);
    console.log(`- Hash length: ${adminUser.password.length} chars`);
    
    // Create new hash with bcryptjs
    const newPassword = 'Password123';  // Same password
    const salt = await bcryptjs.genSalt(10);
    const newHash = await bcryptjs.hash(newPassword, salt);
    
    console.log('\n🔄 Updating password hash...');
    console.log(`- New hash: ${newHash.substring(0, 30)}...`);
    console.log(`- New hash length: ${newHash.length} chars`);
    
    // Update the user's password
    adminUser.password = newHash;
    await adminUser.save();
    
    // Verify the update
    const updatedUser = await User.findOne({ email: 'admin@example.com' });
    console.log('\n✅ Password updated successfully!');
    console.log(`- New stored hash: ${updatedUser.password.substring(0, 30)}...`);
    
    // Test the new hash works with bcryptjs.compare
    const testMatch = await bcryptjs.compare('Password123', updatedUser.password);
    console.log(`- Test password match: ${testMatch}`);
    
    await mongoose.disconnect();
    console.log('\n🎉 Original admin user fixed! You can now login with:');
    console.log('   Email: admin@example.com');
    console.log('   Password: Password123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run the fix
fixAdminPassword();