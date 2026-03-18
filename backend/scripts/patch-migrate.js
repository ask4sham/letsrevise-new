const fs = require("fs");
const path = require("path");
const filePath = path.join(__dirname, "migrate-legacy-image-urls.js");
let s = fs.readFileSync(filePath, "utf8");
s = s.replace(/\r\n/g, "\n");

// 1) Lessons: remove .lean() and use lessonsUpdatedCount
s = s.replace("const lessons = await Lesson.find({}).lean();", "const lessons = await Lesson.find({});");
s = s.replace("const lessonUpdates = [];", "let lessonsUpdatedCount = 0;");

// 2) In lesson loop: remove updates object, use lesson.content + markModified, urlCount
s = s.replace(
  "    const updates = {};\n    let docChanged = false;\n\n    // Legacy content\n    if (lesson.content) {\n      const { transformed, changed, count } = transformMarkdownImageUrls(lesson.content);\n      if (changed) {\n        updates.content = transformed;\n        docChanged = true;\n        urlsRewritten += count;\n      }\n    }",
  "    let docChanged = false;\n    let urlCount = 0;\n\n    // Legacy content\n    if (lesson.content) {\n      const { transformed, changed, count } = transformMarkdownImageUrls(lesson.content);\n      if (changed) {\n        lesson.content = transformed;\n        lesson.markModified(\"content\");\n        docChanged = true;\n        urlCount += count;\n      }\n    }"
);

// 3) In lesson pages loop: use urlCount and assign lesson.pages + markModified
s = s.replace(
  "            urlsRewritten += count;\n          }\n        }\n\n        // Blocks\n        if (page.blocks",
  "            urlCount += count;\n          }\n        }\n\n        // Blocks\n        if (page.blocks"
);
s = s.replace(
  "                urlsRewritten += count;\n              }\n            }\n\n            if (block.imageUrl)",
  "                urlCount += count;\n              }\n            }\n\n            if (block.imageUrl)"
);
s = s.replace(
  "                urlsRewritten += count;\n              }\n            }\n\n            return newBlock;",
  "                urlCount += count;\n              }\n            }\n\n            return newBlock;"
);

// 4) When pages changed: assign lesson.pages and markModified
s = s.replace(
  "      if (pagesChanged) {\n        updates.pages = newPages;\n        docChanged = true;\n      }\n    }\n\n    if (docChanged) {\n      totalWouldUpdate += 1;\n      lessonUpdates.push({ id: lesson._id, title: lesson.title, updates });\n    }\n  }\n\n  console.log(`[lessons] ${lessonUpdates.length}",
  "      if (pagesChanged) {\n        lesson.pages = [...newPages];\n        lesson.markModified(\"pages\");\n        docChanged = true;\n      }\n    }\n\n    if (docChanged) {\n      totalWouldUpdate += 1;\n      urlsRewritten += urlCount;\n      if (apply) {\n        await lesson.save();\n        lessonsUpdatedCount += 1;\n        if (lessonsUpdatedCount <= 10) {\n          console.log(`  - ${lesson._id} \"${lesson.title}\" (${urlCount} URL(s))`);\n        }\n      }\n    }\n  }\n\n  console.log(`[lessons] ${totalWouldUpdate}"
);

// 5) Remove old lesson apply block and fix console
s = s.replace(
  "  if (lessonUpdates.length > 0 && lessonUpdates.length <= 5) {\n    lessonUpdates.forEach((u) => console.log(`  - ${u.id} \"${u.title}\"`));\n  } else if (lessonUpdates.length > 5) {\n    lessonUpdates.slice(0, 3).forEach((u) => console.log(`  - ${u.id} \"${u.title}\"`));\n    console.log(`  ... and ${lessonUpdates.length - 3} more`);\n  }\n\n  if (apply && lessonUpdates.length > 0) {\n    for (const { id, updates } of lessonUpdates) {\n      await Lesson.updateOne({ _id: id }, { $set: updates });\n      totalUpdated += 1;\n    }\n    console.log(`[lessons] Updated ${totalUpdated} document(s).`);\n  }",
  "  if (apply && lessonsUpdatedCount > 0) {\n    console.log(`[lessons] Updated ${lessonsUpdatedCount} document(s).`);\n  }"
);

// 6) Summary: use lessonsUpdatedCount and templatesUpdatedCount
s = s.replace(
  "    console.log(`Lessons updated: ${lessonUpdates.length}`);\n    console.log(`Templates updated: ${templateUpdates.length}`);",
  "    console.log(`Lessons updated: ${lessonsUpdatedCount}`);\n    console.log(`Templates updated: ${templateUpdates.length}`);"
);

fs.writeFileSync(filePath, s);
console.log("Patched migrate-legacy-image-urls.js");
