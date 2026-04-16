import { Link, Outlet } from 'react-router-dom'
import { LogOut, Plus, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { ThemeToggle } from './ThemeToggle'

function openSearch() {
  window.dispatchEvent(new CustomEvent('pcc:open-search'))
}

function signOut() {
  window.dispatchEvent(new CustomEvent('pcc:sign-out'))
}

function quickCapture() {
  window.dispatchEvent(new CustomEvent('pcc:quick-capture'))
}

export function AppShell() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-md text-sm font-semibold tracking-tight text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Project Command Center home"
          >
            <span
              aria-hidden
              className="h-5 w-5 rounded-[6px] bg-gradient-to-br from-foreground to-muted-foreground/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
            />
            <span className="hidden sm:inline">Project Command Center</span>
            <span className="sm:hidden">PCC</span>
          </Link>

          {/* Search trigger */}
          <div className="flex flex-1 justify-center">
            <button
              type="button"
              onClick={openSearch}
              aria-label="Open search (Command+K)"
              className="group inline-flex h-8 items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:h-9 sm:w-full sm:max-w-md sm:px-3"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden flex-1 text-left sm:inline">Search…</span>
              <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                <span className="text-[11px] leading-none">⌘</span>
                <span className="leading-none">K</span>
              </kbd>
            </button>
          </div>

          {/* Right cluster */}
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div
              aria-hidden
              className="ml-1 flex h-8 w-8 select-none items-center justify-center rounded-full border border-border bg-gradient-to-br from-secondary to-muted text-[11px] font-semibold tracking-wide text-foreground/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              title="Account"
            >
              A
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      {/* Floating Action Button — Quick Capture */}
      <motion.button
        type="button"
        onClick={quickCapture}
        aria-label="Quick capture (Ctrl+Shift+N)"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45),0_2px_8px_-2px_rgba(0,0,0,0.3)] ring-1 ring-border/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:bottom-6 sm:right-6 sm:h-12 sm:w-12"
      >
        <Plus className="h-5 w-5" strokeWidth={2.25} />
      </motion.button>
    </div>
  )
}
