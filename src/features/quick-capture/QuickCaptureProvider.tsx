import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useHotkey } from '@/hooks/useKeyboard'
import { QuickCaptureModal } from './QuickCaptureModal'
import type { ItemType } from '@/types/db'

interface QuickCaptureOptions {
  projectId?: string
  phaseId?: string
  type?: ItemType
}

interface QuickCaptureContextValue {
  open: (opts?: QuickCaptureOptions) => void
  close: () => void
  isOpen: boolean
}

const Ctx = createContext<QuickCaptureContextValue | null>(null)

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [initialProjectId, setInitialProjectId] = useState<string | undefined>()
  const [initialPhaseId, setInitialPhaseId] = useState<string | undefined>()
  const [initialType, setInitialType] = useState<ItemType | undefined>()

  const open: QuickCaptureContextValue['open'] = useCallback((opts) => {
    setInitialProjectId(opts?.projectId)
    setInitialPhaseId(opts?.phaseId)
    setInitialType(opts?.type)
    setIsOpen(true)
  }, [])
  const close = useCallback(() => setIsOpen(false), [])

  useHotkey('cmd+shift+n', (e) => {
    e.preventDefault()
    setIsOpen((v) => !v)
  })

  // Global event from AppShell FAB / Decisions page / command palette. The
  // event can carry a `detail` object mirroring QuickCaptureOptions so the
  // dispatcher can pre-select project + type (e.g. "New decision").
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<QuickCaptureOptions | undefined>
      if (ev.detail) open(ev.detail)
      else setIsOpen(true)
    }
    window.addEventListener('pcc:quick-capture', handler as EventListener)
    return () => window.removeEventListener('pcc:quick-capture', handler as EventListener)
  }, [open])

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
        initialType={initialType}
      />
    </Ctx.Provider>
  )
}

export function useQuickCapture(): QuickCaptureContextValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('QuickCaptureProvider missing')
  return v
}
