import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, GitBranch, Plus, Loader2 } from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { projectsRepo } from '@/repos/projects'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { supabase } from '@/lib/supabase'
import { ItemDetailPanel } from './ItemDetailPanel'
import type { Item, Module, Phase, Project } from '@/types/db'

function openQuickCaptureAsDecision(projectId: string) {
  // Broadcast the project context + decision type hint to the quick-capture
  // provider. The provider reads projectId; the type hint is a secondary
  // event the modal listens for.
  window.dispatchEvent(
    new CustomEvent('pcc:quick-capture', {
      detail: { projectId, type: 'decision' }
    })
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function DecisionsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      projectsRepo.get(projectId),
      modulesRepo.listByProject(projectId),
      phasesRepo.listByProject(projectId),
      itemsRepo.listDecisionsByProject(projectId)
    ])
      .then(([p, m, ph, it]) => {
        if (cancelled) return
        setProject(p)
        setModules(m.filter((mod) => !mod.archived))
        setPhases(ph)
        setItems(it)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Realtime: keep the list fresh when decisions are added/updated/archived.
  useEffect(() => {
    if (!projectId) return
    const ch = supabase
      .channel(`decisions:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        async () => {
          try {
            const rows = await itemsRepo.listDecisionsByProject(projectId)
            setItems(rows)
          } catch {
            /* ignore */
          }
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(ch)
    }
  }, [projectId])

  const phaseById = useMemo(() => {
    const m = new Map<string, Phase>()
    for (const p of phases) m.set(p.id, p)
    return m
  }, [phases])

  const moduleById = useMemo(() => {
    const m = new Map<string, Module>()
    for (const mod of modules) m.set(mod.id, mod)
    return m
  }, [modules])

  const modulesEnabled = !!project?.modules_enabled

  const grouped = useMemo(() => {
    if (!modulesEnabled) {
      return [{ key: 'all', title: null as string | null, items }]
    }
    const byModule = new Map<string | null, Item[]>()
    for (const it of items) {
      const phase = phaseById.get(it.phase_id)
      const modId = phase?.module_id ?? null
      const list = byModule.get(modId) ?? []
      list.push(it)
      byModule.set(modId, list)
    }
    const sortedModules = [...modules].sort((a, b) => a.sort_order - b.sort_order)
    const sections: Array<{ key: string; title: string | null; items: Item[] }> = []
    for (const m of sortedModules) {
      const list = byModule.get(m.id)
      if (list && list.length > 0) {
        sections.push({ key: m.id, title: m.name, items: list })
      }
    }
    const unassigned = byModule.get(null)
    if (unassigned && unassigned.length > 0) {
      sections.push({ key: 'unassigned', title: 'Unassigned', items: unassigned })
    }
    return sections
  }, [items, modulesEnabled, modules, phaseById])

  const accent = project?.color ?? '#a1a1aa'

  return (
    <div className="min-h-full w-full">
      <div className="mx-auto max-w-[960px] px-6 py-10 md:px-10">
        <div className="mb-6">
          <Link
            to={project ? `/p/${project.id}` : '/'}
            className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {project ? `Back to ${project.name}` : 'Back'}
          </Link>
        </div>

        <motion.header
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 flex items-end justify-between gap-4"
        >
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium tracking-tight text-muted-foreground">
              <GitBranch className="h-3 w-3" strokeWidth={2.25} />
              Decisions log
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[28px] font-semibold tracking-[-0.025em] text-foreground">
                {project?.name ?? 'Project'}
              </h1>
              {!loading && (
                <span className="text-[13px] font-medium tabular-nums text-muted-foreground">
                  {items.length} {items.length === 1 ? 'decision' : 'decisions'}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
              A running log of choices made on this project — the *why* behind the work.
            </p>
          </div>
          {project && (
            <button
              type="button"
              onClick={() => openQuickCaptureAsDecision(project.id)}
              className="group inline-flex h-9 items-center gap-2 rounded-full border border-border/80 bg-foreground px-4 text-[12.5px] font-semibold tracking-tight text-background shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset,0_4px_14px_-4px_rgba(0,0,0,0.4)] transition-all duration-300 hover:bg-foreground/90"
            >
              <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" strokeWidth={2.5} />
              New decision
            </button>
          )}
        </motion.header>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState accent={accent} />
        ) : (
          <div className="space-y-10">
            {grouped.map((section) => (
              <section key={section.key} className="flex flex-col gap-3">
                {section.title && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                      {section.title}
                    </span>
                    <span className="h-px flex-1 bg-border/50" />
                    <span className="text-[11px] tabular-nums text-muted-foreground/70">
                      {section.items.length}
                    </span>
                  </div>
                )}
                <ul className="divide-y divide-border/40 rounded-2xl border border-border/70 bg-card/40">
                  {section.items.map((it) => {
                    const phase = phaseById.get(it.phase_id)
                    const moduleName = phase?.module_id
                      ? moduleById.get(phase.module_id)?.name
                      : null
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(it.id)}
                          className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/40"
                        >
                          <div className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-secondary/50 ring-1 ring-inset ring-border/50">
                            <GitBranch className="h-3.5 w-3.5 text-amber-300/80" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate text-[14px] font-medium text-foreground group-hover:text-foreground">
                                {it.title}
                              </span>
                              <span className="flex-none text-[11px] tabular-nums text-muted-foreground/70">
                                {formatDate(it.updated_at)}
                              </span>
                            </div>
                            {it.description && (
                              <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">
                                {it.description}
                              </p>
                            )}
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                              {phase && (
                                <span className="truncate">
                                  Phase {phase.number} — {phase.name}
                                </span>
                              )}
                              {moduleName && (
                                <>
                                  <span className="text-border">·</span>
                                  <span className="truncate">{moduleName}</span>
                                </>
                              )}
                              {it.tags.slice(0, 3).map((t) => (
                                <span key={t} className="text-muted-foreground/70">
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <ItemDetailPanel
        itemId={selectedItemId}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  )
}

function EmptyState({ accent }: { accent: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-20 text-center"
    >
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-secondary/40"
        style={{ boxShadow: `0 0 0 4px ${accent}14` }}
      >
        <GitBranch className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
        No decisions logged yet
      </h2>
      <p className="mt-1.5 max-w-md text-[13px] leading-5 text-muted-foreground">
        Record the choice you just made — what you picked, what you didn't, and why.
        Future-you will thank you when you forget why the system works the way it does.
      </p>
    </div>
  )
}
