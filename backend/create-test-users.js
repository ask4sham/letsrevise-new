const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function createTestUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/learnplace');
    console.log('Connected to MongoDB');

    // Check if users already exist
    const existingTeacher = await User.findOne({ email: 'jane@example.com' });
    const existingStudent = await User.findOne({ email: 'john@example.com' });

    if (!existingTeacher) {
      // Create test teacher
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Password456', salt);
      
      const teacher = new User({
        email: 'jane@example.com',
        password: hashedPassword,
        userType: 'teacher',
        firstName: 'Jane',
        lastName: 'Smith',
        institution: 'Test University',
        shamCoins: 1000
      });

      await teacher.save();
      console.log('✅ Test teacher created:', teacher.email);
    } else {
      console.log('ℹ️ Test teacher already exists:', existingTeacher.email);
    }

    if (!existingStudent) {
      // Create test student
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Password123', salt);
      
      const student = new User({
        email: 'john@example.com',
        password: hashedPassword,
        userType: 'student',
        firstName: 'John',
        lastName: 'Doe',
        shamCoins: 500
      });

      await student.save();
      console.log('✅ Test student created:', student.email);
    } else {
      console.log('ℹ️ Test student already exists:', existingStudent.email);
    }

    // List all users
    const allUsers = await User.find({});
    console.log(`\n📋 Total users in database: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.userType}) - ID: ${user._id}`);
    });

    mongoose.disconnect();
    console.log('\n🎉 Test users setup complete!');

  } catch (error) {
    console.error('Error:', error);
    mongoose.disconnect();
  }
}

createTestUsers();