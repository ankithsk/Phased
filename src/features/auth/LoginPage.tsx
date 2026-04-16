import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

// Placeholder login — will be replaced by apple-ui-designer.
export function LoginPage() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await signInWithEmail(email)
      setStatus('sent')
    } catch (e: any) {
      setErr(e.message ?? 'Failed to send link')
      setStatus('error')
    }
  }

  return (
    <div className="h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Project Command Center</h1>
          <p className="text-sm text-muted-foreground">Enter your email. We'll send a magic link.</p>
        </div>
        <input
          className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          type="submit"
          className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Send magic link
        </button>
        {status === 'sent' && (
          <p className="text-sm text-emerald-500">Check your email for a sign-in link.</p>
        )}
        {status === 'error' && <p className="text-sm text-destructive">{err}</p>}
      </form>
    </div>
  )
}
