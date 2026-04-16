import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  ArrowRightLeft,
  Check,
  ChevronDown,
  CirclePlus,
  Filter,
  Flag,
  Layers,
  Link2,
  Link2Off,
  Pencil,
  Play,
  Search,
  Sparkles,
  X
} from 'lucide-react'
import { List, type RowComponentProps } from 'react-window'
import { activityRepo } from '@/repos/activity'
import { projectsRepo } from '@/repos/projects'
import { supabase } from '@/lib/supabase'
import { estimateHeight } from '@/lib/pretext'
import type { ActivityKind, ActivityRow, Project } from '@/types/db'

/* ------------------------------------------------------------------ *
 * Activity sentence rendering
 * ------------------------------------------------------------------ */

const asString = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined

export function renderActivity(row: ActivityRow): string {
  const p = row.payload ?? {}
  switch (row.kind) {
    case 'item_created':
      return `Added item "${asString(p.title) ?? 'untitled'}"`
    case 'status_changed':
      return `Moved ${asString(p.from) ?? '—'} → ${asString(p.to) ?? '—'}`
    case 'phase_created':
      return `Created ${asString(p.name) ?? 'phase'}`
    case 'phase_completed':
      return `Completed ${asString(p.name) ?? 'phase'}`
    case 'phase_activated':
      return `Activated ${asString(p.name) ?? 'phase'}`
    case 'item_updated':
      return `Updated ${asString(p.field) ?? 'item'}`
    case 'item_archived':
      return 'Archived item'
    case 'item_unarchived':
      return 'Restored item'
    case 'item_linked':
      return 'Linked to another item'
    case 'item_unlinked':
      return 'Unlinked item'
    case 'item_moved':
      return 'Moved to another phase'
    case 'module_created':
      return `Created module "${asString(p.name) ?? 'module'}"`
    case 'module_archived':
      return 'Archived module'
    default:
      // Exhaustiveness safety net: any unknown kind echoes back verbatim.
      return (row as ActivityRow).kind
  }
}

/* ------------------------------------------------------------------ *
 * Kind metadata: icon + accent class
 * ------------------------------------------------------------------ */

interface KindMeta {
  Icon: typeof CirclePlus
  label: string
  tint: string // tailwind classes for bg + text
}

const KIND_META: Record<ActivityKind, KindMeta> = {
  item_created: {
    Icon: CirclePlus,
    label: 'Item created',
    tint: 'bg-emerald-500/10 text-emerald-300/90 ring-emerald-500/20'
  },
  item_updated: {
    Icon: Pencil,
    label: 'Item updated',
    tint: 'bg-sky-500/10 text-sky-300/90 ring-sky-500/20'
  },
  item_archived: {
    Icon: Archive,
    label: 'Item archived',
    tint: 'bg-stone-500/10 text-stone-300/90 ring-stone-500/20'
  },
  item_unarchived: {
    Icon: ArchiveRestore,
    label: 'Item restored',
    tint: 'bg-stone-500/10 text-stone-200/90 ring-stone-500/20'
  },
  status_changed: {
    Icon: ArrowRightLeft,
    label: 'Status changed',
    tint: 'bg-violet-500/10 text-violet-300/90 ring-violet-500/20'
  },
  item_moved: {
    Icon: ArrowRightLeft,
    label: 'Item moved',
    tint: 'bg-violet-500/10 text-violet-300/90 ring-violet-500/20'
  },
  phase_created: {
    Icon: Flag,
    label: 'Phase created',
    tint: 'bg-amber-500/10 text-amber-200/90 ring-amber-500/20'
  },
  phase_completed: {
    Icon: Check,
    label: 'Phase completed',
    tint: 'bg-teal-500/10 text-teal-300/90 ring-teal-500/20'
  },
  phase_activated: {
    Icon: Play,
    label: 'Phase activated',
    tint: 'bg-amber-500/10 text-amber-200/90 ring-amber-500/20'
  },
  module_created: {
    Icon: Layers,
    label: 'Module created',
    tint: 'bg-rose-500/10 text-rose-300/90 ring-rose-500/20'
  },
  module_archived: {
    Icon: Archive,
    label: 'Module archived',
    tint: 'bg-rose-500/10 text-rose-200/80 ring-rose-500/20'
  },
  item_linked: {
    Icon: Link2,
    label: 'Item linked',
    tint: 'bg-indigo-500/10 text-indigo-300/90 ring-indigo-500/20'
  },
  item_unlinked: {
    Icon: Link2Off,
    label: 'Item unlinked',
    tint: 'bg-indigo-500/10 text-indigo-200/80 ring-indigo-500/20'
  }
}

const ALL_KINDS: ActivityKind[] = Object.keys(KIND_META) as ActivityKind[]

/* ------------------------------------------------------------------ *
 * Date helpers
 * ------------------------------------------------------------------ */

const relativeTime = (isoDate: string): string => {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 45) return 'just now'
  if (seconds < 90) return '1m ago'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.round(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.round(days / 365)
  return `${years}y ago`
}

const dayKey = (iso: string): string => {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dayLabel = (key: string): string => {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayKey = `${y}-${m}-${d}`

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yyKey = `${yesterday.getFullYear()}-${String(
    yesterday.getMonth() + 1
  ).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (key === todayKey) return 'Today'
  if (key === yyKey) return 'Yesterday'

  const parsed = new Date(`${key}T00:00:00`)
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  })
}

const daySubtitle = (key: string): string => {
  const parsed = new Date(`${key}T00:00:00`)
  return parsed.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

/* ------------------------------------------------------------------ *
 * Flattened "virtual rows": either a day header or an entry.
 * ------------------------------------------------------------------ */

type VirtualRow =
  | { kind: 'day'; key: string; dayKey: string }
  | {
      kind: 'entry'
      key: string
      row: ActivityRow
      sentence: string
      isFirstOfDay: boolean
      isLastOfDay: boolean
    }

type RangeOption = '7' | '30' | 'all'

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

const LIST_FONT_SIZE = 13
const LIST_LINE_HEIGHT = 20
const ENTRY_V_PADDING = 28 // top+bottom padding inside the row card
const ENTRY_META_HEIGHT = 18 // relative-time + label meta row
const DAY_HEADER_HEIGHT = 76

export function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [range, setRange] = useState<RangeOption>('all')
  const [selectedKinds, setSelectedKinds] = useState<Set<ActivityKind>>(
    () => new Set(ALL_KINDS)
  )
  const [query, setQuery] = useState('')
  const [kindMenuOpen, setKindMenuOpen] = useState(false)
  const kindMenuRef = useRef<HTMLDivElement | null>(null)

  // Realtime highlight
  const [flashIds, setFlashIds] = useState<Set<string>>(() => new Set())

  // Measure list container
  const listAreaRef = useRef<HTMLDivElement | null>(null)
  const [listSize, setListSize] = useState<{ width: number; height: number }>({
    width: 640,
    height: 600
  })

  /* ------------------------- initial load --------------------------- */

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      projectsRepo.get(projectId),
      activityRepo.listByProject(projectId, 500)
    ])
      .then(([p, r]) => {
        if (cancelled) return
        setProject(p)
        setRows(r)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  /* ------------------------- realtime ------------------------------ */

  useEffect(() => {
    if (!projectId) return
    const channel = supabase
      .channel(`activity_log:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_log',
          filter: `project_id=eq.${projectId}`
        },
        (payload) => {
          const incoming = payload.new as ActivityRow
          setRows((prev) => {
            if (prev.some((r) => r.id === incoming.id)) return prev
            return [incoming, ...prev]
          })
          setFlashIds((prev) => {
            const next = new Set(prev)
            next.add(incoming.id)
            return next
          })
          // Clear flash after the highlight animation ends.
          window.setTimeout(() => {
            setFlashIds((prev) => {
              if (!prev.has(incoming.id)) return prev
              const next = new Set(prev)
              next.delete(incoming.id)
              return next
            })
          }, 2200)
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [projectId])

  /* ------------------------- resize observer ----------------------- */

  useLayoutEffect(() => {
    const el = listAreaRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setListSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(320, Math.floor(rect.height))
      })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ------------------------- close kind menu on outside click ------ */

  useEffect(() => {
    if (!kindMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!kindMenuRef.current?.contains(e.target as Node)) {
        setKindMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [kindMenuOpen])

  /* ------------------------- filtering ----------------------------- */

  const filteredRows = useMemo(() => {
    const now = Date.now()
    const windowMs =
      range === '7'
        ? 7 * 24 * 60 * 60 * 1000
        : range === '30'
          ? 30 * 24 * 60 * 60 * 1000
          : Infinity
    const q = query.trim().toLowerCase()

    return rows.filter((r) => {
      if (!selectedKinds.has(r.kind)) return false
      if (windowMs !== Infinity) {
        const age = now - new Date(r.created_at).getTime()
        if (age > windowMs) return false
      }
      if (q) {
        const sentence = renderActivity(r).toLowerCase()
        if (!sentence.includes(q)) return false
      }
      return true
    })
  }, [rows, selectedKinds, range, query])

  /* ------------------------- virtual row list ---------------------- */

  const virtualRows = useMemo<VirtualRow[]>(() => {
    const out: VirtualRow[] = []
    let lastDay: string | null = null
    // rows are newest-first already
    for (let i = 0; i < filteredRows.length; i++) {
      const r = filteredRows[i]
      const k = dayKey(r.created_at)
      const isFirstOfDay = k !== lastDay
      if (isFirstOfDay) {
        out.push({ kind: 'day', key: `day-${k}`, dayKey: k })
      }
      const next = filteredRows[i + 1]
      const isLastOfDay = !next || dayKey(next.created_at) !== k
      out.push({
        kind: 'entry',
        key: `e-${r.id}`,
        row: r,
        sentence: renderActivity(r),
        isFirstOfDay,
        isLastOfDay
      })
      lastDay = k
    }
    return out
  }, [filteredRows])

  /* ------------------------- height calc --------------------------- */

  const entryTextWidth = Math.max(200, listSize.width - 140) // rail + time col + padding

  const getRowHeight = useCallback(
    (index: number): number => {
      const v = virtualRows[index]
      if (!v) return 56
      if (v.kind === 'day') return DAY_HEADER_HEIGHT
      const textHeight = estimateHeight(v.sentence, {
        width: entryTextWidth,
        fontSize: LIST_FONT_SIZE,
        lineHeight: LIST_LINE_HEIGHT
      })
      return Math.max(56, textHeight + ENTRY_META_HEIGHT + ENTRY_V_PADDING)
    },
    [virtualRows, entryTextWidth]
  )

  /* ------------------------- kind selection helpers ---------------- */

  const toggleKind = (k: ActivityKind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }
  const selectAllKinds = () => setSelectedKinds(new Set(ALL_KINDS))
  const clearKinds = () => setSelectedKinds(new Set())

  const kindSelectionLabel = useMemo(() => {
    if (selectedKinds.size === ALL_KINDS.length) return 'All kinds'
    if (selectedKinds.size === 0) return 'No kinds'
    if (selectedKinds.size === 1) {
      const k = Array.from(selectedKinds)[0]
      return KIND_META[k].label
    }
    return `${selectedKinds.size} kinds`
  }, [selectedKinds])

  /* ------------------------- render -------------------------------- */

  const showEmpty = !loading && virtualRows.length === 0
  const useVirtualList = virtualRows.length >= 50

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[hsl(240,12%,4%)] via-[hsl(240,10%,5%)] to-[hsl(240,10%,6%)] text-foreground">
      {/* Soft ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[340px]"
        style={{
          background:
            'radial-gradient(900px 300px at 20% -20%, rgba(148,163,184,0.10), transparent 60%), radial-gradient(600px 220px at 80% -40%, rgba(99,102,241,0.08), transparent 60%)'
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex-shrink-0 border-b border-white/5 px-6 pt-6 pb-5 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link
            to={projectId ? `/p/${projectId}` : '/'}
            className="group inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-muted-foreground transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Back to project"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
              <Sparkles className="h-3 w-3" />
              <span>Activity timeline</span>
            </div>
            <h1 className="mt-1 truncate text-[22px] font-semibold tracking-tight text-foreground">
              <span className="text-muted-foreground/60">Timeline</span>
              <span className="mx-2 text-muted-foreground/40">—</span>
              <span
                style={{
                  color: project?.color ?? undefined
                }}
              >
                {project?.name ?? (loading ? 'Loading…' : 'Untitled project')}
              </span>
            </h1>
          </div>

          <div className="hidden items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.02] px-3 py-1.5 text-[11px] tabular-nums text-muted-foreground/80 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            {filteredRows.length} entr{filteredRows.length === 1 ? 'y' : 'ies'}
          </div>
        </div>
      </header>

      {/* Filter bar */}
      <div className="sticky top-0 z-20 flex-shrink-0 border-b border-white/5 bg-[hsl(240,10%,5%)]/70 px-6 py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date range segmented control */}
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {(
              [
                { v: '7' as const, label: '7d' },
                { v: '30' as const, label: '30d' },
                { v: 'all' as const, label: 'All' }
              ] as const
            ).map((opt) => {
              const active = range === opt.v
              return (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setRange(opt.v)}
                  className={`relative h-7 rounded-full px-3 text-[12px] font-medium tracking-tight transition-colors duration-200 ${
                    active
                      ? 'text-foreground'
                      : 'text-muted-foreground/70 hover:text-foreground/90'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="range-pill"
                      className="absolute inset-0 rounded-full bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.35)]"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 38
                      }}
                    />
                  )}
                  <span className="relative">{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Kind multi-select */}
          <div className="relative" ref={kindMenuRef}>
            <button
              type="button"
              onClick={() => setKindMenuOpen((o) => !o)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[12px] font-medium text-foreground/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06]"
              aria-haspopup="listbox"
              aria-expanded={kindMenuOpen}
            >
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="tracking-tight">{kindSelectionLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                  kindMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            <AnimatePresence>
              {kindMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute left-0 top-[calc(100%+6px)] z-30 w-[240px] overflow-hidden rounded-xl border border-white/10 bg-[hsl(240,10%,7%)]/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur-xl"
                  role="listbox"
                >
                  <div className="flex items-center justify-between border-b border-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    <span>Filter by kind</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-muted-foreground/70 transition-colors hover:text-foreground"
                        onClick={selectAllKinds}
                      >
                        All
                      </button>
                      <span className="text-muted-foreground/30">·</span>
                      <button
                        type="button"
                        className="text-muted-foreground/70 transition-colors hover:text-foreground"
                        onClick={clearKinds}
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto py-1">
                    {ALL_KINDS.map((k) => {
                      const meta = KIND_META[k]
                      const Icon = meta.Icon
                      const active = selectedKinds.has(k)
                      return (
                        <button
                          key={k}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => toggleKind(k)}
                          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-foreground/90 transition-colors hover:bg-white/[0.04]"
                        >
                          <span
                            className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md ring-1 ${meta.tint}`}
                          >
                            <Icon className="h-3 w-3" />
                          </span>
                          <span className="flex-1 truncate">{meta.label}</span>
                          <span
                            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px] transition-colors ${
                              active
                                ? 'bg-foreground text-background'
                                : 'border border-white/15 bg-white/[0.02]'
                            }`}
                          >
                            {active && <Check className="h-3 w-3" />}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Search */}
          <div className="relative ml-auto min-w-[220px] flex-1 md:flex-none md:w-[280px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter entries…"
              className="h-8 w-full rounded-full border border-white/10 bg-white/[0.03] pl-8 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition-colors duration-200 focus:border-white/25 focus:bg-white/[0.06]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List area */}
      <div ref={listAreaRef} className="relative z-0 flex-1 overflow-hidden">
        {loading ? (
          <LoadingState />
        ) : showEmpty ? (
          <EmptyState hasFilter={query.length > 0 || range !== 'all'} />
        ) : useVirtualList ? (
          <List
            rowCount={virtualRows.length}
            rowHeight={getRowHeight}
            rowComponent={VirtualRowRenderer}
            rowProps={{
              virtualRows,
              flashIds
            }}
            overscanCount={6}
            style={{ height: listSize.height, width: '100%' }}
            className="scrollbar-thin"
          />
        ) : (
          <div className="h-full overflow-y-auto px-6 py-2">
            <div className="relative mx-auto max-w-3xl">
              {virtualRows.map((v) =>
                v.kind === 'day' ? (
                  <DayHeader key={v.key} dayKey={v.dayKey} />
                ) : (
                  <EntryRow
                    key={v.key}
                    entry={v}
                    flashing={flashIds.has(v.row.id)}
                  />
                )
              )}
              <div className="h-10" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Virtualized row renderer (react-window v2)
 * ------------------------------------------------------------------ */

interface VirtualRowProps {
  virtualRows: VirtualRow[]
  flashIds: Set<string>
}

function VirtualRowRenderer({
  index,
  style,
  virtualRows,
  flashIds
}: RowComponentProps<VirtualRowProps>) {
  const v = virtualRows[index]
  if (!v) return null
  return (
    <div style={style} className="px-6">
      <div className="mx-auto max-w-3xl">
        {v.kind === 'day' ? (
          <DayHeader dayKey={v.dayKey} />
        ) : (
          <EntryRow entry={v} flashing={flashIds.has(v.row.id)} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Day header
 * ------------------------------------------------------------------ */

function DayHeader({ dayKey: key }: { dayKey: string }) {
  return (
    <div className="pointer-events-none pt-5 pb-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          {dayLabel(key)}
        </h2>
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
          {daySubtitle(key)}
        </span>
        <div className="ml-2 h-px flex-1 bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Entry row — the journal line with left rail, dot, icon, sentence
 * ------------------------------------------------------------------ */

function EntryRow({
  entry,
  flashing
}: {
  entry: Extract<VirtualRow, { kind: 'entry' }>
  flashing: boolean
}) {
  const meta = KIND_META[entry.row.kind]
  const Icon = meta.Icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="relative pl-[72px] pr-2"
    >
      {/* Left rail: hairline + dot */}
      <div
        aria-hidden
        className="absolute left-[24px] top-0 bottom-0 w-px"
        style={{
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0.06))'
        }}
      />
      {/* Kind glyph/dot */}
      <div
        className={`absolute left-[12px] top-[14px] inline-flex h-6 w-6 items-center justify-center rounded-full ring-1 ${meta.tint} shadow-[0_0_0_4px_hsl(240,10%,5%)]`}
        aria-hidden
      >
        <Icon className="h-3 w-3" />
      </div>

      {/* Card */}
      <div
        className={`group relative rounded-[14px] border border-white/[0.06] bg-white/[0.015] px-4 py-3 transition-colors duration-300 hover:border-white/10 hover:bg-white/[0.035] ${
          flashing ? 'axis-flash' : ''
        }`}
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.25)'
        }}
      >
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-medium tabular-nums text-muted-foreground/70">
            {relativeTime(entry.row.created_at)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/40">
            {meta.label}
          </span>
        </div>
        <p
          className="mt-1 text-[13px] leading-[20px] text-foreground/90"
          style={{
            fontFeatureSettings: '"ss01", "cv11"'
          }}
        >
          {entry.sentence}
        </p>
      </div>

      {/* Flash styles (inline keyframes via style tag on first render) */}
      <FlashStyles />
    </motion.div>
  )
}

/* ------------------------------------------------------------------ *
 * Flash keyframes (injected once)
 * ------------------------------------------------------------------ */

let flashStylesInjected = false
function FlashStyles() {
  if (typeof document === 'undefined') return null
  if (flashStylesInjected) return null
  flashStylesInjected = true
  const style = document.createElement('style')
  style.setAttribute('data-axis-timeline-flash', '')
  style.textContent = `
    @keyframes axis-flash {
      0%   { box-shadow: 0 0 0 0 rgba(52,211,153,0.45), inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.25); border-color: rgba(52,211,153,0.45); background-color: rgba(52,211,153,0.06); }
      60%  { box-shadow: 0 0 0 6px rgba(52,211,153,0.00), inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.25); border-color: rgba(52,211,153,0.20); background-color: rgba(52,211,153,0.03); }
      100% { box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0,0,0,0.25); border-color: rgba(255,255,255,0.06); background-color: rgba(255,255,255,0.015); }
    }
    .axis-flash { animation: axis-flash 2.2s cubic-bezier(0.32,0.72,0,1) both; }
  `
  document.head.appendChild(style)
  return null
}

/* ------------------------------------------------------------------ *
 * Loading and empty states
 * ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="mx-auto mt-10 max-w-3xl px-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="mb-3 h-[64px] animate-pulse rounded-[14px] border border-white/[0.05] bg-white/[0.015]"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {hasFilter ? 'No matching activity' : 'Nothing here yet'}
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground/80">
          {hasFilter
            ? 'Adjust the filters or clear the search to see more of the project history.'
            : 'As items, phases, and modules change, the project\u2019s history will appear here.'}
        </p>
      </div>
    </div>
  )
}
