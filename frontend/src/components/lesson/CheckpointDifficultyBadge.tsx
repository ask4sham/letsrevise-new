import React from "react";
import {
  CHECKPOINT_DIFFICULTY_BADGE,
  parseDifficultyFromMarkScheme,
  type CheckpointDifficultyTier,
} from "../../utils/checkpointDifficulty";

export function CheckpointDifficultyBadge({
  tier,
  markScheme,
  style,
}: {
  tier?: CheckpointDifficultyTier;
  markScheme?: string[] | null;
  style?: React.CSSProperties;
}): React.ReactElement | null {
  const resolved =
    tier ?? parseDifficultyFromMarkScheme(markScheme).tier;
  if (!resolved) return null;
  const b = CHECKPOINT_DIFFICULTY_BADGE[resolved];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 999,
        color: b.color,
        background: b.background,
        border: b.border,
        marginBottom: 8,
        ...style,
      }}
    >
      {b.label}
    </span>
  );
}
