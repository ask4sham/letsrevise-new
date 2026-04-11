const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { IS_PRODUCTION } = require("../utils/safeErrorResponse");

dotenv.config();

/** Mask password in mongodb+srv:// or mongodb:// URIs for logs */
function maskMongoUri(uri) {
  if (!uri || typeof uri !== "string") return "(empty)";
  return uri.replace(/:([^/@]+)@/, ":****@");
}

/**
 * Connect to MongoDB. Call once at process startup before accepting HTTP traffic.
 *
 * Env (first match wins):
 *   - MONGODB_URI (recommended; matches .env.example and Atlas docs)
 *   - MONGO_URI (legacy alias, still supported)
 *
 * Production: URI is required; connection failure exits the process (fail fast).
 * Development: missing URI skips DB (optional local dev without Mongo).
 */
const connectDB = async () => {
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();

  if (!uri) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[MongoDB] FATAL: Set MONGODB_URI or MONGO_URI in production (Render → Environment)."
      );
      process.exit(1);
    }
    console.warn(
      "[MongoDB] No MONGODB_URI / MONGO_URI — skipping connect (dev only). API routes that need DB will fail or buffer."
    );
    return;
  }

  console.log(IS_PRODUCTION ? "[MongoDB] connecting…" : `[MongoDB] Connecting… ${maskMongoUri(uri)}`);

  const opts = {
    serverSelectionTimeoutMS: 15_000,
  };

  try {
    await mongoose.connect(uri, opts);
    const host = mongoose.connection.host;
    const name = mongoose.connection.name;
    console.log(`[MongoDB] Connected OK — host=${host} db=${name}`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`[MongoDB] Collections visible: ${collections.length}`);

    try {
      const { verifyIndexes } = require("../utils/verifyIndexes");
      await verifyIndexes();
    } catch (e) {
      console.warn("[PR-HARD-3] Index verification failed:", e.message);
    }
  } catch (error) {
    console.error("[MongoDB] Connection FAILED:", error.message);
    if (error && error.stack) {
      console.error("[MongoDB] Stack:", error.stack.split("\n").slice(0, 5).join("\n"));
    }
    throw error;
  }
};

module.exports = connectDB;
