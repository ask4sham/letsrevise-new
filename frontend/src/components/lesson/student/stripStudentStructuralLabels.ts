/**
 * Removes leading scaffold lines (e.g. "Explanation", "Key points") from lesson markdown
 * so student view communicates structure visually, not via repeated labels.
 */

function isStructuralLabelLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const patterns: RegExp[] = [
    /^🔑\s*Key Idea\(s\)\s*$/i,
    /^key idea\(s\)\s*:?\s*$/i,
    /^explanation\s*:?\s*$/i,
    /^#{1,6}\s*explanation\s*:?\s*$/i,
    /^#{1,6}\s*key points?\s*:?\s*$/i,
    /^key points?\s*:?\s*$/i,
    /^exam (phrase|insight|tip)\s*:?\s*$/i,
    /^common mistake(s)?\s*:?\s*$/i,
    /^misconception(s)?\s*:?\s*$/i,
    /^hook\s*:?\s*$/i,
    /^stretch\s*:?\s*$/i,
    /^synthesis\s*:?\s*$/i,
    /^keywords?\s*:?\s*$/i,
    /^worked example\s*:?\s*$/i,
    /^#{1,6}\s*(explanation|key points?|key idea\(s\)?|exam (phrase|insight|tip))\s*:?\s*$/i,
    /^#{1,6}\s*(hook|stretch|synthesis|keywords?|worked example)\s*:?\s*$/i,
    /^what you(?:'ll| will) learn\s*:?\s*$/i,
    /^#{1,6}\s*what you(?:'ll| will) learn\s*:?\s*$/i,
    /^\*\*\s*(explanation|key points?|key idea\(s\)?|exam (phrase|insight|tip))\s*\*\*\s*:?\s*$/i,
    /^\*\*(explanation|key points?|key idea\(s\)?|exam (phrase|insight|tip))\*\*\s*:?\s*$/i,
    /^\*\*\s*(hook|stretch|synthesis|keywords?|worked example)\s*\*\*\s*:?\s*$/i,
    /^\*\*(hook|stretch|synthesis|keywords?|worked example)\*\*\s*:?\s*$/i,
    // List / numbered / blockquote variants (whole line)
    /^[-*•]\s+(?:explanation|key points?|exam (?:phrase|insight|tip))\s*:?\s*$/i,
    /^\d+[.)]\s*(?:explanation|key points?|exam (?:phrase|insight|tip))\s*:?\s*$/i,
    /^>\s*(?:explanation|key points?|exam (?:phrase|insight|tip))\s*:?\s*$/i,
  ];
  return patterns.some((p) => p.test(t));
}

/**
 * Removes **Explanation:** / **Key points:** etc. when they appear on the first line of content
 * (same line as body text, or alone).
 */
function stripFirstLineStructuralPrefix(content: string): string {
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return content;

  const line = lines[i];
  const label = /(?:explanation|key points?|exam (?:phrase|insight|tip))/i;

  // Whole line is only a bold label
  if (
    /^\s*\*\*(?:explanation|key points?|exam (?:phrase|insight|tip)|what you(?:'ll| will) learn)\*\*\s*:?\s*$/i.test(
      line
    )
  ) {
    lines.splice(i, 1);
    return lines.join("\n").replace(/^\s+/, "");
  }

  // **Label:** …rest on same line
  const boldPrefix =
    /^\s*\*\*((?:explanation|key points?|exam (?:phrase|insight|tip)|what you(?:'ll| will) learn))\*\*\s*:?\s+/i;
  if (boldPrefix.test(line)) {
    lines[i] = line.replace(boldPrefix, "").trimStart();
    if (!lines[i].trim()) {
      lines.splice(i, 1);
    }
    return lines.join("\n").replace(/^\s+/, "");
  }

  // Plain "Label: " at start of first line
  const plainPrefix =
    /^\s*(?:explanation|key points?|exam (?:phrase|insight|tip)|what you(?:'ll| will) learn)\s*:\s+/i;
  if (plainPrefix.test(line)) {
    lines[i] = line.replace(plainPrefix, "").trimStart();
    if (!lines[i].trim()) {
      lines.splice(i, 1);
    }
    return lines.join("\n").replace(/^\s+/, "");
  }

  // Leading emoji + label (e.g. "🔑 Key idea")
  if (/^\s*🔑\s*key idea(?:\(s\))?\s*:?\s*$/i.test(line)) {
    lines.splice(i, 1);
    return lines.join("\n").replace(/^\s+/, "");
  }
  const emojiPrefix = /^\s*🔑\s*key idea(?:\(s\))?\s*:?\s+/i;
  if (emojiPrefix.test(line)) {
    lines[i] = line.replace(emojiPrefix, "").trimStart();
    return lines.join("\n").replace(/^\s+/, "");
  }

  return content;
}

export function stripStudentStructuralLabels(content: string): string {
  const lines = String(content ?? "").split(/\r?\n/);
  let start = 0;
  while (start < lines.length && isStructuralLabelLine(lines[start])) {
    start++;
  }
  let out = lines.slice(start).join("\n").replace(/^\s+/, "");
  out = stripFirstLineStructuralPrefix(out);
  // Re-run strip after prefix removal in case first line became a label-only line
  const again = out.split(/\r?\n/);
  let s2 = 0;
  while (s2 < again.length && isStructuralLabelLine(again[s2])) {
    s2++;
  }
  out = again.slice(s2).join("\n").replace(/^\s+/, "");
  return out;
}
