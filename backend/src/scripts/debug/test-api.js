require('dotenv').config();
const axios = require('axios');

async function testOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  
  if (!apiKey) {
    console.log('❌ No API key found');
    return;
  }

  console.log(`🔑 Testing key: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "Hello" only' }],
        max_tokens: 5
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    
    console.log('✅ OpenAI API Key works!');
    console.log('Response:', response.data.choices[0].message.content);
    
  } catch (error) {
    console.log('❌ OpenAI API Error:');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error message:', error.response.data?.error?.message);
      
      // Common errors:
      if (error.response.status === 401) {
        console.log('\n🔴 Possible issues:');
        console.log('1. Key is invalid or expired');
        console.log('2. Key has incorrect permissions');
        console.log('3. Account has no credits/billing setup');
      } else if (error.response.status === 429) {
        console.log('Rate limited - try again in a minute');
      }
    } else {
      console.log('Network error:', error.message);
    }
  }
}

testOpenAIKey();
