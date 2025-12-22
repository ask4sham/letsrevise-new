// debug-users.js - Place in backend folder
const mongoose = require('mongoose');
require('dotenv').config();

async function debugDatabase() {
  try {
    // Connect
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learnplace');
    console.log('✅ Connected to MongoDB');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📂 Collections in database:');
    collections.forEach(col => console.log(`   - ${col.name}`));
    
    // Check users collection directly
    const usersCollection = mongoose.connection.db.collection('users');
    const userCount = await usersCollection.countDocuments();
    console.log(`\n👥 Total users in 'users' collection: ${userCount}`);
    
    // Get all users with all fields
    const allUsers = await usersCollection.find({}).toArray();
    
    console.log('\n🔍 ALL USERS (raw from database):');
    allUsers.forEach((user, i) => {
      console.log(`\n[${i + 1}] ${user.email || 'No email'}`);
      console.log(`   _id: ${user._id}`);
      console.log(`   role: ${user.role || 'NOT SET'}`);
      console.log(`   password exists: ${!!user.password}`);
      console.log(`   all fields:`, Object.keys(user).join(', '));
    });
    
    // Check for teacher@example.com specifically
    const teacher = await usersCollection.findOne({ email: 'teacher@example.com' });
    console.log('\n🎯 Looking for teacher@example.com:');
    console.log(teacher ? '✅ Found:' : '❌ NOT FOUND');
    if (teacher) {
      console.log(JSON.stringify(teacher, null, 2));
    }
    
    // Check any user with teacher role
    const teachers = await usersCollection.find({ role: 'teacher' }).toArray();
    console.log(`\n👨‍🏫 Users with role="teacher": ${teachers.length}`);
    teachers.forEach(t => console.log(`   - ${t.email}`));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugDatabase();