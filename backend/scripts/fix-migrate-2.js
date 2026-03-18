const fs = require("fs");
const p = "migrate-legacy-image-urls.js";
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  "      if (pagesChanged) {\n        updates.pages = newPages;\n        docChanged = true;\n      }\n    }\n\n    if (docChanged) {\n      totalWouldUpdate += 1;\n      lessonUpdates.push({ id: lesson._id, title: lesson.title, updates });\n    }\n  }\n\n  console.log(`[lessons] ${lessonUpdates.length} lesson(s) would be updated.`);\n  if (lessonUpdates.length > 0 && lessonUpdates.length <= 5) {\n    lessonUpdates.forEach((u) => console.log(`  - ${u.id} \"${u.title}\"`));\n  } else if (lessonUpdates.length > 5) {\n    lessonUpdates.slice(0, 3).forEach((u) => console.log(`  - ${u.id} \"${u.title}\"`));\n    console.log(`  ... and ${lessonUpdates.length - 3} more`);\n  }\n\n  if (apply && lessonUpdates.length > 0) {\n    for (const { id, updates } of lessonUpdates) {\n      await Lesson.updateOne({ _id: id }, { $set: updates });\n      totalUpdated += 1;\n    }\n    console.log(`[lessons] Updated ${totalUpdated} document(s).`);\n  }",
  "      if (pagesChanged) {\n        lesson.pages = [...newPages];\n        lesson.markModified(\"pages\");\n        docChanged = true;\n      }\n    }\n\n    if (docChanged) {\n      totalWouldUpdate += 1;\n      urlsRewritten += urlCount;\n      if (apply) {\n        await lesson.save();\n        lessonsUpdatedCount += 1;\n        if (lessonsUpdatedCount <= 10) {\n          console.log(`  - ${lesson._id} \"${lesson.title}\" (${urlCount} URL(s))`);\n        }\n      }\n    }\n  }\n\n  console.log(`[lessons] ${totalWouldUpdate} lesson(s) would be updated.`);\n  if (apply && lessonsUpdatedCount > 0) {\n    console.log(`[lessons] Updated ${lessonsUpdatedCount} document(s).`);\n  }"
);

s = s.replace(
  "    console.log(`Lessons updated: ${lessonUpdates.length}`);\n    console.log(`Templates updated: ${templateUpdates.length}`);",
  "    console.log(`Lessons updated: ${lessonsUpdatedCount}`);\n    console.log(`Templates updated: ${templateUpdates.length}`);"
);

fs.writeFileSync(p, s);
console.log("Done");
