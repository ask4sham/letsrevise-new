import React from "react";
import {
  columnHeaderLabel,
  parseStimulusTable,
  type StimulusTable,
} from "./stimulusTable";

export type CompositeStimulusTableProps = {
  table: StimulusTable | unknown;
  testId?: string;
};

/** Read-only exam data table — never uses fill-in TABLE interaction. */
export function CompositeStimulusTable({
  table,
  testId = "exam-composite-stimulus-table",
}: CompositeStimulusTableProps): React.ReactElement | null {
  const data = parseStimulusTable(table);
  if (!data) return null;

  return (
    <div className="exam-composite__stimulus-table-wrap" data-testid={testId}>
      {data.title ? (
        <p className="exam-composite__stimulus-table-title" style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>
          {data.title}
        </p>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <table
          className="exam-composite__stimulus-table"
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14,
            marginBottom: 12,
          }}
        >
          <thead>
            <tr>
              {data.columns.map((col, i) => (
                <th
                  key={i}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    padding: "6px 8px",
                    textAlign: "left",
                  }}
                >
                  {columnHeaderLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={r}>
                {data.columns.map((_, c) => (
                  <td
                    key={c}
                    style={{
                      border: "1px solid #e2e8f0",
                      padding: "6px 8px",
                    }}
                  >
                    {row[c] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
