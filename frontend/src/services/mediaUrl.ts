/**
 * Media URL service — canonical place for asset URL construction.
 * Use when inserting uploaded media into lesson markdown.
 *
 * Local dev: http://localhost:5000/uploads/...
 * Production: https://letsrevise-new.onrender.com/uploads/...
 *
 * Future: can be extended for S3, R2, Supabase Storage without changing callers.
 */
import { getAssetBaseUrl, makeAbsoluteAssetUrl } from "../utils/assetUrl";

export { getAssetBaseUrl };

/**
 * Convert a relative asset path to an absolute URL.
 * Use at upload-insert time so markdown stores canonical URLs.
 */
export function toAbsoluteAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  const abs = makeAbsoluteAssetUrl(path);
  return abs ?? path;
}
