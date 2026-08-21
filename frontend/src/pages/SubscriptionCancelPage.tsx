import React from "react";
import { Link } from "react-router-dom";

const SubscriptionCancelPage: React.FC = () => (
  <div style={{ padding: "2rem", maxWidth: 640, margin: "0 auto" }}>
    <h1 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>Checkout cancelled</h1>
    <p style={{ lineHeight: 1.6, color: "#444" }}>
      You did not complete LetsRevise Pro checkout. No payment was taken and your account has not changed.
    </p>
    <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
      <Link
        to="/subscription"
        style={{
          padding: "0.75rem 1.25rem",
          backgroundColor: "#1976d2",
          color: "white",
          borderRadius: 4,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        Try again
      </Link>
      <Link
        to="/student-dashboard"
        style={{
          padding: "0.75rem 1.25rem",
          border: "1px solid #ddd",
          borderRadius: 4,
          textDecoration: "none",
          color: "#333",
          fontWeight: 600,
        }}
      >
        Back to dashboard
      </Link>
    </div>
  </div>
);

export default SubscriptionCancelPage;
