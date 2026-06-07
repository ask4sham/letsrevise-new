/** Strip tags so headings like `<h3>Weak answer:</h3>` satisfy marker checks. */
function textForModellingMarkers(text = "") {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

export const REQUIRED_SECTION_RULES = [
  { key: "objectives", label: "Revision Objectives" },
  { key: "prior-knowledge", label: "Prior Knowledge" },

  { key: "hook", label: "Hook" },
  { key: "core-rule", label: "Core Rule" },
  { key: "text-concept", label: "Core Teaching" },

  { key: "diagram", label: "Diagram" },
  { key: "interactive-diagram", label: "Interactive Diagram" },
  { key: "step-by-step-diagram", label: "Step-by-Step Diagram" },

  { key: "drag-drop-match", label: "Drag and Drop Match" },

  { key: "common-mistake", label: "Common Mistake" },
  { key: "exam-tip", label: "Exam Tip" },
  { key: "worked-example", label: "Worked Example" },

  { key: "synthesis", label: "Synthesis" },
  { key: "self-check-question", label: "Self-Check Question" },
  { key: "final-memory-rule", label: "Final Memory Rule" },

  { key: "exam-practice", label: "Exam Practice" },
  { key: "summary", label: "Summary" },
  { key: "keywords", label: "Keywords" },
];

export const REQUIRED_TEXT_MARKERS = [
  {
    key: "why-this-matters",
    label: "🌍 Why this matters",
    test: (text = "") => /🌍\s*Why this matters/i.test(String(text)),
  },
  {
    key: "quick-thinking-check",
    label: "💡 Quick Thinking Check",
    test: (text = "") =>
      /💡\s*Quick Thinking Check/i.test(String(text)) ||
      /Quick check/i.test(String(text)),
  },
  {
    key: "premium-exam-tip",
    label: "🎯 Premium Exam Tip",
    test: (text = "") =>
      /🎯\s*Premium Exam Tip/i.test(String(text)) ||
      /Exam tip/i.test(String(text)),
  },
  {
    key: "key-insight",
    label: "💡 Key Insight",
    test: (text = "") => /💡\s*Key Insight/i.test(String(text)),
  },
  {
    key: "cause-effect",
    label: "Cause → effect explanation",
    test: (text = "") =>
      /cause\s*→\s*effect/i.test(String(text)) ||
      /structure\s*→\s*function/i.test(String(text)) ||
      /process\s*→\s*effect/i.test(String(text)) ||
      /factor\s*→\s*change/i.test(String(text)),
  },
  {
    key: "weak-better-full-mark",
    label: "Weak / Better / Full-mark answer modelling",
    test: (text = "") => {
      const flat = textForModellingMarkers(text);
      return (
        /\bWeak answer\s*:/i.test(flat) &&
        /\bBetter answer\s*:/i.test(flat) &&
        /\bFull-mark answer\s*:/i.test(flat)
      );
    },
  },
];
