/**
 * Shared SS1 block extraction helpers for scope authority modules.
 */

function extractBlockTextByHeading(lessonText = "", headingRe) {
  const lines = String(lessonText || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(\d+)\s*[—\-–]\s+/i.test(line) && headingRe.test(line)) {
      start = i;
      break;
    }
    if (
      /^(\d+)\s*[—\-–]\s+/i.test(line) &&
      headingRe.test(lines.slice(i, i + 4).join("\n"))
    ) {
      start = i;
      break;
    }
  }
  if (start < 0) return { header: "", body: "", full: "" };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) || /^PAGE\s+\d/i.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  const blockLines = lines.slice(start, end);
  const full = blockLines.join("\n");
  const pasteIdx = blockLines.findIndex((l) => /^Paste into:/i.test(l.trim()));
  const header = pasteIdx >= 0 ? blockLines.slice(0, pasteIdx + 1).join("\n") : blockLines.slice(0, 2).join("\n");
  const body = pasteIdx >= 0 ? blockLines.slice(pasteIdx + 1).join("\n") : blockLines.slice(2).join("\n");
  return { header, body, full, startLine: start, endLine: end };
}

function replaceBlockInLesson(lessonText = "", headingRe, newBlockText = "") {
  const lines = String(lessonText || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) && headingRe.test(lines[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return lessonText;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(\d+)\s*[—\-–]\s+/i.test(lines[i]) || /^PAGE\s+\d/i.test(lines[i].trim())) {
      end = i;
      break;
    }
  }
  return [...lines.slice(0, start), String(newBlockText || "").trim(), ...lines.slice(end)]
    .join("\n")
    .trimEnd();
}

function replaceBlockAtSpan(lessonText, span, newBlockText) {
  const lines = String(lessonText || "").split("\n");
  return [...lines.slice(0, span.start), String(newBlockText || "").trim(), ...lines.slice(span.end)]
    .join("\n")
    .trimEnd();
}

function listAssessmentBlockSpans(lessonText = "") {
  const lines = String(lessonText || "").split("\n");
  const spans = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^(\d+)\s*[—\-–]\s+/i.test(lines[i])) continue;
    const head = lines[i];
    let kind = null;
    if (/\bCHECKPOINT\b/i.test(head) && !/QUICK/i.test(head)) kind = "checkpoint";
    else if (/\bQUICK\s+CHECK\b/i.test(head)) kind = "quickCheck";
    else if (/\bDRAG\s+AND\s+DROP\b/i.test(head)) kind = "dragDrop";
    else if (/\bEXAM\s+PRACTICE\b/i.test(head)) kind = "examPractice";
    if (!kind) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^(\d+)\s*[—\-–]\s+/i.test(lines[j]) || /^PAGE\s+\d/i.test(lines[j].trim())) {
        end = j;
        break;
      }
    }
    spans.push({
      kind,
      start: i,
      end,
      headerLine: head,
      text: lines.slice(i, end).join("\n"),
    });
    i = end - 1;
  }
  return spans;
}

module.exports = {
  extractBlockTextByHeading,
  replaceBlockInLesson,
  replaceBlockAtSpan,
  listAssessmentBlockSpans,
};
