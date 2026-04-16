import { Home, Layers } from 'lucide-react'
import type { Module } from '@/types/db'

export interface ModuleSidebarProps {
  modules: Module[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function ModuleSidebar({ modules, selectedId, onSelect }: ModuleSidebarProps) {
  const sorted = [...modules].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <aside className="flex h-full w-[280px] flex-none flex-col border-r border-border/60 bg-card/30 backdrop-blur-sm">
      <div className="px-5 pb-3 pt-6">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          Modules
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <SidebarItem
          active={selectedId === null}
          onClick={() => onSelect(null)}
          icon={<Layers className="h-3.5 w-3.5" />}
          label="All modules"
        />
        <div className="my-2 h-px bg-border/50" />
        <div className="flex flex-col gap-0.5">
          {sorted.map((m) => (
            <SidebarItem
              key={m.id}
              active={selectedId === m.id}
              onClick={() => onSelect(m.id)}
              icon={
                m.is_general ? (
                  <Home className="h-3.5 w-3.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                )
              }
              label={m.name}
            />
          ))}
        </div>
      </nav>
    </aside>
  )
}

interface SidebarItemProps {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function SidebarItem({ active, onClick, icon, label }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-all duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        active
          ? 'bg-secondary font-semibold text-foreground'
          : 'font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
      }`}
    >
      <span
        className={`flex h-5 w-5 flex-none items-center justify-center ${
          active ? 'text-foreground' : 'text-muted-foreground/70 group-hover:text-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  )
}
