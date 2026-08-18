import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import { useCurrentUser } from "../hooks/useCurrentUser";

const sectionStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "0 20px",
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoggedIn } = useCurrentUser({ watchLocation: true });

  const stage = (searchParams.get("stage") || "").toLowerCase();
  const EXPLORE_URL = "/explore";

  const goStage = (s: string) => {
    navigate(`${EXPLORE_URL}?stage=${encodeURIComponent(s)}`);
  };

  const goSubject = (pickedStage: string, pickedSubject: string) => {
    localStorage.setItem("selectedStage", pickedStage);
    localStorage.setItem("selectedSubject", pickedSubject);
    navigate(
      `/explore/subject?stage=${encodeURIComponent(
        pickedStage
      )}&subject=${encodeURIComponent(pickedSubject)}`
    );
  };

  const primaryBtn: React.CSSProperties = {
    background: "white",
    color: "#667eea",
    padding: "16px 32px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "1.05rem",
    border: "none",
    cursor: "pointer",
    display: "inline-block",
  };

  const secondaryBtn: React.CSSProperties = {
    background: "transparent",
    color: "white",
    padding: "16px 32px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "bold",
    fontSize: "1.05rem",
    border: "2px solid white",
    cursor: "pointer",
    display: "inline-block",
  };

  const courseCard: React.CSSProperties = {
    background: "white",
    borderRadius: "14px",
    padding: "28px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
    border: "1px solid #eee",
    height: "100%",
    display: "flex",
    flexDirection: "column",
  };

  const featureCard: React.CSSProperties = {
    background: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
    border: "1px solid #eee",
    height: "100%",
  };

  const stageCard: React.CSSProperties = {
    background: "white",
    borderRadius: "12px",
    padding: "22px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
    border: "1px solid #eee",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
  };

  const statusPill = (color: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "999px",
    fontWeight: 700,
    fontSize: "0.85rem",
    background: color,
    color: "#333",
    marginBottom: "12px",
  });

  const courseCta: React.CSSProperties = {
    marginTop: "auto",
    paddingTop: "20px",
  };

  const courseLinkBtn = (accent: string): React.CSSProperties => ({
    display: "inline-block",
    background: accent,
    color: "white",
    padding: "12px 20px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "0.98rem",
  });

  const SubjectTile = ({
    title,
    subtitle,
    onClick,
  }: {
    title: string;
    subtitle: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "#f8f9fa",
        border: "1px solid #e9ecef",
        borderRadius: "12px",
        padding: "14px",
        cursor: "pointer",
        textAlign: "center",
        width: "100%",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 10px 18px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ fontWeight: 800, color: "#222", marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#666", fontSize: "0.95rem" }}>{subtitle}</div>
    </button>
  );

  const StagePanel = () => {
    if (!stage) return null;

    const panelBase: React.CSSProperties = {
      background: "white",
      borderRadius: "14px",
      padding: "22px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      border: "1px solid #eee",
      marginBottom: "35px",
    };

    const pill: React.CSSProperties = {
      display: "inline-block",
      padding: "6px 12px",
      borderRadius: "999px",
      fontWeight: 700,
      fontSize: "0.9rem",
      background: "#f3f4f6",
      color: "#333",
    };

    const grid: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "14px",
      marginTop: "14px",
    };

    const ctaWrap: React.CSSProperties = {
      marginTop: "16px",
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      alignItems: "center",
    };

    const ctaBtn: React.CSSProperties = {
      border: "none",
      borderRadius: "10px",
      padding: "12px 16px",
      fontWeight: 800,
      cursor: "pointer",
    };

    if (stage === "gcse") {
      return (
        <div style={panelBase}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={pill}>GCSE</div>
              <h3
                style={{
                  margin: "10px 0 4px",
                  fontSize: "1.35rem",
                  color: "#222",
                }}
              >
                Choose a GCSE subject
              </h3>
              <div style={{ color: "#666" }}>Click a subject to continue.</div>
            </div>
            <div style={{ color: "#777", fontSize: "0.95rem" }}>
              URL: <code>{`#/explore?stage=gcse`}</code>
            </div>
          </div>

          <div style={grid}>
            <SubjectTile
              title="Biology"
              subtitle="Edexcel 4BI1 and AQA 8461"
              onClick={() => goSubject("gcse", "Science")}
            />
            <SubjectTile
              title="Maths"
              subtitle="Browse available resources"
              onClick={() => goSubject("gcse", "Maths")}
            />
            <SubjectTile
              title="English"
              subtitle="Browse available resources"
              onClick={() => goSubject("gcse", "English")}
            />
            <SubjectTile
              title="More subjects"
              subtitle="History • Geography • Languages • etc."
              onClick={() => goSubject("gcse", "More subjects")}
            />
          </div>

          <div style={ctaWrap}>
            {!isLoggedIn ? (
              <>
                <button
                  type="button"
                  style={{ ...ctaBtn, background: "#48bb78", color: "white" }}
                  onClick={() => navigate("/register")}
                >
                  Create free account
                </button>
                <button
                  type="button"
                  style={{ ...ctaBtn, background: "#111827", color: "white" }}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{ ...ctaBtn, background: "#48bb78", color: "white" }}
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    if (stage === "a-level" || stage === "alevel") {
      return (
        <div style={panelBase}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={pill}>A-Level</div>
              <h3
                style={{
                  margin: "10px 0 4px",
                  fontSize: "1.35rem",
                  color: "#222",
                }}
              >
                Choose an A-Level subject
              </h3>
              <div style={{ color: "#666" }}>Click a subject to continue.</div>
            </div>
            <div style={{ color: "#777", fontSize: "0.95rem" }}>
              URL: <code>{`#/explore?stage=a-level`}</code>
            </div>
          </div>

          <div style={grid}>
            <SubjectTile
              title="Mathematics"
              subtitle="Browse available resources"
              onClick={() => goSubject("a-level", "Mathematics")}
            />
            <SubjectTile
              title="Chemistry"
              subtitle="Browse available resources"
              onClick={() => goSubject("a-level", "Chemistry")}
            />
            <SubjectTile
              title="Biology"
              subtitle="Browse available resources"
              onClick={() => goSubject("a-level", "Biology")}
            />
            <SubjectTile
              title="More subjects"
              subtitle="Physics • Psychology • Economics • etc."
              onClick={() => goSubject("a-level", "More subjects")}
            />
          </div>

          <div style={ctaWrap}>
            {!isLoggedIn ? (
              <>
                <button
                  type="button"
                  style={{ ...ctaBtn, background: "#667eea", color: "white" }}
                  onClick={() => navigate("/register")}
                >
                  Create free account
                </button>
                <button
                  type="button"
                  style={{ ...ctaBtn, background: "#111827", color: "white" }}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{ ...ctaBtn, background: "#667eea", color: "white" }}
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    if (stage === "ks3") {
      return (
        <div style={panelBase}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={pill}>KS3</div>
              <h3
                style={{
                  margin: "10px 0 4px",
                  fontSize: "1.35rem",
                  color: "#222",
                }}
              >
                Choose a KS3 subject
              </h3>
              <div style={{ color: "#666" }}>
                Click a subject to continue. You&apos;ll need an account to access
                resources.
              </div>
            </div>
            <div style={{ color: "#777", fontSize: "0.95rem" }}>
              URL: <code>{`#/explore?stage=ks3`}</code>
            </div>
          </div>

          <div style={grid}>
            <SubjectTile
              title="Maths"
              subtitle="Browse available resources"
              onClick={() => goSubject("ks3", "Maths")}
            />
            <SubjectTile
              title="Science"
              subtitle="Browse available resources"
              onClick={() => goSubject("ks3", "Science")}
            />
            <SubjectTile
              title="English"
              subtitle="Browse available resources"
              onClick={() => goSubject("ks3", "English")}
            />
            <SubjectTile
              title="More subjects"
              subtitle="History • Geography • etc."
              onClick={() => goSubject("ks3", "More subjects")}
            />
          </div>

          <div style={ctaWrap}>
            {!isLoggedIn ? (
              <>
                <button
                  type="button"
                  style={{ ...ctaBtn, background: "#ed8936", color: "white" }}
                  onClick={() => navigate("/register")}
                >
                  Create free account
                </button>
                <button
                  type="button"
                  style={{ ...ctaBtn, background: "#111827", color: "white" }}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                type="button"
                style={{ ...ctaBtn, background: "#ed8936", color: "white" }}
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div style={panelBase}>
        <div style={pill}>Unknown stage</div>
        <h3
          style={{
            margin: "10px 0 4px",
            fontSize: "1.25rem",
            color: "#222",
          }}
        >
          Stage not recognised: <code>{stage}</code>
        </h3>
        <div style={{ color: "#666" }}>
          Use the cards below to pick GCSE, A-Level or KS3.
        </div>
      </div>
    );
  };

  const BrowseByStage = () => {
    if (stage) return null;

    const stages = [
      { key: "gcse", label: "GCSE", note: "Years 10–11" },
      { key: "a-level", label: "A-Level", note: "Years 12–13" },
      { key: "ks3", label: "KS3", note: "Years 7–9" },
    ];

    return (
      <section style={{ padding: "48px 20px 20px", background: "#fff" }}>
        <div style={sectionStyle}>
          <h2
            style={{
              fontSize: "1.35rem",
              marginBottom: "8px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Browse by stage
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "#666",
              marginBottom: "24px",
              fontSize: "0.98rem",
            }}
          >
            Pick a stage to explore subjects and continue to options.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {stages.map(({ key, label, note }) => (
              <button
                key={key}
                type="button"
                onClick={() => goStage(key)}
                style={stageCard}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 22px rgba(0,0,0,0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 16px rgba(0,0,0,0.05)";
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "1.15rem" }}>{label}</div>
                <div style={{ color: "#666", marginTop: 6 }}>{note}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  };

  return (
    <>
      <SEO
        title="LetsRevise — GCSE Biology Revision"
        description="Interactive GCSE Biology revision for Pearson Edexcel International GCSE Biology (4BI1) and AQA GCSE Biology (8461). Learn through structured lessons, diagrams, quizzes and exam-style practice."
        keywords="GCSE Biology, Edexcel 4BI1, AQA 8461, Biology revision, interactive lessons, exam practice"
        image="/logo.png"
        type="website"
      />

      <div
        style={{
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          color: "#333",
        }}
      >
        <header
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "80px 20px 70px",
            textAlign: "center",
          }}
        >
          <div style={sectionStyle}>
            <p
              style={{
                fontSize: "0.95rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                opacity: 0.85,
                marginBottom: "16px",
                fontWeight: 700,
              }}
            >
              Biology-first revision platform
            </p>
            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 3.25rem)",
                marginBottom: "18px",
                fontWeight: 800,
                lineHeight: 1.15,
              }}
            >
              Master Biology, one topic at a time.
            </h1>
            <p
              style={{
                fontSize: "1.35rem",
                marginBottom: "22px",
                opacity: 0.95,
                fontWeight: 600,
              }}
            >
              Structured lessons, interactive activities, quizzes and exam-style
              practice for GCSE Biology.
            </p>
            <p
              style={{
                fontSize: "1.05rem",
                maxWidth: "760px",
                margin: "0 auto 36px",
                lineHeight: 1.65,
                opacity: 0.92,
              }}
            >
              Start with Pearson Edexcel International GCSE Biology (4BI1) and AQA
              GCSE Biology (8461). Explore curated lessons designed to help you
              understand the science, practise what you&apos;ve learned and prepare
              for exams.
            </p>

            {!isLoggedIn ? (
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link to="/browse-lessons" style={primaryBtn}>
                  Explore Biology
                </Link>
                <Link to="/register" style={secondaryBtn}>
                  Create free account
                </Link>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link to="/browse-lessons" style={primaryBtn}>
                  Explore Biology
                </Link>
                <Link to="/dashboard" style={secondaryBtn}>
                  Go to dashboard
                </Link>
              </div>
            )}
          </div>
        </header>

        <section style={{ background: "#f8f9fa", padding: "70px 20px" }}>
          <div style={sectionStyle}>
            <StagePanel />

            <h2
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                marginBottom: "14px",
                fontWeight: 700,
                textAlign: "center",
              }}
            >
              Biology revision built for learning, not just reading
            </h2>
            <p
              style={{
                textAlign: "center",
                color: "#555",
                maxWidth: "720px",
                margin: "0 auto 40px",
                lineHeight: 1.65,
                fontSize: "1.05rem",
              }}
            >
              LetsRevise takes you from understanding a topic to checking your
              knowledge and applying it to exam questions — all in one learning
              journey.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "24px",
              }}
            >
              <article style={courseCard}>
                <span style={statusPill("#e8f4fd")}>
                  Curated lessons expanding
                </span>
                <h3 style={{ fontSize: "1.25rem", marginBottom: "10px" }}>
                  Pearson Edexcel International GCSE Biology (4BI1)
                </h3>
                <p style={{ color: "#555", lineHeight: 1.6, flex: 1 }}>
                  Learn Edexcel International GCSE Biology through structured
                  teaching, original diagrams, interactive activities, retrieval
                  checks, quizzes and exam-style practice. New curated lessons are
                  being added as we complete the course.
                </p>
                <div style={courseCta}>
                  <Link to="/browse-lessons" style={courseLinkBtn("#2563eb")}>
                    Explore Edexcel Biology
                  </Link>
                </div>
              </article>

              <article style={courseCard}>
                <span style={statusPill("#ecfdf3")}>
                  Lessons available • coverage expanding
                </span>
                <h3 style={{ fontSize: "1.25rem", marginBottom: "10px" }}>
                  AQA GCSE Biology (8461)
                </h3>
                <p style={{ color: "#555", lineHeight: 1.6, flex: 1 }}>
                  Explore AQA GCSE Biology lessons for Foundation and Higher, with
                  structured teaching, visual explanations, retrieval practice and
                  exam-focused activities. Additional topics are being completed.
                </p>
                <div style={courseCta}>
                  <Link to="/browse-lessons" style={courseLinkBtn("#16a34a")}>
                    Explore AQA Biology
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <BrowseByStage />

        <section style={{ padding: "70px 20px" }}>
          <div style={sectionStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "20px",
              }}
            >
              <article style={featureCard}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>
                  Learn the science
                </h3>
                <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}>
                  Structured lessons break complex Biology into clear, manageable
                  steps.
                </p>
              </article>
              <article style={featureCard}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>
                  Interact and retrieve
                </h3>
                <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}>
                  Use diagrams, activities and quick checks to actively test your
                  understanding as you learn.
                </p>
              </article>
              <article style={featureCard}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>
                  Practise for exams
                </h3>
                <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}>
                  Apply your knowledge through quizzes, exam-style questions and
                  focused practice.
                </p>
              </article>
              <article style={featureCard}>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "10px" }}>
                  Know what to revise next
                </h3>
                <p style={{ color: "#555", lineHeight: 1.6, margin: 0 }}>
                  Use revision and progress tools to identify what you&apos;ve
                  learned and where you need more practice.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section
          style={{
            background: "#f3f4f6",
            padding: "56px 20px 64px",
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <div style={{ ...sectionStyle, textAlign: "center" }}>
            <h2
              style={{
                fontSize: "1.5rem",
                marginBottom: "12px",
                fontWeight: 700,
              }}
            >
              Biology first. More subjects to follow.
            </h2>
            <p
              style={{
                color: "#555",
                maxWidth: "640px",
                margin: "0 auto",
                lineHeight: 1.65,
              }}
            >
              We&apos;re building LetsRevise course by course, focusing on depth
              and learning quality before expanding into more sciences and
              subjects.
            </p>
            {!isLoggedIn && (
              <button
                type="button"
                onClick={() => navigate("/register")}
                style={{
                  marginTop: "24px",
                  background: "#667eea",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 22px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: "0.98rem",
                }}
              >
                Create free account
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default HomePage;
