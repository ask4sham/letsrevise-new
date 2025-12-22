// backend/update-student-coins.js
const mongoose = require('mongoose');
const User = require('./models/User');

async function updateStudentCoins() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/learnplace');
    console.log('Connected to MongoDB');
    
    // Update test student
    const result = await User.updateOne(
      { email: "john@example.com" },
      { $set: { shamCoins: 500 } }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} student(s)`);
    
    // Verify
    const student = await User.findOne({ email: "john@example.com" });
    if (student) {
      console.log(`✅ Student ${student.email} now has ${student.shamCoins || 0} ShamCoins`);
      console.log(`   User Type: ${student.userType}`);
      console.log(`   Full user object:`, {
        shamCoins: student.shamCoins,
        shampCoins: student.shampCoins,
        email: student.email,
        userType: student.userType
      });
    } else {
      console.log('❌ Student not found');
    }
    
    // Also check the teacher
    const teacher = await User.findOne({ email: "jane@example.com" });
    if (teacher) {
      console.log(`\nℹ️ Teacher ${teacher.email} has ${teacher.shamCoins || 0} ShamCoins`);
    }
    
    mongoose.disconnect();
    console.log('\n🎉 Update complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateStudentCoins();