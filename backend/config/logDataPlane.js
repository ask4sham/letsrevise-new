/**
 * Safe startup logging for which data stores the process is using.
 * No secrets: hostnames, database name, boolean flags only.
 */

/**
 * @param {string} uri
 * @returns {{ host: string, database: string } | null}
 */
function parseMongoUriTarget(uri) {
  if (!uri || typeof uri !== "string") return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  try {
    // Strip query string for path parsing
    const q = trimmed.indexOf("?");
    const noQuery = q > 0 ? trimmed.slice(0, q) : trimmed;
    const at = noQuery.indexOf("@");
    const afterAt = at >= 0 ? noQuery.slice(at + 1) : noQuery.replace(/^mongodb(\+srv)?:\/\//, "");
    const slash = afterAt.indexOf("/");
    if (slash >= 0) {
      const host = afterAt.slice(0, slash);
      const database = (afterAt.slice(slash + 1) || "").trim() || "(default)";
      return { host, database };
    }
    return { host: afterAt, database: "(default)" };
  } catch {
    return null;
  }
}

/**
 * @param {string} [url]
 * @returns {string | null}
 */
function supabaseUrlHost(url) {
  if (!url || typeof url !== "string") return null;
  const t = url.trim();
  if (!t) return null;
  try {
    return new URL(t).host || null;
  } catch {
    return "(invalid URL)";
  }
}

/**
 * Call after mongoose.connect succeeds. Uses live connection + env for Supabase.
 * (Replica / SRV: connection.host can differ from the host segment in the URI; trust "live" values.)
 */
function logDataPlaneAfterMongoConnect() {
  const mongoose = require("mongoose");
  const uri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
  const fromEnv = parseMongoUriTarget(uri);
  const liveHost = mongoose.connection.host;
  const liveName = mongoose.connection.name;

  const supHost = supabaseUrlHost(process.env.SUPABASE_URL);
  const onRender = process.env.RENDER === "true" || process.env.RENDER === "1";

  console.log("[data-plane] MongoDB (connected) —", {
    host: liveHost,
    database: liveName,
    onRender: Boolean(onRender),
  });
  if (fromEnv) {
    console.log("[data-plane] MongoDB (from MONGODB_URI / MONGO_URI, no password) —", {
      hostInUri: fromEnv.host,
      databaseInUri: fromEnv.database,
    });
  }
  console.log("[data-plane] Supabase (env) —", {
    urlHost: supHost || "not set",
  });
  console.log(
    "[data-plane] RISK: If local MONGODB_URI / SUPABASE_* match production project/cluster, writes from dev affect live data. Compare hosts to Render / Atlas / Supabase dashboards."
  );
}

module.exports = {
  logDataPlaneAfterMongoConnect,
  parseMongoUriTarget,
  supabaseUrlHost,
};
