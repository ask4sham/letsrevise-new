const mongoose = require("mongoose");
require("dotenv").config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("\nCollections:");
    collections.forEach(c => console.log("  - " + c.name));
    
    const users = await mongoose.connection.db.collection("users").find({}).toArray();
    console.log("\nUsers (" + users.length + "):");
    users.forEach(u => {
      console.log("  Email: " + (u.email || "none") + ", Role: " + (u.role || "none"));
    });
    
    const teacher = await mongoose.connection.db.collection("users").findOne({ email: "teacher@example.com" });
    console.log("\nTeacher account (teacher@example.com):", teacher ? "FOUND" : "NOT FOUND");
    if (teacher) {
      console.log("  Role:", teacher.role);
      console.log("  ID:", teacher._id);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err.message);
  }
}

check();
