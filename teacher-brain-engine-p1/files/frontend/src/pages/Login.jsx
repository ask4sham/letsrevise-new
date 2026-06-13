import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AUTH } from "@/constants/testIds";

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function Login() {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim());
      }
      navigate(next, { replace: true });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(formatApiErrorDetail(detail) || err?.message || "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — pitch */}
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-[var(--tb-ink)] text-[var(--tb-cream)]">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--tb-cream)] text-[var(--tb-ink)] grid place-items-center tb-display font-bold text-[15px]">
            tb
          </div>
          <span className="tb-display font-semibold text-[18px] tracking-tight">
            Teacher Brain
          </span>
        </Link>
        <div>
          <h1 className="tb-display text-[44px] leading-[1] font-semibold tracking-tight">
            Examiner-grade<br />lessons. In 30 seconds.
          </h1>
          <p className="text-[var(--tb-cream)]/70 mt-5 max-w-md leading-relaxed">
            Sign in to generate lessons scored against AQA examiner-language
            patterns. Every block. Every mark. Visible.
          </p>
          <div className="mt-8 flex flex-wrap gap-2 text-[11px] tb-mono uppercase tracking-widest text-[var(--tb-cream)]/60">
            <span>Mark-scheme aligned</span>·<span>Bearer auth</span>·
            <span>Per-user budget · (P0.2 next)</span>
          </div>
        </div>
        <p className="text-[10px] tb-mono uppercase tracking-widest text-[var(--tb-cream)]/40">
          Phase: 3H.1.8b.3b.1 · MVP · P0.1 auth
        </p>
      </aside>

      {/* Right — form */}
      <main className="flex items-center justify-center p-6 sm:p-12 bg-[var(--tb-cream)]">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="tb-chip">{mode === "login" ? "Sign in" : "Create account"}</span>
          </div>
          <h2 className="tb-display text-[40px] font-semibold leading-tight tracking-tight">
            {mode === "login" ? "Welcome back." : "Get an account."}
          </h2>
          <p className="text-[var(--tb-ink-2)] mt-2">
            {mode === "login"
              ? "Sign in to generate and mark."
              : "Create an account to use the LLM-backed endpoints."}
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            {mode === "register" && (
              <label className="block">
                <span className="text-xs tb-mono uppercase tracking-widest text-[var(--tb-muted)]">
                  Name
                </span>
                <input
                  data-testid={AUTH.nameInput}
                  className="tb-input mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Carter"
                  disabled={loading}
                  autoComplete="name"
                />
              </label>
            )}
            <label className="block">
              <span className="text-xs tb-mono uppercase tracking-widest text-[var(--tb-muted)]">
                Email
              </span>
              <input
                data-testid={AUTH.emailInput}
                type="email"
                required
                className="tb-input mt-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@letsrevise.dev"
                disabled={loading}
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-xs tb-mono uppercase tracking-widest text-[var(--tb-muted)]">
                Password
              </span>
              <input
                data-testid={AUTH.passwordInput}
                type="password"
                required
                minLength={8}
                className="tb-input mt-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={loading}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </label>

            {error && (
              <div
                data-testid={AUTH.errorBanner}
                className="flex items-start gap-2 p-3 rounded-lg border border-[rgba(139,44,44,0.25)] bg-[var(--tb-violation-soft)] text-[var(--tb-violation)] text-sm"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              data-testid={AUTH.submitBtn}
              type="submit"
              className="tb-btn w-full justify-center"
              disabled={loading}
            >
              {loading
                ? mode === "login"
                  ? "Signing in…"
                  : "Creating account…"
                : (
                  <>
                    {mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={18} />
                  </>
                )}
            </button>
          </form>

          <div className="mt-6 text-sm text-[var(--tb-muted)]">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button
                  data-testid={AUTH.toggleRegister}
                  onClick={() => {
                    setMode("register");
                    setError("");
                  }}
                  className="tb-link"
                >
                  Create one
                </button>
                .
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  data-testid={AUTH.toggleLogin}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                  className="tb-link"
                >
                  Sign in
                </button>
                .
              </>
            )}
            <div className="mt-3">
              <Link to="/" className="tb-link">
                ← Back to home
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
