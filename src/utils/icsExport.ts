// Minimal iCalendar (.ics) generator for ToDoToday — the counterpart to the
// importer in `ics.ts`. Turns a planned day (or a span of days) into a
// VCALENDAR the user can import into Outlook / Apple / Google Calendar.
//
// Times are emitted as *floating local* date-times (no TZID / no "Z"), matching
// how the importer reads them back, so an export round-trips through parseICS.
// Output is RFC-5545-shaped: CRLF line endings, TEXT escaping, and folding of
// long lines at 75 chars (a pragmatic char-based approximation of the spec's
// octet folding — fine for the short titles a plan produces).

import type { DayPlan, ScheduledBlock } from '../types'
import { addDaysISO } from './date'
import { parseTime } from './time'

// Internal breathing-room blocks aren't worth a calendar entry.
const SKIP_TYPES = new Set<ScheduledBlock['type']>(['buffer'])

/** Build a `.ics` document from one or more day plans. */
export function plansToICS(plans: DayPlan[], calendarName?: string): string {
  const stamp = icsTimestampUTC()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ToDoToday//Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  if (calendarName) lines.push(`X-WR-CALNAME:${escapeText(calendarName)}`)

  for (const plan of plans) {
    for (const b of plan.blocks) {
      if (SKIP_TYPES.has(b.type)) continue
      const startMin = parseTime(b.start)
      let endMin = parseTime(b.end)
      if (endMin <= startMin) endMin += 24 * 60 // block runs to/past midnight

      lines.push(
        'BEGIN:VEVENT',
        `UID:${blockUID(plan.date, b)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDateTime(plan.date, startMin)}`,
        `DTEND:${icsDateTime(plan.date, endMin)}`,
        `SUMMARY:${escapeText(b.title)}`,
      )
      if (b.suggestion) lines.push(`DESCRIPTION:${escapeText(b.suggestion)}`)
      lines.push(`CATEGORIES:${b.type}`, 'END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Count of blocks `plansToICS` would actually emit (for disabling an empty export). */
export function exportableBlockCount(plans: DayPlan[]): number {
  return plans.reduce((n, p) => n + p.blocks.filter((b) => !SKIP_TYPES.has(b.type)).length, 0)
}

/** A stable, file-unique UID so re-exporting the same plan dedupes on re-import. */
function blockUID(dateISO: string, b: ScheduledBlock): string {
  const key = b.refId ?? slug(b.title)
  return `${dateISO}-${parseTime(b.start)}-${key}@todotoday`
}

/** Floating local date-time "yyyymmddThhmmss", rolling the date over past midnight. */
function icsDateTime(dateISO: string, minutes: number): string {
  let date = dateISO
  let mins = minutes
  while (mins >= 24 * 60) {
    mins -= 24 * 60
    date = addDaysISO(date, 1)
  }
  const [y, m, d] = date.split('-')
  return `${y}${m}${d}T${pad(Math.floor(mins / 60))}${pad(mins % 60)}00`
}

/** UTC timestamp for DTSTAMP: "yyyymmddThhmmssZ". */
function icsTimestampUTC(now: Date = new Date()): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T` +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

/** Escape a TEXT value per RFC 5545 (backslash, semicolon, comma, newline). */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Fold a content line longer than 75 chars into space-prefixed continuations. */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const out: string[] = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 0) {
    out.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return out.join('\r\n')
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'block'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
