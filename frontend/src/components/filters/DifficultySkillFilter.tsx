/**
 * PR-METADATA-1: Difficulty (1–5) and skill filter controls.
 */
import React from "react";
import { SKILLS, SKILL_LABELS, DIFFICULTY_MIN, DIFFICULTY_MAX, type Skill } from "../../constants/metadata";

export type DifficultySkillFilterValues = {
  difficulty?: number | null;
  difficultyMin?: number | null;
  difficultyMax?: number | null;
  skill?: Skill | string | null;
};

type Props = {
  values: DifficultySkillFilterValues;
  onChange: (values: DifficultySkillFilterValues) => void;
  showRange?: boolean;
  showEstimatedTime?: boolean;
  estimatedTimeMaxSec?: number | null;
  onEstimatedTimeMaxSecChange?: (v: number | null) => void;
};

export function DifficultySkillFilter({
  values,
  onChange,
  showRange = false,
  showEstimatedTime = false,
  estimatedTimeMaxSec,
  onEstimatedTimeMaxSecChange,
}: Props) {
  const styleSelect = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
  } as const;
  const styleLabel = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 } as const;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
      {showRange ? (
        <>
          <div style={{ minWidth: 80 }}>
            <label style={styleLabel}>Difficulty min</label>
            <select
              style={styleSelect}
              value={values.difficultyMin ?? ""}
              onChange={(e) =>
                onChange({
                  ...values,
                  difficultyMin: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 80 }}>
            <label style={styleLabel}>Difficulty max</label>
            <select
              style={styleSelect}
              value={values.difficultyMax ?? ""}
              onChange={(e) =>
                onChange({
                  ...values,
                  difficultyMax: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <div style={{ minWidth: 100 }}>
          <label style={styleLabel}>Difficulty</label>
          <select
            style={styleSelect}
            value={values.difficulty ?? ""}
            onChange={(e) =>
              onChange({
                ...values,
                difficulty: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          >
            <option value="">Any</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}
      <div style={{ minWidth: 140 }}>
        <label style={styleLabel}>Skill</label>
        <select
          style={styleSelect}
          value={values.skill ?? ""}
          onChange={(e) =>
            onChange({
              ...values,
              skill: e.target.value === "" ? null : (e.target.value as Skill),
            })
          }
        >
          <option value="">Any</option>
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {SKILL_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      {showEstimatedTime && onEstimatedTimeMaxSecChange && (
        <div style={{ minWidth: 100 }}>
          <label style={styleLabel}>Max time (sec)</label>
          <input
            type="number"
            min={1}
            placeholder="Optional"
            style={{ ...styleSelect, width: 100 }}
            value={estimatedTimeMaxSec ?? ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              onEstimatedTimeMaxSecChange(v === "" ? null : Math.max(1, parseInt(v, 10) || 0));
            }}
          />
        </div>
      )}
    </div>
  );
}
