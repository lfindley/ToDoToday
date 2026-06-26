import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { DayPlan } from '../types'
import { useStore } from '../store/useStore'
import { displayHour, parseTime } from '../utils/time'
import { blockHeights } from '../utils/layout'
import BlockCard from './BlockCard'

const PX = 1.1 // pixels per minute

export default function Timeline({ plan, dateISO }: { plan: DayPlan; dateISO: string }) {
  const template = useStore((s) => s.template)
  const moveBlock = useStore((s) => s.moveBlock)
  const fmt = useStore((s) => s.settings.timeFormat) ?? '24h'
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const wake = parseTime(template.sleep.wakeTime)
  const bed0 = parseTime(template.sleep.bedtime)
  const bed = bed0 > wake ? bed0 : 24 * 60

  const starts = plan.blocks.map((b) => parseTime(b.start))
  const ends = plan.blocks.map((b) => parseTime(b.end))
  const dayStart = Math.min(wake, ...(starts.length ? starts : [wake]))
  const dayEnd = Math.max(bed, ...(ends.length ? ends : [bed]))
  const height = (dayEnd - dayStart) * PX

  const hourLines: number[] = []
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hourLines.push(m)

  // Heights capped so tightly-packed short blocks don't overlap the next one.
  const heights = blockHeights(plan.blocks, { dayEnd, px: PX, min: 22 })

  const onDragEnd = (e: DragEndEvent) => {
    const block = plan.blocks.find((b) => b.id === e.active.id)
    if (!block) return
    const deltaMin = e.delta.y / PX
    moveBlock(dateISO, String(e.active.id), parseTime(block.start) + deltaMin)
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="relative" style={{ height }}>
        {hourLines.map((m) => (
          <div
            key={m}
            className="absolute left-0 right-0 flex items-center pointer-events-none"
            style={{ top: (m - dayStart) * PX }}
          >
            <span className="text-[10px] text-slate-400 w-11 text-right pr-1.5 -mt-2 tabular-nums">
              {displayHour(m, fmt)}
            </span>
            <div className="flex-1 border-t border-slate-100" />
          </div>
        ))}
        {plan.blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            dateISO={dateISO}
            top={(parseTime(b.start) - dayStart) * PX}
            height={heights[b.id]}
          />
        ))}
      </div>
    </DndContext>
  )
}
