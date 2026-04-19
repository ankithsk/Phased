// Database row types. Mirror the SQL schema in migrations/0001_init_schema.sql.

export type ProjectStatus = 'active' | 'paused' | 'completed'
export type PhaseStatus = 'active' | 'planned' | 'completed'
export type ItemType = 'feature' | 'bug' | 'feedback' | 'note' | 'decision'
export type ItemPriority = 'low' | 'medium' | 'high' | 'critical'
export type ItemStatus = 'open' | 'in-progress' | 'done' | 'deferred'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: ProjectStatus
  color: string | null
  progress: number
  modules_enabled: boolean
  last_visited_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  user_id: string
  project_id: string
  name: string
  description: string | null
  is_general: boolean
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Phase {
  id: string
  user_id: string
  project_id: string
  module_id: string | null
  number: number
  name: string
  status: PhaseStatus
  target_date: string | null
  is_current: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type GoalStatus = 'active' | 'achieved' | 'dropped'

export interface Goal {
  id: string
  user_id: string
  project_id: string
  name: string
  description: string | null
  status: GoalStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  user_id: string
  phase_id: string
  title: string
  description: string | null
  type: ItemType
  source: string | null
  priority: ItemPriority
  status: ItemStatus
  pinned: boolean
  archived: boolean
  tags: string[]
  /** ISO date (YYYY-MM-DD). When set and <= today, surfaces in the digest. */
  revisit_at: string | null
  /** ISO date. Items with snoozed_until > today are hidden from phase lists
   *  until the user toggles "Show snoozed". */
  snoozed_until: string | null
  /** Optional link to a project goal (null = unassigned). */
  goal_id: string | null
  created_at: string
  updated_at: string
}

export type LinkRelation = 'links' | 'blocks'

export interface ItemLink {
  from_item_id: string
  to_item_id: string
  relation: LinkRelation
  user_id: string
  created_at: string
}

export type ActivityKind =
  | 'item_created'
  | 'item_updated'
  | 'item_archived'
  | 'item_unarchived'
  | 'status_changed'
  | 'item_moved'
  | 'phase_created'
  | 'phase_completed'
  | 'phase_activated'
  | 'module_created'
  | 'module_archived'
  | 'item_linked'
  | 'item_unlinked'

export interface ActivityRow {
  id: string
  user_id: string
  project_id: string
  item_id: string | null
  kind: ActivityKind
  payload: Record<string, unknown>
  created_at: string
}

export interface ProjectSummary {
  project_id: string
  open_critical: number
  open_high: number
  open_medium: number
  open_low: number
  current_phase_name: string | null
}
