import React, { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import DashboardPage from "./DashboardPage";
import TrackerPage from "./TrackerPage";
import ChatbotPage from "./ChatbotPage.jsx";
import GamePage from "./GamePage";

export default function App() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null); // "dashboard", "tracker", "chatbot", "game"

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
      setView("dashboard"); // show dashboard first
    }
    setLoading(false);
  }, []);

  if (loading) return null;

  if (!userId) return <LoginPage setUserId={setUserId} />;

  switch (view) {
    case "tracker":
      return <TrackerPage userId={userId} setView={setView} />;
    case "chatbot":
      return <ChatbotPage setView={setView} />;
    case "game":
      return <GamePage setView={setView} />;
    default:
      return <DashboardPage userId={userId} setView={setView} />;
  }
}






