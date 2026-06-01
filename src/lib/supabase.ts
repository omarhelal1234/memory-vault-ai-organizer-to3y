import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

if (SUPABASE_URL === 'https://your-project-ref.supabase.co' || 
    SUPABASE_ANON_KEY === 'your-anon-key-here') {
  throw new Error(
    'Please replace placeholder values in .env with your actual Supabase credentials.'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);