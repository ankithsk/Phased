import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Calendar, Sparkles } from 'lucide-react'
import { useItemsByPhase } from '@/hooks/useItems'
import { ItemRow } from './ItemRow'
import { PhaseActionsMenu } from './PhaseActionsMenu'
import type { Phase, PhaseStatus } from '@/types/db'

export interface PhaseSectionProps {
  phase: Phase
  projectId: string
  defaultExpanded: boolean
  onItemClick: (id: string) => void
  showArchived: boolean
  showSnoozed: boolean
  /**
   * Pre-computed item count for this phase. Used for the collapsed-header
   * badge so we don't need to load every phase's items up-front just to
   * render a number. Falls back to 0 if not provided.
   */
  totalCount?: number
  /**
   * When set to this phase's id (e.g. via a command palette jump), force
   * this section to expand so scroll-into-view lands on open content.
   */
  forceExpandedId?: string | null
  /** Goal id → name, used to render the goal chip on rows. */
  goalNames?: Record<string, string>
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

function isSnoozed(snoozedUntil: string | null, todayIso: string): boolean {
  return !!snoozedUntil && snoozedUntil > todayIso
}

export function PhaseSection({
  phase,
  projectId,
  defaultExpanded,
  onItemClick,
  showArchived,
  showSnoozed,
  totalCount = 0,
  forceExpandedId,
  goalNames
}: PhaseSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // Track whether this section has ever been opened. Once opened we keep the
  // realtime subscription alive so collapse/re-expand doesn't incur another
  // round-trip, but we never subscribe to phases the user hasn't touched.
  const [hasBeenExpanded, setHasBeenExpanded] = useState(defaultExpanded)
  const { items, loading } = useItemsByPhase(phase.id, hasBeenExpanded)

  // If a command palette jump targets this phase, open it.
  useEffect(() => {
    if (forceExpandedId && forceExpandedId === phase.id) {
      setExpanded(true)
      setHasBeenExpanded(true)
    }
  }, [forceExpandedId, phase.id])

  const todayIso = new Date().toISOString().slice(0, 10)
  const visibleItems = items.filter((i) => {
    if (!showArchived && i.archived) return false
    if (!showSnoozed && isSnoozed(i.snoozed_until, todayIso)) return false
    return true
  })
  const relDate = formatRelativeDate(phase.target_date)
  // Use loaded items once we have them; otherwise fall back to the pre-fetched
  // count so the collapsed badge still reflects reality.
  const badgeCount = hasBeenExpanded ? visibleItems.length : totalCount

  function toggle() {
    setExpanded((v) => {
      const next = !v
      if (next) setHasBeenExpanded(true)
      return next
    })
  }

  const isActive = phase.status === 'active'
  const isCompleted = phase.status === 'completed'

  return (
    <section
      id={`phase-${phase.id}`}
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm scroll-mt-20 transition-colors duration-300 ${
        isActive
          ? 'border-foreground/15 bg-card/55 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_14px_36px_-20px_rgba(0,0,0,0.55)]'
          : 'border-border/70 bg-card/40'
      }`}
    >
      {isActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 60% at 0% 0%, rgba(255,255,255,0.045) 0%, transparent 55%)'
          }}
        />
      )}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle()
          }
        }}
        className={`relative sticky top-0 z-10 flex w-full cursor-pointer items-center gap-3 border-b px-4 py-3 text-left backdrop-blur-xl transition-colors ${
          isActive
            ? 'border-foreground/15 bg-card/80 hover:bg-card'
            : 'border-border/60 bg-card/70 hover:bg-card/90'
        }`}
      >
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="flex h-5 w-5 flex-none items-center justify-center text-muted-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </motion.span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isActive && (
            <motion.span
              aria-hidden
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.18, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="flex h-1.5 w-1.5 flex-none rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]"
            />
          )}
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
            Phase {phase.number}
          </span>
          <span
            className={`truncate text-[14px] font-semibold ${
              isCompleted ? 'text-muted-foreground/80' : 'text-foreground'
            }`}
          >
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
            {badgeCount} {badgeCount === 1 ? 'item' : 'items'}
          </span>
          {relDate && (
            <span className="hidden items-center gap-1 text-[11px] text-muted-foreground/80 sm:inline-flex">
              <Calendar className="h-3 w-3" />
              {relDate}
            </span>
          )}
          <PhaseActionsMenu phase={phase} projectId={projectId} />
        </div>
      </div>

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
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <motion.div
                    animate={{ y: [0, -2, 0], opacity: [0.45, 0.7, 0.45] }}
                    transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 bg-secondary/40 text-muted-foreground"
                  >
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </motion.div>
                  <span className="text-[13px] font-medium text-foreground/80">
                    {isCompleted ? 'Wrapped up.' : 'Nothing here yet.'}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground/70">
                    Press{' '}
                    <kbd className="mx-0.5 inline-flex rounded border border-border/70 bg-secondary/60 px-1.5 py-0.5 font-mono text-[10px]">
                      ⌘⇧N
                    </kbd>{' '}
                    to capture an idea.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {visibleItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onClick={() => onItemClick(item.id)}
                      goalNames={goalNames}
                    />
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
