import { useParams } from 'react-router-dom'

export function TagView() {
  const { tag } = useParams<{ tag: string }>()
  return <div className="p-8 text-muted-foreground">Tag — {tag}</div>
}
