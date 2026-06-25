import { describe, it, expect } from 'vitest'
import { parseICS } from '../utils/ics'
import { isoDate, addDaysISO } from '../utils/date'

// Helpers to build dated fixtures relative to "today" so RRULE expansion (which
// is clipped to a ~60-day horizon) always has occurrences to emit.
function compact(iso: string): string {
  return iso.replace(/-/g, '')
}
const inDays = (n: number) => addDaysISO(isoDate(), n)

function wrap(vevent: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//EN',
    vevent.trim(),
    'END:VCALENDAR',
  ].join('\r\n')
}

describe('parseICS', () => {
  it('parses a normal timed event with TZID (local wall-clock)', () => {
    const day = inDays(2)
    const ics = wrap(`
BEGIN:VEVENT
UID:abc-123@example.com
SUMMARY:Dentist appointment
DTSTART;TZID=Europe/London:${compact(day)}T140000
DTEND;TZID=Europe/London:${compact(day)}T150000
END:VEVENT`)
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    const e = events[0]
    expect(e.title).toBe('Dentist appointment')
    expect(e.externalId).toBe('abc-123@example.com')
    expect(e.date).toBe(day)
    expect(e.startTime).toBe('14:00')
    expect(e.endTime).toBe('15:00')
    expect(e.source).toBe('import')
    expect(e.allDay).toBeUndefined()
  })

  it('converts a UTC ("Z") event to local time', () => {
    const day = inDays(3)
    const ics = wrap(`
BEGIN:VEVENT
UID:utc-1
SUMMARY:Standup
DTSTART:${compact(day)}T140000Z
DTEND:${compact(day)}T143000Z
END:VEVENT`)
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    const e = events[0]
    // Recompute the expected local wall-clock from the same UTC instant.
    const [y, m, d] = day.split('-').map(Number)
    const utc = new Date(Date.UTC(y, m - 1, d, 14, 0))
    const expected = `${String(utc.getHours()).padStart(2, '0')}:${String(utc.getMinutes()).padStart(2, '0')}`
    expect(e.startTime).toBe(expected)
    expect(e.title).toBe('Standup')
  })

  it('marks an all-day VALUE=DATE event non-destructively', () => {
    const day = inDays(4)
    const ics = wrap(`
BEGIN:VEVENT
UID:allday-1
SUMMARY:Holiday
DTSTART;VALUE=DATE:${compact(day)}
DTEND;VALUE=DATE:${compact(inDays(5))}
END:VEVENT`)
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    const e = events[0]
    expect(e.allDay).toBe(true)
    expect(e.date).toBe(day)
    // A short marker, not a full-day block, so it never wipes the day's plan.
    expect(e.startTime).toBe('00:00')
    expect(e.endTime).toBe('00:15')
  })

  it('unfolds continuation lines', () => {
    const day = inDays(1)
    const ics = wrap(`
BEGIN:VEVENT
UID:fold-1
SUMMARY:A very long meeting title that spans
  multiple physical lines
DTSTART:${compact(day)}T090000Z
DTEND:${compact(day)}T100000Z
END:VEVENT`)
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('A very long meeting title that spans multiple physical lines')
  })

  it('expands a simple weekly RRULE with COUNT', () => {
    const start = inDays(1)
    const ics = wrap(`
BEGIN:VEVENT
UID:weekly-1
SUMMARY:Weekly sync
DTSTART;TZID=Europe/London:${compact(start)}T100000
DTEND;TZID=Europe/London:${compact(start)}T103000
RRULE:FREQ=WEEKLY;COUNT=3
END:VEVENT`)
    const events = parseICS(ics)
    expect(events).toHaveLength(3)
    // Occurrences are seven days apart, all on the same weekday.
    expect(events[0].date).toBe(start)
    expect(events[1].date).toBe(addDaysISO(start, 7))
    expect(events[2].date).toBe(addDaysISO(start, 14))
    // Each occurrence gets a derived externalId so re-imports dedupe per date.
    expect(events[0].externalId).toBe(`weekly-1-${start}`)
    expect(new Set(events.map((e) => e.externalId)).size).toBe(3)
  })

  it('skips a malformed VEVENT but keeps valid ones', () => {
    const day = inDays(2)
    const ics = wrap(`
BEGIN:VEVENT
SUMMARY:No start date here
END:VEVENT
BEGIN:VEVENT
UID:ok-1
SUMMARY:Good event
DTSTART:${compact(day)}T120000Z
END:VEVENT`)
    const events = parseICS(ics)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Good event')
    // No DTEND → defaults to a 1-hour block.
    expect(events[0].endTime).not.toBe(events[0].startTime)
  })
})
