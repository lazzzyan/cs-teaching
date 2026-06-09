const SUPABASE_CONFIG = {
  url: "https://thbnxqrnqvrxhqzaokqp.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoYm54cXJucXZyeGhxemFva3FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjMwMTQsImV4cCI6MjA5NjQ5OTAxNH0.Y2Ads8kYy2nqs7cKM31S95lLUsWvlfSUQnkoYnGt0Es",
};

let supabase = null;

function initSupabase() {
  if (!supabase) {
    const { createClient } = window.supabase;
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }
  return supabase;
}
