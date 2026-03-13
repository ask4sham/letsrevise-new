/**
 * Parse CSV text into array of objects (first row = headers).
 * Handles quoted fields so commas inside quotes don't split.
 */
export function parseCsvToRows(csvText: string): Record<string, string>[] {
  const trimmed = csvText.trim();
  if (!trimmed) return [];

  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      current += c;
    } else if (c === "\n" || c === "\r") {
      if (!inQuotes) {
        if (current) lines.push(current);
        current = "";
        if (c === "\r" && trimmed[i + 1] === "\n") i++;
      } else {
        current += c;
      }
    } else {
      current += c;
    }
  }
  if (current) lines.push(current);

  const rows = lines.map((line) => parseCsvLine(line));
  if (rows.length < 2) return [];

  const headers = rows[0].map((h, j) => (h && h.trim()) || `col_${j}`);
  const result: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((h, j) => {
      obj[h] = (values[j] ?? "").trim();
    });
    result.push(obj);
  }

  return result;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      current += c;
    } else if ((c === "," && !inQuotes) || (c === "\t" && !inQuotes)) {
      out.push(unquote(current));
      current = "";
    } else {
      current += c;
    }
  }
  out.push(unquote(current));
  return out;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
    return t.slice(1, -1).replace(/""/g, '"');
  }
  return t;
}
