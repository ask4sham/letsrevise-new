// frontend/src/pages/SettingsPage.tsx
import React from "react";

const SettingsPage: React.FC = () => {
  const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  let user: any = null;

  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse user in SettingsPage:", e);
    }
  }

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

        {/* Placeholder for future settings */}
        <div
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
            border: "1px solid #e5e7eb",
          }}
        >
          <h2
            style={{
              fontSize: "1.25rem",
              marginBottom: "0.75rem",
              color: "#111827",
              fontWeight: 600,
            }}
          >
            Security & Preferences
          </h2>
          <p style={{ color: "#6b7280", marginBottom: "0.75rem" }}>
            More settings (like password change, notifications, etc.) can be added here later.
          </p>
          <ul style={{ color: "#4b5563", paddingLeft: "1.25rem" }}>
            <li>Password & security (coming soon)</li>
            <li>Notification preferences (coming soon)</li>
            <li>Privacy options (coming soon)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
