import { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, AlertOctagon, AlertTriangle, Circle, Dot } from 'lucide-react'
import type { Project, ProjectSummary } from '@/types/db'

export interface ProjectCardProps {
  project: Project
  summary?: ProjectSummary
}

const FALLBACK_ACCENT = '#71717a' // zinc-500

function hexToRgba(hex: string | null | undefined, alpha: number): string {
  const safe = hex ?? FALLBACK_ACCENT
  const h = safe.replace('#', '')
  const normalized =
    h.length === 3
      ? h.split('').map((c) => c + c).join('')
      : h.length === 6
        ? h
        : '71717a'
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

interface PriorityChipProps {
  label: string
  count: number
  tone: 'critical' | 'high' | 'medium' | 'low'
}

function PriorityChip({ label, count, tone }: PriorityChipProps) {
  const toneStyles: Record<PriorityChipProps['tone'], { dot: string; text: string; icon: JSX.Element }> = {
    critical: {
      dot: 'bg-red-500/90 shadow-[0_0_0_3px_rgba(239,68,68,0.15)]',
      text: 'text-red-300',
      icon: <AlertOctagon className="h-3 w-3 text-red-400" strokeWidth={2.25} />
    },
    high: {
      dot: 'bg-orange-400/90 shadow-[0_0_0_3px_rgba(251,146,60,0.15)]',
      text: 'text-orange-300',
      icon: <AlertTriangle className="h-3 w-3 text-orange-300" strokeWidth={2.25} />
    },
    medium: {
      dot: 'bg-muted-foreground/60',
      text: 'text-muted-foreground',
      icon: <Circle className="h-3 w-3 text-muted-foreground" strokeWidth={2.25} />
    },
    low: {
      dot: 'bg-muted-foreground/35',
      text: 'text-muted-foreground/80',
      icon: <Dot className="h-4 w-4 -mx-1 text-muted-foreground/70" strokeWidth={2.25} />
    }
  }
  const s = toneStyles[tone]
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] font-medium tracking-tight">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      <span className={s.text}>{count}</span>
      <span className="text-muted-foreground/70">{label}</span>
    </div>
  )
}

export function ProjectCard({ project, summary }: ProjectCardProps) {
  const navigate = useNavigate()
  const accent = project.color ?? FALLBACK_ACCENT

  const critical = summary?.open_critical ?? 0
  const high = summary?.open_high ?? 0
  const medium = summary?.open_medium ?? 0
  const low = summary?.open_low ?? 0
  const totalOpen = critical + high + medium + low

  const phaseLabel = summary?.current_phase_name ?? '—'
  const progress = Math.max(0, Math.min(100, project.progress ?? 0))

  const go = () => navigate(`/p/${project.id}`)
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      go()
    }
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKey}
      aria-label={`Open project ${project.name}. ${totalOpen} open items. Current phase ${phaseLabel}. ${progress}% complete.`}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[var(--radius)] border border-border/70 bg-card outline-none transition-colors duration-300 hover:border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      style={{
        boxShadow: `0 1px 0 0 rgba(255,255,255,0.02) inset, 0 1px 2px 0 rgba(0,0,0,0.35)`
      }}
    >
      {/* Left accent stripe */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-[4px]"
        style={{
          background: `linear-gradient(180deg, ${accent} 0%, ${hexToRgba(accent, 0.45)} 100%)`
        }}
      />

      {/* Subtle accent halo (top-right), reveals on hover */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: hexToRgba(accent, 0.22) }}
      />

      <div className="relative flex flex-1 flex-col gap-4 p-5 pl-6">
        {/* Header row: name + phase pill */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                {project.name}
              </h3>
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                strokeWidth={2.25}
              />
            </div>
            <p
              className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}
            >
              {project.description?.trim() ? project.description : (
                <span className="italic text-muted-foreground/60">No description</span>
              )}
            </p>
          </div>
        </div>

        {/* Phase pill */}
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/50 px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accent, boxShadow: `0 0 0 3px ${hexToRgba(accent, 0.18)}` }}
              aria-hidden
            />
            <span className="truncate max-w-[180px]">{phaseLabel}</span>
          </span>
          <span className="ml-auto text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
            {project.status}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-auto">
          <div className="flex items-baseline justify-between">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
              Progress
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-foreground">
              {progress}%
            </span>
          </div>
          <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-secondary/70">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${hexToRgba(accent, 0.75)} 0%, ${accent} 100%)`,
                boxShadow: `0 0 12px ${hexToRgba(accent, 0.45)}`
              }}
            />
          </div>
        </div>

        {/* Priority chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {totalOpen === 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/60" aria-hidden />
              No open items
            </span>
          ) : (
            <>
              {critical > 0 && <PriorityChip label="critical" count={critical} tone="critical" />}
              {high > 0 && <PriorityChip label="high" count={high} tone="high" />}
              {medium > 0 && <PriorityChip label="medium" count={medium} tone="medium" />}
              {low > 0 && <PriorityChip label="low" count={low} tone="low" />}
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}
