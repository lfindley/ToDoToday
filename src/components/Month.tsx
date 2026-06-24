import { useState } from 'react'
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth } from 'date-fns'
import { useStore } from '../store/useStore'
import { isoDate } from '../utils/date'
import { summariseDay, daySegments } from '../engine/daySummary'
import { Button, Card, CapacityBar, Legend } from './ui'

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Month({ onOpenDay }: { onOpenDay: (iso: string) => void }) {
  const todayDate = new Date()
  const [monthDate, setMonthDate] = useState(startOfMonth(todayDate))

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

  // 6-week grid (42 cells) starting on the Monday on/before the 1st.
  const first = startOfMonth(monthDate)
  const gridStart = addDays(first, -((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setMonthDate(addMonths(monthDate, -1))}>
          ←
        </Button>
        <div className="text-center">
          <div className="font-semibold text-slate-800">{format(monthDate, 'MMMM yyyy')}</div>
          {!isSameMonth(monthDate, todayDate) && (
            <button
              onClick={() => setMonthDate(startOfMonth(todayDate))}
              className="text-xs text-brand-600 hover:underline"
            >
              this month
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setMonthDate(addMonths(monthDate, 1))}>
          →
        </Button>
      </div>

      <Card className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d} className="text-center text-[11px] font-medium text-slate-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const iso = isoDate(cell)
            const inMonth = isSameMonth(cell, monthDate)
            const isToday = isSameDay(cell, todayDate)
            const d = summariseDay(iso, summaryState)
            const deadlineInfeasible = d.deadlines.some((t) => infeasibleIds.has(t.id))
            const taskCount = Object.keys(d.planTaskMap).length

            return (
              <button
                key={iso}
                onClick={() => onOpenDay(iso)}
                className={`text-left rounded-lg border p-1 min-h-[64px] sm:min-h-[84px] flex flex-col gap-1 transition-colors ${
                  inMonth ? 'bg-white border-slate-200 hover:bg-slate-50' : 'bg-slate-50/60 border-transparent'
                } ${isToday ? 'ring-2 ring-brand-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? 'text-brand-700' : inMonth ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    {cell.getDate()}
                  </span>
                  {inMonth && d.deadlines.length > 0 && (
                    <span
                      className={`text-[10px] font-semibold px-1 rounded leading-tight ${
                        deadlineInfeasible ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}
                      title={d.deadlines.map((t) => t.title).join(', ')}
                    >
                      📅{d.deadlines.length}
                    </span>
                  )}
                </div>

                {inMonth && <CapacityBar segments={daySegments(d)} total={d.waking} height="h-1.5" />}

                {inMonth && (
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] leading-none">
                    {d.events.length > 0 && (
                      <span className="text-rose-600" title={d.events.map((e) => e.title).join(', ')}>
                        📍{d.events.length}
                      </span>
                    )}
                    {d.fixed.length > 0 && <span title="Fixed commitment">📌</span>}
                    {d.flex.length > 0 && <span title="Recurring">🔁</span>}
                    {taskCount > 0 && (
                      <span className="text-sky-700 font-medium" title="Scheduled tasks">
                        📝{taskCount}
                      </span>
                    )}
                    {d.overcommitted && (
                      <span className="text-red-600" title="Over-committed">
                        ⚠
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </Card>

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
        <p className="text-[11px] text-slate-400 mt-2">Tap any day to open and edit its plan.</p>
      </Card>
    </div>
  )
}
