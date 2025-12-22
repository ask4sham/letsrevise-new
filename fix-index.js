const { MongoClient } = require('mongodb');

async function fixIndex() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const database = client.db('letsrevise');
    const users = database.collection('users');
    
    // Check current indexes
    const indexes = await users.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Drop the referralCode index if it exists
    try {
      await users.dropIndex('referralCode_1');
      console.log('✅ Dropped referralCode_1 index');
    } catch (err) {
      console.log('ℹ️ referralCode_1 index not found or already dropped');
    }
    
    // Create sparse unique index
    await users.createIndex(
      { referralCode: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'referralCode_sparse' 
      }
    );
    console.log('✅ Created sparse unique index on referralCode');
    
    // Verify
    const newIndexes = await users.indexes();
    console.log('New indexes:', JSON.stringify(newIndexes, null, 2));
    
    // Test with sample data
    console.log('\n📊 Testing with existing users:');
    const allUsers = await users.find({}).toArray();
    console.log(`Total users: ${allUsers.length}`);
    
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.userType}): referralCode = ${user.referralCode || 'null/undefined'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

fixIndex();
