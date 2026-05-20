import React from "react";

type Props = {
  children: string;
};

/** SS1 numbered section label above student prose blocks (`1 — Hook`, …). */
export function StudentBlockHeading({ children }: Props): React.ReactElement | null {
  const text = String(children ?? "").trim();
  if (!text) return null;
  return (
    <h2 className="lesson-student-block-heading" data-ss1-block-heading="1">
      {text}
    </h2>
  );
}
