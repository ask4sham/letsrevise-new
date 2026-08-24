import React from "react";
import type { SpecKey } from "../api/taxonomy";
import { getSpecSelectorOptions } from "./specSelectorOptions";

export { ALL_SPEC_KEYS, getSpecSelectorOptions } from "./specSelectorOptions";

export function SpecSelector({
  value,
  onChange,
  label = "Subject",
  id = "spec-selector",
  className,
}: {
  value: SpecKey;
  onChange: (v: SpecKey) => void;
  /** Visible label. Defaults to "Subject" for existing consumers. */
  label?: string;
  id?: string;
  className?: string;
}) {
  const options = getSpecSelectorOptions();
  return (
    <div className={className ?? "flex items-center gap-2"}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
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
