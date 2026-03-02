/**
 * One-time fix: remove duplicate Readiness + Past paper block from center column
 * in EditLessonPage.tsx if present (fixes "Expected corresponding JSX closing tag for <main>").
 */
const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "src", "pages", "EditLessonPage.tsx");
let content = fs.readFileSync(filePath, "utf8");

// Normalize line endings so markers match
content = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

// End of lesson-details card (after Description </label>) and start of pages conditional
const afterLessonDetails = "              </div>\n\n              {!pagesReady ? (";

if (content.includes(afterLessonDetails)) {
  console.log("No duplicate block found - file already fixed.");
  process.exit(0);
}

// Duplicate block sits between lesson details and {!pagesReady. Find it.
// End of the white card (Lesson details + Description). No trailing spaces so we don't double them.
const anchorEnd = "                </div>\n              </div>\n\n";
const anchorStart = "              {!pagesReady ? (";

const idxEnd = content.indexOf(anchorEnd);
const idxStart = content.indexOf(anchorStart, idxEnd);
if (idxEnd === -1 || idxStart === -1) {
  console.log("Could not find anchor pattern - file may already be fixed or structure changed.");
  process.exit(0);
}

const between = content.slice(idxEnd + anchorEnd.length, idxStart);
const isDuplicate =
  between.includes("Past paper questions") &&
  (between.includes("})()}" ) || between.includes("evaluateLessonReadiness"));

if (!isDuplicate) {
  console.log("Content between anchors is not the duplicate block - skipping.");
  process.exit(0);
}

// Remove the duplicate: keep up to anchorEnd, then from anchorStart to end
content = content.slice(0, idxEnd + anchorEnd.length) + content.slice(idxStart);
fs.writeFileSync(filePath, content);
console.log("Removed duplicate Readiness + Past paper block from center column.");
