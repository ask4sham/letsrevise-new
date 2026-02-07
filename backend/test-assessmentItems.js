// test-assessmentItems.js
const path = require('path');
const fs = require('fs');

console.log("=== Testing assessmentItems.js ===");
console.log("Current directory:", __dirname);

// Read the assessmentItems.js file content
const assessmentItemsPath = path.join(__dirname, "routes", "assessmentItems.js");
console.log("\nFile path:", assessmentItemsPath);
console.log("File exists:", fs.existsSync(assessmentItemsPath));

if (fs.existsSync(assessmentItemsPath)) {
  const content = fs.readFileSync(assessmentItemsPath, 'utf8');
  console.log("\n=== File content (first 10 lines) ===");
  const lines = content.split('\n').slice(0, 10);
  lines.forEach((line, i) => console.log(`${i+1}: ${line}`));
  
  // Check the import line specifically
  console.log("\n=== Checking auth import ===");
  const authImportLine = lines.find(line => line.includes('require') && line.includes('auth'));
  console.log("Auth import line:", authImportLine || "Not found");
}

// Try to require assessmentItems.js
console.log("\n=== Attempting to require assessmentItems.js ===");
try {
  const assessmentItems = require("./routes/assessmentItems");
  console.log("✅ SUCCESS: assessmentItems.js loaded");
} catch (error) {
  console.log("❌ ERROR:", error.message);
  console.log("Error code:", error.code);
  
  // Show the exact line where error occurs
  if (error.stack) {
    const stackLines = error.stack.split('\n');
    console.log("First few stack lines:");
    stackLines.slice(0, 5).forEach(line => console.log("  ", line));
  }
}