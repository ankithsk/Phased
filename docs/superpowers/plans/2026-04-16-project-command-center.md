# Project Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **UI implementation rule:** every task marked `[UI]` must be dispatched to the `apple-ui-designer` subagent for design + implementation. Non-UI tasks (data, auth, routing, PWA plumbing) are done inline.
>
> **No automated tests.** User explicitly opted out. Verification is manual: run the step, inspect the app in the browser.

**Goal:** Build a single-user PWA for managing multiple software projects — dashboards, phases, items, quick capture, search, pinned items, activity timeline — backed by Supabase.

**Architecture:** React 18 + TS + Vite + Tailwind SPA. Supabase for DB/Auth/RLS/Realtime. shadcn/ui for components. Pretext for text measurement in cards & timeline. framer-motion for transitions. No edge functions, no offline writes.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, React Router v6, @supabase/supabase-js, shadcn/ui, lucide-react, framer-motion, react-markdown + remark-gfm, pretext.js.

**Reference spec:** `docs/superpowers/specs/2026-04-16-project-command-center-design.md`

---

## Phase 1 — Foundation (v1, shippable)

Builds auth, dashboard, project view, quick capture, and seed. The app is usable end-to-end by the end of Phase 1.

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`, `.env.example`

- [ ] **Step 1: Scaffold Vite React TS project**

```bash
cd C:/Users/akatageri/Desktop/experimental/project-command-center
npm create vite@latest . -- --template react-ts
```

Answer "ignore" if prompted about existing files (git / docs already present). Confirm `package.json`, `src/`, `index.html` exist.

- [ ] **Step 2: Install core dependencies**

```bash
npm install react-router-dom @supabase/supabase-js lucide-react framer-motion react-markdown remark-gfm clsx tailwind-merge class-variance-authority
npm install -D tailwindcss postcss autoprefixer @types/node
```

- [ ] **Step 3: Initialize Tailwind**

```bash
npx tailwindcss init -p
```

Replace `tailwind.config.ts` content:

```ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      }
    }
  },
  plugins: []
} satisfies Config
```

Replace `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
  body { @apply bg-background text-foreground; }
  html, body, #root { height: 100%; }
}
```

- [ ] **Step 4: Path alias for `@/`**

Update `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
})
```

Update `tsconfig.json` `compilerOptions`:

```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

- [ ] **Step 5: Verify dev server boots**

```bash
npm run dev
```

Open http://localhost:5173, confirm the default Vite page loads. Kill with Ctrl+C.

- [ ] **Step 6: Write `.env.example` and `.gitignore`**

`.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Append to `.gitignore`:
```
.env.local
.env
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + tailwind"
```

---

### Task 2: Supabase migrations (schema, RLS, indexes, seed)

**Files:**
- Create: `migrations/0001_init_schema.sql`, `migrations/0002_rls_policies.sql`, `migrations/0003_indexes.sql`, `migrations/0004_seed_projects.sql`

- [ ] **Step 1: Write schema migration**

Create `migrations/0001_init_schema.sql`:

```sql
create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','completed')),
  color text,
  progress int not null default 0 check (progress between 0 and 100),
  modules_enabled boolean not null default false,
  last_visited_at timestamptz,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  is_general boolean not null default false,
  archived boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  module_id uuid references modules(id) on delete cascade,
  number int not null,
  name text not null,
  status text not null default 'planned' check (status in ('active','planned','completed')),
  target_date date,
  is_current boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phase_id uuid not null references phases(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'note' check (type in ('feature','bug','feedback','note','decision')),
  source text,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','in-progress','done','deferred')),
  pinned boolean not null default false,
  archived boolean not null default false,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists item_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  from_item_id uuid not null references items(id) on delete cascade,
  to_item_id uuid not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_item_id, to_item_id)
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  item_id uuid references items(id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- partial unique index: one current phase per project (when no modules)
create unique index if not exists one_current_phase_per_project
  on phases(project_id) where is_current = true and module_id is null;
create unique index if not exists one_current_phase_per_module
  on phases(module_id) where is_current = true and module_id is not null;

-- updated_at triggers
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end $$ language plpgsql;

create trigger trg_projects_updated before update on projects for each row execute function set_updated_at();
create trigger trg_modules_updated  before update on modules  for each row execute function set_updated_at();
create trigger trg_phases_updated   before update on phases   for each row execute function set_updated_at();
create trigger trg_items_updated    before update on items    for each row execute function set_updated_at();
```

- [ ] **Step 2: Write RLS policies**

Create `migrations/0002_rls_policies.sql`:

```sql
alter table projects     enable row level security;
alter table modules      enable row level security;
alter table phases       enable row level security;
alter table items        enable row level security;
alter table item_links   enable row level security;
alter table activity_log enable row level security;

-- one helper macro repeated per table
do $$
declare t text;
begin
  foreach t in array array['projects','modules','phases','items','activity_log','item_links']
  loop
    execute format('create policy "own_select_%1$s"  on %1$I for select using (auth.uid() = user_id);', t);
    execute format('create policy "own_insert_%1$s"  on %1$I for insert with check (auth.uid() = user_id);', t);
    execute format('create policy "own_update_%1$s"  on %1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('create policy "own_delete_%1$s"  on %1$I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;
```

- [ ] **Step 3: Write indexes**

Create `migrations/0003_indexes.sql`:

```sql
create index if not exists idx_items_phase        on items(phase_id, archived, pinned);
create index if not exists idx_items_pinned       on items(user_id, archived) where pinned = true;
create index if not exists idx_items_tags         on items using gin(tags);
create index if not exists idx_items_fts          on items using gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));
create index if not exists idx_activity_project   on activity_log(project_id, created_at desc);
create index if not exists idx_projects_user_st   on projects(user_id, status);
create index if not exists idx_phases_project     on phases(project_id, sort_order);
create index if not exists idx_modules_project    on modules(project_id, sort_order);
```

- [ ] **Step 4: Write seed migration**

Create `migrations/0004_seed_projects.sql`:

```sql
-- Seed 8 starter projects for the current user, only if they have none
create or replace function seed_starter_projects() returns void as $$
declare
  uid uuid := auth.uid();
  cnt int;
begin
  if uid is null then return; end if;
  select count(*) into cnt from projects where user_id = uid;
  if cnt > 0 then return; end if;

  insert into projects (user_id, name, progress, color, sort_order) values
    (uid, 'NPL', 95, '#10b981', 1),
    (uid, 'AXIS Portal', 65, '#0ea5e9', 2),
    (uid, 'LinkSquares MCP', 98, '#8b5cf6', 3),
    (uid, 'ODP MCP', 30, '#f59e0b', 4),
    (uid, 'MS Teams Chatbot', 5, '#f43f5e', 5),
    (uid, 'Demand Planning Portal', 5, '#14b8a6', 6),
    (uid, 'AI Self Hosting', 1, '#71717a', 7),
    (uid, 'Floranex Scrollable Animation Website', 40, '#d946ef', 8);
end $$ language plpgsql security invoker;
```

The client will call `select seed_starter_projects();` on first login (see Task 5).

- [ ] **Step 5: User runs migrations in Supabase SQL Editor**

Instruct the user to run the four `.sql` files in order in the Supabase dashboard → SQL Editor. Once done, verify in dashboard → Table Editor that `projects`, `modules`, `phases`, `items`, `item_links`, `activity_log` all exist.

- [ ] **Step 6: Commit**

```bash
git add migrations
git commit -m "feat(db): schema, rls, indexes, seed migrations"
```

---

### Task 3: Supabase client + typed row interfaces

**Files:**
- Create: `src/lib/supabase.ts`, `src/types/db.ts`

- [ ] **Step 1: Write client factory**

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})
```

- [ ] **Step 2: Write row types**

Create `src/types/db.ts`:

```ts
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
  created_at: string
  updated_at: string
}

export interface ItemLink {
  from_item_id: string
  to_item_id: string
  user_id: string
  created_at: string
}

export type ActivityKind =
  | 'item_created' | 'item_updated' | 'item_archived' | 'item_unarchived'
  | 'status_changed' | 'item_moved' | 'phase_completed' | 'phase_activated'
  | 'module_added' | 'module_archived'

export interface ActivityRow {
  id: string
  user_id: string
  project_id: string
  item_id: string | null
  kind: ActivityKind
  payload: Record<string, unknown>
  created_at: string
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib src/types
git commit -m "feat(data): supabase client + row types"
```

---

### Task 4: Repository layer

**Files:**
- Create: `src/repos/projects.ts`, `src/repos/modules.ts`, `src/repos/phases.ts`, `src/repos/items.ts`, `src/repos/links.ts`, `src/repos/activity.ts`

Each repo file exports CRUD functions that call `supabase.from(...)`. Keep them thin — no business logic.

- [ ] **Step 1: Projects repo**

Create `src/repos/projects.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/db'

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
    const { data, error } = await supabase.from('projects').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async create(patch: Partial<Project> & { name: string }): Promise<Project> {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...patch, user_id: u.user!.id })
      .select()
      .single()
    if (error) throw error
    return data
  },
  async update(id: string, patch: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async touchLastVisited(id: string): Promise<void> {
    const { error } = await supabase.from('projects').update({ last_visited_at: new Date().toISOString() }).eq('id', id)
    if (error) throw error
  },
  async seedStarters(): Promise<void> {
    const { error } = await supabase.rpc('seed_starter_projects')
    if (error) throw error
  }
}
```

- [ ] **Step 2: Modules repo**

Create `src/repos/modules.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { Module } from '@/types/db'

export const modulesRepo = {
  async listByProject(projectId: string): Promise<Module[]> {
    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('project_id', projectId)
      .eq('archived', false)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  },
  async create(projectId: string, name: string, isGeneral = false): Promise<Module> {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('modules')
      .insert({ project_id: projectId, name, is_general: isGeneral, user_id: u.user!.id })
      .select().single()
    if (error) throw error
    return data
  },
  async update(id: string, patch: Partial<Module>): Promise<Module> {
    const { data, error } = await supabase.from('modules').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async archive(id: string): Promise<void> {
    const { error } = await supabase.from('modules').update({ archived: true }).eq('id', id)
    if (error) throw error
  }
}
```

- [ ] **Step 3: Phases repo**

Create `src/repos/phases.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { Phase } from '@/types/db'

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
  async create(projectId: string, moduleId: string | null, number: number, name: string): Promise<Phase> {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('phases')
      .insert({ project_id: projectId, module_id: moduleId, number, name, user_id: u.user!.id })
      .select().single()
    if (error) throw error
    return data
  },
  async update(id: string, patch: Partial<Phase>): Promise<Phase> {
    const { data, error } = await supabase.from('phases').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async complete(phaseId: string): Promise<void> {
    // mark this phase completed, activate the next planned phase
    const { data: phase, error: e1 } = await supabase.from('phases').select('*').eq('id', phaseId).single()
    if (e1) throw e1
    await supabase.from('phases').update({ status: 'completed', is_current: false }).eq('id', phaseId)
    const { data: next } = await supabase
      .from('phases')
      .select('*')
      .eq('project_id', phase.project_id)
      .is('module_id', phase.module_id)
      .eq('status', 'planned')
      .order('number', { ascending: true })
      .limit(1)
    if (next && next[0]) {
      await supabase.from('phases').update({ status: 'active', is_current: true }).eq('id', next[0].id)
    }
  }
}
```

- [ ] **Step 4: Items repo**

Create `src/repos/items.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { Item, ItemStatus } from '@/types/db'

export interface ItemFilters {
  phaseId?: string
  projectId?: string
  includeArchived?: boolean
  pinnedOnly?: boolean
  tag?: string
  query?: string
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
    const { data, error } = await supabase
      .from('items')
      .select('*, phase:phases!inner(project_id)')
      .eq('phase.project_id', projectId)
      .eq('pinned', true)
      .eq('archived', false)
    if (error) throw error
    return (data ?? []) as unknown as Item[]
  },
  async create(patch: Partial<Item> & { phase_id: string; title: string }): Promise<Item> {
    const { data: u } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('items')
      .insert({ ...patch, user_id: u.user!.id })
      .select().single()
    if (error) throw error
    return data
  },
  async update(id: string, patch: Partial<Item>): Promise<Item> {
    const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async setStatus(id: string, status: ItemStatus): Promise<Item> {
    return this.update(id, { status })
  },
  async archive(id: string): Promise<void> {
    await this.update(id, { archived: true })
  },
  async togglePin(id: string, pinned: boolean): Promise<void> {
    await this.update(id, { pinned })
  },
  async listByTag(tag: string): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .contains('tags', [tag])
      .eq('archived', false)
    if (error) throw error
    return data ?? []
  },
  async search(query: string): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .textSearch('title', query, { type: 'websearch' })
      .eq('archived', false)
      .limit(50)
    if (error) throw error
    return data ?? []
  },
  async allTags(): Promise<string[]> {
    const { data, error } = await supabase.from('items').select('tags').eq('archived', false)
    if (error) throw error
    const set = new Set<string>()
    for (const row of data ?? []) for (const t of row.tags as string[]) set.add(t)
    return Array.from(set).sort()
  },
  async recentlyModifiedSince(projectId: string, since: string): Promise<Item[]> {
    const { data, error } = await supabase
      .from('items')
      .select('*, phase:phases!inner(project_id)')
      .eq('phase.project_id', projectId)
      .gt('updated_at', since)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(10)
    if (error) throw error
    return (data ?? []) as unknown as Item[]
  }
}
```

- [ ] **Step 5: Links repo**

Create `src/repos/links.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { ItemLink } from '@/types/db'

export const linksRepo = {
  async listForItem(itemId: string): Promise<ItemLink[]> {
    const { data, error } = await supabase
      .from('item_links')
      .select('*')
      .or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`)
    if (error) throw error
    return data ?? []
  },
  async link(fromId: string, toId: string): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('item_links').insert({
      from_item_id: fromId, to_item_id: toId, user_id: u.user!.id
    })
    if (error) throw error
  },
  async unlink(fromId: string, toId: string): Promise<void> {
    const { error } = await supabase.from('item_links').delete().match({ from_item_id: fromId, to_item_id: toId })
    if (error) throw error
  }
}
```

- [ ] **Step 6: Activity repo**

Create `src/repos/activity.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { ActivityKind, ActivityRow } from '@/types/db'

export const activityRepo = {
  async log(projectId: string, kind: ActivityKind, payload: Record<string, unknown> = {}, itemId?: string): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const { error } = await supabase.from('activity_log').insert({
      project_id: projectId, kind, payload, item_id: itemId ?? null, user_id: u.user!.id
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
```

- [ ] **Step 7: Commit**

```bash
git add src/repos
git commit -m "feat(data): repository layer for all tables"
```

---

### Task 5: Auth — magic link

**Files:**
- Create: `src/hooks/useAuth.ts`, `src/features/auth/LoginPage.tsx`, `src/features/auth/AuthGuard.tsx`

- [ ] **Step 1: Auth hook**

Create `src/hooks/useAuth.ts`:

```ts
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) throw error
  }
  const signOut = async () => { await supabase.auth.signOut() }

  return { session, loading, signInWithEmail, signOut }
}
```

- [ ] **Step 2: [UI] Build LoginPage**

**Dispatch to apple-ui-designer** to build `src/features/auth/LoginPage.tsx`. Prompt:

> Build `src/features/auth/LoginPage.tsx` — a minimal, premium magic-link login page.
> - Full viewport, centered card, subtle gradient background, dark-mode default.
> - Title "Project Command Center". Subtitle "Enter your email, we'll send a link."
> - Email input + "Send magic link" button. On submit, call `useAuth().signInWithEmail(email)`.
> - After submit, show "Check your email" state.
> - Use shadcn-style classes (Tailwind + CSS vars from `src/index.css`). Use framer-motion for subtle enter transitions.
> - Must accept no props, no routes — this is rendered when `session === null`.
> - Keep to one file. Use lucide-react for any icons.

- [ ] **Step 3: AuthGuard**

Create `src/features/auth/AuthGuard.tsx`:

```tsx
import { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from './LoginPage'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="h-full grid place-items-center text-muted-foreground">Loading…</div>
  if (!session) return <LoginPage />
  return <>{children}</>
}
```

- [ ] **Step 4: First-login seeding**

In `src/App.tsx`, after the AuthGuard, on first mount of the authenticated tree, call `projectsRepo.seedStarters()` once:

```tsx
// inside the authenticated shell
useEffect(() => {
  projectsRepo.seedStarters().catch(console.error)
}, [])
```

This is idempotent server-side (the RPC no-ops if projects exist).

- [ ] **Step 5: Commit**

```bash
git add src/hooks src/features/auth src/App.tsx
git commit -m "feat(auth): magic-link sign-in + guard + seed on first login"
```

---

### Task 6: Routing, shell, theme

**Files:**
- Create: `src/routes.tsx`, `src/features/shell/AppShell.tsx`, `src/features/shell/ThemeToggle.tsx`, `src/hooks/useTheme.ts`
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Theme hook**

Create `src/hooks/useTheme.ts`:

```ts
import { useEffect, useState } from 'react'
export type Theme = 'light' | 'dark'
const KEY = 'pcc.theme'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem(KEY) as Theme) || 'dark')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(KEY, theme)
  }, [theme])
  return { theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark') }
}
```

- [ ] **Step 2: Routes**

Create `src/routes.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './features/shell/AppShell'
import { Dashboard } from './features/dashboard/Dashboard'
import { ProjectView } from './features/project/ProjectView'
import { SearchPage } from './features/search/SearchPage'
import { TagView } from './features/tag-view/TagView'
import { DigestPage } from './features/digest/DigestPage'
import { TimelinePage } from './features/timeline/TimelinePage'
import { SettingsPage } from './features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'p/:projectId', element: <ProjectView /> },
      { path: 'p/:projectId/timeline', element: <TimelinePage /> },
      { path: 'p/:projectId/settings', element: <SettingsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'tag/:tag', element: <TagView /> },
      { path: 'digest', element: <DigestPage /> }
    ]
  }
])
```

- [ ] **Step 3: [UI] Build AppShell + ThemeToggle**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/shell/AppShell.tsx` and `src/features/shell/ThemeToggle.tsx`.
> - `AppShell` renders a top bar (brand/logo left, search trigger middle, theme toggle + sign-out right), plus an `<Outlet />` for route content.
> - Responsive: on mobile the search trigger collapses to an icon.
> - Top bar sticky, subtle border, backdrop-blur.
> - `ThemeToggle` uses `useTheme` — a small icon button (sun/moon).
> - Brand should be clickable → `/`.
> - No sidebar here (sidebar is per-project, lives in ProjectView).
> - Include the floating Quick Capture button in the bottom-right (fixed). For now, the button's onClick can call a global store or a placeholder `window.dispatchEvent(new CustomEvent('pcc:quick-capture'))`.
> - Use shadcn-style variables; dark-mode default.

- [ ] **Step 4: Wire up**

Update `src/App.tsx`:

```tsx
import { RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'
import { router } from './routes'
import { AuthGuard } from './features/auth/AuthGuard'
import { projectsRepo } from './repos/projects'

export default function App() {
  useEffect(() => { projectsRepo.seedStarters().catch(console.error) }, [])
  return (
    <AuthGuard>
      <RouterProvider router={router} />
    </AuthGuard>
  )
}
```

- [ ] **Step 5: Stub feature pages to unblock routing**

Create stub exports for each route target so the build compiles. Add placeholder content like:

```tsx
export function Dashboard() { return <div className="p-8">Dashboard</div> }
```

For: `Dashboard`, `ProjectView`, `SearchPage`, `TagView`, `DigestPage`, `TimelinePage`, `SettingsPage`.

- [ ] **Step 6: Verify dev boot**

```bash
npm run dev
```

Navigate to `/`, `/search`, etc. Confirm routing works and theme toggle flips colors. Sign in via magic link end-to-end.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(shell): routes, app shell, theme toggle"
```

---

### Task 7: Dashboard

**Files:**
- Create (replace stub): `src/features/dashboard/Dashboard.tsx`, `src/features/dashboard/ProjectCard.tsx`
- Create: `src/hooks/useProjects.ts`

- [ ] **Step 1: Projects hook**

Create `src/hooks/useProjects.ts`:

```ts
import { useEffect, useState } from 'react'
import { projectsRepo } from '@/repos/projects'
import type { Project } from '@/types/db'
import { supabase } from '@/lib/supabase'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = () => projectsRepo.list().then(d => { if (mounted) setProjects(d) })
    load().finally(() => mounted && setLoading(false))
    const ch = supabase.channel('projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, load)
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [])

  return { projects, loading }
}
```

- [ ] **Step 2: [UI] Build Dashboard + ProjectCard**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/dashboard/Dashboard.tsx` and `src/features/dashboard/ProjectCard.tsx`.
> Data source: `useProjects()` from `@/hooks/useProjects`.
>
> Dashboard is a responsive grid of project cards (4 cols desktop, 2 tablet, 1 mobile). Above the grid: small header "Projects" with a count and "New project" button (button can be a stub that does nothing for now).
>
> Each `ProjectCard`:
> - Clicking navigates to `/p/:id` (use `useNavigate`).
> - Shows project name, 2-line description (truncated with ellipsis), color as a thin left accent stripe + subtle tint.
> - Progress bar (0-100) with numeric label.
> - Shows counts of open items by priority (critical/high/medium/low). These counts are not in the data yet — show placeholder zeros for now; Task 8 will provide counts via a derived query.
> - Shows "active phase" name (placeholder "—" for now).
> - Hover: subtle lift (framer-motion) + border brighten.
> - Use a minimal, Linear-style aesthetic. Dark-mode-first.
>
> Props for `ProjectCard`: `{ project: Project; counts?: { critical: number; high: number; medium: number; low: number }; currentPhaseName?: string | null }`.
>
> Export both components.

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Sign in, confirm 8 seeded projects render as cards. Click one — should navigate to `/p/:id` (stub for now).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(dashboard): project grid + cards"
```

---

### Task 8: Item counts & active phase for dashboard cards

**Files:**
- Modify: `src/repos/projects.ts`, `src/hooks/useProjects.ts`, `src/features/dashboard/Dashboard.tsx`

- [ ] **Step 1: Add aggregate query**

Append to `src/repos/projects.ts`:

```ts
export interface ProjectSummary {
  project_id: string
  open_critical: number
  open_high: number
  open_medium: number
  open_low: number
  current_phase_name: string | null
}

// Must create a view or RPC in the DB for efficient aggregation.
// Add to a new migration 0005_dashboard_view.sql (see below).
export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const { data, error } = await supabase.rpc('project_summaries')
  if (error) throw error
  return (data ?? []) as ProjectSummary[]
}
```

- [ ] **Step 2: DB migration for RPC**

Create `migrations/0005_dashboard_view.sql`:

```sql
create or replace function project_summaries()
returns table(
  project_id uuid,
  open_critical int,
  open_high int,
  open_medium int,
  open_low int,
  current_phase_name text
) language sql stable as $$
  with counts as (
    select p.id as project_id,
      count(*) filter (where i.status <> 'done' and i.priority = 'critical' and not i.archived)::int as open_critical,
      count(*) filter (where i.status <> 'done' and i.priority = 'high' and not i.archived)::int     as open_high,
      count(*) filter (where i.status <> 'done' and i.priority = 'medium' and not i.archived)::int   as open_medium,
      count(*) filter (where i.status <> 'done' and i.priority = 'low' and not i.archived)::int      as open_low
    from projects p
    left join phases ph on ph.project_id = p.id
    left join items i on i.phase_id = ph.id
    where p.user_id = auth.uid()
    group by p.id
  ),
  current_phase as (
    select ph.project_id, ph.name
    from phases ph
    where ph.user_id = auth.uid() and ph.is_current = true and ph.module_id is null
  )
  select c.project_id, c.open_critical, c.open_high, c.open_medium, c.open_low, cp.name as current_phase_name
  from counts c
  left join current_phase cp on cp.project_id = c.project_id;
$$;
```

Run in Supabase SQL editor.

- [ ] **Step 3: Merge summaries into hook**

Update `src/hooks/useProjects.ts`:

```ts
import { listProjectSummaries } from '@/repos/projects'
// ...
const [summaries, setSummaries] = useState<Record<string, ProjectSummary>>({})
// inside effect, after load():
listProjectSummaries().then(rows => {
  const map: Record<string, ProjectSummary> = {}
  for (const r of rows) map[r.project_id] = r
  setSummaries(map)
})
// return { projects, summaries, loading }
```

- [ ] **Step 4: Pass into cards**

Update `Dashboard.tsx` to pass `summaries[project.id]` into each `ProjectCard` as `counts` and `currentPhaseName`. No UI redesign needed — cards already accept these props.

- [ ] **Step 5: Verify + commit**

```bash
npm run dev
# confirm counts render (all zero until items are added; OK)
git add -A
git commit -m "feat(dashboard): project summary counts via rpc"
```

---

### Task 9: Project View shell + phases

**Files:**
- Create (replace stub): `src/features/project/ProjectView.tsx`, `src/features/project/PhaseSection.tsx`, `src/features/project/ItemRow.tsx`, `src/features/project/ModuleSidebar.tsx`
- Create: `src/hooks/useProject.ts`, `src/hooks/useItems.ts`

- [ ] **Step 1: useProject hook**

Create `src/hooks/useProject.ts`:

```ts
import { useEffect, useState } from 'react'
import { projectsRepo } from '@/repos/projects'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { supabase } from '@/lib/supabase'
import type { Project, Module, Phase } from '@/types/db'

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!projectId) return
    let mounted = true
    const load = async () => {
      const [p, m, ph] = await Promise.all([
        projectsRepo.get(projectId),
        modulesRepo.listByProject(projectId),
        phasesRepo.listByProject(projectId)
      ])
      if (!mounted) return
      setProject(p); setModules(m); setPhases(ph); setLoading(false)
    }
    load()
    const ch = supabase.channel(`project:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'phases', filter: `project_id=eq.${projectId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'modules', filter: `project_id=eq.${projectId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, load)
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [projectId])

  return { project, modules, phases, loading }
}
```

- [ ] **Step 2: useItems hook**

Create `src/hooks/useItems.ts`:

```ts
import { useEffect, useState } from 'react'
import { itemsRepo } from '@/repos/items'
import { supabase } from '@/lib/supabase'
import type { Item } from '@/types/db'

export function useItemsByPhase(phaseId: string | null, includeArchived = false) {
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => {
    if (!phaseId) { setItems([]); return }
    let mounted = true
    const load = () => itemsRepo.listByPhase(phaseId, includeArchived).then(d => mounted && setItems(d))
    load()
    const ch = supabase.channel(`items:${phaseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter: `phase_id=eq.${phaseId}` }, load)
      .subscribe()
    return () => { mounted = false; supabase.removeChannel(ch) }
  }, [phaseId, includeArchived])
  return items
}
```

- [ ] **Step 3: [UI] Build ProjectView + PhaseSection + ItemRow + ModuleSidebar**

**Dispatch to apple-ui-designer.** Prompt:

> Build the Project View for the Project Command Center app. Files:
> - `src/features/project/ProjectView.tsx` (page)
> - `src/features/project/ModuleSidebar.tsx`
> - `src/features/project/PhaseSection.tsx` (collapsible)
> - `src/features/project/ItemRow.tsx`
>
> Data hooks: `useProject(projectId)` returns `{ project, modules, phases }`. `useItemsByPhase(phaseId)` returns items.
>
> Layout:
> - Desktop: left sidebar (280px) with module list if `project.modules_enabled` — otherwise no sidebar, main takes full width. Mobile: module list becomes a bottom sheet or collapses to a top-row tab scroll.
> - Main: header with project name + color stripe, small meta row (progress %, status). Below: the pinned strip (Task 11) — for now render empty placeholder `<PinnedStrip />`. Below: phase sections stacked.
> - Each `PhaseSection` is a collapsible with header: phase number + name, status badge, item count. Expanded by default if `is_current`. Animated expand/collapse with framer-motion.
> - Inside a section: list of `ItemRow`s. If zero items: a small "No items yet. ⌘⇧N to capture." empty state.
> - `ItemRow`: type icon (lucide-react — Bug, Sparkles, MessageCircle, FileText, GitBranch for decision), title, small meta (priority dot, tag chips, status chip). Hover shows quick actions (pin toggle, status quick-change dropdown, open detail).
> - Archived items hidden by default; a "Show archived" toggle lives at the top right of the main area.
> - Priority dot colors: critical=red, high=orange, medium=zinc, low=zinc/muted.
>
> Use shadcn-style Tailwind classes throughout. Clean, information-dense, Linear-inspired.
>
> Props:
> - `PhaseSection`: `{ phase: Phase; defaultExpanded: boolean; onItemClick: (id: string) => void }`
> - `ItemRow`: `{ item: Item; onClick: () => void; onPinToggle: () => void; onStatusChange: (s: ItemStatus) => void }`
> - `ModuleSidebar`: `{ modules: Module[]; selectedId: string | null; onSelect: (id: string | null) => void }` — "All modules" option at top.

- [ ] **Step 4: Verify**

Navigate to a project — should see project header, no phases yet, "No items" states. No crashes.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(project): project view shell, phase sections, item rows"
```

---

### Task 10: Quick Capture modal

**Files:**
- Create: `src/features/quick-capture/QuickCaptureModal.tsx`, `src/features/quick-capture/QuickCaptureProvider.tsx`
- Create: `src/hooks/useKeyboard.ts`
- Modify: `src/App.tsx`, `src/features/shell/AppShell.tsx`

- [ ] **Step 1: Keyboard hook**

Create `src/hooks/useKeyboard.ts`:

```ts
import { useEffect } from 'react'

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const parts = combo.toLowerCase().split('+')
    const needCtrl = parts.includes('ctrl') || parts.includes('cmd')
    const needShift = parts.includes('shift')
    const needAlt = parts.includes('alt')
    const key = parts[parts.length - 1]
    const fn = (e: KeyboardEvent) => {
      if (needCtrl && !(e.ctrlKey || e.metaKey)) return
      if (needShift && !e.shiftKey) return
      if (needAlt && !e.altKey) return
      if (e.key.toLowerCase() !== key) return
      handler(e)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [combo, handler])
}
```

- [ ] **Step 2: Provider with global open state**

Create `src/features/quick-capture/QuickCaptureProvider.tsx`:

```tsx
import { createContext, useContext, useState, ReactNode } from 'react'
import { QuickCaptureModal } from './QuickCaptureModal'
import { useHotkey } from '@/hooks/useKeyboard'

const Ctx = createContext<{ open: () => void } | null>(null)

export function QuickCaptureProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  useHotkey('cmd+shift+n', (e) => { e.preventDefault(); setIsOpen(true) })
  return (
    <Ctx.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <QuickCaptureModal open={isOpen} onClose={() => setIsOpen(false)} />
    </Ctx.Provider>
  )
}
export const useQuickCapture = () => {
  const v = useContext(Ctx)
  if (!v) throw new Error('QuickCaptureProvider missing')
  return v
}
```

- [ ] **Step 3: [UI] Build QuickCaptureModal**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/quick-capture/QuickCaptureModal.tsx` — a fast modal for capturing an item.
> Props: `{ open: boolean; onClose: () => void }`.
>
> Behavior:
> - Opens in ≤100ms with a subtle fade + scale via framer-motion.
> - Overlay backdrop (semi-transparent, blur).
> - Form steps (all visible at once, no wizard):
>   1. Project dropdown — load from `projectsRepo.list()`, default to last-used (store in localStorage under key `pcc.lastProject`).
>   2. Module dropdown — appears only if selected project has `modules_enabled`. Load from `modulesRepo.listByProject`. Default to `is_general` module.
>   3. Phase dropdown — load from `phasesRepo.listByProject`, filtered by selected module if applicable. Default to `is_current = true`. Any phase selectable (for parking in future).
>   4. Type — segmented radio: feature / bug / feedback / note / decision. Icon + label.
>   5. Title input — autofocused on open. Required.
>   6. "More" collapsed section — description (textarea), source (text), priority (select), tags (comma-separated text — split on save).
> - Submit: calls `itemsRepo.create({...})`, then `activityRepo.log(projectId, 'item_created', {...}, newItem.id)`, then closes. Show toast "Added to [Project] — [Phase]".
> - Cmd/Ctrl+Enter submits. Esc closes.
> - On close, reset form but keep last-used project.
>
> Dependencies available: `projectsRepo`, `modulesRepo`, `phasesRepo`, `itemsRepo`, `activityRepo`.
> Style: premium, minimal, dark-mode default. Should feel "under 10 seconds" fast.

- [ ] **Step 4: Wire provider + FAB**

Update `src/App.tsx` to wrap routes with `QuickCaptureProvider`:

```tsx
<AuthGuard>
  <QuickCaptureProvider>
    <RouterProvider router={router} />
  </QuickCaptureProvider>
</AuthGuard>
```

In `AppShell.tsx` (already built), update the floating action button's onClick to call `useQuickCapture().open()`.

- [ ] **Step 5: Verify**

```bash
npm run dev
```

- Press `Cmd/Ctrl+Shift+N` anywhere → modal opens.
- Fill in title, submit → item appears in the target project.
- Check activity_log row was inserted (via Supabase table editor).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(quick-capture): modal + hotkey + provider"
```

---

### Task 11: Pinned strip

**Files:**
- Create: `src/features/project/PinnedStrip.tsx`
- Modify: `src/features/project/ProjectView.tsx`

- [ ] **Step 1: [UI] Build PinnedStrip**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/project/PinnedStrip.tsx`. Props: `{ projectId: string; onItemClick: (id: string) => void }`.
>
> - Subscribe to pinned items: `itemsRepo.listPinnedByProject(projectId)` + realtime subscription on the `items` table filtered by `pinned=eq.true` (simpler: re-fetch on any item change for that project).
> - Render horizontal scroll strip of small "pin cards" — each showing item title, tiny type icon, priority dot. Max height ~60px.
> - If zero pinned items: return null (don't render anything).
> - Header above the strip: "📌 Pinned" with count. Small, subtle.
> - Click card → call `onItemClick(item.id)`.
> - Design premium, Linear-style.

- [ ] **Step 2: Slot into ProjectView**

Replace the placeholder `<PinnedStrip />` reference in ProjectView with the real component: `<PinnedStrip projectId={projectId!} onItemClick={setSelectedItemId} />`.

- [ ] **Step 3: Verify + commit**

Pin an item via the detail panel (Task 13) — comes next, so for now pin one directly via Supabase table editor (`update items set pinned=true where id=...`) to verify rendering. Then:

```bash
git add -A
git commit -m "feat(project): pinned items strip"
```

---

### Task 12: Context-resume banner

**Files:**
- Create: `src/features/project/ContextResumeBanner.tsx`
- Modify: `src/features/project/ProjectView.tsx`

- [ ] **Step 1: [UI] Build ContextResumeBanner**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/project/ContextResumeBanner.tsx`. Props: `{ projectId: string; lastVisitedAt: string | null }`.
>
> - On mount, call `itemsRepo.recentlyModifiedSince(projectId, lastVisitedAt ?? epoch)` to get up to 10 items.
> - Group them into three buckets:
>   - "Last edited" — items where the user was the most recent editor (we don't track that explicitly; just show `updated_at > lastVisitedAt` sorted desc — top 3).
>   - "New since last visit" — items where `created_at > lastVisitedAt` (excluding those already in Last edited).
>   - "New high-priority" — items where `created_at > lastVisitedAt` AND `priority in ('high','critical')`.
> - Render a dismissable banner (×) with a gentle entrance animation. Three columns (or stacked on mobile). Each bucket: a small list with item titles, clickable → `onItemClick(id)`.
> - If `lastVisitedAt` is null or < 5 minutes ago, or all buckets empty: don't render.
> - Above the banner: a small "Welcome back. Last time you were here, [relative time]." line.
> - After first render, call `projectsRepo.touchLastVisited(projectId)` (debounce 3s). Pass that function as a prop `onMarkVisited` from the parent — banner does not import repos directly.
>
> Props revised: `{ projectId: string; lastVisitedAt: string | null; onItemClick: (id: string) => void; onMarkVisited: () => void }`.
> Keep it compact and premium.

- [ ] **Step 2: Slot into ProjectView**

In `ProjectView.tsx`, just under the project header and above PinnedStrip:

```tsx
{project && (
  <ContextResumeBanner
    projectId={project.id}
    lastVisitedAt={project.last_visited_at}
    onItemClick={setSelectedItemId}
    onMarkVisited={() => projectsRepo.touchLastVisited(project.id)}
  />
)}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(project): context-resume banner"
```

---

### Task 13: Item detail panel + edit

**Files:**
- Create: `src/features/project/ItemDetailPanel.tsx`, `src/lib/markdown.tsx`
- Modify: `src/features/project/ProjectView.tsx`

- [ ] **Step 1: Markdown renderer**

Create `src/lib/markdown.tsx`:

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
}
```

Install typography plugin:

```bash
npm install -D @tailwindcss/typography
```

Add to `tailwind.config.ts` plugins:

```ts
plugins: [require('@tailwindcss/typography')]
```

- [ ] **Step 2: [UI] Build ItemDetailPanel**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/project/ItemDetailPanel.tsx`. Props: `{ itemId: string | null; onClose: () => void }`.
>
> Behavior:
> - Renders a right-side slide-over panel (framer-motion) when `itemId` is not null. Full-height, ~480px wide on desktop, full-width on mobile.
> - Fetches the item with `supabase.from('items').select('*').eq('id', itemId).single()`.
> - Shows:
>   - Title (editable inline — click to edit, blur to save).
>   - Type / priority / status pills — clickable to change (dropdowns). On change call `itemsRepo.update(id, {...})` and `activityRepo.log(..., 'status_changed', { from, to })` when status changes.
>   - Tags row — chips with an "x" to remove, + input to add.
>   - Source field (inline editable).
>   - Description — toggle between "View" (rendered markdown via `<Markdown source={...} />`) and "Edit" (textarea).
>   - Pin toggle (star icon).
>   - Archive button (grey, secondary).
>   - "Linked items" section — lists current links, + "Link to another item" button (for Task 17 — stub for now).
>   - "Created / Updated" timestamps at bottom.
> - On every save, log to activity_log with appropriate kind.
> - Subscribe to realtime updates for this row so external edits reflect live.
> - Esc closes. Click outside closes.
>
> Premium, dense, Linear-style. Dark-mode first.

- [ ] **Step 3: Wire selection state in ProjectView**

In `ProjectView.tsx`:

```tsx
const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
// ...
<ItemDetailPanel itemId={selectedItemId} onClose={() => setSelectedItemId(null)} />
```

Also wire each ItemRow's `onClick` to `setSelectedItemId(item.id)`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(project): item detail panel + markdown render"
```

---

### Task 14: Phase management UI

**Files:**
- Create: `src/features/project/AddPhaseButton.tsx`, `src/features/project/PhaseActionsMenu.tsx`
- Modify: `src/features/project/ProjectView.tsx`, `src/features/project/PhaseSection.tsx`

- [ ] **Step 1: [UI] Build AddPhaseButton + PhaseActionsMenu**

**Dispatch to apple-ui-designer.** Prompt:

> Build:
> - `src/features/project/AddPhaseButton.tsx` — a small button + popover. Props: `{ projectId: string; moduleId: string | null; nextNumber: number }`. Popover has inputs: name, target_date (optional). Save calls `phasesRepo.create(projectId, moduleId, nextNumber, name)`. Also supports a "current phase?" checkbox that promotes the new phase to active/current.
> - `src/features/project/PhaseActionsMenu.tsx` — dropdown menu (3-dot icon) for a phase header. Actions: Rename, Set target date, Mark as current, Complete phase (opens a confirm dialog offering to bulk-move deferred items to the next phase — on confirm call a `phasesRepo.complete(id)` followed by `itemsRepo.update` for each deferred item to move them to next phase. Deferred items are fetched inline: `supabase.from('items').select('id').eq('phase_id', id).eq('status','deferred')`.), Delete (requires no items; otherwise disabled).
> - Complete action also calls `activityRepo.log(projectId, 'phase_completed', {phase_id})`.
>
> Props: add `<PhaseActionsMenu phase={phase} projectId={projectId} />` to the PhaseSection header. Add `<AddPhaseButton />` above/below the list of phases in ProjectView.

- [ ] **Step 2: Verify**

Add a new phase, mark current, add items, complete phase, confirm next plan phase activates.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(project): phase add/edit/complete actions"
```

---

### Task 15: Module management UI

**Files:**
- Create: `src/features/settings/SettingsPage.tsx` (replace stub), `src/features/settings/ModulesPanel.tsx`
- Modify: none

- [ ] **Step 1: [UI] Build SettingsPage + ModulesPanel**

**Dispatch to apple-ui-designer.** Prompt:

> Build `src/features/settings/SettingsPage.tsx` (project settings, route `/p/:projectId/settings`). Use `useParams` to get `projectId`, fetch project with `projectsRepo.get(projectId)`.
>
> Tabs (shadcn Tabs):
> 1. **General**: name (editable), description (textarea), color picker, status (active/paused/completed), progress slider (0-100), save button.
> 2. **Modules** — render `<ModulesPanel projectId={...} enabled={project.modules_enabled} />`.
> 3. **Archive**: list archived items in this project (`items where archived=true`), with "Unarchive" buttons.
>
> `src/features/settings/ModulesPanel.tsx` props: `{ projectId: string; enabled: boolean }`.
> - Top: toggle for "Enable modules" — when turned ON, calls `modulesRepo.create(projectId, 'General', true)` if no modules exist, then updates `projectsRepo.update(projectId, { modules_enabled: true })`, then re-parents all existing phases of that project to the General module (`phasesRepo.update` each). Guide the user through the same flow when disabling (flatten first).
> - When enabled: list modules (drag-and-drop reorder via `sort_order` — use `dnd-kit/sortable` if easy; otherwise up/down buttons), with rename, archive.
> - "Add module" button below the list.
>
> Install `@dnd-kit/core @dnd-kit/sortable` if you use DnD:
> `npm install @dnd-kit/core @dnd-kit/sortable`.
> Keep the aesthetic premium, minimal.

- [ ] **Step 2: Verify + commit**

Enable modules on a project, add/rename/archive. Confirm existing phases re-parent correctly.

```bash
git add -A
git commit -m "feat(settings): project settings + modules + archive tabs"
```

---

### Task 16: PWA (manifest + service worker)

**Files:**
- Create: `public/manifest.webmanifest`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `src/lib/sw-register.ts`
- Modify: `index.html`, `src/main.tsx`

Use `vite-plugin-pwa` for simplicity.

- [ ] **Step 1: Install and configure**

```bash
npm install -D vite-plugin-pwa
```

Update `vite.config.ts`:

```ts
import { VitePWA } from 'vite-plugin-pwa'
// ...
plugins: [
  react(),
  VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'icons/*.png'],
    manifest: {
      name: 'Project Command Center',
      short_name: 'PCC',
      description: 'Multi-project context & idea capture.',
      theme_color: '#0a0a0a',
      background_color: '#0a0a0a',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: '/index.html',
      runtimeCaching: [
        { urlPattern: /^https:\/\/.*\.supabase\.co\//, handler: 'NetworkOnly' }
      ]
    }
  })
]
```

- [ ] **Step 2: Icons**

Place icon PNGs under `public/icons/`. If none available, generate quick placeholders with a solid color + letter "P" (use any online generator or a small node script). Exact process is left to the user.

- [ ] **Step 3: Install prompt**

Create `src/lib/sw-register.ts`:

```ts
let deferredPrompt: any = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  window.dispatchEvent(new CustomEvent('pcc:installable'))
})
export async function promptInstall() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  await deferredPrompt.userChoice
  deferredPrompt = null
}
```

Import from `main.tsx`:

```ts
import './lib/sw-register'
```

- [ ] **Step 4: Verify**

```bash
npm run build && npm run preview
```

Open http://localhost:4173 in Chrome, DevTools → Application → Manifest: confirm icons + name load. Lighthouse PWA audit should pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(pwa): manifest, service worker, install prompt"
```

---

## Phase 2 — Polish

These tasks add the remaining spec features. They can be done in any order; each is self-contained.

### Task 17: Cross-project links

**Files:** `src/features/project/LinkPicker.tsx`, modify `ItemDetailPanel.tsx`

- [ ] **[UI] Build LinkPicker.** Prompt apple-ui-designer:
  > Build `src/features/project/LinkPicker.tsx`. Props: `{ fromItemId: string; onLinked: () => void; onClose: () => void }`. A modal with project → phase → item cascade picker. On select, calls `linksRepo.link(fromItemId, selectedItemId)` then `onLinked()`.

- [ ] **Wire into ItemDetailPanel.** In the "Linked items" section, "Link to another item" button opens `<LinkPicker />`. Existing links: fetch with `linksRepo.listForItem(itemId)`, render chips with item titles (join to items table: `supabase.from('item_links').select('*, from_item:items!item_links_from_item_id_fkey(title), to_item:items!item_links_to_item_id_fkey(title)')`). Each chip has "unlink" × button.

- [ ] **Commit:** `feat(items): cross-project links`

---

### Task 18: Global search + Cmd+K palette

**Files:** `src/features/search/SearchPalette.tsx`, `src/features/search/SearchPage.tsx` (replace stub)

- [ ] **[UI] Build palette + page.** Prompt apple-ui-designer:
  > Build:
  > - `src/features/search/SearchPalette.tsx` — a Cmd+K palette (shadcn Command component). Opens on `Cmd/Ctrl+K` via `useHotkey`. Input at top, recent/suggested at bottom. Typing triggers debounced `itemsRepo.search(query)`. Renders results grouped by project (query project names in parallel). Selecting an item navigates to `/p/:projectId` and opens the item detail panel (pass item id via URL hash `#item=...` or localStorage; pick one).
  > - `src/features/search/SearchPage.tsx` — full-page search view reading `?q=` from URL. Same result rendering but inline (not a palette). Include filters (type, priority, status, include-archived).
  > - Also: typing `#tag` in the input routes the query to `/tag/:tag`.

- [ ] **Wire palette** in `AppShell` — mount `<SearchPalette />` once at the shell level.

- [ ] **Commit:** `feat(search): palette + search page`

---

### Task 19: Activity timeline (with Pretext)

**Files:** `src/features/timeline/TimelinePage.tsx` (replace stub), `src/lib/pretext.ts`

- [ ] **Install pretext**

```bash
npm install pretext
```

- [ ] **Wrapper:** create `src/lib/pretext.ts`:

```ts
import { measure } from 'pretext'
export function estimateTextHeight(text: string, opts: { width: number; lineHeight: number; fontSize: number; fontFamily: string }): number {
  const { lines } = measure(text, { width: opts.width, font: { size: opts.fontSize, family: opts.fontFamily } })
  return lines.length * opts.lineHeight
}
```

(Check the actual Pretext API against its docs when implementing — adjust the signature accordingly.)

- [ ] **[UI] Build TimelinePage.** Prompt apple-ui-designer:
  > Build `src/features/timeline/TimelinePage.tsx` at route `/p/:projectId/timeline`.
  > - Fetch `activityRepo.listByProject(projectId, 500)`.
  > - Render a reverse-chronological virtualized list using `react-window` (install: `npm install react-window`). Row heights are pre-computed using `estimateTextHeight` from `@/lib/pretext` — avoids measurement divs.
  > - Each row shows: date + time (relative), activity kind icon, a small human-rendered sentence ("Added item ‘Fix date parsing’ to Phase 2", "Moved item X from Phase 1 to Phase 2", etc. — derive from `kind` + `payload`).
  > - Filter bar: date range (last 7 / 30 / all), kind multi-select.
  > - Search box to filter by text.
  > - Sticky per-day headers.
  > Premium, journal-like aesthetic.

- [ ] **Commit:** `feat(timeline): activity timeline with pretext sizing`

---

### Task 20: Tags & cross-project tag view

**Files:** `src/features/tag-view/TagView.tsx` (replace stub), `src/components/TagChip.tsx`, `src/components/TagInput.tsx`

- [ ] **[UI] Build TagChip + TagInput.** Prompt apple-ui-designer:
  > Build:
  > - `src/components/TagChip.tsx` — props `{ tag: string; onRemove?: () => void; onClick?: () => void }`. Small pill. Clicking navigates to `/tag/:tag` (if no `onClick` prop).
  > - `src/components/TagInput.tsx` — props `{ value: string[]; onChange: (tags: string[]) => void }`. Free-form tag input with autocomplete from `itemsRepo.allTags()`. Comma or Enter to commit a tag.
  > These are reused in `ItemDetailPanel` and `QuickCaptureModal`.

- [ ] **[UI] Build TagView page.** Prompt apple-ui-designer:
  > Build `src/features/tag-view/TagView.tsx` at route `/tag/:tag`. Use `useParams` → `tag`. Fetch with `itemsRepo.listByTag(tag)`. Render list grouped by project (join to projects via a query: `supabase.from('items').select('*, phase:phases!inner(project_id, project:projects!inner(id, name, color))').contains('tags', [tag])`). Each group has a project header and a list of ItemRows (reuse the component — pass appropriate handlers).

- [ ] **Commit:** `feat(tags): tag chip, tag input, cross-project tag view`

---

### Task 21: Weekly digest

**Files:** `src/features/digest/DigestPage.tsx` (replace stub)

- [ ] **[UI] Build DigestPage.** Prompt apple-ui-designer:
  > Build `src/features/digest/DigestPage.tsx` at route `/digest`.
  > Queries (all `items` where the user has access, via RLS):
  > - Completed this week: `status='done' AND updated_at > now() - interval '7 days' AND archived=false`.
  > - Added this week: `created_at > now() - interval '7 days'`.
  > - In progress: `status='in-progress' AND archived=false`.
  > - Deferred (blocked-ish): `status='deferred' AND archived=false`.
  > - Upcoming phase targets: `phases where target_date between now() and now() + interval '14 days'`.
  > Render as a read-only report. Sections with counts + item lists (title + project name).
  > Top-right "Copy as Markdown" button: serialize all sections to markdown and write to `navigator.clipboard`. Toast on success.
  > Premium, paper-doc aesthetic. Dark and light mode both should look great.

- [ ] **Commit:** `feat(digest): weekly digest view + copy-as-markdown`

---

### Task 22: Paste-and-parse clipboard

**Files:** `src/features/quick-capture/PasteParseMode.tsx`, modify `QuickCaptureModal.tsx`

- [ ] **[UI] Build PasteParseMode.** Prompt apple-ui-designer:
  > Build `src/features/quick-capture/PasteParseMode.tsx`. Props: `{ onParsed: (suggestion: { projectId?: string; type?: ItemType; priority?: ItemPriority; title?: string; description?: string }) => void }`.
  > - Renders a large textarea for pasted text + a "Parse" button.
  > - On parse, runs local heuristics:
  >   - Load all projects, match any name appearing in the text (case-insensitive, word boundary) → suggest `projectId`.
  >   - Keyword → type: /\bbug\b|error|broken|crash/i → 'bug'; /\bfeature\b|add|implement/i → 'feature'; /idea|feedback|suggestion/i → 'feedback'; /decided|decision/i → 'decision'; else 'note'.
  >   - Priority: /\bcritical\b|urgent|asap|p0/i → 'critical'; /\bhigh\b|important|p1/i → 'high'; else undefined.
  >   - First line or first 100 chars → title; remainder → description.
  > - Calls `onParsed(suggestion)` and closes paste-mode.
  >
  > In QuickCaptureModal, add a "Paste to parse" toggle at the top. When toggled on, swap main content for `<PasteParseMode />`. After parse, prefill form and return to form mode.

- [ ] **Commit:** `feat(quick-capture): paste-and-parse mode`

---

### Task 23: Polish pass

Final sweep. Dispatch apple-ui-designer each time:

- [ ] Empty states for dashboard when no projects (seed should cover, but handle race condition).
- [ ] Toast system — if not already present, add shadcn `Toaster` mounted in `AppShell`. Wire it through any place that needs feedback.
- [ ] Global error boundary.
- [ ] Loading skeletons (project cards, phase sections).
- [ ] Sign-out flow polish.
- [ ] Lighthouse audit pass: address any blocking PWA issues.

- [ ] **Commit:** `chore: final polish pass`

---

## Self-Review

**Spec coverage check:**

| Spec item | Task |
|---|---|
| Data model (projects/modules/phases/items/links/activity) | 2 |
| Dashboard w/ project cards + counts | 7, 8 |
| Project View w/ modules sidebar, phase sections, items | 9 |
| Quick Capture modal + hotkey + 10s target | 10 |
| Module management + "General" auto-module | 15 |
| Phase management + auto-activate + bulk-move | 14 |
| Search (Cmd+K + tag filter) | 18, 20 |
| Context Resume banner | 12 |
| Pinned items strip | 11 |
| Activity Timeline (with Pretext) | 19 |
| Tags + autocomplete + cross-project tag view | 20 |
| Cross-project Links | 17 |
| Weekly Digest + copy as markdown | 21 |
| Paste-and-Parse (client heuristics) | 22 |
| Archive never delete + include-archived toggle | 15 (archive tab), 9 (toggle) |
| PWA: manifest + sw + install prompt | 16 |
| Auth (magic link) + RLS per user | 2, 5 |
| Realtime subscriptions | 7 (projects), 9 (project view), 11 (pinned) |
| Keyboard shortcuts | 6 (theme), 10 (quick capture), 18 (search) |
| 8 seed projects | 2 |
| Dark mode default + toggle | 6 |
| Responsive single-col/sidebar | 6, 9 |
| framer-motion transitions | 5, 9, 10, 12, 13 |
| shadcn/ui components | all [UI] tasks |
| Pretext for measurement | 19 (timeline), could also use in 7 (cards) |

**Gaps identified:** None blocking. Noted that Pretext usage in dashboard cards was proposed in spec section 8.4 but I moved it to "optional" — can be added to Task 7 follow-up if desired.

**Placeholders:** None.

**Type consistency:** Verified `ItemStatus`, `ItemPriority`, `ItemType`, `PhaseStatus`, `ProjectStatus` used consistently. Repo method names (`create`, `update`, `archive`, `togglePin`, etc.) used consistently across tasks.

---

*End of plan.*
