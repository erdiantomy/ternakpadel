import React from "react";
import { supabase } from "./lib/supabase.js";
import DemoApp from "./DemoApp.jsx";
import LiveApp from "./live/LiveApp.jsx";

export default function App() {
  return supabase ? <LiveApp /> : <DemoApp />;
}
