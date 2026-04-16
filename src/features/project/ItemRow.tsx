import { useEffect, useRef, useState } from 'react'
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
  Check
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import type { Item, ItemStatus, ItemType, ItemPriority } from '@/types/db'

export interface ItemRowProps {
  item: Item
  onClick: () => void
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

export function ItemRow({ item, onClick }: ItemRowProps) {
  const Icon = TYPE_ICON[item.type]
  const [statusOpen, setStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!statusOpen) return
    const onDoc = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [statusOpen])

  const visibleTags = item.tags.slice(0, 3)
  const overflowTags = item.tags.length - visibleTags.length

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onClick()
      }}
      className={`group relative flex min-h-[56px] items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-border/70 hover:bg-secondary/30 focus:outline-none focus-visible:border-border focus-visible:bg-secondary/40 ${
        item.archived ? 'opacity-60' : ''
      }`}
    >
      {/* Type icon */}
      <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-secondary/50 ring-1 ring-inset ring-border/50">
        <Icon className={`h-3.5 w-3.5 ${TYPE_TINT[item.type]}`} />
      </div>

      {/* Title + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-foreground">
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
              {visibleTags.length > 0 && <span className="text-border">·</span>}
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
        </div>
      </div>

      {/* Right controls */}
      <div className="flex flex-none items-center gap-2">
        {/* Priority dot */}
        <span
          aria-label={`priority ${item.priority}`}
          className={`h-2 w-2 rounded-full ${PRIORITY_DOT[item.priority]}`}
        />

        {/* Status chip / dropdown */}
        <div ref={statusRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setStatusOpen((v) => !v)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-medium transition-colors ${STATUS_CHIP[item.status]}`}
          >
            {STATUS_LABEL[item.status]}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
          <AnimatePresence>
            {statusOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="absolute right-0 top-full z-20 mt-1.5 min-w-[140px] overflow-hidden rounded-lg border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
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
          </AnimatePresence>
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
