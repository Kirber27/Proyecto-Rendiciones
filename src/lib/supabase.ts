// Cliente único de Supabase, tipado con el esquema generado (npm run db:types).
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !clave) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y complétalo.',
  )
}

export const supabase = createClient<Database>(url, clave, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Permite entrar también con el enlace del correo (además del código).
    detectSessionInUrl: true,
  },
})
