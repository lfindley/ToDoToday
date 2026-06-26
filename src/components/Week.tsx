import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import type { ScheduledBlock, TimeFormat } from '../types'
import { useStore } from '../store/useStore'
import { addDaysISO, isoDate, isoToDate } from '../utils/date'
import { displayHour, displayTime, parseTime } from '../utils/time'
import { blockHeights } from '../utils/layout'
import { summariseDay, daySegments } from '../engine/daySummary'
import { plansToICS, exportableBlockCount } from '../utils/icsExport'
import { downloadTextFile } from '../download'
import { Button, Card, CapacityBar, Legend, BLOCK_STYLES } from './ui'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PX = 0.7 // pixels per minute (vertical scale of the grid)
const MIN_COL = 96 // min day-column width before the grid scrolls horizontally
const GUTTER = 44 // width of the left-hand hour gutter (px)

function mondayOf(iso: string): string {
  const day = isoToDate(iso).getDay() // 0 Sun … 6 Sat
  return addDaysISO(iso, -((day + 6) % 7))
}

function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export default function Week({ onOpenDay }: { onOpenDay: (iso: string) => void }) {
  const today = isoDate()
  const [weekStart, setWeekStart] = useState(mondayOf(today))

  const tasks = useStore((s) => s.tasks)
  const recurring = useStore((s) => s.recurring)
  const events = useStore((s) => s.events)
  const template = useStore((s) => s.template)
  const budgets = useStore((s) => s.budgets)
  const dayPlans = useStore((s) => s.dayPlans)
  const settings = useStore((s) => s.settings)
  const replan = useStore((s) => s.replan)
  const fmt = settings.timeFormat ?? '24h'

  // Re-render each minute so the "now" line stays roughly current.
  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 60_000)
    return () => clearInterval(id)
  }, [])

  const summaryState = { tasks, recurring, events, template, budgets, dayPlans }
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
  const weekEnd = days[6]
  const weekPlans = days.map((iso) => dayPlans[iso]).filter((p): p is NonNullable<typeof p> => !!p)

  const exportWeek = () => {
    const label = `${format(isoToDate(weekStart), 'd MMM')} – ${format(isoToDate(weekEnd), 'd MMM yyyy')}`
    downloadTextFile(`todotoday-week-${weekStart}.ics`, plansToICS(weekPlans, `ToDoToday — ${label}`), 'text/calendar')
  }

  // Shared vertical scale across all 7 columns: the waking window, expanded to
  // include any scheduled block that spills outside it so every day lines up.
  const wake = parseTime(template.sleep.wakeTime)
  const bed0 = parseTime(template.sleep.bedtime)
  let dayStart = wake
  let dayEnd = bed0 > wake ? bed0 : 24 * 60
  for (const iso of days) {
    for (const b of dayPlans[iso]?.blocks ?? []) {
      dayStart = Math.min(dayStart, parseTime(b.start))
      dayEnd = Math.max(dayEnd, parseTime(b.end))
    }
  }
  const height = (dayEnd - dayStart) * PX

  const hourLines: number[] = []
  for (let m = Math.ceil(dayStart / 60) * 60; m <= dayEnd; m += 60) hourLines.push(m)

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setWeekStart(addDaysISO(weekStart, -7))}>
          ←
        </Button>
        <div className="text-center">
          <div className="font-semibold text-slate-800">
            {format(isoToDate(weekStart), 'd MMM')} – {format(isoToDate(weekEnd), 'd MMM yyyy')}
          </div>
          {weekStart !== mondayOf(today) && (
            <button onClick={() => setWeekStart(mondayOf(today))} className="text-xs text-brand-600 hover:underline">
              this week
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setWeekStart(addDaysISO(weekStart, 7))}>
          →
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <Legend color="bg-slate-400" label="Meals & commitments" />
            <Legend color="bg-violet-400" label="Recurring" />
            <Legend color="bg-sky-500" label="Tasks" />
            <Legend color="bg-emerald-400" label="Free" />
            <Legend color="bg-rose-500" label="Events" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={exportWeek}
              disabled={exportableBlockCount(weekPlans) === 0}
              title="Download this week's plan as an .ics calendar file"
            >
              Export .ics
            </Button>
            <Button onClick={() => replan()}>Re-plan</Button>
          </div>
        </div>
      </Card>

      {/* Hourly calendar grid — scrolls horizontally on narrow screens. */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: GUTTER + 7 * MIN_COL }}>
            {/* Day headers */}
            <div className="flex border-b border-slate-200">
              <div className="shrink-0" style={{ width: GUTTER }} />
              {days.map((iso) => {
                const d = summariseDay(iso, summaryState)
                const isToday = iso === today
                return (
                  <button
                    key={iso}
                    onClick={() => onOpenDay(iso)}
                    style={{ minWidth: MIN_COL }}
                    className={`flex-1 px-1.5 py-2 text-left border-l border-slate-100 hover:bg-slate-50 transition-colors ${
                      isToday ? 'bg-brand-50 dark:bg-brand-500/15' : ''
                    }`}
                  >
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-sm font-semibold ${isToday ? 'text-brand-700 dark:text-brand-300' : 'text-slate-800'}`}>
                        {WEEKDAYS[d.weekday]}
                      </span>
                      <span className="text-[11px] text-slate-400">{format(d.date, 'd MMM')}</span>
                    </div>
                    <div className="mt-1.5">
                      <CapacityBar segments={daySegments(d)} total={d.waking} height="h-1" />
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Hour grid + blocks */}
            <div className="flex relative" style={{ height }}>
              {/* Hour gutter */}
              <div className="relative shrink-0" style={{ width: GUTTER }}>
                {hourLines.map((m) => (
                  <span
                    key={m}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] text-slate-400 tabular-nums"
                    style={{ top: (m - dayStart) * PX }}
                  >
                    {displayHour(m, fmt)}
                  </span>
                ))}
              </div>

              {/* Day columns */}
              {days.map((iso) => {
                const plan = dayPlans[iso]
                const isToday = iso === today
                const heights = blockHeights(plan?.blocks ?? [], { dayEnd, px: PX, min: 13 })
                return (
                  <div
                    key={iso}
                    onClick={() => onOpenDay(iso)}
                    style={{ minWidth: MIN_COL }}
                    className={`flex-1 relative border-l border-slate-100 cursor-pointer hover:bg-slate-50/40 ${
                      isToday ? 'bg-brand-50/40 dark:bg-brand-500/10' : ''
                    }`}
                  >
                    {/* Hour gridlines */}
                    {hourLines.map((m) => (
                      <div
                        key={m}
                        className="absolute left-0 right-0 border-t border-slate-100"
                        style={{ top: (m - dayStart) * PX }}
                      />
                    ))}

                    {/* Current-time line (today only) */}
                    {isToday && now >= dayStart && now <= dayEnd && (
                      <div
                        className="absolute left-0 right-0 z-20 pointer-events-none"
                        style={{ top: (now - dayStart) * PX }}
                      >
                        <div className="absolute -left-0.5 -top-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                        <div className="h-px bg-red-500" />
                      </div>
                    )}

                    {/* Scheduled blocks */}
                    {(plan?.blocks ?? []).map((b) => (
                      <WeekBlock
                        key={b.id}
                        block={b}
                        top={(parseTime(b.start) - dayStart) * PX}
                        height={heights[b.id]}
                        fmt={fmt}
                      />
                    ))}

                    {!plan && (
                      <div className="absolute inset-x-0 top-2 text-center text-[10px] text-slate-300">
                        no plan
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <p className="text-[11px] text-slate-400 text-center">Tap any day to open and edit its plan.</p>
    </div>
  )
}

function WeekBlock({
  block,
  top,
  height,
  fmt,
}: {
  block: ScheduledBlock
  top: number
  height: number
  fmt: TimeFormat
}) {
  const s = BLOCK_STYLES[block.type] ?? BLOCK_STYLES.buffer
  const h = height
  // Scale the label to the box: tiny blocks get smaller, tighter text; very
  // short ones (< ~10px) show only the colour bar so text can't overflow.
  const showTitle = h >= 10
  const tiny = h < 24
  const showTime = h >= 34
  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded border overflow-hidden flex flex-col justify-center ${s.bg} ${
        block.done ? 'opacity-50' : ''
      } ${block.proposed ? 'border-dashed' : ''}`}
      style={{ top, height: h }}
      title={`${block.title} · ${displayTime(block.start, fmt)}–${displayTime(block.end, fmt)}`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${s.bar}`} />
      {showTitle && (
        <div
          className={`pl-1.5 pr-1 font-medium truncate ${
            tiny ? 'text-[9px] leading-none' : 'text-[10px] leading-tight'
          } ${block.done ? 'line-through text-slate-400' : 'text-slate-700'}`}
        >
          {block.title}
        </div>
      )}
      {showTime && (
        <div className="pl-1.5 pr-1 text-[9px] leading-none text-slate-400 tabular-nums truncate">
          {displayTime(block.start, fmt)}
        </div>
      )}
    </div>
  )
}
