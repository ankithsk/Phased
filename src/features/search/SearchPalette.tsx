import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search,
  Hash,
  Sparkles,
  Bug,
  MessageCircle,
  FileText,
  GitBranch,
  LayoutDashboard,
  Newspaper,
  ArrowRight,
  Loader2,
  CornerDownLeft,
  FolderPlus,
  Plus,
  Moon,
  Sun,
  LogOut,
  SearchCode,
  ChevronRight,
  Layers,
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { projectsRepo } from '@/repos/projects'
import { phasesRepo } from '@/repos/phases'
import { modulesRepo } from '@/repos/modules'
import { supabase } from '@/lib/supabase'
import { router } from '@/routes'
import { useHotkey } from '@/hooks/useKeyboard'
import type { Item, ItemType, Module, Phase, Project } from '@/types/db'

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

// ——— Types ————————————————————————————————————————————————
type PhaseLookupRow = { id: string; project_id: string }
type RecentRow = { id: string; title: string; phase_id: string }

type NavResult = {
  kind: 'nav'
  id: string
  label: string
  sublabel?: string
  to: string
  Icon: typeof Search
}

type TagResult = {
  kind: 'tag'
  id: string
  tag: string
  to: string
}

type ItemResult = {
  kind: 'item'
  item: Item
  project: Project | null
}

type CommandResult = {
  kind: 'command'
  id: string
  label: string
  sublabel?: string
  Icon: typeof Search
  /** Actions: close the palette first, then run. */
  run: () => void
  /** Keywords that should match this command even if they're not in the label. */
  keywords?: string[]
}

type Row = NavResult | TagResult | ItemResult | CommandResult

// ——— Helpers ————————————————————————————————————————————————
const TYPE_ICON: Record<ItemType, typeof Sparkles> = {
  feature: Sparkles,
  bug: Bug,
  feedback: MessageCircle,
  note: FileText,
  decision: GitBranch,
}

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
        className="bg-white/[0.14] text-white rounded px-0.5 py-px"
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

function navigateTo(to: string) {
  // SearchPalette is mounted outside the RouterProvider, so useNavigate()
  // isn't available — use the router instance directly.
  void router.navigate(to)
}

// ——— Commands ————————————————————————————————————————————————
// Static command registry for the ">" command mode. Each command either
// navigates or dispatches a global event that a feature-level listener
// picks up (e.g. opening the new-project dialog). Adding a new command here
// is the whole integration point — no other wiring required.
export interface ProjectContext {
  project: Project
  modules: Module[]
  phases: Phase[]
}

function buildCommands(ctx: ProjectContext | null = null): CommandResult[] {
  const dispatch = (name: string) =>
    window.dispatchEvent(new CustomEvent(name))
  const toggleTheme = () => {
    const root = document.documentElement
    const nowDark = !root.classList.contains('dark')
    root.classList.toggle('dark', nowDark)
    try {
      localStorage.setItem('pcc.theme', nowDark ? 'dark' : 'light')
    } catch {
      /* ignore */
    }
    // Let any component using the `useTheme` hook re-sync its local state.
    dispatch('pcc:theme-changed')
  }
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  const base: CommandResult[] = [
    {
      kind: 'command',
      id: 'cmd-new-project',
      label: 'New project',
      sublabel: 'Create a new project',
      Icon: FolderPlus,
      keywords: ['create', 'add', 'project'],
      run: () => dispatch('pcc:new-project'),
    },
    {
      kind: 'command',
      id: 'cmd-quick-capture',
      label: 'Quick capture',
      sublabel: '⌘⇧N — capture an item anywhere',
      Icon: Plus,
      keywords: ['new', 'item', 'capture', 'add', 'idea', 'feature', 'bug'],
      run: () => dispatch('pcc:quick-capture'),
    },
    {
      kind: 'command',
      id: 'cmd-go-dashboard',
      label: 'Go to Dashboard',
      sublabel: 'All projects',
      Icon: LayoutDashboard,
      keywords: ['home', 'projects', 'overview'],
      run: () => navigateTo('/'),
    },
    {
      kind: 'command',
      id: 'cmd-go-digest',
      label: 'Go to Digest',
      sublabel: 'Recent activity this week',
      Icon: Newspaper,
      keywords: ['weekly', 'summary', 'activity', 'recent'],
      run: () => navigateTo('/digest'),
    },
    {
      kind: 'command',
      id: 'cmd-go-search',
      label: 'Open Search',
      sublabel: 'Full-page search with filters',
      Icon: SearchCode,
      keywords: ['find', 'filter'],
      run: () => navigateTo('/search'),
    },
    {
      kind: 'command',
      id: 'cmd-toggle-theme',
      label: isDark ? 'Switch to light theme' : 'Switch to dark theme',
      sublabel: 'Toggle appearance',
      Icon: isDark ? Sun : Moon,
      keywords: ['theme', 'dark', 'light', 'appearance', 'mode'],
      run: toggleTheme,
    },
    {
      kind: 'command',
      id: 'cmd-sign-out',
      label: 'Sign out',
      Icon: LogOut,
      keywords: ['logout', 'exit', 'log out'],
      run: () => dispatch('pcc:sign-out'),
    },
  ]

  if (ctx) {
    // Jump to module (sets ?module= on the current project URL)
    for (const m of [...ctx.modules].sort((a, b) => a.sort_order - b.sort_order)) {
      base.push({
        kind: 'command',
        id: `cmd-jump-module-${m.id}`,
        label: `Jump to module: ${m.name}`,
        sublabel: ctx.project.name,
        Icon: Layers,
        keywords: ['module', 'jump', m.name],
        run: () => navigateTo(`/p/${ctx.project.id}?module=${m.id}`),
      })
    }
    // Jump to phase — sort by (module order, phase number)
    const moduleOrder = new Map(ctx.modules.map((m) => [m.id, m.sort_order]))
    const phasesSorted = [...ctx.phases].sort((a, b) => {
      const ao = a.module_id ? moduleOrder.get(a.module_id) ?? 0 : -1
      const bo = b.module_id ? moduleOrder.get(b.module_id) ?? 0 : -1
      if (ao !== bo) return ao - bo
      return a.number - b.number
    })
    const moduleNameById = new Map(ctx.modules.map((m) => [m.id, m.name]))
    for (const ph of phasesSorted) {
      const moduleName = ph.module_id ? moduleNameById.get(ph.module_id) : null
      const sub = moduleName
        ? `${ctx.project.name} · ${moduleName}`
        : ctx.project.name
      const moduleQuery = ph.module_id ? `?module=${ph.module_id}` : ''
      base.push({
        kind: 'command',
        id: `cmd-jump-phase-${ph.id}`,
        label: `Jump to phase: P${ph.number} — ${ph.name}`,
        sublabel: sub,
        Icon: ChevronRight,
        keywords: ['phase', 'jump', ph.name, `p${ph.number}`],
        run: () => navigateTo(`/p/${ctx.project.id}${moduleQuery}#phase=${ph.id}`),
      })
    }
  }

  return base
}

function matchesCommand(cmd: CommandResult, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  if (cmd.label.toLowerCase().includes(needle)) return true
  if (cmd.sublabel && cmd.sublabel.toLowerCase().includes(needle)) return true
  if (cmd.keywords?.some((k) => k.toLowerCase().includes(needle))) return true
  return false
}

// ——— Component ————————————————————————————————————————————————
export function SearchPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phaseToProject, setPhaseToProject] = useState<Record<string, string>>({})
  const [recent, setRecent] = useState<RecentRow[]>([])
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ——— Open / close wiring ——————————————————————————————————————
  const openPalette = useCallback(() => setOpen(true), [])
  const closePalette = useCallback(() => {
    setOpen(false)
  }, [])

  useHotkey('cmd+k', (e) => {
    e.preventDefault()
    setOpen((v) => !v)
  })

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('pcc:open-search', handler as EventListener)
    return () =>
      window.removeEventListener('pcc:open-search', handler as EventListener)
  }, [])

  // Reset state when closed; focus when opened
  useEffect(() => {
    if (!open) {
      setQuery('')
      setDebounced('')
      setItems([])
      setSelectedIndex(0)
      return
    }
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [open])

  // Esc to close, click-outside to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closePalette()
      }
    }
    const onClick = (e: MouseEvent) => {
      if (!cardRef.current) return
      if (!cardRef.current.contains(e.target as Node)) closePalette()
    }
    window.addEventListener('keydown', onKey)
    // defer to next tick so the opening click doesn't close it
    const t = setTimeout(
      () => document.addEventListener('mousedown', onClick),
      0
    )
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, closePalette])

  // ——— One-shot data load on open ———————————————————————————————
  useEffect(() => {
    if (!open) return
    let cancelled = false

    // Projects (used to look up project names + colors)
    projectsRepo
      .list()
      .then((list) => {
        if (!cancelled) setProjects(list)
      })
      .catch(() => {
        /* ignore */
      })

    // Phase → project lookup
    supabase
      .from('phases')
      .select('id,project_id')
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        const map: Record<string, string> = {}
        for (const row of data as PhaseLookupRow[]) map[row.id] = row.project_id
        setPhaseToProject(map)
      })

    // Recent items (for empty state)
    supabase
      .from('items')
      .select('id,title,phase_id')
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setRecent(data as RecentRow[])
      })

    // If the user is inside a project, load its phases/modules so the
    // ">" command mode can offer fast jump-to-phase / jump-to-module.
    // We read the pathname directly because the palette lives outside the
    // Router (so useLocation isn't available here).
    const match =
      typeof window !== 'undefined'
        ? window.location.pathname.match(/^\/p\/([^/?#]+)/)
        : null
    const projectIdFromUrl = match?.[1]
    if (projectIdFromUrl) {
      Promise.all([
        projectsRepo.get(projectIdFromUrl),
        modulesRepo.listByProject(projectIdFromUrl),
        phasesRepo.listByProject(projectIdFromUrl),
      ])
        .then(([project, mods, phs]) => {
          if (cancelled || !project) return
          setProjectContext({
            project,
            modules: mods.filter((m) => !m.archived),
            phases: phs,
          })
        })
        .catch(() => {
          if (!cancelled) setProjectContext(null)
        })
    } else {
      setProjectContext(null)
    }

    return () => {
      cancelled = true
    }
  }, [open])

  // ——— Debounced query ——————————————————————————————————————————
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => setDebounced(query), 180)
    return () => clearTimeout(t)
  }, [query, open])

  // ——— Search ————————————————————————————————————————————————
  useEffect(() => {
    if (!open) return
    const q = debounced.trim()
    if (!q || q.startsWith('#')) {
      setItems([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    itemsRepo
      .search(q)
      .then((rows) => {
        if (cancelled) return
        setItems(rows)
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
  }, [debounced, open])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [debounced])

  // ——— Build the row list ———————————————————————————————————————
  const projectById = useMemo(() => {
    const m = new Map<string, Project>()
    for (const p of projects) m.set(p.id, p)
    return m
  }, [projects])

  const rows: Row[] = useMemo(() => {
    const trimmed = query.trim()

    // Command mode (type ">" to run an action)
    if (trimmed.startsWith('>')) {
      const q = trimmed.slice(1).trim()
      const all = buildCommands(projectContext)
      const filtered = all.filter((c) => matchesCommand(c, q))
      return filtered
    }

    // Tag mode
    if (trimmed.startsWith('#')) {
      const tag = trimmed.slice(1).trim()
      if (!tag) {
        return [
          {
            kind: 'nav',
            id: 'nav-tag-hint',
            label: 'Type a tag name…',
            sublabel: 'e.g. #pricing',
            to: '',
            Icon: Hash,
          },
        ]
      }
      return [
        {
          kind: 'tag',
          id: `tag-${tag}`,
          tag,
          to: `/tag/${encodeURIComponent(tag)}`,
        },
      ]
    }

    // Empty: Quick nav + Recent
    if (!trimmed) {
      const navs: Row[] = [
        {
          kind: 'nav',
          id: 'nav-dashboard',
          label: 'Dashboard',
          sublabel: 'All projects at a glance',
          to: '/',
          Icon: LayoutDashboard,
        },
        {
          kind: 'nav',
          id: 'nav-digest',
          label: 'Digest',
          sublabel: 'Recent activity across projects',
          to: '/digest',
          Icon: Newspaper,
        },
      ]
      const recentRows: Row[] = recent.map((r) => {
        const projectId = phaseToProject[r.phase_id]
        const project = projectId ? projectById.get(projectId) ?? null : null
        // Synthesize a minimal Item-shaped object for rendering
        const synthItem: Item = {
          id: r.id,
          user_id: '',
          phase_id: r.phase_id,
          title: r.title,
          description: null,
          type: 'note',
          source: null,
          priority: 'medium',
          status: 'open',
          pinned: false,
          archived: false,
          tags: [],
          revisit_at: null,
          snoozed_until: null,
          goal_id: null,
          created_at: '',
          updated_at: '',
        }
        return { kind: 'item', item: synthItem, project }
      })
      return [...navs, ...recentRows]
    }

    // Text search
    const results: Row[] = items.map((it) => {
      const projectId = phaseToProject[it.phase_id]
      const project = projectId ? projectById.get(projectId) ?? null : null
      return { kind: 'item', item: it, project }
    })
    return results
  }, [query, items, recent, phaseToProject, projectById, projectContext])

  // Group into sections for rendering with separators
  const sections = useMemo(() => {
    const trimmed = query.trim()
    const out: Array<{ title: string | null; rows: Row[] }> = []
    if (!trimmed) {
      const navs = rows.filter((r) => r.kind === 'nav')
      const itemRows = rows.filter((r) => r.kind === 'item')
      if (navs.length) out.push({ title: 'Quick navigation', rows: navs })
      if (itemRows.length) out.push({ title: 'Recent', rows: itemRows })
      return out
    }
    if (trimmed.startsWith('>')) {
      out.push({ title: 'Commands', rows })
      return out
    }
    if (trimmed.startsWith('#')) {
      out.push({ title: 'Tag', rows })
      return out
    }
    // Group item results by project
    const byProject = new Map<string, Row[]>()
    for (const r of rows) {
      if (r.kind !== 'item') continue
      const key = r.project?.id ?? '__none__'
      const arr = byProject.get(key) ?? []
      arr.push(r)
      byProject.set(key, arr)
    }
    for (const [pid, rs] of byProject) {
      const project = pid === '__none__' ? null : projectById.get(pid) ?? null
      out.push({
        title: project?.name ?? 'Other',
        rows: rs,
      })
    }
    return out
  }, [rows, query, projectById])

  // Flat row list for keyboard nav
  const flatRows = useMemo(() => sections.flatMap((s) => s.rows), [sections])

  // ——— Keyboard: arrow navigation + Enter ——————————————————————
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) =>
          flatRows.length ? Math.min(i + 1, flatRows.length - 1) : 0
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        const row = flatRows[selectedIndex]
        if (!row) return
        e.preventDefault()
        activate(row)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatRows, selectedIndex])

  // Scroll selected row into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-row-index="${selectedIndex}"]`
    )
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const activate = useCallback(async (row: Row) => {
    if (row.kind === 'nav') {
      if (!row.to) return
      navigateTo(row.to)
      setOpen(false)
      return
    }
    if (row.kind === 'tag') {
      navigateTo(row.to)
      setOpen(false)
      return
    }
    if (row.kind === 'command') {
      // Close first so the UI can react (e.g. open another dialog) without
      // focus-stealing conflicts between the palette and the dispatched target.
      setOpen(false)
      row.run()
      return
    }
    // item — fallback: if the phase→project lookup hasn't loaded yet,
    // resolve projectId on demand so hitting Enter doesn't silently no-op.
    let projectId = row.project?.id
    if (!projectId) {
      const { data } = await supabase
        .from('phases')
        .select('project_id')
        .eq('id', row.item.phase_id)
        .maybeSingle()
      projectId = data?.project_id
    }
    if (!projectId) return
    navigateTo(`/p/${projectId}#item=${row.item.id}`)
    setOpen(false)
  }, [])

  // ——— Render ————————————————————————————————————————————————
  let flatIndex = 0

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="search-overlay"
          className="fixed inset-0 z-[90] flex items-start justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14, ease: APPLE_EASE }}
          aria-hidden={!open}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 80% at 50% 0%, rgba(10,12,16,0.55) 0%, rgba(6,7,10,0.7) 60%, rgba(4,5,8,0.78) 100%)',
              backdropFilter: 'blur(10px) saturate(130%)',
              WebkitBackdropFilter: 'blur(10px) saturate(130%)',
            }}
          />

          {/* Palette card */}
          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
            className="relative w-full max-w-[640px] rounded-[18px] overflow-hidden"
            style={{
              marginTop: '18vh',
              maxHeight: '60vh',
              background:
                'linear-gradient(180deg, rgba(24,26,32,0.94) 0%, rgba(18,20,25,0.95) 100%)',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.07)',
              boxShadow:
                '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 30px 80px -20px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.45)',
            }}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.14, ease: APPLE_EASE }}
          >
            {/* Input */}
            <div
              className="flex items-center gap-3 px-4 h-[54px]"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
              }}
            >
              <Search className="h-[17px] w-[17px] text-white/45 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search all projects…"
                className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/30 outline-none tracking-[-0.01em] font-normal"
                autoComplete="off"
                spellCheck={false}
                aria-label="Search all projects"
              />
              {loading && (
                <Loader2 className="h-3.5 w-3.5 text-white/40 animate-spin" />
              )}
              <kbd
                className="inline-flex items-center justify-center h-[22px] px-2 rounded-[6px] text-[10.5px] text-white/55 font-medium shrink-0"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.25)',
                }}
              >
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              className="overflow-y-auto py-1.5"
              style={{ maxHeight: 'calc(60vh - 54px)' }}
            >
              {sections.length === 0 ? (
                <EmptyResults query={query} loading={loading} />
              ) : (
                sections.map((section, sIdx) => (
                  <div key={`sec-${sIdx}`}>
                    {section.title && (
                      <SectionHeader>{section.title}</SectionHeader>
                    )}
                    {section.rows.map((row) => {
                      const index = flatIndex++
                      const selected = index === selectedIndex
                      return (
                        <RowView
                          key={
                            row.kind === 'item'
                              ? row.item.id
                              : row.id
                          }
                          row={row}
                          query={query}
                          selected={selected}
                          index={index}
                          onHover={() => setSelectedIndex(index)}
                          onActivate={() => activate(row)}
                        />
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between gap-3 px-4 h-[34px] text-[10.5px] text-white/35"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.05)',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.015) 100%)',
              }}
            >
              <div className="flex items-center gap-3">
                <FooterHint>
                  <ArrowHint up /> <ArrowHint /> <span>to navigate</span>
                </FooterHint>
                <FooterHint>
                  <CornerDownLeft className="h-2.5 w-2.5" />
                  <span>to select</span>
                </FooterHint>
              </div>
              <div className="flex items-center gap-3">
                <FooterHint>
                  <span className="font-mono">&gt;</span>
                  <span>for commands</span>
                </FooterHint>
                <FooterHint>
                  <span className="font-mono">#</span>
                  <span>for tag search</span>
                </FooterHint>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ——— Subcomponents ————————————————————————————————————————————
function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] text-white/35 font-medium">
      {children}
    </div>
  )
}

function EmptyResults({ query, loading }: { query: string; loading: boolean }) {
  if (loading) {
    return (
      <div className="px-4 py-10 text-center text-[12.5px] text-white/40">
        Searching…
      </div>
    )
  }
  if (!query.trim()) {
    return (
      <div className="px-4 py-10 text-center text-[12.5px] text-white/40">
        Start typing to search across every project.
      </div>
    )
  }
  return (
    <div className="px-4 py-10 text-center">
      <div className="text-[13px] text-white/70 font-medium mb-1">
        No matches
      </div>
      <div className="text-[11.5px] text-white/40">
        Try a different phrase, or press{' '}
        <kbd className="inline-block px-1 rounded bg-white/5 border border-white/[0.06]">
          #
        </kbd>{' '}
        to search by tag.
      </div>
    </div>
  )
}

function RowView({
  row,
  query,
  selected,
  index,
  onHover,
  onActivate,
}: {
  row: Row
  query: string
  selected: boolean
  index: number
  onHover: () => void
  onActivate: () => void
}) {
  if (row.kind === 'nav') {
    const Icon = row.Icon
    return (
      <RowShell
        selected={selected}
        index={index}
        onHover={onHover}
        onActivate={onActivate}
      >
        <IconTile>
          <Icon className="h-[14px] w-[14px] text-white/70" />
        </IconTile>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13.5px] text-white/90 font-medium tracking-[-0.005em] truncate">
            {row.label}
          </span>
          {row.sublabel && (
            <span className="text-[11.5px] text-white/40 truncate">
              {row.sublabel}
            </span>
          )}
        </div>
        <TrailingArrow selected={selected} />
      </RowShell>
    )
  }

  if (row.kind === 'command') {
    const Icon = row.Icon
    return (
      <RowShell
        selected={selected}
        index={index}
        onHover={onHover}
        onActivate={onActivate}
      >
        <IconTile tint="rgba(120, 170, 210, 0.12)" ring="rgba(120, 170, 210, 0.3)">
          <Icon className="h-[14px] w-[14px]" style={{ color: '#b8d4ea' }} />
        </IconTile>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13.5px] text-white/90 font-medium tracking-[-0.005em] truncate">
            {highlightMatches(row.label, query.replace(/^>/, '').trim())}
          </span>
          {row.sublabel && (
            <span className="text-[11.5px] text-white/40 truncate">
              {row.sublabel}
            </span>
          )}
        </div>
        <TrailingArrow selected={selected} />
      </RowShell>
    )
  }

  if (row.kind === 'tag') {
    return (
      <RowShell
        selected={selected}
        index={index}
        onHover={onHover}
        onActivate={onActivate}
      >
        <IconTile tint="rgba(180, 160, 220, 0.18)" ring="rgba(180, 160, 220, 0.35)">
          <Hash className="h-[14px] w-[14px]" style={{ color: '#c8b8e8' }} />
        </IconTile>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13.5px] text-white/90 font-medium tracking-[-0.005em] truncate">
            Go to tag:{' '}
            <span style={{ color: '#d6c9f0' }}>#{row.tag}</span>
          </span>
          <span className="text-[11.5px] text-white/40 truncate">
            View every item tagged {row.tag}
          </span>
        </div>
        <TrailingArrow selected={selected} />
      </RowShell>
    )
  }

  // item
  const Icon = TYPE_ICON[row.item.type]
  const project = row.project
  const dot = project?.color ?? '#8892a6'

  return (
    <RowShell
      selected={selected}
      index={index}
      onHover={onHover}
      onActivate={onActivate}
    >
      <IconTile>
        <Icon className="h-[14px] w-[14px] text-white/70" />
      </IconTile>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[13.5px] text-white/90 font-medium tracking-[-0.005em] truncate">
          {highlightMatches(row.item.title, query)}
        </span>
        {project && (
          <span className="flex items-center gap-1.5 text-[11.5px] text-white/40 truncate">
            <span
              className="h-[7px] w-[7px] rounded-full shrink-0"
              style={{ background: dot }}
              aria-hidden
            />
            <span className="truncate">in {project.name}</span>
          </span>
        )}
      </div>
      <TrailingArrow selected={selected} />
    </RowShell>
  )
}

function RowShell({
  selected,
  index,
  children,
  onHover,
  onActivate,
}: {
  selected: boolean
  index: number
  children: ReactNode
  onHover: () => void
  onActivate: () => void
}) {
  return (
    <button
      type="button"
      data-row-index={index}
      onMouseEnter={onHover}
      onClick={onActivate}
      className="w-full flex items-center gap-3 px-3 py-2 mx-1.5 rounded-[10px] text-left transition-colors"
      style={{
        background: selected ? 'rgba(255,255,255,0.06)' : 'transparent',
        boxShadow: selected
          ? 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)'
          : 'none',
        width: 'calc(100% - 12px)',
      }}
    >
      {children}
    </button>
  )
}

function IconTile({
  children,
  tint,
  ring,
}: {
  children: ReactNode
  tint?: string
  ring?: string
}) {
  return (
    <div
      className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0"
      style={{
        background:
          tint ??
          'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        boxShadow: `inset 0 0 0 1px ${ring ?? 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {children}
    </div>
  )
}

function TrailingArrow({ selected }: { selected: boolean }) {
  return (
    <ArrowRight
      className="h-3 w-3 shrink-0 transition-opacity"
      style={{
        color: 'rgba(255,255,255,0.55)',
        opacity: selected ? 1 : 0,
      }}
    />
  )
}

function FooterHint({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 tracking-[0.02em]">
      {children}
    </span>
  )
}

function ArrowHint({ up }: { up?: boolean }) {
  return (
    <kbd
      className="inline-flex items-center justify-center h-[14px] w-[14px] rounded-[4px] text-[9px] text-white/55"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
      aria-hidden
    >
      {up ? '↑' : '↓'}
    </kbd>
  )
}
