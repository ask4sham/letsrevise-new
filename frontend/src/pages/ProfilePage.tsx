import React from "react";
import { Link, useParams } from "react-router-dom";

const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <Link to="/admin" style={{ color: "#667eea", textDecoration: "none" }}>
        ← Back to Admin Dashboard
      </Link>

      <div
        style={{
          marginTop: 20,
          background: "white",
          padding: 30,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h1 style={{ marginTop: 0 }}>User Profile</h1>

        <p style={{ color: "#555" }}>
          This page fixes the Admin <strong>View</strong> action so it no longer shows a 404.
        </p>

        <div
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
          }}
        >
          <strong>User ID:</strong>
          <div style={{ fontFamily: "monospace", marginTop: 6 }}>{id}</div>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 10,
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            color: "#9a3412",
          }}
        >
          Backend user detail endpoint is not wired yet.
          <br />
          This page exists to prevent 404 errors and can be enhanced later.
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
