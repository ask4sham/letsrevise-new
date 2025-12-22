const mongoose = require('mongoose');
const Lesson = require('./models/Lesson');

async function testLesson() {
  await mongoose.connect('mongodb://localhost:27017/learnplace');
  
  // Try to create a lesson directly
  const lesson = new Lesson({
    title: "Direct Test Lesson",
    description: "Test description",
    content: "Test content",
    teacherId: "6932a584172fdf5633914fca",
    teacherName: "Jane Smith",
    subject: "Mathematics",
    level: "GCSE",
    topic: "Algebra",
    estimatedDuration: 30,
    shamCoinPrice: 50
  });
  
  try {
    await lesson.save();
    console.log('✅ Lesson saved successfully!');
    console.log('Lesson ID:', lesson._id);
  } catch (error) {
    console.error('❌ Error saving lesson:', error.message);
    console.error('Validation errors:', error.errors);
  }
  
  mongoose.disconnect();
}

testLesson();