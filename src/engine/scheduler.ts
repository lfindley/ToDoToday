import type {
  Budgets,
  CalendarEvent,
  DayPlan,
  DayTemplate,
  Hemisphere,
  RecurringTask,
  ScheduledBlock,
  Task,
  TimeWindow,
} from '../types'
import { uid } from '../utils/id'
import { addDaysISO, isoDate, isoToDate } from '../utils/date'
import {
  computeGaps,
  formatTime,
  largestFit,
  parseTime,
  reserve,
  type Interval,
} from '../utils/time'
import { isRecurringDueOn } from './recurrence'
import { suggestActivities } from './suggestions'

const MIN_CHUNK = 15 // smallest block we'll schedule (minutes)

/** Day-invariant context shared across every day of a horizon. */
export interface PlanContext {
  recurring: RecurringTask[]
  events?: CalendarEvent[]
  template: DayTemplate
  budgets: Budgets
  interestKeys: string[]
  hemisphere: Hemisphere
  bufferMinutes: number
}

/** Single-day input (kept for the `generateDayPlan` wrapper + unit tests). */
export interface SchedulerInput extends PlanContext {
  tasks: Task[]
  lockedBlocks?: ScheduledBlock[]
}

/** Multi-day input. `lockedByDate` preserves user-edited blocks per date. */
export interface HorizonInput extends PlanContext {
  tasks: Task[]
  lockedByDate?: Record<string, ScheduledBlock[]>
}

function mkBlock(
  type: ScheduledBlock['type'],
  title: string,
  start: number,
  end: number,
  extra: Partial<ScheduledBlock> = {},
): ScheduledBlock {
  return { id: uid('blk'), type, title, start: formatTime(start), end: formatTime(end), ...extra }
}

/** Intersect an optional time window with the waking window, in minutes. */
function windowBounds(w: TimeWindow | undefined, dayStart: number, dayEnd: number): [number, number] {
  const lo = w?.earliest ? Math.max(dayStart, parseTime(w.earliest)) : dayStart
  const hi = w?.latest ? Math.min(dayEnd, parseTime(w.latest)) : dayEnd
  return [lo, hi]
}

/** Ordering: deadline urgency → priority (higher first) → age. */
export function taskOrder(a: Task, b: Task): number {
  const da = a.deadline ?? '9999-12-31'
  const db = b.deadline ?? '9999-12-31'
  if (da !== db) return da < db ? -1 : 1
  if (a.priority !== b.priority) return b.priority - a.priority
  return a.createdAt < b.createdAt ? -1 : 1
}

/** Incomplete tasks with work left, ordered for scheduling. */
export function buildTaskQueue(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.completed && t.remainingMinutes > 0).sort(taskOrder)
}

/**
 * Plan one day. `remaining` is a *working copy* of each task's minutes-left; it
 * is decremented as task time is placed, so a horizon loop can carry leftover
 * work to the next day. The real Task.remainingMinutes is never touched here.
 */
export function planSingleDay(
  dateISO: string,
  ctx: PlanContext,
  tasks: Task[],
  remaining: Map<string, number>,
  lockedBlocks: ScheduledBlock[] = [],
): DayPlan {
  const date = isoToDate(dateISO)
  const weekday = date.getDay()
  const todayISO = isoDate()
  const warnings: string[] = []
  const blocks: ScheduledBlock[] = []

  const wake = parseTime(ctx.template.sleep.wakeTime)
  const bedRaw = parseTime(ctx.template.sleep.bedtime)
  const dayStart = wake
  const dayEnd = bedRaw > wake ? bedRaw : 24 * 60

  // 1. Hard anchors: carried-over locked blocks, meals, and fixed commitments.
  const anchorIntervals: Interval[] = []

  for (const b of lockedBlocks) {
    blocks.push({ ...b })
    anchorIntervals.push({ start: parseTime(b.start), end: parseTime(b.end) })
    // A locked task block already covers some of that task's work today.
    if (b.type === 'task' && b.refId && remaining.has(b.refId)) {
      const dur = parseTime(b.end) - parseTime(b.start)
      remaining.set(b.refId, Math.max(0, (remaining.get(b.refId) ?? 0) - dur))
    }
  }

  // Top-priority hard anchors: one-off events on this date.
  const eventsToday = (ctx.events ?? []).filter((e) => e.date === dateISO)
  const eventIntervals: Interval[] = eventsToday.map((e) => ({
    start: parseTime(e.startTime),
    end: parseTime(e.endTime),
  }))
  for (const e of eventsToday) {
    const s = parseTime(e.startTime)
    const en = parseTime(e.endTime)
    blocks.push(mkBlock('event', e.title, s, en, { refId: e.id }))
    anchorIntervals.push({ start: s, end: en })
  }

  // Meals, split around events.
  const mealIntervals: Interval[] = []
  for (const meal of ctx.template.meals) {
    const ms = parseTime(meal.time)
    const me = ms + meal.durationMinutes
    for (const seg of computeGaps(ms, me, eventIntervals)) {
      blocks.push(mkBlock('meal', meal.name, seg.start, seg.end, { refId: meal.id }))
      anchorIntervals.push(seg)
      mealIntervals.push(seg)
    }
  }

  // Fixed commitments, split around events + meals.
  for (const r of ctx.recurring) {
    if (r.scheduleType === 'fixed' && (r.days ?? []).includes(weekday) && r.startTime && r.endTime) {
      const cs = parseTime(r.startTime)
      const ce = parseTime(r.endTime)
      for (const seg of computeGaps(cs, ce, [...eventIntervals, ...mealIntervals])) {
        blocks.push(mkBlock('recurring', r.title, seg.start, seg.end, { refId: r.id }))
        anchorIntervals.push(seg)
      }
    }
  }

  // 2. Free gaps in the waking window, minus all hard anchors.
  const gaps = computeGaps(dayStart, dayEnd, anchorIntervals)

  // 3. Flexible recurring due today (e.g. gym 3×/week).
  for (const r of ctx.recurring) {
    if (r.scheduleType !== 'flexible' || !isRecurringDueOn(r, date)) continue
    const dur = Math.max(MIN_CHUNK, r.durationMinutes ?? 30)
    const [lo, hi] = windowBounds(r.window, dayStart, dayEnd)
    const res = reserve(gaps, dur, lo, hi)
    if (res) blocks.push(mkBlock('recurring', r.title, res.start, res.end, { refId: r.id }))
    else warnings.push(`Couldn't fit “${r.title}” today.`)
  }

  // 4 & 5. Fill the productive budget with tasks, carrying leftover via `remaining`.
  const queue = tasks
    .filter((t) => !t.completed && (remaining.get(t.id) ?? 0) >= MIN_CHUNK)
    // Don't schedule work after a (still-future) deadline; overdue tasks schedule asap.
    .filter((t) => !t.deadline || dateISO <= t.deadline || t.deadline < todayISO)
    .sort(taskOrder)

  const budget = ctx.budgets.productiveMinutesPerDay
  let usedProductive = 0
  for (const task of queue) {
    if (usedProductive >= budget) break
    const left = remaining.get(task.id) ?? 0
    const cap = Math.min(left, task.maxPerDayMinutes ?? Infinity, budget - usedProductive)
    if (cap < MIN_CHUNK) continue

    const [lo, hi] = windowBounds(task.window, dayStart, dayEnd)
    let need = cap
    let placedAny = false
    while (need >= MIN_CHUNK) {
      const fit = Math.min(need, largestFit(gaps, lo, hi))
      if (fit < MIN_CHUNK) break
      const res = reserve(gaps, fit, lo, hi)
      if (!res) break
      blocks.push(mkBlock('task', task.title, res.start, res.end, { refId: task.id }))
      usedProductive += fit
      need -= fit
      remaining.set(task.id, (remaining.get(task.id) ?? 0) - fit)
      placedAny = true
      if (ctx.bufferMinutes > 0) reserve(gaps, ctx.bufferMinutes, res.end, hi)
    }
    if (!placedAny && task.window) {
      warnings.push(`Couldn't place “${task.title}” within its time window today.`)
    }
  }

  // 6. Free time: fill up to the free budget, each block tagged with a suggestion.
  const suggestions = suggestActivities(ctx.interestKeys, date, ctx.hemisphere, 8)
  const freeBudget = ctx.budgets.freeMinutesPerDay
  let usedFree = 0
  let sIdx = 0
  while (usedFree < freeBudget) {
    const big = largestFit(gaps)
    if (big < MIN_CHUNK) break
    const take = Math.min(freeBudget - usedFree, big)
    if (take < MIN_CHUNK) break
    const res = reserve(gaps, take)
    if (!res) break
    const suggestion = suggestions.length ? suggestions[sIdx % suggestions.length] : undefined
    sIdx++
    blocks.push(mkBlock('free', 'Free time', res.start, res.end, { suggestion }))
    usedFree += take
  }

  // 7. Sanity warnings.
  const waking = dayEnd - dayStart
  if (budget + freeBudget > waking) {
    warnings.push('Your productive + free budgets together exceed your waking hours.')
  }

  blocks.sort((a, b) => parseTime(a.start) - parseTime(b.start))
  return { date: dateISO, blocks, generatedAt: new Date().toISOString(), warnings }
}

/** Plan a single day independently (each task starts from its full remaining). */
export function generateDayPlan(dateISO: string, input: SchedulerInput): DayPlan {
  const remaining = new Map(input.tasks.map((t) => [t.id, t.remainingMinutes]))
  return planSingleDay(dateISO, input, input.tasks, remaining, input.lockedBlocks ?? [])
}

/**
 * Plan `days` consecutive days starting at `fromISO`, carrying each task's
 * leftover minutes from one day to the next so long tasks spread across days
 * and finish before their deadlines (capacity permitting).
 */
export function planHorizon(fromISO: string, days: number, input: HorizonInput): Record<string, DayPlan> {
  const remaining = new Map(
    input.tasks.filter((t) => !t.completed).map((t) => [t.id, t.remainingMinutes]),
  )
  const out: Record<string, DayPlan> = {}
  for (let i = 0; i < days; i++) {
    const dateISO = addDaysISO(fromISO, i)
    out[dateISO] = planSingleDay(dateISO, input, input.tasks, remaining, input.lockedByDate?.[dateISO] ?? [])
  }
  return out
}
