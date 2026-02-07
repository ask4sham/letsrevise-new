import React, { useState } from "react";
import axios from "axios";

const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    userType: "student",
    firstName: "",
    lastName: "",
    institution: "",
    referredByCode: ""
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const response = await axios.post("http://localhost:5000/api/auth/register", formData);
      setMessage(`✅ ${response.data.message}`);
      console.log("Registration successful:", response.data);
    } catch (error: any) {
      setMessage(`❌ Error: ${error.response?.data?.error || error.message}`);
      console.error("Registration error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px", margin: "0 auto", padding: "20px" }}>
      <h2>Register for LetsLevise</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px" }}>
          <label>User Type:</label>
          <select 
            name="userType" 
            value={formData.userType}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>First Name:</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label>Last Name:</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
            style={{ width: "100%", padding: "8px" }}
          />
        </div>

        {formData.userType === "teacher" && (
          <div style={{ marginBottom: "15px" }}>
            <label>Institution/School:</label>
            <input
              type="text"
              name="institution"
              value={formData.institution}
              onChange={handleChange}
              required
              style={{ width: "100%", padding: "8px" }}
            />
          </div>
        )}

        <div style={{ marginBottom: "15px" }}>
          <label>Referral Code (optional):</label>
          <input
            type="text"
            name="referredByCode"
            value={formData.referredByCode}
            onChange={handleChange}
            style={{ width: "100%", padding: "8px" }}
            placeholder="Enter teacher's referral code"
          />
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          style={{ 
            width: "100%", 
            padding: "10px", 
            backgroundColor: "#4CAF50", 
            color: "white", 
            border: "none", 
            cursor: "pointer" 
          }}
        >
          {isLoading ? "Registering..." : "Register"}
        </button>
      </form>

      {message && (
        <div style={{ 
          marginTop: "20px", 
          padding: "10px", 
          backgroundColor: message.includes("✅") ? "#d4edda" : "#f8d7da",
          border: message.includes("✅") ? "1px solid #c3e6cb" : "1px solid #f5c6cb",
          borderRadius: "4px"
        }}>
          {message}
        </div>
      )}

      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <p><strong>Note:</strong> This is using test API endpoints. Real authentication will be implemented next.</p>
      </div>
    </div>
  );
};

export default RegisterForm;
