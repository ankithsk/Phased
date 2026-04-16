import { supabase } from '@/lib/supabase'
import type { Item, ItemStatus } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const itemsRepo = {
  async listByPhase(phaseId: string, includeArchived = false): Promise<Item[]> {
    let q = supabase.from('items').select('*').eq('phase_id', phaseId)
    if (!includeArchived) q = q.eq('archived', false)
    const { data, error } = await q.order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async listPinnedByProject(projectId: string): Promise<Item[]> {
    // Join through phases to filter by project_id
    const { data, error } = await supabase
      .from('items')
      .select('*, phase:phases!inner(project_id)')
      .eq('phase.project_id', projectId)
      .eq('pinned', true)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
    if (error) throw error
    // Strip the joined phase before returning
    return (data ?? []).map((row: any) => {
      const { phase: _phase, ...item } = row
      return item as Item
    })
  },

  async listArchivedByProject(projectId: string): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*, phase:phases!inner(project_id)')
      .eq('phase.project_id', projectId)
      .eq('archived', true)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row: any) => {
      const { phase: _phase, ...item } = row
      return item as Item
    })
  },

  async get(id: string): Promise<Item | null> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async create(patch: Partial<Item> & { phase_id: string; title: string }): Promise<Item> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('items')
      .insert({ ...patch, user_id })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: Partial<Item>): Promise<Item> {
    const { data, error } = await supabase
      .from('items')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async setStatus(id: string, status: ItemStatus): Promise<Item> {
    return this.update(id, { status })
  },

  async archive(id: string): Promise<Item> {
    return this.update(id, { archived: true })
  },

  async unarchive(id: string): Promise<Item> {
    return this.update(id, { archived: false })
  },

  async togglePin(id: string, pinned: boolean): Promise<Item> {
    return this.update(id, { pinned })
  },

  async moveToPhase(id: string, phaseId: string): Promise<Item> {
    return this.update(id, { phase_id: phaseId })
  },

  async listByTag(tag: string): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .contains('tags', [tag])
      .eq('archived', false)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async search(query: string, includeArchived = false): Promise<Item[]> {
    let q = supabase
      .from('items')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(50)
      .order('updated_at', { ascending: false })
    if (!includeArchived) q = q.eq('archived', false)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  async allTags(): Promise<string[]> {
    const { data, error } = await supabase.from('items').select('tags').eq('archived', false)
    if (error) throw error
    const set = new Set<string>()
    for (const row of data ?? []) for (const t of (row.tags ?? []) as string[]) set.add(t)
    return Array.from(set).sort()
  },

  async recentlyModifiedSince(projectId: string, since: string, limit = 10): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*, phase:phases!inner(project_id)')
      .eq('phase.project_id', projectId)
      .gt('updated_at', since)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map((row: any) => {
      const { phase: _phase, ...item } = row
      return item as Item
    })
  },

  async listDigest(windowDays: number): Promise<{
    completedRecently: Item[]
    createdRecently: Item[]
    inProgress: Item[]
    deferred: Item[]
  }> {
    const since = new Date(Date.now() - windowDays * 86400_000).toISOString()
    const [completed, created, inProgress, deferred] = await Promise.all([
      supabase
        .from('items')
        .select('*')
        .eq('archived', false)
        .eq('status', 'done')
        .gt('updated_at', since)
        .order('updated_at', { ascending: false }),
      supabase
        .from('items')
        .select('*')
        .eq('archived', false)
        .gt('created_at', since)
        .order('created_at', { ascending: false }),
      supabase
        .from('items')
        .select('*')
        .eq('archived', false)
        .eq('status', 'in-progress')
        .order('updated_at', { ascending: false }),
      supabase
        .from('items')
        .select('*')
        .eq('archived', false)
        .eq('status', 'deferred')
        .order('updated_at', { ascending: false })
    ])
    if (completed.error) throw completed.error
    if (created.error) throw created.error
    if (inProgress.error) throw inProgress.error
    if (deferred.error) throw deferred.error
    return {
      completedRecently: completed.data ?? [],
      createdRecently: created.data ?? [],
      inProgress: inProgress.data ?? [],
      deferred: deferred.data ?? []
    }
  }
}
