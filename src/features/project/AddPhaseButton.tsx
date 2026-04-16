import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar, Loader2 } from 'lucide-react'
import { phasesRepo } from '@/repos/phases'
import { activityRepo } from '@/repos/activity'

export interface AddPhaseButtonProps {
  projectId: string
  moduleId: string | null
  nextNumber: number
}

export function AddPhaseButton({ projectId, moduleId, nextNumber }: AddPhaseButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [setCurrent, setSetCurrent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        close()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') {
        const root = containerRef.current
        if (!root) return
        const focusables = root.querySelectorAll<HTMLElement>(
          'input, button, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // Defer focus to allow animation
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 40)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    setOpen(false)
    setError(null)
  }

  function reset() {
    setName('')
    setTargetDate('')
    setSetCurrent(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await phasesRepo.create(projectId, moduleId, nextNumber, trimmed, {
        targetDate: targetDate || null,
        setCurrent
      })
      await activityRepo.log(projectId, 'phase_created', {
        name: trimmed,
        number: nextNumber
      })
      reset()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create phase')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-card/20 px-4 py-4 text-[12.5px] font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-px hover:border-foreground/25 hover:bg-card/40 hover:text-foreground hover:shadow-[0_1px_0_rgba(255,255,255,0.02)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)]"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 bg-secondary/40 text-muted-foreground transition-colors group-hover:border-foreground/25 group-hover:text-foreground">
          <Plus className="h-3 w-3" />
        </span>
        Add phase
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-label="Add phase"
            className="absolute left-1/2 top-full z-40 mt-2 w-[340px] -translate-x-1/2 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-3.5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl"
          >
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  Name
                </label>
                <input
                  ref={firstInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Phase ${nextNumber} — Foundation`}
                  className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
                  Target date
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full rounded-lg border border-border/60 bg-background/60 py-2 pl-8 pr-3 text-[12.5px] text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10 [color-scheme:dark]"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer select-none items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 transition-colors hover:bg-background/60">
                <input
                  type="checkbox"
                  checked={setCurrent}
                  onChange={(e) => setSetCurrent(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border/70 bg-background accent-foreground"
                />
                <span className="text-[12px] text-foreground">Set as current phase</span>
              </label>

              {error && (
                <div className="rounded-md border border-red-500/25 bg-red-500/10 px-2.5 py-1.5 text-[11.5px] text-red-200/90">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-transparent px-2.5 py-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 bg-foreground/10 px-3 py-1.5 text-[11.5px] font-semibold text-foreground transition-colors hover:bg-foreground/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Create phase
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
