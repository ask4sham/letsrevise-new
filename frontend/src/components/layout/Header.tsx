// /frontend/src/components/layout/Header.tsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getTrialDaysRemaining } from "../../utils/trial";

const Header: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Always re-check auth on route change (HashRouter navigation changes location)
  // This prevents "Dashboard" click from behaving like you're logged out.
  useEffect(() => {
    const syncAuthFromStorage = () => {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");

      if (token && userStr) {
        setIsLoggedIn(true);
        try {
          setUser(JSON.parse(userStr));
        } catch (err) {
          console.error("Error parsing user data:", err);
          setUser(null);
          setIsLoggedIn(false);
        }
      } else {
        setIsLoggedIn(false);
        setUser(null);
      }
    };

    syncAuthFromStorage();
    setShowDropdown(false); // close dropdown when navigating
  }, [location.pathname, location.search, location.hash]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsLoggedIn(false);
    setUser(null);
    setShowDropdown(false);
    navigate("/");
  };

  const getUserInitials = () => {
    if (!user) return "U";
    const { firstName, lastName } = user;
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "U";
  };

  const trialDaysRemaining = getTrialDaysRemaining(user?.entitlements); // Phase D banner will use this

  const isParent = user?.userType === "parent";
  const dashboardLink = isParent ? "/parent-dashboard" : "/dashboard";

  return (
    <header
      style={{
        background: "white",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        padding: "0 20px",
        position: "sticky",
        top: 0,
        zIndex: 1000,
      }}
    >
      {trialDaysRemaining !== null && (
        <div style={{ padding: "4px 0", textAlign: "center", fontSize: "0.85rem", color: "#111827" }}>
          {trialDaysRemaining === 0
            ? "Trial ends today"
            : `Trial ends in ${trialDaysRemaining} day(s)`}
        </div>
      )}
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "70px",
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            textDecoration: "none",
            color: "#333",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "12px",
              fontWeight: "bold",
              fontSize: "1.2rem",
            }}
          >
            LR
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#333",
              }}
            >
              {/* ✅ spelling fixed here */}
              LetsRevise
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#666",
                letterSpacing: "1px",
              }}
            >
              UK LEARNING PLATFORM
            </p>
          </div>
        </Link>

        {/* Navigation */}
        <nav>
          <ul
            style={{
              display: "flex",
              listStyle: "none",
              margin: 0,
              padding: 0,
              gap: "30px",
              alignItems: "center",
            }}
          >
            {isLoggedIn ? (
              <>
                {/* ✅ Parent goes to /parent-dashboard, everyone else to /dashboard */}
                <li>
                  <Link
                    to={dashboardLink}
                    style={{
                      color: "#667eea",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                      padding: "8px 16px",
                      borderRadius: "4px",
                      transition: "all 0.3s ease",
                    }}
                  >
                    Dashboard
                  </Link>
                </li>

                {/* ✅ STUDENT LINKS (hide from parent) */}
                {!isParent && user?.userType === "student" && (
                  <>
                    <li>
                      <Link
                        to="/progress"
                        style={{
                          color: "#667eea",
                          textDecoration: "none",
                          fontWeight: "500",
                          fontSize: "1rem",
                          padding: "8px 16px",
                          borderRadius: "4px",
                          transition: "all 0.3s ease",
                        }}
                      >
                        My Progress
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/lessons"
                        style={{
                          color: "#667eea",
                          textDecoration: "none",
                          fontWeight: "500",
                          fontSize: "1rem",
                          padding: "8px 16px",
                          borderRadius: "4px",
                          transition: "all 0.3s ease",
                        }}
                      >
                        Browse Lessons
                      </Link>
                    </li>
                  </>
                )}

                {/* ✅ TEACHER LINKS (hide from parent) */}
                {!isParent && user?.userType === "teacher" && (
                  <>
                    <li>
                      <Link
                        to="/create-lesson"
                        style={{
                          color: "#667eea",
                          textDecoration: "none",
                          fontWeight: "500",
                          fontSize: "1rem",
                          padding: "8px 16px",
                          borderRadius: "4px",
                          transition: "all 0.3s ease",
                        }}
                      >
                        Create Lesson
                      </Link>
                    </li>
                    <li>
                      <Link
                        to="/payouts"
                        style={{
                          color: "#667eea",
                          textDecoration: "none",
                          fontWeight: "500",
                          fontSize: "1rem",
                          padding: "8px 16px",
                          borderRadius: "4px",
                          transition: "all 0.3s ease",
                        }}
                      >
                        Payouts
                      </Link>
                    </li>
                  </>
                )}

                {/* ✅ ADMIN LINK (hide from parent) */}
                {!isParent && user?.userType === "admin" && (
                  <li>
                    <Link
                      to="/admin"
                      style={{
                        color: "#667eea",
                        textDecoration: "none",
                        fontWeight: "500",
                        fontSize: "1rem",
                        padding: "8px 16px",
                        borderRadius: "4px",
                        transition: "all 0.3s ease",
                      }}
                    >
                      Admin Dashboard
                    </Link>
                  </li>
                )}

                {/* ✅ Subscription (hide from parent) */}
                {!isParent && (
                  <li>
                    <Link
                      to="/subscription"
                      style={{
                        color: "#667eea",
                        textDecoration: "none",
                        fontWeight: "500",
                        fontSize: "1rem",
                        padding: "8px 16px",
                        borderRadius: "4px",
                        transition: "all 0.3s ease",
                      }}
                    >
                      Subscription
                    </Link>
                  </li>
                )}

                {/* User Profile Dropdown (keep, but hide Settings for parent) */}
                <li style={{ position: "relative" }}>
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      border: "none",
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "1rem",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {getUserInitials()}
                  </button>

                  {showDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        top: "50px",
                        right: 0,
                        background: "white",
                        boxShadow: "0 5px 20px rgba(0,0,0,0.15)",
                        borderRadius: "8px",
                        minWidth: "200px",
                        zIndex: 1001,
                      }}
                    >
                      <div
                        style={{
                          padding: "20px",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <div style={{ fontWeight: "bold", color: "#333" }}>
                          {user?.firstName} {user?.lastName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "#667eea",
                            marginTop: "4px",
                          }}
                        >
                          {user?.userType?.toUpperCase()}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#666",
                            marginTop: "8px",
                          }}
                        >
                          {user?.email}
                        </div>
                      </div>

                      <div style={{ padding: "10px 0" }}>
                        {/* ✅ Parent: “My Profile” is enough */}
                        <Link
                          to="/profile"
                          style={{
                            display: "block",
                            padding: "10px 20px",
                            color: "#333",
                            textDecoration: "none",
                            fontSize: "0.875rem",
                            transition: "all 0.3s ease",
                          }}
                          onClick={() => setShowDropdown(false)}
                        >
                          👤 My Profile
                        </Link>

                        {/* ✅ Settings hidden for parent */}
                        {!isParent && (
                          <Link
                            to="/settings"
                            style={{
                              display: "block",
                              padding: "10px 20px",
                              color: "#333",
                              textDecoration: "none",
                              fontSize: "0.875rem",
                              transition: "all 0.3s ease",
                            }}
                            onClick={() => setShowDropdown(false)}
                          >
                            ⚙️ Settings
                          </Link>
                        )}

                        <button
                          onClick={handleLogout}
                          style={{
                            width: "100%",
                            padding: "10px 20px",
                            background: "none",
                            border: "none",
                            color: "#dc3545",
                            textAlign: "left",
                            cursor: "pointer",
                            fontSize: "0.875rem",
                            transition: "all 0.3s ease",
                          }}
                        >
                          🚪 Logout
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link
                    to="/"
                    style={{
                      color: "#333",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                    }}
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about"
                    style={{
                      color: "#333",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                    }}
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/lessons"
                    style={{
                      color: "#333",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                    }}
                  >
                    Lessons
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pricing"
                    style={{
                      color: "#333",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                    }}
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    to="/login"
                    style={{
                      background:
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      padding: "8px 20px",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                    }}
                  >
                    Login
                  </Link>
                </li>
                <li>
                  <Link
                    to="/register"
                    style={{
                      background: "white",
                      color: "#667eea",
                      padding: "8px 20px",
                      borderRadius: "4px",
                      textDecoration: "none",
                      fontWeight: "500",
                      fontSize: "1rem",
                      border: "2px solid #667eea",
                    }}
                  >
                    Sign Up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>

      {/* Close dropdown when clicking outside */}
      {showDropdown && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  );
};

export default Header;
