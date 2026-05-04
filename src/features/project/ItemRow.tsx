import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bug,
  Sparkles,
  MessageCircle,
  FileText,
  GitBranch,
  Pin,
  PinOff,
  ChevronDown,
  Check,
  CalendarClock,
  Moon,
  Target
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import type { Item, ItemStatus, ItemType, ItemPriority } from '@/types/db'

export interface ItemRowProps {
  item: Item
  onClick: () => void
  /** Optional map of goal id → name, provided by the project view so rows
   *  can render the goal name without each loading goals independently. */
  goalNames?: Record<string, string>
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

// Raw accent colors keyed off the same palette as TYPE_TINT, used for the
// hover reveal bar and any other inline-style contexts where a Tailwind
// class can't be composed dynamically.
const TYPE_ACCENT_RGB: Record<ItemType, string> = {
  feature: '196, 181, 253',  // violet-300
  bug: '253, 164, 175',      // rose-300
  feedback: '125, 211, 252', // sky-300
  note: '212, 212, 216',     // zinc-300
  decision: '252, 211, 77'   // amber-300
}

const PRIORITY_DOT: Record<ItemPriority, string> = {
  critical: 'bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]',
  high: 'bg-orange-400 shadow-[0_0_0_3px_rgba(251,146,60,0.12)]',
  medium: 'bg-zinc-400/70',
  low: 'bg-zinc-500/40'
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  done: 'Done',
  deferred: 'Deferred'
}

const STATUS_CHIP: Record<ItemStatus, string> = {
  open: 'bg-secondary/70 text-muted-foreground border-border/60',
  'in-progress': 'bg-sky-500/10 text-sky-200/90 border-sky-500/20',
  done: 'bg-emerald-500/10 text-emerald-200/90 border-emerald-500/20',
  deferred: 'bg-zinc-500/10 text-zinc-300/80 border-zinc-500/20'
}

const STATUSES: ItemStatus[] = ['open', 'in-progress', 'done', 'deferred']

function describeRevisit(iso: string | null): { label: string; className: string } | null {
  if (!iso) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) {
    const abs = Math.abs(diffDays)
    return {
      label: abs === 1 ? 'Overdue 1d' : `Overdue ${abs}d`,
      className: 'border-rose-500/30 bg-rose-500/10 text-rose-200/90'
    }
  }
  if (diffDays === 0) {
    return {
      label: 'Revisit today',
      className: 'border-amber-500/30 bg-amber-500/10 text-amber-200/90'
    }
  }
  if (diffDays <= 7) {
    return {
      label: `Revisit ${diffDays}d`,
      className: 'border-border/50 bg-secondary/40 text-muted-foreground/90'
    }
  }
  // Hide the chip when the revisit date is far out so rows don't get noisy.
  return null
}

function describeSnooze(iso: string | null): { label: string; className: string } | null {
  if (!iso) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000)
  if (diffDays <= 0) return null
  if (diffDays === 1) {
    return {
      label: 'Snoozed · 1d',
      className: 'border-sky-500/30 bg-sky-500/10 text-sky-200/90'
    }
  }
  return {
    label: `Snoozed · ${diffDays}d`,
    className: 'border-sky-500/25 bg-sky-500/5 text-sky-200/80'
  }
}

export function ItemRow({ item, onClick, goalNames }: ItemRowProps) {
  const Icon = TYPE_ICON[item.type]
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)
  const statusBtnRef = useRef<HTMLButtonElement>(null)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  // Portal-positioned coordinates: the chip lives inside the row's
  // overflow-hidden container (needed for the hover reveal bar + celebrate
  // glow), so we render the menu into document.body and pin it to the
  // trigger's viewport rect.
  const [statusPos, setStatusPos] = useState<{
    top: number
    right: number
  } | null>(null)
  const goalName = item.goal_id ? goalNames?.[item.goal_id] : null

  // Trigger a brief celebratory glow when the status transitions to "done".
  // We track the previous status so edits that persist "done" don't re-fire.
  const prevStatusRef = useRef<ItemStatus>(item.status)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (prevStatusRef.current !== 'done' && item.status === 'done') {
      setCelebrate(true)
      const t = window.setTimeout(() => setCelebrate(false), 1200)
      return () => window.clearTimeout(t)
    }
    prevStatusRef.current = item.status
    return
  }, [item.status])

  useEffect(() => {
    if (!statusOpen) {
      setStatusPos(null)
      return
    }
    const update = () => {
      const r = statusBtnRef.current?.getBoundingClientRect()
      if (!r) return
      setStatusPos({
        top: r.bottom + 6,
        right: window.innerWidth - r.right,
      })
    }
    update()
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (statusRef.current?.contains(target)) return
      if (statusMenuRef.current?.contains(target)) return
      setStatusOpen(false)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    document.addEventListener('mousedown', onDoc)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [statusOpen])

  const visibleTags = item.tags.slice(0, 3)
  const overflowTags = item.tags.length - visibleTags.length
  const revisit = describeRevisit(item.revisit_at)
  const snooze = describeSnooze(item.snoozed_until)

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    void itemsRepo.togglePin(item.id, !item.pinned)
  }

  const handleStatusChange = (next: ItemStatus) => {
    setStatusOpen(false)
    if (next !== item.status) {
      void itemsRepo.setStatus(item.id, next)
    }
  }

  const isDone = item.status === 'done'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      className={`group relative flex min-h-[56px] items-center gap-3 overflow-hidden rounded-xl border border-transparent px-3 py-2.5 transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border/70 hover:bg-secondary/30 focus:outline-none focus-visible:border-border focus-visible:bg-secondary/40 ${
        item.archived ? 'opacity-60' : ''
      }`}
    >
      {/* Left reveal bar on hover — tinted to the item's type accent so the
          cue tells you what kind of thing you're about to open. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-1.5 left-0 w-[2px] origin-top scale-y-0 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
        style={{
          background: `linear-gradient(to bottom, rgba(${TYPE_ACCENT_RGB[item.type]}, 0.85), rgba(${TYPE_ACCENT_RGB[item.type]}, 0.35))`,
          boxShadow: `0 0 12px rgba(${TYPE_ACCENT_RGB[item.type]}, 0.35)`
        }}
      />

      {/* Celebration glow (fires on status → done) */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            aria-hidden
            key="celebrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 rounded-xl"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 50%, rgba(52,211,153,0.18) 0%, transparent 70%)',
              boxShadow: 'inset 0 0 0 1px rgba(52,211,153,0.35)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Type icon */}
      <div className="relative flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-secondary/50 ring-1 ring-inset ring-border/50">
        <Icon className={`h-3.5 w-3.5 ${TYPE_TINT[item.type]}`} />
        {celebrate && (
          <motion.span
            aria-hidden
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.6], opacity: [0.7, 0] }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 rounded-lg"
            style={{ boxShadow: '0 0 0 2px rgba(52,211,153,0.4)' }}
          />
        )}
      </div>

      {/* Title + meta */}
      <div className="relative min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-[13.5px] font-medium transition-colors ${
              isDone
                ? 'text-muted-foreground/80 [text-decoration-thickness:1px] line-through decoration-muted-foreground/40'
                : 'text-foreground'
            }`}
          >
            {item.title}
          </span>
          {item.archived && (
            <span className="flex-none rounded-md border border-border/60 bg-secondary/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              Archived
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {item.source && (
            <>
              <span className="truncate">{item.source}</span>
              {(visibleTags.length > 0 || revisit) && <span className="text-border">·</span>}
            </>
          )}
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-border/50 bg-secondary/40 px-1.5 py-0.5 text-[10.5px] text-muted-foreground/90"
            >
              {tag}
            </span>
          ))}
          {overflowTags > 0 && (
            <span className="rounded-md bg-secondary/40 px-1.5 py-0.5 text-[10.5px] text-muted-foreground/70">
              +{overflowTags}
            </span>
          )}
          {revisit && (
            <span
              title={`Revisit on ${item.revisit_at}`}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] ${revisit.className}`}
            >
              <CalendarClock className="h-2.5 w-2.5" />
              {revisit.label}
            </span>
          )}
          {snooze && (
            <span
              title={`Snoozed until ${item.snoozed_until}`}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] ${snooze.className}`}
            >
              <Moon className="h-2.5 w-2.5" />
              {snooze.label}
            </span>
          )}
          {goalName && (
            <span
              title={`Goal: ${goalName}`}
              className="inline-flex max-w-[160px] items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/5 px-1.5 py-0.5 text-[10.5px] text-amber-200/90"
            >
              <Target className="h-2.5 w-2.5" />
              <span className="truncate">{goalName}</span>
            </span>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div className="relative flex flex-none items-center gap-2">
        {/* Priority dot */}
        <span
          aria-label={`priority ${item.priority}`}
          className={`h-2 w-2 rounded-full ${PRIORITY_DOT[item.priority]}`}
        />

        {/* Status chip / dropdown */}
        <div ref={statusRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            ref={statusBtnRef}
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors ${STATUS_CHIP[item.status]}`}
          >
            {STATUS_LABEL[item.status]}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          {typeof document !== 'undefined' &&
            createPortal(
              <AnimatePresence>
                {statusOpen && statusPos && (
                  <motion.div
                    ref={statusMenuRef}
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-[140px] overflow-hidden rounded-lg border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
                    style={{
                      position: 'fixed',
                      top: statusPos.top,
                      right: statusPos.right,
                      zIndex: 60,
                    }}
                  >
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleStatusChange(s)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-foreground/90 transition-colors hover:bg-secondary/70"
                      >
                        <span>{STATUS_LABEL[s]}</span>
                        {item.status === s && <Check className="h-3 w-3 opacity-60" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
        </div>

        {/* Pin */}
        <button
          type="button"
          onClick={handlePin}
          aria-label={item.pinned ? 'Unpin' : 'Pin'}
          className={`flex h-7 w-7 items-center justify-center rounded-md border transition-all duration-150 ${
            item.pinned
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-300 opacity-100'
              : 'border-transparent text-muted-foreground/70 opacity-0 hover:border-border/70 hover:bg-secondary/60 hover:text-foreground group-hover:opacity-100'
          }`}
        >
          {item.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}
