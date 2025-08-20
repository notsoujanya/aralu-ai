// src/App.jsx
import React, { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import TrackerPage from "./TrackerPage";

export default function App() {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (storedUserId) {
      setUserId(storedUserId);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return null; 
  }

  return userId ? <TrackerPage userId={userId} /> : <LoginPage />;
}





