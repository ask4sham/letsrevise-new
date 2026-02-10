/**
 * Canonical lesson access metadata.
 * This is the ONLY place that should decide preview vs paid.
 */
export type LessonAccessMeta = {
  lessonId: string;
  isPublished: boolean;
  isFreePreview: boolean;
};

/**
 * TEMP stub.
 * Replace with DB or index-backed lookup later.
 */
export async function getLessonAccessMeta(lessonId: string): Promise<LessonAccessMeta> {
  return {
    lessonId,
    isPublished: true,
    isFreePreview: false,
  };
}
