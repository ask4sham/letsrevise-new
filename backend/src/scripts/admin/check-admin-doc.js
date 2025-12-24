const mongoose = require('mongoose');
require('dotenv').config();

async function checkAdminDocument() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const admin = await db.collection('users').findOne({ 
      email: 'admin@example.com'
    });
    
    console.log('=== FULL ADMIN DOCUMENT ===');
    console.log(JSON.stringify(admin, null, 2));
    
    // Check what fields exist
    console.log('\n=== DOCUMENT FIELD CHECK ===');
    console.log('Has email field:', 'email' in admin);
    console.log('Has password field:', 'password' in admin);
    console.log('Has userType field:', 'userType' in admin);
    console.log('Password type:', typeof admin.password);
    console.log('Password length:', admin.password ? admin.password.length : 'N/A');
    
    // Check if password looks like bcrypt hash
    if (admin.password) {
      const isBcrypt = admin.password.startsWith('$') || 
                       admin.password.startsWith('$') || 
                       admin.password.startsWith('$');
      console.log('Looks like bcrypt hash:', isBcrypt);
    }
    
    await mongoose.disconnect();
    
  } catch(err) {
    console.error('Error:', err.message);
  }
}

checkAdminDocument();
