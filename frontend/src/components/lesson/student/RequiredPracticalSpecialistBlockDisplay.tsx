import React, { useMemo, useState } from "react";
import {
  defaultSectionTitle,
  parseEquipmentItems,
  parseMarkdownTable,
  parseMethodSteps,
  type ParsedMarkdownTable,
  type RpSpecialistBlockKind,
} from "../../../utils/requiredPracticalBlockParse";
import "./requiredPracticalSpecialistBlocks.css";

type Props = {
  kind: RpSpecialistBlockKind;
  title?: string;
  content: string;
  blockIndex: number;
};

const BLOCK_META: Record<
  RpSpecialistBlockKind,
  { icon: string; classSuffix: string }
> = {
  equipment: { icon: "🧰", classSuffix: "equipment" },
  method: { icon: "📋", classSuffix: "method" },
  resultsTable: { icon: "📊", classSuffix: "results" },
  evaluationGrid: { icon: "✅", classSuffix: "evaluation" },
};

function SpecialistShell({
  kind,
  title,
  children,
  blockIndex,
}: {
  kind: RpSpecialistBlockKind;
  title?: string;
  children: React.ReactNode;
  blockIndex: number;
}) {
  const meta = BLOCK_META[kind];
  const heading = String(title || "").trim() || defaultSectionTitle(kind);
  return (
    <section
      className={`rp-specialist-block rp-specialist-block--${meta.classSuffix}`}
      data-rp-specialist={kind}
      aria-labelledby={`rp-specialist-${kind}-${blockIndex}`}
    >
      <h2 className="rp-specialist-block__title" id={`rp-specialist-${kind}-${blockIndex}`}>
        <span className="rp-specialist-block__icon" aria-hidden>
          {meta.icon}
        </span>
        {heading}
      </h2>
      {children}
    </section>
  );
}

function EditableTable({
  table,
  editable = false,
  ariaLabel,
}: {
  table: ParsedMarkdownTable;
  editable?: boolean;
  ariaLabel: string;
}) {
  const [rows, setRows] = useState<string[][]>(() =>
    table.rows.map((r) => [...r])
  );

  const colCount = table.headers.length;

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => [...r]);
      while (next[rowIdx].length < colCount) next[rowIdx].push("");
      next[rowIdx][colIdx] = value;
      return next;
    });
  };

  return (
    <div className="rp-specialist-table-wrap">
      <table className="rp-specialist-table" aria-label={ariaLabel}>
        <thead>
          <tr>
            {table.headers.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {table.headers.map((_, ci) => {
                const val = row[ci] ?? "";
                const isLabelCol = ci === 0 && /^(mean|trial|\d+)$/i.test(val.trim());
                return (
                  <td key={ci}>
                    {editable && !isLabelCol && ci > 0 ? (
                      <input
                        type="text"
                        className="rp-specialist-table__input"
                        value={val}
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                        aria-label={`${table.headers[ci]} row ${ri + 1}`}
                      />
                    ) : (
                      val
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {editable ? (
        <p className="rp-specialist-table__hint">You can type your readings directly into the empty cells.</p>
      ) : null}
    </div>
  );
}

export function RequiredPracticalSpecialistBlockDisplay({
  kind,
  title,
  content,
  blockIndex,
}: Props) {
  const equipmentItems = useMemo(
    () => (kind === "equipment" ? parseEquipmentItems(content) : []),
    [kind, content]
  );
  const methodSteps = useMemo(
    () => (kind === "method" ? parseMethodSteps(content) : []),
    [kind, content]
  );
  const table = useMemo(
    () =>
      kind === "resultsTable" || kind === "evaluationGrid"
        ? parseMarkdownTable(content)
        : null,
    [kind, content]
  );

  if (kind === "equipment") {
    return (
      <SpecialistShell kind={kind} title={title} blockIndex={blockIndex}>
        {equipmentItems.length > 0 ? (
          <ul className="rp-equipment-list">
            {equipmentItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="rp-specialist-block__empty">Equipment list will appear here.</p>
        )}
      </SpecialistShell>
    );
  }

  if (kind === "method") {
    return (
      <SpecialistShell kind={kind} title={title} blockIndex={blockIndex}>
        {methodSteps.length > 0 ? (
          <ol className="rp-method-list">
            {methodSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        ) : (
          <p className="rp-specialist-block__empty">Method steps will appear here.</p>
        )}
      </SpecialistShell>
    );
  }

  if (kind === "resultsTable") {
    return (
      <SpecialistShell kind={kind} title={title} blockIndex={blockIndex}>
        {table ? (
          <EditableTable table={table} editable ariaLabel="Results table" />
        ) : (
          <p className="rp-specialist-block__empty">Results table will appear here.</p>
        )}
      </SpecialistShell>
    );
  }

  return (
    <SpecialistShell kind={kind} title={title} blockIndex={blockIndex}>
      {table ? (
        <EditableTable table={table} editable={false} ariaLabel="Evaluation grid" />
      ) : (
        <p className="rp-specialist-block__empty">Evaluation grid will appear here.</p>
      )}
    </SpecialistShell>
  );
}
