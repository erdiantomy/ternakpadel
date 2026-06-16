import React from "react";
import { supabase } from "./lib/supabase.js";
import LiveApp from "./live/LiveApp.jsx";
import AdminConsole from "./admin/AdminConsole.jsx";

export default function App() {
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
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/admin") return <AdminConsole />;
  return <LiveApp />;
}
