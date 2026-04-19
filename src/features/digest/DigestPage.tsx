import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bug,
  Check,
  ChevronDown,
  CircleDashed,
  ClipboardCopy,
  Flag,
  Lightbulb,
  MessageSquareText,
  Sparkles,
  StickyNote,
  Target
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { projectsRepo } from '@/repos/projects'
import { supabase } from '@/lib/supabase'
import type { Item, ItemType, Project } from '@/types/db'

// ---------- types ----------

interface PhaseLite {
  id: string
  name: string
  target_date: string | null
  project_id: string
}

interface DigestBuckets {
  completedRecently: Item[]
  createdRecently: Item[]
  inProgress: Item[]
  deferred: Item[]
}

type SectionKey =
  | 'completed'
  | 'added'
  | 'inprogress'
  | 'deferred'
  | 'upcoming'
  | 'revisitdue'
  | 'revisitsoon'

// ---------- date helpers ----------

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

function formatHeaderDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function relativeDays(targetISO: string, now: Date): string {
  const target = new Date(targetISO + 'T00:00:00')
  const base = new Date(now.toISOString().slice(0, 10) + 'T00:00:00')
  const diff = Math.round((target.getTime() - base.getTime()) / 86400000)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff < 0) return `${-diff} day${-diff === 1 ? '' : 's'} ago`
  return `in ${diff} day${diff === 1 ? '' : 's'}`
}

// ---------- priority helpers ----------

const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
}

// ---------- iconography ----------

function TypeIcon({ type, className }: { type: ItemType; className?: string }) {
  const cls = className ?? 'h-3.5 w-3.5'
  switch (type) {
    case 'bug':
      return <Bug className={cls} strokeWidth={1.75} />
    case 'feature':
      return <Sparkles className={cls} strokeWidth={1.75} />
    case 'feedback':
      return <MessageSquareText className={cls} strokeWidth={1.75} />
    case 'decision':
      return <Flag className={cls} strokeWidth={1.75} />
    case 'note':
    default:
      return <StickyNote className={cls} strokeWidth={1.75} />
  }
}

// ---------- markdown builder ----------

function buildMarkdown(
  buckets: DigestBuckets,
  upcoming: PhaseLite[],
  revisitDue: Item[],
  revisitSoon: Item[],
  projectById: Map<string, Project>,
  phaseById: Map<string, PhaseLite>,
  now: Date
): string {
  const lines: string[] = []
  lines.push(`# Weekly Digest — ${formatHeaderDate(now)}`)
  lines.push('')

  const trail = (item: Item): string => {
    const phase = phaseById.get(item.phase_id)
    const project = phase ? projectById.get(phase.project_id) : undefined
    const pName = project?.name ?? 'Unknown project'
    const phName = phase?.name ?? 'Unknown phase'
    return `${pName} · ${phName}: ${item.title}`
  }

  const section = (title: string, items: Item[]) => {
    lines.push(`## ${title} (${items.length})`)
    if (items.length === 0) {
      lines.push('- _None_')
    } else {
      for (const i of items) lines.push(`- ${trail(i)}`)
    }
    lines.push('')
  }

  if (revisitDue.length > 0) section('Due to revisit', revisitDue)
  section('Completed this week', buckets.completedRecently)
  section('Added this week', buckets.createdRecently)
  section('In progress', buckets.inProgress)
  if (buckets.deferred.length > 0) section('Blocked / deferred', buckets.deferred)
  if (revisitSoon.length > 0) section('Coming up to revisit (next 7 days)', revisitSoon)

  lines.push(`## Upcoming phase targets (next 14 days) (${upcoming.length})`)
  if (upcoming.length === 0) {
    lines.push('- _None_')
  } else {
    for (const ph of upcoming) {
      const project = projectById.get(ph.project_id)
      const pName = project?.name ?? 'Unknown project'
      const dateStr = ph.target_date
        ? `${formatLongDate(new Date(ph.target_date + 'T00:00:00'))} (${relativeDays(ph.target_date, now)})`
        : '—'
      lines.push(`- ${pName} · ${ph.name} — ${dateStr}`)
    }
  }
  lines.push('')

  return lines.join('\n')
}

// ---------- primitive UI ----------

function ProjectDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{
        backgroundColor: color ?? 'hsl(var(--muted-foreground) / 0.55)',
        boxShadow: color
          ? `0 0 0 2px ${color}14, 0 0 6px ${color}40`
          : undefined
      }}
    />
  )
}

function MetaTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
      {children}
    </span>
  )
}

// ---------- item row ----------

function ItemRow({
  item,
  projectById,
  phaseById
}: {
  item: Item
  projectById: Map<string, Project>
  phaseById: Map<string, PhaseLite>
}) {
  const phase = phaseById.get(item.phase_id)
  const project = phase ? projectById.get(phase.project_id) : undefined
  const href = project ? `/p/${project.id}#item=${item.id}` : '#'

  return (
    <a
      href={href}
      className="group relative flex items-start gap-3 px-1 py-3 -mx-1 rounded-md transition-colors duration-200 hover:bg-foreground/[0.025]"
    >
      <span className="mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-secondary/30 text-muted-foreground/80 transition-colors group-hover:text-foreground/80">
        <TypeIcon type={item.type} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[13.5px] font-medium tracking-tight text-foreground/90 group-hover:text-foreground">
            {item.title}
          </p>
          {item.priority === 'critical' && <MetaTag>critical</MetaTag>}
          {item.priority === 'high' && <MetaTag>high</MetaTag>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-5 text-muted-foreground/80">
          <ProjectDot color={project?.color ?? null} />
          <span className="truncate">
            in{' '}
            <span className="text-muted-foreground">
              {project?.name ?? 'Unknown project'}
            </span>
            <span className="mx-1 text-muted-foreground/40">→</span>
            <span className="text-muted-foreground">
              {phase?.name ?? 'Unknown phase'}
            </span>
          </span>
        </div>
      </div>
    </a>
  )
}

// ---------- upcoming phase row ----------

function UpcomingRow({
  phase,
  project,
  now
}: {
  phase: PhaseLite
  project?: Project
  now: Date
}) {
  const href = project ? `/p/${project.id}` : '#'
  const d = phase.target_date
    ? formatLongDate(new Date(phase.target_date + 'T00:00:00'))
    : '—'
  const rel = phase.target_date ? relativeDays(phase.target_date, now) : ''
  const isSoon = phase.target_date
    ? (new Date(phase.target_date + 'T00:00:00').getTime() -
        new Date(now.toISOString().slice(0, 10) + 'T00:00:00').getTime()) /
        86400000 <=
      3
    : false

  return (
    <a
      href={href}
      className="group flex items-start gap-3 px-1 py-3 -mx-1 rounded-md transition-colors duration-200 hover:bg-foreground/[0.025]"
    >
      <span className="mt-[3px] flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-secondary/30 text-muted-foreground/80 transition-colors group-hover:text-foreground/80">
        <Target className="h-3.5 w-3.5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="truncate text-[13.5px] font-medium tracking-tight text-foreground/90 group-hover:text-foreground">
            {phase.name}
          </p>
          {isSoon && <MetaTag>soon</MetaTag>}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-5 text-muted-foreground/80">
          <ProjectDot color={project?.color ?? null} />
          <span className="truncate">
            <span className="text-muted-foreground">
              {project?.name ?? 'Unknown project'}
            </span>
            <span className="mx-1 text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">{d}</span>
            {rel && (
              <>
                <span className="mx-1 text-muted-foreground/40">·</span>
                <span className="text-muted-foreground/70">{rel}</span>
              </>
            )}
          </span>
        </div>
      </div>
    </a>
  )
}

// ---------- section shell ----------

function Section({
  label,
  count,
  description,
  emptyText,
  children
}: {
  label: string
  count: number
  description: string
  emptyText: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-border/50 pt-8 first:border-t-0 first:pt-0">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {label}
          </h2>
          <span className="text-[12px] font-medium tabular-nums text-muted-foreground/70">
            {count}
          </span>
        </div>
        <p className="hidden text-[12px] leading-5 text-muted-foreground/70 sm:block">
          {description}
        </p>
      </header>
      {count === 0 ? (
        <div className="flex items-center gap-2 py-2 text-[12.5px] text-muted-foreground/60">
          <CircleDashed className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>{emptyText}</span>
        </div>
      ) : (
        <div className="divide-y divide-border/30">{children}</div>
      )}
    </section>
  )
}

// ---------- collapsible list ----------

function CollapsibleList<T>({
  items,
  render,
  sectionKey,
  expanded,
  onToggle
}: {
  items: T[]
  render: (t: T, i: number) => React.ReactNode
  sectionKey: SectionKey
  expanded: Record<SectionKey, boolean>
  onToggle: (k: SectionKey) => void
}) {
  const isExpanded = expanded[sectionKey]
  const shown = items.length > 10 && !isExpanded ? items.slice(0, 10) : items
  const hiddenCount = items.length - shown.length
  return (
    <>
      {shown.map((t, i) => render(t, i))}
      {hiddenCount > 0 && (
        <div className="pt-3">
          <button
            type="button"
            onClick={() => onToggle(sectionKey)}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3" strokeWidth={2.25} />
            Show {hiddenCount} more
          </button>
        </div>
      )}
      {isExpanded && items.length > 10 && (
        <div className="pt-3">
          <button
            type="button"
            onClick={() => onToggle(sectionKey)}
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium tracking-tight text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className="h-3 w-3 rotate-180" strokeWidth={2.25} />
            Collapse
          </button>
        </div>
      )}
    </>
  )
}

// ---------- skeleton ----------

function SkeletonSection({ rows }: { rows: number }) {
  return (
    <section className="border-t border-border/50 pt-8 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-baseline gap-3">
        <div className="h-4 w-40 animate-pulse rounded bg-secondary/60" />
        <div className="h-3 w-6 animate-pulse rounded bg-secondary/40" />
      </div>
      <div className="space-y-0 divide-y divide-border/30">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <div className="h-6 w-6 shrink-0 animate-pulse rounded-md bg-secondary/50" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-3/5 animate-pulse rounded bg-secondary/60" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-secondary/40" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- copy button ----------

function CopyButton({ onCopy }: { onCopy: () => Promise<boolean> }) {
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    const ok = await onCopy()
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group relative inline-flex h-9 items-center gap-2 rounded-full border border-border/80 bg-secondary/40 px-3.5 text-[12.5px] font-medium tracking-tight text-foreground/90 transition-all duration-300 hover:border-border hover:bg-secondary/70"
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="check"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center text-emerald-400"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <ClipboardCopy className="h-3.5 w-3.5" strokeWidth={1.75} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span>{copied ? 'Copied' : 'Copy as Markdown'}</span>
    </button>
  )
}

function Toast({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-4 py-2 text-[12.5px] font-medium tracking-tight text-foreground shadow-[0_10px_40px_-12px_rgba(0,0,0,0.55),0_1px_0_0_rgba(255,255,255,0.04)_inset] backdrop-blur-md">
            <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={2.5} />
            Copied.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ---------- main page ----------

export function DigestPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [buckets, setBuckets] = useState<DigestBuckets>({
    completedRecently: [],
    createdRecently: [],
    inProgress: [],
    deferred: []
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [phases, setPhases] = useState<PhaseLite[]>([])
  const [upcoming, setUpcoming] = useState<PhaseLite[]>([])
  const [revisitDue, setRevisitDue] = useState<Item[]>([])
  const [revisitSoon, setRevisitSoon] = useState<Item[]>([])
  const [toast, setToast] = useState(false)
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    completed: false,
    added: false,
    inprogress: false,
    deferred: false,
    upcoming: false,
    revisitdue: false,
    revisitsoon: false
  })

  const now = useMemo(() => new Date(), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [digest, projectList, phasesRes, upcomingRes, due, soon] =
          await Promise.all([
            itemsRepo.listDigest(7),
            projectsRepo.list(),
            supabase.from('phases').select('id,name,target_date,project_id'),
            supabase
              .from('phases')
              .select('id,name,target_date,project_id')
              .not('target_date', 'is', null)
              .gte('target_date', todayISO())
              .lte('target_date', plusDaysISO(14))
              .order('target_date', { ascending: true }),
            itemsRepo.listRevisitDue().catch(() => [] as Item[]),
            itemsRepo.listRevisitSoon(7).catch(() => [] as Item[])
          ])
        if (cancelled) return
        if (phasesRes.error) throw phasesRes.error
        if (upcomingRes.error) throw upcomingRes.error
        setBuckets(digest)
        setProjects(projectList)
        setPhases((phasesRes.data ?? []) as PhaseLite[])
        setUpcoming((upcomingRes.data ?? []) as PhaseLite[])
        setRevisitDue(due)
        setRevisitSoon(soon)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load digest')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const projectById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  const phaseById = useMemo(() => {
    const m = new Map<string, PhaseLite>()
    for (const ph of phases) m.set(ph.id, ph)
    return m
  }, [phases])

  const inProgressSorted = useMemo(() => {
    return [...buckets.inProgress].sort((a, b) => {
      const pa = PRIORITY_WEIGHT[a.priority] ?? 0
      const pb = PRIORITY_WEIGHT[b.priority] ?? 0
      if (pb !== pa) return pb - pa
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    })
  }, [buckets.inProgress])

  const toggleExpanded = (k: SectionKey) =>
    setExpanded((prev) => ({ ...prev, [k]: !prev[k] }))

  async function handleCopy(): Promise<boolean> {
    try {
      const md = buildMarkdown(
        { ...buckets, inProgress: inProgressSorted },
        upcoming,
        revisitDue,
        revisitSoon,
        projectById,
        phaseById,
        now
      )
      await navigator.clipboard.writeText(md)
      setToast(true)
      setTimeout(() => setToast(false), 2000)
      return true
    } catch {
      return false
    }
  }

  return (
    <div className="relative min-h-full">
      {/* Ambient accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -left-24 top-[-120px] h-[320px] w-[320px] rounded-full opacity-[0.14] blur-3xl"
          style={{
            background:
              'radial-gradient(circle at center, #6366f1 0%, transparent 60%)'
          }}
        />
        <div
          className="absolute right-[-80px] top-[160px] h-[260px] w-[260px] rounded-full opacity-[0.10] blur-3xl"
          style={{
            background:
              'radial-gradient(circle at center, #a855f7 0%, transparent 60%)'
          }}
        />
      </div>

      <div className="relative mx-auto max-w-[780px] px-6 py-10 md:px-8 md:py-14">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
              <Lightbulb className="h-3 w-3" strokeWidth={2.25} />
              Weekly review
            </div>
            <h1 className="text-[30px] font-semibold tracking-[-0.025em] text-foreground">
              Weekly digest
            </h1>
            <p className="text-[13px] leading-5 text-muted-foreground">
              Last 7 days, ending {formatHeaderDate(now)}.
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <CopyButton onCopy={handleCopy} />
          </div>
        </motion.header>

        {/* Body */}
        {error ? (
          <div className="rounded-[var(--radius)] border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive-foreground/90">
            {error}
          </div>
        ) : loading ? (
          <div className="space-y-10">
            <SkeletonSection rows={4} />
            <SkeletonSection rows={5} />
            <SkeletonSection rows={3} />
            <SkeletonSection rows={3} />
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-10"
          >
            {revisitDue.length > 0 && (
              <Section
                label="Due to revisit"
                count={revisitDue.length}
                description="Items you set a revisit date on — today or earlier."
                emptyText="Nothing due to revisit."
              >
                <CollapsibleList
                  items={revisitDue}
                  sectionKey="revisitdue"
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  render={(item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      projectById={projectById}
                      phaseById={phaseById}
                    />
                  )}
                />
              </Section>
            )}

            <Section
              label="Completed this week"
              count={buckets.completedRecently.length}
              description="Shipped, resolved, or marked done."
              emptyText="Nothing completed this week."
            >
              <CollapsibleList
                items={buckets.completedRecently}
                sectionKey="completed"
                expanded={expanded}
                onToggle={toggleExpanded}
                render={(item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    projectById={projectById}
                    phaseById={phaseById}
                  />
                )}
              />
            </Section>

            <Section
              label="Added this week"
              count={buckets.createdRecently.length}
              description="Newly captured work, newest first."
              emptyText="Nothing added this week."
            >
              <CollapsibleList
                items={buckets.createdRecently}
                sectionKey="added"
                expanded={expanded}
                onToggle={toggleExpanded}
                render={(item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    projectById={projectById}
                    phaseById={phaseById}
                  />
                )}
              />
            </Section>

            <Section
              label="In progress"
              count={inProgressSorted.length}
              description="Active work, ranked by priority."
              emptyText="Nothing in progress right now."
            >
              <CollapsibleList
                items={inProgressSorted}
                sectionKey="inprogress"
                expanded={expanded}
                onToggle={toggleExpanded}
                render={(item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    projectById={projectById}
                    phaseById={phaseById}
                  />
                )}
              />
            </Section>

            {buckets.deferred.length > 0 && (
              <Section
                label="Blocked / deferred"
                count={buckets.deferred.length}
                description="Parked or waiting on something."
                emptyText="Nothing blocked this week."
              >
                <CollapsibleList
                  items={buckets.deferred}
                  sectionKey="deferred"
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  render={(item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      projectById={projectById}
                      phaseById={phaseById}
                    />
                  )}
                />
              </Section>
            )}

            {revisitSoon.length > 0 && (
              <Section
                label="Coming up to revisit"
                count={revisitSoon.length}
                description="Revisit dates landing in the next 7 days."
                emptyText="No revisits coming up."
              >
                <CollapsibleList
                  items={revisitSoon}
                  sectionKey="revisitsoon"
                  expanded={expanded}
                  onToggle={toggleExpanded}
                  render={(item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      projectById={projectById}
                      phaseById={phaseById}
                    />
                  )}
                />
              </Section>
            )}

            <Section
              label="Upcoming phase targets"
              count={upcoming.length}
              description="Target dates landing in the next 14 days."
              emptyText="Nothing on deck in the next two weeks."
            >
              <CollapsibleList
                items={upcoming}
                sectionKey="upcoming"
                expanded={expanded}
                onToggle={toggleExpanded}
                render={(ph) => (
                  <UpcomingRow
                    key={ph.id}
                    phase={ph}
                    project={projectById.get(ph.project_id)}
                    now={now}
                  />
                )}
              />
            </Section>
          </motion.div>
        )}
      </div>

      <Toast show={toast} />
    </div>
  )
}
