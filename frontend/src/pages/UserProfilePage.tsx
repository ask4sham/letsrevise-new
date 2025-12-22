import React from "react";
import { useNavigate } from "react-router-dom";

const UserProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const userStr =
    typeof window !== "undefined" ? localStorage.getItem("user") : null;

  let user: any = null;
  try {
    user = userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    console.error("Failed to parse user from localStorage:", e);
  }

  if (!user) {
    return (
      <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>My Profile</h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          We couldn&apos;t load your profile details. Try logging out and back
          in.
        </p>
        <button
          onClick={() => navigate("/login")}
          style={{
            padding: "0.75rem 1.5rem",
            backgroundColor: "#1976d2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1
        style={{
          fontSize: "2.5rem",
          marginBottom: "0.5rem",
          fontWeight: "bold",
          textAlign: "center",
        }}
      >
        My Profile
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem", textAlign: "center" }}>
        View your account details and role.
      </p>

      <div
        style={{
          background: "white",
          padding: "1.75rem",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          marginBottom: "1.5rem",
        }}
      >
        <h3
          style={{
            marginBottom: "1.25rem",
            textAlign: "center",
            fontWeight: 600,
          }}
        >
          Account Details
        </h3>
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>Name:</strong> {user.firstName} {user.lastName}
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>Email:</strong> {user.email}
        </div>
        <div style={{ marginBottom: "0.5rem" }}>
          <strong>Role:</strong>{" "}
          {user.userType
            ? user.userType.charAt(0).toUpperCase() + user.userType.slice(1)
            : "Unknown"}
        </div>
        {typeof user.shamCoins === "number" && (
          <div style={{ marginBottom: "0.5rem" }}>
            <strong>ShamCoins:</strong> {user.shamCoins}
          </div>
        )}

        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <button
            onClick={() => navigate("/edit-profile")}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#3182ce",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Edit Profile
          </button>
        </div>
      </div>

      <div
        style={{
          background: "white",
          padding: "1.5rem",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ marginBottom: "0.75rem", textAlign: "center" }}>
          Quick Links
        </h3>
        <p style={{ color: "#666", fontSize: "0.9rem", textAlign: "center" }}>
          Use the navigation at the top to go to your dashboard, subscriptions,
          or browse lessons.
        </p>
      </div>
    </div>
  );
};

export default UserProfilePage;
