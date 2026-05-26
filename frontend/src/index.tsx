import "./sentry";
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./components/lesson/lessonImagePaddingCompact.css";
import "./styles/print.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import ErrorBoundary from "./components/ErrorBoundary";
import { HashRouter } from "react-router-dom";

/** Revert: REACT_APP_LESSON_IMAGE_COMPACT=0 in .env.local, or git tag pre-image-padding-compact */
if (process.env.REACT_APP_LESSON_IMAGE_COMPACT !== "0") {
  document.documentElement.dataset.lessonImageCompact = "1";
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    {/* ✅ Router is now the top-level wrapper */}
    <HashRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HashRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
