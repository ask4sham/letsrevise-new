/**
 * Local /visuals static serving (backend/public/visuals) vs CDN-only.
 *
 * After migrating files to Supabase/R2 with object keys `visuals/...`, point the frontend at
 * REACT_APP_PUBLIC_VISUALS_CDN_URL (same origin as R2_PUBLIC_URL or your CDN) and optionally
 * disable disk serving to save space on the host.
 *
 * SERVE_LOCAL_PUBLIC_VISUALS — default true. Set "false" to stop serving /visuals from disk.
 * SKIP_LOCAL_VISUALS_STATIC — alias: if truthy, same as SERVE_LOCAL_PUBLIC_VISUALS=false.
 */
const { isTruthyEnv } = require("./storage");

function shouldServeLocalPublicVisuals() {
  if (isTruthyEnv("SKIP_LOCAL_VISUALS_STATIC")) return false;
  const v = String(process.env.SERVE_LOCAL_PUBLIC_VISUALS ?? "")
    .trim()
    .toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

module.exports = {
  shouldServeLocalPublicVisuals,
};
