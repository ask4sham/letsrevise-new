export type Trend = "improving" | "stable" | "declining";

export type ParentSubjectProgress = {
  name: string;                 // e.g. "Maths"
  status: "strength" | "needs_attention" | "neutral";
  trend: Trend;
};

export type ParentChildProgressResponse = {
  childId: string;
  overall: {
    status: "strength" | "needs_attention" | "neutral";
    trend: Trend;
  };
  subjects: ParentSubjectProgress[];
  updatedAt: string;            // ISO string
};
