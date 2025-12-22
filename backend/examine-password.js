const mongoose = require('mongoose');
require('dotenv').config();

async function examinePassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    const admin = await db.collection('users').findOne({ 
      email: 'admin@example.com'
    });
    
    console.log('=== PASSWORD ANALYSIS ===');
    console.log('Full password string:', JSON.stringify(admin.password));
    console.log('String length:', admin.password.length);
    console.log('First 10 chars:', admin.password.substring(0, 10));
    console.log('Last 10 chars:', admin.password.substring(admin.password.length - 10));
    console.log('Character codes:');
    
    // Check each character
    for (let i = 0; i < Math.min(20, admin.password.length); i++) {
      const char = admin.password[i];
      console.log(\  [\] '\' code: \\);
    }
    
    // Check if it contains null or special characters
    const hasNull = admin.password.includes('\\u0000');
    console.log('Contains null character:', hasNull);
    
    await mongoose.disconnect();
    
  } catch(err) {
    console.error('Error:', err.message);
  }
}

examinePassword();
