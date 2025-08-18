// src/LoginPage.jsx
import React, { useState } from "react";
import "./LoginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState(""); // New state for password errors
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Handles changes to the email input field and performs basic email validation.
   * @param {Object} e - The event object from the input change.
   */
  function handleEmailChange(e) {
    const newEmail = e.target.value;
    setEmail(newEmail);
    // Clear email error if input is empty or valid, otherwise set error.
    if (newEmail.length > 0 && !emailRegex.test(newEmail)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  }

  /**
   * Handles changes to the password input field and performs basic password validation for sign-up.
   * @param {Object} e - The event object from the input change.
   */
  function handlePasswordChange(e) {
    const newPassword = e.target.value;
    setPassword(newPassword);

    // Password validation only for sign-up mode
    if (!isLogin) {
      if (newPassword.length < 8) {
        setPasswordError("Password must be at least 8 characters long.");
      } else {
        setPasswordError("");
      }
    } else {
      setPasswordError(""); // Clear password error if in login mode
    }
  }

  /**
   * Handles the authentication (login or sign up) process.
   * Performs client-side validation before sending data to the server.
   * @param {Object} e - The event object from the form submission.
   */
  async function handleAuth(e) {
    e.preventDefault();
    setMessage(""); // Clear previous messages
    setEmailError(""); // Clear previous email errors
    setPasswordError(""); // Clear previous password errors
    setIsLoading(true); // Set loading state to true

    let hasError = false;

    // Validate email
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address.");
      hasError = true;
    }

    // Validate password for sign-up
    if (!isLogin && password.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      hasError = true;
    }

    if (hasError) {
      setIsLoading(false); // Stop loading if there are client-side errors
      return;
    }

    const endpoint = isLogin ? "/api/login" : "/api/signup";
    try {
      const response = await fetch(`http://localhost:5001${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle server-side errors
        throw new Error(data.error || `Authentication failed: ${response.statusText}`);
      }

      // Handle successful authentication
      if (isLogin) {
        localStorage.setItem("userId", data.userId);
        window.location.reload(); // Reload for login success
      } else {
        // For sign-up, just show a success message and allow user to switch to login
        setMessage("Account created successfully! You can now log in.");
        setIsLogin(true); // Automatically switch to login form after successful sign-up
      }
      
    } catch (err) {
      setMessage(err.message); // Display error message from catch block
    } finally {
      setIsLoading(false); // Always set loading state to false after request completes
    }
  }

  return (
    <div className="container">
      <div className="info-section">
        <h1 className="title">ARALUAI</h1>
        <p className="description">
          Your personal period and mood tracker — predicting cycles, logging emotions, and giving you
          a beautiful “wrapped” view at the end of each month. Simple, accurate, and private.
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
              // Apply input-error class based on emailError state
              className={emailError ? "input-error" : ""}
            />
            {/* Display email error message if exists */}
            {emailError && <p className="error-message">{emailError}</p>}
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange} // Use new password change handler
              required
              // Apply input-error class based on passwordError state
              className={passwordError ? "input-error" : ""}
            />
            {/* Display password error message if exists */}
            {passwordError && <p className="error-message">{passwordError}</p>}

            <button 
              type="submit" 
              // Disable button when loading or if there are validation errors
              disabled={isLoading || emailError || (!isLogin && passwordError)}
            >
              {isLoading ? (isLogin ? "Logging in..." : "Signing Up...") : (isLogin ? "Login" : "Sign Up")}
            </button>
          </form>
          <p className="toggle-text">
            {isLogin ? "Don't have an account?" : "Already have an account?"}
            <span onClick={() => {
              setIsLogin(!isLogin);
              // Clear all inputs and messages when toggling form type
              setEmail("");
              setPassword("");
              setMessage("");
              setEmailError("");
              setPasswordError("");
            }}>
              {isLogin ? " Sign Up" : " Login"}
            </span>
          </p>
          {message && <p className="message">{message}</p>}
        </div>
      </div>
    </div>
  );
}







