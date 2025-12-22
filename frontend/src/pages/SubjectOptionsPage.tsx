import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const SubjectOptionsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const stage = (searchParams.get("stage") || "").toLowerCase();
  const subject = searchParams.get("subject") || "";

  const isLoggedIn = !!localStorage.getItem("token");

  const goLoginThenReturn = () => {
    // Save where user wanted to go
    localStorage.setItem("postLoginRedirect", window.location.hash || "#/explore");
    navigate("/login");
  };

  const goDashboardWithFilters = () => {
    localStorage.setItem("selectedStage", stage);
    localStorage.setItem("selectedSubject", subject);

    if (!isLoggedIn) {
      goLoginThenReturn();
      return;
    }

    navigate("/dashboard");
  };

  const BoxButton = ({
    title,
    desc,
    onClick,
  }: {
    title: string;
    desc: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "white",
        border: "1px solid #e9ecef",
        borderRadius: "14px",
        padding: "16px",
        textAlign: "left",
        cursor: "pointer",
        boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        transition: "transform 0.12s ease, box-shadow 0.12s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 28px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.04)";
      }}
    >
      <div style={{ fontSize: "1.1rem", fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#666" }}>{desc}</div>
    </button>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "50px auto", padding: "0 20px" }}>
      <h1 style={{ fontSize: "2.2rem", marginBottom: 8 }}>
        {stage ? stage.toUpperCase() : "STAGE"} — {subject || "SUBJECT"}
      </h1>

      <p style={{ color: "#666", marginBottom: 28 }}>
        Choose where you want to go next.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 18,
        }}
      >
        <BoxButton
          title="My School"
          desc="School pathway (setup later)"
          onClick={() => alert("My School is next (we’ll build this after)")}
        />

        <BoxButton
          title="My Teacher / Class"
          desc="Assigned lessons from your teacher (setup later)"
          onClick={() => alert("Teacher/Class is next (we’ll build this after)")}
        />

        <BoxButton
          title="Uploaded Lessons"
          desc="Your uploads and teacher uploads (setup later)"
          onClick={() => alert("Uploads is next (we’ll build this after)")}
        />

        <BoxButton
          title="AI Subject Library"
          desc="Browse the existing library now"
          onClick={goDashboardWithFilters}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => navigate("/explore?stage=" + encodeURIComponent(stage || ""))}
          style={{
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "12px 16px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← Back to subjects
        </button>
      </div>
    </div>
  );
};

export default SubjectOptionsPage;
