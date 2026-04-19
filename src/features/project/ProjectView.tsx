import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Settings2, Archive, GitBranch, Moon, Target } from 'lucide-react'
import { useProject } from '@/hooks/useProject'
import { useGoals } from '@/hooks/useGoals'
import { projectsRepo } from '@/repos/projects'
import { ModuleSidebar } from './ModuleSidebar'
import { PhaseSection } from './PhaseSection'
import { AddPhaseButton } from './AddPhaseButton'
import { PinnedStrip } from './PinnedStrip'
import { ContextResumeBanner } from './ContextResumeBanner'
import { ItemDetailPanel } from './ItemDetailPanel'
import type { Module, Phase, ProjectStatus } from '@/types/db'

const PROJECT_STATUS_CHIP: Record<ProjectStatus, string> = {
  active: 'bg-emerald-500/10 text-emerald-200/90 border-emerald-500/20',
  paused: 'bg-amber-500/10 text-amber-200/90 border-amber-500/20',
  completed: 'bg-sky-500/10 text-sky-200/90 border-sky-500/20'
}

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  const { project, modules, phases, phaseItemCounts, loading } = useProject(projectId)
  const { goals } = useGoals(projectId)
  const goalNames = useMemo(() => {
    const m: Record<string, string> = {}
    for (const g of goals) m[g.id] = g.name
    return m
  }, [goals])
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Selected module lives in the URL so refresh + back/forward preserve it.
  // Treat "all" (or missing) as "All modules" → null.
  const moduleParam = searchParams.get('module')
  const selectedModuleId =
    !moduleParam || moduleParam === 'all' ? null : moduleParam

  const setSelectedModuleId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams)
      if (id === null) next.delete('module')
      else next.set('module', id)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams]
  )

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showSnoozed, setShowSnoozed] = useState(false)
  // Phase id requested by a jump-to-phase (from the command palette). When
  // set, the matching PhaseSection opens + scrolls into view; cleared once
  // applied so subsequent clicks don't force-reopen.
  const [jumpPhaseId, setJumpPhaseId] = useState<string | null>(null)

  // If the URL carries a ?module= that doesn't exist in this project's
  // modules (stale bookmark, deleted module, different project), drop it
  // rather than silently showing an empty "no phases" pane.
  useEffect(() => {
    if (!selectedModuleId) return
    if (loading) return
    if (modules.length === 0) return
    if (modules.some((m) => m.id === selectedModuleId)) return
    setSelectedModuleId(null)
  }, [loading, modules, selectedModuleId, setSelectedModuleId])

  // Open the item detail panel when landing on /p/:id#item=<uuid>, or
  // trigger a phase jump when landing on /p/:id#phase=<uuid>. Both hashes
  // are consumed once (stripped from the URL) so subsequent renders don't
  // re-trigger after the user closes the panel or scrolls away.
  useEffect(() => {
    const hash = location.hash
    if (hash.startsWith('#item=')) {
      const itemId = hash.slice('#item='.length)
      if (itemId) setSelectedItemId(itemId)
    } else if (hash.startsWith('#phase=')) {
      const phaseId = hash.slice('#phase='.length)
      if (phaseId) setJumpPhaseId(phaseId)
    } else {
      return
    }
    navigate({ pathname: location.pathname, search: location.search }, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate])

  // When a phase jump target is set, scroll the matching section into view
  // on the next paint. The open/expand is handled by PhaseSection via the
  // forceExpandedId prop below.
  useEffect(() => {
    if (!jumpPhaseId) return
    const id = jumpPhaseId
    // Let the section render first (it may need to expand), then scroll.
    const t = window.setTimeout(() => {
      const el = document.getElementById(`phase-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setJumpPhaseId(null)
    }, 120)
    return () => window.clearTimeout(t)
  }, [jumpPhaseId])

  const modulesEnabled = !!project?.modules_enabled

  // Filter phases by selected module
  const filteredPhases = useMemo(() => {
    if (!modulesEnabled) return phases
    if (selectedModuleId === null) return phases
    return phases.filter((p) => p.module_id === selectedModuleId)
  }, [phases, modulesEnabled, selectedModuleId])

  // Group phases by module when "All modules" is selected
  const groupedByModule = useMemo(() => {
    if (!modulesEnabled || selectedModuleId !== null) return null
    const byModule = new Map<string | null, Phase[]>()
    for (const p of phases) {
      const key = p.module_id
      const list = byModule.get(key) ?? []
      list.push(p)
      byModule.set(key, list)
    }
    // Sort each group by phase number
    for (const list of byModule.values()) {
      list.sort((a, b) => a.number - b.number)
    }
    return byModule
  }, [phases, modulesEnabled, selectedModuleId])

  const moduleLookup = useMemo(() => {
    const m = new Map<string, Module>()
    for (const mod of modules) m.set(mod.id, mod)
    return m
  }, [modules])

  const flatPhases = useMemo(
    () => [...filteredPhases].sort((a, b) => a.number - b.number),
    [filteredPhases]
  )

  const nextPhaseNumber = useMemo(() => {
    const scope = modulesEnabled
      ? selectedModuleId === null
        ? phases
        : phases.filter((p) => p.module_id === selectedModuleId)
      : phases
    return scope.length === 0 ? 0 : Math.max(...scope.map((p) => p.number)) + 1
  }, [phases, modulesEnabled, selectedModuleId])

  if (loading || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24 }}
          className="flex items-center gap-3 text-[12.5px] text-muted-foreground"
        >
          <span className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/40" />
          Loading project…
        </motion.div>
      </div>
    )
  }

  const accent = project.color ?? '#a1a1aa'

  return (
    <div className="flex h-full min-h-0 flex-col md:flex-row">
      {/* Desktop sidebar */}
      {modulesEnabled && (
        <div className="hidden md:block">
          <ModuleSidebar
            modules={modules}
            selectedId={selectedModuleId}
            onSelect={setSelectedModuleId}
          />
        </div>
      )}

      {/* Mobile horizontal tab bar */}
      {modulesEnabled && (
        <div className="md:hidden">
          <ModuleTabBar
            modules={modules}
            selectedId={selectedModuleId}
            onSelect={setSelectedModuleId}
          />
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-7 md:px-8 md:py-9">
          {/* Project header */}
          <ProjectHeader
            name={project.name}
            description={project.description}
            status={project.status}
            progress={project.progress}
            accent={accent}
          />

          <ContextResumeBanner
            projectId={project.id}
            lastVisitedAt={project.last_visited_at}
            onItemClick={setSelectedItemId}
            onMarkVisited={() => {
              void projectsRepo.touchLastVisited(project.id)
            }}
          />

          <PinnedStrip projectId={project.id} onItemClick={setSelectedItemId} />

          {/* Phases header */}
          <div className="flex items-center justify-between pt-1">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
              Phases
            </h2>
            <div className="flex items-center gap-1.5">
              <SnoozedToggle value={showSnoozed} onChange={setShowSnoozed} />
              <ArchivedToggle value={showArchived} onChange={setShowArchived} />
            </div>
          </div>

          {/* Phase sections */}
          <div className="flex flex-col gap-4">
            {modulesEnabled && selectedModuleId === null && groupedByModule ? (
              <GroupedPhases
                grouped={groupedByModule}
                moduleLookup={moduleLookup}
                modules={modules}
                projectId={project.id}
                onItemClick={setSelectedItemId}
                showArchived={showArchived}
                showSnoozed={showSnoozed}
                phaseItemCounts={phaseItemCounts}
                forceExpandedId={jumpPhaseId}
                goalNames={goalNames}
              />
            ) : flatPhases.length === 0 ? (
              <EmptyPhasesState />
            ) : (
              flatPhases.map((phase) => (
                <PhaseSection
                  key={phase.id}
                  phase={phase}
                  projectId={project.id}
                  defaultExpanded={phase.is_current}
                  onItemClick={setSelectedItemId}
                  showArchived={showArchived}
                  showSnoozed={showSnoozed}
                  totalCount={phaseItemCounts[phase.id] ?? 0}
                  forceExpandedId={jumpPhaseId}
                  goalNames={goalNames}
                />
              ))
            )}

            <AddPhaseButton
              projectId={project.id}
              moduleId={selectedModuleId}
              nextNumber={nextPhaseNumber}
            />
          </div>
        </div>
      </main>

      <ItemDetailPanel
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  )
}

// ---------- subcomponents (file-scoped) ----------

interface ProjectHeaderProps {
  name: string
  description: string | null
  status: ProjectStatus
  progress: number
  accent: string
}

function ProjectHeader({ name, description, status, progress, accent }: ProjectHeaderProps) {
  const clamped = Math.max(0, Math.min(100, progress))
  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{
                backgroundColor: accent,
                boxShadow: `0 0 0 4px ${accent}22`
              }}
            />
            <h1 className="truncate text-[22px] font-semibold tracking-tight text-foreground">
              {name}
            </h1>
            <span
              className={`ml-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium capitalize ${PROJECT_STATUS_CHIP[status]}`}
            >
              {status}
            </span>
          </div>
          {description && (
            <p className="mt-1.5 line-clamp-2 max-w-2xl text-[13px] text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <IconLink
            to="./goals"
            label="Goals"
            icon={<Target className="h-4 w-4" />}
          />
          <IconLink
            to="./decisions"
            label="Decisions log"
            icon={<GitBranch className="h-4 w-4" />}
          />
          <IconLink to="./timeline" label="Timeline" icon={<Clock className="h-4 w-4" />} />
          <IconLink to="./settings" label="Settings" icon={<Settings2 className="h-4 w-4" />} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-secondary/60">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              backgroundColor: accent,
              boxShadow: `0 0 12px ${accent}55`
            }}
          />
          {clamped > 0 && clamped < 100 && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-1/2 -translate-y-1/2"
              style={{ left: `calc(${clamped}% - 3px)` }}
            >
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="block h-1.5 w-1.5 rounded-full"
                style={{
                  background: accent,
                  boxShadow: `0 0 8px ${accent}ee`
                }}
              />
            </div>
          )}
        </div>
        <span
          className={`w-10 text-right text-[11px] tabular-nums ${
            clamped >= 100 ? '' : 'text-muted-foreground'
          }`}
          style={clamped >= 100 ? { color: accent } : undefined}
        >
          {clamped}%
        </span>
      </div>
    </header>
  )
}

interface IconLinkProps {
  to: string
  label: string
  icon: React.ReactNode
}

function IconLink({ to, label, icon }: IconLinkProps) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-all duration-150 hover:border-border hover:bg-secondary/60 hover:text-foreground"
    >
      {icon}
    </Link>
  )
}

interface ArchivedToggleProps {
  value: boolean
  onChange: (v: boolean) => void
}

function ArchivedToggle({ value, onChange }: ArchivedToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
        value
          ? 'border-foreground/20 bg-foreground/5 text-foreground'
          : 'border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground'
      }`}
    >
      <Archive className="h-3.5 w-3.5" />
      Show archived
    </button>
  )
}

function SnoozedToggle({ value, onChange }: ArchivedToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
        value
          ? 'border-foreground/20 bg-foreground/5 text-foreground'
          : 'border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground'
      }`}
    >
      <Moon className="h-3.5 w-3.5" />
      Show snoozed
    </button>
  )
}

interface GroupedPhasesProps {
  grouped: Map<string | null, Phase[]>
  moduleLookup: Map<string, Module>
  modules: Module[]
  projectId: string
  onItemClick: (id: string) => void
  showArchived: boolean
  showSnoozed: boolean
  phaseItemCounts: Record<string, number>
  forceExpandedId: string | null
  goalNames: Record<string, string>
}

function GroupedPhases({
  grouped,
  moduleLookup,
  modules,
  projectId,
  onItemClick,
  showArchived,
  showSnoozed,
  phaseItemCounts,
  forceExpandedId,
  goalNames
}: GroupedPhasesProps) {
  // Order: iterate modules by sort_order; then any phases with null module_id last.
  const sortedModules = [...modules].sort((a, b) => a.sort_order - b.sort_order)
  const nullBucket = grouped.get(null) ?? []

  const sections: Array<{ key: string; title: string | null; phases: Phase[] }> = []
  for (const m of sortedModules) {
    const ps = grouped.get(m.id)
    if (ps && ps.length > 0) {
      sections.push({ key: m.id, title: m.name, phases: ps })
    }
  }
  if (nullBucket.length > 0) {
    sections.push({ key: '__null__', title: 'Unassigned', phases: nullBucket })
  }

  if (sections.length === 0) {
    return <EmptyPhasesState />
  }

  return (
    <div className="flex flex-col gap-7">
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-3">
          {section.title && (
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                {section.title}
              </span>
              <span className="h-px flex-1 bg-border/50" />
            </div>
          )}
          <div className="flex flex-col gap-3">
            {section.phases.map((phase) => (
              <PhaseSection
                key={phase.id}
                phase={phase}
                projectId={projectId}
                defaultExpanded={phase.is_current}
                onItemClick={onItemClick}
                showArchived={showArchived}
                showSnoozed={showSnoozed}
                totalCount={phaseItemCounts[phase.id] ?? 0}
                forceExpandedId={forceExpandedId}
                goalNames={goalNames}
              />
            ))}
          </div>
        </div>
      ))}
      {/* Suppress unused warning */}
      <span className="hidden">{moduleLookup.size}</span>
    </div>
  )
}

function EmptyPhasesState() {
  return (
    <div className="relative flex flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border border-dashed border-border/60 bg-card/20 px-6 py-16 text-center">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{ opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)'
        }}
      />
      <motion.div
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-secondary/40 text-muted-foreground"
      >
        <Clock className="h-4 w-4" strokeWidth={1.75} />
      </motion.div>
      <span className="relative text-[13.5px] font-medium text-foreground">
        Every project needs a first step
      </span>
      <span className="relative text-[12px] text-muted-foreground">
        Add a phase below to start organizing work.
      </span>
    </div>
  )
}

// Mobile horizontal module tab bar
interface ModuleTabBarProps {
  modules: Module[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

function ModuleTabBar({ modules, selectedId, onSelect }: ModuleTabBarProps) {
  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order)
  return (
    <div className="sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-border/60 bg-background/70 px-4 py-2.5 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <TabPill active={selectedId === null} onClick={() => onSelect(null)}>
        All
      </TabPill>
      {sorted.map((m) => (
        <TabPill key={m.id} active={selectedId === m.id} onClick={() => onSelect(m.id)}>
          {m.name}
        </TabPill>
      ))}
    </div>
  )
}

function TabPill({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
        active
          ? 'border-foreground/20 bg-foreground/5 text-foreground'
          : 'border-border/60 bg-card/30 text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

// Mark setSelectedItemId as intentionally used to silence noUnusedLocals if strict.
// (The destructure `const [, setSelectedItemId]` already sidesteps the value-unused warning.)
