import { Component } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertTriangle, RotateCcw, BookOpen } from "lucide-react";
import { ERROR as TID } from "@/constants/testIds";

/**
 * P0.4 — Root React Error Boundary.
 *
 * Catches uncaught render-tree errors anywhere below it and renders a polished
 * fallback screen instead of React's default blank white screen.
 *
 * Notes:
 * - MUST be a class component (only classes can use getDerivedStateFromError /
 *   componentDidCatch).
 * - Resets via a child `key` bump driven by `resetKey` state; this re-mounts
 *   the subtree so transient errors clear cleanly.
 * - Production: shows safe text only. Dev: also logs componentStack to console.
 * - No new dependencies, no remote logging, no telemetry.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", resetKey: 0 };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message:
        (error && (error.message || String(error))) ||
        "Unknown render error",
    };
  }

  componentDidCatch(error, info) {
    // Dev-only stack output; production keeps only the message.
    const isDev =
      typeof process !== "undefined" &&
      process.env &&
      process.env.NODE_ENV !== "production";
    /* eslint-disable no-console */
    console.error("[Teacher Brain] Uncaught render error:", error?.message || error);
    if (isDev && info?.componentStack) {
      console.error("[Teacher Brain] componentStack:", info.componentStack);
    }
    /* eslint-enable no-console */
  }

  reset = () => {
    this.setState((s) => ({
      hasError: false,
      message: "",
      resetKey: s.resetKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return <Fallback message={this.state.message} onRetry={this.reset} />;
    }
    return (
      <ErrorBoundaryChild resetKey={this.state.resetKey}>
        {this.props.children}
      </ErrorBoundaryChild>
    );
  }
}

// Re-mount subtree on retry so transient state clears.
function ErrorBoundaryChild({ resetKey, children }) {
  return <div key={resetKey}>{children}</div>;
}

function Fallback({ message, onRetry }) {
  const navigate = useNavigate();
  return (
    <div
      data-testid={TID.fallback}
      className="min-h-screen grid place-items-center px-6 py-12"
    >
      <div className="tb-card max-w-xl w-full p-8 sm:p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-[var(--tb-violation-soft)] grid place-items-center">
          <AlertTriangle size={26} className="text-[var(--tb-violation)]" />
        </div>
        <h1
          className="tb-display text-[34px] sm:text-[40px] leading-tight font-semibold mt-5 tracking-tight"
          data-testid={TID.title}
        >
          Something went wrong
        </h1>
        <p className="text-[var(--tb-ink-2)] mt-3 leading-relaxed">
          We couldn&apos;t load this part of Teacher Brain. You can try again
          or return to the Library.
        </p>

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            data-testid={TID.retryBtn}
            onClick={onRetry}
            className="tb-btn justify-center"
          >
            <RotateCcw size={16} />
            Try again
          </button>
          <button
            data-testid={TID.libraryBtn}
            onClick={() => {
              try {
                navigate("/library");
              } catch {
                window.location.href = "/library";
              }
              // Also reset so coming back doesn't immediately re-render the fallback
              onRetry();
            }}
            className="tb-btn ghost justify-center"
          >
            <BookOpen size={16} />
            Return to Library
          </button>
        </div>

        {/* Safe footer link, no stack trace */}
        <div className="mt-6 text-xs tb-mono uppercase tracking-widest text-[var(--tb-muted)]">
          <Link to="/" className="tb-link">Back to home</Link>
          {" · "}
          <span data-testid={TID.safeMessage}>error: {sanitize(message)}</span>
        </div>
      </div>
    </div>
  );
}

// Strip anything that looks like a file path / secret / stack frame.
function sanitize(s) {
  const raw = String(s || "").slice(0, 140);
  return raw
    .replace(/sk-[A-Za-z0-9-]+/g, "[redacted]")
    .replace(/\/[^\s]*\.(js|jsx|ts|tsx|py)/g, "[redacted]")
    .replace(/at\s+\w+\s*\(.+?\)/g, "")
    .trim() || "unknown render error";
}
