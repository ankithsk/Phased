import { useEffect, useRef, useState } from 'react'
import { projectsRepo } from '@/repos/projects'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { itemsRepo } from '@/repos/items'
import { supabase } from '@/lib/supabase'
import type { Project, Module, Phase } from '@/types/db'

export interface UseProjectResult {
  project: Project | null
  modules: Module[]
  phases: Phase[]
  /** Non-archived item count per phase_id. Populated in parallel with the
   *  other fetches so the phase header badge can render without opening an
   *  items subscription for every phase. */
  phaseItemCounts: Record<string, number>
  loading: boolean
  refresh: () => Promise<void>
}

export function useProject(projectId: string | undefined): UseProjectResult {
  const [project, setProject] = useState<Project | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [phaseItemCounts, setPhaseItemCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const countsTimerRef = useRef<number | undefined>(undefined)

  const refresh = async () => {
    if (!projectId) return
    const [p, m, ph, counts] = await Promise.all([
      projectsRepo.get(projectId),
      modulesRepo.listByProject(projectId),
      phasesRepo.listByProject(projectId),
      itemsRepo.phaseItemCounts(projectId).catch(() => ({}) as Record<string, number>)
    ])
    setProject(p)
    setModules(m)
    setPhases(ph)
    setPhaseItemCounts(counts)
  }

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    setLoading(true)
    refresh().finally(() => mounted && setLoading(false))

    // Debounce count refreshes — a burst of item writes shouldn't hammer the
    // count query. Structural changes (projects/modules/phases) are rarer so
    // a full refresh() is fine for those.
    const scheduleCountsRefresh = () => {
      if (!mounted) return
      if (countsTimerRef.current) window.clearTimeout(countsTimerRef.current)
      countsTimerRef.current = window.setTimeout(async () => {
        if (!mounted || !projectId) return
        try {
          const counts = await itemsRepo.phaseItemCounts(projectId)
          if (mounted) setPhaseItemCounts(counts)
        } catch {
          /* ignore transient failures */
        }
      }, 400)
    }

    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
        () => {
          if (mounted) refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'modules', filter: `project_id=eq.${projectId}` },
        () => {
          if (mounted) refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'phases', filter: `project_id=eq.${projectId}` },
        () => {
          if (mounted) refresh()
        }
      )
      // Item-scoped subscription: we can't server-side-filter items by project
      // (no project_id column on items), so we listen broadly and refresh
      // counts — the payload is tiny and the query is scoped server-side to
      // this project. Individual phase item lists still use their own channel.
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        scheduleCountsRefresh
      )
      .subscribe()

    return () => {
      mounted = false
      if (countsTimerRef.current) window.clearTimeout(countsTimerRef.current)
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return { project, modules, phases, phaseItemCounts, loading, refresh }
}
