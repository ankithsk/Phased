import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export interface AuthState {
  session: Session | null
  loading: boolean
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { session, loading, signInWithEmail, signOut }
}
