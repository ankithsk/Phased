import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { projectsRepo } from '@/repos/projects'
import type { Project } from '@/types/db'
import { GeneralPanel } from './GeneralPanel'
import { ModulesPanel } from './ModulesPanel'
import { ArchivePanel } from './ArchivePanel'

type TabKey = 'general' | 'modules' | 'archive'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'general', label: 'General' },
  { key: 'modules', label: 'Modules' },
  { key: 'archive', label: 'Archive' }
]

export function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('general')

  const refresh = useCallback(async () => {
    if (!projectId) return
    const p = await projectsRepo.get(projectId)
    setProject(p)
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!projectId) return
      setLoading(true)
      const p = await projectsRepo.get(projectId)
      if (!cancelled) {
        setProject(p)
        setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24 }}
          className="flex items-center gap-3 text-[12.5px] text-muted-foreground"
        >
          <span className="h-3 w-3 animate-pulse rounded-full bg-muted-foreground/40" />
          Loading settings…
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Sticky header + tabs */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 px-5 pt-7 md:px-8">
          <div className="flex items-start gap-3">
            <Link
              to={`/p/${project.id}`}
              aria-label="Back to project"
              className="mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-all duration-150 hover:border-border hover:bg-secondary/60 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
                Settings
              </h1>
              <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
                {project.name}
              </p>
            </div>
          </div>

          <Tabs value={tab} onChange={setTab} />
        </div>
      </div>

      {/* Tab content */}
      <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 md:px-8 md:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'general' && (
              <GeneralPanel project={project} onChange={refresh} />
            )}
            {tab === 'modules' && (
              <ModulesPanel
                projectId={project.id}
                enabled={project.modules_enabled}
                onProjectChange={refresh}
              />
            )}
            {tab === 'archive' && <ArchivePanel projectId={project.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// --------- Tabs primitive (Tailwind, underline with animated indicator) ---------

interface TabsProps {
  value: TabKey
  onChange: (t: TabKey) => void
}

function Tabs({ value, onChange }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className="-mb-px flex items-center gap-1"
    >
      {TABS.map((t) => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(t.key)}
            className={`relative px-3 py-2.5 text-[12.5px] font-medium tracking-tight transition-colors ${
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {active && (
              <motion.span
                layoutId="settings-tab-indicator"
                className="absolute inset-x-2 -bottom-px h-px bg-foreground/80"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
