/**
 * PR-018: Shared citation link builder.
 * Teacher: full deep links; Student: lesson links only when in same lesson context.
 */
import type { EnquiryCitation } from "../../api/enquiry";

/**
 * Build a citation link for opening the source.
 * @param citation - citation with deepLink or sourceType/sourceId
 * @param opts - studentSafe: only link when lessonId matches; lessonId: current lesson context
 * @returns URL string or null if no link available
 */
export function buildCitationLink(
  citation: EnquiryCitation,
  opts?: { lessonId?: string; studentSafe?: boolean }
): string | null {
  const studentSafe = opts?.studentSafe ?? false;
  const lessonId = opts?.lessonId;

  // External citations: always return externalUrl (opens in new tab where used)
  if (citation.sourceType === "externalTrusted") {
    return citation.externalUrl;
  }

  // lessonBlock: deepLink with page/block, or fallback to /lesson/:sourceId
  if (citation.sourceType === "lessonBlock") {
    if (citation.deepLink && citation.deepLink.lessonId) {
      const { lessonId: lid, pageIndex, blockIndex } = citation.deepLink;
      if (studentSafe && lessonId && citation.sourceId !== lessonId) return null;
      let url = `/lesson/${lid}`;
      const page = pageIndex ?? 0;
      url += `?page=${page}`;
      if (blockIndex != null) url += `#block-${blockIndex}`;
      return url;
    }
    if (citation.sourceId) {
      if (studentSafe && lessonId && citation.sourceId !== lessonId) return null;
      return `/lesson/${citation.sourceId}`;
    }
  }

  // specStatement: no link (unless spec viewer added later)
  return null;
}
