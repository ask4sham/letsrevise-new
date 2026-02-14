// backend/tests/setup.js
// Test harness only: in-memory Mongo for integration tests. Replica set for transactions (Phase 9C purchase).
if (!process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET_KEY = "test-secret-for-backend-tests";
}
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoReplSet.getUri();
  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) await mongoReplSet.stop();
});

// ❌ REMOVED: afterEach cleanup block
// This was deleting users/paper between tests, causing 401 errors
// because tests couldn't find the users created in beforeAll