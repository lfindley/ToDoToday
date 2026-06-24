import type { Budgets, CalendarEvent, DayPlan, DayTemplate, RecurringTask, Task } from '../types'
import { computeGaps, formatDuration, parseTime, sumIntervals, type Interval } from '../utils/time'
import { isRecurringDueOn } from './recurrence'
import { isoToDate } from '../utils/date'

export interface DaySummaryState {
  tasks: Task[]
  recurring: RecurringTask[]
  events: CalendarEvent[]
  template: DayTemplate
  budgets: Budgets
  dayPlans: Record<string, DayPlan>
}

export interface DaySummary {
  iso: string
  date: Date
  weekday: number
  waking: number
  committedMin: number // meals + fixed commitments
  recurringMin: number // flexible recurring due that day
  fixed: RecurringTask[]
  flex: RecurringTask[]
  events: CalendarEvent[]
  deadlines: Task[]
  planned: boolean
  planTaskMin: number
  planFreeMin: number
  planTaskMap: Record<string, number> // task title → scheduled minutes that day
  prodShown: number // actual scheduled tasks if planned, else budget projection
  freeShown: number
  slack: number
  afterFixed: number
  overcommitted: boolean
}

/** Compute a single day's overview, shared by the Week and Month views. */
export function summariseDay(iso: string, s: DaySummaryState): DaySummary {
  const date = isoToDate(iso)
  const weekday = date.getDay()

  const wake = parseTime(s.template.sleep.wakeTime)
  const bed0 = parseTime(s.template.sleep.bedtime)
  const bed = bed0 > wake ? bed0 : 24 * 60
  const waking = bed - wake

  const mealIntervals: Interval[] = s.template.meals.map((m) => ({
    start: parseTime(m.time),
    end: parseTime(m.time) + m.durationMinutes,
  }))
  const eventsToday = s.events.filter((e) => e.date === iso)
  const eventIntervals: Interval[] = eventsToday.map((e) => ({
    start: parseTime(e.startTime),
    end: parseTime(e.endTime),
  }))

  const fixed = s.recurring.filter((r) => r.scheduleType === 'fixed' && (r.days ?? []).includes(weekday))
  const fixedIntervals: Interval[] = fixed.map((r) => ({
    start: parseTime(r.startTime!),
    end: parseTime(r.endTime!),
  }))
  const flex = s.recurring.filter((r) => r.scheduleType === 'flexible' && isRecurringDueOn(r, date))
  const recurringMin = flex.reduce((a, r) => a + (r.durationMinutes ?? 0), 0)
  const deadlines = s.tasks.filter((t) => !t.completed && t.deadline === iso)

  // True committed time = union of events, meals and fixed commitments.
  const occupied = [...eventIntervals, ...mealIntervals, ...fixedIntervals]
  const committedMin = waking - sumIntervals(computeGaps(wake, bed, occupied))
  const afterFixed = Math.max(0, waking - committedMin)
  const remForBudgets = Math.max(0, afterFixed - recurringMin)

  const plan = s.dayPlans[iso]
  const planTaskMap: Record<string, number> = {}
  let planTaskMin = 0
  let planFreeMin = 0
  if (plan) {
    for (const b of plan.blocks) {
      const dur = parseTime(b.end) - parseTime(b.start)
      if (b.type === 'task') {
        planTaskMin += dur
        planTaskMap[b.title] = (planTaskMap[b.title] ?? 0) + dur
      } else if (b.type === 'free') planFreeMin += dur
    }
  }

  const prodShown = plan ? planTaskMin : Math.min(s.budgets.productiveMinutesPerDay, remForBudgets)
  const freeShown = plan
    ? planFreeMin
    : Math.min(s.budgets.freeMinutesPerDay, Math.max(0, remForBudgets - prodShown))
  const slack = Math.max(0, waking - committedMin - recurringMin - prodShown - freeShown)
  const overcommitted =
    recurringMin + s.budgets.productiveMinutesPerDay + s.budgets.freeMinutesPerDay > afterFixed

  return {
    iso,
    date,
    weekday,
    waking,
    committedMin,
    recurringMin,
    fixed,
    flex,
    events: eventsToday,
    deadlines,
    planned: !!plan,
    planTaskMin,
    planFreeMin,
    planTaskMap,
    prodShown,
    freeShown,
    slack,
    afterFixed,
    overcommitted,
  }
}

export interface BarSegment {
  min: number
  color: string
  label: string
}

/** Stacked capacity-bar segments for a day, scaled against waking minutes. */
export function daySegments(d: DaySummary): BarSegment[] {
  return [
    { min: d.committedMin, color: 'bg-slate-400', label: `Meals & commitments · ${formatDuration(d.committedMin)}` },
    { min: d.recurringMin, color: 'bg-violet-400', label: `Recurring · ${formatDuration(d.recurringMin)}` },
    { min: d.prodShown, color: 'bg-sky-500', label: `Tasks · ${formatDuration(d.prodShown)}` },
    { min: d.freeShown, color: 'bg-emerald-400', label: `Free · ${formatDuration(d.freeShown)}` },
    { min: d.slack, color: 'bg-slate-100', label: `Slack · ${formatDuration(d.slack)}` },
  ]
}
