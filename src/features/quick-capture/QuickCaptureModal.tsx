import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bug,
  ChevronDown,
  ClipboardPaste,
  Command as CommandIcon,
  FileText,
  GitBranch,
  MessageCircle,
  Sparkles,
  X,
  Check,
  AlertCircle,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { projectsRepo } from '@/repos/projects'
import { modulesRepo } from '@/repos/modules'
import { phasesRepo } from '@/repos/phases'
import { itemsRepo } from '@/repos/items'
import { activityRepo } from '@/repos/activity'
import { supabase } from '@/lib/supabase'
import type {
  ItemPriority,
  ItemType,
  Module,
  Phase,
  Project,
} from '@/types/db'
import { PasteParseMode, type ParseSuggestion } from './PasteParseMode'

export interface QuickCaptureModalProps {
  open: boolean
  onClose: () => void
  initialProjectId?: string
  initialPhaseId?: string
  initialType?: ItemType
}

// ——— Constants ————————————————————————————————————————————————
const LAST_PROJECT_KEY = 'pcc.lastProject'

const TYPES: ReadonlyArray<{
  value: ItemType
  label: string
  Icon: typeof Sparkles
}> = [
  { value: 'feature', label: 'Feature', Icon: Sparkles },
  { value: 'bug', label: 'Bug', Icon: Bug },
  { value: 'feedback', label: 'Feedback', Icon: MessageCircle },
  { value: 'note', label: 'Note', Icon: FileText },
  { value: 'decision', label: 'Decision', Icon: GitBranch },
]

const PRIORITIES: ReadonlyArray<{ value: ItemPriority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const FALLBACK_ACCENT = '#8892a6'

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function hexToRgba(hex: string | null | undefined, alpha: number): string {
  const h = (hex ?? FALLBACK_ACCENT).replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h.padEnd(6, '0').slice(0, 6)
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ——— Component ————————————————————————————————————————————————
export function QuickCaptureModal(props: QuickCaptureModalProps) {
  const { open, onClose, initialProjectId, initialPhaseId, initialType } = props

  // Data
  const [projects, setProjects] = useState<Project[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)

  // Selection
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)

  // Form
  const [type, setType] = useState<ItemType>('note')
  const [title, setTitle] = useState('')
  const [titleError, setTitleError] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(true)
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('')
  const [priority, setPriority] = useState<ItemPriority>('medium')
  const [tagsInput, setTagsInput] = useState('')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Mode
  const [mode, setMode] = useState<'form' | 'paste'>('form')

  // UI
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [moduleMenuOpen, setModuleMenuOpen] = useState(false)
  const [phaseMenuOpen, setPhaseMenuOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // ——— Load projects when opening ——————————————————————————————
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingProjects(true)
    projectsRepo
      .list()
      .then((list) => {
        if (cancelled) return
        setProjects(list)
        // Pick initial project
        const stored =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(LAST_PROJECT_KEY)
            : null
        const pick =
          (initialProjectId && list.find((p) => p.id === initialProjectId)?.id) ||
          (stored && list.find((p) => p.id === stored)?.id) ||
          list[0]?.id ||
          null
        setSelectedProjectId(pick)
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, initialProjectId])

  // ——— Load modules + phases when project changes ———————————————
  useEffect(() => {
    if (!open || !selectedProjectId) {
      setModules([])
      setPhases([])
      setSelectedModuleId(null)
      setSelectedPhaseId(null)
      return
    }
    let cancelled = false
    const project = projects.find((p) => p.id === selectedProjectId)
    const loadModules = project?.modules_enabled
      ? modulesRepo.listByProject(selectedProjectId)
      : Promise.resolve<Module[]>([])
    Promise.all([loadModules, phasesRepo.listByProject(selectedProjectId)])
      .then(([mods, phs]) => {
        if (cancelled) return
        const activeMods = mods.filter((m) => !m.archived)
        setModules(activeMods)
        setPhases(phs)

        if (project?.modules_enabled) {
          const defaultMod =
            activeMods.find((m) => m.is_general) || activeMods[0] || null
          setSelectedModuleId(defaultMod?.id ?? null)
        } else {
          setSelectedModuleId(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModules([])
          setPhases([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [open, selectedProjectId, projects])

  // ——— Realtime: keep dropdowns + captured rows fresh —————————
  // Subscribes while the modal is open so additions made in this modal (or in
  // another tab) refresh the project / module / phase pickers without a
  // reopen, and so the active project's modules + phases stay in sync if a
  // phase is added or renamed elsewhere.
  useEffect(() => {
    if (!open) return
    const refreshProjects = () => {
      projectsRepo
        .list()
        .then((rows) => setProjects(rows))
        .catch(() => {
          /* transient — leave existing list alone */
        })
    }
    const refreshModules = () => {
      if (!selectedProjectId) return
      modulesRepo
        .listByProject(selectedProjectId)
        .then((rows) => setModules(rows.filter((m) => !m.archived)))
        .catch(() => {
          /* ignore */
        })
    }
    const refreshPhases = () => {
      if (!selectedProjectId) return
      phasesRepo
        .listByProject(selectedProjectId)
        .then(setPhases)
        .catch(() => {
          /* ignore */
        })
    }

    const channel = supabase
      .channel('quick-capture')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        refreshProjects
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'modules' },
        refreshModules
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'phases' },
        refreshPhases
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [open, selectedProjectId])

  // ——— Filter phases by module, pick default ———————————————————
  const availablePhases = useMemo(() => {
    const project = projects.find((p) => p.id === selectedProjectId)
    if (project?.modules_enabled) {
      if (!selectedModuleId) return []
      return phases
        .filter((p) => p.module_id === selectedModuleId)
        .sort((a, b) => a.number - b.number)
    }
    return phases
      .filter((p) => p.module_id === null)
      .sort((a, b) => a.number - b.number)
  }, [phases, selectedModuleId, selectedProjectId, projects])

  useEffect(() => {
    if (!open) return
    if (availablePhases.length === 0) {
      setSelectedPhaseId(null)
      return
    }
    // Prefer initial prop if it matches available
    if (
      initialPhaseId &&
      availablePhases.some((p) => p.id === initialPhaseId)
    ) {
      setSelectedPhaseId(initialPhaseId)
      return
    }
    // If existing selection is still valid, keep it
    if (selectedPhaseId && availablePhases.some((p) => p.id === selectedPhaseId)) {
      return
    }
    const current = availablePhases.find((p) => p.is_current)
    setSelectedPhaseId(current?.id ?? availablePhases[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePhases, open, initialPhaseId])

  // ——— Reset form on close (keep last project) ————————————————
  const resetForm = useCallback(() => {
    setType('note')
    setTitle('')
    setTitleError(null)
    setShowMore(true)
    setDescription('')
    setSource('')
    setPriority('medium')
    setTagsInput('')
    setSubmitError(null)
    setProjectMenuOpen(false)
    setModuleMenuOpen(false)
    setPhaseMenuOpen(false)
    setMode('form')
  }, [])

  useEffect(() => {
    if (!open) resetForm()
  }, [open, resetForm])

  // ——— Autofocus title ————————————————————————————————————————
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => titleRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [open])

  // ——— Apply initialType when the modal opens with a hint ———
  useEffect(() => {
    if (open && initialType) setType(initialType)
  }, [open, initialType])

  // ——— Keyboard: Esc, Cmd/Ctrl+Enter ——————————————————————————
  const handleSubmit = useCallback(async () => {
    if (submitting) return
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError('Give this a title to capture it.')
      titleRef.current?.focus()
      return
    }
    if (!selectedPhaseId || !selectedProjectId) {
      setSubmitError('No phase selected.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const parsedTags = parseTags(tagsInput)
      const newItem = await itemsRepo.create({
        phase_id: selectedPhaseId,
        title: trimmed,
        type,
        priority,
        source: source.trim() || null,
        description: description.trim() || null,
        tags: parsedTags,
      })
      await activityRepo.log(
        selectedProjectId,
        'item_created',
        { title: trimmed, type, priority },
        newItem.id
      )
      try {
        window.localStorage.setItem(LAST_PROJECT_KEY, selectedProjectId)
      } catch {
        /* ignore */
      }
      const projectName =
        projects.find((p) => p.id === selectedProjectId)?.name ?? 'project'
      const phaseName =
        availablePhases.find((p) => p.id === selectedPhaseId)?.name ?? 'phase'
      setToast({
        id: Date.now(),
        message: `Added to ${projectName} — ${phaseName}`,
      })
      onClose()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong.'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    title,
    selectedPhaseId,
    selectedProjectId,
    tagsInput,
    type,
    priority,
    source,
    description,
    projects,
    availablePhases,
    onClose,
  ])

  const applySuggestion = useCallback((s: ParseSuggestion) => {
    if (s.projectId) setSelectedProjectId(s.projectId)
    if (s.type) setType(s.type)
    if (s.priority) setPriority(s.priority)
    if (s.title) {
      setTitle(s.title)
      setTitleError(null)
    }
    if (s.description) {
      setDescription(s.description)
      setShowMore(true)
    }
    if (s.source) {
      setSource(s.source)
      setShowMore(true)
    }
    if (s.tags && s.tags.length) {
      setTagsInput((prev) => {
        const prevTrim = prev.trim()
        const appended = s.tags!.join(' ')
        return prevTrim ? `${prevTrim} ${appended}` : appended
      })
      setShowMore(true)
    }
    setMode('form')
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (mode !== 'form') return
        e.preventDefault()
        handleSubmit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, handleSubmit, mode])

  // ——— Toast auto-dismiss ——————————————————————————————————————
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  // ——— Derived ————————————————————————————————————————————————
  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) ?? null,
    [projects, selectedProjectId]
  )
  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) ?? null,
    [modules, selectedModuleId]
  )
  const selectedPhase = useMemo(
    () => availablePhases.find((p) => p.id === selectedPhaseId) ?? null,
    [availablePhases, selectedPhaseId]
  )
  const accent = selectedProject?.color || FALLBACK_ACCENT
  const accentSoft = hexToRgba(accent, 0.18)
  const accentRing = hexToRgba(accent, 0.35)

  const noProjects = !loadingProjects && projects.length === 0
  const noPhases =
    !loadingProjects &&
    !!selectedProjectId &&
    phases.length >= 0 &&
    availablePhases.length === 0 &&
    (selectedProject?.modules_enabled ? !!selectedModuleId : true)

  const formDisabled = noProjects || noPhases

  // ——— Render ————————————————————————————————————————————————
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="qc-overlay"
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: APPLE_EASE }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/55 backdrop-blur-[6px]"
              onClick={onClose}
              aria-hidden
            />

            {/* Card */}
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Quick capture"
              className="relative w-full sm:max-w-[520px] sm:rounded-[22px] rounded-t-[22px] overflow-hidden"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.22, ease: APPLE_EASE }}
              style={{
                background:
                  'linear-gradient(180deg, rgba(22,24,30,0.92) 0%, rgba(16,17,22,0.94) 100%)',
                backdropFilter: 'blur(20px) saturate(140%)',
                WebkitBackdropFilter: 'blur(20px) saturate(140%)',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow:
                  '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -12px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-7 w-7 rounded-[9px] flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${hexToRgba(accent, 0.28)}, ${hexToRgba(accent, 0.08)})`,
                      boxShadow: `inset 0 0 0 1px ${accentRing}`,
                    }}
                  >
                    <Sparkles
                      className="h-3.5 w-3.5"
                      style={{ color: accent }}
                    />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="text-[13px] font-medium text-white/90 tracking-[-0.01em]">
                      Quick Capture
                    </span>
                    <span className="text-[11px] text-white/40">
                      Thought in, context attached
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setMode((m) => (m === 'paste' ? 'form' : 'paste'))
                    }
                    className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11.5px] font-medium transition-all"
                    style={{
                      background:
                        mode === 'paste'
                          ? `linear-gradient(180deg, ${hexToRgba(accent, 0.22)}, ${hexToRgba(accent, 0.08)})`
                          : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${mode === 'paste' ? accentRing : 'rgba(255,255,255,0.06)'}`,
                      color:
                        mode === 'paste'
                          ? 'rgba(255,255,255,0.95)'
                          : 'rgba(255,255,255,0.65)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
                    }}
                    aria-pressed={mode === 'paste'}
                    title="Paste to parse"
                  >
                    <ClipboardPaste className="h-3 w-3" />
                    <span>Paste to parse</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-7 w-7 rounded-full flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-5 max-h-[calc(100vh-8rem)] overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                  {mode === 'paste' ? (
                    <motion.div
                      key="paste"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.2, ease: APPLE_EASE }}
                    >
                      <PasteParseMode
                        onCancel={() => setMode('form')}
                        onParsed={applySuggestion}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 6 }}
                      transition={{ duration: 0.2, ease: APPLE_EASE }}
                    >
                {noProjects ? (
                  <EmptyState
                    title="Create a project first"
                    body="Quick capture lives inside a project. Create one from the Projects view to start capturing."
                  />
                ) : (
                  <>
                    {/* Context row: Project / Module / Phase */}
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      <ContextPill
                        label="Project"
                        open={projectMenuOpen}
                        onToggle={() => setProjectMenuOpen((v) => !v)}
                        onClose={() => setProjectMenuOpen(false)}
                        accent={accent}
                        accentRing={accentRing}
                        display={
                          selectedProject ? (
                            <>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: accent }}
                              />
                              <span className="truncate max-w-[140px]">
                                {selectedProject.name}
                              </span>
                            </>
                          ) : loadingProjects ? (
                            <span className="text-white/40">Loading…</span>
                          ) : (
                            <span className="text-white/40">Select…</span>
                          )
                        }
                        tinted
                      >
                        {projects.map((p) => (
                          <MenuItem
                            key={p.id}
                            selected={p.id === selectedProjectId}
                            onClick={() => {
                              setSelectedProjectId(p.id)
                              setProjectMenuOpen(false)
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{
                                background: p.color || FALLBACK_ACCENT,
                              }}
                            />
                            <span className="truncate">{p.name}</span>
                          </MenuItem>
                        ))}
                      </ContextPill>

                      {selectedProject?.modules_enabled && (
                        <ContextPill
                          label="Module"
                          open={moduleMenuOpen}
                          onToggle={() => setModuleMenuOpen((v) => !v)}
                          onClose={() => setModuleMenuOpen(false)}
                          accent={accent}
                          accentRing={accentRing}
                          display={
                            selectedModule ? (
                              <span className="truncate max-w-[120px]">
                                {selectedModule.name}
                              </span>
                            ) : (
                              <span className="text-white/40">None</span>
                            )
                          }
                        >
                          {modules.length === 0 ? (
                            <div className="px-3 py-2 text-[12px] text-white/40">
                              No modules
                            </div>
                          ) : (
                            modules.map((m) => (
                              <MenuItem
                                key={m.id}
                                selected={m.id === selectedModuleId}
                                onClick={() => {
                                  setSelectedModuleId(m.id)
                                  setModuleMenuOpen(false)
                                }}
                              >
                                <span className="truncate">{m.name}</span>
                                {m.is_general && (
                                  <span className="ml-auto text-[10px] uppercase tracking-wider text-white/30">
                                    General
                                  </span>
                                )}
                              </MenuItem>
                            ))
                          )}
                        </ContextPill>
                      )}

                      <ContextPill
                        label="Phase"
                        open={phaseMenuOpen}
                        onToggle={() => setPhaseMenuOpen((v) => !v)}
                        onClose={() => setPhaseMenuOpen(false)}
                        accent={accent}
                        accentRing={accentRing}
                        display={
                          selectedPhase ? (
                            <span className="truncate max-w-[140px]">
                              <span className="text-white/40 mr-1">
                                P{selectedPhase.number}
                              </span>
                              {selectedPhase.name}
                            </span>
                          ) : (
                            <span className="text-white/40">None</span>
                          )
                        }
                      >
                        {availablePhases.length === 0 ? (
                          <div className="px-3 py-2 text-[12px] text-white/40">
                            No phases available
                          </div>
                        ) : (
                          availablePhases.map((p) => (
                            <MenuItem
                              key={p.id}
                              selected={p.id === selectedPhaseId}
                              onClick={() => {
                                setSelectedPhaseId(p.id)
                                setPhaseMenuOpen(false)
                              }}
                            >
                              <span className="text-white/40 tabular-nums">
                                P{p.number}
                              </span>
                              <span className="truncate">{p.name}</span>
                              {p.is_current && (
                                <span className="ml-auto text-[10px] uppercase tracking-wider text-white/30">
                                  Current
                                </span>
                              )}
                            </MenuItem>
                          ))
                        )}
                      </ContextPill>
                    </div>

                    {noPhases && (
                      <InlineNotice
                        tone="warn"
                        message="No phases in this project. Add one from the project view."
                      />
                    )}

                    {/* Type selector */}
                    <SegmentedRow>
                      {TYPES.map((t) => (
                        <SegmentedButton
                          key={t.value}
                          selected={type === t.value}
                          accent={accent}
                          onClick={() => setType(t.value)}
                          disabled={formDisabled}
                          title={t.label}
                        >
                          <t.Icon className="h-3.5 w-3.5" />
                          <span>{t.label}</span>
                        </SegmentedButton>
                      ))}
                    </SegmentedRow>

                    {/* Title */}
                    <div className="mt-4">
                      <div className="relative">
                        <input
                          ref={titleRef}
                          type="text"
                          value={title}
                          onChange={(e) => {
                            setTitle(e.target.value)
                            if (titleError) setTitleError(null)
                          }}
                          placeholder="What just happened?"
                          disabled={formDisabled}
                          className="w-full bg-transparent text-[17px] text-white placeholder:text-white/30 py-2.5 pr-2 outline-none font-medium tracking-[-0.01em] disabled:opacity-50"
                          aria-invalid={!!titleError}
                        />
                        <div
                          className="absolute left-0 right-0 bottom-0 h-px"
                          style={{
                            background: `linear-gradient(90deg, transparent 0%, ${accentSoft} 50%, transparent 100%)`,
                          }}
                        />
                      </div>
                      <AnimatePresence>
                        {titleError && (
                          <motion.div
                            initial={{ opacity: 0, y: -2 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -2 }}
                            className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-rose-300/90"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {titleError}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* More toggle */}
                    <button
                      type="button"
                      onClick={() => setShowMore((v) => !v)}
                      className="mt-4 group inline-flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white/75 transition-colors"
                      disabled={formDisabled}
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform duration-300 ${
                          showMore ? 'rotate-180' : ''
                        }`}
                        style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
                      />
                      <span>{showMore ? 'Less details' : 'More details'}</span>
                    </button>

                    <AnimatePresence initial={false}>
                      {showMore && (
                        <motion.div
                          key="more"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: APPLE_EASE }}
                          className="overflow-hidden"
                        >
                          <div className="pt-4 space-y-4">
                            {/* Description */}
                            <FieldLabel label="Description">
                              <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Optional context, links, details…"
                                rows={3}
                                className="w-full resize-none rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-white/[0.14] focus:bg-white/[0.05] px-3 py-2.5 text-[13.5px] text-white/90 placeholder:text-white/25 outline-none transition-colors leading-relaxed"
                              />
                            </FieldLabel>

                            {/* Source */}
                            <FieldLabel label="Source">
                              <input
                                type="text"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                placeholder="e.g. pricing team, Rajiv, user testing"
                                className="w-full rounded-lg bg-white/[0.03] border border-white/[0.06] focus:border-white/[0.14] focus:bg-white/[0.05] px-3 py-2 text-[13px] text-white/90 placeholder:text-white/25 outline-none transition-colors"
                              />
                            </FieldLabel>

                            {/* Priority */}
                            <FieldLabel label="Priority">
                              <SegmentedRow>
                                {PRIORITIES.map((p) => (
                                  <SegmentedButton
                                    key={p.value}
                                    selected={priority === p.value}
                                    accent={priorityAccent(p.value, accent)}
                                    onClick={() => setPriority(p.value)}
                                  >
                                    <span>{p.label}</span>
                                  </SegmentedButton>
                                ))}
                              </SegmentedRow>
                            </FieldLabel>

                            {/* Tags */}
                            <FieldLabel label="Tags">
                              <TagsField
                                value={tagsInput}
                                onChange={setTagsInput}
                              />
                            </FieldLabel>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {submitError && (
                      <div className="mt-4">
                        <InlineNotice tone="error" message={submitError} />
                      </div>
                    )}
                  </>
                )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between gap-3 px-6 py-3.5 border-t border-white/[0.05]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0) 100%)',
                }}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-white/35">
                  <Kbd>
                    <CommandIcon className="h-2.5 w-2.5" />
                  </Kbd>
                  <Kbd>↵</Kbd>
                  <span className="ml-1">to capture</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-8 px-3 rounded-[9px] text-[12.5px] text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={formDisabled || submitting}
                    className="h-8 px-4 rounded-[9px] text-[12.5px] font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden group"
                    style={{
                      background: `linear-gradient(180deg, ${hexToRgba(accent, 0.55)} 0%, ${hexToRgba(accent, 0.35)} 100%)`,
                      boxShadow: `inset 0 1px 0 ${hexToRgba('#ffffff', 0.18)}, 0 0 0 1px ${accentRing}, 0 6px 16px -6px ${hexToRgba(accent, 0.5)}`,
                    }}
                  >
                    <span className="relative z-10">
                      {submitting ? 'Capturing…' : 'Capture'}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.24, ease: APPLE_EASE }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[12.5px] text-white/90"
              style={{
                background: 'rgba(18,20,25,0.92)',
                backdropFilter: 'blur(14px) saturate(140%)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow:
                  '0 1px 0 rgba(255,255,255,0.05) inset, 0 10px 32px -8px rgba(0,0,0,0.6)',
              }}
            >
              <Check className="h-3.5 w-3.5 text-emerald-300/90" />
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ——— Subcomponents ————————————————————————————————————————————

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-10 text-center">
      <div className="mx-auto h-10 w-10 rounded-full flex items-center justify-center mb-3 bg-white/[0.04] border border-white/[0.06]">
        <FileText className="h-4 w-4 text-white/50" />
      </div>
      <div className="text-[14px] font-medium text-white/85">{title}</div>
      <div className="mt-1 text-[12.5px] text-white/45 max-w-[320px] mx-auto leading-relaxed">
        {body}
      </div>
    </div>
  )
}

function InlineNotice({
  tone,
  message,
}: {
  tone: 'warn' | 'error'
  message: string
}) {
  const color =
    tone === 'error' ? 'rgba(251, 113, 133, 0.9)' : 'rgba(251, 191, 36, 0.9)'
  const bg =
    tone === 'error' ? 'rgba(251, 113, 133, 0.08)' : 'rgba(251, 191, 36, 0.07)'
  const border =
    tone === 'error' ? 'rgba(251, 113, 133, 0.22)' : 'rgba(251, 191, 36, 0.2)'
  return (
    <div
      className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
      <span>{message}</span>
    </div>
  )
}

function ContextPill({
  label,
  display,
  open,
  onToggle,
  onClose,
  children,
  accent,
  accentRing,
  tinted,
}: {
  label: string
  display: React.ReactNode
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: React.ReactNode
  accent: string
  accentRing: string
  tinted?: boolean
}) {
  // Portal the dropdown to document.body so the modal body's overflow-y-auto
  // can't clip it when there are many entries (or when the body scrolls).
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{
    top: number
    left: number
    minWidth: number
  } | null>(null)

  useEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      setPos({ top: r.bottom + 6, left: r.left, minWidth: r.width })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      onClose()
    }
    const t = setTimeout(
      () => document.addEventListener('mousedown', handler),
      0
    )
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
    }
  }, [open, onClose])

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className="group inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11.5px] text-white/80 hover:text-white transition-colors"
        style={{
          background: tinted
            ? `linear-gradient(180deg, ${hexToRgba(accent, 0.14)}, ${hexToRgba(accent, 0.06)})`
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${tinted ? accentRing : 'rgba(255,255,255,0.06)'}`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <span className="text-white/40 font-medium">{label}</span>
        <span className="inline-flex items-center gap-1 font-medium">
          {display}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-white/40 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: APPLE_EASE }}
                className="max-h-[240px] overflow-y-auto rounded-xl p-1"
                style={{
                  position: 'fixed',
                  top: pos.top,
                  left: pos.left,
                  minWidth: Math.max(200, pos.minWidth),
                  zIndex: 100,
                  background: 'rgba(22,24,30,0.96)',
                  backdropFilter: 'blur(18px) saturate(140%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(140%)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow:
                    '0 16px 40px -8px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset',
                }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}

function MenuItem({
  children,
  selected,
  onClick,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] text-[12.5px] text-left transition-colors ${
        selected
          ? 'bg-white/[0.07] text-white'
          : 'text-white/75 hover:bg-white/[0.04] hover:text-white'
      }`}
    >
      {children}
      {selected && <Check className="ml-auto h-3 w-3 text-white/60" />}
    </button>
  )
}

function SegmentedRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-1 p-1 rounded-[11px]"
      style={{
        background: 'rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.04)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      {children}
    </div>
  )
}

function SegmentedButton({
  children,
  selected,
  onClick,
  accent,
  disabled,
  title,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  accent: string
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex-1 inline-flex items-center justify-center gap-1.5 h-7 px-2 rounded-[8px] text-[11.5px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: selected
          ? `linear-gradient(180deg, ${hexToRgba(accent, 0.22)}, ${hexToRgba(accent, 0.1)})`
          : 'transparent',
        color: selected ? '#fff' : 'rgba(255,255,255,0.55)',
        boxShadow: selected
          ? `inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px ${hexToRgba(accent, 0.28)}`
          : 'none',
      }}
    >
      {children}
    </button>
  )
}

function FieldLabel({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/35 font-medium mb-1.5">
        {label}
      </div>
      {children}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-[4px] text-[10px] text-white/55 font-medium"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.25)',
      }}
    >
      {children}
    </kbd>
  )
}

function TagsField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [draft, setDraft] = useState('')
  const tags = useMemo(() => parseTags(value), [value])

  const commit = (next: string) => {
    const trimmed = next.trim().replace(/,$/, '')
    if (!trimmed) {
      setDraft('')
      return
    }
    const merged = [...tags, ...parseTags(trimmed)]
    onChange(merged.join(' '))
    setDraft('')
  }

  const removeAt = (i: number) => {
    const next = tags.filter((_, idx) => idx !== i)
    onChange(next.join(' '))
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] focus-within:border-white/[0.14] focus-within:bg-white/[0.05] px-2 py-1.5 transition-colors"
    >
      {tags.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-[11.5px] text-white/80 bg-white/[0.06] border border-white/[0.05]"
        >
          {t}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="h-4 w-4 rounded-full inline-flex items-center justify-center text-white/40 hover:text-white/85 hover:bg-white/[0.08]"
            aria-label={`Remove tag ${t}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => {
          const v = e.target.value
          if (v.endsWith(',')) {
            commit(v.slice(0, -1))
          } else {
            setDraft(v)
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(draft)
          } else if (e.key === 'Backspace' && !draft && tags.length) {
            removeAt(tags.length - 1)
          } else if (e.key === ' ' && draft.trim()) {
            e.preventDefault()
            commit(draft)
          }
        }}
        onBlur={() => draft && commit(draft)}
        placeholder={tags.length ? '' : 'Add tags…'}
        className="flex-1 min-w-[80px] bg-transparent text-[13px] text-white/90 placeholder:text-white/25 outline-none py-0.5"
      />
    </div>
  )
}

// ——— helpers ————————————————————————————————————————————————

function priorityAccent(p: ItemPriority, fallback: string): string {
  switch (p) {
    case 'low':
      return '#8892a6'
    case 'medium':
      return fallback
    case 'high':
      return '#d4a373'
    case 'critical':
      return '#d08b96'
    default:
      return fallback
  }
}
