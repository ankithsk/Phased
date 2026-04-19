import { useEffect, useState } from 'react'
import { goalsRepo } from '@/repos/goals'
import { supabase } from '@/lib/supabase'
import type { Goal } from '@/types/db'

export interface UseGoalsResult {
  goals: Goal[]
  itemCounts: Record<string, number>
  loading: boolean
  refresh: () => Promise<void>
}

export function useGoals(projectId: string | undefined): UseGoalsResult {
  const [goals, setGoals] = useState<Goal[]>([])
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    if (!projectId) return
    const [rows, counts] = await Promise.all([
      goalsRepo.listByProject(projectId),
      goalsRepo.itemCountsByGoal(projectId).catch(() => ({}))
    ])
    setGoals(rows)
    setItemCounts(counts)
  }

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    setLoading(true)
    refresh().finally(() => mounted && setLoading(false))

    const channel = supabase
      .channel(`goals:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `project_id=eq.${projectId}`
        },
        () => {
          if (mounted) refresh()
        }
      )
      // Item mutations can change the goal_id counts; listen broadly (can't
      // filter items by project_id server-side since items has no project_id).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
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

  return { goals, itemCounts, loading, refresh }
}
