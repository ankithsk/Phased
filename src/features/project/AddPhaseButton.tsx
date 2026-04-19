import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Calendar, Loader2, X, Sparkles } from 'lucide-react'
import { phasesRepo } from '@/repos/phases'
import { activityRepo } from '@/repos/activity'

export interface AddPhaseButtonProps {
  projectId: string
  moduleId: string | null
  nextNumber: number
}

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

export function AddPhaseButton({ projectId, moduleId, nextNumber }: AddPhaseButtonProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [setCurrent, setSetCurrent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 90)
    return () => {
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
            key="ap-overlay"
            className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: APPLE_EASE }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
              onClick={close}
              aria-hidden
            />

            {/* Card */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Add phase"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              className="relative w-full overflow-hidden rounded-t-[22px] sm:max-w-[440px] sm:rounded-[22px]"
              style={{
                background:
                  'linear-gradient(180deg, rgba(22,24,30,0.94) 0%, rgba(16,17,22,0.96) 100%)',
                backdropFilter: 'blur(20px) saturate(140%)',
                WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow:
                  '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -12px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-[9px]"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(120, 170, 210, 0.22), rgba(120, 170, 210, 0.06))',
                      boxShadow: 'inset 0 0 0 1px rgba(120, 170, 210, 0.3)'
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-sky-300/90" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-medium tracking-[-0.01em] text-white/90">
                      New phase
                    </span>
                    <span className="text-[11px] text-white/40">
                      Phase {nextNumber}
                      {moduleId ? ' · module-scoped' : ''}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/90"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <form onSubmit={handleSubmit} className="px-6 pb-5">
                <div className="space-y-4">
                  <div>
                    <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/35">
                      Name
                    </div>
                    <input
                      ref={firstInputRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`Phase ${nextNumber} — Foundation`}
                      className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[14px] text-white/90 placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.14] focus:bg-white/[0.05]"
                    />
                  </div>

                  <div>
                    <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-white/35">
                      Target date
                    </div>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.06] bg-white/[0.03] py-2.5 pl-9 pr-3 text-[13px] text-white/90 outline-none transition-colors focus:border-white/[0.14] focus:bg-white/[0.05] [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <label className="flex cursor-pointer select-none items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.1]">
                    <input
                      type="checkbox"
                      checked={setCurrent}
                      onChange={(e) => setSetCurrent(e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-white/80"
                    />
                    <div className="flex-1">
                      <div className="text-[12.5px] font-medium text-white/90">
                        Set as current phase
                      </div>
                      <div className="text-[11.5px] leading-relaxed text-white/45">
                        Replaces the current phase in this scope. Quick Capture will
                        drop into it by default.
                      </div>
                    </div>
                  </label>

                  {error && (
                    <div
                      className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]"
                      style={{
                        background: 'rgba(251, 113, 133, 0.08)',
                        border: '1px solid rgba(251, 113, 133, 0.22)',
                        color: 'rgba(251, 113, 133, 0.95)'
                      }}
                    >
                      <span>{error}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="h-9 rounded-[9px] px-3 text-[12.5px] text-white/65 transition-colors hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-white/[0.1] bg-white/[0.08] px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Create phase
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
