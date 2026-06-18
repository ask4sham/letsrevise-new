import React from "react";
import { createRoot } from "react-dom/client";
import { PracticeShortQuestion } from "../src/components/practice/PracticeShortQuestion";
import { BROWSER_QA_CASES } from "./practiceFeedbackBrowserQa.cases";

const caseId = new URLSearchParams(window.location.search).get("case") ?? BROWSER_QA_CASES[0].id;
const qaCase = BROWSER_QA_CASES.find((c) => c.id === caseId) ?? BROWSER_QA_CASES[0];

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root");

createRoot(rootEl).render(
  <div data-qa-case={qaCase.id}>
    <h1 data-testid="qa-title">{qaCase.question.question}</h1>
    <PracticeShortQuestion q={qaCase.question} />
    <textarea
      data-testid="qa-seed-answer"
      defaultValue={qaCase.studentAnswer}
      style={{ display: "none" }}
      readOnly
    />
  </div>
);
