import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders GFM-flavored markdown inside a Tailwind prose container
 * that adapts to dark mode.
 */
export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  return (
    <div
      className={
        'prose prose-sm dark:prose-invert max-w-none ' +
        'prose-p:my-2 prose-headings:tracking-tight prose-headings:font-semibold ' +
        'prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 ' +
        'prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none ' +
        'prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-[12.5px] ' +
        'prose-li:my-0.5 ' +
        className
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  )
}
