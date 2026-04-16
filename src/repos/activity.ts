import { supabase } from '@/lib/supabase'
import type { ActivityKind, ActivityRow } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const activityRepo = {
  async log(
    projectId: string,
    kind: ActivityKind,
    payload: Record<string, unknown> = {},
    itemId?: string | null
  ): Promise<void> {
    const user_id = await currentUserId()
    const { error } = await supabase.from('activity_log').insert({
      project_id: projectId,
      kind,
      payload,
      item_id: itemId ?? null,
      user_id
    })
    if (error) throw error
  },

  async listByProject(projectId: string, limit = 200): Promise<ActivityRow[]> {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  }
}
