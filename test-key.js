// test-key.js
require('dotenv').config();

console.log('🔑 Testing OpenAI API Key...');
console.log('Key exists:', !!process.env.OPENAI_API_KEY);
console.log('Key length:', process.env.OPENAI_API_KEY?.length);
console.log('First 20 chars:', process.env.OPENAI_API_KEY?.substring(0, 20));
console.log('Key starts with sk?:', process.env.OPENAI_API_KEY?.startsWith('sk-'));

// Test the key format
const key = process.env.OPENAI_API_KEY;
if (key) {
  console.log('\n🔍 Key Analysis:');
  console.log('- Has spaces:', key.includes(' '));
  console.log('- Has newlines:', key.includes('\n'));
  console.log('- Has quotes:', key.startsWith('"') || key.startsWith("'"));
  
  // Clean the key
  const cleanKey = key.trim().replace(/['"]/g, '');
  console.log('\n✨ Cleaned key (first 30 chars):', cleanKey.substring(0, 30));
  console.log('Cleaned length:', cleanKey.length);
}