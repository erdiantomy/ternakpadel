import React from "react";
import { supabase } from "./lib/supabase.js";
import DemoApp from "./DemoApp.jsx";
import LiveApp from "./live/LiveApp.jsx";
import AdminConsole from "./admin/AdminConsole.jsx";

export default function App() {
  if (!supabase) return <DemoApp />;
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/admin") return <AdminConsole />;
  return <LiveApp />;
}
