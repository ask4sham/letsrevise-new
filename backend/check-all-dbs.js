const mongoose = require('mongoose');

async function checkAllDatabases() {
  try {
    // Connect without specifying database first
    const conn = await mongoose.createConnection('mongodb://localhost:27017').asPromise();
    
    const adminDb = conn.db.admin();
    const dbs = await adminDb.listDatabases();
    
    console.log('All databases:');
    dbs.databases.forEach(db => {
      console.log(`- ${db.name} (size: ${db.sizeOnDisk} bytes)`);
    });
    
    // Now connect to learnplace specifically
    await conn.close();
    
    const learnplaceConn = await mongoose.createConnection('mongodb://localhost:27017/learnplace').asPromise();
    
    // Check all collections
    const collections = await learnplaceConn.db.listCollections().toArray();
    console.log('\nCollections in learnplace:');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });
    
    // Check users model
    const User = require('./models/User');
    // Need to attach model to this connection
    const userSchema = new mongoose.Schema(User.schema.obj);
    const UserModel = learnplaceConn.model('User', userSchema);
    
    const allUsers = await UserModel.find({});
    console.log(`\nUsers in learnplace database: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`  ID: ${user._id}, Email: ${user.email}`);
    });
    
    // Also check any collection with 'user' in name
    for (const col of collections) {
      if (col.name.toLowerCase().includes('user')) {
        const collection = learnplaceConn.db.collection(col.name);
        const count = await collection.countDocuments();
        console.log(`\nCollection ${col.name} has ${count} documents`);
        if (count > 0) {
          const docs = await collection.find({}).limit(10).toArray();
          docs.forEach(doc => {
            console.log(`  ID: ${doc._id}, Email: ${doc.email || 'N/A'}`);
          });
        }
      }
    }
    
    await learnplaceConn.close();
    console.log('\n✅ Check complete');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkAllDatabases();