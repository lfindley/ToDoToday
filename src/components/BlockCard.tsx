import { useDraggable } from '@dnd-kit/core'
import type { ScheduledBlock } from '../types'
import { useStore } from '../store/useStore'
import { displayTime } from '../utils/time'
import { BLOCK_STYLES } from './ui'

export default function BlockCard({
  block,
  dateISO,
  top,
  height,
}: {
  block: ScheduledBlock
  dateISO: string
  top: number
  height: number
}) {
  const toggleBlockDone = useStore((s) => s.toggleBlockDone)
  const setBlockLocked = useStore((s) => s.setBlockLocked)
  const deleteEvent = useStore((s) => s.deleteEvent)
  const acceptProposal = useStore((s) => s.acceptProposal)
  const dismissProposal = useStore((s) => s.dismissProposal)
  const fmt = useStore((s) => s.settings.timeFormat) ?? '24h'
  const isEvent = block.type === 'event'
  const isProposed = !!block.proposed
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: block.id })

  const style: React.CSSProperties = {
    top,
    height,
    transform: transform ? `translateY(${transform.y}px)` : undefined,
    zIndex: isDragging ? 40 : undefined,
  }
  const s = BLOCK_STYLES[block.type] ?? BLOCK_STYLES.buffer
  const compact = height < 46

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`absolute left-12 right-1 rounded-lg border ${s.bg} overflow-hidden ${
        isDragging ? 'shadow-lg ring-2 ring-brand-400' : 'shadow-sm'
      } ${block.done ? 'opacity-50' : ''} ${
        isProposed ? 'border-dashed border-2 opacity-80 ring-1 ring-brand-300' : ''
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
      <div className="pl-3 pr-2 py-1.5 h-full flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          {!isEvent && !isProposed && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none px-0.5"
              title="Drag to move"
              aria-label="Drag to move"
            >
              ⠿
            </button>
          )}
          {isEvent && <span className="text-rose-400 px-0.5">📍</span>}
          {block.type === 'task' && !isProposed && (
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={!!block.done}
              onChange={() => toggleBlockDone(dateISO, block.id)}
            />
          )}
          <span
            className={`text-xs font-medium truncate flex-1 ${
              block.done ? 'line-through text-slate-400' : 'text-slate-800'
            }`}
          >
            {block.title}
          </span>
          <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
            {displayTime(block.start, fmt)}–{displayTime(block.end, fmt)}
          </span>
          {isProposed ? (
            <span className="shrink-0 flex items-center gap-1">
              <button
                onClick={() => acceptProposal(dateISO, block.id)}
                title="Accept this suggestion"
                aria-label="Accept suggestion"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                ✓ Accept
              </button>
              <button
                onClick={() => dismissProposal(dateISO, block.id)}
                title="Dismiss this suggestion"
                aria-label="Dismiss suggestion"
                className="text-xs text-slate-400 hover:text-red-500"
              >
                ✕ Dismiss
              </button>
            </span>
          ) : isEvent ? (
            <button
              onClick={() => block.refId && deleteEvent(block.refId)}
              title="Delete event"
              className="shrink-0 text-xs text-slate-300 hover:text-red-500"
            >
              ✕
            </button>
          ) : (
            <button
              onClick={() => setBlockLocked(dateISO, block.id, !block.locked)}
              title={block.locked ? 'Locked in place — click to unlock' : 'Click to lock in place'}
              className={`shrink-0 text-xs ${block.locked ? '' : 'opacity-40 hover:opacity-100'}`}
            >
              {block.locked ? '🔒' : '🔓'}
            </button>
          )}
        </div>
        {!compact && block.suggestion && (
          <div className="text-[11px] text-emerald-700 mt-0.5 pl-1 truncate">💡 {block.suggestion}</div>
        )}
      </div>
    </div>
  )
}
