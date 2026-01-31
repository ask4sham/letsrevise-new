// backend/tests/setup.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Removed unsupported options: useNewUrlParser and useUnifiedTopology
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// ❌ REMOVED: afterEach cleanup block
// This was deleting users/paper between tests, causing 401 errors
// because tests couldn't find the users created in beforeAll