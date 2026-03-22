import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

const ConfirmEmailChangePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    document.title = success === "1" ? "Email changed" : "Confirm email change";
  }, [success]);

  if (success === "1") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
        }}
      >
        <div
          style={{
            background: "white",
            padding: 40,
            borderRadius: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            maxWidth: 440,
            width: "100%",
            textAlign: "center",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 16, color: "#059669", fontSize: "1.5rem" }}>
            Email updated
          </h1>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            Your email address has been changed successfully. Please sign in with your new email.
          </p>
          <Link
            to="/login"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#2563eb",
              color: "white",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const errorMsg =
    error === "missing"
      ? "The confirmation link is missing a token."
      : error === "invalid"
      ? "This link is invalid or has expired. Please request a new email change from Settings."
      : error === "server"
      ? "Something went wrong. Please try again later."
      : "This link could not be processed.";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      }}
    >
      <div
        style={{
          background: "white",
          padding: 40,
          borderRadius: 16,
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          maxWidth: 440,
          width: "100%",
          textAlign: "center",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 16, color: "#dc2626", fontSize: "1.5rem" }}>
          Could not confirm email change
        </h1>
        <p style={{ color: "#6b7280", marginBottom: 24 }}>{errorMsg}</p>
        <Link
          to="/settings"
          style={{
            display: "inline-block",
            padding: "12px 24px",
            background: "#2563eb",
            color: "white",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to Settings
        </Link>
      </div>
    </div>
  );
};

export default ConfirmEmailChangePage;
