import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Search,
  ChevronRight,
  Loader2,
  AlertCircle,
  Folder,
  Layers,
  ListTree,
  Sparkles,
  Bug,
  MessageCircle,
  FileText,
  GitBranch
} from 'lucide-react'
import { projectsRepo } from '@/repos/projects'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { itemsRepo } from '@/repos/items'
import { linksRepo } from '@/repos/links'
import { activityRepo } from '@/repos/activity'
import { supabase } from '@/lib/supabase'
import type {
  Project,
  Module,
  Phase,
  Item,
  ItemType
} from '@/types/db'

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const STEP_DURATION = 0.18

const TYPE_ICON: Record<ItemType, React.ComponentType<{ className?: string }>> = {
  feature: Sparkles,
  bug: Bug,
  feedback: MessageCircle,
  note: FileText,
  decision: GitBranch
}

const TYPE_TINT: Record<ItemType, string> = {
  feature: 'text-violet-300/80',
  bug: 'text-rose-300/80',
  feedback: 'text-sky-300/80',
  note: 'text-zinc-300/80',
  decision: 'text-amber-300/80'
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface LinkPickerProps {
  open: boolean
  fromItemId: string
  excludeItemIds?: string[]
  onClose: () => void
  onLinked: () => void
}

type StepKey = 'project' | 'module' | 'phase' | 'item'

interface Selection {
  project: Project | null
  module: Module | null
  phase: Phase | null
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function LinkPicker({
  open,
  fromItemId,
  excludeItemIds = [],
  onClose,
  onLinked
}: LinkPickerProps) {
  const [step, setStep] = useState<StepKey>('project')
  const [direction, setDirection] = useState<1 | -1>(1)
  const [sel, setSel] = useState<Selection>({ project: null, module: null, phase: null })
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  // Step data
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [modules, setModules] = useState<Module[] | null>(null)
  const [phases, setPhases] = useState<Phase[] | null>(null)
  const [items, setItems] = useState<Item[] | null>(null)

  const excludeSet = useMemo(() => new Set(excludeItemIds), [excludeItemIds])

  /* Reset on open */
  useEffect(() => {
    if (open) {
      setStep('project')
      setDirection(1)
      setSel({ project: null, module: null, phase: null })
      setQuery('')
      setError(null)
      setLinking(false)
      setProjects(null)
      setModules(null)
      setPhases(null)
      setItems(null)
    }
  }, [open])

  /* Esc to close */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  /* Step 1: load projects */
  useEffect(() => {
    if (!open || step !== 'project' || projects !== null) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await projectsRepo.list()
        if (!cancelled) setProjects(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load projects')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, step, projects])

  /* Step 2: load modules when entering module step */
  useEffect(() => {
    if (!open || step !== 'module' || !sel.project) return
    let cancelled = false
    setModules(null)
    ;(async () => {
      try {
        const rows = await modulesRepo.listByProject(sel.project!.id)
        if (!cancelled) setModules(rows)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load modules')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, step, sel.project])

  /* Step 3: load phases */
  useEffect(() => {
    if (!open || step !== 'phase' || !sel.project) return
    let cancelled = false
    setPhases(null)
    ;(async () => {
      try {
        const rows = sel.module
          ? await phasesRepo.listByModule(sel.module.id)
          : await phasesRepo.listByProject(sel.project!.id)
        // When a project uses modules, phasesRepo.listByProject returns all phases
        // (including those in modules). Filter to only phases without a module when
        // the user explicitly chose "no module" path — handled at step entry.
        const filtered = sel.project!.modules_enabled && !sel.module
          ? rows.filter((p) => p.module_id === null)
          : rows
        if (!cancelled) setPhases(filtered)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load phases')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, step, sel.project, sel.module])

  /* Step 4: load items */
  useEffect(() => {
    if (!open || step !== 'item' || !sel.phase) return
    let cancelled = false
    setItems(null)
    ;(async () => {
      try {
        const rows = await itemsRepo.listByPhase(sel.phase!.id)
        if (!cancelled) {
          setItems(rows.filter((it) => !it.archived && !excludeSet.has(it.id)))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load items')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, step, sel.phase, excludeSet])

  /* Navigation */
  const goForward = useCallback((next: StepKey) => {
    setDirection(1)
    setQuery('')
    setError(null)
    setStep(next)
  }, [])

  const goBackTo = useCallback((target: StepKey) => {
    setDirection(-1)
    setQuery('')
    setError(null)
    setStep(target)
    setSel((prev) => {
      if (target === 'project') return { project: null, module: null, phase: null }
      if (target === 'module') return { ...prev, module: null, phase: null }
      if (target === 'phase') return { ...prev, phase: null }
      return prev
    })
  }, [])

  /* Selection handlers */
  const pickProject = (p: Project) => {
    setSel({ project: p, module: null, phase: null })
    goForward(p.modules_enabled ? 'module' : 'phase')
  }

  const pickModule = (m: Module | null) => {
    setSel((prev) => ({ ...prev, module: m, phase: null }))
    goForward('phase')
  }

  const pickPhase = (ph: Phase) => {
    setSel((prev) => ({ ...prev, phase: ph }))
    goForward('item')
  }

  const pickItem = async (it: Item) => {
    if (linking) return
    setLinking(true)
    setError(null)
    try {
      await linksRepo.link(fromItemId, it.id)
      // Best-effort activity log (non-critical)
      if (sel.project) {
        try {
          await activityRepo.log(
            sel.project.id,
            'item_linked',
            { to_item_id: it.id },
            fromItemId
          )
        } catch {
          /* swallow */
        }
      } else {
        // fallback: derive project id from the from-item's phase
        try {
          const fromItem = await itemsRepo.get(fromItemId)
          if (fromItem) {
            const { data: phaseRow } = await supabase
              .from('phases')
              .select('project_id')
              .eq('id', fromItem.phase_id)
              .single()
            if (phaseRow?.project_id) {
              await activityRepo.log(
                phaseRow.project_id,
                'item_linked',
                { to_item_id: it.id },
                fromItemId
              )
            }
          }
        } catch {
          /* swallow */
        }
      }
      onLinked()
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create link'
      // Detect unique constraint / duplicate-link-ish errors gently.
      if (/duplicate|unique|already/i.test(msg)) {
        setError('These items are already linked.')
      } else {
        setError(msg)
      }
      setLinking(false)
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  const breadcrumb: Array<{ key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { key: 'project', label: sel.project?.name ?? 'Project', icon: Folder }
  ]
  if (sel.project?.modules_enabled) {
    breadcrumb.push({
      key: 'module',
      label: sel.module ? sel.module.name : sel.project && step !== 'project' && step !== 'module' ? 'No module' : 'Module',
      icon: Layers
    })
  }
  breadcrumb.push({ key: 'phase', label: sel.phase ? sel.phase.name : 'Phase', icon: ListTree })

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="lp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[3px]"
            aria-hidden="true"
          />

          {/* Card */}
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <motion.div
              key="lp-card"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE }}
              role="dialog"
              aria-modal="true"
              aria-label="Link to another item"
              className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.02)_inset] backdrop-blur-2xl"
              style={{ maxHeight: 'min(640px, 88vh)' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex flex-none items-center justify-between border-b border-border/70 px-5 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                    Link to another item
                  </span>
                  <Breadcrumb
                    breadcrumb={breadcrumb}
                    currentStep={step}
                    onJump={goBackTo}
                    modulesEnabled={!!sel.project?.modules_enabled}
                  />
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors duration-150 hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Search */}
              <div className="flex flex-none items-center gap-2 border-b border-border/70 px-5 py-2.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground/70" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    step === 'project'
                      ? 'Search projects…'
                      : step === 'module'
                      ? 'Search modules…'
                      : step === 'phase'
                      ? 'Search phases…'
                      : 'Search items…'
                  }
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>

              {/* Body */}
              <div className="relative min-h-[280px] flex-1 overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: direction * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -24 }}
                    transition={{ duration: STEP_DURATION, ease: EASE }}
                    className="absolute inset-0 overflow-y-auto px-2 py-2"
                  >
                    {step === 'project' && (
                      <ProjectList
                        query={query}
                        projects={projects}
                        onPick={pickProject}
                      />
                    )}
                    {step === 'module' && sel.project && (
                      <ModuleList
                        query={query}
                        modules={modules}
                        onPick={pickModule}
                      />
                    )}
                    {step === 'phase' && sel.project && (
                      <PhaseList
                        query={query}
                        phases={phases}
                        onPick={pickPhase}
                      />
                    )}
                    {step === 'item' && sel.phase && (
                      <ItemList
                        query={query}
                        items={items}
                        linking={linking}
                        onPick={pickItem}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer / error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="lp-err"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.14, ease: EASE }}
                    className="flex flex-none items-center gap-2 border-t border-rose-500/20 bg-rose-500/10 px-5 py-2 text-[12px] text-rose-200"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb                                                        */
/* ------------------------------------------------------------------ */

function Breadcrumb({
  breadcrumb,
  currentStep,
  onJump,
  modulesEnabled
}: {
  breadcrumb: Array<{ key: StepKey; label: string; icon: React.ComponentType<{ className?: string }> }>
  currentStep: StepKey
  onJump: (k: StepKey) => void
  modulesEnabled: boolean
}) {
  // Active index within breadcrumb for dimming.
  const order: StepKey[] = modulesEnabled
    ? ['project', 'module', 'phase', 'item']
    : ['project', 'phase', 'item']
  const currentIdx = order.indexOf(currentStep)

  return (
    <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px]">
      {breadcrumb.map((crumb, i) => {
        const crumbIdx = order.indexOf(crumb.key)
        const isPast = crumbIdx < currentIdx
        const isCurrent = crumbIdx === currentIdx
        const clickable = isPast
        const Icon = crumb.icon
        return (
          <div key={crumb.key} className="flex min-w-0 items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(crumb.key)}
              className={`flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors duration-150 ${
                isCurrent
                  ? 'text-foreground'
                  : clickable
                  ? 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  : 'text-muted-foreground/50'
              }`}
            >
              <Icon className="h-3 w-3 flex-none opacity-70" />
              <span className="max-w-[160px] truncate">{crumb.label}</span>
            </button>
            {i < breadcrumb.length - 1 && (
              <ChevronRight className="h-3 w-3 flex-none text-muted-foreground/40" />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Lists                                                             */
/* ------------------------------------------------------------------ */

function ProjectList({
  query,
  projects,
  onPick
}: {
  query: string
  projects: Project[] | null
  onPick: (p: Project) => void
}) {
  if (projects === null) return <ListLoading />
  const filtered = filterByName(projects, query, (p) => p.name)
  if (filtered.length === 0) {
    return <EmptyHint message={query ? 'No matching projects.' : 'No projects yet.'} />
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {filtered.map((p) => (
        <Row
          key={p.id}
          onClick={() => onPick(p)}
          leading={
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60"
              style={{
                backgroundColor: p.color ? `${p.color}22` : undefined,
                borderColor: p.color ? `${p.color}55` : undefined
              }}
            >
              <Folder
                className="h-3 w-3"
                style={{ color: p.color ?? undefined }}
              />
            </span>
          }
          title={p.name}
          meta={p.modules_enabled ? 'Modules' : 'Phases'}
        />
      ))}
    </ul>
  )
}

function ModuleList({
  query,
  modules,
  onPick
}: {
  query: string
  modules: Module[] | null
  onPick: (m: Module | null) => void
}) {
  if (modules === null) return <ListLoading />
  const filtered = filterByName(modules, query, (m) => m.name)

  return (
    <ul className="flex flex-col gap-0.5">
      {/* Escape hatch: allow picking phases directly when there's no module fit */}
      <Row
        onClick={() => onPick(null)}
        leading={
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-border/60 text-muted-foreground/70">
            <ListTree className="h-3 w-3" />
          </span>
        }
        title="No module"
        meta="Project-level phases"
      />
      {filtered.length === 0 ? (
        <li className="px-3 py-6 text-center text-[12px] text-muted-foreground/60">
          {query ? 'No matching modules.' : 'No modules in this project — select a phase directly.'}
        </li>
      ) : (
        filtered.map((m) => (
          <Row
            key={m.id}
            onClick={() => onPick(m)}
            leading={
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground">
                <Layers className="h-3 w-3" />
              </span>
            }
            title={m.name}
            meta={m.is_general ? 'General' : undefined}
          />
        ))
      )}
    </ul>
  )
}

function PhaseList({
  query,
  phases,
  onPick
}: {
  query: string
  phases: Phase[] | null
  onPick: (p: Phase) => void
}) {
  if (phases === null) return <ListLoading />
  const filtered = filterByName(phases, query, (p) => p.name)
  if (filtered.length === 0) {
    return <EmptyHint message={query ? 'No matching phases.' : 'No phases here.'} />
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {filtered.map((ph) => (
        <Row
          key={ph.id}
          onClick={() => onPick(ph)}
          leading={
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 font-mono text-[10px] text-muted-foreground">
              {ph.number}
            </span>
          }
          title={ph.name}
          meta={ph.is_current ? 'Current' : ph.status}
          highlight={ph.is_current}
        />
      ))}
    </ul>
  )
}

function ItemList({
  query,
  items,
  linking,
  onPick
}: {
  query: string
  items: Item[] | null
  linking: boolean
  onPick: (it: Item) => void
}) {
  if (items === null) return <ListLoading />
  const filtered = filterByName(items, query, (i) => i.title)
  if (filtered.length === 0) {
    return (
      <EmptyHint
        message={
          query
            ? 'No matching items.'
            : 'No linkable items in this phase.'
        }
      />
    )
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {filtered.map((it) => {
        const Icon = TYPE_ICON[it.type]
        return (
          <Row
            key={it.id}
            onClick={() => onPick(it)}
            disabled={linking}
            leading={
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60">
                <Icon className={`h-3 w-3 ${TYPE_TINT[it.type]}`} />
              </span>
            }
            title={it.title}
            meta={it.status}
            trailing={linking ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : undefined}
          />
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */
/*  Row / helpers                                                     */
/* ------------------------------------------------------------------ */

function Row({
  onClick,
  leading,
  title,
  meta,
  trailing,
  disabled,
  highlight
}: {
  onClick: () => void
  leading: React.ReactNode
  title: string
  meta?: string
  trailing?: React.ReactNode
  disabled?: boolean
  highlight?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors duration-150 ${
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'hover:border-border/70 hover:bg-secondary/50'
        } ${highlight ? 'bg-secondary/30' : ''}`}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-foreground/95">{title}</span>
          {meta && (
            <span className="block truncate text-[11px] text-muted-foreground/70">
              {meta}
            </span>
          )}
        </span>
        {trailing ?? (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        )}
      </button>
    </li>
  )
}

function ListLoading() {
  return (
    <div className="flex h-full items-center justify-center py-16">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />
    </div>
  )
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12 text-center text-[12.5px] text-muted-foreground/70">
      {message}
    </div>
  )
}

function filterByName<T>(rows: T[], q: string, getName: (row: T) => string): T[] {
  const needle = q.trim().toLowerCase()
  if (!needle) return rows
  return rows.filter((r) => getName(r).toLowerCase().includes(needle))
}
