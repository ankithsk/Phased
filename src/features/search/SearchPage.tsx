import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search,
  Sparkles,
  Bug,
  MessageCircle,
  FileText,
  GitBranch,
  Loader2,
  X,
  Archive,
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { projectsRepo } from '@/repos/projects'
import { supabase } from '@/lib/supabase'
import type {
  Item,
  ItemPriority,
  ItemStatus,
  ItemType,
  Project,
} from '@/types/db'

// ——— Filter option config ———————————————————————————————————
const TYPE_OPTIONS: ReadonlyArray<{ value: ItemType; label: string }> = [
  { value: 'feature', label: 'Feature' },
  { value: 'bug', label: 'Bug' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'note', label: 'Note' },
  { value: 'decision', label: 'Decision' },
]

const PRIORITY_OPTIONS: ReadonlyArray<{ value: ItemPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const STATUS_OPTIONS: ReadonlyArray<{ value: ItemStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'deferred', label: 'Deferred' },
]

const TYPE_ICON: Record<ItemType, typeof Sparkles> = {
  feature: Sparkles,
  bug: Bug,
  feedback: MessageCircle,
  note: FileText,
  decision: GitBranch,
}

const PRIORITY_DOT: Record<ItemPriority, string> = {
  low: '#8892a6',
  medium: '#9bb0c6',
  high: '#d4a373',
  critical: '#d08b96',
}

const STATUS_BADGE: Record<ItemStatus, { label: string; color: string; bg: string }> = {
  open: { label: 'Open', color: '#cfd7e3', bg: 'rgba(255,255,255,0.06)' },
  'in-progress': {
    label: 'In progress',
    color: '#b8d4ea',
    bg: 'rgba(120, 170, 210, 0.12)',
  },
  done: { label: 'Done', color: '#b8dac5', bg: 'rgba(110, 180, 140, 0.12)' },
  deferred: {
    label: 'Deferred',
    color: '#d8c6a8',
    bg: 'rgba(195, 165, 110, 0.12)',
  },
}

type PhaseLookupRow = { id: string; project_id: string }

function highlightMatches(text: string, query: string): ReactNode {
  if (!query.trim()) return text
  const q = query.trim()
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const parts: ReactNode[] = []
  let cursor = 0
  let idx = lower.indexOf(needle, cursor)
  let key = 0
  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx))
    parts.push(
      <mark
        key={`m-${key++}`}
        className="bg-white/[0.14] text-white rounded px-0.5"
        style={{ fontStyle: 'inherit' }}
      >
        {text.slice(idx, idx + needle.length)}
      </mark>
    )
    cursor = idx + needle.length
    idx = lower.indexOf(needle, cursor)
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

// ——— Page ————————————————————————————————————————————————
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get('q') ?? ''

  const [input, setInput] = useState(q)
  const [debounced, setDebounced] = useState(q)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phaseToProject, setPhaseToProject] = useState<Record<string, string>>({})

  // Filters (client-side)
  const [types, setTypes] = useState<Set<ItemType>>(new Set())
  const [priorities, setPriorities] = useState<Set<ItemPriority>>(new Set())
  const [statuses, setStatuses] = useState<Set<ItemStatus>>(new Set())
  const [includeArchived, setIncludeArchived] = useState(false)

  // Sync input → URL (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = input.trim()
      if (trimmed === (params.get('q') ?? '')) return
      const next = new URLSearchParams(params)
      if (trimmed) next.set('q', trimmed)
      else next.delete('q')
      setParams(next, { replace: true })
    }, 180)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input])

  // URL → debounced query
  useEffect(() => {
    setDebounced(q)
    if (input !== q) setInput(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  // Load projects + phase lookup once
  useEffect(() => {
    let cancelled = false
    projectsRepo
      .list()
      .then((list) => {
        if (!cancelled) setProjects(list)
      })
      .catch(() => {
        /* ignore */
      })
    supabase
      .from('phases')
      .select('id,project_id')
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const map: Record<string, string> = {}
        for (const row of data as PhaseLookupRow[]) map[row.id] = row.project_id
        setPhaseToProject(map)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Run search when debounced query or includeArchived changes
  useEffect(() => {
    const trimmed = debounced.trim()
    if (!trimmed) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    itemsRepo
      .search(trimmed, includeArchived)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, includeArchived])

  const projectById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  // Apply client-side filters
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (types.size && !types.has(it.type)) return false
      if (priorities.size && !priorities.has(it.priority)) return false
      if (statuses.size && !statuses.has(it.status)) return false
      return true
    })
  }, [items, types, priorities, statuses])

  // Group by project
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of filteredItems) {
      const pid = phaseToProject[it.phase_id] ?? '__none__'
      const arr = map.get(pid) ?? []
      arr.push(it)
      map.set(pid, arr)
    }
    // Sort groups: projects in their listed order, then unknown
    const ordered: Array<{ project: Project | null; items: Item[] }> = []
    for (const p of projects) {
      const arr = map.get(p.id)
      if (arr && arr.length) ordered.push({ project: p, items: arr })
    }
    const orphan = map.get('__none__')
    if (orphan && orphan.length) ordered.push({ project: null, items: orphan })
    return ordered
  }, [filteredItems, phaseToProject, projects])

  const totalFiltered = filteredItems.length
  const hasQuery = debounced.trim().length > 0
  const hasActiveFilters =
    types.size > 0 ||
    priorities.size > 0 ||
    statuses.size > 0 ||
    includeArchived

  const clearFilters = useCallback(() => {
    setTypes(new Set())
    setPriorities(new Set())
    setStatuses(new Set())
    setIncludeArchived(false)
  }, [])

  const openItem = useCallback(
    (item: Item) => {
      const projectId = phaseToProject[item.phase_id]
      if (!projectId) return
      navigate(`/p/${projectId}#item=${item.id}`)
    },
    [navigate, phaseToProject]
  )

  // ——— Render ————————————————————————————————————————————————
  return (
    <div className="min-h-full w-full">
      <div className="max-w-[960px] mx-auto px-6 md:px-10 py-10">
        {/* Heading */}
        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.12em] text-white/40 font-medium mb-2">
            Search
          </div>
          <h1 className="text-[26px] md:text-[30px] font-semibold tracking-[-0.02em] text-white/95">
            Find anything, across every project
          </h1>
        </div>

        {/* Search input */}
        <div
          className="flex items-center gap-3 h-[52px] px-4 rounded-[14px]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 20px -10px rgba(0,0,0,0.5)',
          }}
        >
          <Search className="h-[17px] w-[17px] text-white/45 shrink-0" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search items by title or description…"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none tracking-[-0.01em]"
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
          {loading && (
            <Loader2 className="h-3.5 w-3.5 text-white/40 animate-spin" />
          )}
          {input && !loading && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <FilterGroup label="Type">
            {TYPE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={types.has(o.value)}
                onClick={() =>
                  setTypes((prev) => toggleSet(prev, o.value))
                }
              >
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <Divider />
          <FilterGroup label="Priority">
            {PRIORITY_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={priorities.has(o.value)}
                onClick={() =>
                  setPriorities((prev) => toggleSet(prev, o.value))
                }
              >
                <span
                  className="h-[6px] w-[6px] rounded-full"
                  style={{ background: PRIORITY_DOT[o.value] }}
                />
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <Divider />
          <FilterGroup label="Status">
            {STATUS_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={statuses.has(o.value)}
                onClick={() =>
                  setStatuses((prev) => toggleSet(prev, o.value))
                }
              >
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <Divider />
          <Chip
            active={includeArchived}
            onClick={() => setIncludeArchived((v) => !v)}
          >
            <Archive className="h-3 w-3" />
            Include archived
          </Chip>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 text-[11px] text-white/45 hover:text-white/80 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Meta line */}
        <div className="mt-5 flex items-center justify-between text-[11.5px] text-white/40">
          <span>
            {!hasQuery
              ? 'Type to search across all projects.'
              : loading
                ? 'Searching…'
                : `${totalFiltered} result${totalFiltered === 1 ? '' : 's'}${
                    items.length !== totalFiltered
                      ? ` · ${items.length - totalFiltered} hidden by filters`
                      : ''
                  }`}
          </span>
        </div>

        {/* Results */}
        <div className="mt-5 space-y-6">
          {!hasQuery && <EmptyPrompt />}

          {hasQuery && !loading && filteredItems.length === 0 && (
            <NoResults includeArchived={includeArchived} />
          )}

          {hasQuery &&
            grouped.map(({ project, items: rows }) => (
              <section
                key={project?.id ?? 'none'}
                className="rounded-[14px] overflow-hidden"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <header
                  className="flex items-center gap-2.5 px-4 h-[40px]"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span
                    className="h-[9px] w-[9px] rounded-full"
                    style={{ background: project?.color ?? '#8892a6' }}
                  />
                  <span className="text-[13px] text-white/90 font-medium tracking-[-0.005em]">
                    {project?.name ?? 'Unknown project'}
                  </span>
                  <span className="ml-auto text-[11px] text-white/40 tabular-nums">
                    {rows.length}
                  </span>
                </header>
                <ul>
                  {rows.map((it, i) => (
                    <SearchResultRow
                      key={it.id}
                      item={it}
                      query={debounced}
                      onClick={() => openItem(it)}
                      last={i === rows.length - 1}
                    />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </div>
  )
}

// ——— Subcomponents ————————————————————————————————————————————
function SearchResultRow({
  item,
  query,
  onClick,
  last,
}: {
  item: Item
  query: string
  onClick: () => void
  last: boolean
}) {
  const Icon = TYPE_ICON[item.type]
  const badge = STATUS_BADGE[item.status]
  return (
    <li
      style={{
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.03)',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] group"
      >
        <div
          className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0 mt-px"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          <Icon className="h-[14px] w-[14px] text-white/70" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] text-white/90 font-medium tracking-[-0.005em] truncate">
              {highlightMatches(item.title, query)}
            </span>
            <span
              className="inline-flex items-center h-[18px] px-1.5 rounded-[5px] text-[10px] font-medium shrink-0"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
            {item.archived && (
              <span className="inline-flex items-center gap-1 h-[18px] px-1.5 rounded-[5px] text-[10px] text-white/50 bg-white/[0.04]">
                <Archive className="h-2.5 w-2.5" />
                Archived
              </span>
            )}
          </div>
          {item.description && (
            <div className="mt-1 text-[12px] text-white/45 line-clamp-2 leading-relaxed">
              {highlightMatches(item.description, query)}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
            <span className="inline-flex items-center gap-1">
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: PRIORITY_DOT[item.priority] }}
              />
              {item.priority}
            </span>
            {item.tags.slice(0, 4).map((t) => (
              <span key={t} className="text-white/45">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </button>
    </li>
  )
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/35 font-medium mr-1">
        {label}
      </span>
      <div className="inline-flex flex-wrap gap-1">{children}</div>
    </div>
  )
}

function Divider() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-px mx-1"
      style={{ background: 'rgba(255,255,255,0.08)' }}
    />
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-[24px] px-2.5 rounded-full text-[11.5px] transition-colors"
      style={{
        background: active
          ? 'rgba(255,255,255,0.1)'
          : 'rgba(255,255,255,0.03)',
        color: active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.6)',
        border: `1px solid ${
          active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)'
        }`,
        boxShadow: active
          ? 'inset 0 1px 0 rgba(255,255,255,0.06)'
          : 'none',
      }}
    >
      {children}
    </button>
  )
}

function EmptyPrompt() {
  return (
    <div
      className="rounded-[14px] px-6 py-14 text-center"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
        border: '1px dashed rgba(255,255,255,0.07)',
      }}
    >
      <div className="text-[14px] text-white/80 font-medium tracking-[-0.005em]">
        Type to search across all projects.
      </div>
      <div className="mt-1.5 text-[12px] text-white/40">
        Matches against item titles and descriptions.
      </div>
    </div>
  )
}

function NoResults({ includeArchived }: { includeArchived: boolean }) {
  return (
    <div
      className="rounded-[14px] px-6 py-14 text-center"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
        border: '1px dashed rgba(255,255,255,0.07)',
      }}
    >
      <div className="text-[14px] text-white/85 font-medium tracking-[-0.005em]">
        No results
      </div>
      <div className="mt-1.5 text-[12px] text-white/45">
        Try a different query
        {!includeArchived ? ' or check “Include archived”.' : '.'}
      </div>
    </div>
  )
}

function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}
