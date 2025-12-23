const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createTeacher() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Check if teacher exists
    const existingTeacher = await User.findOne({ email: 'teacher@example.com' });
    
    if (existingTeacher) {
      console.log('Teacher already exists:', existingTeacher.email);
      console.log('UserType:', existingTeacher.userType);
      
      // Fix if needed
      if (existingTeacher.userType !== 'teacher') {
        existingTeacher.userType = 'teacher';
        await existingTeacher.save();
        console.log('Fixed userType to "teacher"');
      }
    } else {
      // Create new teacher
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Password123', salt);
      
      const teacher = new User({
        email: 'teacher@example.com',
        password: hashedPassword,
        userType: 'teacher',
        firstName: 'Test',
        lastName: 'Teacher',
        institution: 'Test University',
        verificationStatus: 'verified',
        shamCoins: 100,
        earnings: 0,
        balance: 0,
        totalWithdrawn: 0
      });
      
      await teacher.save();
      console.log('Teacher created successfully:');
      console.log('  Email: teacher@example.com');
      console.log('  Password: Password123');
      console.log('  UserType: teacher');
    }
    
    // Also fix existing users if needed
    const users = await User.find({});
    for (const user of users) {
      if (!user.userType) {
        user.userType = 'student'; // Default to student
        await user.save();
        console.log(`Fixed ${user.email}: set userType to "student"`);
      }
    }
    
    await mongoose.disconnect();
    console.log('\nDone!');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

createTeacher();