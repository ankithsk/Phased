import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Pin,
  PinOff,
  Bug,
  Sparkles,
  MessageCircle,
  FileText,
  GitBranch,
  ChevronDown,
  Check,
  Pencil,
  Plus,
  Archive,
  ArchiveRestore,
  Link2,
  Link2Off,
  AlertCircle,
  Loader2,
  CalendarClock,
  Moon,
  Target
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { activityRepo } from '@/repos/activity'
import { linksRepo } from '@/repos/links'
import { goalsRepo } from '@/repos/goals'
import { supabase } from '@/lib/supabase'
import { Markdown } from '@/lib/markdown'
import { LinkPicker } from './LinkPicker'
import type {
  Item,
  ItemType,
  ItemPriority,
  ItemStatus,
  LinkRelation,
  Goal
} from '@/types/db'

export interface ItemDetailPanelProps {
  itemId: string | null
  onClose: () => void
}

/* ------------------------------------------------------------------ */
/*  Design tokens                                                     */
/* ------------------------------------------------------------------ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const TYPE_ICON: Record<ItemType, React.ComponentType<{ className?: string }>> = {
  feature: Sparkles,
  bug: Bug,
  feedback: MessageCircle,
  note: FileText,
  decision: GitBranch
}

const TYPE_TINT: Record<ItemType, string> = {
  feature: 'text-violet-300/80',
  bug: 'text-rose-300/80',
  feedback: 'text-sky-300/80',
  note: 'text-zinc-300/80',
  decision: 'text-amber-300/80'
}

const TYPE_LABEL: Record<ItemType, string> = {
  feature: 'Feature',
  bug: 'Bug',
  feedback: 'Feedback',
  note: 'Note',
  decision: 'Decision'
}

const TYPES: ItemType[] = ['feature', 'bug', 'feedback', 'note', 'decision']

const PRIORITY_DOT: Record<ItemPriority, string> = {
  critical: 'bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]',
  high: 'bg-orange-400 shadow-[0_0_0_3px_rgba(251,146,60,0.12)]',
  medium: 'bg-zinc-400/70',
  low: 'bg-zinc-500/40'
}

const PRIORITY_LABEL: Record<ItemPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

const PRIORITIES: ItemPriority[] = ['critical', 'high', 'medium', 'low']

const STATUS_LABEL: Record<ItemStatus, string> = {
  open: 'Open',
  'in-progress': 'In progress',
  done: 'Done',
  deferred: 'Deferred'
}

const STATUS_CHIP: Record<ItemStatus, string> = {
  open: 'bg-secondary/70 text-muted-foreground border-border/60',
  'in-progress': 'bg-sky-500/10 text-sky-200/90 border-sky-500/20',
  done: 'bg-emerald-500/10 text-emerald-200/90 border-emerald-500/20',
  deferred: 'bg-zinc-500/10 text-zinc-300/80 border-zinc-500/20'
}

const STATUSES: ItemStatus[] = ['open', 'in-progress', 'done', 'deferred']

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return iso
  }
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return formatAbsolute(iso)
}

interface LinkedRow {
  otherId: string
  otherTitle: string
  /** The other item's status — used to flag open blockers. */
  otherStatus: ItemStatus | null
  fromId: string
  toId: string
  relation: LinkRelation
}

/* ------------------------------------------------------------------ */
/*  Panel                                                             */
/* ------------------------------------------------------------------ */

export function ItemDetailPanel({ itemId, onClose }: ItemDetailPanelProps) {
  // Esc-to-close
  useEffect(() => {
    if (!itemId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [itemId, onClose])

  return (
    <AnimatePresence>
      {itemId && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.18, ease: EASE }}
            role="dialog"
            aria-modal="true"
            aria-label="Item details"
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border/70 bg-card/85 shadow-[0_0_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:w-[480px]"
          >
            <PanelBody itemId={itemId} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* ------------------------------------------------------------------ */
/*  Body                                                              */
/* ------------------------------------------------------------------ */

function PanelBody({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const [item, setItem] = useState<Item | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [links, setLinks] = useState<LinkedRow[]>([])
  const [pickerMode, setPickerMode] = useState<
    null | 'links' | 'blocks' | 'blocked-by'
  >(null)
  const [goals, setGoals] = useState<Goal[]>([])

  // Celebration trigger: fires once when status transitions to 'done'.
  // Same pattern as ItemRow — ref tracks previous status so updates that
  // persist 'done' don't re-fire, and we skip the initial render as well.
  const prevStatusRef = useRef<ItemStatus | null>(null)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    const next = item?.status ?? null
    if (prevStatusRef.current && prevStatusRef.current !== 'done' && next === 'done') {
      setCelebrate(true)
      const t = window.setTimeout(() => setCelebrate(false), 1400)
      prevStatusRef.current = next
      return () => window.clearTimeout(t)
    }
    prevStatusRef.current = next
    return
  }, [item?.status])

  const flashError = useCallback((msg: string) => {
    setErrorMsg(msg)
    window.setTimeout(() => setErrorMsg((m) => (m === msg ? null : m)), 3000)
  }, [])

  const fetchItem = useCallback(async () => {
    try {
      const next = await itemsRepo.get(itemId)
      setItem(next)
    } catch (e) {
      flashError(e instanceof Error ? e.message : 'Failed to load item')
    }
  }, [itemId, flashError])

  const fetchLinks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('item_links')
        .select(
          'from_item_id,to_item_id,relation,from_item:items!item_links_from_item_id_fkey(id,title,status),to_item:items!item_links_to_item_id_fkey(id,title,status)'
        )
        .or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`)
      if (error) throw error
      const rows: LinkedRow[] = (data ?? []).map((row: any) => {
        const other =
          row.from_item_id === itemId ? row.to_item : row.from_item
        return {
          otherId: other?.id ?? '',
          otherTitle: other?.title ?? '(untitled)',
          otherStatus: (other?.status as ItemStatus | undefined) ?? null,
          fromId: row.from_item_id,
          toId: row.to_item_id,
          relation: (row.relation as LinkRelation) ?? 'links'
        }
      })
      setLinks(rows)
    } catch (e) {
      flashError(e instanceof Error ? e.message : 'Failed to load links')
    }
  }, [itemId, flashError])

  // Initial load
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setItem(null)
    setProjectId(null)
    setLinks([])
    ;(async () => {
      try {
        const loaded = await itemsRepo.get(itemId)
        if (cancelled) return
        setItem(loaded)
        if (loaded) {
          const { data: phaseRow } = await supabase
            .from('phases')
            .select('project_id')
            .eq('id', loaded.phase_id)
            .single()
          if (!cancelled && phaseRow) {
            setProjectId(phaseRow.project_id)
            // Load this project's goals so the goal picker can show them.
            try {
              const gs = await goalsRepo.listByProject(phaseRow.project_id)
              if (!cancelled) setGoals(gs)
            } catch {
              /* goals are optional — ignore failures */
            }
          }
        }
        await fetchLinks()
      } catch (e) {
        if (!cancelled) {
          flashError(e instanceof Error ? e.message : 'Failed to load item')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemId, fetchLinks, flashError])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`item:${itemId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items', filter: `id=eq.${itemId}` },
        () => {
          void fetchItem()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_links' },
        () => {
          void fetchLinks()
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [itemId, fetchItem, fetchLinks])

  /* ------------------ Mutations ------------------ */

  const logActivity = useCallback(
    async (
      kind: Parameters<typeof activityRepo.log>[1],
      payload: Record<string, unknown> = {}
    ) => {
      if (!projectId) return
      try {
        await activityRepo.log(projectId, kind, payload, itemId)
      } catch {
        /* swallow — activity is non-critical */
      }
    },
    [projectId, itemId]
  )

  const applyPatch = useCallback(
    async (patch: Partial<Item>, optimistic = true) => {
      if (!item) return null
      const prev = item
      if (optimistic) setItem({ ...prev, ...patch })
      try {
        const next = await itemsRepo.update(item.id, patch)
        setItem(next)
        return { prev, next }
      } catch (e) {
        setItem(prev)
        flashError(e instanceof Error ? e.message : 'Save failed')
        return null
      }
    },
    [item, flashError]
  )

  const onTitleCommit = async (next: string) => {
    if (!item) return
    const trimmed = next.trim()
    if (!trimmed || trimmed === item.title) return
    const old = item.title
    const res = await applyPatch({ title: trimmed })
    if (res) void logActivity('item_updated', { field: 'title', old, new: trimmed })
  }

  const onSourceCommit = async (next: string) => {
    if (!item) return
    const trimmed = next.trim()
    const nextVal = trimmed.length === 0 ? null : trimmed
    if (nextVal === item.source) return
    const old = item.source
    const res = await applyPatch({ source: nextVal })
    if (res) void logActivity('item_updated', { field: 'source', old, new: nextVal })
  }

  const onRevisitCommit = async (next: string | null) => {
    if (!item) return
    if (next === item.revisit_at) return
    const old = item.revisit_at
    const res = await applyPatch({ revisit_at: next })
    if (res) void logActivity('item_updated', { field: 'revisit_at', old, new: next })
  }

  const onSnoozeCommit = async (next: string | null) => {
    if (!item) return
    if (next === item.snoozed_until) return
    const old = item.snoozed_until
    const res = await applyPatch({ snoozed_until: next })
    if (res) void logActivity('item_updated', { field: 'snoozed_until', old, new: next })
  }

  const onGoalChange = async (nextGoalId: string | null) => {
    if (!item) return
    if (nextGoalId === item.goal_id) return
    const old = item.goal_id
    const res = await applyPatch({ goal_id: nextGoalId })
    if (res) void logActivity('item_updated', { field: 'goal_id', old, new: nextGoalId })
  }

  const onDescriptionCommit = async (next: string) => {
    if (!item) return
    const nextVal = next.length === 0 ? null : next
    if (nextVal === item.description) return
    const res = await applyPatch({ description: nextVal })
    if (res) void logActivity('item_updated', { field: 'description' })
  }

  const onTypeChange = async (next: ItemType) => {
    if (!item || next === item.type) return
    const old = item.type
    const res = await applyPatch({ type: next })
    if (res) void logActivity('item_updated', { field: 'type', old, new: next })
  }

  const onPriorityChange = async (next: ItemPriority) => {
    if (!item || next === item.priority) return
    const old = item.priority
    const res = await applyPatch({ priority: next })
    if (res) void logActivity('item_updated', { field: 'priority', old, new: next })
  }

  const onStatusChange = async (next: ItemStatus) => {
    if (!item || next === item.status) return
    const from = item.status
    const res = await applyPatch({ status: next })
    if (res) void logActivity('status_changed', { from, to: next })
  }

  const onTogglePin = async () => {
    if (!item) return
    const next = !item.pinned
    await applyPatch({ pinned: next })
  }

  const onTagsChange = async (tags: string[]) => {
    if (!item) return
    const res = await applyPatch({ tags })
    if (res) void logActivity('item_updated', { field: 'tags' })
  }

  const onToggleArchive = async () => {
    if (!item) return
    const willArchive = !item.archived
    const res = await applyPatch({ archived: willArchive })
    if (res) {
      void logActivity(willArchive ? 'item_archived' : 'item_unarchived')
    }
  }

  const onUnlink = async (
    fromId: string,
    toId: string,
    relation: LinkRelation
  ) => {
    try {
      await linksRepo.unlink(fromId, toId, relation)
      setLinks((prev) =>
        prev.filter(
          (l) =>
            !(l.fromId === fromId && l.toId === toId && l.relation === relation)
        )
      )
    } catch (e) {
      flashError(e instanceof Error ? e.message : 'Unlink failed')
    }
  }

  /* ------------------ Render ------------------ */

  return (
    <>
      {/* Top bar */}
      <div className="flex flex-none items-center justify-between border-b border-border/70 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors duration-150 hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {item && (
            <button
              type="button"
              onClick={() => void onTogglePin()}
              aria-label={item.pinned ? 'Unpin' : 'Pin'}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors duration-150 ${
                item.pinned
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-secondary/60 hover:text-foreground'
              }`}
            >
              {item.pinned ? (
                <Pin className="h-4 w-4 fill-current" />
              ) : (
                <PinOff className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Celebration glow layer — fires on status → done. Positioned at the
          root so it overlays the whole panel (not just one section). */}
      <AnimatePresence>
        {celebrate && (
          <motion.div
            aria-hidden
            key="panel-celebrate"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0 z-40"
            style={{
              background:
                'radial-gradient(80% 60% at 50% 35%, rgba(52,211,153,0.16) 0%, transparent 70%)',
              boxShadow: 'inset 0 0 0 1px rgba(52,211,153,0.3)'
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {celebrate && (
          <motion.div
            aria-hidden
            key="panel-celebrate-ring"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: [0.9, 1.2, 1.5], opacity: [0.6, 0.3, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute left-1/2 top-[20%] z-40 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              boxShadow: '0 0 0 2px rgba(52,211,153,0.45)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !item ? (
          <LoadingState />
        ) : !item ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-6 px-5 py-6">
            {/* Title */}
            <TitleField value={item.title} onCommit={onTitleCommit} />

            {/* Meta pills */}
            <div className="flex flex-wrap items-center gap-2">
              <TypePill value={item.type} onChange={onTypeChange} />
              <PriorityPill value={item.priority} onChange={onPriorityChange} />
              <StatusPill value={item.status} onChange={onStatusChange} />
              <GoalPill
                value={item.goal_id}
                goals={goals}
                onChange={onGoalChange}
              />
            </div>

            {/* Tags */}
            <TagsField tags={item.tags} onChange={onTagsChange} />

            {/* Source */}
            <SourceField value={item.source} onCommit={onSourceCommit} />

            {/* Revisit on */}
            <RevisitField value={item.revisit_at} onCommit={onRevisitCommit} />

            {/* Snooze until */}
            <SnoozeField value={item.snoozed_until} onCommit={onSnoozeCommit} />

            {/* Divider */}
            <div className="border-t border-border/70" />

            {/* Description */}
            <DescriptionField
              value={item.description}
              onCommit={onDescriptionCommit}
            />

            {/* Divider */}
            <div className="border-t border-border/70" />

            {/* Blocked by (this item needs these to be done first) */}
            <BlockedBySection
              rows={links.filter(
                (l) => l.relation === 'blocks' && l.toId === item.id
              )}
              onUnlink={(fromId, toId) => void onUnlink(fromId, toId, 'blocks')}
              onAdd={() => setPickerMode('blocked-by')}
            />

            {/* Blocks (this item is blocking these) */}
            <BlocksSection
              rows={links.filter(
                (l) => l.relation === 'blocks' && l.fromId === item.id
              )}
              onUnlink={(fromId, toId) => void onUnlink(fromId, toId, 'blocks')}
              onAdd={() => setPickerMode('blocks')}
            />

            {/* Linked items (generic) */}
            <LinkedItems
              links={links.filter((l) => l.relation === 'links')}
              onUnlink={(fromId, toId) => void onUnlink(fromId, toId, 'links')}
              onAdd={() => setPickerMode('links')}
            />
          </div>
        )}
      </div>

      {/* Link picker (reused for all three relation flows) */}
      {item && pickerMode && (
        <LinkPicker
          open={pickerMode !== null}
          fromItemId={item.id}
          relation={pickerMode}
          excludeItemIds={[item.id, ...links.map((l) => l.otherId)]}
          onClose={() => setPickerMode(null)}
          onLinked={() => {
            setPickerMode(null)
            void fetchLinks()
          }}
        />
      )}

      {/* Footer */}
      {item && (
        <div className="flex flex-none items-center justify-between border-t border-border/70 bg-card/60 px-5 py-3 text-[11px] text-muted-foreground">
          <button
            type="button"
            onClick={() => void onToggleArchive()}
            className="flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-[11.5px] transition-colors duration-150 hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
          >
            {item.archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" />
                Unarchive
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" />
                Archive
              </>
            )}
          </button>
          <div className="flex flex-col items-end gap-0.5 tabular-nums">
            <span>Created {formatAbsolute(item.created_at)}</span>
            <span>Updated {formatRelative(item.updated_at)}</span>
          </div>
        </div>
      )}

      {/* Error toast */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            key="err"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.16, ease: EASE }}
            className="pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 px-4"
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200 shadow-lg backdrop-blur-lg">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorMsg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading / Empty                                                   */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex h-full items-center justify-center py-24">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-24 text-center text-[13px] text-muted-foreground">
      Item not found.
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Title                                                             */
/* ------------------------------------------------------------------ */

function TitleField({
  value,
  onCommit
}: {
  value: string
  onCommit: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    onCommit(draft)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          else if (e.key === 'Escape') cancel()
        }}
        className="w-full rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-[22px] font-semibold tracking-tight text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group -mx-1 rounded-lg px-1 py-0.5 text-left transition-colors duration-150 hover:bg-secondary/40"
    >
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-foreground">
        {value}
      </h1>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Pills                                                             */
/* ------------------------------------------------------------------ */

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  return { open, setOpen, ref }
}

/**
 * Responsive dropdown shell for the meta pills (Type / Priority / Status /
 * Goal). On desktop it anchors under the trigger like a classic dropdown.
 * On mobile (< sm) it becomes a bottom sheet with a backdrop + drag handle so
 * fat-finger taps land on real targets instead of a 220px floating chip.
 *
 * Kept DOM-descendant of the trigger's ref wrapper so the shared
 * `useDropdown` click-outside logic still closes it correctly when tapping
 * *away* from both the trigger and the menu.
 */
function PillMenu({
  open,
  onClose,
  minWidthClass = 'sm:min-w-[160px]',
  maxWidthClass = '',
  children
}: {
  open: boolean
  onClose: () => void
  minWidthClass?: string
  maxWidthClass?: string
  children: React.ReactNode
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Mobile-only backdrop — hidden on sm+. */}
          <motion.div
            key="pm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-[2px] sm:hidden"
            aria-hidden
          />
          <motion.div
            key="pm-menu"
            role="menu"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: EASE }}
            className={`fixed inset-x-0 bottom-0 z-[60] max-h-[60vh] overflow-y-auto rounded-t-2xl border-t border-border/80 bg-popover/95 p-2 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:z-20 sm:mt-1.5 sm:max-h-none sm:w-auto sm:rounded-lg sm:border sm:p-1 sm:pb-1 sm:shadow-xl ${minWidthClass} ${maxWidthClass}`}
          >
            {/* Mobile drag-handle affordance */}
            <div
              aria-hidden
              className="mx-auto mb-2 h-1 w-10 rounded-full bg-border/70 sm:hidden"
            />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/** Shared class for menu option buttons — bigger hit area on mobile. */
const PILL_OPTION_CLS =
  'flex w-full items-center gap-2 rounded-md px-2.5 py-3 text-left text-[13px] text-foreground/90 transition-colors hover:bg-secondary/70 active:bg-secondary sm:py-1.5 sm:text-[12px]'

function TypePill({
  value,
  onChange
}: {
  value: ItemType
  onChange: (next: ItemType) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  const Icon = TYPE_ICON[value]
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 transition-colors duration-150 hover:border-border hover:bg-secondary/70"
      >
        <Icon className={`h-3.5 w-3.5 ${TYPE_TINT[value]}`} />
        {TYPE_LABEL[value]}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <PillMenu open={open} onClose={() => setOpen(false)} minWidthClass="sm:min-w-[160px]">
        {TYPES.map((t) => {
          const I = TYPE_ICON[t]
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setOpen(false)
                onChange(t)
              }}
              className={PILL_OPTION_CLS}
            >
              <I className={`h-4 w-4 sm:h-3.5 sm:w-3.5 ${TYPE_TINT[t]}`} />
              <span className="flex-1">{TYPE_LABEL[t]}</span>
              {value === t && <Check className="h-3.5 w-3.5 opacity-60 sm:h-3 sm:w-3" />}
            </button>
          )
        })}
      </PillMenu>
    </div>
  )
}

function PriorityPill({
  value,
  onChange
}: {
  value: ItemPriority
  onChange: (next: ItemPriority) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 transition-colors duration-150 hover:border-border hover:bg-secondary/70"
      >
        <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[value]}`} />
        {PRIORITY_LABEL[value]}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <PillMenu open={open} onClose={() => setOpen(false)} minWidthClass="sm:min-w-[150px]">
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setOpen(false)
              onChange(p)
            }}
            className={PILL_OPTION_CLS}
          >
            <span className={`h-2.5 w-2.5 rounded-full sm:h-2 sm:w-2 ${PRIORITY_DOT[p]}`} />
            <span className="flex-1">{PRIORITY_LABEL[p]}</span>
            {value === p && <Check className="h-3.5 w-3.5 opacity-60 sm:h-3 sm:w-3" />}
          </button>
        ))}
      </PillMenu>
    </div>
  )
}

function StatusPill({
  value,
  onChange
}: {
  value: ItemStatus
  onChange: (next: ItemStatus) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150 ${STATUS_CHIP[value]}`}
      >
        {STATUS_LABEL[value]}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <PillMenu open={open} onClose={() => setOpen(false)} minWidthClass="sm:min-w-[150px]">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setOpen(false)
              onChange(s)
            }}
            className={`${PILL_OPTION_CLS} justify-between`}
          >
            <span>{STATUS_LABEL[s]}</span>
            {value === s && <Check className="h-3.5 w-3.5 opacity-60 sm:h-3 sm:w-3" />}
          </button>
        ))}
      </PillMenu>
    </div>
  )
}

function GoalPill({
  value,
  goals,
  onChange
}: {
  value: string | null
  goals: Goal[]
  onChange: (next: string | null) => void
}) {
  const { open, setOpen, ref } = useDropdown()
  // Only offer active goals as targets; but if the item's current goal is
  // achieved/dropped, keep it in the list so it stays changeable.
  const active = goals.filter((g) => g.status === 'active')
  const current = goals.find((g) => g.id === value) ?? null
  const options = current && current.status !== 'active' ? [current, ...active] : active
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 px-2.5 py-1 text-[11.5px] font-medium text-foreground/90 transition-colors duration-150 hover:border-border hover:bg-secondary/70"
      >
        <Target
          className={`h-3.5 w-3.5 ${current ? 'text-amber-300/80' : 'text-muted-foreground/70'}`}
        />
        <span className="max-w-[160px] truncate">
          {current ? current.name : 'No goal'}
        </span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <PillMenu
        open={open}
        onClose={() => setOpen(false)}
        minWidthClass="sm:min-w-[220px]"
        maxWidthClass="sm:max-w-[320px]"
      >
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onChange(null)
          }}
          className={`${PILL_OPTION_CLS} text-foreground/80`}
        >
          <Target className="h-4 w-4 text-muted-foreground/70 sm:h-3.5 sm:w-3.5" />
          <span className="flex-1">No goal</span>
          {value === null && <Check className="h-3.5 w-3.5 opacity-60 sm:h-3 sm:w-3" />}
        </button>
        {options.length === 0 ? (
          <div className="px-3 py-3 text-[12.5px] text-muted-foreground/60 sm:py-2 sm:text-[12px]">
            No goals defined yet for this project.
          </div>
        ) : (
          options.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setOpen(false)
                onChange(g.id)
              }}
              className={PILL_OPTION_CLS}
            >
              <Target className="h-4 w-4 text-amber-300/80 sm:h-3.5 sm:w-3.5" />
              <span className="flex-1 truncate">{g.name}</span>
              {g.status !== 'active' && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {g.status}
                </span>
              )}
              {value === g.id && <Check className="h-3.5 w-3.5 opacity-60 sm:h-3 sm:w-3" />}
            </button>
          ))
        )}
      </PillMenu>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Tags                                                              */
/* ------------------------------------------------------------------ */

function TagsField({
  tags,
  onChange
}: {
  tags: string[]
  onChange: (next: string[]) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding) inputRef.current?.focus()
  }, [adding])

  const normalized = useMemo(() => new Set(tags.map((t) => t.toLowerCase())), [tags])

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim()
    if (!t || normalized.has(t.toLowerCase())) {
      setDraft('')
      return
    }
    onChange([...tags, t])
    setDraft('')
  }

  const removeTag = (t: string) => {
    onChange(tags.filter((x) => x !== t))
  }

  return (
    <div>
      <SectionLabel>Tags</SectionLabel>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="group/tag flex items-center gap-1 rounded-md border border-border/60 bg-secondary/40 py-0.5 pl-2 pr-1 text-[11px] text-foreground/90"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTag(t)}
              aria-label={`Remove tag ${t}`}
              className="flex h-3.5 w-3.5 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {adding ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              const v = e.target.value
              if (v.includes(',')) {
                addTag(v)
              } else {
                setDraft(v)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(draft)
              } else if (e.key === 'Escape') {
                setDraft('')
                setAdding(false)
              }
            }}
            onBlur={() => {
              if (draft.trim()) addTag(draft)
              setAdding(false)
            }}
            placeholder="tag…"
            className="min-w-[80px] rounded-md border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/70"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-[22px] items-center gap-0.5 rounded-md border border-dashed border-border/60 px-1.5 text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-secondary/40 hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Source                                                            */
/* ------------------------------------------------------------------ */

function SourceField({
  value,
  onCommit
}: {
  value: string | null
  onCommit: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(value ?? ''), [value])
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    onCommit(draft)
  }
  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  return (
    <div>
      <SectionLabel>Source</SectionLabel>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            else if (e.key === 'Escape') cancel()
          }}
          placeholder="e.g. pricing team"
          className="mt-2 w-full rounded-md border border-border/70 bg-secondary/30 px-2.5 py-1.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 block w-full rounded-md border border-transparent px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-150 hover:border-border/60 hover:bg-secondary/30"
        >
          {value ? (
            <span className="text-foreground/90">{value}</span>
          ) : (
            <span className="text-muted-foreground/70">e.g. pricing team</span>
          )}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Description                                                       */
/* ------------------------------------------------------------------ */

function DescriptionField({
  value,
  onCommit
}: {
  value: string | null
  onCommit: (next: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => setDraft(value ?? ''), [value])
  useEffect(() => {
    if (editing) taRef.current?.focus()
  }, [editing])

  const save = () => {
    onCommit(draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <SectionLabel>Description</SectionLabel>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex h-6 items-center gap-1 rounded-md border border-transparent px-1.5 text-[11px] text-muted-foreground transition-colors duration-150 hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            placeholder="Add a description…"
            className="w-full resize-y rounded-lg border border-border/70 bg-secondary/30 px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-transparent px-2.5 py-1 text-[11.5px] text-muted-foreground transition-colors duration-150 hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md border border-border/80 bg-foreground px-2.5 py-1 text-[11.5px] font-medium text-background transition-colors duration-150 hover:bg-foreground/90"
            >
              Save
            </button>
          </div>
        </div>
      ) : value && value.length > 0 ? (
        <div className="mt-2 rounded-lg border border-transparent px-1 py-0.5">
          <Markdown source={value} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 block w-full rounded-lg border border-dashed border-border/60 px-3 py-4 text-left text-[12.5px] text-muted-foreground/70 transition-colors duration-150 hover:border-border hover:bg-secondary/30 hover:text-muted-foreground"
        >
          Add a description…
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Linked items                                                      */
/* ------------------------------------------------------------------ */

function LinkedItems({
  links,
  onUnlink,
  onAdd
}: {
  links: LinkedRow[]
  onUnlink: (fromId: string, toId: string) => void
  onAdd: () => void
}) {
  return (
    <div>
      <SectionLabel>Linked items</SectionLabel>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {links.length === 0 ? (
          <span className="text-[12px] text-muted-foreground/60">
            No linked items yet.
          </span>
        ) : (
          links.map((l) => (
            <span
              key={`${l.fromId}-${l.toId}-${l.relation}`}
              className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 py-1 pl-2 pr-1 text-[11.5px] text-foreground/90"
            >
              <Link2 className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-[220px] truncate">{l.otherTitle}</span>
              <button
                type="button"
                onClick={() => onUnlink(l.fromId, l.toId)}
                aria-label={`Unlink ${l.otherTitle}`}
                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
              >
                <Link2Off className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1 text-[11.5px] text-muted-foreground transition-colors duration-150 hover:border-border hover:bg-secondary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Link to another item
        </button>
      </div>
    </div>
  )
}

function BlockedBySection({
  rows,
  onUnlink,
  onAdd
}: {
  rows: LinkedRow[]
  onUnlink: (fromId: string, toId: string) => void
  onAdd: () => void
}) {
  const openBlockers = rows.filter((r) => r.otherStatus && r.otherStatus !== 'done')
  const hasOpen = openBlockers.length > 0
  return (
    <div>
      <div className="flex items-center gap-2">
        <SectionLabel>Blocked by</SectionLabel>
        {hasOpen && (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-200/90">
            <AlertCircle className="h-2.5 w-2.5" />
            {openBlockers.length} open
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {rows.length === 0 ? (
          <span className="text-[12px] text-muted-foreground/60">
            Not blocked by anything.
          </span>
        ) : (
          rows.map((l) => {
            const isOpen = l.otherStatus && l.otherStatus !== 'done'
            return (
              <span
                key={`${l.fromId}-${l.toId}-${l.relation}`}
                className={`group flex items-center gap-1.5 rounded-md border py-1 pl-2 pr-1 text-[11.5px] ${
                  isOpen
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-100/95'
                    : 'border-border/60 bg-secondary/40 text-foreground/80'
                }`}
              >
                <AlertCircle
                  className={`h-3 w-3 ${
                    isOpen ? 'text-amber-300/90' : 'text-muted-foreground/70'
                  }`}
                />
                <span className="max-w-[220px] truncate">{l.otherTitle}</span>
                <button
                  type="button"
                  onClick={() => onUnlink(l.fromId, l.toId)}
                  aria-label={`Remove blocker ${l.otherTitle}`}
                  className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )
          })
        )}
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1 text-[11.5px] text-muted-foreground transition-colors duration-150 hover:border-border hover:bg-secondary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add blocker
        </button>
      </div>
    </div>
  )
}

function BlocksSection({
  rows,
  onUnlink,
  onAdd
}: {
  rows: LinkedRow[]
  onUnlink: (fromId: string, toId: string) => void
  onAdd: () => void
}) {
  return (
    <div>
      <SectionLabel>Blocks</SectionLabel>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {rows.length === 0 ? (
          <span className="text-[12px] text-muted-foreground/60">
            Not blocking anything else.
          </span>
        ) : (
          rows.map((l) => (
            <span
              key={`${l.fromId}-${l.toId}-${l.relation}`}
              className="group flex items-center gap-1.5 rounded-md border border-border/60 bg-secondary/40 py-1 pl-2 pr-1 text-[11.5px] text-foreground/85"
            >
              <Link2 className="h-3 w-3 rotate-90 text-muted-foreground" />
              <span className="max-w-[220px] truncate">{l.otherTitle}</span>
              <button
                type="button"
                onClick={() => onUnlink(l.fromId, l.toId)}
                aria-label={`Stop blocking ${l.otherTitle}`}
                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/70 transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))
        )}
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 rounded-md border border-dashed border-border/60 px-2 py-1 text-[11.5px] text-muted-foreground transition-colors duration-150 hover:border-border hover:bg-secondary/40 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Mark as blocking another item
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Revisit on                                                        */
/* ------------------------------------------------------------------ */

function formatRevisitLabel(iso: string): { text: string; overdue: boolean; tint: string } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000)
  const abs = Math.abs(diffDays)
  if (diffDays < 0) {
    return {
      text: abs === 1 ? 'Overdue by 1 day' : `Overdue by ${abs} days`,
      overdue: true,
      tint: 'text-rose-300/90'
    }
  }
  if (diffDays === 0) return { text: 'Revisit today', overdue: false, tint: 'text-amber-300/90' }
  if (diffDays === 1) return { text: 'Revisit tomorrow', overdue: false, tint: 'text-amber-200/90' }
  if (diffDays < 7) return { text: `Revisit in ${diffDays} days`, overdue: false, tint: 'text-foreground/80' }
  return {
    text: `Revisit on ${target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    overdue: false,
    tint: 'text-muted-foreground'
  }
}

function RevisitField({
  value,
  onCommit
}: {
  value: string | null
  onCommit: (next: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(value ?? ''), [value])
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    onCommit(trimmed.length === 0 ? null : trimmed)
  }
  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }
  const clearDate = () => {
    setDraft('')
    setEditing(false)
    onCommit(null)
  }

  const label = value ? formatRevisitLabel(value) : null

  return (
    <div>
      <SectionLabel>Revisit on</SectionLabel>
      {editing ? (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="relative flex-1">
            <CalendarClock className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
            <input
              ref={inputRef}
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                else if (e.key === 'Escape') cancel()
              }}
              className="w-full rounded-md border border-border/70 bg-secondary/30 py-1.5 pl-8 pr-2.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50 [color-scheme:dark]"
            />
          </div>
          <button
            type="button"
            onClick={commit}
            className="rounded-md border border-border/80 bg-foreground px-2.5 py-1.5 text-[11.5px] font-medium text-background transition-colors duration-150 hover:bg-foreground/90"
          >
            Save
          </button>
          {value && (
            <button
              type="button"
              onClick={clearDate}
              className="rounded-md border border-transparent px-2 py-1.5 text-[11.5px] text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-150 hover:border-border/60 hover:bg-secondary/30"
        >
          <CalendarClock
            className={`h-3.5 w-3.5 ${label?.tint ?? 'text-muted-foreground/70'}`}
          />
          {label ? (
            <span className={label.tint}>{label.text}</span>
          ) : (
            <span className="text-muted-foreground/70">
              No revisit date — click to set.
            </span>
          )}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Snooze                                                            */
/* ------------------------------------------------------------------ */

function formatSnoozeLabel(iso: string): { text: string; active: boolean } {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  const diffDays = Math.round((target.getTime() - now.getTime()) / 86400000)
  if (diffDays <= 0) {
    return {
      text: `Snooze ended ${Math.abs(diffDays) === 0 ? 'today' : `${Math.abs(diffDays)}d ago`}`,
      active: false
    }
  }
  if (diffDays === 1) return { text: 'Snoozed until tomorrow', active: true }
  if (diffDays < 7) return { text: `Snoozed for ${diffDays} days`, active: true }
  return {
    text: `Snoozed until ${target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
    active: true
  }
}

function snoozePreset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function SnoozeField({
  value,
  onCommit
}: {
  value: string | null
  onCommit: (next: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(value ?? ''), [value])
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmed = draft.trim()
    onCommit(trimmed.length === 0 ? null : trimmed)
  }
  const cancel = () => {
    setDraft(value ?? '')
    setEditing(false)
  }
  const snooze = (iso: string) => {
    setDraft(iso)
    setEditing(false)
    onCommit(iso)
  }

  const label = value ? formatSnoozeLabel(value) : null

  return (
    <div>
      <SectionLabel>Snooze</SectionLabel>
      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Moon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
              <input
                ref={inputRef}
                type="date"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  else if (e.key === 'Escape') cancel()
                }}
                className="w-full rounded-md border border-border/70 bg-secondary/30 py-1.5 pl-8 pr-2.5 text-[12.5px] text-foreground outline-none transition-colors focus:border-border focus:bg-secondary/50 [color-scheme:dark]"
              />
            </div>
            <button
              type="button"
              onClick={commit}
              className="rounded-md border border-border/80 bg-foreground px-2.5 py-1.5 text-[11.5px] font-medium text-background transition-colors duration-150 hover:bg-foreground/90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-transparent px-2 py-1.5 text-[11.5px] text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10.5px] text-muted-foreground/70 mr-1">Quick:</span>
            <SnoozePresetButton label="Tomorrow" onClick={() => snooze(snoozePreset(1))} />
            <SnoozePresetButton label="3 days" onClick={() => snooze(snoozePreset(3))} />
            <SnoozePresetButton label="1 week" onClick={() => snooze(snoozePreset(7))} />
            <SnoozePresetButton label="2 weeks" onClick={() => snooze(snoozePreset(14))} />
            <SnoozePresetButton label="1 month" onClick={() => snooze(snoozePreset(30))} />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex flex-1 items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-left text-[12.5px] transition-colors duration-150 hover:border-border/60 hover:bg-secondary/30"
          >
            <Moon
              className={`h-3.5 w-3.5 ${
                label?.active
                  ? 'text-sky-300/90'
                  : 'text-muted-foreground/70'
              }`}
            />
            {label ? (
              <span className={label.active ? 'text-sky-300/90' : 'text-muted-foreground'}>
                {label.text}
              </span>
            ) : (
              <span className="text-muted-foreground/70">
                Not snoozed — click to hide until a date.
              </span>
            )}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                setDraft('')
                onCommit(null)
              }}
              className="rounded-md border border-transparent px-2 py-1.5 text-[11.5px] text-muted-foreground transition-colors hover:border-border/70 hover:bg-secondary/60 hover:text-foreground"
              title="Unsnooze"
            >
              Unsnooze
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SnoozePresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border/60 bg-secondary/40 px-2 py-0.5 text-[11px] text-foreground/80 transition-colors hover:border-border hover:bg-secondary/70 hover:text-foreground"
    >
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Small atoms                                                       */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
      {children}
    </div>
  )
}
