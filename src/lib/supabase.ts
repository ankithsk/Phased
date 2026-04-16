import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // Surfaced once, loudly, in the browser console so it's not silently confusing.
  // Matches the failure mode in vite when env vars are missing from .env.local.
  // eslint-disable-next-line no-console
  console.error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Populate .env.local at project root.'
  )
  throw new Error('Supabase env vars missing')
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'pcc.auth'
  },
  realtime: {
    params: { eventsPerSecond: 5 }
  }
})
