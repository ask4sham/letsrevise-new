import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePut } from "../hooks/useApi";
import LoadingSpinner from "../components/LoadingSpinner";
import Toast from "../components/Toast";

interface LocalUser {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  userType?: string;
  shamCoins?: number;
  schoolName?: string;
}

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    schoolName: "",
  });
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  // Uses existing backend route: PUT /api/users/profile
  const { put, loading, error } = usePut("/users/profile", {
    onSuccess: (data: any) => {
      try {
        const existingStr = localStorage.getItem("user");
        const existing = existingStr ? JSON.parse(existingStr) : {};

        const updatedUserFromApi = data?.user || data;
        const updated = { ...existing, ...updatedUserFromApi };

        localStorage.setItem("user", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to update user in localStorage:", e);
      }

      setToast({
        message: data?.msg || "Profile updated successfully.",
        type: "success",
      });

      setTimeout(() => {
        navigate("/profile");
      }, 600);
    },
    onError: (err: any) => {
      const msg =
        typeof err === "string"
          ? err
          : err?.message || "Failed to update profile";
      setToast({ message: msg, type: "error" });
    },
  });

  useEffect(() => {
    const userStr =
      typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (!userStr) {
      navigate("/login");
      return;
    }

    try {
      const user: LocalUser = JSON.parse(userStr);
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        schoolName: user.schoolName || "",
      });
    } catch (e) {
      console.error("Failed to parse user for EditProfilePage:", e);
      navigate("/login");
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await put({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      schoolName: form.schoolName.trim() || null,
    });
  };

  const errorMessage =
    error == null
      ? null
      : typeof error === "string"
      ? error
      : (error as any).message || "An error occurred";

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
        <h1
          style={{
            fontSize: "2rem",
            marginBottom: "0.5rem",
            fontWeight: "bold",
          }}
        >
          Edit Profile
        </h1>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Update your personal details.
        </p>

        {loading && (
          <div style={{ marginBottom: "1rem" }}>
            <LoadingSpinner size="small" text="Saving changes..." />
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              backgroundColor: "#FED7D7",
              color: "#742A2A",
              borderRadius: "6px",
              fontSize: "0.9rem",
            }}
          >
            {errorMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            background: "white",
            padding: "1.75rem",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="firstName"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontWeight: 500,
              }}
            >
              First Name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              value={form.firstName}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E0",
                fontSize: "0.95rem",
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="lastName"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontWeight: 500,
              }}
            >
              Last Name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              value={form.lastName}
              onChange={handleChange}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E0",
                fontSize: "0.95rem",
              }}
              required
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label
              htmlFor="schoolName"
              style={{
                display: "block",
                marginBottom: "0.25rem",
                fontWeight: 500,
              }}
            >
              School
            </label>
            <input
              id="schoolName"
              name="schoolName"
              type="text"
              value={form.schoolName}
              onChange={handleChange}
              placeholder="e.g. Greenfield High School"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E0",
                fontSize: "0.95rem",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/profile")}
              style={{
                padding: "0.6rem 1.2rem",
                borderRadius: "6px",
                border: "1px solid #CBD5E0",
                background: "white",
                cursor: "pointer",
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: "0.6rem 1.5rem",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "#3182ce",
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
              disabled={loading}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </>
  );
};

export default EditProfilePage;
