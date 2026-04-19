import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Sparkles, Flame, PencilLine, X } from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import type { Item } from '@/types/db'

export interface ContextResumeBannerProps {
  projectId: string
  lastVisitedAt: string | null
  onItemClick: (id: string) => void
  onMarkVisited: () => void
}

const FIVE_MIN_MS = 5 * 60 * 1000

function formatRelative(fromIso: string, now: number = Date.now()): string {
  const then = new Date(fromIso).getTime()
  if (Number.isNaN(then)) return 'a while'
  const diff = Math.max(0, now - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.floor(hr / 24)
  if (day < 14) return `${day} day${day === 1 ? '' : 's'} ago`
  const wk = Math.floor(day / 7)
  if (wk < 8) return `${wk} week${wk === 1 ? '' : 's'} ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} month${mo === 1 ? '' : 's'} ago`
  const yr = Math.floor(day / 365)
  return `${yr} year${yr === 1 ? '' : 's'} ago`
}

type Bucket = {
  key: 'edited' | 'new' | 'priority'
  label: string
  icon: typeof Clock
  items: Item[]
  accent: string
}

export function ContextResumeBanner(props: ContextResumeBannerProps) {
  const { projectId, lastVisitedAt, onItemClick, onMarkVisited } = props

  const [items, setItems] = useState<Item[] | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const markedRef = useRef(false)

  // Gate: hide if never visited or visited <5min ago.
  const shouldSkip = useMemo(() => {
    if (!lastVisitedAt) return true
    const then = new Date(lastVisitedAt).getTime()
    if (Number.isNaN(then)) return true
    return Date.now() - then < FIVE_MIN_MS
  }, [lastVisitedAt])

  useEffect(() => {
    if (shouldSkip || !lastVisitedAt) return
    let cancelled = false
    itemsRepo
      .recentlyModifiedSince(projectId, lastVisitedAt, 20)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [projectId, lastVisitedAt, shouldSkip])

  const buckets = useMemo<Bucket[]>(() => {
    if (!items || !lastVisitedAt) return []
    const since = new Date(lastVisitedAt).getTime()
    const edited: Item[] = []
    const fresh: Item[] = []
    const priority: Item[] = []
    for (const it of items) {
      const created = new Date(it.created_at).getTime()
      const updated = new Date(it.updated_at).getTime()
      const isHighPri = it.priority === 'high' || it.priority === 'critical'
      if (updated > since && created <= since) {
        edited.push(it)
      } else if (created > since && isHighPri) {
        priority.push(it)
      } else if (created > since) {
        fresh.push(it)
      }
    }
    edited.sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at))
    fresh.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    priority.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    return [
      {
        key: 'edited',
        label: 'Last edited',
        icon: PencilLine,
        items: edited.slice(0, 4),
        accent: 'text-sky-300/90'
      },
      {
        key: 'new',
        label: 'New since last visit',
        icon: Sparkles,
        items: fresh.slice(0, 4),
        accent: 'text-emerald-300/90'
      },
      {
        key: 'priority',
        label: 'New high-priority',
        icon: Flame,
        items: priority.slice(0, 4),
        accent: 'text-amber-300/90'
      }
    ].filter((b) => b.items.length > 0) as Bucket[]
  }, [items, lastVisitedAt])

  const hasContent = buckets.length > 0

  // Mark visited once after first successful render with content.
  // `dismissed` is in the dep list so that dismissing before the 3s timer
  // fires will run the cleanup and cancel the scheduled mark — otherwise
  // last_visited_at overwrites and next visit loses the "since last visit"
  // context entirely.
  useEffect(() => {
    if (markedRef.current) return
    if (!hasContent || dismissed) return
    const t = window.setTimeout(() => {
      markedRef.current = true
      onMarkVisited()
    }, 3000)
    return () => window.clearTimeout(t)
  }, [hasContent, dismissed, onMarkVisited])

  if (shouldSkip) return null
  if (!lastVisitedAt) return null
  if (items === null) return null // still loading
  if (!hasContent) return null

  const relative = formatRelative(lastVisitedAt)

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.aside
          key="context-resume"
          initial={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6, filter: 'blur(3px)' }}
          transition={{ duration: 0.38, ease: [0.22, 0.61, 0.36, 1] }}
          className="relative overflow-hidden rounded-[var(--radius)] border border-border/80 bg-secondary/40 backdrop-blur-xl"
          style={{
            boxShadow:
              '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 40px -24px rgba(0,0,0,0.45)'
          }}
          aria-label="Welcome back — what changed since your last visit"
        >
          {/* Subtle warm wash, top-left */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.55]"
            style={{
              background:
                'radial-gradient(600px 180px at 8% -20%, hsl(var(--foreground) / 0.06), transparent 60%), radial-gradient(400px 160px at 92% -40%, hsl(var(--foreground) / 0.04), transparent 60%)'
            }}
          />

          <div className="relative px-5 py-4 sm:px-6 sm:py-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/50 text-muted-foreground"
                  style={{
                    boxShadow:
                      '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 2px 8px -4px rgba(0,0,0,0.4)'
                  }}
                >
                  <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-medium tracking-tight text-foreground">
                    Welcome back.
                  </div>
                  <div className="text-[12px] text-muted-foreground">
                    Last here {relative}.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="group -mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/70 transition-colors duration-200 hover:bg-background/50 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Hairline */}
            <div
              aria-hidden
              className="mt-4 h-px w-full"
              style={{
                background:
                  'linear-gradient(to right, transparent, hsl(var(--border) / 0.9) 14%, hsl(var(--border) / 0.9) 86%, transparent)'
              }}
            />

            {/* Buckets */}
            <div
              className={`mt-4 grid gap-x-8 gap-y-5 ${
                buckets.length === 1
                  ? 'sm:grid-cols-1'
                  : buckets.length === 2
                  ? 'sm:grid-cols-2'
                  : 'sm:grid-cols-3'
              }`}
            >
              {buckets.map((bucket) => {
                const Icon = bucket.icon
                return (
                  <div key={bucket.key} className="min-w-0">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Icon
                        className={`h-3 w-3 ${bucket.accent}`}
                        strokeWidth={2}
                      />
                      <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        {bucket.label}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {bucket.items.map((it) => (
                        <li key={it.id}>
                          <button
                            type="button"
                            onClick={() => onItemClick(it.id)}
                            className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors duration-200 hover:bg-background/60 focus:outline-none focus-visible:bg-background/60 focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <span className="truncate text-[13px] text-foreground/90 group-hover:text-foreground">
                              {it.title}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
