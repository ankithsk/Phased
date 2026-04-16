import { useEffect, useState } from 'react'
import { projectsRepo } from '@/repos/projects'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { supabase } from '@/lib/supabase'
import type { Project, Module, Phase } from '@/types/db'

export interface UseProjectResult {
  project: Project | null
  modules: Module[]
  phases: Phase[]
  loading: boolean
  refresh: () => Promise<void>
}

export function useProject(projectId: string | undefined): UseProjectResult {
  const [project, setProject] = useState<Project | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!projectId) return
    const [p, m, ph] = await Promise.all([
      projectsRepo.get(projectId),
      modulesRepo.listByProject(projectId),
      phasesRepo.listByProject(projectId)
    ])
    setProject(p)
    setModules(m)
    setPhases(ph)
  }

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    setLoading(true)
    refresh().finally(() => mounted && setLoading(false))

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
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return { project, modules, phases, loading, refresh }
}
