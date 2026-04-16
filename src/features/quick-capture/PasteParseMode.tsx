import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bug,
  ClipboardPaste,
  FileText,
  GitBranch,
  MessageCircle,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { projectsRepo } from '@/repos/projects'
import type { ItemPriority, ItemType, Project } from '@/types/db'

export interface ParseSuggestion {
  projectId?: string
  type?: ItemType
  priority?: ItemPriority
  title?: string
  description?: string
  source?: string
  tags?: string[]
}

export interface PasteParseModeProps {
  onParsed: (suggestion: ParseSuggestion) => void
  onCancel: () => void
}

const APPLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
const FALLBACK_ACCENT = '#8892a6'

const TYPE_META: Record<
  ItemType,
  { label: string; Icon: typeof Sparkles; color: string }
> = {
  feature: { label: 'Feature', Icon: Sparkles, color: '#a8b4c8' },
  bug: { label: 'Bug', Icon: Bug, color: '#d08b96' },
  feedback: { label: 'Feedback', Icon: MessageCircle, color: '#b7a8c8' },
  note: { label: 'Note', Icon: FileText, color: '#8892a6' },
  decision: { label: 'Decision', Icon: GitBranch, color: '#a3b8a1' },
}

const PRIORITY_META: Record<ItemPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: '#8892a6' },
  medium: { label: 'Medium', color: '#a8b4c8' },
  high: { label: 'High', color: '#d4a373' },
  critical: { label: 'Critical', color: '#d08b96' },
}

// ——— helpers ————————————————————————————————————————————————

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

function detectType(text: string): ItemType {
  const patterns: Array<[ItemType, RegExp]> = [
    [
      'bug',
      /\b(bug|error|broken|crash|exception|fail|failing|regression)\b/i,
    ],
    ['decision', /\b(decided|decision|we'll go with|agreed|resolution)\b/i],
    ['feature', /\b(feature|add|implement|build|ship|support for)\b/i],
    ['feedback', /\b(idea|feedback|suggestion|proposal|nice to have)\b/i],
  ]
  for (const [t, re] of patterns) {
    if (re.test(text)) return t
  }
  return 'note'
}

function detectPriority(text: string): ItemPriority | undefined {
  if (/\b(critical|urgent|asap|p0|blocker)\b/i.test(text)) return 'critical'
  if (/\b(high|important|p1|soon)\b/i.test(text)) return 'high'
  return undefined
}

function detectProject(
  text: string,
  projects: Project[]
): string | undefined {
  const matches: Array<{ id: string; len: number }> = []
  for (const p of projects) {
    if (!p.name) continue
    const nameRe = new RegExp('\\b' + escapeRegex(p.name) + '\\b', 'i')
    if (nameRe.test(text)) {
      matches.push({ id: p.id, len: p.name.length })
      continue
    }
    // derive alias: strip non-alpha tokens, also first word
    const firstWord = p.name.split(/\s+/)[0]
    if (firstWord && firstWord.length >= 4 && firstWord !== p.name) {
      const aliasRe = new RegExp('\\b' + escapeRegex(firstWord) + '\\b', 'i')
      if (aliasRe.test(text)) {
        matches.push({ id: p.id, len: firstWord.length })
      }
    }
  }
  if (!matches.length) return undefined
  matches.sort((a, b) => b.len - a.len)
  return matches[0].id
}

function detectTitle(text: string): string | undefined {
  const firstLine =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''
  if (!firstLine) return undefined
  const beforePeriod = firstLine.split(/(?<=\.)\s/)[0].replace(/\.$/, '').trim()
  const candidate =
    beforePeriod && beforePeriod.length <= firstLine.length && beforePeriod.length >= 6
      ? beforePeriod
      : firstLine
  return candidate.slice(0, 100).trim() || undefined
}

function detectDescription(text: string, title: string | undefined): string | undefined {
  if (text.trim().length < 120) return undefined
  if (!title) return text.trim()
  const idx = text.indexOf(title)
  if (idx < 0) return text.trim()
  const rest = text.slice(idx + title.length).trim()
  return rest || undefined
}

function detectTags(text: string): string[] {
  const set = new Set<string>()
  const re = /#([A-Za-z0-9_-]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    set.add(m[1])
  }
  return Array.from(set)
}

function detectSource(text: string): string | undefined {
  const trimmed = text.trimStart()
  const fromMatch = trimmed.match(/^From:\s*([^\n<]+?)(?:\s*<[^>]*>)?\s*\n/i)
  if (fromMatch) return fromMatch[1].trim() || undefined
  const atMatch = trimmed.match(/^@([A-Za-z0-9._-]+)\s*:/)
  if (atMatch) return atMatch[1].trim() || undefined
  return undefined
}

function parseText(text: string, projects: Project[]): ParseSuggestion {
  if (!text.trim()) return {}
  const title = detectTitle(text)
  return {
    projectId: detectProject(text, projects),
    type: detectType(text),
    priority: detectPriority(text),
    title,
    description: detectDescription(text, title),
    source: detectSource(text),
    tags: detectTags(text),
  }
}

// ——— Component ————————————————————————————————————————————————

export function PasteParseMode(props: PasteParseModeProps) {
  const { onParsed, onCancel } = props
  const [projects, setProjects] = useState<Project[]>([])
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let cancelled = false
    projectsRepo
      .list()
      .then((list) => {
        if (!cancelled) setProjects(list)
      })
      .catch(() => {
        if (!cancelled) setProjects([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  const suggestion = useMemo(
    () => parseText(text, projects),
    [text, projects]
  )

  const selectedProject = useMemo(
    () =>
      suggestion.projectId
        ? projects.find((p) => p.id === suggestion.projectId) ?? null
        : null,
    [projects, suggestion.projectId]
  )

  const hasAny =
    !!suggestion.title ||
    !!suggestion.projectId ||
    !!suggestion.type ||
    !!suggestion.priority ||
    !!(suggestion.tags && suggestion.tags.length)

  const canParse = text.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: APPLE_EASE }}
      className="flex flex-col"
    >
      {/* Banner */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-[10px] mb-4"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.015))',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div
          className="h-5 w-5 rounded-[6px] flex items-center justify-center shrink-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(168,180,200,0.22), rgba(168,180,200,0.06))',
            boxShadow: 'inset 0 0 0 1px rgba(168,180,200,0.24)',
          }}
        >
          <ClipboardPaste className="h-3 w-3 text-white/75" />
        </div>
        <div className="leading-tight">
          <div className="text-[12px] font-medium text-white/85 tracking-[-0.01em]">
            Paste mode
          </div>
          <div className="text-[11px] text-white/40">
            We’ll auto-fill what we can from your text.
          </div>
        </div>
      </div>

      {/* Textarea */}
      <div
        className="relative rounded-[12px] transition-colors"
        style={{
          background: 'rgba(0,0,0,0.22)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow:
            'inset 0 1px 2px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.015)',
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a message, notes, or conversation. We'll extract project, type, priority, and a title."
          className="w-full min-h-[10rem] resize-y bg-transparent outline-none px-3.5 py-3 text-[13.5px] leading-relaxed text-white/90 placeholder:text-white/30 rounded-[12px]"
        />
      </div>

      {/* Preview */}
      <div className="mt-4">
        <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/35 font-medium mb-2">
          Preview
        </div>
        <div
          className="rounded-[12px] p-3 space-y-2.5"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
          }}
        >
          <PreviewRow label="Project">
            {selectedProject ? (
              <ChipTint
                accent={selectedProject.color || FALLBACK_ACCENT}
                label={selectedProject.name}
                dot
              />
            ) : (
              <Muted />
            )}
          </PreviewRow>

          <PreviewRow label="Type">
            {suggestion.type ? (
              <TypeChip type={suggestion.type} />
            ) : (
              <Muted />
            )}
          </PreviewRow>

          <PreviewRow label="Priority">
            {suggestion.priority ? (
              <PriorityChip priority={suggestion.priority} />
            ) : (
              <Muted />
            )}
          </PreviewRow>

          <PreviewRow label="Title">
            {suggestion.title ? (
              <span className="text-[13px] text-white/90 font-medium tracking-[-0.01em]">
                {suggestion.title}
              </span>
            ) : (
              <Muted />
            )}
          </PreviewRow>

          <PreviewRow label="Description">
            {suggestion.description ? (
              <span className="text-[12.5px] text-white/60 leading-relaxed line-clamp-3">
                {suggestion.description}
              </span>
            ) : (
              <Muted />
            )}
          </PreviewRow>

          <PreviewRow label="Source">
            {suggestion.source ? (
              <span className="text-[12px] text-white/70">
                {suggestion.source}
              </span>
            ) : (
              <Muted />
            )}
          </PreviewRow>

          <PreviewRow label="Tags">
            {suggestion.tags && suggestion.tags.length ? (
              <div className="flex flex-wrap gap-1">
                {suggestion.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center h-5 px-1.5 rounded-full text-[10.5px] text-white/75"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            ) : (
              <Muted />
            )}
          </PreviewRow>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-5">
        <div className="text-[11px] text-white/35">
          {hasAny ? 'Looks good? Prefill and edit.' : 'Start typing or paste…'}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 px-3 rounded-[9px] text-[12.5px] text-white/65 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onParsed(parseText(text, projects))}
            disabled={!canParse}
            className="h-8 px-3.5 rounded-[9px] text-[12.5px] font-medium text-white inline-flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                'linear-gradient(180deg, rgba(168,180,200,0.45) 0%, rgba(168,180,200,0.25) 100%)',
              boxShadow: `inset 0 1px 0 ${hexToRgba('#ffffff', 0.18)}, 0 0 0 1px ${hexToRgba('#a8b4c8', 0.35)}, 0 6px 16px -6px ${hexToRgba('#a8b4c8', 0.4)}`,
            }}
          >
            <Wand2 className="h-3.5 w-3.5" />
            Parse &amp; Prefill
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ——— Preview subcomponents ———————————————————————————————————

function PreviewRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3">
      <div className="pt-0.5 text-[10.5px] uppercase tracking-[0.08em] text-white/30 font-medium">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Muted() {
  return <span className="text-[12.5px] text-white/25">—</span>
}

function ChipTint({
  accent,
  label,
  dot,
}: {
  accent: string
  label: string
  dot?: boolean
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] text-white/85"
      style={{
        background: `linear-gradient(180deg, ${hexToRgba(accent, 0.18)}, ${hexToRgba(accent, 0.06)})`,
        border: `1px solid ${hexToRgba(accent, 0.32)}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: accent }}
        />
      )}
      <span className="truncate max-w-[220px]">{label}</span>
    </span>
  )
}

function TypeChip({ type }: { type: ItemType }) {
  const meta = TYPE_META[type]
  const { Icon, label, color } = meta
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] text-white/85"
      style={{
        background: `linear-gradient(180deg, ${hexToRgba(color, 0.2)}, ${hexToRgba(color, 0.06)})`,
        border: `1px solid ${hexToRgba(color, 0.3)}`,
      }}
    >
      <Icon className="h-3 w-3" style={{ color }} />
      {label}
    </span>
  )
}

function PriorityChip({ priority }: { priority: ItemPriority }) {
  const meta = PRIORITY_META[priority]
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11.5px] text-white/85"
      style={{
        background: `linear-gradient(180deg, ${hexToRgba(meta.color, 0.18)}, ${hexToRgba(meta.color, 0.05)})`,
        border: `1px solid ${hexToRgba(meta.color, 0.28)}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color }}
      />
      {meta.label}
    </span>
  )
}
