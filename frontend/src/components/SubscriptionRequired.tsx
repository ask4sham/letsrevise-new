import React from "react";
import { useNavigate } from "react-router-dom";

interface SubscriptionRequiredProps {
  message?: string;
  compact?: boolean;
}

const SubscriptionRequired: React.FC<SubscriptionRequiredProps> = ({
  message,
  compact = false,
}) => {
  const navigate = useNavigate();

  const padding = compact ? "1rem" : "1.5rem";
  const titleSize = compact ? "1.125rem" : "1.25rem";
  const bodySize = compact ? "0.875rem" : "1rem";

  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding,
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        textAlign: "center",
        maxWidth: "500px",
        margin: "0 auto",
      }}
    >
      <h2
        style={{
          fontSize: titleSize,
          fontWeight: "bold",
          marginBottom: compact ? "0.5rem" : "0.75rem",
          color: "#333",
        }}
      >
        Subscription required
      </h2>

      {message ? (
        <p
          style={{
            fontSize: bodySize,
            color: "#666",
            marginBottom: compact ? "0.75rem" : "1rem",
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>
      ) : (
        <p
          style={{
            fontSize: bodySize,
            color: "#666",
            marginBottom: compact ? "0.75rem" : "1rem",
            lineHeight: 1.5,
          }}
        >
          This feature is available with an active subscription.
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => navigate("/subscription")}
          style={{
            padding: compact ? "0.5rem 1rem" : "0.625rem 1.25rem",
            backgroundColor: "#1976d2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            fontSize: compact ? "0.875rem" : "0.9375rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background-color 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1565c0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#1976d2";
          }}
        >
          View plans
        </button>

        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: compact ? "0.5rem 1rem" : "0.625rem 1.25rem",
            backgroundColor: "transparent",
            color: "#666",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontSize: compact ? "0.875rem" : "0.9375rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "background-color 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f5f5f5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
};

export default SubscriptionRequired;
