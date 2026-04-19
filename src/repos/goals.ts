import { supabase } from '@/lib/supabase'
import type { Goal, GoalStatus } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const goalsRepo = {
  async listByProject(
    projectId: string,
    opts: { includeDropped?: boolean } = {}
  ): Promise<Goal[]> {
    let q = supabase
      .from('goals')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (!opts.includeDropped) q = q.neq('status', 'dropped')
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  async create(
    projectId: string,
    name: string,
    opts: { description?: string; sortOrder?: number } = {}
  ): Promise<Goal> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('goals')
      .insert({
        project_id: projectId,
        name,
        description: opts.description ?? null,
        sort_order: opts.sortOrder ?? 0,
        user_id
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: Partial<Goal>): Promise<Goal> {
    const { data, error } = await supabase
      .from('goals')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async setStatus(id: string, status: GoalStatus): Promise<Goal> {
    return this.update(id, { status })
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw error
  },

  /** Count non-archived, non-done items currently tagged to each goal. */
  async itemCountsByGoal(projectId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('items')
      .select('goal_id, phase:phases!inner(project_id)')
      .eq('phase.project_id', projectId)
      .eq('archived', false)
      .not('goal_id', 'is', null)
    if (error) throw error
    const map: Record<string, number> = {}
    for (const row of (data ?? []) as Array<{ goal_id: string | null }>) {
      if (!row.goal_id) continue
      map[row.goal_id] = (map[row.goal_id] ?? 0) + 1
    }
    return map
  }
}
