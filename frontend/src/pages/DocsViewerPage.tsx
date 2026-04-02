import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { preprocessMarkdownAssetUrls } from "../utils/assetUrl";

/** Allowed filename: only .md, no path traversal. Returns null if invalid. Do NOT mutate result for fetch. */
function safeDocFilename(param: string | null): string | null {
  if (!param || typeof param !== "string") return null;
  const trimmed = param.trim();
  if (!trimmed.endsWith(".md")) return null;
  const base = trimmed.slice(0, -3);
  if (!/^[a-zA-Z0-9_.-]+$/.test(base)) return null;
  return trimmed;
}

/** Parse a markdown table block into rows of cells. Returns null if not a valid table. */
function parseMarkdownTable(lines: string[]): string[][] | null {
  if (lines.length < 2) return null;
  const rows: string[][] = [];
  for (const line of lines) {
    if (!/^\|.+\|$/.test(line.trim())) return null;
    const cells = line
      .split("|")
      .map((s) => s.trim())
      .slice(1, -1);
    if (cells.length === 0) return null;
    rows.push(cells);
  }
  const isSeparator = (row: string[]) => row.every((c) => /^:?-+:?$/.test(c) || /^-+$/.test(c));
  if (rows.length >= 2 && isSeparator(rows[1])) {
    return [rows[0], ...rows.slice(2)];
  }
  return rows;
}

/** Split markdown content into segments: markdown text and table blocks (rendered as HTML table). */
function segmentContent(markdown: string): Array<{ type: "md"; value: string } | { type: "table"; rows: string[][] }> {
  const segments: Array<{ type: "md"; value: string } | { type: "table"; rows: string[][] }> = [];
  const lines = markdown.split(/\r?\n/);
  let i = 0;
  let mdBuffer: string[] = [];

  const flushMd = () => {
    if (mdBuffer.length) {
      segments.push({ type: "md", value: mdBuffer.join("\n") });
      mdBuffer = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (/^\|.+\|$/.test(line.trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && /^\|.+\|$/.test(lines[i].trim())) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = parseMarkdownTable(tableLines);
      if (rows && rows.length >= 1) {
        flushMd();
        segments.push({ type: "table", rows });
      } else {
        mdBuffer.push(...tableLines);
      }
      continue;
    }
    mdBuffer.push(line);
    i++;
  }
  flushMd();
  return segments;
}

const tableStyles = {
  wrapper: { overflowX: "auto" as const, margin: "16px 0" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 14, color: "#374151" },
  thead: { background: "#f3f4f6", borderBottom: "2px solid #e5e7eb" },
  th: { padding: "10px 12px", textAlign: "left" as const, fontWeight: 600, color: "#111827" },
  td: { padding: "10px 12px", verticalAlign: "top" as const },
  tr: { borderBottom: "1px solid #e5e7eb" },
};

const DocsViewerPage: React.FC = () => {
  const hashQuery = typeof window !== "undefined" ? window.location.hash.split("?")[1] || "" : "";
  const params = new URLSearchParams(hashQuery);
  const rawFilename = params.get("file") || "";
  const filename = safeDocFilename(rawFilename);

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!filename);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) {
      setLoading(false);
      setError("No document specified. Use ?file=Example.md");
      return;
    }
    setError(null);
    setLoading(true);
    // Fetch must use raw filename only (no underscore→space); UI may use displayName with spaces elsewhere.
    const url = `/docs/${encodeURIComponent(filename)}`;
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Document not found: ${filename}`);
        return res.text();
      })
      .then(setContent)
      .catch((err) => setError(err.message || "Failed to load document"))
      .finally(() => setLoading(false));
  }, [filename]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/teacher-dashboard" style={{ color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
          ← Back to Teacher Dashboard
        </Link>
      </div>

      {!filename && (
        <div style={{ padding: 20, background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {filename && loading && (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      )}

      {filename && error && !loading && (
        <div style={{ padding: 20, background: "#fef2f2", borderRadius: 8, border: "1px solid #fecaca", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {filename && content && !loading && (
        <article
          style={{
            background: "white",
            borderRadius: 12,
            padding: "24px 28px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            border: "1px solid #e5e7eb",
          }}
        >
          {segmentContent(preprocessMarkdownAssetUrls(content)).map((seg, idx) =>
            seg.type === "table" ? (
              <div key={idx} style={tableStyles.wrapper}>
                <table style={tableStyles.table}>
                  <thead style={tableStyles.thead}>
                    <tr style={tableStyles.tr}>
                      {seg.rows[0].map((cell, cidx) => (
                        <th key={cidx} style={tableStyles.th}>
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {seg.rows.slice(1).map((row, ridx) => (
                      <tr key={ridx} style={tableStyles.tr}>
                        {row.map((cell, cidx) => (
                          <td key={cidx} style={tableStyles.td}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <ReactMarkdown
                key={idx}
                components={{
                  h1: ({ children }) => (
                    <h1 style={{ margin: "0 0 16px", fontSize: "1.5rem", color: "#111827", borderBottom: "2px solid #e5e7eb", paddingBottom: 8 }}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 style={{ margin: "24px 0 12px", fontSize: "1.25rem", color: "#374151" }}>{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 style={{ margin: "20px 0 8px", fontSize: "1.1rem", color: "#4b5563" }}>{children}</h3>
                  ),
                  p: ({ children }) => <p style={{ margin: "0 0 12px", lineHeight: 1.6, color: "#374151" }}>{children}</p>,
                  ul: ({ children }) => (
                    <ul style={{ margin: "0 0 12px", paddingLeft: 24, lineHeight: 1.6 }}>{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol style={{ margin: "0 0 12px", paddingLeft: 24, lineHeight: 1.6 }}>{children}</ol>
                  ),
                  li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "none" }}>
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, fontSize: "0.9em" }}>
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre style={{ background: "#f8fafc", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 13 }}>
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote style={{ margin: "12px 0", paddingLeft: 16, borderLeft: "4px solid #e5e7eb", color: "#6b7280" }}>
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {seg.value}
              </ReactMarkdown>
            )
          )}
        </article>
      )}
    </div>
  );
};

export default DocsViewerPage;
