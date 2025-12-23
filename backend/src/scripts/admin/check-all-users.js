const mongoose = require('mongoose');
require('dotenv').config(); // If using dotenv

// Adjust this import based on your actual User model location
const User = require('./User'); // or './User.model' or '../models/User'

async function checkAllUsers() {
  try {
    // Use environment variable or fallback
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/learnplace';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    const users = await User.find({});
    console.log(`Found ${users.length} users:`);
    
    users.forEach(user => {
      console.log(`- ID: ${user._id}, Email: ${user.email}, Role: ${user.role || 'N/A'}`);
      
      // Optional: Check teacher accounts specifically
      if (user.role === 'teacher') {
        console.log(`  ^ TEACHER ACCOUNT`);
      }
    });
    
    // Check specifically for teacher accounts
    const teachers = await User.find({ role: 'teacher' });
    console.log(`\nTotal Teachers: ${teachers.length}`);
    
    teachers.forEach(teacher => {
      console.log(`Teacher: ${teacher.email} (ID: ${teacher._id})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkAllUsers();