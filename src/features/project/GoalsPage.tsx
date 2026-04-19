import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Target,
  Plus,
  Loader2,
  Check,
  CircleDashed,
  CircleX,
  MoreHorizontal,
  Pencil,
  Trash2,
  AlertCircle
} from 'lucide-react'
import { projectsRepo } from '@/repos/projects'
import { goalsRepo } from '@/repos/goals'
import { useGoals } from '@/hooks/useGoals'
import type { Goal, GoalStatus, Project } from '@/types/db'

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Active',
  achieved: 'Achieved',
  dropped: 'Dropped'
}

const STATUS_ICON: Record<GoalStatus, React.ComponentType<{ className?: string }>> = {
  active: CircleDashed,
  achieved: Check,
  dropped: CircleX
}

const STATUS_CHIP: Record<GoalStatus, string> = {
  active: 'border-foreground/20 bg-foreground/5 text-foreground',
  achieved: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90',
  dropped: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-300/80'
}

export function GoalsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const { goals, itemCounts, loading } = useGoals(projectId)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    projectsRepo.get(projectId).then(setProject).catch(() => setProject(null))
  }, [projectId])

  const flashErr = (msg: string) => {
    setFlash(msg)
    window.setTimeout(() => setFlash((m) => (m === msg ? null : m)), 3000)
  }

  const active = useMemo(() => goals.filter((g) => g.status === 'active'), [goals])
  const achieved = useMemo(() => goals.filter((g) => g.status === 'achieved'), [goals])
  const dropped = useMemo(() => goals.filter((g) => g.status === 'dropped'), [goals])

  const accent = project?.color ?? '#a1a1aa'

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto max-w-[860px] px-6 py-10 md:px-10">
        <div className="mb-6">
          <Link
            to={project ? `/p/${project.id}` : '/'}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {project ? `Back to ${project.name}` : 'Back'}
          </Link>
        </div>

        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-end justify-between gap-4"
        >
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
              <Target className="h-3 w-3" strokeWidth={2.25} />
              Goals
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-foreground">
                {project?.name ?? 'Project'}
              </h1>
              {!loading && (
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                  {active.length} active
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
              The *why* above the work. Tag items to a goal so you can see what's
              contributing to the outcomes you care about.
            </p>
          </div>
          {project && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="group inline-flex h-9 items-center gap-2 rounded-full border border-border/80 bg-foreground px-4 text-[12.5px] font-semibold tracking-tight text-background shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_4px_14px_-4px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-foreground/90"
            >
              <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
              New goal
            </button>
          )}
        </motion.header>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <EmptyState accent={accent} onCreate={() => setCreating(true)} />
        ) : (
          <div className="space-y-8">
            {active.length > 0 && (
              <GoalList
                title="Active"
                goals={active}
                itemCounts={itemCounts}
                onEdit={setEditing}
                onStatus={(g, s) =>
                  goalsRepo.setStatus(g.id, s).catch((e) => flashErr(String(e)))
                }
                onRemove={(g) =>
                  goalsRepo.remove(g.id).catch((e) => flashErr(String(e)))
                }
              />
            )}
            {achieved.length > 0 && (
              <GoalList
                title="Achieved"
                goals={achieved}
                itemCounts={itemCounts}
                onEdit={setEditing}
                onStatus={(g, s) =>
                  goalsRepo.setStatus(g.id, s).catch((e) => flashErr(String(e)))
                }
                onRemove={(g) =>
                  goalsRepo.remove(g.id).catch((e) => flashErr(String(e)))
                }
              />
            )}
            {dropped.length > 0 && (
              <GoalList
                title="Dropped"
                goals={dropped}
                itemCounts={itemCounts}
                onEdit={setEditing}
                onStatus={(g, s) =>
                  goalsRepo.setStatus(g.id, s).catch((e) => flashErr(String(e)))
                }
                onRemove={(g) =>
                  goalsRepo.remove(g.id).catch((e) => flashErr(String(e)))
                }
              />
            )}
          </div>
        )}
      </div>

      {creating && projectId && (
        <GoalDialog
          projectId={projectId}
          accent={accent}
          onClose={() => setCreating(false)}
        />
      )}
      {editing && (
        <GoalDialog
          projectId={editing.project_id}
          accent={accent}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12px] text-rose-200 backdrop-blur"
          >
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {flash}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GoalList({
  title,
  goals,
  itemCounts,
  onEdit,
  onStatus,
  onRemove
}: {
  title: string
  goals: Goal[]
  itemCounts: Record<string, number>
  onEdit: (g: Goal) => void
  onStatus: (g: Goal, status: GoalStatus) => void
  onRemove: (g: Goal) => void
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
          {title}
        </span>
        <span className="h-px flex-1 bg-border/50" />
        <span className="text-[11px] tabular-nums text-muted-foreground/70">
          {goals.length}
        </span>
      </div>
      <ul className="divide-y divide-border/40 rounded-2xl border border-border/70 bg-card/40">
        {goals.map((g) => (
          <GoalRow
            key={g.id}
            goal={g}
            count={itemCounts[g.id] ?? 0}
            onEdit={() => onEdit(g)}
            onStatus={(s) => onStatus(g, s)}
            onRemove={() => onRemove(g)}
          />
        ))}
      </ul>
    </section>
  )
}

function GoalRow({
  goal,
  count,
  onEdit,
  onStatus,
  onRemove
}: {
  goal: Goal
  count: number
  onEdit: () => void
  onStatus: (s: GoalStatus) => void
  onRemove: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const Icon = STATUS_ICON[goal.status]

  useEffect(() => {
    if (!menuOpen) return
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-secondary/50 ring-1 ring-inset ring-border/50">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="truncate text-left text-[14px] font-medium text-foreground transition-colors hover:text-foreground/70"
          >
            {goal.name}
          </button>
          <span
            className={`flex-none rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${STATUS_CHIP[goal.status]}`}
          >
            {STATUS_LABEL[goal.status]}
          </span>
        </div>
        {goal.description && (
          <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
            {goal.description}
          </p>
        )}
        <div className="mt-1 text-[11px] text-muted-foreground/80">
          {count} open {count === 1 ? 'item' : 'items'} tagged
        </div>
      </div>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Goal actions"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full z-20 mt-1.5 min-w-[180px] overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
            >
              <MenuItem
                icon={<Pencil className="h-3.5 w-3.5" />}
                label="Edit"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit()
                }}
              />
              {goal.status !== 'active' && (
                <MenuItem
                  icon={<CircleDashed className="h-3.5 w-3.5" />}
                  label="Mark active"
                  onClick={() => {
                    setMenuOpen(false)
                    onStatus('active')
                  }}
                />
              )}
              {goal.status !== 'achieved' && (
                <MenuItem
                  icon={<Check className="h-3.5 w-3.5" />}
                  label="Mark achieved"
                  onClick={() => {
                    setMenuOpen(false)
                    onStatus('achieved')
                  }}
                />
              )}
              {goal.status !== 'dropped' && (
                <MenuItem
                  icon={<CircleX className="h-3.5 w-3.5" />}
                  label="Mark dropped"
                  onClick={() => {
                    setMenuOpen(false)
                    onStatus('dropped')
                  }}
                />
              )}
              <div className="my-1 h-px bg-border/50" />
              <MenuItem
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete"
                tone="danger"
                onClick={() => {
                  setMenuOpen(false)
                  onRemove()
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  tone = 'default'
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
        tone === 'danger'
          ? 'text-red-200/90 hover:bg-red-500/10 hover:text-red-100'
          : 'text-foreground/90 hover:bg-secondary/60 hover:text-foreground'
      }`}
    >
      <span className="flex h-4 w-4 flex-none items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

function GoalDialog({
  projectId,
  accent,
  initial,
  onClose
}: {
  projectId: string
  accent: string
  initial?: Goal
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setTimeout(() => nameRef.current?.focus(), 80)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give the goal a name.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      if (initial) {
        await goalsRepo.update(initial.id, {
          name: trimmed,
          description: description.trim() || null
        })
      } else {
        await goalsRepo.create(projectId, trimmed, {
          description: description.trim() || undefined
        })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="gd-overlay"
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
      >
        <div
          className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
          onClick={onClose}
          aria-hidden
        />
        <motion.form
          role="dialog"
          aria-modal="true"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
                boxShadow: `inset 0 0 0 1px ${accent}55`
              }}
            >
              <Target className="h-3.5 w-3.5" style={{ color: accent }} />
            </div>
            <h3 className="text-[14px] font-semibold text-foreground">
              {initial ? 'Edit goal' : 'New goal'}
            </h3>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
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
                placeholder="e.g. Cut quote turnaround time in half"
                disabled={submitting}
                className="w-full rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-[13.5px] text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50"
              />
            </div>
            <div>
              <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                Description
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional — the outcome you're after, in one or two sentences."
                rows={3}
                disabled={submitting}
                className="w-full resize-none rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-transparent px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {initial ? 'Save' : 'Create goal'}
            </button>
          </div>
        </motion.form>
      </motion.div>
    </AnimatePresence>
  )
}

function EmptyState({ accent, onCreate }: { accent: string; onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-20 text-center">
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-secondary/40"
        style={{ boxShadow: `0 0 0 4px ${accent}14` }}
      >
        <Target className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
        No goals yet
      </h2>
      <p className="mt-1.5 max-w-md text-[13px] leading-5 text-muted-foreground">
        Goals let you tag items to an outcome — so you can see "what am I doing to
        move X forward" across phases and modules.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-secondary/60 px-4 py-2 text-[12.5px] font-medium tracking-tight text-foreground transition-colors hover:bg-secondary"
      >
        <Plus className="h-3.5 w-3.5" />
        New goal
      </button>
    </div>
  )
}
