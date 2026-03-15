/**
 * PR-PP1: Save upload to disk and compute sha256.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { FILE_STORAGE_PATH } = require("../config/paths");
const UPLOAD_DIR = process.env.FILE_UPLOAD_DIR || path.join(FILE_STORAGE_PATH, "past-papers");
const MAX_SIZE = Number(process.env.FILE_UPLOAD_MAX_MB) * 1024 * 1024 || 25 * 1024 * 1024; // 25MB default
const ALLOWED_MIMES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * @param {Buffer} buffer - File buffer
 * @param {{ originalName: string; mimetype: string; size?: number }} fileInfo
 * @param {string} ownerId - For subfolder
 * @returns {{ path: string; sha256: string; size: number; mimeType: string; originalName: string }}
 */
function saveUploadAndHash(buffer, fileInfo, ownerId) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error("Invalid buffer");
  }
  if (buffer.length > MAX_SIZE) {
    throw new Error(`File too large (max ${Math.round(MAX_SIZE / 1024 / 1024)}MB)`);
  }
  const mimeType = (fileInfo.mimetype || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIMES.includes(mimeType)) {
    throw new Error(`Invalid file type. Allowed: pdf, doc, docx`);
  }

  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const ext = path.extname(fileInfo.originalName || "file") || ".bin";
  const safeName = `${hash.slice(0, 16)}_${Date.now()}${ext}`;
  const subDir = path.join(UPLOAD_DIR, String(ownerId));
  ensureDir(subDir);
  const filePath = path.resolve(path.join(subDir, safeName));
  fs.writeFileSync(filePath, buffer);

  return {
    path: filePath,
    sha256: hash,
    size: buffer.length,
    mimeType,
    originalName: fileInfo.originalName || "file",
  };
}

module.exports = {
  saveUploadAndHash,
  UPLOAD_DIR,
  MAX_SIZE,
  ALLOWED_MIMES,
};
