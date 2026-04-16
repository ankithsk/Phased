import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MoreHorizontal,
  Pencil,
  CalendarDays,
  CheckCircle2,
  Flag,
  Trash2,
  Loader2,
  AlertTriangle
} from 'lucide-react'
import { phasesRepo } from '@/repos/phases'
import { itemsRepo } from '@/repos/items'
import { activityRepo } from '@/repos/activity'
import { supabase } from '@/lib/supabase'
import type { Item, Phase } from '@/types/db'

export interface PhaseActionsMenuProps {
  phase: Phase
  projectId: string
}

type Dialog =
  | { kind: 'none' }
  | { kind: 'rename' }
  | { kind: 'date' }
  | { kind: 'complete'; deferred: Item[]; nextPhaseId: string | null }
  | { kind: 'delete' }

export function PhaseActionsMenu({ phase, projectId }: PhaseActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' })
  const [itemCount, setItemCount] = useState<number | null>(null)
  const [deleteChecking, setDeleteChecking] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    // On open, check item count for delete affordance
    setDeleteChecking(true)
    itemsRepo
      .listByPhase(phase.id, true)
      .then((items) => setItemCount(items.length))
      .catch(() => setItemCount(null))
      .finally(() => setDeleteChecking(false))
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, phase.id])

  function stop(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
  }

  async function handleSetCurrent() {
    setOpen(false)
    try {
      await phasesRepo.setCurrent(phase.id)
      await activityRepo.log(projectId, 'phase_activated', {
        phase_id: phase.id,
        name: phase.name
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function openComplete() {
    setOpen(false)
    try {
      const items = await itemsRepo.listByPhase(phase.id, false)
      const deferred = items.filter((i) => i.status === 'deferred')
      // Look up the next planned phase (same scope)
      let next: string | null = null
      if (deferred.length > 0) {
        let q = supabase
          .from('phases')
          .select('id')
          .eq('project_id', projectId)
          .eq('status', 'planned')
          .order('number', { ascending: true })
          .limit(1)
        if (phase.module_id === null) q = q.is('module_id', null)
        else q = q.eq('module_id', phase.module_id)
        const { data } = await q
        next = data && data[0] ? data[0].id : null
      }
      setDialog({ kind: 'complete', deferred, nextPhaseId: next })
    } catch (err) {
      console.error(err)
    }
  }

  async function doComplete(moveDeferred: boolean) {
    try {
      if (dialog.kind !== 'complete') return
      if (moveDeferred && dialog.nextPhaseId) {
        await Promise.all(
          dialog.deferred.map((i) => itemsRepo.moveToPhase(i.id, dialog.nextPhaseId!))
        )
      }
      await phasesRepo.complete(phase.id)
      await activityRepo.log(projectId, 'phase_completed', {
        phase_id: phase.id,
        name: phase.name
      })
      setDialog({ kind: 'none' })
    } catch (err) {
      console.error(err)
    }
  }

  async function doDelete() {
    try {
      await phasesRepo.remove(phase.id)
      setDialog({ kind: 'none' })
    } catch (err) {
      console.error(err)
    }
  }

  const canDelete = itemCount === 0

  return (
    <div
      ref={containerRef}
      className="relative"
      onClick={stop}
      onKeyDown={(e) => {
        // Prevent header button from toggling when interacting with menu
        stop(e)
      }}
    >
      <button
        type="button"
        aria-label="Phase actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-md border border-transparent text-muted-foreground/80 transition-all duration-150 hover:border-border/60 hover:bg-secondary/60 hover:text-foreground"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-1 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.7),0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl"
          >
            <MenuItem
              icon={<Pencil className="h-3.5 w-3.5" />}
              label="Rename"
              onClick={() => {
                setOpen(false)
                setDialog({ kind: 'rename' })
              }}
            />
            <MenuItem
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Set target date"
              onClick={() => {
                setOpen(false)
                setDialog({ kind: 'date' })
              }}
            />
            {!phase.is_current && phase.status !== 'completed' && (
              <MenuItem
                icon={<Flag className="h-3.5 w-3.5" />}
                label="Mark as current"
                onClick={handleSetCurrent}
              />
            )}
            {phase.status !== 'completed' && (
              <MenuItem
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Complete phase"
                onClick={openComplete}
              />
            )}
            <div className="my-1 h-px bg-border/50" />
            <MenuItem
              icon={<Trash2 className="h-3.5 w-3.5" />}
              label="Delete"
              tone="danger"
              disabled={!canDelete}
              disabledHint={
                deleteChecking
                  ? 'Checking items…'
                  : itemCount && itemCount > 0
                    ? 'Archive or move items first'
                    : undefined
              }
              onClick={() => {
                setOpen(false)
                setDialog({ kind: 'delete' })
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename */}
      {dialog.kind === 'rename' && (
        <TextPromptDialog
          title="Rename phase"
          initial={phase.name}
          placeholder="Phase name"
          submitLabel="Save"
          onCancel={() => setDialog({ kind: 'none' })}
          onSubmit={async (value) => {
            const trimmed = value.trim()
            if (!trimmed || trimmed === phase.name) {
              setDialog({ kind: 'none' })
              return
            }
            await phasesRepo.update(phase.id, { name: trimmed })
            setDialog({ kind: 'none' })
          }}
        />
      )}

      {/* Target date */}
      {dialog.kind === 'date' && (
        <DateDialog
          initial={phase.target_date}
          onCancel={() => setDialog({ kind: 'none' })}
          onClear={async () => {
            await phasesRepo.update(phase.id, { target_date: null })
            setDialog({ kind: 'none' })
          }}
          onSubmit={async (iso) => {
            await phasesRepo.update(phase.id, { target_date: iso })
            setDialog({ kind: 'none' })
          }}
        />
      )}

      {/* Complete phase */}
      {dialog.kind === 'complete' && (
        <ConfirmDialog
          title="Complete phase"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-300/90" />}
          onCancel={() => setDialog({ kind: 'none' })}
          body={
            dialog.deferred.length > 0 ? (
              <div className="space-y-2 text-[12.5px] text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">
                    {dialog.deferred.length} deferred{' '}
                    {dialog.deferred.length === 1 ? 'item' : 'items'}
                  </span>{' '}
                  still in this phase.
                </p>
                {dialog.nextPhaseId ? (
                  <p>Move them to the next planned phase or complete the phase as-is?</p>
                ) : (
                  <p>No next phase available — deferred items will stay in this phase.</p>
                )}
              </div>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">
                Mark “{phase.name}” as completed. The next planned phase (if any) will be
                activated automatically.
              </p>
            )
          }
          actions={
            dialog.deferred.length > 0 && dialog.nextPhaseId ? (
              <>
                <DialogButton variant="ghost" onClick={() => setDialog({ kind: 'none' })}>
                  Cancel
                </DialogButton>
                <DialogButton variant="secondary" onClick={() => doComplete(false)}>
                  Complete only
                </DialogButton>
                <DialogButton variant="primary" onClick={() => doComplete(true)}>
                  Complete & move
                </DialogButton>
              </>
            ) : (
              <>
                <DialogButton variant="ghost" onClick={() => setDialog({ kind: 'none' })}>
                  Cancel
                </DialogButton>
                <DialogButton variant="primary" onClick={() => doComplete(false)}>
                  Complete phase
                </DialogButton>
              </>
            )
          }
        />
      )}

      {/* Delete */}
      {dialog.kind === 'delete' && (
        <ConfirmDialog
          title="Delete phase"
          icon={<AlertTriangle className="h-4 w-4 text-red-300/90" />}
          onCancel={() => setDialog({ kind: 'none' })}
          body={
            <p className="text-[12.5px] text-muted-foreground">
              Permanently delete “{phase.name}”? This cannot be undone.
            </p>
          }
          actions={
            <>
              <DialogButton variant="ghost" onClick={() => setDialog({ kind: 'none' })}>
                Cancel
              </DialogButton>
              <DialogButton variant="danger" onClick={doDelete}>
                Delete
              </DialogButton>
            </>
          }
        />
      )}
    </div>
  )
}

// -------------------- internal primitives --------------------

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  disabledHint?: string
}

function MenuItem({ icon, label, onClick, tone = 'default', disabled, disabledHint }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
        disabled
          ? 'cursor-not-allowed text-muted-foreground/50'
          : tone === 'danger'
            ? 'text-red-200/90 hover:bg-red-500/10 hover:text-red-100'
            : 'text-foreground/90 hover:bg-secondary/60 hover:text-foreground'
      }`}
    >
      <span className="flex h-4 w-4 flex-none items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
    </button>
  )
}

interface TextPromptDialogProps {
  title: string
  initial: string
  placeholder?: string
  submitLabel?: string
  onCancel: () => void
  onSubmit: (value: string) => void | Promise<void>
}

function TextPromptDialog({
  title,
  initial,
  placeholder,
  submitLabel = 'Save',
  onCancel,
  onSubmit
}: TextPromptDialogProps) {
  const [value, setValue] = useState(initial)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 40)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <DialogShell onClose={onCancel} title={title}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setSubmitting(true)
          try {
            await onSubmit(value)
          } finally {
            setSubmitting(false)
          }
        }}
        className="flex flex-col gap-3"
      >
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10"
        />
        <div className="flex items-center justify-end gap-2">
          <DialogButton variant="ghost" type="button" onClick={onCancel}>
            Cancel
          </DialogButton>
          <DialogButton variant="primary" type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {submitLabel}
          </DialogButton>
        </div>
      </form>
    </DialogShell>
  )
}

interface DateDialogProps {
  initial: string | null
  onCancel: () => void
  onSubmit: (iso: string) => void | Promise<void>
  onClear: () => void | Promise<void>
}

function DateDialog({ initial, onCancel, onSubmit, onClear }: DateDialogProps) {
  const [value, setValue] = useState(initial ? initial.slice(0, 10) : '')
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogShell onClose={onCancel} title="Set target date">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!value) return
          setSubmitting(true)
          try {
            await onSubmit(value)
          } finally {
            setSubmitting(false)
          }
        }}
        className="flex flex-col gap-3"
      >
        <div className="relative">
          <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="date"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-border/60 bg-background/60 py-2 pl-8 pr-3 text-[12.5px] text-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-foreground/10 [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <DialogButton variant="ghost" type="button" onClick={onClear}>
            Clear date
          </DialogButton>
          <div className="flex items-center gap-2">
            <DialogButton variant="ghost" type="button" onClick={onCancel}>
              Cancel
            </DialogButton>
            <DialogButton variant="primary" type="submit" disabled={!value || submitting}>
              {submitting && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save
            </DialogButton>
          </div>
        </div>
      </form>
    </DialogShell>
  )
}

interface ConfirmDialogProps {
  title: string
  icon?: React.ReactNode
  body: React.ReactNode
  actions: React.ReactNode
  onCancel: () => void
}

function ConfirmDialog({ title, icon, body, actions, onCancel }: ConfirmDialogProps) {
  return (
    <DialogShell onClose={onCancel} title={title} icon={icon}>
      <div className="flex flex-col gap-4">
        <div>{body}</div>
        <div className="flex items-center justify-end gap-2">{actions}</div>
      </div>
    </DialogShell>
  )
}

interface DialogShellProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  onClose: () => void
}

function DialogShell({ title, icon, children, onClose }: DialogShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(e) => e.stopPropagation()}
          className="w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/70 bg-popover/95 p-5 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.75),0_1px_0_rgba(255,255,255,0.04)_inset] backdrop-blur-xl"
        >
          <div className="mb-3 flex items-center gap-2">
            {icon && (
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border/60 bg-secondary/40">
                {icon}
              </span>
            )}
            <h3 className="text-[13.5px] font-semibold text-foreground">{title}</h3>
          </div>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

interface DialogButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}

function DialogButton({
  variant,
  type = 'button',
  onClick,
  disabled,
  children
}: DialogButtonProps) {
  const base =
    'inline-flex items-center rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'
  const styles: Record<DialogButtonProps['variant'], string> = {
    primary: 'border border-foreground/20 bg-foreground/10 text-foreground hover:bg-foreground/15',
    secondary:
      'border border-border/60 bg-secondary/40 text-foreground/90 hover:bg-secondary/70',
    ghost:
      'border border-transparent text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
    danger: 'border border-red-500/30 bg-red-500/15 text-red-100 hover:bg-red-500/25'
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles[variant]}`}>
      {children}
    </button>
  )
}
