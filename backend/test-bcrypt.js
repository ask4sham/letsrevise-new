const bcrypt = require('bcryptjs');

async function testBcrypt() {
  const password = 'Password123';
  const storedHash = '.JjZPcKp9a3nREhV9HjPnkoeUV.0U5mm';
  
  console.log('Testing bcrypt comparison...');
  console.log('Password:', password);
  console.log('Stored Hash:', storedHash);
  
  // Test 1: Compare with bcryptjs
  const match1 = await bcrypt.compare(password, storedHash);
  console.log('\\n✅ bcryptjs.compare result:', match1);
  
  // Test 2: Create a new hash with same settings
  console.log('\\nCreating new hash for comparison...');
  const newHash = await bcrypt.hash(password, 10);
  console.log('New Hash:', newHash);
  
  const match2 = await bcrypt.compare(password, newHash);
  console.log('New hash comparison:', match2);
  
  // Test 3: Try with exact same creation
  console.log('\\nTesting hash recreation...');
  const salt = await bcrypt.genSalt(10);
  const recreatedHash = await bcrypt.hash(password, salt);
  console.log('Recreated Hash:', recreatedHash);
  console.log('Matches original?', recreatedHash === storedHash);
  console.log('Length comparison:', recreatedHash.length, 'vs', storedHash.length);
}

testBcrypt().catch(console.error);
