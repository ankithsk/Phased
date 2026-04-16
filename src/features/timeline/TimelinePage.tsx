import { useParams } from 'react-router-dom'

export function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>()
  return <div className="p-8 text-muted-foreground">Timeline — {projectId}</div>
}
