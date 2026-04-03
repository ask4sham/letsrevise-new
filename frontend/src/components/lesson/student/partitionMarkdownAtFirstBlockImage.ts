/**
 * Finds the first standalone markdown image line (![](url)) and splits content.
 * Used for SS2 text-left / image-right when the image lives inside a text block (not type "diagram").
 */
const LINE_IMAGE = /^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/;

export type MarkdownBlockImageSplit = {
  /** Markdown for the left column (may be empty if the image was the first line). */
  leftMarkdown: string;
  alt: string;
  src: string;
  /** Markdown rendered full-width below the row (content after the image line). */
  tailMarkdown: string;
};

export function partitionMarkdownAtFirstBlockImage(content: string): MarkdownBlockImageSplit | null {
  const raw = String(content ?? "");
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(LINE_IMAGE);
    if (!m) continue;
    const beforeLines = lines.slice(0, i);
    const afterLines = lines.slice(i + 1);
    const beforeMd = beforeLines.join("\n").trimEnd();
    const afterMd = afterLines.join("\n").trimStart();
    if (!beforeMd && !afterMd) {
      return null;
    }
    const leftMarkdown = beforeMd ? beforeMd : afterMd;
    const tailMarkdown = beforeMd && afterMd ? afterMd : "";
    return {
      leftMarkdown,
      alt: m[1] || "",
      src: m[2] || "",
      tailMarkdown,
    };
  }
  return null;
}
