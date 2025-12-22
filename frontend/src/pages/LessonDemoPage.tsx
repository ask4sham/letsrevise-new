// /src/pages/LessonDemoPage.tsx

import React from "react";
import LessonRenderer from "../components/lesson/LessonRenderer";
import { gcseBiologyCellStructureLesson } from "../data/demoLessons/gcse-biology-cell-structure";

const LessonDemoPage: React.FC = () => {
  return <LessonRenderer lesson={gcseBiologyCellStructureLesson} />;
};

export default LessonDemoPage;
