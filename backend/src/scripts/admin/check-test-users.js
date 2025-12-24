const mongoose = require('mongoose');
require('dotenv').config();

async function checkTestUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    console.log('=== CHECKING TEST USER PASSWORDS ===');
    
    // Check student
    const student = await db.collection('users').findOne({ 
      email: 'student@example.com'
    });
    
    if (student) {
      console.log('\\nSTUDENT:');
      console.log('Email:', student.email);
      console.log('Password length:', student.password?.length);
      console.log('Password starts with:', student.password?.substring(0, 10));
      console.log('User Type:', student.userType);
    }
    
    // Check teacher  
    const teacher = await db.collection('users').findOne({ 
      email: 'teacher@example.com'
    });
    
    if (teacher) {
      console.log('\\nTEACHER:');
      console.log('Email:', teacher.email);
      console.log('Password length:', teacher.password?.length);
      console.log('Password starts with:', teacher.password?.substring(0, 10));
      console.log('User Type:', teacher.userType);
    }
    
    await mongoose.disconnect();
    
  } catch(err) {
    console.error('Error:', err.message);
  }
}

checkTestUsers();
