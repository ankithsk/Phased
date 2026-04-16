import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { projectsRepo } from '@/repos/projects'
import type { Project, ProjectStatus } from '@/types/db'

interface GeneralPanelProps {
  project: Project
  onChange: () => Promise<void>
}

// 12 curated muted swatches. First 8 are intended to match the seed palette.
const SWATCHES = [
  '#a78bfa', // violet
  '#60a5fa', // sky
  '#34d399', // emerald
  '#fbbf24', // amber
  '#fb7185', // rose
  '#94a3b8', // slate
  '#a3a3a3', // stone
  '#f472b6', // pink
  '#9ca3af', // zinc
  '#86efac', // sage
  '#c4b5fd', // lavender
  '#fcd34d'  // warm
]

const STATUSES: Array<{ key: ProjectStatus; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' }
]

export function GeneralPanel({ project, onChange }: GeneralPanelProps) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [color, setColor] = useState<string>(project.color ?? '#94a3b8')
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [progress, setProgress] = useState<number>(project.progress)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Reset when incoming project changes
  useEffect(() => {
    setName(project.name)
    setDescription(project.description ?? '')
    setColor(project.color ?? '#94a3b8')
    setStatus(project.status)
    setProgress(project.progress)
  }, [project])

  const dirty = useMemo(() => {
    return (
      name !== project.name ||
      (description ?? '') !== (project.description ?? '') ||
      (color ?? '') !== (project.color ?? '') ||
      status !== project.status ||
      progress !== project.progress
    )
  }, [name, description, color, status, progress, project])

  const handleReset = () => {
    setName(project.name)
    setDescription(project.description ?? '')
    setColor(project.color ?? '#94a3b8')
    setStatus(project.status)
    setProgress(project.progress)
  }

  const handleSave = async () => {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await projectsRepo.update(project.id, {
        name: name.trim(),
        description: description.trim() === '' ? null : description.trim(),
        color,
        status,
        progress
      })
      await onChange()
      setToast('Saved.')
      window.setTimeout(() => setToast(null), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="Identity" subtitle="Name and description shown across the app.">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:bg-background/70"
            placeholder="Project name"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:bg-background/70"
            placeholder="What is this project about?"
          />
        </Field>
      </SectionCard>

      <SectionCard title="Appearance" subtitle="Accent color used in headers, progress and badges.">
        <Field label="Color">
          <div className="flex flex-wrap items-center gap-2.5">
            {SWATCHES.map((hex) => {
              const active = hex.toLowerCase() === color.toLowerCase()
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setColor(hex)}
                  aria-label={`Choose color ${hex}`}
                  className="group relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-105"
                  style={{
                    backgroundColor: hex,
                    boxShadow: active
                      ? `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${hex}`
                      : `inset 0 0 0 1px rgba(255,255,255,0.08)`
                  }}
                >
                  {active && (
                    <Check
                      className="h-3.5 w-3.5 text-background drop-shadow"
                      strokeWidth={3}
                    />
                  )}
                </button>
              )
            })}
            <div className="mx-1 h-5 w-px bg-border/60" aria-hidden />
            <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-2 py-1">
              <span
                className="h-3.5 w-3.5 flex-none rounded-full"
                style={{ backgroundColor: color }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                spellCheck={false}
                className="w-20 bg-transparent text-[11.5px] font-mono tabular-nums text-foreground outline-none placeholder:text-muted-foreground/60"
                placeholder="#a78bfa"
              />
            </label>
          </div>
        </Field>
      </SectionCard>

      <SectionCard title="State" subtitle="Status and progress of the project.">
        <Field label="Status">
          <div className="inline-flex rounded-lg border border-border/60 bg-background/30 p-0.5">
            {STATUSES.map((s) => {
              const active = s.key === status
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  className={`relative rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors ${
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="status-seg-indicator"
                      className="absolute inset-0 rounded-md bg-secondary/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <span className="relative">{s.label}</span>
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Progress">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="axis-slider h-1 flex-1 appearance-none rounded-full bg-secondary/60 outline-none"
              style={{
                background: `linear-gradient(to right, ${color} 0%, ${color} ${progress}%, hsl(var(--secondary) / 0.6) ${progress}%, hsl(var(--secondary) / 0.6) 100%)`
              }}
            />
            <span className="w-10 text-right text-[11.5px] tabular-nums text-muted-foreground">
              {progress}%
            </span>
          </div>
        </Field>
      </SectionCard>

      {/* Action bar */}
      <div className="mt-2 flex items-center justify-end gap-2">
        <AnimatePresence>
          {toast && (
            <motion.span
              key="toast"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.2 }}
              className="mr-auto flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11.5px] font-medium text-emerald-200/90"
            >
              <Check className="h-3.5 w-3.5" />
              {toast}
            </motion.span>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={handleReset}
          disabled={!dirty || saving}
          className="rounded-lg border border-border/60 bg-card/40 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="relative inline-flex items-center gap-2 rounded-lg border border-foreground/20 bg-foreground px-3.5 py-1.5 text-[12px] font-semibold text-background transition-all duration-150 hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dirty && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
          )}
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// --------- Section primitive ---------

interface SectionCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

function SectionCard({ title, subtitle, children }: SectionCardProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <header className="flex flex-col gap-0.5 border-b border-border/50 px-5 py-3.5">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[12px] text-muted-foreground/70">{subtitle}</p>
        )}
      </header>
      <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
    </section>
  )
}

interface FieldProps {
  label: string
  children: React.ReactNode
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[140px_1fr] sm:items-start sm:gap-5">
      <label className="pt-2 text-[12px] font-medium tracking-tight text-foreground/80">
        {label}
      </label>
      <div>{children}</div>
    </div>
  )
}
