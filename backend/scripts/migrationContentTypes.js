/** Shared MIME guess for migration scripts */
function guessContentType(filePath) {
  const path = require("path");
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".json": "application/json",
  };
  return map[ext] || "application/octet-stream";
}

module.exports = { guessContentType };
