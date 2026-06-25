// Minimal iCalendar (.ics) parser for ToDoToday.
//
// Turns an exported .ics file (Outlook / Apple Calendar) into CalendarEvents the
// scheduler can plan around. This is intentionally a *pragmatic subset* of RFC
// 5545 — enough for the common appointment shapes those clients produce — not a
// full implementation.
//
// Supported: line unfolding, VEVENT blocks (SUMMARY/UID/DTSTART/DTEND), UTC ("Z")
// and TZID date-times, VALUE=DATE all-day events, and FREQ=DAILY/WEEKLY RRULEs
// with INTERVAL/COUNT/UNTIL/BYDAY.
//
// Deliberately NOT supported (skipped, never thrown on): VTIMEZONE definitions
// (TZID is treated as local wall-clock, see below), FREQ=MONTHLY/YEARLY,
// BYMONTHDAY/BYSETPOS and other advanced RRULE parts, EXDATE, and RECURRENCE-ID
// overrides. Anything unrecognised is ignored so a malformed event never breaks
// the whole import.

import type { CalendarEvent } from '../types'
import { isoDate, addDaysISO } from './date'

const HORIZON_DAYS = 60 // only expand recurrences within ~60 days of today

interface ParsedDate {
  date: string // "yyyy-MM-dd" (local)
  time?: string // "HH:mm" (local); absent for all-day VALUE=DATE
  allDay: boolean
}

/** Parse a `.ics` document into CalendarEvents. Never throws on bad input. */
export function parseICS(text: string): CalendarEvent[] {
  const lines = unfold(text)
  const events: CalendarEvent[] = []

  let inEvent = false
  let raw: Record<string, { value: string; params: Record<string, string> }> = {}

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true
      raw = {}
      continue
    }
    if (trimmed === 'END:VEVENT') {
      inEvent = false
      try {
        const built = buildEvents(raw)
        events.push(...built)
      } catch {
        // Defensive: skip a malformed VEVENT rather than aborting the import.
      }
      continue
    }
    if (!inEvent) continue

    const parsed = parseLine(line)
    if (parsed) raw[parsed.name] = { value: parsed.value, params: parsed.params }
  }

  return events
}

/**
 * RFC 5545 line unfolding: a CRLF (or LF) followed by a space or tab is a line
 * continuation — strip the break and the single leading whitespace char.
 */
function unfold(text: string): string[] {
  const physical = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of physical) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** Split a content line into name, params and value. e.g. `DTSTART;TZID=Europe/London:2026...` */
function parseLine(
  line: string,
): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const parts = head.split(';')
  const name = parts[0].toUpperCase()
  const params: Record<string, string> = {}
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=')
    if (eq === -1) continue
    params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1)
  }
  return { name, params, value }
}

/** Parse a DATE or DATE-TIME value into local date/time, honouring UTC ("Z") and VALUE=DATE. */
function parseDateValue(
  value: string,
  params: Record<string, string>,
): ParsedDate | null {
  const v = value.trim()

  // All-day: VALUE=DATE → bare "yyyymmdd".
  if (params.VALUE === 'DATE' || /^\d{8}$/.test(v)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
    if (!m) return null
    return { date: `${m[1]}-${m[2]}-${m[3]}`, allDay: true }
  }

  // Date-time: "yyyymmddThhmmss" optionally ending in "Z" (UTC).
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v)
  if (!m) return null
  const [, yy, mm, dd, hh, mi, , z] = m
  const y = Number(yy)
  const mon = Number(mm)
  const day = Number(dd)
  const hour = Number(hh)
  const min = Number(mi)

  if (z === 'Z') {
    // UTC instant → convert to the user's local date + wall-clock time.
    const utc = new Date(Date.UTC(y, mon - 1, day, hour, min))
    return {
      date: isoDate(utc),
      time: `${pad(utc.getHours())}:${pad(utc.getMinutes())}`,
      allDay: false,
    }
  }

  // Floating or TZID: treat the written wall-clock as local for v1. We do not
  // parse VTIMEZONE, so a TZID is taken at face value (correct when the file's
  // zone matches the user's; an acceptable approximation otherwise).
  return {
    date: `${yy}-${mm}-${dd}`,
    time: `${hh}:${mi}`,
    allDay: false,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Build one or more CalendarEvents from a collected VEVENT's properties. */
function buildEvents(
  raw: Record<string, { value: string; params: Record<string, string> }>,
): CalendarEvent[] {
  const dtstartRaw = raw.DTSTART
  if (!dtstartRaw) return [] // a VEVENT with no start is unusable — skip it.

  const start = parseDateValue(dtstartRaw.value, dtstartRaw.params)
  if (!start) return []

  const dtend = raw.DTEND ? parseDateValue(raw.DTEND.value, raw.DTEND.params) : null

  const title = raw.SUMMARY?.value?.trim() || 'Untitled event'
  const uid = raw.UID?.value?.trim()
  const notes = raw.DESCRIPTION?.value?.trim() || undefined

  // Resolve start/end times. For all-day events we record a short, non-destructive
  // marker (00:00–00:15) instead of a 00:00–23:59 block: the scheduler treats
  // events as *hard anchors*, so a full-day block would wipe out the day's
  // planning. The 15-minute marker keeps the event visible and recorded while
  // leaving the rest of the day free to schedule.
  let startTime: string
  let endTime: string
  if (start.allDay) {
    startTime = '00:00'
    endTime = '00:15'
  } else {
    startTime = start.time ?? '00:00'
    endTime = dtend?.time ?? addMinutes(startTime, 60) // default 1h if no DTEND.
    // If DTEND landed on a later day (overnight), clamp to end-of-day so the
    // anchor stays within the start date.
    if (dtend && !dtend.allDay && dtend.date > start.date) endTime = '23:59'
  }

  const base = (date: string, idSuffix?: string): CalendarEvent => ({
    id: '', // assigned by the store on import; left empty here.
    title,
    date,
    startTime,
    endTime,
    notes,
    source: 'import',
    allDay: start.allDay || undefined,
    externalId: uid ? (idSuffix ? `${uid}-${idSuffix}` : uid) : undefined,
  })

  const rrule = raw.RRULE?.value
  if (rrule) {
    const dates = expandRRule(rrule, start.date)
    // Each occurrence gets a derived externalId so re-imports dedupe per-date.
    return dates.map((d) => base(d, d))
  }

  return [base(start.date)]
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h || 0) * 60 + (m || 0) + mins
  const wrapped = Math.min(total, 24 * 60 - 1)
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`
}

const WEEKDAY_CODES: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
}

/**
 * Expand a DAILY or WEEKLY RRULE into occurrence dates within the planning
 * horizon (~60 days from today). Supports INTERVAL, COUNT, UNTIL and BYDAY.
 * Unsupported frequencies (MONTHLY/YEARLY/etc.) yield only the original date.
 */
function expandRRule(rrule: string, startDate: string): string[] {
  const parts: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const eq = seg.indexOf('=')
    if (eq === -1) continue
    parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1)
  }

  const freq = parts.FREQ?.toUpperCase()
  if (freq !== 'DAILY' && freq !== 'WEEKLY') {
    // Unsupported recurrence — keep just the seed occurrence (see file header).
    return [startDate]
  }

  const interval = Math.max(1, Number(parts.INTERVAL) || 1)
  const count = parts.COUNT ? Math.max(1, Number(parts.COUNT)) : undefined
  const until = parts.UNTIL ? parseUntil(parts.UNTIL) : undefined
  const byDay = parts.BYDAY
    ? parts.BYDAY.split(',')
        .map((c) => WEEKDAY_CODES[c.trim().toUpperCase().slice(-2)])
        .filter((n) => n !== undefined)
    : undefined

  const today = isoDate()
  const windowStart = addDaysISO(today, -1)
  const windowEnd = addDaysISO(today, HORIZON_DAYS)

  const out: string[] = []
  let emitted = 0

  if (freq === 'DAILY') {
    // Step day-by-day at the given interval.
    for (let i = 0; i < HORIZON_DAYS + 366; i++) {
      const d = addDaysISO(startDate, i * interval)
      if (until && d > until) break
      if (count !== undefined && emitted >= count) break
      emitted++
      if (d >= windowStart && d <= windowEnd) out.push(d)
      if (d > windowEnd && (count === undefined || emitted >= count)) break
    }
    return out
  }

  // WEEKLY. Walk one day at a time; the start-of-week is anchored on startDate.
  const days = byDay && byDay.length ? byDay : [weekdayOf(startDate)]
  const startWeek = weekIndex(startDate, startDate)
  for (let i = 0; i < HORIZON_DAYS + 366; i++) {
    const d = addDaysISO(startDate, i)
    if (until && d > until) break
    const wd = weekdayOf(d)
    if (!days.includes(wd)) continue
    const wk = weekIndex(startDate, d)
    if ((wk - startWeek) % interval !== 0) continue
    if (d < startDate) continue
    if (count !== undefined && emitted >= count) break
    emitted++
    if (d >= windowStart && d <= windowEnd) out.push(d)
    if (d > windowEnd) break
  }
  return out
}

/** Parse an RRULE UNTIL value (date or date-time, possibly UTC) to a "yyyy-MM-dd". */
function parseUntil(value: string): string | undefined {
  const parsed = parseDateValue(value, {})
  return parsed?.date
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Whole-week index of `iso` relative to an anchor, so WEEKLY INTERVAL can stride weeks. */
function weekIndex(anchorISO: string, iso: string): number {
  const [ay, am, ad] = anchorISO.split('-').map(Number)
  const [y, m, d] = iso.split('-').map(Number)
  const anchor = new Date(ay, am - 1, ad).getTime()
  const cur = new Date(y, m - 1, d).getTime()
  return Math.floor((cur - anchor) / (7 * 24 * 60 * 60 * 1000))
}
