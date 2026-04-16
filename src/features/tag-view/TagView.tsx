import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bug,
  FileText,
  GitBranch,
  Loader2,
  MessageCircle,
  Sparkles,
  Tag as TagIcon,
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { projectsRepo } from '@/repos/projects'
import { supabase } from '@/lib/supabase'
import { TagChip } from '@/components/TagChip'
import type {
  Item,
  ItemPriority,
  ItemType,
  Project,
} from '@/types/db'

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

type PhaseLookupRow = { id: string; project_id: string }

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const sec = Math.round(diff / 1000)
  if (sec < 45) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  const wk = Math.round(day / 7)
  if (wk < 5) return `${wk}w ago`
  const mo = Math.round(day / 30)
  if (mo < 12) return `${mo}mo ago`
  const yr = Math.round(day / 365)
  return `${yr}y ago`
}

export function TagView() {
  const { tag: rawTag } = useParams<{ tag: string }>()
  const tag = useMemo(() => {
    try {
      return decodeURIComponent(rawTag ?? '')
    } catch {
      return rawTag ?? ''
    }
  }, [rawTag])

  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [phaseToProject, setPhaseToProject] = useState<Record<string, string>>(
    {}
  )
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    if (!tag) return
    let cancelled = false
    setLoading(true)

    Promise.all([
      itemsRepo.listByTag(tag),
      projectsRepo.list(),
      supabase.from('phases').select('id,project_id'),
      itemsRepo.allTags(),
    ])
      .then(([itemRows, projectList, phasesRes, tagList]) => {
        if (cancelled) return
        setItems(itemRows)
        setProjects(projectList)
        const map: Record<string, string> = {}
        if (!phasesRes.error && phasesRes.data) {
          for (const row of phasesRes.data as PhaseLookupRow[]) {
            map[row.id] = row.project_id
          }
        }
        setPhaseToProject(map)
        setAllTags(tagList)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tag])

  // Group by project
  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>()
    for (const it of items) {
      const pid = phaseToProject[it.phase_id] ?? '__none__'
      const arr = map.get(pid) ?? []
      arr.push(it)
      map.set(pid, arr)
    }
    const ordered: Array<{ project: Project | null; items: Item[] }> = []
    for (const p of projects) {
      const arr = map.get(p.id)
      if (arr && arr.length) ordered.push({ project: p, items: arr })
    }
    const orphan = map.get('__none__')
    if (orphan && orphan.length) ordered.push({ project: null, items: orphan })
    return ordered
  }, [items, projects, phaseToProject])

  // Related tags strip — exclude the current tag, take up to 20 alpha-sorted
  const relatedTags = useMemo(() => {
    return allTags.filter((t) => t !== tag).slice(0, 20)
  }, [allTags, tag])

  const projectCount = grouped.length
  const itemCount = items.length

  const openItem = (item: Item) => {
    const projectId = phaseToProject[item.phase_id]
    if (!projectId) return
    navigate(`/p/${projectId}#item=${item.id}`)
  }

  return (
    <div className="min-h-full w-full">
      <div className="max-w-[960px] mx-auto px-6 md:px-10 py-10">
        {/* Back */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6"
        >
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-white/40 font-medium mb-2">
            <TagIcon className="h-3 w-3" />
            Tag
          </div>
          <h1 className="text-[30px] md:text-[38px] font-semibold tracking-[-0.025em] text-white/95 leading-tight">
            <span className="text-white/35">#</span>
            {tag}
          </h1>
          <div className="mt-2 text-[13px] text-white/45 tracking-[-0.005em]">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </span>
            ) : (
              <>
                {itemCount} {itemCount === 1 ? 'item' : 'items'} across{' '}
                {projectCount} {projectCount === 1 ? 'project' : 'projects'}
              </>
            )}
          </div>
        </motion.div>

        {/* Related tags strip */}
        {relatedTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="mb-8 pb-6"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="text-[10px] uppercase tracking-[0.1em] text-white/30 font-medium mb-2.5">
              Other tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {relatedTags.map((t) => (
                <TagChip key={t} tag={t} size="sm" />
              ))}
            </div>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : itemCount === 0 ? (
          <EmptyState tag={tag} />
        ) : (
          <div className="space-y-10">
            {grouped.map((group, idx) => (
              <motion.section
                key={group.project?.id ?? 'none'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.1 + idx * 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <ProjectGroupHeader
                  project={group.project}
                  count={group.items.length}
                />
                <ul className="mt-3">
                  {group.items.map((it, i) => (
                    <ItemRow
                      key={it.id}
                      item={it}
                      currentTag={tag}
                      onClick={() => openItem(it)}
                      last={i === group.items.length - 1}
                    />
                  ))}
                </ul>
              </motion.section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ——— Subcomponents ————————————————————————————————————————————

function ProjectGroupHeader({
  project,
  count,
}: {
  project: Project | null
  count: number
}) {
  const color = project?.color ?? '#8892a6'
  const content = (
    <div className="flex items-center gap-2.5 group">
      <span
        className="h-[9px] w-[9px] rounded-full shrink-0"
        style={{
          background: color,
          boxShadow: `0 0 0 3px ${color}20`,
        }}
      />
      <span className="text-[14px] text-white/90 font-medium tracking-[-0.01em] group-hover:text-white transition-colors">
        {project?.name ?? 'Unknown project'}
      </span>
      <span className="text-[11px] text-white/35 tabular-nums">
        {count} {count === 1 ? 'item' : 'items'}
      </span>
    </div>
  )

  return (
    <header
      className="pb-2"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {project ? (
        <Link to={`/p/${project.id}`} className="inline-block">
          {content}
        </Link>
      ) : (
        content
      )}
    </header>
  )
}

function ItemRow({
  item,
  currentTag,
  onClick,
  last,
}: {
  item: Item
  currentTag: string
  onClick: () => void
  last: boolean
}) {
  const Icon = TYPE_ICON[item.type]
  return (
    <li
      style={{
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-white/[0.02] rounded-[8px]"
      >
        <div
          className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0 mt-px"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 100%)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.05)',
          }}
        >
          <Icon className="h-[14px] w-[14px] text-white/65" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] text-white/90 font-medium tracking-[-0.005em] truncate">
              {item.title}
            </span>
            <span
              className="h-[6px] w-[6px] rounded-full shrink-0"
              style={{ background: PRIORITY_DOT[item.priority] }}
              aria-label={`${item.priority} priority`}
            />
          </div>
          {item.description && (
            <div className="mt-0.5 text-[12px] text-white/45 line-clamp-1 leading-relaxed">
              {item.description}
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/35">
            <span className="tabular-nums">{relativeTime(item.updated_at)}</span>
            {item.tags
              .filter((t) => t !== currentTag)
              .slice(0, 3)
              .map((t) => (
                <span key={t} className="text-white/40">
                  #{t}
                </span>
              ))}
          </div>
        </div>
      </button>
    </li>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1].map((g) => (
        <div key={g}>
          <div
            className="h-5 w-40 rounded-[6px] mb-3"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[58px] rounded-[10px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ tag }: { tag: string }) {
  return (
    <div
      className="rounded-[14px] px-6 py-16 text-center"
      style={{
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
        border: '1px dashed rgba(255,255,255,0.07)',
      }}
    >
      <div className="text-[14.5px] text-white/85 font-medium tracking-[-0.005em]">
        No open items tagged <span className="text-white/60">#{tag}</span>.
      </div>
      <div className="mt-1.5 text-[12px] text-white/40">
        Tagged items that are archived are not shown here.
      </div>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 mt-5 h-[30px] px-3.5 rounded-full text-[12px] text-white/80 transition-colors hover:text-white"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <ArrowLeft className="h-3 w-3" />
        Back to dashboard
      </Link>
    </div>
  )
}
