import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Landing } from "./components/Landing";
import { OnboardingWizard } from "./components/OnboardingWizard";
import { Dashboard } from "./components/Dashboard";
import "./design-system/globals.css";

type View = "landing" | "onboarding" | "dashboard";

function App() {
  const [view, setView] = useState<View>("landing");
  const [user, setUser] = useState<{ login: string } | null>(null);

  // Check for session token in URL or session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionToken = params.get("session");
    if (sessionToken) {
      // Verify session and clean URL
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

  function handleShowDemo() {
    setView("dashboard");
  }

  function handleOnboardingComplete() {
    setView("dashboard");
  }

  return (
    <>
      {view === "landing" && <Landing onShowDemo={handleShowDemo} />}
      {view === "onboarding" && <OnboardingWizard onComplete={handleOnboardingComplete} />}
      {view === "dashboard" && <Dashboard user={user} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
