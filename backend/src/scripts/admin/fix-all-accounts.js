const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixAccounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔧 Fixing all test accounts...\n');
    
    const User = require('./models/User');
    
    // 1. Create missing student@example.com
    let student = await User.findOne({ email: 'student@example.com' });
    if (!student) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Password123', salt);
      
      student = new User({
        email: 'student@example.com',
        password: hashedPassword,
        userType: 'student',
        firstName: 'Test',
        lastName: 'Student',
        shamCoins: 500,
        verificationStatus: 'verified'
      });
      
      await student.save();
      console.log('✅ Created: student@example.com / Password123 (student)');
    } else {
      console.log('✅ Already exists: student@example.com');
    }
    
    // 2. Ensure teacher@example.com is correct
    let teacher = await User.findOne({ email: 'teacher@example.com' });
    if (teacher) {
      // Verify password is Password123
      const isMatch = await bcrypt.compare('Password123', teacher.password);
      if (!isMatch) {
        const salt = await bcrypt.genSalt(10);
        teacher.password = await bcrypt.hash('Password123', salt);
        await teacher.save();
        console.log('✅ Reset password for teacher@example.com to Password123');
      }
      console.log('✅ Teacher account ready: teacher@example.com / Password123');
    }
    
    // 3. Fix jane@example.com (should be student based on frontend)
    let jane = await User.findOne({ email: 'jane@example.com' });
    if (jane && jane.userType === 'teacher') {
      jane.userType = 'student';
      await jane.save();
      console.log('✅ Changed jane@example.com from teacher to student');
    }
    
    // 4. List all test accounts
    console.log('\n📋 ALL TEST ACCOUNTS:');
    const testEmails = ['student@example.com', 'teacher@example.com', 'jane@example.com', 'john@example.com'];
    for (const email of testEmails) {
      const user = await User.findOne({ email });
      if (user) {
        const isMatch = await bcrypt.compare('Password123', user.password);
        console.log(`\n${email}:`);
        console.log(`  User Type: ${user.userType}`);
        console.log(`  Password: Password123 ${isMatch ? '✅' : '❌'}`);
        console.log(`  Name: ${user.firstName} ${user.lastName}`);
      } else {
        console.log(`\n${email}: ❌ NOT FOUND`);
      }
    }
    
    console.log('\n✨ All accounts ready for testing!');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

fixAccounts();