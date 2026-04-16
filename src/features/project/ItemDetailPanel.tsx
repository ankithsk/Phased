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
  Loader2
} from 'lucide-react'
import { itemsRepo } from '@/repos/items'
import { activityRepo } from '@/repos/activity'
import { linksRepo } from '@/repos/links'
import { supabase } from '@/lib/supabase'
import { Markdown } from '@/lib/markdown'
import { LinkPicker } from './LinkPicker'
import type {
  Item,
  ItemType,
  ItemPriority,
  ItemStatus
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
  fromId: string
  toId: string
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
  const [pickerOpen, setPickerOpen] = useState(false)

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
          'from_item_id,to_item_id,from_item:items!item_links_from_item_id_fkey(id,title),to_item:items!item_links_to_item_id_fkey(id,title)'
        )
        .or(`from_item_id.eq.${itemId},to_item_id.eq.${itemId}`)
      if (error) throw error
      const rows: LinkedRow[] = (data ?? []).map((row: any) => {
        const other =
          row.from_item_id === itemId ? row.to_item : row.from_item
        return {
          otherId: other?.id ?? '',
          otherTitle: other?.title ?? '(untitled)',
          fromId: row.from_item_id,
          toId: row.to_item_id
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
          if (!cancelled && phaseRow) setProjectId(phaseRow.project_id)
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

  const onUnlink = async (fromId: string, toId: string) => {
    try {
      await linksRepo.unlink(fromId, toId)
      setLinks((prev) => prev.filter((l) => !(l.fromId === fromId && l.toId === toId)))
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
            </div>

            {/* Tags */}
            <TagsField tags={item.tags} onChange={onTagsChange} />

            {/* Source */}
            <SourceField value={item.source} onCommit={onSourceCommit} />

            {/* Divider */}
            <div className="border-t border-border/70" />

            {/* Description */}
            <DescriptionField
              value={item.description}
              onCommit={onDescriptionCommit}
            />

            {/* Divider */}
            <div className="border-t border-border/70" />

            {/* Linked items */}
            <LinkedItems
              links={links}
              onUnlink={(fromId, toId) => void onUnlink(fromId, toId)}
              onAdd={() => setPickerOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Link picker */}
      {item && (
        <LinkPicker
          open={pickerOpen}
          fromItemId={item.id}
          excludeItemIds={[item.id, ...links.map((l) => l.otherId)]}
          onClose={() => setPickerOpen(false)}
          onLinked={() => {
            setPickerOpen(false)
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute left-0 top-full z-20 mt-1.5 min-w-[160px] overflow-hidden rounded-lg border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
          >
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
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-foreground/90 transition-colors hover:bg-secondary/70"
                >
                  <I className={`h-3.5 w-3.5 ${TYPE_TINT[t]}`} />
                  <span className="flex-1">{TYPE_LABEL[t]}</span>
                  {value === t && <Check className="h-3 w-3 opacity-60" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute left-0 top-full z-20 mt-1.5 min-w-[150px] overflow-hidden rounded-lg border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
          >
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onChange(p)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-foreground/90 transition-colors hover:bg-secondary/70"
              >
                <span className={`h-2 w-2 rounded-full ${PRIORITY_DOT[p]}`} />
                <span className="flex-1">{PRIORITY_LABEL[p]}</span>
                {value === p && <Check className="h-3 w-3 opacity-60" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: EASE }}
            className="absolute left-0 top-full z-20 mt-1.5 min-w-[150px] overflow-hidden rounded-lg border border-border/80 bg-popover/95 p-1 shadow-xl backdrop-blur-xl"
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onChange(s)
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-foreground/90 transition-colors hover:bg-secondary/70"
              >
                <span>{STATUS_LABEL[s]}</span>
                {value === s && <Check className="h-3 w-3 opacity-60" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
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
              key={`${l.fromId}-${l.toId}`}
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
