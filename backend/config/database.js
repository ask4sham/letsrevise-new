const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.log("MongoDB URI not set. Running in development mode without database.");
      return;
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);

    // Check if we can perform operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Available collections: ${collections.length}`);

  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.log("Running in development mode - using in-memory data");
  }
};

module.exports = connectDB;
