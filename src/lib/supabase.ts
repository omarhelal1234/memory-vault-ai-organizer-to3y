import { createClient } from '@supabase/supabase-js';

// Expo only exposes env vars prefixed with EXPO_PUBLIC_ to client code.
// These are safe to ship: the anon key is a public, RLS-gated credential.
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file (see .env.example).'
  );
}

if (
  SUPABASE_URL === 'https://your-project-ref.supabase.co' ||
  SUPABASE_ANON_KEY === 'your-anon-key-here'
) {
  throw new Error(
    'Please replace placeholder values in .env with your actual Supabase credentials.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
