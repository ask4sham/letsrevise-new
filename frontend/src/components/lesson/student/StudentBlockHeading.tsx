import React from "react";

type Props = {
  children: string;
  /** Border-frame token for V12 CSS (`data-frame-kind`). */
  frameKind?: string;
};

/** SS1 numbered section label above student prose blocks (`1 — Hook`, …). */
export function StudentBlockHeading({ children, frameKind }: Props): React.ReactElement | null {
  const text = String(children ?? "").trim();
  if (!text) return null;
  const kind = String(frameKind || "default").trim() || "default";
  return (
    <h2
      className="lesson-student-block-heading"
      data-ss1-block-heading="1"
      data-frame-kind={kind}
    >
      {text}
    </h2>
  );
}
