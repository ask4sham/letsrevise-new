// backend/tests/setup.js
// Test harness only: in-memory Mongo for integration tests. Replica set for transactions (Phase 9C purchase).
if (!process.env.JWT_SECRET_KEY) {
  process.env.JWT_SECRET_KEY = "test-secret-for-backend-tests";
}
// generate-and-save routes require a key before axios mocks run (integration tests)
if (!process.env.OPENAI_API_KEY || !String(process.env.OPENAI_API_KEY).trim()) {
  process.env.OPENAI_API_KEY = "sk-test-ci-dummy";
}
process.env.NODE_ENV = process.env.NODE_ENV || "test";
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let mongoReplSet;

beforeAll(async () => {
  // Allow slow CI/machines: give hook 90s so repl set start + connect can finish (library default start is 10s)
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const mongoUri = mongoReplSet.getUri();
  await mongoose.connect(mongoUri);
  // Ensure connection is ready before any test runs (avoids "buffering timed out" in first test)
  await mongoose.connection.db.admin().command({ ping: 1 });
}, 90000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoReplSet) await mongoReplSet.stop();
}, 15000);

// ❌ REMOVED: afterEach cleanup block
// This was deleting users/paper between tests, causing 401 errors
// because tests couldn't find the users created in beforeAll