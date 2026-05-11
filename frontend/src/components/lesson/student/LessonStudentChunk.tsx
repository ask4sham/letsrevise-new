import React from "react";
import { stableStudentBlockReactKey, type IndexedLessonBlock } from "./chunkLessonSegments";
import { classifyChunkTeachingLayout } from "./chunkTeachingLayout";

type Props<T extends { type?: string }> = {
  chunk: IndexedLessonBlock<T>[];
  renderBlockRow: (item: IndexedLessonBlock<T>) => React.ReactNode;
};

/**
 * V12 section chunk: rule-based layout — split | text-only | image-only | stack (fallback).
 */
export function LessonStudentChunk<T extends { type?: string }>({
  chunk,
  renderBlockRow,
}: Props<T>): React.ReactElement {
  const layout = classifyChunkTeachingLayout(chunk);

  switch (layout.mode) {
    case "text-only":
      return (
        <div
          className="lesson-student-section-chunk lesson-student-section-chunk--text-only"
          data-ss2-chunk="1"
          data-ss2-layout="text-only"
        >
          <div className="lesson-student-section-chunk__text-column">
            {layout.blocks.map((item) => (
              <React.Fragment key={stableStudentBlockReactKey(item.block, item.idx)}>
                {renderBlockRow(item)}
              </React.Fragment>
            ))}
          </div>
        </div>
      );

    case "image-only":
      return (
        <section
          className="lesson-student-section-chunk lesson-student-section-chunk--image-only"
          aria-label="Lesson figures"
          data-ss2-chunk="1"
          data-ss2-layout="image-only"
          data-ss2-image-only="1"
        >
          {layout.blocks.map((item) => (
            <React.Fragment key={stableStudentBlockReactKey(item.block, item.idx)}>
              {renderBlockRow(item)}
            </React.Fragment>
          ))}
        </section>
      );

    case "stack":
      return (
        <div
          className="lesson-student-section-chunk lesson-student-section-chunk--stack"
          data-ss2-chunk="1"
          data-ss2-layout="stack"
        >
          {layout.blocks.map((item) => (
            <React.Fragment key={stableStudentBlockReactKey(item.block, item.idx)}>
              {renderBlockRow(item)}
            </React.Fragment>
          ))}
        </div>
      );

    case "split": {
      const { before, diagram, after } = layout;
      return (
        <section
          className="lesson-student-section-chunk lesson-student-section-chunk--with-media"
          aria-label="Lesson section"
          data-ss2-chunk="1"
          data-ss2-layout="split"
        >
          <div className="lesson-student-section-chunk__content">
            {before.map((item) => (
              <React.Fragment key={stableStudentBlockReactKey(item.block, item.idx)}>
                {renderBlockRow(item)}
              </React.Fragment>
            ))}
          </div>
          <aside className="lesson-student-section-chunk__media" aria-label="Diagram">
            {renderBlockRow(diagram)}
          </aside>
          {after.length > 0 ? (
            <div className="lesson-student-section-chunk__tail">
              {after.map((item) => (
                <React.Fragment key={stableStudentBlockReactKey(item.block, item.idx)}>
                  {renderBlockRow(item)}
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </section>
      );
    }

  }
}
