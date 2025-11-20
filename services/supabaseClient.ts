
import { createClient } from '@supabase/supabase-js';

// Estes valores virão das variáveis de ambiente da Vercel (.env)
// O vite.config.ts garante que process.env seja preenchido
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

// Exporta o cliente apenas se as chaves existirem, caso contrário retorna null
// Isso evita erros enquanto você ainda está usando LocalStorage
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
