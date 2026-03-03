/**
 * Quote-aware CSV row parser (handles commas inside quoted fields).
 */
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseCsvLines(text: string): string[][] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map(parseCsvRow);
}

export type FlashcardImportRow = {
  topic?: string;
  front: string;
  back: string;
};

export type FlashcardParseResult =
  | { ok: true; format: string; rows: FlashcardImportRow[] }
  | { ok: false; error: string };

/** Type guard: true when parse succeeded. */
export function isParseSuccess(
  res: FlashcardParseResult
): res is { ok: true; format: string; rows: FlashcardImportRow[] } {
  return res.ok === true;
}

/** Get error message when parse failed; null when ok. */
export function getParseError(res: FlashcardParseResult): string | null {
  return res.ok ? null : (res as { ok: false; error: string }).error;
}

const DELIMS = ["::", "--"] as const;

function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

function looksLikeCsv(text: string) {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return false;
  return lines.slice(0, 5).some((l) => (l.match(/,/g) || []).length >= 1);
}

function hasDelimiter(text: string) {
  return DELIMS.some((d) => text.includes(d));
}

export function autoDetectAndParseFlashcards(raw: string): FlashcardParseResult {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Paste some flashcards first." };

  // 1) CSV path (prefer CSV when it looks like CSV and doesn't clearly look like delimiter format)
  if (looksLikeCsv(text) && !hasDelimiter(text)) {
    const rows = parseCsvLines(text);
    if (!rows.length) return { ok: false, error: "No CSV rows found." };

    // header detection
    const header = rows[0].map(normalizeHeader);
    const hasHeader =
      header.includes("topic") ||
      header.includes("question") ||
      header.includes("answer") ||
      header.includes("front") ||
      header.includes("back");

    const dataRows = hasHeader ? rows.slice(1) : rows;

    let topicIdx = -1;
    let frontIdx = 0;
    let backIdx = 1;

    if (hasHeader) {
      topicIdx = header.indexOf("topic");

      frontIdx = header.indexOf("front");
      if (frontIdx === -1) frontIdx = header.indexOf("question");

      backIdx = header.indexOf("back");
      if (backIdx === -1) backIdx = header.indexOf("answer");

      if (frontIdx === -1 || backIdx === -1) {
        return {
          ok: false,
          error: "CSV header must include Front/Back or Question/Answer (and optional Topic).",
        };
      }
    } else {
      // heuristics: 3+ columns => topic,front,back; 2 columns => front,back
      const cols = rows[0].length;
      if (cols >= 3) {
        topicIdx = 0;
        frontIdx = 1;
        backIdx = 2;
      } else if (cols === 2) {
        frontIdx = 0;
        backIdx = 1;
      } else {
        return { ok: false, error: "CSV needs at least 2 columns (Front,Back)." };
      }
    }

    const out: FlashcardImportRow[] = [];
    for (const r of dataRows) {
      const front = (r[frontIdx] ?? "").trim();
      const back = (r[backIdx] ?? "").trim();
      const topic = topicIdx >= 0 ? (r[topicIdx] ?? "").trim() : undefined;

      if (!front || !back) continue;
      out.push(topic ? { topic, front, back } : { front, back });
    }

    if (!out.length) {
      return { ok: false, error: "No valid cards found. Ensure Front and Back are filled." };
    }

    return { ok: true, format: hasHeader ? "CSV (header)" : "CSV", rows: out };
  }

  // 2) Delimiter path
  for (const delim of DELIMS) {
    if (text.includes(delim)) {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const out: FlashcardImportRow[] = [];

      for (const line of lines) {
        if (!line.includes(delim)) continue;
        const [frontRaw, ...rest] = line.split(delim);
        const front = frontRaw.trim();
        const back = rest.join(delim).trim(); // preserve delim occurrences
        if (!front || !back) continue;
        out.push({ front, back });
      }

      if (!out.length) return { ok: false, error: `No cards detected using "${delim}".` };
      return { ok: true, format: `Delimiter (${delim})`, rows: out };
    }
  }

  return {
    ok: false,
    error:
      "Could not detect a valid format. Use one card per line: Front :: Back OR Topic,Question,Answer (CSV).",
  };
}
