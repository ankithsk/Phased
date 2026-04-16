import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthGuard } from './features/auth/AuthGuard'
import { projectsRepo } from './repos/projects'
import { useAuth } from './hooks/useAuth'
import { QuickCaptureProvider } from './features/quick-capture/QuickCaptureProvider'

function AuthedShell() {
  const { session, signOut } = useAuth()

  useEffect(() => {
    if (!session) return
    // Idempotent server-side; no-ops if user already has projects.
    projectsRepo.seedStarters().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('seedStarters failed:', err.message ?? err)
    })
  }, [session])

  useEffect(() => {
    const handler = () => {
      signOut().catch(() => {
        /* noop — supabase handles errors internally */
      })
    }
    window.addEventListener('pcc:sign-out', handler as EventListener)
    return () => window.removeEventListener('pcc:sign-out', handler as EventListener)
  }, [signOut])

  return (
    <QuickCaptureProvider>
      <RouterProvider router={router} />
    </QuickCaptureProvider>
  )
}

export default function App() {
  return (
    <AuthGuard>
      <AuthedShell />
    </AuthGuard>
  )
}
