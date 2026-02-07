// diagnostic.js
const path = require('path');
const fs = require('fs');

console.log("=== DIAGNOSTIC: Checking auth.js dependencies ===");
console.log("Current directory:", __dirname);

// Check if auth.js exists
const authPath = path.join(__dirname, "middleware", "auth.js");
console.log("\n1. Checking auth.js file:");
console.log("   Path:", authPath);
console.log("   Exists:", fs.existsSync(authPath));

// Check if utils/jwtSecret.js exists
const jwtSecretPath = path.join(__dirname, "utils", "jwtSecret.js");
console.log("\n2. Checking utils/jwtSecret.js:");
console.log("   Path:", jwtSecretPath);
console.log("   Exists:", fs.existsSync(jwtSecretPath));

// Check if models/User.js exists
const userPath = path.join(__dirname, "models", "User.js");
console.log("\n3. Checking models/User.js:");
console.log("   Path:", userPath);
console.log("   Exists:", fs.existsSync(userPath));

// Try to require auth.js
console.log("\n4. Attempting to require auth.js:");
try {
  const auth = require("./middleware/auth");
  console.log("   ✅ SUCCESS: Auth loaded");
  console.log("   Type:", typeof auth);
} catch (error) {
  console.log("   ❌ ERROR:", error.message);
  console.log("   Code:", error.code);
  console.log("   Stack:", error.stack.split('\n')[0]);
}

// Try to require utils/jwtSecret.js directly
console.log("\n5. Checking utils/jwtSecret.js directly:");
try {
  const jwtSecret = require("./utils/jwtSecret");
  console.log("   ✅ SUCCESS: jwtSecret loaded");
} catch (error) {
  console.log("   ❌ ERROR:", error.message);
}