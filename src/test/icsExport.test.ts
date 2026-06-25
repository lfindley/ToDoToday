import { describe, it, expect } from 'vitest'
import type { DayPlan, ScheduledBlock } from '../types'
import { plansToICS, exportableBlockCount } from '../utils/icsExport'
import { parseICS } from '../utils/ics'

function block(b: Partial<ScheduledBlock> & { start: string; end: string; title: string }): ScheduledBlock {
  return { id: b.id ?? 'blk', type: b.type ?? 'task', ...b }
}

function dayPlan(date: string, blocks: ScheduledBlock[]): DayPlan {
  return { date, blocks, generatedAt: '2026-01-01T00:00:00.000Z', warnings: [] }
}

const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1

describe('plansToICS', () => {
  it('wraps events in a VCALENDAR with CRLF line endings', () => {
    const ics = plansToICS([dayPlan('2026-06-25', [block({ start: '09:00', end: '10:00', title: 'Study' })])])
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('PRODID:-//ToDoToday//Planner//EN')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(ics).toContain('\r\n')
  })

  it('emits a floating-local VEVENT for a block', () => {
    const ics = plansToICS([dayPlan('2026-06-25', [block({ start: '09:00', end: '10:30', title: 'Study' })])])
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20260625T090000')
    expect(ics).toContain('DTEND:20260625T103000')
    expect(ics).toContain('SUMMARY:Study')
    expect(ics).not.toContain('TZID')
    expect(ics).not.toMatch(/DTSTART:\d+T\d+Z/) // floating, not UTC
  })

  it('skips buffer blocks', () => {
    const plan = dayPlan('2026-06-25', [
      block({ id: 'a', type: 'task', start: '09:00', end: '10:00', title: 'Work' }),
      block({ id: 'b', type: 'buffer', start: '10:00', end: '10:15', title: 'Buffer' }),
    ])
    expect(exportableBlockCount([plan])).toBe(1)
    expect(occurrences(plansToICS([plan]), 'BEGIN:VEVENT')).toBe(1)
  })

  it('escapes commas and semicolons in titles', () => {
    const ics = plansToICS([dayPlan('2026-06-25', [block({ start: '13:00', end: '13:45', title: 'Lunch, then; relax' })])])
    expect(ics).toContain('SUMMARY:Lunch\\, then\\; relax')
  })

  it('rolls DTEND to the next day when a block runs to midnight', () => {
    const ics = plansToICS([dayPlan('2026-06-25', [block({ start: '23:00', end: '00:00', title: 'Wind down' })])])
    expect(ics).toContain('DTSTART:20260625T230000')
    expect(ics).toContain('DTEND:20260626T000000')
  })

  it('round-trips back through parseICS', () => {
    const plans = [
      dayPlan('2026-06-25', [
        block({ id: '1', type: 'recurring', start: '09:00', end: '17:00', title: 'Work' }),
        block({ id: '2', type: 'task', start: '18:00', end: '19:00', title: 'Study' }),
      ]),
    ]
    const events = parseICS(plansToICS(plans))
    expect(events).toHaveLength(2)
    expect(events.map((e) => ({ t: e.title, d: e.date, s: e.startTime, en: e.endTime }))).toEqual([
      { t: 'Work', d: '2026-06-25', s: '09:00', en: '17:00' },
      { t: 'Study', d: '2026-06-25', s: '18:00', en: '19:00' },
    ])
  })

  it('counts nothing for empty plans', () => {
    expect(exportableBlockCount([])).toBe(0)
    expect(exportableBlockCount([dayPlan('2026-06-25', [])])).toBe(0)
  })
})
