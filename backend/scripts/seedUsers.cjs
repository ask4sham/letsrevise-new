require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

(async () => {
  const uri = process.env.MONGO_URI;

  if (!uri || (!uri.startsWith("mongodb://") && !uri.startsWith("mongodb+srv://"))) {
    console.error("MONGO_URI missing/invalid. Put a real mongodb:// or mongodb+srv:// string in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const upsert = async ({ email, password, userType, firstName, lastName }) => {
    const e = email.toLowerCase().trim();
    const hashed = await bcrypt.hash(password, 12);
    const u = await User.findOne({ email: e });

    const payload = { email: e, password: hashed, userType, firstName, lastName };

    if (u) {
      Object.assign(u, payload);
      await u.save();
      console.log(`Updated: ${e} (${userType})`);
    } else {
      await User.create(payload);
      console.log(`Created: ${e} (${userType})`);
    }
  };

  await upsert({
    email: "admin@example.com",
    password: "Password123",
    userType: "admin",
    firstName: "Admin",
    lastName: "User"
  });

  await upsert({
    email: "parent@example.com",
    password: "Password123",
    userType: "parent",
    firstName: "Parent",
    lastName: "User"
  });

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
