import { supabase } from '@/lib/supabase'
import type { Module } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const modulesRepo = {
  async listByProject(projectId: string, includeArchived = false): Promise<Module[]> {
    let query = supabase
      .from('modules')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true })
    if (!includeArchived) query = query.eq('archived', false)
    const { data, error } = await query
    if (error) throw error
    return data ?? []
  },

  async create(
    projectId: string,
    name: string,
    opts: { isGeneral?: boolean; description?: string; sortOrder?: number } = {}
  ): Promise<Module> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('modules')
      .insert({
        project_id: projectId,
        name,
        is_general: opts.isGeneral ?? false,
        description: opts.description ?? null,
        sort_order: opts.sortOrder ?? 0,
        user_id
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase
      .from('modules')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async archive(id: string): Promise<void> {
    await this.update(id, { archived: true })
  },

  async unarchive(id: string): Promise<void> {
    await this.update(id, { archived: false })
  },

  async reorder(projectId: string, orderedIds: string[]): Promise<void> {
    // Updates sort_order in one round-trip per module (Supabase has no bulk
    // conditional update in REST; this is fine for a small module list).
    await Promise.all(
      orderedIds.map((id, idx) =>
        supabase.from('modules').update({ sort_order: idx }).eq('id', id).eq('project_id', projectId)
      )
    )
  }
}
