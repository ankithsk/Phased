import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, Loader2, Sparkles, X } from 'lucide-react'
import { projectsRepo } from '@/repos/projects'
import { router } from '@/routes'

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: '#8892a6', label: 'Slate' },
  { value: '#a1a1aa', label: 'Neutral' },
  { value: '#6366f1', label: 'Indigo' },
  { value: '#a855f7', label: 'Violet' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Amber' },
  { value: '#22c55e', label: 'Green' },
  { value: '#14b8a6', label: 'Teal' },
  { value: '#0ea5e9', label: 'Sky' },
  { value: '#3b82f6', label: 'Blue' }
]

export interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateProjectDialog({ open, onClose }: CreateProjectDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<string>(COLOR_PRESETS[2].value)
  const [modulesEnabled, setModulesEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setName('')
    setDescription('')
    setColor(COLOR_PRESETS[2].value)
    setModulesEnabled(false)
    setError(null)
    setSubmitting(false)
    const t = window.setTimeout(() => nameRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (submitting) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the project a name.')
      nameRef.current?.focus()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const project = await projectsRepo.create({
        name: trimmed,
        description: description.trim() || null,
        color,
        modules_enabled: modulesEnabled,
        status: 'active'
      })
      onClose()
      void router.navigate(`/p/${project.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.'
      setError(message)
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cp-overlay"
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: APPLE_EASE }}
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Create project"
            className="relative w-full sm:max-w-[480px] sm:rounded-[22px] rounded-t-[22px] overflow-hidden"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: APPLE_EASE }}
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
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-7 w-7 rounded-[9px] flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${color}55, ${color}18)`,
                    boxShadow: `inset 0 0 0 1px ${color}66`
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-medium text-white/90 tracking-[-0.01em]">
                    New project
                  </span>
                  <span className="text-[11px] text-white/40">
                    You'll add phases and modules from inside the project.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 rounded-full flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-5">
              <div className="space-y-4">
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/35 font-medium mb-1.5">
                    Name
                  </div>
                  <input
                    ref={nameRef}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (error) setError(null)
                    }}
                    placeholder="e.g. AXIS, Quote Engine, Contracts"
                    className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-white/[0.14] focus:bg-white/[0.05] px-3 py-2.5 text-[14px] text-white/90 placeholder:text-white/25 outline-none transition-colors"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/35 font-medium mb-1.5">
                    Description
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional — one line about the project."
                    rows={2}
                    disabled={submitting}
                    className="w-full resize-none rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-white/[0.14] focus:bg-white/[0.05] px-3 py-2.5 text-[13.5px] text-white/90 placeholder:text-white/25 outline-none transition-colors leading-relaxed"
                  />
                </div>

                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/35 font-medium mb-1.5">
                    Accent color
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setColor(c.value)}
                        disabled={submitting}
                        title={c.label}
                        aria-label={c.label}
                        className="group relative h-7 w-7 rounded-full transition-transform"
                        style={{
                          background: c.value,
                          boxShadow:
                            color === c.value
                              ? `0 0 0 2px rgba(0,0,0,0.45), 0 0 0 3.5px ${c.value}`
                              : 'inset 0 0 0 1px rgba(255,255,255,0.08)'
                        }}
                      >
                        {color === c.value && (
                          <Check className="absolute inset-0 m-auto h-3 w-3 text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 cursor-pointer hover:border-white/[0.1] transition-colors">
                  <input
                    type="checkbox"
                    checked={modulesEnabled}
                    onChange={(e) => setModulesEnabled(e.target.checked)}
                    disabled={submitting}
                    className="mt-0.5 h-3.5 w-3.5 accent-white/80"
                  />
                  <div className="flex-1">
                    <div className="text-[12.5px] text-white/90 font-medium">
                      Enable modules
                    </div>
                    <div className="text-[11.5px] text-white/45 leading-relaxed">
                      Split phases across multiple modules (e.g. AXIS has 9 modules).
                      Can be changed later.
                    </div>
                  </div>
                </label>

                {error && (
                  <div
                    className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
                    style={{
                      background: 'rgba(251, 113, 133, 0.08)',
                      border: '1px solid rgba(251, 113, 133, 0.22)',
                      color: 'rgba(251, 113, 133, 0.95)'
                    }}
                  >
                    <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-8 px-3 rounded-[9px] text-[12.5px] text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="h-8 px-4 rounded-[9px] text-[12.5px] font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden inline-flex items-center gap-1.5"
                  style={{
                    background: `linear-gradient(180deg, ${color}8c 0%, ${color}59 100%)`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px ${color}66, 0 6px 16px -6px ${color}88`
                  }}
                >
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  {submitting ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
