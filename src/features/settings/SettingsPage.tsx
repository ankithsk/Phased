import { useParams } from 'react-router-dom'

export function SettingsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <div className="p-8 text-muted-foreground">Settings — {projectId}</div>
}
