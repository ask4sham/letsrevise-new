import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Zap,
  AlertTriangle,
  LogIn,
  LogOut,
  Lock,
  Gauge,
} from "lucide-react";
import api, { is429, is422, formatApiError, get429Payload, get422Payload } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { LANDING } from "@/constants/testIds";

const SUGGESTIONS = [
  "Homeostasis",
  "Structure and function of the nervous system",
  "The eye",
  "Respiration",
  "Photosynthesis",
  "Active transport",
];

const BOARDS = ["AQA", "Edexcel", "OCR"];
const TIERS = ["Higher", "Foundation"];

export default function Landing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [topic, setTopic] = useState("Homeostasis");
  const [board, setBoard] = useState("AQA");
  const [tier, setTier] = useState("Higher");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limitInfo, setLimitInfo] = useState(null); // {code, limit_type, detail} on 429
  const [invalidInfo, setInvalidInfo] = useState(null); // {detail, validation_errors} on 422
  const [recent, setRecent] = useState([]);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api.list(6).then(setRecent).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) {
      setUsage(null);
      return;
    }
    api
      .usage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [user]);

  const generate = async () => {
    setError("");
    setLimitInfo(null);
    setInvalidInfo(null);
    if (!user) {
      navigate(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    if (!topic.trim()) {
      setError("Type a GCSE topic to generate a lesson.");
      return;
    }
    setLoading(true);
    try {
      const lesson = await api.generate(topic.trim(), board, tier);
      // Defensive: never navigate to /lesson/undefined
      if (!lesson?.id) {
        setInvalidInfo({
          detail:
            "The AI response was not valid enough to save. Please try again.",
          validation_errors: [],
        });
        setLoading(false);
        return;
      }
      navigate(`/lesson/${lesson.id}`);
    } catch (e) {
      if (is429(e)) {
        setLimitInfo(get429Payload(e));
      } else if (is422(e)) {
        setInvalidInfo(
          get422Payload(e) || {
            detail:
              "The AI response was not valid enough to save. Please try again.",
            validation_errors: [],
          }
        );
      } else if (e?.response?.status === 401) {
        setError("Session expired. Redirecting to login…");
      } else {
        setError(formatApiError(e));
      }
      setLoading(false);
      api.usage().then(setUsage).catch(() => {});
    }
  };

  const dailyChip =
    usage && typeof usage.daily_used === "number"
      ? `${usage.daily_used}/${usage.daily_limit} today`
      : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--tb-line)] bg-[var(--tb-cream)]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-md bg-[var(--tb-ink)] text-[var(--tb-cream)] grid place-items-center tb-display font-bold text-[15px]">
              tb
            </div>
            <span className="tb-display font-semibold text-[18px] tracking-tight">
              Teacher Brain
            </span>
            <span className="tb-chip ml-2">MVP</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/library"
              data-testid={LANDING.libraryLink}
              className="tb-btn ghost text-sm py-2 px-4"
            >
              <BookOpen size={16} />
              Library
            </Link>
            {user ? (
              <>
                {dailyChip && (
                  <span
                    data-testid={LANDING.usageChip}
                    className="tb-chip hidden md:inline-flex"
                    style={{ textTransform: "none", letterSpacing: 0 }}
                    title="Daily AI usage"
                  >
                    <Gauge size={11} />
                    {dailyChip}
                  </span>
                )}
                <span
                  data-testid={LANDING.userChip}
                  className="tb-chip pass hidden sm:inline-flex"
                  style={{ textTransform: "none", letterSpacing: 0 }}
                >
                  <ShieldCheck size={11} />
                  {user.email}
                </span>
                <button
                  data-testid={LANDING.logoutBtn}
                  onClick={async () => {
                    await logout();
                  }}
                  className="tb-btn ghost text-sm py-2 px-3"
                  title="Sign out"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/login?next=%2F"
                data-testid={LANDING.loginCta}
                className="tb-btn text-sm py-2 px-4"
              >
                <LogIn size={14} />
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          className="max-w-3xl"
        >
          <div className="tb-chip mb-6 accent">
            <Sparkles size={12} />
            Examiner Language V2 · AQA spec aligned
          </div>
          <h1 className="tb-display text-[56px] sm:text-[68px] leading-[0.95] font-semibold tracking-tight">
            Stop shipping notes.
            <br />
            <span className="italic text-[var(--tb-accent)]">Start shipping marks.</span>
          </h1>
          <p className="mt-6 text-[19px] leading-[1.6] text-[var(--tb-ink-2)] max-w-2xl">
            Generate a GCSE-grade lesson in 30 seconds. Every block is scored by an
            examiner engine against mark-scheme rules — so your students learn the
            wording examiners actually want.
          </p>
        </motion.div>

        {/* Generation card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08, ease: [0.2, 0.7, 0.2, 1] }}
          className="tb-card mt-12 p-6 sm:p-8"
        >
          <label className="text-xs tb-mono uppercase tracking-widest text-[var(--tb-muted)]">
            GCSE Topic
          </label>
          <div className="mt-3 flex flex-col sm:flex-row gap-3 items-stretch">
            <input
              data-testid={LANDING.topicInput}
              className="tb-input flex-1 tb-display text-[22px] font-medium"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && generate()}
              placeholder="Homeostasis"
              disabled={loading}
            />
            <button
              data-testid={LANDING.generateBtn}
              onClick={generate}
              disabled={loading}
              className="tb-btn sm:w-auto justify-center text-base"
            >
              {loading ? (
                <>
                  <span className="tb-mono text-xs">generating</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--tb-cream)] animate-pulse" />
                </>
              ) : user ? (
                <>
                  Generate <ArrowRight size={18} />
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Sign in to generate
                </>
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-3 items-center text-sm">
            <span className="text-[var(--tb-muted)] tb-mono text-xs uppercase tracking-widest">
              Spec
            </span>
            <select
              data-testid={LANDING.examBoardSelect}
              className="tb-select"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              disabled={loading}
            >
              {BOARDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <select
              data-testid={LANDING.tierSelect}
              className="tb-select"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              disabled={loading}
            >
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <span className="text-[var(--tb-muted)] text-xs">·</span>
            <span className="text-[var(--tb-muted)] text-xs">
              GCSE Biology · 30s generation
            </span>
          </div>

          {/* Suggestions */}
          <div className="mt-6 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                disabled={loading}
                className="tb-chip hover:bg-[var(--tb-paper)] transition-colors cursor-pointer disabled:cursor-not-allowed"
                style={{ textTransform: "none", letterSpacing: 0 }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* 429 friendly banner */}
          {limitInfo && (
            <div
              data-testid={LANDING.limitBanner}
              className="mt-5 flex items-start gap-3 p-4 rounded-lg border border-[var(--tb-accent)]/30 bg-[var(--tb-accent-soft)] text-[var(--tb-ink)]"
            >
              <Gauge size={18} className="mt-0.5 shrink-0 text-[var(--tb-accent)]" />
              <div className="text-sm leading-relaxed">
                <div className="tb-display font-semibold text-[16px] leading-tight">
                  {limitInfo.limit_type === "daily"
                    ? "Daily AI limit reached"
                    : limitInfo.limit_type === "monthly"
                      ? "Monthly AI limit reached"
                      : "AI limit reached"}
                </div>
                <div className="text-[var(--tb-ink-2)] mt-1">
                  {limitInfo.detail}
                </div>
                {usage && (
                  <div className="tb-mono text-[11px] uppercase tracking-widest text-[var(--tb-muted)] mt-2">
                    {usage.daily_used}/{usage.daily_limit} today ·{" "}
                    {usage.monthly_used}/{usage.monthly_limit} this month
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 422 friendly banner — schema validation failed */}
          {invalidInfo && (
            <div
              data-testid={LANDING.invalidBanner}
              className="mt-5 flex items-start gap-3 p-4 rounded-lg border border-[var(--tb-accent)]/30 bg-[var(--tb-accent-soft)] text-[var(--tb-ink)]"
            >
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-[var(--tb-accent)]"
              />
              <div className="text-sm leading-relaxed">
                <div className="tb-display font-semibold text-[16px] leading-tight">
                  AI response was not valid
                </div>
                <div className="text-[var(--tb-ink-2)] mt-1">
                  The AI response was not valid enough to save. Please try
                  again.
                </div>
                {invalidInfo.validation_errors?.length > 0 && (
                  <ul className="tb-mono text-[11px] mt-2 space-y-0.5 text-[var(--tb-muted)] max-h-24 overflow-auto">
                    {invalidInfo.validation_errors.slice(0, 4).map((v, i) => (
                      <li key={i}>• {v}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {error && (
            <div
              data-testid={LANDING.errorBanner}
              className="mt-5 flex items-start gap-2 p-3 rounded-lg border border-[rgba(139,44,44,0.25)] bg-[var(--tb-violation-soft)] text-[var(--tb-violation)] text-sm"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div data-testid={LANDING.loadingCard} className="mt-6 grid gap-3">
              <p className="text-sm text-[var(--tb-muted)] tb-mono uppercase tracking-widest">
                Examiner Engine running…
              </p>
              <div className="tb-skeleton h-4 w-3/4" />
              <div className="tb-skeleton h-4 w-2/3" />
              <div className="tb-skeleton h-4 w-4/5" />
              <p className="text-xs text-[var(--tb-muted)] mt-2 italic">
                24 quality checks · examiner connectives · contrast pairs · worked-reasoning chain
              </p>
            </div>
          )}
        </motion.div>

        {/* Trust strip */}
        <div className="mt-14 grid sm:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, label: "Mark-scheme aligned", body: "Every block scored against AQA examiner language patterns." },
            { icon: Zap, label: "30-second lessons", body: "Type a topic. The lesson streams in. Examiner Card scores live." },
            { icon: Sparkles, label: "Visible rigour", body: "See the score, the violations caught, the upgrade applied — nothing hidden." },
          ].map(({ icon: Icon, label, body }) => (
            <div key={label} className="flex gap-3">
              <Icon size={18} className="mt-1 shrink-0 text-[var(--tb-pass)]" />
              <div>
                <div className="tb-display font-semibold text-[17px]">{label}</div>
                <div className="text-sm text-[var(--tb-ink-2)] leading-relaxed mt-1">
                  {body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent */}
        {recent.length > 0 && (
          <section className="mt-20">
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="tb-display text-[26px] font-semibold tracking-tight">
                Recently generated
              </h2>
              <Link to="/library" className="tb-link text-sm">
                View all →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map((l) => (
                <Link
                  key={l.id}
                  to={`/lesson/${l.id}`}
                  data-testid={LANDING.recentLessonCard(l.id)}
                  className="tb-card p-5 block"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="tb-chip">{l.exam_board || "AQA"}</span>
                    <span className={`tb-chip ${l.pass ? "pass" : "fail"}`}>
                      {l.overall_score?.toFixed(1) ?? "—"}/10
                    </span>
                  </div>
                  <div className="tb-display text-[19px] font-semibold leading-tight">
                    {l.topic}
                  </div>
                  <div className="text-xs text-[var(--tb-muted)] mt-2 tb-mono">
                    {l.spec_point || "spec point pending"}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[var(--tb-line)] py-8 text-center text-xs text-[var(--tb-muted)] tb-mono">
        Teacher Brain MVP · Examiner Language V2 (3H.1.8b.3b.1) · P0.1 auth · P0.2 budget cap
      </footer>
    </div>
  );
}
