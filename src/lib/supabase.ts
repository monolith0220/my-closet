import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function makeClient(): SupabaseClient | null {
  if (!url || !anonKey) return null
  try {
    const parsed = new URL(url)
    if (!['https:', 'http:'].includes(parsed.protocol)) return null
    return createClient(url, anonKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
    })
  } catch {
    return null
  }
}

export const supabase = makeClient()
export const isSupabaseConfigured = supabase !== null
