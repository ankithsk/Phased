import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthGuard } from './features/auth/AuthGuard'
import { projectsRepo } from './repos/projects'
import { useAuth } from './hooks/useAuth'

function AuthedShell() {
  const { session } = useAuth()
  useEffect(() => {
    if (!session) return
    // Idempotent server-side; no-ops if user already has projects.
    projectsRepo.seedStarters().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('seedStarters failed:', err.message ?? err)
    })
  }, [session])
  return <RouterProvider router={router} />
}

export default function App() {
  return (
    <AuthGuard>
      <AuthedShell />
    </AuthGuard>
  )
}
