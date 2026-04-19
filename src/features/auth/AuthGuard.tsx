import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { SecurityGate } from './SecurityGate'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-full grid place-items-center text-muted-foreground text-sm">Loading…</div>
    )
  }
  if (!session) return <SecurityGate />
  return <>{children}</>
}
