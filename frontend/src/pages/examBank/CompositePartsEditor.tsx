import React from "react";
import { isCompositePartTypeEnabled } from "../../components/lesson/examComposite/featureFlags";
import { CompositePartType } from "../../components/lesson/examComposite/types";
import { CompositeTablePartEditor } from "./CompositeTablePartEditor";
import {
  COMPOSITE_PART_LABELS,
  type CompositePartForm,
  compositePartTypeSelectLabel,
  getCompositePartTypeOptions,
  makeDefaultTablePartData,
  makeEmptyCompositePart,
  TABLE_COMPOSITE_PART_TYPE,
} from "./compositeTableEditorUtils";

export type CompositePartsEditorForm = {
  title: string;
  sharedStem: string;
  parts: CompositePartForm[];
};

type Props = {
  form: CompositePartsEditorForm;
  setForm: React.Dispatch<React.SetStateAction<CompositePartsEditorForm>>;
  /** Override for tests; defaults to TABLE_PARTS_ENABLED flag. */
  tablePartsEnabled?: boolean;
};

export function CompositePartsEditor({
  form,
  setForm,
  tablePartsEnabled = isCompositePartTypeEnabled(CompositePartType.TABLE),
}: Props): React.ReactElement {
  const partTypeOptions = getCompositePartTypeOptions(tablePartsEnabled);
  const totalMarks = form.parts.reduce((sum, p) => sum + (Number.isFinite(p.marks) ? p.marks : 0), 0);

  const updatePart = (index: number, patch: Partial<CompositePartForm>) => {
    setForm((f) => ({
      ...f,
      parts: f.parts.map((p, i) => {
        if (i !== index) return p;
        const next = { ...p, ...patch };
        if (patch.type === TABLE_COMPOSITE_PART_TYPE && !next.partData) {
          next.partData = makeDefaultTablePartData();
        }
        if (patch.type && patch.type !== TABLE_COMPOSITE_PART_TYPE) {
          next.partData = undefined;
        }
        return next;
      }),
    }));
  };

  const addPart = () =>
    setForm((f) => ({ ...f, parts: [...f.parts, makeEmptyCompositePart(f.parts.length)] }));

  const removePart = (index: number) =>
    setForm((f) => {
      const next = f.parts.filter((_, i) => i !== index);
      return {
        ...f,
        parts: next.map((p, i) => ({ ...p, label: COMPOSITE_PART_LABELS[i] ?? String(i + 1) })),
      };
    });

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
  };

  return (
    <>
      <div>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
          Title (optional)
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="e.g. Sperm cell — structure and reproduction"
          style={fieldStyle}
        />
      </div>
      <div>
        <label style={{ display: "block", marginBottom: "4px", fontSize: "0.875rem", fontWeight: 600 }}>
          Shared stem
        </label>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>
          Shown once above all parts, alongside the shared image.
        </p>
        <textarea
          value={form.sharedStem}
          onChange={(e) => setForm((f) => ({ ...f, sharedStem: e.target.value }))}
          placeholder="e.g. The diagram shows a human sperm cell."
          rows={3}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600 }}>Parts</label>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
            Total: {totalMarks} {totalMarks === 1 ? "mark" : "marks"}
          </span>
        </div>

        {form.parts.map((part, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: 12,
              marginBottom: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Part ({part.label})</strong>
              <button
                type="button"
                onClick={() => removePart(index)}
                disabled={form.parts.length <= 1}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: form.parts.length <= 1 ? "#9ca3af" : "#b91c1c",
                  background: form.parts.length <= 1 ? "#f3f4f6" : "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "4px 10px",
                  cursor: form.parts.length <= 1 ? "not-allowed" : "pointer",
                }}
              >
                Remove
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Type</label>
                <select
                  data-testid={`part-type-select-${index}`}
                  value={part.type}
                  onChange={(e) =>
                    updatePart(index, { type: e.target.value as CompositePartForm["type"] })
                  }
                  style={fieldStyle}
                >
                  {partTypeOptions.map((t) => (
                    <option key={t} value={t}>
                      {compositePartTypeSelectLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Marks</label>
                <input
                  type="number"
                  min={1}
                  value={part.marks}
                  onChange={(e) => updatePart(index, { marks: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  style={fieldStyle}
                />
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Question text</label>
              <textarea
                value={part.questionText}
                onChange={(e) => updatePart(index, { questionText: e.target.value })}
                placeholder="Enter this part's question…"
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </div>
            {part.type === "mcq" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Options (2–4)</label>
                  {["A", "B", "C", "D"].map((letter, i) => (
                    <input
                      key={letter}
                      type="text"
                      value={part.options[i] ?? ""}
                      onChange={(e) => {
                        const next = [...part.options];
                        while (next.length < 4) next.push("");
                        next[i] = e.target.value;
                        updatePart(index, { options: next });
                      }}
                      placeholder={`Option ${letter}`}
                      style={{ ...fieldStyle, marginBottom: 6 }}
                    />
                  ))}
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>Correct option</label>
                  <select
                    value={part.correctIndex}
                    onChange={(e) => updatePart(index, { correctIndex: parseInt(e.target.value, 10) })}
                    style={fieldStyle}
                  >
                    {["A", "B", "C", "D"].map((letter, i) => (
                      <option key={letter} value={i}>
                        Option {letter}
                        {part.options[i]?.trim() ? ` — ${part.options[i].trim().slice(0, 40)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {part.type === TABLE_COMPOSITE_PART_TYPE && (
              <CompositeTablePartEditor
                partData={part.partData}
                onChange={(next) => updatePart(index, { partData: next })}
                fieldStyle={fieldStyle}
              />
            )}
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                Mark scheme {part.type === "mcq" ? "(optional)" : ""}
              </label>
              <textarea
                value={part.markScheme}
                onChange={(e) => updatePart(index, { markScheme: e.target.value })}
                placeholder="One mark-scheme point per line…"
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addPart}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            color: "#4f46e5",
            background: "white",
            border: "1px dashed #4f46e5",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          + Add part
        </button>
      </div>
    </>
  );
}
