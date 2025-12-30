import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

// ✅ Same backend base URL as LoginPage
const API_BASE = "https://letsrevise-new.onrender.com";

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [backendStatus, setBackendStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Optional: same health check as Login page
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await axios.get(`${API_BASE}/api/health`);
        setBackendStatus("✅ Backend connected");
      } catch {
        setBackendStatus("❌ Backend not connected");
      }
    };

    checkBackend();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      console.log("Attempting registration with:", formData);

      // 🔑 Call the backend register endpoint
      const res = await axios.post(`${API_BASE}/api/auth/register`, formData);

      console.log("Register success:", res.data);

      setSuccess("Registration successful! You can now log in.");
      // small delay so you see the message
      setTimeout(() => {
        navigate("/login");
      }, 1200);
    } catch (err: any) {
      console.error("Register error:", err);

      let msg = "Registration failed. ";

      if (!err.response) {
        msg += "Cannot connect to backend.";
      } else if (err.response.status === 400) {
        // many APIs send validation / duplicate-email errors as 400
        msg += err.response?.data?.msg || "Please check your details.";
      } else if (err.response.status === 409) {
        msg += "That email is already registered. Try logging in.";
      } else {
        msg += err.response?.data?.message || "Server error.";
      }

      setError(msg);
    } finally {
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
          <h2
            style={{
              textAlign: "center",
              marginBottom: "10px",
              color: "#333",
            }}
          >
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

          {error && (
            <div
              style={{
                background: "#fee",
                color: "#c00",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #fcc",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: "#d4edda",
                color: "#155724",
                padding: "12px",
                borderRadius: "8px",
                marginBottom: "20px",
                border: "1px solid #c3e6cb",
              }}
            >
              ✅ {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
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
                name="password"
                required
                value={formData.password}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "6px",
                  fontSize: "1rem",
                }}
                placeholder="Enter a password"
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

          <div style={{ textAlign: "center", marginTop: "30px" }}>
            <p style={{ color: "#666" }}>
              Already have an account?{" "}
              <Link
                to="/login"
                style={{ color: "#007bff", fontWeight: "bold" }}
              >
                Login here
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;
