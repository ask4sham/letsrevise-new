const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      console.log("MongoDB URI not set (MONGODB_URI or MONGO_URI). Running in development mode without database.");
      return;
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);

    // Check if we can perform operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Available collections: ${collections.length}`);

    // PR-HARD-3: Verify fingerprinted collection indexes (log warning only, never crash)
    try {
      const { verifyIndexes } = require("../utils/verifyIndexes");
      await verifyIndexes();
    } catch (e) {
      console.warn("[PR-HARD-3] Index verification failed:", e.message);
    }
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log("Running in development mode - using in-memory data");
  }
};

module.exports = connectDB;
