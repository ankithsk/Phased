import { useEffect, useState } from 'react'
import { projectsRepo } from '@/repos/projects'
import { supabase } from '@/lib/supabase'
import type { Project, ProjectSummary } from '@/types/db'

export interface UseProjectsResult {
  projects: Project[]
  summaries: Record<string, ProjectSummary>
  loading: boolean
  refresh: () => Promise<void>
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({})
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const [rows, sums] = await Promise.all([
      projectsRepo.list(),
      projectsRepo.listSummaries().catch((err) => {
        // RPC may not exist yet on a fresh DB where 0005 wasn't run.
        // Degrade gracefully rather than crash the dashboard.
        // eslint-disable-next-line no-console
        console.warn('project_summaries RPC unavailable:', err.message ?? err)
        return [] as ProjectSummary[]
      })
    ])
    setProjects(rows)
    const map: Record<string, ProjectSummary> = {}
    for (const s of sums) map[s.project_id] = s
    setSummaries(map)
  }

  useEffect(() => {
    let mounted = true
    refresh().finally(() => mounted && setLoading(false))
    const channel = supabase
      .channel('projects-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
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
  }, [])

  return { projects, summaries, loading, refresh }
}
