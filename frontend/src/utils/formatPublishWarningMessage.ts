/** Successful publish with non-blocking quality warnings (manual teacher lessons, score below recommended). */

export type PublishWarningSummary = {
  headline: string;
  qualityScore: number;
  recommendedMinimum: number;
  explanation: string;
  topReasons: string[];
};

export function formatPublishWithQualityWarningsMessage(
  s: PublishWarningSummary,
  options?: { leadingSuccessEmoji?: boolean }
): string {
  const headline = options?.leadingSuccessEmoji ? `✅ ${s.headline}` : s.headline;
  const lines = [
    headline,
    "",
    `Quality score: ${s.qualityScore}`,
    `Recommended minimum: ${s.recommendedMinimum}`,
    "",
    s.explanation,
  ];
  if (s.topReasons.length > 0) {
    lines.push("", "Top areas to improve:");
    s.topReasons.forEach((r) => lines.push(`• ${r}`));
  }
  return lines.join("\n");
}
