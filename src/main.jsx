import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

// PWA: register the minimal network-first service worker (production only).
// Registered immediately — waiting for window "load" would queue it behind
// the external font stylesheet on slow connections.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js").catch(() => { /* best-effort */ });
}
