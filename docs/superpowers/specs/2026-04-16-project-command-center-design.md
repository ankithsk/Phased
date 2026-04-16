# Project Command Center — Design Spec

**Date:** 2026-04-16
**Owner:** akatageri
**Status:** Draft — awaiting user approval

---

## 1. Purpose

A single-page React PWA for managing multiple personal/work software projects. Preserves context across phases and captures feedback/ideas quickly so nothing gets lost when context-switching between projects.

Single-user tool, server-backed (Supabase), installable on desktop and mobile.

---

## 2. Scope & Non-Goals

**In scope**
- Hierarchical data model: Project → Module (optional) → Phase → Item
- Dashboard, Project View, Quick Capture, Module/Phase management
- Global search, context-resume banner, pinned items, activity timeline
- Tags, cross-project links, weekly digest, clipboard paste-and-parse (heuristic, client-side)
- Archive-never-delete semantics
- PWA: installable, app-shell caching, manifest + service worker
- Supabase auth, RLS-protected per-user data

**Out of scope (initial build)**
- Multi-user collaboration or sharing
- Offline writes / sync queue (online-only for data)
- AI-powered clipboard parsing (keyword heuristics only, no LLM)
- Edge functions
- Automated tests (manual testing only)
- Email/push notifications
- Mobile-native apps (PWA install is sufficient)

---

## 3. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | React 18 + TypeScript | Standard, requested |
| Build | Vite | Fast, requested |
| Styling | Tailwind CSS | Requested |
| Routing | React Router v6 | Standard for multi-view SPA |
| Component kit | shadcn/ui (Radix + Tailwind recipes) | Custom Linear/Notion-style look without reinventing primitives |
| Icons | lucide-react | shadcn default; clean |
| Animation | framer-motion | Requested |
| Markdown | `react-markdown` + `remark-gfm` | Renders GFM-flavored markdown |
| Text layout | Pretext.js | Accurate, fast text measurement for card-description truncation and virtualized timeline row heights |
| Backend | Supabase (Postgres + Auth + RLS + Realtime) | No server to run, realtime row subscriptions replace manual polling |
| Data client | `@supabase/supabase-js` | Direct from browser, RLS enforces access |
| PWA | Vanilla `manifest.webmanifest` + hand-written service worker (or `vite-plugin-pwa`) | App-shell + static assets only; no offline write queue |

**No edge functions.** All CRUD happens via Supabase auto-generated REST + RLS policies.

---

## 4. Data Model

### 4.1 Postgres schema

All tables include `id uuid primary key default gen_random_uuid()`, `user_id uuid not null references auth.users(id) on delete cascade`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`. RLS policies: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE.

```
projects
  name text not null
  description text
  status text check (status in ('active','paused','completed')) default 'active'
  color text                       -- hex, e.g. '#f97316'
  progress int check (progress between 0 and 100) default 0
  modules_enabled boolean default false
  last_visited_at timestamptz       -- for context-resume banner
  sort_order int default 0

modules
  project_id uuid references projects(id) on delete cascade
  name text not null
  description text
  is_general boolean default false  -- auto-created 'General' module
  archived boolean default false
  sort_order int default 0

phases
  project_id uuid references projects(id) on delete cascade
  module_id uuid references modules(id) on delete cascade -- nullable
  number int not null               -- 0, 1, 2...
  name text not null                -- 'Phase 0 — Foundation'
  status text check (status in ('active','planned','completed')) default 'planned'
  target_date date
  is_current boolean default false  -- one per project/module
  sort_order int default 0

items
  phase_id uuid references phases(id) on delete cascade
  title text not null
  description text                   -- markdown source
  type text check (type in ('feature','bug','feedback','note','decision')) default 'note'
  source text                        -- free-form
  priority text check (priority in ('low','medium','high','critical')) default 'medium'
  status text check (status in ('open','in-progress','done','deferred')) default 'open'
  pinned boolean default false
  archived boolean default false
  tags text[] default '{}'           -- denormalized for fast filtering

item_links
  from_item_id uuid references items(id) on delete cascade
  to_item_id uuid references items(id) on delete cascade
  primary key (from_item_id, to_item_id)
  -- cross-project dependencies

activity_log
  project_id uuid references projects(id) on delete cascade
  item_id uuid references items(id) on delete set null
  kind text                          -- 'item_created','status_changed','phase_completed','item_moved','item_archived', etc.
  payload jsonb                      -- flexible per-kind details (old/new values, etc.)
```

**Notes on modeling decisions:**
- **Tags** stored as `text[]` column on `items` instead of a separate table. Simpler queries, no join. Autocompletion queries `select distinct unnest(tags) from items where user_id = auth.uid()`.
- **One `is_current` per scope.** Enforced via partial unique index: `create unique index one_current_phase_per_project on phases(project_id) where is_current = true and module_id is null;` plus a module-scoped variant.
- **Activity log rows are written by client-side repo helpers**, not DB triggers, so logic stays in one language.
- **Cascades** are set to cascade on user deletion but items are soft-archived within the app (`archived=true`).

### 4.2 Indexes

- `items(phase_id, archived, pinned)` — project-view lookups
- `items(user_id, archived) where pinned = true` — pinned-items view
- `items using gin(tags)` — tag filtering
- `items using gin(to_tsvector('english', title || ' ' || coalesce(description,'')))` — full-text search
- `activity_log(project_id, created_at desc)` — timeline pagination
- `projects(user_id, status)` — dashboard

### 4.3 Seed

Migration seeds 8 projects with status `active`, `modules_enabled=false`, no modules/phases (user builds those later):

| Name | Progress | Color |
|---|---|---|
| NPL | 95 | emerald-500 |
| AXIS Portal | 65 | sky-500 |
| LinkSquares MCP | 98 | violet-500 |
| ODP MCP | 30 | amber-500 |
| MS Teams Chatbot | 5 | rose-500 |
| Demand Planning Portal | 5 | teal-500 |
| AI Self Hosting | 1 | zinc-500 |
| Floranex Scrollable Animation Website | 40 | fuchsia-500 |

Seed runs conditionally (only inserts if the user has zero projects) so re-running the migration is idempotent.

---

## 5. Auth

- Supabase **email magic link** (passwordless).
- Single-user in practice: anyone *could* register, but RLS means they see only their own data.
- Optional hardening: restrict signups via Supabase dashboard (disable public sign-ups, manually invite yourself).
- Session persisted by `supabase-js` in localStorage. Token refresh automatic.
- Auth guard component redirects unauthenticated users to `/login`.

---

## 6. Routes

| Path | View |
|---|---|
| `/login` | Email magic-link form |
| `/` | Dashboard — grid of project cards |
| `/p/:projectId` | Project view — sidebar (modules) + phase sections |
| `/p/:projectId/timeline` | Activity timeline |
| `/p/:projectId/settings` | Module toggle, archive list, project rename/color |
| `/search?q=…` | Global search results |
| `/tag/:tag` | Cross-project tag filter |
| `/digest` | Weekly digest, exportable as markdown |

Quick-capture modal and global search palette are **overlay modals**, not routes — they open from any page.

---

## 7. Key Feature Behaviors

### 7.1 Quick Capture
Triggered by floating action button or `Cmd/Ctrl+Shift+N` (changed from spec's `Cmd+N` because browsers intercept that). Modal steps:

1. Pick project (defaults to last-used)
2. Pick module (skipped if project doesn't have modules; defaults to "General" if it does)
3. Pick phase (defaults to current active phase; dropdown shows all phases)
4. Type — one-click radio (feature/bug/feedback/note/decision)
5. Title (required)
6. Description / source / priority / tags (collapsed behind "more" toggle to hit the 10-second target)

On submit: single `insert` into `items`, one `insert` into `activity_log`. Modal closes. Toast shows "Added to [Project] — [Phase]" with an undo.

### 7.2 Context Resume banner
On entering a project view:
- Read `projects.last_visited_at`
- Query items where `updated_at > last_visited_at` OR `(created_at > last_visited_at AND priority in ('high','critical'))`
- Render banner listing up to 5 such items, grouped by "Last edited" / "New since last visit" / "New high-priority"
- After the banner renders, update `last_visited_at = now()` (debounced so it doesn't fire on rapid navigation)

### 7.3 Pinned items
Pinned items surface in a dedicated strip at the top of the project view, always visible regardless of which phase/module is selected. Query: `items.pinned = true AND project_id = ? AND archived = false`.

### 7.4 Module management
- Toggle `projects.modules_enabled`. Turning it on triggers:
  - Create a "General / App-wide" module with `is_general = true`
  - Move all existing phases of that project into the General module (set `phases.module_id`)
- Turning it off is non-destructive: requires all phases be re-parented to null first (UI warns the user, offers to collapse all modules into General's phases).

### 7.5 Phase management
- Completing a phase sets `status='completed'` and auto-promotes the next `status='planned'` phase (lowest `number`) to `status='active', is_current=true`.
- Bulk-move deferred items offered as a confirm dialog when completing: "3 deferred items — move to [Next Phase]?"

### 7.6 Search
- Global `Cmd/Ctrl+K` opens command palette.
- Query goes to Postgres full-text search (GIN index on `tsvector`).
- Results grouped by project, snippet-highlighted.
- Also: typing `#tag` filters to a tag across all projects (shortcut for `/tag/:tag`).

### 7.7 Activity Timeline
- Reverse-chronological feed of `activity_log` rows for a given project.
- Virtualized list (Pretext used to pre-measure each row's height given its text content — no measurement divs, no layout thrash).
- Filter by date range and activity `kind`.

### 7.8 Tags
- `text[]` on `items`. Autocomplete sources from `select distinct unnest(tags) from items where user_id = auth.uid()`.
- Click a tag chip anywhere → navigate to `/tag/:tag`, cross-project filter view.

### 7.9 Cross-project links
- `item_links` table. UI: "link to another item" in item editor, opens a project/phase/item picker.
- Badge shown on linked items; click navigates to the linked item, which may be in another project.

### 7.10 Weekly Digest
- `/digest` route. Server-side (client-side query) pulls:
  - Items with `status='done'` updated in last 7 days
  - Items created in last 7 days
  - Items in `status='in-progress'`
  - Items in `status='deferred'` (the "blocked-ish")
  - Phases with `target_date` in next 14 days
- Render as a read-only markdown-ish view, with a "Copy as Markdown" button. No export file — clipboard only.

### 7.11 Paste-and-Parse (Clipboard)
- Accessible from Quick Capture as a "Paste to parse" button.
- User pastes raw text. Client-side heuristics only:
  - Match known project names (case-insensitive) in the text → pre-select project
  - Match type keywords: "bug" / "feature" / "idea/feedback" / "decided"
  - Match priority keywords: "urgent/critical" → critical, "asap" → high
  - First line or up to 100 chars → title; remainder → description
- User confirms/adjusts before saving.

### 7.12 Archive
- Items never deleted. `archived=true` hides them from default views.
- Settings → Archive list shows archived items per project, with an "Unarchive" button.
- Search respects a toggle: "Include archived" (default off).

---

## 8. UI Design

### 8.1 Aesthetic
- Linear/Notion-inspired: high information density without visual noise.
- Dark mode default, light mode toggle (stored in localStorage).
- Subtle framer-motion transitions on modal open/close, phase collapse/expand, toast enter/exit.

### 8.2 Responsive
- **Mobile** (< 768px): single-column. Sidebar becomes a bottom sheet. FAB is bottom-right.
- **Tablet/Desktop** (≥ 768px): fixed left sidebar (module list), main content area.

### 8.3 Component inventory (shadcn/ui)
`Button, Dialog, DropdownMenu, Command (for Cmd+K palette), Input, Textarea, Select, Checkbox, Popover, Tabs, Toast, Tooltip, Badge, Card, Separator, ScrollArea, Switch`.

### 8.4 Pretext usage
- **Project card description preview** (dashboard): pre-measure "would 2 lines of the description fit?" without rendering — avoids layout thrash with 8+ cards.
- **Activity Timeline row heights**: virtualized list needs row heights upfront; Pretext gives them in arithmetic without DOM measurement.

---

## 9. PWA

- `manifest.webmanifest` with name, short_name, theme_color, icons (192, 512, maskable).
- Service worker:
  - **App shell cache**: HTML, JS, CSS, icons cached on install; `cache-first` for static assets.
  - **No data caching.** All Supabase API calls go `network-only`. If offline, UI shows "offline — reconnect to continue." (No offline write queue in v1; see non-goals.)
- Install prompt: standard `beforeinstallprompt` captured, surfaced as a "Install App" button in settings.

---

## 10. Realtime

- For the active project view, subscribe to `items`, `phases`, `modules` rows `where project_id = eq.?`.
- Dashboard subscribes to `projects` row changes and relies on periodic re-fetch (every 30s on focus) for aggregate counts to avoid complex per-project subscriptions.
- Subscriptions unsubscribe on route exit to free connections.

---

## 11. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Global search / command palette |
| `Cmd/Ctrl + Shift + N` | Quick Capture (spec said `Cmd+N` but browsers reserve it — substituted) |
| `Esc` | Close any modal |
| `Cmd/Ctrl + /` | Toggle theme |
| `g` then `d` | Go to dashboard |
| `g` then `t` | Go to timeline (within a project) |
| `g` then `s` | Go to digest |

---

## 12. File Layout

```
project-command-center/
├─ migrations/
│  ├─ 0001_init_schema.sql
│  ├─ 0002_rls_policies.sql
│  ├─ 0003_indexes.sql
│  └─ 0004_seed_projects.sql
├─ public/
│  ├─ manifest.webmanifest
│  ├─ icons/ (192, 512, maskable)
│  └─ favicon.ico
├─ src/
│  ├─ lib/
│  │   ├─ supabase.ts           (client factory)
│  │   ├─ pretext.ts            (wrapper + helpers)
│  │   └─ markdown.tsx          (react-markdown config)
│  ├─ repos/                     (one file per table)
│  │   ├─ projects.ts
│  │   ├─ modules.ts
│  │   ├─ phases.ts
│  │   ├─ items.ts
│  │   ├─ links.ts
│  │   └─ activity.ts
│  ├─ hooks/
│  │   ├─ useAuth.ts
│  │   ├─ useProject.ts
│  │   ├─ useItems.ts
│  │   ├─ useRealtime.ts
│  │   └─ useKeyboard.ts
│  ├─ components/
│  │   └─ ui/                    (shadcn generated: button.tsx, dialog.tsx, etc.)
│  ├─ features/
│  │   ├─ auth/
│  │   ├─ dashboard/
│  │   ├─ project/
│  │   │   ├─ ProjectView.tsx
│  │   │   ├─ PhaseSection.tsx
│  │   │   ├─ ItemRow.tsx
│  │   │   ├─ ItemDetailPanel.tsx
│  │   │   ├─ ContextResumeBanner.tsx
│  │   │   └─ PinnedStrip.tsx
│  │   ├─ quick-capture/
│  │   ├─ search/
│  │   ├─ timeline/
│  │   ├─ digest/
│  │   ├─ tag-view/
│  │   └─ settings/
│  ├─ routes.tsx
│  ├─ App.tsx
│  └─ main.tsx
├─ .env.local                   (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
├─ tailwind.config.ts
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
└─ README.md
```

---

## 13. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Supabase realtime connection limits with many subscriptions | Only subscribe to active project; unsubscribe on route change |
| Tags-as-array hard to constrain (no FK) | Tradeoff accepted for query simplicity; normalization possible later |
| Archived-never-delete = unbounded growth | Acceptable for a personal tool; DB will stay small for years |
| Pretext adds a dependency for a feature we don't strictly need | Optional — can be removed with ~30 min of work if it causes friction |
| Magic link auth requires SMTP setup | Supabase provides default SMTP for low volumes; fine for single user |

---

## 14. Success Criteria

- `pnpm dev` boots a working app against a Supabase project
- Can sign in via magic link
- Dashboard renders 8 seeded projects
- Can add a module to a project, add a phase, add an item via Quick Capture in < 10 seconds
- Cmd+K opens global search, searches across all items
- App installs as PWA on Chrome (desktop) and Safari (iOS)
- Dark/light mode toggle works and persists

---

*End of spec.*
