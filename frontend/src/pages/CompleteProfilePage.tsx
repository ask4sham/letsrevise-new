import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { updateUser } from "../utils/authStorage";
import { getAxiosErrorMessage } from "../utils/apiErrorMessage";

/**
 * Optional post-signup step: year group, school, last name — does not block account creation.
 */
const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, token, refresh } = useCurrentUser({ watchLocation: true });
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [schoolName, setSchoolName] = useState((user as { schoolName?: string })?.schoolName || "");
  const [yearGroup, setYearGroup] = useState(
    user?.yearGroup != null ? String(user.yearGroup) : ""
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isStudent = user?.userType === "student";

  const goDashboard = () => {
    if (user?.userType === "teacher") navigate("/teacher-dashboard", { replace: true });
    else if (user?.userType === "parent") navigate("/parent-dashboard", { replace: true });
    else navigate("/student-dashboard", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    setMessage("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (lastName.trim()) body.lastName = lastName.trim();
      if (schoolName.trim()) body.schoolName = schoolName.trim();
      if (isStudent && yearGroup.trim()) {
        const y = Number(yearGroup);
        if (!Number.isFinite(y) || y < 7 || y > 13) {
          setMessage("Please choose a year group between 7 and 13.");
          setLoading(false);
          return;
        }
        body.yearGroup = y;
      }

      const res = await api.put("/users/profile", body);
      const data = res?.data as { user?: Record<string, unknown> } | undefined;
      if (data?.user) {
        updateUser({ ...user, ...data.user });
        refresh();
      }
      goDashboard();
    } catch (err: unknown) {
      setMessage(getAxiosErrorMessage(err, "Could not save profile."));
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    goDashboard();
  };

  return (
    <div style={{ minHeight: "70vh", background: "#f8fafc", padding: "40px 20px" }}>
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          background: "#fff",
          padding: 36,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <h1 style={{ marginTop: 0, color: "#111827", fontSize: "1.5rem" }}>Tell us a bit more</h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>
          Add your school and year group so we can tailor content. You can skip and finish this later in{" "}
          <strong>My Profile</strong>.
        </p>

        {message && (
          <div style={{ padding: 12, marginBottom: 16, background: "#fef2f2", color: "#991b1b", borderRadius: 8 }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#374151" }}>
              Last name <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={inputStyle}
              placeholder="Last name"
            />
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#374151" }}>
              School name <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
            </label>
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              style={inputStyle}
              placeholder="School name"
            />
          </div>

          {isStudent && (
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, color: "#374151" }}>
                Year group <span style={{ fontWeight: 400, color: "#9ca3af" }}>(optional)</span>
              </label>
              <select value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} style={inputStyle}>
                <option value="">Select…</option>
                {[7, 8, 9, 10, 11, 12, 13].map((y) => (
                  <option key={y} value={String(y)}>
                    Year {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "14px 16px",
              background: loading ? "#9ca3af" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Saving…" : "Save and continue"}
          </button>
        </form>

        <button
          type="button"
          onClick={handleSkip}
          style={{
            marginTop: 16,
            width: "100%",
            padding: "12px 16px",
            background: "transparent",
            color: "#64748b",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "2px solid #e2e8f0",
  borderRadius: 8,
  fontSize: "1rem",
  boxSizing: "border-box",
};

export default CompleteProfilePage;
