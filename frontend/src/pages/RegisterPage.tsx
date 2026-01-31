import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

type UserType = "student" | "teacher" | "parent";

function deriveStageKeyFromYearGroup(yearGroup: string) {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return "";
  if (n >= 7 && n <= 9) return "KS3";
  if (n >= 10 && n <= 11) return "GCSE";
  if (n >= 12 && n <= 13) return "A-level";
  return "";
}

const RegisterPage: React.FC = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [userType, setUserType] = useState<UserType>("student");
  const [linkedStudentEmail, setLinkedStudentEmail] = useState("");

  // ✅ NEW: student year group (drives level gating)
  const [yearGroup, setYearGroup] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [backendStatus, setBackendStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkBackend();
  }, []);

  // if user toggles away from student, clear year group (non-breaking)
  useEffect(() => {
    if (userType !== "student") setYearGroup("");
  }, [userType]);

  const stageLabel = useMemo(() => {
    if (userType !== "student") return "";
    return deriveStageKeyFromYearGroup(yearGroup);
  }, [userType, yearGroup]);

  const checkBackend = async () => {
    try {
      await axios.get(`${API_BASE}/api/health`);
      setBackendStatus("✅ Backend connected");
    } catch {
      setBackendStatus("❌ Backend not connected");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match. Please re-enter them.");
      return;
    }

    // ✅ Student must pick year group (7–13)
    if (userType === "student") {
      const n = Number(yearGroup);
      if (!Number.isFinite(n) || n < 7 || n > 13) {
        setMessage("❌ Please select a valid Year Group (7 to 13).");
        return;
      }
    }

    setLoading(true);

    try {
      console.log("Sending register request");

      const payload: any = {
        email,
        password,
        firstName,
        lastName,
        userType,
        schoolName: schoolName || null,
      };

      // ✅ send yearGroup only for students
      if (userType === "student") {
        payload.yearGroup = Number(yearGroup);
        // (optional) if your backend later supports explicit stageKey, we can also send it
        // payload.stageKey = (deriveStageKeyFromYearGroup(yearGroup) || "").toLowerCase();
      }

      if (userType === "parent" && linkedStudentEmail.trim()) {
        payload.linkedStudentEmail = linkedStudentEmail.trim();
      }

      const response = await axios.post(`${API_BASE}/api/auth/register`, payload);

      console.log("Register success:", response.data);

      const backendMsg =
        response.data?.message ||
        response.data?.msg ||
        "Registration successful! Please check your email to verify your account.";

      // ✅ store selectedStage locally for your current browse gating
      if (userType === "student") {
        const stage = deriveStageKeyFromYearGroup(yearGroup);
        if (stage) localStorage.setItem("selectedStage", stage);
        localStorage.setItem("selectedYearGroup", String(yearGroup));
      }

      setMessage(`🎉 ${backendMsg}`);
      setLoading(false);
    } catch (err: any) {
      console.error("Register error:", err);

      let msg = "Registration failed. ";

      if (!err.response) {
        msg += "Cannot connect to backend.";
      } else {
        msg +=
          err.response?.data?.message ||
          err.response?.data?.msg ||
          "Server error.";
      }

      setMessage(msg);
      setLoading(false);
    }
  };

  const isParent = userType === "parent";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div
          style={{
            background: "white",
            padding: "40px",
            borderRadius: "15px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "600px",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "#333",
            }}
          >
            Create an Account
          </h2>

          {backendStatus && (
            <div
              style={{
                textAlign: "center",
                marginBottom: "20px",
                padding: "8px",
                background: backendStatus.includes("✅") ? "#d4edda" : "#f8d7da",
                color: backendStatus.includes("✅") ? "#155724" : "#721c24",
                borderRadius: "5px",
                fontSize: "0.9rem",
              }}
            >
              {backendStatus}
            </div>
          )}

          {message && (
            <div
              style={{
                background: message.includes("🎉") ? "#d4edda" : "#fee",
                color: message.includes("🎉") ? "#155724" : "#c00",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #fcc",
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleRegister}>
            {/* First name */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
                placeholder="First name"
              />
            </div>

            {/* Last name */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
                placeholder="Last name"
              />
            </div>

            {/* Role selection */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>I am a...</label>
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value as UserType)}
                style={{ ...inputStyle, background: "white" }}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent / Guardian</option>
              </select>
            </div>

            {/* ✅ NEW: Year Group (students only) */}
            {userType === "student" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Year Group</label>
                <select
                  value={yearGroup}
                  onChange={(e) => setYearGroup(e.target.value)}
                  required
                  style={{ ...inputStyle, background: "white" }}
                >
                  <option value="">Select year group…</option>
                  <option value="7">Year 7 (KS3)</option>
                  <option value="8">Year 8 (KS3)</option>
                  <option value="9">Year 9 (KS3)</option>
                  <option value="10">Year 10 (GCSE)</option>
                  <option value="11">Year 11 (GCSE)</option>
                  <option value="12">Year 12 (A-level)</option>
                  <option value="13">Year 13 (A-level)</option>
                </select>

                {stageLabel ? (
                  <p style={{ marginTop: 6, fontSize: "0.9rem", color: "#555" }}>
                    Your level will be set to: <b>{stageLabel}</b>
                  </p>
                ) : null}
              </div>
            )}

            {/* School name */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>School Name</label>
              <input
                type="text"
                required={userType === "student" || userType === "teacher"}
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                style={inputStyle}
                placeholder="School name (for verification)"
              />
            </div>

            {/* Linked student email for parents */}
            {isParent && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Student’s Email (linked account)</label>
                <input
                  type="email"
                  required
                  value={linkedStudentEmail}
                  onChange={(e) => setLinkedStudentEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="student@example.com"
                />
                <p style={{ marginTop: "6px", fontSize: "0.85rem", color: "#555" }}>
                  This links your parent account to an existing student so their details stay private.
                </p>
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Your Email (for login & verification)</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={eyeButtonStyle}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  👁
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: "24px" }}>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="Re-enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  style={eyeButtonStyle}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  👁
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px",
                background: loading ? "#999" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Registering..." : "Register"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#007bff", fontWeight: "bold" }}>
              Login here
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontWeight: "bold",
  color: "#333",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "2px solid #e2e8f0",
  borderRadius: "6px",
  fontSize: "1rem",
};

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: "50%",
  transform: "translateY(-50%)",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: "1rem",
};

export default RegisterPage;
