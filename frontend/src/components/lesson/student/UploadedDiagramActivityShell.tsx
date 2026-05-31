import React from "react";
import { StudentBlockHeading } from "./StudentBlockHeading";

type Props = {
  heading: string | null;
  children: React.ReactNode;
};

/**
 * Uploaded diagram activity (imageUrl): SS1 heading + figure + task in one tight column.
 * Flex gap controls title→diagram spacing (immune to margin collapse / legacy slot rules).
 */
const SHELL_LAYOUT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 8,
  width: "100%",
  margin: 0,
  padding: 0,
  minHeight: 0,
};

export function UploadedDiagramActivityShell({ heading, children }: Props): React.ReactElement {
  return (
    <div
      className="lesson-uploaded-diagram-activity-shell"
      data-uploaded-diagram-activity="1"
      data-uploaded-diagram-layout="compact-v2"
      style={SHELL_LAYOUT_STYLE}
    >
      {heading ? <StudentBlockHeading>{heading}</StudentBlockHeading> : null}
      {children}
    </div>
  );
}
