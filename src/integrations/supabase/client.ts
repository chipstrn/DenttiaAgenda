import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://lpuowkpsfefxdggoizqx.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwdW93a3BzZmVmeGRnZ29penF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MTU4MzYsImV4cCI6MjA4NDA5MTgzNn0.WKcBllvmbZ_ez_kaG1vqGOW-0_h0Mz3qE49pu87CdcQ";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase URL or Key is missing!");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);