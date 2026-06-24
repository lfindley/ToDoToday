import { useState } from 'react'
import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import { addDaysISO, isoDate, isoToDate } from '../utils/date'
import { formatDuration } from '../utils/time'
import { summariseDay, daySegments } from '../engine/daySummary'
import { Button, Card, CapacityBar, Legend } from './ui'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function mondayOf(iso: string): string {
  const day = isoToDate(iso).getDay() // 0 Sun … 6 Sat
  return addDaysISO(iso, -((day + 6) % 7))
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
  const alerts = useStore((s) => s.alerts)
  const replan = useStore((s) => s.replan)

  const summaryState = { tasks, recurring, events, template, budgets, dayPlans }
  const infeasibleIds = new Set(
    alerts.filter((a) => a.kind === 'infeasible' && !a.dismissed).map((a) => a.taskId),
  )

  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
  const weekEnd = days[6]

  return (
    <div className="space-y-4">
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
            <Legend color="bg-slate-100 border border-slate-200" label="Slack" />
          </div>
          <Button onClick={() => replan()} className="shrink-0">
            Re-plan
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {days.map((iso) => {
          const d = summariseDay(iso, summaryState)
          const isToday = iso === today
          return (
            <Card
              key={iso}
              className={`p-3 cursor-pointer hover:shadow transition-shadow ${isToday ? 'ring-2 ring-brand-500' : ''}`}
            >
              <div onClick={() => onOpenDay(iso)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-slate-800">{WEEKDAYS[d.weekday]}</span>
                    <span className="text-xs text-slate-400">{format(d.date, 'd MMM')}</span>
                    {isToday && (
                      <span className="text-[10px] font-semibold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded">
                        today
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {d.planned ? `✓ ${formatDuration(d.planTaskMin)} tasks` : `${formatDuration(d.afterFixed)} free`}
                  </div>
                </div>

                <CapacityBar segments={daySegments(d)} total={d.waking} />

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {d.events.map((e) => (
                    <Chip key={e.id} color="rose">
                      📍 {e.title} {e.startTime}–{e.endTime}
                    </Chip>
                  ))}
                  {d.fixed.map((r) => (
                    <Chip key={r.id} color="violet">
                      📌 {r.title} {r.startTime}–{r.endTime}
                    </Chip>
                  ))}
                  {d.flex.map((r) => (
                    <Chip key={r.id} color="violet">
                      🔁 {r.title} · {formatDuration(r.durationMinutes ?? 0)}
                    </Chip>
                  ))}
                  {Object.entries(d.planTaskMap).map(([title, mins]) => (
                    <Chip key={title} color="sky">
                      📝 {title} · {formatDuration(mins)}
                    </Chip>
                  ))}
                  {d.deadlines.map((t) => (
                    <Chip key={t.id} color={infeasibleIds.has(t.id) ? 'red' : 'amber'}>
                      📅 due: {t.title}
                      {infeasibleIds.has(t.id) ? ' ⚠' : ''}
                    </Chip>
                  ))}
                  {d.overcommitted && <Chip color="red">⚠ over-committed</Chip>}
                  {d.events.length === 0 &&
                    d.fixed.length === 0 &&
                    d.flex.length === 0 &&
                    d.deadlines.length === 0 &&
                    Object.keys(d.planTaskMap).length === 0 &&
                    !d.overcommitted && (
                      <span className="text-[11px] text-slate-400">No commitments or deadlines</span>
                    )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Chip({
  color,
  children,
}: {
  color: 'violet' | 'amber' | 'red' | 'sky' | 'rose'
  children: React.ReactNode
}) {
  const styles: Record<string, string> = {
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  }
  return <span className={`text-[11px] px-1.5 py-0.5 rounded border ${styles[color]}`}>{children}</span>
}
