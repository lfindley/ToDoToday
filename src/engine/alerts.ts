import { differenceInCalendarDays } from 'date-fns'
import type { Alert, AlertKind, Budgets, Task } from '../types'
import { uid } from '../utils/id'
import { isoToDate } from '../utils/date'

export interface AlertInput {
  tasks: Task[]
  budgets: Budgets
  todayISO: string
  existing: Alert[]
}

function fmtHours(mins: number): string {
  const h = mins / 60
  const rounded = Math.round(h * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`
}

function make(taskId: string, kind: AlertKind, forDate: string, message: string): Alert {
  return {
    id: uid('alert'),
    taskId,
    kind,
    message,
    forDate,
    createdAt: new Date().toISOString(),
    dismissed: false,
    notified: false,
  }
}

/**
 * Recompute the live alert set for `todayISO`:
 *  - infeasible: a task whose work can't fit before its deadline given the daily
 *    productive budget (cumulative earliest-deadline-first capacity check).
 *  - reminders: 2 days before / 1 day before / on the deadline.
 * Existing dismissed/notified state is preserved for matching alerts.
 */
export function computeAlerts({ tasks, budgets, todayISO, existing }: AlertInput): Alert[] {
  const today = isoToDate(todayISO)
  const open = tasks.filter((t) => !t.completed && t.remainingMinutes > 0)
  const result: Alert[] = []

  // Feasibility — earliest-deadline-first cumulative capacity.
  const perDay = Math.max(0, budgets.productiveMinutesPerDay)
  const withDeadline = open
    .filter((t) => t.deadline)
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : a.deadline! > b.deadline! ? 1 : 0))

  let cumulative = 0
  for (const t of withDeadline) {
    cumulative += t.remainingMinutes
    const daysAvail = Math.max(0, differenceInCalendarDays(isoToDate(t.deadline!), today) + 1)
    const capacity = daysAvail * perDay
    if (cumulative > capacity) {
      result.push(
        make(
          t.id,
          'infeasible',
          todayISO,
          `Not enough time to finish “${t.title}” by ${t.deadline} — short by ${fmtHours(
            cumulative - capacity,
          )}.`,
        ),
      )
    }
  }

  // Deadline reminders.
  for (const t of open) {
    if (!t.deadline) continue
    const d = differenceInCalendarDays(isoToDate(t.deadline), today)
    if (d === 2) result.push(make(t.id, 'reminder-2d', todayISO, `“${t.title}” is due in 2 days (${t.deadline}).`))
    else if (d === 1) result.push(make(t.id, 'reminder-1d', todayISO, `“${t.title}” is due tomorrow (${t.deadline}).`))
    else if (d === 0) result.push(make(t.id, 'reminder-today', todayISO, `“${t.title}” is due today.`))
  }

  // Preserve dismissed/notified state across recomputes.
  const keyOf = (a: Alert) => `${a.taskId}|${a.kind}|${a.forDate}`
  const prev = new Map(existing.map((a) => [keyOf(a), a]))
  return result.map((a) => {
    const old = prev.get(keyOf(a))
    return old ? { ...a, id: old.id, dismissed: old.dismissed, notified: old.notified } : a
  })
}
