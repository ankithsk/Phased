import { useRef, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Pin,
  Bug,
  Sparkles,
  MessageCircle,
  FileText,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'
import { usePinnedItems } from '@/hooks/useItems'
import type { Item, ItemType, ItemPriority } from '@/types/db'

export interface PinnedStripProps {
  projectId: string
  onItemClick: (id: string) => void
}

const TYPE_ICON: Record<ItemType, LucideIcon> = {
  feature: Sparkles,
  bug: Bug,
  feedback: MessageCircle,
  note: FileText,
  decision: GitBranch,
}

// Muted, desaturated accents — each type gets a calm color signature.
const TYPE_ACCENT: Record<ItemType, string> = {
  feature: 'text-violet-300/80',
  bug: 'text-rose-300/80',
  feedback: 'text-sky-300/80',
  note: 'text-stone-300/80',
  decision: 'text-amber-300/80',
}

// Priority dots — soft gradients, never harsh saturated colors.
const PRIORITY_DOT: Record<ItemPriority, string> = {
  critical:
    'bg-rose-400/90 shadow-[0_0_0_2px_rgba(244,63,94,0.12),0_0_10px_rgba(244,63,94,0.45)]',
  high: 'bg-amber-300/90 shadow-[0_0_0_2px_rgba(251,191,36,0.12),0_0_8px_rgba(251,191,36,0.35)]',
  medium: 'bg-sky-300/80 shadow-[0_0_0_2px_rgba(125,211,252,0.12)]',
  low: 'bg-zinc-400/70',
}

const PRIORITY_LABEL: Record<ItemPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function PinnedStrip({ projectId, onItemClick }: PinnedStripProps) {
  const { items, loading } = usePinnedItems(projectId)
  const scrollerRef = useRef<HTMLDivElement>(null)

  if (loading) return null
  if (items.length === 0) return null

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = scrollerRef.current
    if (!el) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      el.scrollBy({ left: 300, behavior: 'smooth' })
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      el.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Pinned items"
      className="relative"
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 px-0.5 mb-2.5">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-muted/60 ring-1 ring-inset ring-border/60">
          <Pin className="w-3 h-3 text-muted-foreground" strokeWidth={2.25} />
        </div>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/90">
          Pinned
        </span>
        <span className="text-[11px] font-medium text-muted-foreground/50 tabular-nums">
          {items.length}
        </span>
        <div
          aria-hidden
          className="flex-1 h-px bg-gradient-to-r from-border/60 via-border/20 to-transparent"
        />
      </div>

      {/* Strip wrapper: translucent + backdrop blur, with edge fade mask */}
      <div
        className="relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl
                   shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_12px_40px_-20px_rgba(0,0,0,0.5)]
                   overflow-hidden"
      >
        {/* Subtle top highlight */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        />

        <div
          ref={scrollerRef}
          role="list"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          className="pinned-scroller flex gap-2.5 overflow-x-auto overflow-y-hidden
                     p-2.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/60
                     focus-visible:ring-offset-0"
          style={{
            scrollbarWidth: 'thin',
            maskImage:
              'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 24px), transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, black 16px, black calc(100% - 24px), transparent 100%)',
          }}
        >
          <AnimatePresence initial={false}>
            {items.map((item, i) => (
              <PinnedCard
                key={item.id}
                item={item}
                index={i}
                onClick={() => onItemClick(item.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Scoped scrollbar styling */}
      <style>{`
        .pinned-scroller::-webkit-scrollbar { height: 6px; }
        .pinned-scroller::-webkit-scrollbar-track { background: transparent; }
        .pinned-scroller::-webkit-scrollbar-thumb {
          background: hsl(var(--border));
          border-radius: 999px;
        }
        .pinned-scroller::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.4);
        }
      `}</style>
    </motion.section>
  )
}

interface PinnedCardProps {
  item: Item
  index: number
  onClick: () => void
}

function PinnedCard({ item, index, onClick }: PinnedCardProps) {
  const Icon = TYPE_ICON[item.type]
  const accent = TYPE_ACCENT[item.type]

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{
        duration: 0.28,
        delay: Math.min(index * 0.025, 0.2),
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      role="listitem"
      aria-label={`${item.type} · ${item.title} · ${PRIORITY_LABEL[item.priority]} priority`}
      className="group relative shrink-0 w-[280px] h-[60px] rounded-xl
                 bg-gradient-to-b from-secondary/50 to-secondary/20
                 border border-border/70
                 shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1px_2px_0_rgba(0,0,0,0.2)]
                 hover:border-border hover:from-secondary/70 hover:to-secondary/30
                 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.07)_inset,0_8px_20px_-8px_rgba(0,0,0,0.45)]
                 transition-[background,border-color,box-shadow] duration-200 ease-out
                 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/70
                 focus-visible:ring-offset-2 focus-visible:ring-offset-background
                 text-left"
    >
      <div className="flex items-center h-full px-3 gap-3">
        {/* Type glyph in a soft inset tile */}
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg
                     bg-background/40 ring-1 ring-inset ring-border/60
                     group-hover:ring-border transition-colors"
        >
          <Icon className={`w-3.5 h-3.5 ${accent}`} strokeWidth={2} />
        </div>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] leading-tight font-medium text-foreground truncate">
            {item.title}
          </div>
          <div className="mt-0.5 text-[10.5px] leading-tight text-muted-foreground/80 truncate capitalize">
            {item.type}
            {item.status !== 'open' && (
              <>
                <span className="mx-1 text-muted-foreground/40">·</span>
                <span className="text-muted-foreground/70">
                  {item.status.replace('-', ' ')}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Priority dot */}
        <span
          aria-hidden
          className={`shrink-0 w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[item.priority]}`}
        />
      </div>

      {/* Hover glow edge */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0
                   group-hover:opacity-100 transition-opacity duration-300
                   bg-gradient-to-b from-white/[0.03] to-transparent"
      />
    </motion.button>
  )
}
