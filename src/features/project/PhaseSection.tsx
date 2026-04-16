import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Calendar } from 'lucide-react'
import { useItemsByPhase } from '@/hooks/useItems'
import { ItemRow } from './ItemRow'
import type { Phase, PhaseStatus } from '@/types/db'

export interface PhaseSectionProps {
  phase: Phase
  defaultExpanded: boolean
  onItemClick: (id: string) => void
  showArchived: boolean
}

const STATUS_CHIP: Record<PhaseStatus, string> = {
  active: 'bg-foreground/5 text-foreground border-foreground/15',
  planned: 'bg-secondary/60 text-muted-foreground border-border/60',
  completed: 'bg-emerald-500/10 text-emerald-200/90 border-emerald-500/20'
}

const STATUS_LABEL: Record<PhaseStatus, string> = {
  active: 'Active',
  planned: 'Planned',
  completed: 'Completed'
}

function formatRelativeDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / 86400000)
  const abs = Math.abs(diffDays)
  if (abs === 0) return 'today'
  if (abs < 7) return diffDays > 0 ? `in ${abs}d` : `${abs}d ago`
  if (abs < 30) {
    const w = Math.round(abs / 7)
    return diffDays > 0 ? `in ${w}w` : `${w}w ago`
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function PhaseSection({
  phase,
  defaultExpanded,
  onItemClick,
  showArchived
}: PhaseSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { items, loading } = useItemsByPhase(phase.id, showArchived)

  const visibleItems = showArchived ? items : items.filter((i) => !i.archived)
  const relDate = formatRelativeDate(phase.target_date)

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="sticky top-0 z-10 flex w-full items-center gap-3 border-b border-border/60 bg-card/70 px-4 py-3 text-left backdrop-blur-xl transition-colors hover:bg-card/90"
      >
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-5 w-5 flex-none items-center justify-center text-muted-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>

        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Phase {phase.number}
          </span>
          <span className="truncate text-[14px] font-semibold text-foreground">
            {phase.name}
          </span>
        </div>

        <div className="flex flex-none items-center gap-2">
          <span
            className={`rounded-md border px-2 py-0.5 text-[10.5px] font-medium ${STATUS_CHIP[phase.status]}`}
          >
            {STATUS_LABEL[phase.status]}
          </span>
          <span className="rounded-md border border-border/60 bg-secondary/40 px-2 py-0.5 text-[10.5px] tabular-nums text-muted-foreground">
            {visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}
          </span>
          {relDate && (
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground/80 sm:inline-flex">
              <Calendar className="h-3 w-3" />
              {relDate}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="p-2 sm:p-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-[12px] text-muted-foreground/70">
                  Loading items…
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
                  <span className="text-[13px] text-muted-foreground">No items.</span>
                  <span className="text-[11.5px] text-muted-foreground/70">
                    Press{' '}
                    <kbd className="mx-0.5 inline-flex rounded border border-border/70 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">
                      ⌘⇧N
                    </kbd>{' '}
                    to capture.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {visibleItems.map((item) => (
                    <ItemRow key={item.id} item={item} onClick={() => onItemClick(item.id)} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
