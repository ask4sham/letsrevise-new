import React from "react";
import type { TablePartData } from "../../components/lesson/examComposite/interactions/table/tableTypes";
import { makeDefaultTablePartData, resizeTablePartData } from "./compositeTableEditorUtils";

type Props = {
  partData: TablePartData | undefined;
  onChange: (next: TablePartData) => void;
  fieldStyle: React.CSSProperties;
};

export function CompositeTablePartEditor({ partData, onChange, fieldStyle }: Props): React.ReactElement {
  const data = partData ?? makeDefaultTablePartData();

  const setData = (next: TablePartData) => onChange(next);

  const updateHeader = (index: number, value: string) => {
    const headers = [...data.headers];
    headers[index] = value;
    setData({ ...data, headers });
  };

  const addHeader = () => {
    setData(resizeTablePartData(data, data.headers.length + 1));
  };

  const removeHeader = (index: number) => {
    if (data.headers.length <= 1) return;
    const headers = data.headers.filter((_, i) => i !== index);
    const rows = data.rows.map((row) => ({
      cells: row.cells.filter((_, i) => i !== index),
    }));
    setData({ headers, rows });
  };

  const addRow = () => {
    const cells = data.headers.map(() => ({ value: "", blank: false }));
    setData({ ...data, rows: [...data.rows, { cells }] });
  };

  const removeRow = (rowIndex: number) => {
    if (data.rows.length <= 1) return;
    setData({ ...data, rows: data.rows.filter((_, i) => i !== rowIndex) });
  };

  const updateCell = (
    rowIndex: number,
    colIndex: number,
    patch: Partial<{ value: string; blank: boolean; correctAnswer: string }>
  ) => {
    const rows = data.rows.map((row, ri) => {
      if (ri !== rowIndex) return row;
      const cells = row.cells.map((cell, ci) => (ci === colIndex ? { ...cell, ...patch } : cell));
      return { cells };
    });
    setData({ ...data, rows });
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 4,
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div data-testid="composite-table-part-editor" style={{ marginBottom: 10 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={labelStyle}>Table headers</label>
          <button
            type="button"
            onClick={addHeader}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#4f46e5",
              background: "white",
              border: "1px solid #c7d2fe",
              borderRadius: 6,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            + Column
          </button>
        </div>
        {data.headers.map((header, index) => (
          <div key={index} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <input
              type="text"
              value={header}
              onChange={(e) => updateHeader(index, e.target.value)}
              placeholder={`Header ${index + 1}`}
              aria-label={`Table header ${index + 1}`}
              style={{ ...fieldStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={() => removeHeader(index)}
              disabled={data.headers.length <= 1}
              aria-label={`Remove header ${index + 1}`}
              style={{
                fontSize: 12,
                color: data.headers.length <= 1 ? "#9ca3af" : "#b91c1c",
                background: "white",
                border: "1px solid #fecaca",
                borderRadius: 6,
                padding: "4px 8px",
                cursor: data.headers.length <= 1 ? "not-allowed" : "pointer",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={labelStyle}>Table rows</label>
          <button
            type="button"
            onClick={addRow}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#4f46e5",
              background: "white",
              border: "1px solid #c7d2fe",
              borderRadius: 6,
              padding: "2px 8px",
              cursor: "pointer",
            }}
          >
            + Row
          </button>
        </div>
        {data.rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 8,
              marginBottom: 8,
              background: "white",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <strong style={{ fontSize: 12 }}>Row {rowIndex + 1}</strong>
              <button
                type="button"
                onClick={() => removeRow(rowIndex)}
                disabled={data.rows.length <= 1}
                style={{
                  fontSize: 12,
                  color: data.rows.length <= 1 ? "#9ca3af" : "#b91c1c",
                  background: "white",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "2px 8px",
                  cursor: data.rows.length <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Remove row
              </button>
            </div>
            {data.headers.map((header, colIndex) => {
              const cell = row.cells[colIndex] ?? { value: "", blank: false };
              return (
                <div key={colIndex} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{header || `Column ${colIndex + 1}`}</div>
                  <input
                    type="text"
                    value={cell.value ?? ""}
                    onChange={(e) => updateCell(rowIndex, colIndex, { value: e.target.value })}
                    placeholder="Cell text (shown when not blank)"
                    aria-label={`Row ${rowIndex + 1} column ${colIndex + 1} text`}
                    style={{ ...fieldStyle, marginBottom: 4 }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 4 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(cell.blank)}
                      onChange={(e) =>
                        updateCell(rowIndex, colIndex, {
                          blank: e.target.checked,
                          correctAnswer: e.target.checked ? cell.correctAnswer ?? "" : undefined,
                        })
                      }
                      aria-label={`Row ${rowIndex + 1} column ${colIndex + 1} editable`}
                    />
                    Editable answer cell
                  </label>
                  {cell.blank && (
                    <input
                      type="text"
                      value={cell.correctAnswer ?? ""}
                      onChange={(e) => updateCell(rowIndex, colIndex, { correctAnswer: e.target.value })}
                      placeholder="Correct answer"
                      aria-label={`Row ${rowIndex + 1} column ${colIndex + 1} correct answer`}
                      style={fieldStyle}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
