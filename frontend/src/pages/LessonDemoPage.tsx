// /src/pages/LessonDemoPage.tsx

import React, { useMemo } from "react";
import { LessonRenderer } from "../components/lesson/LessonRenderer";
import { gcseBiologyCellStructureLesson } from "../data/demoLessons/gcse-biology-cell-structure";

/** Demo: flatten structured demo lesson into text for LessonRenderer (text-schema preview). */
function demoLessonToText(): string {
  const parts: string[] = [];
  for (const b of gcseBiologyCellStructureLesson.blocks) {
    if (b.type === "heading" && "text" in b) {
      parts.push(`**${String((b as { text: string }).text)}**`);
    } else if (b.type === "text" && "content" in b) {
      parts.push(String((b as { content: string }).content));
    }
  }
  return parts.join("\n\n");
}

const LessonDemoPage: React.FC = () => {
  const text = useMemo(demoLessonToText, []);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <LessonRenderer text={text} />
    </div>
  );
};

export default LessonDemoPage;
