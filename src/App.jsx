import React from "react";
import { supabase } from "./lib/supabase.js";
import LiveApp from "./live/LiveApp.jsx";
import AdminConsole from "./admin/AdminConsole.jsx";
import PublicLeaderboard from "./live/PublicLeaderboard.jsx";

export default function App() {
  // Public, read-only shared leaderboard: /s/<token> — viewable by anyone,
  // no login. Handled before the config gate so a stale token still renders
  // its "not found" state cleanly.
  const rawPath = window.location.pathname.replace(/\/+$/, "");
  const shareMatch = rawPath.match(/^\/s\/([A-Za-z0-9]+)$/);
  if (shareMatch) return <PublicLeaderboard token={shareMatch[1]} />;

  if (!supabase) {
    return (
      <div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif", color: "#a3a3a3", background: "#09090b" }}>
        <p style={{ maxWidth: 320, lineHeight: 1.5 }}>
          Ternak Padel isn’t configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> to connect the backend.
        </p>
      </div>
    );
  }
  const path = rawPath;
  if (path === "/admin") return <AdminConsole />;
  return <LiveApp />;
}
