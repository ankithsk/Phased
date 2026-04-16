import { motion } from 'framer-motion'
import { FolderKanban, Plus, Sparkles } from 'lucide-react'
import { useProjects } from '@/hooks/useProjects'
import { ProjectCard } from './ProjectCard'

function SkeletonCard() {
  return (
    <div className="relative h-[216px] overflow-hidden rounded-[var(--radius)] border border-border/70 bg-card">
      <div className="absolute inset-y-0 left-0 w-[4px] bg-secondary/80" />
      <div className="flex h-full flex-col gap-4 p-5 pl-6">
        <div className="space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-secondary/70" />
          <div className="h-3 w-full animate-pulse rounded bg-secondary/50" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-secondary/40" />
        </div>
        <div className="h-5 w-32 animate-pulse rounded-full bg-secondary/60" />
        <div className="mt-auto space-y-2">
          <div className="h-2.5 w-16 animate-pulse rounded bg-secondary/50" />
          <div className="h-[5px] w-full animate-pulse rounded-full bg-secondary/60" />
        </div>
        <div className="flex gap-1.5">
          <div className="h-5 w-16 animate-pulse rounded-full bg-secondary/50" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-secondary/40" />
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center rounded-[var(--radius)] border border-dashed border-border/70 bg-card/40 px-6 py-20 text-center">
      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-secondary/40">
        <FolderKanban className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent" aria-hidden />
      </div>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
        No projects yet
      </h2>
      <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-muted-foreground">
        Create your first project to start tracking phases, items, and progress in one calm, focused place.
      </p>
      <button
        type="button"
        onClick={() => {
          /* TODO: wire up project creation */
        }}
        className="group mt-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-4 py-2 text-[12.5px] font-medium tracking-tight text-foreground transition-all duration-300 hover:border-border hover:bg-secondary"
      >
        <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.25} />
        New project
      </button>
    </div>
  )
}

export function Dashboard() {
  const { projects, summaries, loading } = useProjects()

  const activeCount = projects.filter((p) => p.status === 'active').length

  return (
    <div className="relative min-h-full">
      {/* Ambient background accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -left-24 top-[-120px] h-[320px] w-[320px] rounded-full opacity-[0.18] blur-3xl"
          style={{ background: 'radial-gradient(circle at center, #6366f1 0%, transparent 60%)' }}
        />
        <div
          className="absolute right-[-80px] top-[120px] h-[260px] w-[260px] rounded-full opacity-[0.12] blur-3xl"
          style={{ background: 'radial-gradient(circle at center, #a855f7 0%, transparent 60%)' }}
        />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-6 py-10 md:px-10 md:py-12">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
              <Sparkles className="h-3 w-3" strokeWidth={2.25} />
              Command Center
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-foreground">
                Projects
              </h1>
              {!loading && projects.length > 0 && (
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="text-[13px] leading-5 text-muted-foreground">
              A calm overview of everything you're building.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              /* TODO: wire up project creation */
            }}
            className="group inline-flex h-9 items-center gap-2 self-start rounded-full border border-border/80 bg-foreground px-4 text-[12.5px] font-semibold tracking-tight text-background shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_4px_14px_-4px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-foreground/90 sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
            New project
          </button>
        </motion.header>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : projects.length === 0 ? (
            <EmptyState />
          ) : (
            projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.24), ease: [0.22, 1, 0.36, 1] }}
                className="h-full"
              >
                <ProjectCard project={project} summary={summaries[project.id]} />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
