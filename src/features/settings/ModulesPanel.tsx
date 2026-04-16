import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  RotateCcw,
  X,
  Archive as ArchiveIcon
} from 'lucide-react'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { projectsRepo } from '@/repos/projects'
import { activityRepo } from '@/repos/activity'
import type { Module } from '@/types/db'

interface ModulesPanelProps {
  projectId: string
  enabled: boolean
  onProjectChange: () => Promise<void>
}

export function ModulesPanel({ projectId, enabled, onProjectChange }: ModulesPanelProps) {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [confirmDisable, setConfirmDisable] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const refresh = useCallback(async () => {
    const list = await modulesRepo.listByProject(projectId, true)
    setModules(list)
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const list = await modulesRepo.listByProject(projectId, true)
      if (!cancelled) {
        setModules(list)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const active = modules
    .filter((m) => !m.archived)
    .sort((a, b) => a.sort_order - b.sort_order)
  const archived = modules
    .filter((m) => m.archived)
    .sort((a, b) => a.sort_order - b.sort_order)

  const handleEnable = async () => {
    if (working) return
    setWorking(true)
    try {
      // Find or create a General module
      let general = modules.find((m) => m.is_general && !m.archived)
      if (!general) {
        general = await modulesRepo.create(projectId, 'General / App-wide', {
          isGeneral: true,
          sortOrder: 0
        })
        await activityRepo.log(projectId, 'module_created', { name: 'General' })
      }
      // Re-parent phases without a module into the General module
      const phases = await phasesRepo.listByProject(projectId)
      await Promise.all(
        phases
          .filter((p) => p.module_id === null)
          .map((p) => phasesRepo.update(p.id, { module_id: general!.id }))
      )
      await projectsRepo.update(projectId, { modules_enabled: true })
      await onProjectChange()
      await refresh()
    } finally {
      setWorking(false)
    }
  }

  const confirmDisableAction = async () => {
    setConfirmDisable(false)
    if (working) return
    setWorking(true)
    try {
      const phases = await phasesRepo.listByProject(projectId)
      await Promise.all(
        phases
          .filter((p) => p.module_id !== null)
          .map((p) => phasesRepo.update(p.id, { module_id: null }))
      )
      await projectsRepo.update(projectId, { modules_enabled: false })
      await onProjectChange()
      await refresh()
    } finally {
      setWorking(false)
    }
  }

  const handleReorder = async (id: string, dir: -1 | 1) => {
    const idx = active.findIndex((m) => m.id === id)
    if (idx === -1) return
    const next = idx + dir
    if (next < 0 || next >= active.length) return
    const reordered = [...active]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(next, 0, moved)
    // Optimistic update
    const map = new Map(reordered.map((m, i) => [m.id, i]))
    setModules((prev) =>
      prev.map((m) => (map.has(m.id) ? { ...m, sort_order: map.get(m.id)! } : m))
    )
    await modulesRepo.reorder(
      projectId,
      reordered.map((m) => m.id)
    )
    await refresh()
  }

  const startEdit = (m: Module) => {
    setEditingId(m.id)
    setEditingName(m.name)
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }
  const commitEdit = async () => {
    if (!editingId) return
    const trimmed = editingName.trim()
    if (trimmed.length === 0) return cancelEdit()
    await modulesRepo.update(editingId, { name: trimmed })
    cancelEdit()
    await refresh()
  }

  const handleArchive = async (id: string) => {
    await modulesRepo.archive(id)
    await activityRepo.log(projectId, 'module_archived', { module_id: id })
    await refresh()
  }
  const handleUnarchive = async (id: string) => {
    await modulesRepo.unarchive(id)
    await refresh()
  }

  const handleAdd = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    await modulesRepo.create(projectId, trimmed, {
      description: newDesc.trim() || undefined,
      sortOrder: active.length
    })
    await activityRepo.log(projectId, 'module_created', { name: trimmed })
    setNewName('')
    setNewDesc('')
    setAdding(false)
    await refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Enable toggle card */}
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
              Enable modules
            </h2>
            <p className="mt-0.5 max-w-lg text-[12px] text-muted-foreground/80">
              Group phases into sub-projects. Useful when a project has multiple parallel
              tracks or apps.
            </p>
          </div>
          <Toggle
            checked={enabled}
            onChange={(v) => {
              if (v) void handleEnable()
              else setConfirmDisable(true)
            }}
            disabled={working}
            ariaLabel="Enable modules"
          />
        </div>
      </section>

      {/* When disabled */}
      {!enabled && (
        <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border/60 bg-card/20 px-6 py-12 text-center">
          <span className="text-[13px] font-medium text-foreground/80">
            Modules are off
          </span>
          <span className="max-w-sm text-[12px] text-muted-foreground">
            Enable modules to group phases by sub-project. Existing phases will be moved
            under a General module.
          </span>
        </div>
      )}

      {/* When enabled */}
      {enabled && (
        <>
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <header className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                Active modules
              </h2>
              <span className="text-[11px] tabular-nums text-muted-foreground/60">
                {active.length}
              </span>
            </header>
            <div>
              {loading ? (
                <SkeletonRows count={3} />
              ) : active.length === 0 ? (
                <EmptyRow label="No modules yet." />
              ) : (
                <ul className="divide-y divide-border/50">
                  {active.map((m, idx) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-background/30"
                    >
                      <div className="flex flex-col gap-0.5">
                        <IconBtn
                          label="Move up"
                          onClick={() => handleReorder(m.id, -1)}
                          disabled={idx === 0}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </IconBtn>
                        <IconBtn
                          label="Move down"
                          onClick={() => handleReorder(m.id, 1)}
                          disabled={idx === active.length - 1}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </IconBtn>
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingId === m.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') void commitEdit()
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              className="w-full rounded-md border border-border/80 bg-background/60 px-2 py-1 text-[13px] text-foreground outline-none focus:border-foreground/30"
                            />
                            <IconBtn label="Save" onClick={commitEdit}>
                              <Check className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn label="Cancel" onClick={cancelEdit}>
                              <X className="h-3.5 w-3.5" />
                            </IconBtn>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium tracking-tight text-foreground">
                              {m.name}
                            </span>
                            {m.is_general && (
                              <span className="rounded-md border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                General
                              </span>
                            )}
                          </div>
                        )}
                        {m.description && editingId !== m.id && (
                          <p className="truncate text-[11.5px] text-muted-foreground/70">
                            {m.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingId !== m.id && (
                          <>
                            <IconBtn label="Rename" onClick={() => startEdit(m)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn
                              label="Archive module"
                              onClick={() => handleArchive(m.id)}
                              disabled={m.is_general}
                            >
                              <ArchiveIcon className="h-3.5 w-3.5" />
                            </IconBtn>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add module footer */}
            <div className="border-t border-border/50 bg-background/20 px-5 py-3">
              <AnimatePresence initial={false} mode="wait">
                {adding ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="flex flex-col gap-2"
                  >
                    <input
                      autoFocus
                      placeholder="Module name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAdd()
                        if (e.key === 'Escape') {
                          setAdding(false)
                          setNewName('')
                          setNewDesc('')
                        }
                      }}
                      className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
                    />
                    <input
                      placeholder="Description (optional)"
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-foreground/30"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAdding(false)
                          setNewName('')
                          setNewDesc('')
                        }}
                        className="rounded-md border border-border/60 bg-card/40 px-3 py-1 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAdd}
                        disabled={!newName.trim()}
                        className="rounded-md border border-foreground/20 bg-foreground px-3 py-1 text-[11.5px] font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Add module
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="cta"
                    type="button"
                    onClick={() => setAdding(true)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-background/30 hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add module
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Archived modules */}
          {archived.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/30">
              <button
                type="button"
                onClick={() => setShowArchived((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-background/30"
              >
                <div className="flex items-center gap-2">
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                      showArchived ? '' : '-rotate-90'
                    }`}
                  />
                  <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    Archived
                  </h2>
                </div>
                <span className="text-[11px] tabular-nums text-muted-foreground/60">
                  {archived.length}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {showArchived && (
                  <motion.div
                    key="archived-list"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden border-t border-border/50"
                  >
                    <ul className="divide-y divide-border/50">
                      {archived.map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-3 px-5 py-3 opacity-80"
                        >
                          <span className="flex-1 truncate text-[13px] font-medium text-foreground/80">
                            {m.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUnarchive(m.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Unarchive
                          </button>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDisable}
        title="Disable modules?"
        body="Disabling modules will ungroup all phases back to the project level. You can re-enable later."
        confirmLabel="Disable modules"
        tone="destructive"
        onCancel={() => setConfirmDisable(false)}
        onConfirm={confirmDisableAction}
      />
    </div>
  )
}

// --------- Primitives ---------

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  ariaLabel: string
}

function Toggle({ checked, onChange, disabled, ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 flex-none items-center rounded-full border transition-colors duration-200 ${
        checked
          ? 'border-foreground/20 bg-foreground/80'
          : 'border-border/80 bg-secondary/80'
      } disabled:opacity-50`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        className={`inline-block h-4 w-4 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${
          checked ? 'ml-auto mr-1 bg-background' : 'ml-1 bg-foreground/80'
        }`}
      />
    </button>
  )
}

interface IconBtnProps {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

function IconBtn({ label, onClick, disabled, children }: IconBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-border/60 hover:bg-background/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <ul className="divide-y divide-border/50">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="h-3 w-3 animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted-foreground/20" />
        </li>
      ))}
    </ul>
  )
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-5 py-8 text-center text-[12px] text-muted-foreground">
      {label}
    </div>
  )
}

// --------- Confirm dialog ---------

interface ConfirmDialogProps {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  tone?: 'default' | 'destructive'
  onCancel: () => void
  onConfirm: () => void
}

function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'default',
  onCancel,
  onConfirm
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-background/70 backdrop-blur-md"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            <div className="flex flex-col gap-1.5 px-5 pt-5">
              <h3
                id="confirm-title"
                className="text-[14px] font-semibold tracking-tight text-foreground"
              >
                {title}
              </h3>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-border/60 bg-card/40 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                  tone === 'destructive'
                    ? 'border border-rose-500/30 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                    : 'border border-foreground/20 bg-foreground text-background hover:bg-foreground/90'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
