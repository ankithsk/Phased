import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bug,
  FileText,
  GitBranch,
  MessageCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import type { Item, ItemPriority, ItemType } from '@/types/db'

interface ArchivePanelProps {
  projectId: string
}

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

const PRIORITY_DOT: Record<ItemPriority, string> = {
  critical: 'bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]',
  high: 'bg-orange-400 shadow-[0_0_0_3px_rgba(251,146,60,0.12)]',
  medium: 'bg-zinc-400/70',
  low: 'bg-zinc-500/40'
}

export function ArchivePanel({ projectId }: ArchivePanelProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const list = await itemsRepo.listArchivedByProject(projectId)
    setItems(list)
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const list = await itemsRepo.listArchivedByProject(projectId)
      if (!cancelled) {
        setItems(list)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const handleUnarchive = async (id: string) => {
    setRestoringId(id)
    try {
      await itemsRepo.unarchive(id)
      await refresh()
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <header className="flex items-center justify-between border-b border-border/50 px-5 py-3.5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Archived items
          </h2>
          <p className="text-[12px] text-muted-foreground/70">
            Restore items back to their phase.
          </p>
        </div>
        {!loading && (
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {items.length}
          </span>
        )}
      </header>

      {loading ? (
        <ul className="divide-y divide-border/50">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="h-4 w-4 animate-pulse rounded bg-muted-foreground/20" />
              <div className="h-3 w-56 animate-pulse rounded bg-muted-foreground/20" />
              <div className="ml-auto h-5 w-20 animate-pulse rounded bg-muted-foreground/15" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 px-6 py-14 text-center">
          <span className="text-[13px] font-medium text-foreground/80">
            No archived items
          </span>
          <span className="text-[12px] text-muted-foreground">
            When you archive items they will appear here.
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.type]
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-background/30"
              >
                <Icon className={`h-4 w-4 flex-none ${TYPE_TINT[item.type]}`} />
                <span
                  className={`h-2 w-2 flex-none rounded-full ${PRIORITY_DOT[item.priority]}`}
                  aria-label={`Priority: ${item.priority}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium tracking-tight text-foreground/90">
                    {item.title}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground/70">
                    {relativeTime(item.updated_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnarchive(item.id)}
                  disabled={restoringId === item.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  {restoringId === item.id ? 'Restoring…' : 'Unarchive'}
                </button>
              </motion.li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}d ago`
  const mon = Math.round(day / 30)
  if (mon < 12) return `${mon}mo ago`
  const yr = Math.round(mon / 12)
  return `${yr}y ago`
}
