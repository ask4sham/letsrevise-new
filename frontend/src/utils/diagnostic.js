console.log("🔍 UI DIAGNOSTIC ======================");

// Check localStorage
const token = localStorage.getItem("token");
const userStr = localStorage.getItem("user");
console.log("1. Token exists:", !!token);
console.log("2. User data exists:", !!userStr);

if (userStr) {
  try {
    const user = JSON.parse(userStr);
    console.log("3. User type:", user.userType);
    console.log("4. User email:", user.email);
    console.log("5. Full user:", user);
  } catch (e) {
    console.error("Error parsing user:", e);
  }
}

// Check current URL and page
console.log("6. Current URL:", window.location.href);
console.log("7. Page title:", document.title);

// Check for any "Student" text in UI elements
const elementsWithStudent = [];
document.querySelectorAll('*').forEach(el => {
  if (el.textContent && el.textContent.includes('Student') && 
      !el.textContent.includes('Teacher') &&
      el.offsetWidth > 0 && el.offsetHeight > 0) {
    elementsWithStudent.push({
      tag: el.tagName,
      text: el.textContent.substring(0, 100),
      className: el.className,
      id: el.id
    });
  }
});

console.log("8. Elements with 'Student' text:", elementsWithStudent.length);
if (elementsWithStudent.length > 0) {
  console.log("   Found in:", elementsWithStudent);
}

// Check Header rendering
const header = document.querySelector('header');
console.log("9. Header exists:", !!header);
if (header) {
  console.log("   Header HTML (first 500 chars):", header.outerHTML.substring(0, 500));
}

console.log("=====================================");
