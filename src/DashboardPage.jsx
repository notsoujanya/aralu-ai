import React from "react";

export default function DashboardPage({ userId, setView, setUserId }) {
  const userEmail = localStorage.getItem("userEmail");

  const options = [
    { name: "Tracker", view: "tracker", color: "#FFB6B6" }, // soft pastel red
    { name: "Chatbot", view: "chatbot", color: "#F8BBD0" }, // pastel pink
    { name: "Game", view: "game", color: "#FFF3B0" }, // pastel yellow
  ];

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    setUserId(null);
    setView(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "50px",
        fontFamily: "'Segoe UI', sans-serif",
      }}
    >
      {/* Logout button */}
      <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleLogout}
          style={{
            padding: "10px 20px",
            cursor: "pointer",
            borderRadius: "10px",
            border: "none",
            background: "#f28b82",
            color: "#fff",
            fontWeight: "bold",
          }}
        >
          Logout
        </button>
      </div>

      {/* Welcome */}
      <h1 style={{ fontSize: "2.5rem", marginBottom: "10px", color: "#444" }}>
        Welcome{userEmail ? `, ${userEmail}` : ""}!
      </h1>
      <p style={{ fontSize: "1.2rem", marginBottom: "40px", color: "#666" }}>
        Choose an option to continue:
      </p>

      {/* Option cards */}
      <div
        style={{
          display: "flex",
          gap: "30px",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {options.map((option) => (
          <div
            key={option.name}
            onClick={() => setView(option.view)}
            style={{
              backgroundColor: option.color,
              color: "#333",
              padding: "40px 60px",
              borderRadius: "20px",
              cursor: "pointer",
              fontSize: "1.5rem",
              fontWeight: "bold",
              boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
              transition: "transform 0.2s, box-shadow 0.2s",
              textAlign: "center",
              minWidth: "160px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.boxShadow = "0 12px 25px rgba(0,0,0,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)";
            }}
          >
            {option.name}
          </div>
        ))}
      </div>
    </div>
  );
}
