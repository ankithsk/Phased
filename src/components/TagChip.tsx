import type { MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

interface TagChipProps {
  tag: string
  onRemove?: () => void
  onClick?: () => void
  size?: 'sm' | 'md'
  active?: boolean
}

/**
 * A compact tag pill. Renders `#tag`.
 * - If `onClick` is provided, the chip is a button.
 * - Otherwise, the chip navigates to `/tag/{tag}`.
 * - If `onRemove` is provided, an × is shown; clicking it stops propagation.
 */
export function TagChip({
  tag,
  onRemove,
  onClick,
  size = 'md',
  active = false,
}: TagChipProps) {
  const sizing =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5 h-[20px] gap-1'
      : 'text-[12px] px-2.5 py-1 h-[24px] gap-1.5'

  const baseClasses =
    'inline-flex items-center rounded-full transition-colors duration-150 ease-out whitespace-nowrap select-none'

  const style: React.CSSProperties = active
    ? {
        background: 'rgba(255,255,255,0.92)',
        color: 'rgba(15,15,18,0.95)',
        border: '1px solid rgba(255,255,255,0.92)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 0 rgba(0,0,0,0.2)',
      }
    : {
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.72)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
      }

  const hoverClass = active
    ? ''
    : 'hover:bg-white/[0.07] hover:text-white/90 hover:border-white/10'

  const content: ReactNode = (
    <>
      <span className="font-medium tracking-[-0.005em]">
        <span className={active ? 'opacity-50' : 'opacity-45'}>#</span>
        {tag}
      </span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove tag ${tag}`}
          onClick={(e: MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.stopPropagation()
              onRemove()
            }
          }}
          className={`-mr-0.5 ml-0.5 inline-flex items-center justify-center h-[14px] w-[14px] rounded-full transition-colors ${
            active
              ? 'text-black/50 hover:text-black/80 hover:bg-black/10'
              : 'text-white/40 hover:text-white/80 hover:bg-white/10'
          }`}
        >
          <X className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      )}
    </>
  )

  const className = `${baseClasses} ${sizing} ${hoverClass}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        style={style}
      >
        {content}
      </button>
    )
  }

  return (
    <Link
      to={`/tag/${encodeURIComponent(tag)}`}
      className={className}
      style={style}
    >
      {content}
    </Link>
  )
}
