import React from "react";
import {
  parseTablePartData,
  serializeTableStudentAnswers,
  parseTableStudentAnswers,
  tableCellKey,
  type TableStudentAnswers,
} from "./tableTypes";
import { gradeTablePart } from "./markTable";

export type TableRendererProps = {
  partData: unknown;
  partIndex: number;
  answerValue?: string;
  onAnswerChange?: (value: string) => void;
  interactive: boolean;
  disabled?: boolean;
  marked?: boolean;
};

export function TableRenderer({
  partData,
  partIndex,
  answerValue,
  onAnswerChange,
  interactive,
  disabled,
  marked,
}: TableRendererProps): React.ReactElement {
  const data = parseTablePartData(partData);
  if (!data) {
    return (
      <div className="exam-composite__table-fallback" data-testid={`exam-composite-table-fallback-${partIndex}`}>
        Table data is missing or invalid.
      </div>
    );
  }

  const answers: TableStudentAnswers = parseTableStudentAnswers(answerValue);
  const grade = marked ? gradeTablePart({ partData: data, studentAnswerJson: answerValue, marks: 1 }) : null;

  const setCell = (row: number, col: number, value: string) => {
    if (!onAnswerChange || disabled) return;
    const next = { ...answers, [tableCellKey(row, col)]: value };
    onAnswerChange(serializeTableStudentAnswers(next));
  };

  return (
    <div className="exam-composite__table-wrap" data-testid={`exam-composite-table-${partIndex}`}>
      <table className="exam-composite__table">
        <thead>
          <tr>
            {data.headers.map((header, colIndex) => (
              <th key={colIndex}>{header || `Column ${colIndex + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.cells.map((cell, colIndex) => {
                const key = tableCellKey(rowIndex, colIndex);
                if (!cell.blank) {
                  return (
                    <td key={colIndex} className="exam-composite__table-cell exam-composite__table-cell--label">
                      {cell.value || ""}
                    </td>
                  );
                }

                if (!interactive) {
                  return (
                    <td key={colIndex} className="exam-composite__table-cell exam-composite__table-cell--blank">
                      <span className="exam-composite__table-blank-line" aria-hidden />
                    </td>
                  );
                }

                const value = answers[key] ?? "";
                let markClass = "";
                if (marked && grade) {
                  if (grade.correctKeys.includes(key)) markClass = " exam-composite__table-input--correct";
                  else if (grade.incorrectKeys.includes(key) || grade.missingKeys.includes(key)) {
                    markClass = " exam-composite__table-input--incorrect";
                  }
                }

                return (
                  <td key={colIndex} className="exam-composite__table-cell exam-composite__table-cell--blank">
                    <input
                      type="text"
                      className={`exam-composite__table-input${markClass}`}
                      data-testid={`exam-composite-table-input-${partIndex}-${rowIndex}-${colIndex}`}
                      value={value}
                      disabled={Boolean(disabled)}
                      onChange={(e) => setCell(rowIndex, colIndex, e.target.value)}
                      aria-label={`Answer for row ${rowIndex + 1}, column ${colIndex + 1}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
