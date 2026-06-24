import type { RecurringTask } from '../types'

/**
 * The weekdays (0=Sun … 6=Sat) a recurring task lands on.
 * - fixed: its explicit `days`.
 * - flexible: `preferredDays` first, then spread the remaining occurrences
 *   evenly across the week so e.g. gym 3×/week is nicely distributed.
 */
export function recurringDays(r: RecurringTask): number[] {
  if (r.scheduleType === 'fixed') return [...(r.days ?? [])].sort((a, b) => a - b)

  const n = Math.max(0, Math.min(7, Math.floor(r.timesPerWeek ?? 0)))
  if (n === 0) return []

  const chosen = new Set<number>((r.preferredDays ?? []).slice(0, n))
  for (let i = 0; chosen.size < n && i < 7; i++) {
    chosen.add(Math.round((i * 7) / n) % 7)
  }
  for (let d = 0; chosen.size < n && d < 7; d++) chosen.add(d)
  return [...chosen].sort((a, b) => a - b)
}

export function isRecurringDueOn(r: RecurringTask, date: Date): boolean {
  return recurringDays(r).includes(date.getDay())
}
