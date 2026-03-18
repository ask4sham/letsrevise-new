const fs = require("fs");
let s = fs.readFileSync("migrate-legacy-image-urls.js", "utf8");
const oldBlock = `  console.log(\`[lessons] \${lessonUpdates.length} lesson(s) would be updated.\`);
  if (lessonUpdates.length > 0 && lessonUpdates.length <= 5) {
    lessonUpdates.forEach((u) => console.log(\`  - \${u.id} "\${u.title}"\`));
  } else if (lessonUpdates.length > 5) {
    lessonUpdates.slice(0, 3).forEach((u) => console.log(\`  - \${u.id} "\${u.title}"\`));
    console.log(\`  ... and \${lessonUpdates.length - 3} more\`);
  }

  if (apply && lessonUpdates.length > 0) {
    for (const { id, updates } of lessonUpdates) {
      await Lesson.updateOne({ _id: id }, { $set: updates });
      totalUpdated += 1;
    }
    console.log(\`[lessons] Updated \${totalUpdated} document(s).\`);
  }`;
const newBlock = `  console.log(\`[lessons] \${totalWouldUpdate} lesson(s) would be updated.\`);
  if (apply && lessonsUpdatedCount > 0) {
    console.log(\`[lessons] Updated \${lessonsUpdatedCount} document(s).\`);
  }`;
s = s.replace(/  console\.log\(`\[lessons\] \$\{lessonUpdates\.length\} lesson\(s\) would be updated\.`\);\s+if \(lessonUpdates\.length > 0[\s\S]*?console\.log\(`\[lessons\] Updated \$\{totalUpdated\} document\(s\)\.`\);\s+\}/, newBlock);
s = s.replace("lessonUpdates.length", "lessonsUpdatedCount");
const templateOld = "  console.log(`[templates] ${templateUpdates.length} template(s) would be updated.`);\n  if (templateUpdates.length > 0 && templateUpdates.length <= 5) {\n    templateUpdates.forEach((u) => console.log(`  - ${u.id} \"${u.name}\"`));\n  } else if (templateUpdates.length > 5) {\n    templateUpdates.slice(0, 3).forEach((u) => console.log(`  - ${u.id} \"${u.name}\"`));\n    console.log(`  ... and ${templateUpdates.length - 3} more`);\n  }\n\n  if (apply && templateUpdates.length > 0) {\n    for (const { id, updates } of templateUpdates) {\n      await Template.updateOne({ _id: id }, { $set: updates });\n      totalUpdated += 1;\n    }\n    console.log(`[templates] Updated ${templateUpdates.length} document(s).`);\n  }";
const templateNew = "  console.log(`[templates] ${templateWouldUpdate} template(s) would be updated.`);\n  if (apply && templatesUpdatedCount > 0) {\n    console.log(`[templates] Updated ${templatesUpdatedCount} document(s).`);\n  }";
s = s.replace(templateOld, templateNew);
s = s.replace("console.log(`Templates updated: ${templateUpdates.length}`);", "console.log(`Templates updated: ${templatesUpdatedCount}`);");
fs.writeFileSync("migrate-legacy-image-urls.js", s);
console.log("ok");
