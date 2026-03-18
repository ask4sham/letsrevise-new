const fs = require("fs");
let s = fs.readFileSync("migrate-legacy-image-urls.js", "utf8");
s = s.replace(/.*String\.fromCharCode\(96,32,45,32\).*urlCount.*String\.fromCharCode\(32,85,82,76,40,115,41,41\).*;/g,
  "          console.log(`  - ${lesson._id} ` + String.fromCharCode(34) + lesson.title + String.fromCharCode(34) + ` (${urlCount} URL(s))`);");
fs.writeFileSync("migrate-legacy-image-urls.js", s);
