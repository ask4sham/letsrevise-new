/**
 * Removes lines that are only a block markdown image `![](url)`.
 * Used for strict "one image per block" in V12 markdown split tails.
 */
const LINE_IMAGE = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/;

export function stripStandaloneImageLinesFromMarkdown(markdown: string): string {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const kept = lines.filter((line) => !LINE_IMAGE.test(line));
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
