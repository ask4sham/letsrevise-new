const mongoose = require('mongoose');

async function checkLetsreviseDb() {
  try {
    const conn = await mongoose.createConnection('mongodb://localhost:27017/letsrevise').asPromise();
    
    const collections = await conn.db.listCollections().toArray();
    console.log('Collections in letsrevise:');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Check for users collection
    for (const col of collections) {
      if (col.name.toLowerCase().includes('user')) {
        const collection = conn.db.collection(col.name);
        const docs = await collection.find({}).toArray();
        console.log(`\nFound ${docs.length} users in ${col.name}:`);
        docs.forEach(doc => {
          console.log(`  ID: ${doc._id}, Email: ${doc.email || 'N/A'}, Name: ${doc.firstName || ''} ${doc.lastName || ''}`);
        });
      }
    }
    
    await conn.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkLetsreviseDb();