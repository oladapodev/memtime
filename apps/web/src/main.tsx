import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./components/Landing";
import { Dashboard } from "./components/Dashboard";
import "./design-system/globals.css";

type View = "landing" | "dashboard";

function App() {
  const [view, setView] = useState<View>("landing");
  const [user, setUser] = useState<{ login: string } | null>(null);

  // Check for session token in URL — redirect from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get("session");
    if (sessionToken) {
      fetch(`/api/auth/session?token=${sessionToken}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.authenticated) {
            setUser({ login: data.login });
            setView("dashboard");
            window.history.replaceState({}, "", "/");
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <>
      {view === "landing" && <Landing />}
      {view === "dashboard" && <Dashboard user={user} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
