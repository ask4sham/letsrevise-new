const crypto = require("crypto");

function sha256Buffer(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

module.exports = { sha256Buffer };
