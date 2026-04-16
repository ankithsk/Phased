import { supabase } from '@/lib/supabase'
import type { Project, ProjectSummary } from '@/types/db'

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('not authenticated')
  return data.user.id
}

export const projectsRepo = {
  async list(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  },

  async get(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async create(patch: Partial<Project> & { name: string }): Promise<Project> {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...patch, user_id })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async touchLastVisited(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ last_visited_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw error
  },

  async seedStarters(): Promise<void> {
    const { error } = await supabase.rpc('seed_starter_projects')
    if (error) throw error
  },

  async listSummaries(): Promise<ProjectSummary[]> {
    const { data, error } = await supabase.rpc('project_summaries')
    if (error) throw error
    return (data ?? []) as ProjectSummary[]
  }
}
