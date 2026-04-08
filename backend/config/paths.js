/**
 * PR-HARD: File storage paths. Configurable via env for production deployment.
 * Default: backend/uploads (local storage).
 * Set FILE_STORAGE_PATH to an absolute path for production (e.g. /var/data/letsrevise/uploads).
 */
const path = require("path");

const FILE_STORAGE_PATH =
  process.env.FILE_STORAGE_PATH || path.join(__dirname, "..", "uploads");

/** Curated static media committed under backend/public/visuals — served at /visuals/... */
const PUBLIC_VISUALS_DIR = path.join(__dirname, "..", "public", "visuals");

module.exports = {
  FILE_STORAGE_PATH,
  PUBLIC_VISUALS_DIR,
};
