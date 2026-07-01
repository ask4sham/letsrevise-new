import React from "react";
import type { SpecKey } from "../api/taxonomy";
import { getSpecSelectorOptions } from "./specSelectorOptions";

export { ALL_SPEC_KEYS, getSpecSelectorOptions } from "./specSelectorOptions";

export function SpecSelector({
  value,
  onChange,
}: {
  value: SpecKey;
  onChange: (v: SpecKey) => void;
}) {
  const options = getSpecSelectorOptions();
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Subject</label>
      <select
        className="border rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as SpecKey)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
