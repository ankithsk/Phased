import { Outlet } from 'react-router-dom'

// Placeholder shell — will be replaced by apple-ui-designer.
// Kept minimal so routing works end-to-end before design pass.
export function AppShell() {
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <span className="text-sm font-medium tracking-tight">Project Command Center</span>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
