// frontend/src/pages/SettingsPage.tsx
// PR-AUTH-UI-2: use useCurrentUser (no direct localStorage auth reads).
import React, { useState } from "react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import api from "../services/api";
import { updateUser } from "../utils/authStorage";
import { validatePasswordStrength, PASSWORD_GUIDANCE } from "../utils/passwordStrength";

const SettingsPage: React.FC = () => {
  const { user, refresh } = useCurrentUser({ watchLocation: true });
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [emailForm, setEmailForm] = useState({ currentPassword: "", newEmail: "" });
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  return (
    <div
      style={{
        minHeight: "70vh",
        background: "#f8fafc",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem", color: "#111827" }}>
          Settings
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
          Manage your account preferences and basic profile details.
        </p>

        {/* Basic account info card */}
        <div
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e5e7eb",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              marginBottom: "1rem",
              color: "#111827",
              fontWeight: 600,
            }}
          >
            Account
          </h2>

          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ color: "#4b5563" }}>
              <strong>Name:</strong>{" "}
              {user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "—"}
            </div>
            <div style={{ color: "#4b5563" }}>
              <strong>Email:</strong> {user?.email || "—"}
            </div>
            <div style={{ color: "#4b5563" }}>
              <strong>Role:</strong> {user?.userType || "—"}
            </div>
            {user?.institution && (
              <div style={{ color: "#4b5563" }}>
                <strong>School:</strong> {user.institution}
              </div>
            )}
          </div>

          <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "#6b7280" }}>
            To change your name or school, use the <strong>My Profile</strong> page.
          </p>
        </div>

        {/* Change password */}
        <div
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e5e7eb",
            marginBottom: "24px",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#111827", fontWeight: 600 }}>
            Change password
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>{PASSWORD_GUIDANCE}</p>
          {pwMsg && (
            <div style={{ padding: "12px", marginBottom: "1rem", background: pwMsg.type === "success" ? "#d1fae5" : "#fee2e2", color: pwMsg.type === "success" ? "#065f46" : "#991b1b", borderRadius: 8 }}>
              {pwMsg.text}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (pwForm.newPassword !== pwForm.confirm) {
                setPwMsg({ type: "error", text: "New passwords do not match." });
                return;
              }
              const pwCheck = validatePasswordStrength(pwForm.newPassword);
              if (!pwCheck.valid) {
                setPwMsg({ type: "error", text: pwCheck.msg || "Password does not meet strength requirements." });
                return;
              }
              setPwLoading(true);
              setPwMsg(null);
              try {
                await api.put("/auth/me/password", { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
                setPwMsg({ type: "success", text: "Password updated successfully." });
                setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
              } catch (err: unknown) {
                const ax = err as { response?: { data?: { msg?: string } } };
                setPwMsg({ type: "error", text: ax?.response?.data?.msg || "Failed to update password." });
              } finally {
                setPwLoading(false);
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: 400 }}
          >
            <input
              type="password"
              placeholder="Current password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
              required
              style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            />
            <input
              type="password"
              placeholder="New password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
              required
              minLength={8}
              style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={pwForm.confirm}
              onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
              required
              minLength={8}
              style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            />
            <button type="submit" disabled={pwLoading} style={{ padding: "10px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: pwLoading ? "not-allowed" : "pointer" }}>
              {pwLoading ? "Updating..." : "Update password"}
            </button>
          </form>
        </div>

        {/* Change email */}
        <div
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", color: "#111827", fontWeight: 600 }}>
            Change email
          </h2>
          {emailMsg && (
            <div style={{ padding: "12px", marginBottom: "1rem", background: emailMsg.type === "success" ? "#d1fae5" : "#fee2e2", color: emailMsg.type === "success" ? "#065f46" : "#991b1b", borderRadius: 8 }}>
              {emailMsg.text}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setEmailLoading(true);
              setEmailMsg(null);
              try {
                const res = await api.put("/auth/me/email", { currentPassword: emailForm.currentPassword, newEmail: emailForm.newEmail });
                const data = res?.data;
                if (data?.user) {
                  updateUser({ ...user, ...data.user });
                  refresh();
                }
                setEmailMsg({ type: "success", text: data?.msg || "Email updated. Use the new email to sign in next time." });
                setEmailForm({ currentPassword: "", newEmail: "" });
              } catch (err: unknown) {
                const ax = err as { response?: { data?: { msg?: string } } };
                setEmailMsg({ type: "error", text: ax?.response?.data?.msg || "Failed to update email." });
              } finally {
                setEmailLoading(false);
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: 400 }}
          >
            <div style={{ position: "relative" }}>
              <input
                type={showEmailPassword ? "text" : "password"}
                placeholder="Current password"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm((p) => ({ ...p, currentPassword: e.target.value }))}
                required
                style={{ padding: "10px 12px", paddingRight: 40, border: "1px solid #d1d5db", borderRadius: 8, width: "100%", boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => setShowEmailPassword((p) => !p)}
                aria-label={showEmailPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                  padding: 4,
                }}
              >
                {showEmailPassword ? "🙈" : "👁"}
              </button>
            </div>
            <input
              type="email"
              placeholder="New email"
              value={emailForm.newEmail}
              onChange={(e) => setEmailForm((p) => ({ ...p, newEmail: e.target.value }))}
              required
              style={{ padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 8 }}
            />
            <button type="submit" disabled={emailLoading} style={{ padding: "10px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontWeight: 600, cursor: emailLoading ? "not-allowed" : "pointer" }}>
              {emailLoading ? "Updating..." : "Update email"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
