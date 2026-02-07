import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const stage = (searchParams.get("stage") || "").toLowerCase();
  const isLoggedIn = localStorage.getItem("token");

  const EXPLORE_URL = "/explore";

  const goStage = (s: string) => {
    navigate(`${EXPLORE_URL}?stage=${encodeURIComponent(s)}`);
  };

  // subject goes to SubjectOptionsPage
  const goSubject = (pickedStage: string, pickedSubject: string) => {
    // store for later
    localStorage.setItem("selectedStage", pickedStage);
    localStorage.setItem("selectedSubject", pickedSubject);

    // go to subject options page
    navigate(
      `/explore/subject?stage=${encodeURIComponent(
        pickedStage
      )}&subject=${encodeURIComponent(pickedSubject)}`
    );
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    padding: "35px",
    borderRadius: "12px",
    boxShadow: "0 5px 20px rgba(0,0,0,0.05)",
    height: "100%",
    cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };

  const onCardEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = "translateY(-2px)";
    e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.08)";
  };

  const onCardLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "0 5px 20px rgba(0,0,0,0.05)";
  };

  const SubjectTile = ({
    title,
    subtitle,
    onClick,
  }: {
    title: string;
    subtitle: string;
    onClick: () => void;
  }) => {
    return (
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
        <div style={{ fontWeight: 800, color: "#222", marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ color: "#666", fontSize: "0.95rem" }}>{subtitle}</div>
      </button>
    );
  };

  const StagePanel = () => {
    if (!stage) return null;

    const panelBase: React.CSSProperties = {
      background: "white",
      borderRadius: "14px",
      padding: "22px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
      border: "1px solid #eee", // ✅ fixed string
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
              title="Maths"
              subtitle="Foundation & Higher • Revision notes • Quizzes"
              onClick={() => goSubject("gcse", "Maths")}
            />
            <SubjectTile
              title="English"
              subtitle="Language & Literature • Techniques • Practice"
              onClick={() => goSubject("gcse", "English")}
            />
            <SubjectTile
              title="Science"
              subtitle="Biology • Chemistry • Physics"
              onClick={() => goSubject("gcse", "Science")}
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
                  style={{
                    ...ctaBtn,
                    background: "#48bb78",
                    color: "white",
                  }}
                  onClick={() => navigate("/register")}
                >
                  Create free account
                </button>
                <button
                  style={{
                    ...ctaBtn,
                    background: "#111827",
                    color: "white",
                  }}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                style={{
                  ...ctaBtn,
                  background: "#48bb78",
                  color: "white",
                }}
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
              subtitle="Pure • Mechanics • Statistics"
              onClick={() => goSubject("a-level", "Mathematics")}
            />
            <SubjectTile
              title="Chemistry"
              subtitle="Topic summaries • Exam questions"
              onClick={() => goSubject("a-level", "Chemistry")}
            />
            <SubjectTile
              title="Biology"
              subtitle="Diagrams • Processes • Practice"
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
                  style={{
                    ...ctaBtn,
                    background: "#667eea",
                    color: "white",
                  }}
                  onClick={() => navigate("/register")}
                >
                  Create free account
                </button>
                <button
                  style={{
                    ...ctaBtn,
                    background: "#111827",
                    color: "white",
                  }}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                style={{
                  ...ctaBtn,
                  background: "#667eea",
                  color: "white",
                }}
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    // KS3 now behaves like GCSE/A-Level, no direct KS3_URL link
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
                Click a subject to continue. You’ll need an account to access
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
              subtitle="Number • Algebra • Geometry"
              onClick={() => goSubject("ks3", "Maths")}
            />
            <SubjectTile
              title="Science"
              subtitle="Biology • Chemistry • Physics"
              onClick={() => goSubject("ks3", "Science")}
            />
            <SubjectTile
              title="English"
              subtitle="Reading • Writing • Grammar"
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
                  style={{
                    ...ctaBtn,
                    background: "#ed8936",
                    color: "white",
                  }}
                  onClick={() => navigate("/register")}
                >
                  Create free account
                </button>
                <button
                  style={{
                    ...ctaBtn,
                    background: "#111827",
                    color: "white",
                  }}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                style={{
                  ...ctaBtn,
                  background: "#ed8936",
                  color: "white",
                }}
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

  return (
    <>
      <SEO
        title="LetsRevise - UK's Premier Learning Platform"
        description="Access comprehensive UK curriculum resources for A-Levels, GCSE, and KS3. Learn from expert teachers or create lessons to earn."
        keywords="UK curriculum, A-Level revision, GCSE resources, online learning"
        image="/logo.png"
        type="website"
      />

      <div
        style={{
          fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        }}
      >
        {/* Hero */}
        <header
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "80px 20px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              fontSize: "3.5rem",
              marginBottom: "20px",
              fontWeight: 800,
            }}
          >
            LetsRevise
          </h1>
          <p
            style={{
              fontSize: "1.5rem",
              marginBottom: "30px",
              opacity: 0.9,
            }}
          >
            Your Premier Platform for UK Curriculum Excellence
          </p>
          <p
            style={{
              fontSize: "1.1rem",
              maxWidth: "800px",
              margin: "0 auto 40px",
              lineHeight: 1.6,
            }}
          >
            Access comprehensive study resources for A-Levels, GCSE, and KS3.
          </p>

          {!isLoggedIn ? (
            <div
              style={{
                display: "flex",
                gap: "20px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                to="/register"
                style={{
                  background: "white",
                  color: "#667eea",
                  padding: "16px 32px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                }}
              >
                Start Learning Free
              </Link>

              <Link
                to="/login"
                style={{
                  background: "transparent",
                  color: "white",
                  padding: "16px 32px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  border: "2px solid white",
                }}
              >
                Sign In to Account
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                gap: "20px",
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                to="/dashboard"
                style={{
                  background: "white",
                  color: "#667eea",
                  padding: "16px 32px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                }}
              >
                Go to Dashboard
              </Link>

              <Link
                to="/lessons"
                style={{
                  background: "transparent",
                  color: "white",
                  padding: "16px 32px",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "1.1rem",
                  border: "2px solid white",
                }}
              >
                Browse Lessons
              </Link>
            </div>
          )}
        </header>

        {/* Curriculum */}
        <section
          style={{
            background: "#f8f9fa",
            padding: "80px 20px",
            borderTop: "1px solid #e9ecef",
            borderBottom: "1px solid #e9ecef",
          }}
        >
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h2
              style={{
                textAlign: "center",
                fontSize: "2.5rem",
                marginBottom: "14px",
                color: "#333",
                fontWeight: 700,
              }}
            >
              Comprehensive UK Curriculum Coverage
            </h2>

            <div
              style={{
                textAlign: "center",
                color: "#666",
                marginBottom: "20px",
              }}
            >
              Selected stage: <b>{stage || "(none yet)"}</b>
            </div>

            <StagePanel />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
                gap: "30px",
              }}
            >
              {/* A-Level card */}
              <article
                style={cardStyle}
                role="button"
                tabIndex={0}
                onClick={() => goStage("a-level")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goStage("a-level");
                  }
                }}
                onMouseEnter={onCardEnter}
                onMouseLeave={onCardLeave}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "25px",
                    gap: "15px",
                  }}
                >
                  <div
                    style={{
                      background: "#667eea",
                      color: "white",
                      width: "50px",
                      height: "50px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                    }}
                  >
                    A
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: "1.8rem",
                        margin: 0,
                        color: "#333",
                        fontWeight: 600,
                      }}
                    >
                      A-Level
                    </h3>
                    <p
                      style={{
                        color: "#667eea",
                        margin: "5px 0 0 0",
                        fontWeight: 500,
                      }}
                    >
                      Years 12-13 | Advanced Level
                    </p>
                  </div>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Mathematics & Further Maths
                  </li>
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Sciences (Biology, Chemistry, Physics)
                  </li>
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Humanities & Social Sciences
                  </li>
                  <li style={{ padding: "12px 0", color: "#555" }}>
                    Languages & Literature
                  </li>
                </ul>
              </article>

              {/* GCSE card */}
              <article
                style={cardStyle}
                role="button"
                tabIndex={0}
                onClick={() => goStage("gcse")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goStage("gcse");
                  }
                }}
                onMouseEnter={onCardEnter}
                onMouseLeave={onCardLeave}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "25px",
                    gap: "15px",
                  }}
                >
                  <div
                    style={{
                      background: "#48bb78",
                      color: "white",
                      width: "50px",
                      height: "50px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                    }}
                  >
                    G
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: "1.8rem",
                        margin: 0,
                        color: "#333",
                        fontWeight: 600,
                      }}
                    >
                      GCSE
                    </h3>
                    <p
                      style={{
                        color: "#48bb78",
                        margin: "5px 0 0 0",
                        fontWeight: 500,
                      }}
                    >
                      Years 10-11 | Foundation & Higher
                    </p>
                  </div>
                </div>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Core Subjects (Maths, English, Science)
                  </li>
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Foundation & Higher Tiers
                  </li>
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Exam Board Specific Resources
                  </li>
                  <li style={{ padding: "12px 0", color: "#555" }}>
                    Past Papers & Mark Schemes
                  </li>
                </ul>
              </article>

              {/* KS3 card */}
              <article
                style={cardStyle}
                role="button"
                tabIndex={0}
                onClick={() => goStage("ks3")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goStage("ks3");
                  }
                }}
                onMouseEnter={onCardEnter}
                onMouseLeave={onCardLeave}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "25px",
                    gap: "15px",
                  }}
                >
                  <div
                    style={{
                      background: "#ed8936",
                      color: "white",
                      width: "50px",
                      height: "50px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.5rem",
                      fontWeight: "bold",
                    }}
                  >
                    K
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: "1.8rem",
                        margin: 0,
                        color: "#333",
                        fontWeight: 600,
                      }}
                    >
                      KS3
                    </h3>
                    <p
                      style={{
                        color: "#ed8936",
                        margin: "5px 0 0 0",
                        fontWeight: 500,
                      }}
                    >
                      Years 7-9 | Key Stage 3
                    </p>
                  </div>
                </div>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Foundation Building
                  </li>
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Skill Development
                  </li>
                  <li
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid #f1f1f1",
                      color: "#555",
                    }}
                  >
                    Progress Tracking
                  </li>
                  <li style={{ padding: "12px 0", color: "#555" }}>
                    Preparation for GCSE
                  </li>
                </ul>
                {/* No direct KS3 content link here anymore */}
              </article>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default HomePage;
