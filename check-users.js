// check-users.js — quick Mongo user list (root: requires backend/models/User)
const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      console.error("Set MONGODB_URI or MONGO_URI in .env");
      process.exit(1);
    }
    await mongoose.connect(uri);
    const User = require("./backend/models/User");

    const users = await User.find(
      {},
      "email userType firstName lastName earnings"
    );

    console.log("\nAll users in database:");
    users.forEach((user) => {
      console.log(
        `- ${user.email} (${user.userType}) → ${user.firstName} ${user.lastName}, Earnings: ${user.earnings ?? 0}`
      );
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
