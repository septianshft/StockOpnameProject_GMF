import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Ini adalah "jembatan" yang akan kita pakai setiap kali mau narik/ngubah data
export const supabase = createClient(supabaseUrl, supabaseAnonKey);