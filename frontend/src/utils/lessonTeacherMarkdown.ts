/**
 * Teacher-authored block content: normalize line endings, fix bullets without breaking **bold** markdown.
 */

export function sanitizeTeacherMarkdown(input: string): string {
  let text = (input || "").replace(/\r\n/g, "\n");

  // Bullet markers at line start — never treat leading ** as a bullet
  text = text.replace(/^[ \t]*[•·–—]\s*/gm, "- ");
  text = text.replace(/^[ \t]*\*\s+(?!\*)/gm, "- ");
  text = text.replace(/^[ \t]*-\s*(?=\S)/gm, "- ");

  const lines = text.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const cur = lines[i].trim();
    const next = lines[i + 1].trim();

    const looksLikeHeading =
      cur.length > 0 &&
      cur.length <= 60 &&
      !cur.startsWith("#") &&
      !cur.startsWith("-") &&
      !cur.startsWith("*") &&
      !cur.endsWith(".") &&
      !cur.endsWith(":");

    const nextIsList = next.startsWith("- ");

    if (looksLikeHeading && nextIsList) {
      lines[i] = `### ${cur}`;
    }
  }

  // Preserve internal blank lines; only trim trailing spaces on the last line (not whole-string trimEnd)
  return lines.join("\n").replace(/[ \t]+$/gm, "");
}
