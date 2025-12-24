require('dotenv').config();

console.log('🔍 Checking OpenAI Key...');
console.log('Key loaded:', !!process.env.OPENAI_API_KEY);
console.log('Key starts with "sk-":', process.env.OPENAI_API_KEY?.startsWith('sk-'));
console.log('Key length:', process.env.OPENAI_API_KEY?.length);

// Remove any possible whitespace or quotes
const key = process.env.OPENAI_API_KEY?.trim().replace(/['"]/g, '');
console.log('\n✨ Cleaned key preview:', key?.substring(0, 15) + '...');
console.log('Cleaned length:', key?.length);

// Test if it's a valid format (should be ~51 chars for sk-proj keys)
if (key && key.length < 40) {
  console.log('⚠️ Warning: Key seems too short for OpenAI');
}
if (key && key.length > 70) {
  console.log('⚠️ Warning: Key seems too long for OpenAI');
}
