import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useHotkey } from '@/hooks/useKeyboard'
import { QuickCaptureModal } from './QuickCaptureModal'

interface QuickCaptureContextValue {
  open: (opts?: { projectId?: string; phaseId?: string }) => void
  close: () => void
  isOpen: boolean
}

const Ctx = createContext<QuickCaptureContextValue | null>(null)

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>()
  const [initialPhaseId, setInitialPhaseId] = useState<string | undefined>()

  const open: QuickCaptureContextValue['open'] = useCallback((opts) => {
    setInitialProjectId(opts?.projectId)
    setInitialPhaseId(opts?.phaseId)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  useHotkey('cmd+shift+n', (e) => {
    e.preventDefault()
    setIsOpen((v) => !v)
  })

  // Global event from AppShell FAB
  useEffect(() => {
    const handler = () => setIsOpen(true)
    window.addEventListener('pcc:quick-capture', handler as EventListener)
    return () => window.removeEventListener('pcc:quick-capture', handler as EventListener)
  }, [])

  const value = useMemo<QuickCaptureContextValue>(
    () => ({ open, close, isOpen }),
    [open, close, isOpen]
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      <QuickCaptureModal
        open={isOpen}
        onClose={close}
        initialProjectId={initialProjectId}
        initialPhaseId={initialPhaseId}
      />
    </Ctx.Provider>
  )
}

export function useQuickCapture(): QuickCaptureContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('QuickCaptureProvider missing')
  return v
}
