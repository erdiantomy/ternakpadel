import { createClient } from "@supabase/supabase-js";

// When the env vars are absent the app runs in demo mode (local simulated
// state, no backend) — exactly the original prototype behavior.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
