// check-users.js
const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected!");

    // 👉 Correct model path
    const User = require("./backend/models/User");

    const users = await User.find(
      {},
      "email userType firstName lastName shamCoins"
    );

    console.log("\nAll users in database:");
    users.forEach((user) => {
      console.log(
        `- ${user.email} (${user.userType}) → ${user.firstName} ${user.lastName}, Coins: ${user.shamCoins}`
      );
    });

    mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
    mongoose.disconnect();
  }
}

run();
