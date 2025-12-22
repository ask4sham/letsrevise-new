console.log("=== DEBUG: localStorage User Data ===");
const user = localStorage.getItem("user");
const token = localStorage.getItem("token");

console.log("Token exists:", !!token);
console.log("User data exists:", !!user);

if (user) {
  try {
    const parsed = JSON.parse(user);
    console.log("Parsed user object:", parsed);
    console.log("User type:", parsed.userType);
    console.log("Email:", parsed.email);
  } catch (err) {
    console.error("Error parsing user:", err);
  }
}

// Also check if there are multiple Header instances
console.log("\n=== DEBUG: Header Elements ===");
const headers = document.querySelectorAll('header');
console.log("Number of header elements:", headers.length);

// Check all elements with "Student" text
const studentElements = document.querySelectorAll('*:contains("Student"):not(script):not(style)');
console.log("Elements containing 'Student':", studentElements.length);
studentElements.forEach(el => {
  if (el.textContent.includes("Student")) {
    console.log("Found:", el.tagName, el.className, el.textContent.substring(0, 50));
  }
});