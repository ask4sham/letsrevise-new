import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://letsrevise-new.onrender.com";

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [backendStatus, setBackendStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    checkBackend();
  }, []);

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
    setLoading(true);

    try {
      console.log("Sending register request");

      const response = await axios.post(`${API_BASE}/api/auth/register`, {
        email,
        password,

        // REQUIRED by backend
        firstName: "Test",
        lastName: "User",
        userType: "student"
      });

      console.log("Register success:", response.data);

      setMessage("🎉 Registration successful! You can now log in.");
      setLoading(false);
    } catch (err: any) {
      console.error("Register error:", err);

      let msg = "Registration failed. ";

      if (!err.response) msg += "Cannot connect to backend.";
      else msg += err.response?.data?.message || err.response?.data?.msg || "Server error.";

      setMessage(msg);
      setLoading(false);
    }
  };

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
            maxWidth: "500px",
          }}
        >
          <h2 style={{ textAlign: "center", marginBottom: "10px", color: "#333" }}>
            Register Page
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
                background: message.includes("successful") ? "#d4edda" : "#fee",
                color: message.includes("successful") ? "#155724" : "#c00",
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
            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: "30px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "bold",
                  color: "#333",
                }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
                placeholder="Enter password"
              />
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

export default RegisterPage;
