import { useParams } from 'react-router-dom'

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>()
  return <div className="p-8 text-muted-foreground">Project view — {projectId}</div>
}
