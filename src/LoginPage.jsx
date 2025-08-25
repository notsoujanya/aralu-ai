// src/LoginPage.jsx
import React, { useState } from "react";
import "./LoginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function handleEmailChange(e) {
    const newEmail = e.target.value;
    setEmail(newEmail);
    if (newEmail.length > 0 && !emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }

  function handlePasswordChange(e) {
    const newPassword = e.target.value;
    setPassword(newPassword);

    if (!isLogin) {
      if (newPassword.length < 8) {
        setPasswordError("Password must be at least 8 characters long.");
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError("");
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");
    setEmailError("");
    setPasswordError("");
    setIsLoading(true);

    // Hardcoded auth check
    if (isLogin) {
      if (email === "chrisma@gmail.com" && password === "12345678") {
        localStorage.setItem("userId", "1"); // fake userId
        setMessage("Login successful!");
        window.location.href = "/";
      } else {
        setMessage("Invalid email or password.");
      }
    } else {
      // Simulate signup success (no backend)
      if (password.length < 8) {
        setPasswordError("Password must be at least 8 characters long.");
      } else {
        setMessage("Account created! You can now log in.");
        setIsLogin(true);
      }
    }

    setIsLoading(false);
  }

  return (
    <div className="container">
      <div className="info-section">
        <h1 className="title">ARALUAI</h1>
        <p className="description">
          Your personal period and mood tracker — predicting cycles, logging emotions,
          and giving you a beautiful “wrapped” view at the end of each month.
          Simple, accurate, and private.
        </p>
      </div>

      <div className="form-section">
        <div className="form-card">
          <h2>{isLogin ? "Login" : "Sign Up"}</h2>
          <form onSubmit={handleAuth}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={handleEmailChange}
              required
              className={emailError ? "input-error" : ""}
            />
            {emailError && <p className="error-message">{emailError}</p>}

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              required
              className={passwordError ? "input-error" : ""}
            />
            {passwordError && <p className="error-message">{passwordError}</p>}

            <button
              type="submit"
              disabled={isLoading || emailError || (!isLogin && passwordError)}
            >
              {isLoading ? (isLogin ? "Logging in..." : "Signing Up...") : (isLogin ? "Login" : "Sign Up")}
            </button>
          </form>

          <p className="toggle-text">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <span
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail("");
                setPassword("");
                setMessage("");
                setEmailError("");
                setPasswordError("");
              }}
            >
              {isLogin ? " Sign Up" : " Login"}
            </span>
          </p>

          {message && <p className="message">{message}</p>}
        </div>
      </div>
    </div>
  );
}





