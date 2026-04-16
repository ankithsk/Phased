import { supabase } from '@/lib/supabase'
import type { Phase } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const phasesRepo = {
  async listByProject(projectId: string): Promise<Phase[]> {
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async listByModule(moduleId: string): Promise<Phase[]> {
    const { data, error } = await supabase
      .from('phases')
      .select('*')
      .eq('module_id', moduleId)
      .order('number', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async create(
    projectId: string,
    moduleId: string | null,
    number: number,
    name: string,
    opts: { targetDate?: string | null; setCurrent?: boolean } = {}
  ): Promise<Phase> {
    const user_id = await currentUserId()

    // If setting this phase as current, clear any existing current for the same scope.
    if (opts.setCurrent) {
      if (moduleId === null) {
        await supabase
          .from('phases')
          .update({ is_current: false })
          .eq('project_id', projectId)
          .is('module_id', null)
          .eq('is_current', true)
      } else {
        await supabase
          .from('phases')
          .update({ is_current: false })
          .eq('module_id', moduleId)
          .eq('is_current', true)
      }
    }

    const { data, error } = await supabase
      .from('phases')
      .insert({
        project_id: projectId,
        module_id: moduleId,
        number,
        name,
        target_date: opts.targetDate ?? null,
        is_current: !!opts.setCurrent,
        status: opts.setCurrent ? 'active' : 'planned',
        user_id
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: Partial<Phase>): Promise<Phase> {
    const { data, error } = await supabase
      .from('phases')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async setCurrent(phaseId: string): Promise<void> {
    // Fetch the phase to know its scope
    const { data: phase, error: e1 } = await supabase
      .from('phases')
      .select('*')
      .eq('id', phaseId)
      .single()
    if (e1) throw e1

    // Clear existing current in the same scope
    if (phase.module_id === null) {
      await supabase
        .from('phases')
        .update({ is_current: false })
        .eq('project_id', phase.project_id)
        .is('module_id', null)
        .eq('is_current', true)
    } else {
      await supabase
        .from('phases')
        .update({ is_current: false })
        .eq('module_id', phase.module_id)
        .eq('is_current', true)
    }

    // Set this one current + active
    await supabase
      .from('phases')
      .update({ is_current: true, status: 'active' })
      .eq('id', phaseId)
  },

  async complete(phaseId: string): Promise<Phase | null> {
    // Mark this phase completed, then auto-activate the next planned phase (if any).
    const { data: phase, error: e1 } = await supabase
      .from('phases')
      .select('*')
      .eq('id', phaseId)
      .single()
    if (e1) throw e1

    const { error: e2 } = await supabase
      .from('phases')
      .update({ status: 'completed', is_current: false })
      .eq('id', phaseId)
    if (e2) throw e2

    let nextQuery = supabase
      .from('phases')
      .select('*')
      .eq('project_id', phase.project_id)
      .eq('status', 'planned')
      .order('number', { ascending: true })
      .limit(1)

    if (phase.module_id === null) {
      nextQuery = nextQuery.is('module_id', null)
    } else {
      nextQuery = nextQuery.eq('module_id', phase.module_id)
    }

    const { data: next } = await nextQuery
    if (next && next[0]) {
      await supabase
        .from('phases')
        .update({ status: 'active', is_current: true })
        .eq('id', next[0].id)
      return { ...next[0], status: 'active', is_current: true } as Phase
    }
    return null
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('phases').delete().eq('id', id)
    if (error) throw error
  }
}
