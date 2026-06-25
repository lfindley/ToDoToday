// Time math helpers. Times are "HH:mm" strings; internally we work in
// minutes-from-midnight integers.

import type { TimeFormat } from '../types'

export interface Interval {
  start: number // minutes from midnight
  end: number
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function formatTime(mins: number): string {
  const wrapped = ((Math.round(mins) % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDuration(mins: number): string {
  const total = Math.round(mins)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

/**
 * Format a stored "HH:mm" clock string for *display* in the user's chosen
 * format. The stored value always stays 24h "HH:mm" — this only affects what
 * the user sees. Defaults to 24h so callers without a preference are safe.
 */
export function displayTime(hhmm: string, fmt: TimeFormat = '24h'): string {
  if (fmt !== '12h') return hhmm
  const mins = parseTime(hhmm)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** Compact on-the-hour label for calendar gridlines: "14:00" or "2pm". */
export function displayHour(mins: number, fmt: TimeFormat = '24h'): string {
  const wrapped = (((Math.round(mins) % (24 * 60)) + 24 * 60) % (24 * 60))
  const h = Math.floor(wrapped / 60)
  if (fmt === '12h') {
    const period = h < 12 ? 'am' : 'pm'
    return `${h % 12 === 0 ? 12 : h % 12}${period}`
  }
  return `${String(h).padStart(2, '0')}:00`
}

/** Subtract occupied intervals from [start,end] and return the free gaps. */
export function computeGaps(start: number, end: number, occupied: Interval[]): Interval[] {
  const sorted = occupied
    .map((o) => ({ start: Math.max(o.start, start), end: Math.min(o.end, end) }))
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start - b.start)
  const gaps: Interval[] = []
  let cursor = start
  for (const o of sorted) {
    if (o.start > cursor) gaps.push({ start: cursor, end: o.start })
    cursor = Math.max(cursor, o.end)
  }
  if (cursor < end) gaps.push({ start: cursor, end })
  return gaps
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

export function sumIntervals(intervals: Interval[]): number {
  return intervals.reduce((acc, i) => acc + (i.end - i.start), 0)
}

/**
 * Reserve `duration` minutes from the earliest point in `gaps` that also lies
 * within the optional window [winLo, winHi]. Mutates `gaps` (splitting the
 * consumed gap). Returns the reserved interval, or null if nothing fits.
 */
export function reserve(
  gaps: Interval[],
  duration: number,
  winLo = -Infinity,
  winHi = Infinity,
): Interval | null {
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i]
    const lo = Math.max(g.start, winLo)
    const hi = Math.min(g.end, winHi)
    if (hi - lo >= duration) {
      const res: Interval = { start: lo, end: lo + duration }
      const replacement: Interval[] = []
      if (res.start > g.start) replacement.push({ start: g.start, end: res.start })
      if (g.end > res.end) replacement.push({ start: res.end, end: g.end })
      gaps.splice(i, 1, ...replacement)
      return res
    }
  }
  return null
}

/** Largest block (within an optional window) that any single gap can currently offer. */
export function largestFit(gaps: Interval[], winLo = -Infinity, winHi = Infinity): number {
  let best = 0
  for (const g of gaps) {
    const lo = Math.max(g.start, winLo)
    const hi = Math.min(g.end, winHi)
    best = Math.max(best, hi - lo)
  }
  return best
}
