import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './features/shell/AppShell'
import { Dashboard } from './features/dashboard/Dashboard'
import { ProjectView } from './features/project/ProjectView'
import { DecisionsPage } from './features/project/DecisionsPage'
import { GoalsPage } from './features/project/GoalsPage'
import { SearchPage } from './features/search/SearchPage'
import { TagView } from './features/tag-view/TagView'
import { DigestPage } from './features/digest/DigestPage'
import { TimelinePage } from './features/timeline/TimelinePage'
import { SettingsPage } from './features/settings/SettingsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'p/:projectId', element: <ProjectView /> },
      { path: 'p/:projectId/decisions', element: <DecisionsPage /> },
      { path: 'p/:projectId/goals', element: <GoalsPage /> },
      { path: 'p/:projectId/timeline', element: <TimelinePage /> },
      { path: 'p/:projectId/settings', element: <SettingsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'tag/:tag', element: <TagView /> },
      { path: 'digest', element: <DigestPage /> }
    ]
  }
])
