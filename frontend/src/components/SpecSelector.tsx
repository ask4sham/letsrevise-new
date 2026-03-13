import React from "react";
import type { SpecKey } from "../api/taxonomy";

export function SpecSelector({
  value,
  onChange,
}: {
  value: SpecKey;
  onChange: (v: SpecKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">Subject</label>
      <select
        className="border rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as SpecKey)}
      >
        <option value="aqa-gcse-biology">AQA GCSE Biology</option>
        <option value="aqa-gcse-chemistry">AQA GCSE Chemistry</option>
        <option value="aqa-gcse-physics">AQA GCSE Physics</option>
        <option value="aqa-gcse-maths-foundation">AQA GCSE Maths (Foundation)</option>
        <option value="aqa-gcse-maths-higher">AQA GCSE Maths (Higher)</option>
        <option value="aqa-l2-further-maths">AQA Further Maths (Level 2)</option>
        <option value="aqa-gcse-english-literature">AQA GCSE English Literature</option>
        <option value="aqa-gcse-english-language">AQA GCSE English Language</option>
      </select>
    </div>
  );
}
