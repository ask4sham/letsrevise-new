/**
 * PR-PAST-PAPERS-UI-2: Filters for Past Papers (debounced search + year/series/tier + clear).
 */
import React, { useState, useEffect, useCallback } from "react";

export type PastPapersFiltersValues = {
  q: string;
  year: string;
  series: string;
  tier: string;
};

type Props = {
  values: PastPapersFiltersValues;
  onChange: (values: PastPapersFiltersValues) => void;
  onClear: () => void;
  searchDebounceMs?: number;
};

const defaultValues: PastPapersFiltersValues = {
  q: "",
  year: "",
  series: "",
  tier: "",
};

export function PastPapersFilters({
  values,
  onChange,
  onClear,
  searchDebounceMs = 400,
}: Props) {
  const [qLocal, setQLocal] = useState(values.q);

  useEffect(() => {
    setQLocal(values.q);
  }, [values.q]);

  useEffect(() => {
    if (qLocal === values.q) return;
    const t = setTimeout(() => {
      onChange({ ...values, q: qLocal });
    }, searchDebounceMs);
    return () => clearTimeout(t);
  }, [qLocal, searchDebounceMs]);

  const hasAny = values.q || values.year || values.series || values.tier;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Filter:</span>
      <input
        type="text"
        placeholder="Search title / paper / series"
        value={qLocal}
        onChange={(e) => setQLocal(e.target.value)}
        style={{ width: 200, padding: "6px 8px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <input
        type="text"
        placeholder="Year"
        value={values.year}
        onChange={(e) => onChange({ ...values, year: e.target.value })}
        style={{ width: 72, padding: "6px 8px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <input
        type="text"
        placeholder="Series"
        value={values.series}
        onChange={(e) => onChange({ ...values, series: e.target.value })}
        style={{ width: 88, padding: "6px 8px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      <input
        type="text"
        placeholder="Tier"
        value={values.tier}
        onChange={(e) => onChange({ ...values, tier: e.target.value })}
        style={{ width: 88, padding: "6px 8px", fontSize: 13, borderRadius: 6, border: "1px solid #d1d5db" }}
      />
      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setQLocal("");
            onClear();
          }}
          style={{ padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
