import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { validatePasswordStrength, PASSWORD_GUIDANCE } from "../utils/passwordStrength";
import { getAxiosErrorMessage, getErrorMessageFromData } from "../utils/apiErrorMessage";
import { apiUrl } from "../utils/apiBaseUrl";
import { setAuth } from "../utils/authStorage";
import { useCurrentUser } from "../hooks/useCurrentUser";
import api from "../services/api";

type UserType = "student" | "teacher" | "parent";

function deriveStageKeyFromYearGroup(yearGroup: string) {
  const n = Number(yearGroup);
  if (!Number.isFinite(n)) return "";
  if (n >= 7 && n <= 9) return "KS3";
  if (n >= 10 && n <= 11) return "GCSE";
  if (n >= 12 && n <= 13) return "A-level";
  return "";
}

const COOLDOWN_SEC = 45;
const IS_DEV = process.env.NODE_ENV === "development";

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { refresh } = useCurrentUser({ watchLocation: true });

  const [step, setStep] = useState<"form" | "success">("form");
  const [advancedMode, setAdvancedMode] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [userType, setUserType] = useState<UserType>("student");
  const [linkedStudentEmail, setLinkedStudentEmail] = useState("");
  const [yearGroup, setYearGroup] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /** Dev / health-check: null = not yet probed */
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [successEmail, setSuccessEmail] = useState("");
  const [registeredUserType, setRegisteredUserType] = useState<UserType>("student");
  const [registeredYearGroup, setRegisteredYearGroup] = useState<number | null>(null);
  const [verificationEmailSent, setVerificationEmailSent] = useState(true);
  const [verificationEmailWarning, setVerificationEmailWarning] = useState<string | null>(null);

  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  useEffect(() => {
    if (IS_DEV) checkBackend();
  }, []);

  useEffect(() => {
    if (userType !== "student") setYearGroup("");
  }, [userType]);

  const stageLabel = useMemo(() => {
    if (userType !== "student") return "";
    return deriveStageKeyFromYearGroup(yearGroup);
  }, [userType, yearGroup]);

  const checkBackend = async () => {
    try {
      await axios.get(apiUrl("/api/health"));
      setApiHealthy(true);
    } catch {
      setApiHealthy(false);
    }
  };

  const cooldownActive = Date.now() < cooldownUntil;
  const waitSec = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  const handleResend = async () => {
    const em = successEmail.trim();
    if (!em || resendLoading || cooldownActive) return;
    setResendLoading(true);
    setResendMsg(null);
    try {
      const res = await api.post("/auth/resend-verification", { email: em });
      const data = res?.data ?? {};
      if (data.ok !== false) {
        setResendMsg("A new verification email has been sent.");
        setCooldownUntil(Date.now() + COOLDOWN_SEC * 1000);
      } else {
        setResendMsg(getErrorMessageFromData(data, "Could not send email."));
      }
    } catch (e: unknown) {
      const ax = e as { response?: { data?: Record<string, unknown>; status?: number } };
      const data = ax?.response?.data;
      if (ax?.response?.status === 429 && data?.retryAfterSeconds != null) {
        const s = Number(data.retryAfterSeconds);
        setCooldownUntil(Date.now() + (Number.isFinite(s) ? s : COOLDOWN_SEC) * 1000);
        setResendMsg(String(data.msg || "Please wait before resending."));
      } else {
        setResendMsg(getErrorMessageFromData(data, "Could not send email."));
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleContinueDashboard = () => {
    refresh();
    const ut = registeredUserType;
    if (ut === "student" && registeredYearGroup == null) {
      navigate("/complete-profile", { replace: true });
      return;
    }
    if (ut === "teacher") {
      navigate("/teacher-dashboard", { replace: true });
      return;
    }
    if (ut === "parent") {
      navigate("/parent-dashboard", { replace: true });
      return;
    }
    navigate("/student-dashboard", { replace: true });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match. Please re-enter them.");
      return;
    }

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.valid) {
      setMessage(`❌ ${pwCheck.msg}`);
      return;
    }

    const effectiveType = advancedMode ? userType : "student";

    if (advancedMode && effectiveType === "student" && yearGroup) {
      const n = Number(yearGroup);
      if (!Number.isFinite(n) || n < 7 || n > 13) {
        setMessage("❌ Please select a valid Year Group (7 to 13), or leave it blank to set later.");
        return;
      }
    }

    if (advancedMode && effectiveType === "parent") {
      if (!linkedStudentEmail.trim()) {
        setMessage("❌ Please enter your student’s email to link a parent account.");
        return;
      }
    }

    if (advancedMode && (effectiveType === "student" || effectiveType === "teacher")) {
      if (!schoolName.trim()) {
        // optional in onboarding — allow empty
      }
    }

    setLoading(true);

    try {
      const payload: Record<string, unknown> = {
        email,
        password,
        firstName: firstName.trim(),
        userType: effectiveType,
      };

      if (advancedMode && lastName.trim()) {
        payload.lastName = lastName.trim();
      }

      if (advancedMode && schoolName.trim()) {
        payload.schoolName = schoolName.trim();
      }

      if (advancedMode && effectiveType === "student" && yearGroup) {
        payload.yearGroup = Number(yearGroup);
      }

      if (advancedMode && effectiveType === "parent" && linkedStudentEmail.trim()) {
        payload.linkedStudentEmail = linkedStudentEmail.trim();
      }

      const response = await axios.post(apiUrl("/api/auth/register"), payload);

      const token = response.data?.token;
      const userData = response.data?.user;
      if (token && userData) {
        setAuth(token, userData);
      }
      refresh();

      if (effectiveType === "student" && yearGroup) {
        const stage = deriveStageKeyFromYearGroup(yearGroup);
        if (stage) localStorage.setItem("selectedStage", stage);
        localStorage.setItem("selectedYearGroup", String(yearGroup));
      }

      setSuccessEmail(email.trim());
      setRegisteredUserType(effectiveType);
      const yg = userData?.yearGroup;
      setRegisteredYearGroup(typeof yg === "number" ? yg : yg != null ? Number(yg) : null);
      setVerificationEmailSent(response.data?.verificationEmailSent !== false);
      setVerificationEmailWarning(response.data?.verificationEmailWarning || null);
      setStep("success");
      setLoading(false);
    } catch (err: unknown) {
      console.error("Register error:", err);

      let msg = "Registration failed. ";

      if (!(err as { response?: unknown })?.response) {
        msg += "Cannot connect to backend.";
      } else {
        msg += getAxiosErrorMessage(err, "Server error.");
      }

      setMessage(msg);
      setLoading(false);
    }
  };

  const isParent = advancedMode && userType === "parent";

  if (step === "success") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div
            style={{
              background: "white",
              padding: 40,
              borderRadius: 15,
              boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
              width: "100%",
              maxWidth: 520,
              textAlign: "center",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#111827" }}>
              {verificationEmailSent ? "Check your email" : "Account created"}
            </h2>
            {verificationEmailSent ? (
              <p style={{ color: "#4b5563", lineHeight: 1.6, marginBottom: 8 }}>
                We’ve sent a verification link to <strong>{successEmail}</strong>
              </p>
            ) : (
              <>
                <p style={{ color: "#4b5563", lineHeight: 1.6, marginBottom: 8 }}>
                  We couldn’t send a verification email to <strong>{successEmail}</strong> just now.
                </p>
                <p style={{ color: "#b45309", fontSize: "0.95rem", marginBottom: 16 }}>
                  {verificationEmailWarning ||
                    "Use “Resend email” below once email is configured, or contact support if this keeps happening."}
                </p>
              </>
            )}
            {resendMsg && (
              <p style={{ color: resendMsg.includes("sent") ? "#059669" : "#b45309", fontSize: "0.9rem" }}>{resendMsg}</p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
              <a
                href={`mailto:${encodeURIComponent(successEmail)}`}
                style={{
                  display: "block",
                  padding: "14px 16px",
                  background: "#f3f4f6",
                  color: "#111827",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontWeight: 600,
                  border: "1px solid #e5e7eb",
                }}
              >
                Open email app
              </a>
              <button
                type="button"
                disabled={resendLoading || cooldownActive}
                onClick={() => void handleResend()}
                style={{
                  padding: "14px 16px",
                  background: cooldownActive ? "#9ca3af" : "#2563eb",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: cooldownActive || resendLoading ? "not-allowed" : "pointer",
                }}
              >
                {resendLoading ? "Sending…" : cooldownActive ? `Resend email (${waitSec}s)` : "Resend email"}
              </button>
              <button
                type="button"
                onClick={handleContinueDashboard}
                style={{
                  padding: "14px 16px",
                  background: "#059669",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Continue to dashboard
              </button>
            </div>
            <p style={{ marginTop: 24, fontSize: "0.9rem" }}>
              <Link to="/login" style={{ color: "#2563eb", fontWeight: 600 }}>
                Back to sign in
              </Link>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div
          style={{
            background: "white",
            padding: "40px",
            borderRadius: "15px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            width: "100%",
            maxWidth: "560px",
          }}
        >
          <h2 style={{ textAlign: "center", marginBottom: "8px", color: "#111827" }}>Start learning smarter today</h2>
          <p style={{ textAlign: "center", marginTop: 0, marginBottom: "24px", color: "#6b7280", fontSize: "1rem" }}>
            Free access to lessons, AI tutor, and exam prep
          </p>

          {IS_DEV && apiHealthy !== null && (
            <div
              style={{
                background: apiHealthy ? "#e6f4ea" : "#fce8e8",
                color: apiHealthy ? "#1e7e34" : "#b71c1c",
                padding: "10px",
                borderRadius: "6px",
                marginBottom: "16px",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              {apiHealthy ? "✅ Backend connected" : "❌ Backend unreachable"}
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

          {!advancedMode && (
            <p style={{ textAlign: "center", marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setAdvancedMode(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#2563eb",
                  fontWeight: 600,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Register as teacher or parent
              </button>
            </p>
          )}

          <form onSubmit={handleRegister}>
            {advancedMode && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>I am a…</label>
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
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>First name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
                placeholder="First name"
              />
            </div>

            {advancedMode && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Last name (optional)</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                  placeholder="Last name"
                />
              </div>
            )}

            {advancedMode && userType === "student" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Year group (optional)</label>
                <select
                  value={yearGroup}
                  onChange={(e) => setYearGroup(e.target.value)}
                  style={{ ...inputStyle, background: "white" }}
                >
                  <option value="">Set later in profile…</option>
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

            {advancedMode && (userType === "student" || userType === "teacher") && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>School name (optional)</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  style={inputStyle}
                  placeholder="School name"
                />
              </div>
            )}

            {isParent && (
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Student’s email (linked account)</label>
                <input
                  type="email"
                  required
                  value={linkedStudentEmail}
                  onChange={(e) => setLinkedStudentEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="student@example.com"
                />
                <p style={{ marginTop: "6px", fontSize: "0.85rem", color: "#555" }}>
                  Links your parent account to an existing student account.
                </p>
              </div>
            )}

            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Password</label>
              <p style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: "6px" }}>{PASSWORD_GUIDANCE}</p>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputWithEyeStyle}
                  placeholder="Create a password"
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

            <div style={{ marginBottom: "24px" }}>
              <label style={labelStyle}>Confirm password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={inputWithEyeStyle}
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
                padding: "14px 16px",
                minHeight: 44,
                background: loading ? "#999" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating account…" : "Create free account"}
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

const inputWithEyeStyle: React.CSSProperties = {
  ...inputStyle,
  paddingRight: 44,
};

const eyeButtonStyle: React.CSSProperties = {
  position: "absolute",
  right: 0,
  top: "50%",
  transform: "translateY(-50%)",
  width: 44,
  minWidth: 44,
  height: 44,
  minHeight: 44,
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: "1rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export default RegisterPage;
