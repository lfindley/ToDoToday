import { describe, it, expect } from 'vitest'
import { generateDayPlan, planHorizon, buildTaskQueue, type SchedulerInput } from '../engine/scheduler'
import type { Task, ScheduledBlock } from '../types'
import { parseTime } from '../utils/time'
import { isoDate, addDaysISO } from '../utils/date'

const MONDAY = '2026-06-22' // a Monday

function baseInput(over: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    tasks: [],
    recurring: [],
    template: {
      sleep: { bedtime: '23:00', wakeTime: '07:00' },
      meals: [{ id: 'm1', name: 'Lunch', time: '12:00', durationMinutes: 60 }],
    },
    budgets: { productiveMinutesPerDay: 240, freeMinutesPerDay: 60 },
    interestKeys: [],
    hemisphere: 'north',
    bufferMinutes: 0,
    ...over,
  }
}

function task(over: Partial<Task> & { id: string; title: string }): Task {
  return {
    priority: 5,
    estimatedMinutes: 60,
    remainingMinutes: 60,
    completed: false,
    createdAt: '2020-01-01T00:00:00.000Z',
    ...over,
  }
}

function noOverlaps(blocks: ScheduledBlock[]): boolean {
  const sorted = [...blocks].sort((a, b) => parseTime(a.start) - parseTime(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (parseTime(sorted[i].start) < parseTime(sorted[i - 1].end)) return false
  }
  return true
}

const minutesOf = (b: ScheduledBlock) => parseTime(b.end) - parseTime(b.start)

describe('scheduler', () => {
  it('places meal anchors', () => {
    const plan = generateDayPlan(MONDAY, baseInput())
    const lunch = plan.blocks.find((b) => b.type === 'meal' && b.title === 'Lunch')
    expect(lunch).toBeDefined()
    expect(lunch!.start).toBe('12:00')
    expect(lunch!.end).toBe('13:00')
  })

  it('never produces overlapping blocks', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        tasks: [
          task({ id: 't1', title: 'A', estimatedMinutes: 120, remainingMinutes: 120 }),
          task({ id: 't2', title: 'B', estimatedMinutes: 120, remainingMinutes: 120 }),
        ],
      }),
    )
    expect(noOverlaps(plan.blocks)).toBe(true)
  })

  it('places a fixed commitment as an anchor and schedules tasks around it', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        // Meals outside the working window so the commitment stays one block.
        template: {
          sleep: { bedtime: '23:00', wakeTime: '07:00' },
          meals: [
            { id: 'b', name: 'Breakfast', time: '08:00', durationMinutes: 30 },
            { id: 'd', name: 'Dinner', time: '19:00', durationMinutes: 60 },
          ],
        },
        recurring: [
          {
            id: 'r1',
            title: 'Work',
            category: 'commitment',
            priority: 8,
            scheduleType: 'fixed',
            days: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
        tasks: [task({ id: 't1', title: 'A', estimatedMinutes: 60, remainingMinutes: 60 })],
      }),
    )
    const work = plan.blocks.find((b) => b.refId === 'r1')
    expect(work).toBeDefined()
    expect(work!.start).toBe('09:00')
    expect(work!.end).toBe('17:00')
    expect(noOverlaps(plan.blocks)).toBe(true)
    // The task must not collide with the work block.
    const taskBlocks = plan.blocks.filter((b) => b.refId === 't1')
    for (const tb of taskBlocks) {
      expect(parseTime(tb.end) <= parseTime('09:00') || parseTime(tb.start) >= parseTime('17:00')).toBe(true)
    }
  })

  it('splits a fixed commitment around a meal that falls inside it', () => {
    // base input has lunch 12:00–13:00, inside the 09:00–17:00 work block.
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        recurring: [
          {
            id: 'r1',
            title: 'Work',
            category: 'commitment',
            priority: 8,
            scheduleType: 'fixed',
            days: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
      }),
    )
    const work = plan.blocks.filter((b) => b.refId === 'r1')
    expect(work.length).toBe(2)
    expect(work.some((b) => b.start === '09:00' && b.end === '12:00')).toBe(true)
    expect(work.some((b) => b.start === '13:00' && b.end === '17:00')).toBe(true)
    expect(plan.blocks.find((b) => b.type === 'meal' && b.start === '12:00')).toBeDefined()
    expect(noOverlaps(plan.blocks)).toBe(true)
  })

  it('does not schedule a flexible recurring on a day it is not due', () => {
    const sunday = '2026-06-21'
    const plan = generateDayPlan(
      sunday,
      baseInput({
        recurring: [
          {
            id: 'r1',
            title: 'Work',
            category: 'commitment',
            priority: 8,
            scheduleType: 'fixed',
            days: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
      }),
    )
    expect(plan.blocks.find((b) => b.refId === 'r1')).toBeUndefined()
  })

  it('caps task time at the productive budget', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        budgets: { productiveMinutesPerDay: 240, freeMinutesPerDay: 0 },
        tasks: [
          task({ id: 't1', title: 'A', estimatedMinutes: 180, remainingMinutes: 180 }),
          task({ id: 't2', title: 'B', estimatedMinutes: 180, remainingMinutes: 180 }),
        ],
      }),
    )
    const taskMinutes = plan.blocks.filter((b) => b.type === 'task').reduce((a, b) => a + minutesOf(b), 0)
    expect(taskMinutes).toBe(240)
  })

  it('respects a per-day cap on a single task', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        tasks: [task({ id: 't1', title: 'Big', estimatedMinutes: 240, remainingMinutes: 240, maxPerDayMinutes: 60 })],
      }),
    )
    const mins = plan.blocks.filter((b) => b.refId === 't1').reduce((a, b) => a + minutesOf(b), 0)
    expect(mins).toBe(60)
  })

  it('schedules higher-priority tasks earlier', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        tasks: [
          task({ id: 'low', title: 'Low', priority: 2, estimatedMinutes: 120, remainingMinutes: 120 }),
          task({ id: 'high', title: 'High', priority: 9, estimatedMinutes: 120, remainingMinutes: 120 }),
        ],
      }),
    )
    const startOf = (id: string) =>
      Math.min(...plan.blocks.filter((b) => b.refId === id).map((b) => parseTime(b.start)))
    expect(startOf('high')).toBeLessThan(startOf('low'))
  })

  it('keeps a "finish by" task entirely within its window', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        tasks: [task({ id: 't1', title: 'Morning', estimatedMinutes: 60, remainingMinutes: 60, window: { latest: '11:00' } })],
      }),
    )
    const blocks = plan.blocks.filter((b) => b.refId === 't1')
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) expect(parseTime(b.end)).toBeLessThanOrEqual(parseTime('11:00'))
  })

  it('keeps an "after" task entirely within its window', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        tasks: [task({ id: 't1', title: 'Evening', estimatedMinutes: 60, remainingMinutes: 60, window: { earliest: '19:00' } })],
      }),
    )
    const blocks = plan.blocks.filter((b) => b.refId === 't1')
    expect(blocks.length).toBeGreaterThan(0)
    for (const b of blocks) expect(parseTime(b.start)).toBeGreaterThanOrEqual(parseTime('19:00'))
  })

  it('preserves locked blocks and schedules around them', () => {
    const locked: ScheduledBlock = {
      id: 'locked1',
      start: '10:00',
      end: '11:00',
      type: 'task',
      title: 'Locked thing',
      locked: true,
    }
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        lockedBlocks: [locked],
        tasks: [task({ id: 't1', title: 'A', estimatedMinutes: 120, remainingMinutes: 120 })],
      }),
    )
    const kept = plan.blocks.find((b) => b.id === 'locked1')
    expect(kept).toBeDefined()
    expect(kept!.locked).toBe(true)
    expect(noOverlaps(plan.blocks)).toBe(true)
  })

  it('orders the task queue by deadline then priority', () => {
    const queue = buildTaskQueue([
      task({ id: 'a', title: 'A', priority: 1, deadline: '2026-07-01' }),
      task({ id: 'b', title: 'B', priority: 9, deadline: '2026-06-25' }),
      task({ id: 'c', title: 'C', priority: 5 }),
    ])
    expect(queue.map((t) => t.id)).toEqual(['b', 'a', 'c'])
  })

  it('places a one-off event as a hard anchor and schedules tasks around it', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        events: [{ id: 'e1', title: 'Dentist', date: MONDAY, startTime: '15:00', endTime: '16:00' }],
        tasks: [task({ id: 't1', title: 'A', estimatedMinutes: 60, remainingMinutes: 60 })],
      }),
    )
    const ev = plan.blocks.find((b) => b.type === 'event' && b.refId === 'e1')
    expect(ev).toBeDefined()
    expect(ev!.start).toBe('15:00')
    expect(ev!.end).toBe('16:00')
    expect(noOverlaps(plan.blocks)).toBe(true)
    for (const tb of plan.blocks.filter((b) => b.refId === 't1')) {
      expect(parseTime(tb.end) <= parseTime('15:00') || parseTime(tb.start) >= parseTime('16:00')).toBe(true)
    }
  })

  it('only places an event on its own date', () => {
    const tuesday = '2026-06-23'
    const plan = generateDayPlan(
      tuesday,
      baseInput({ events: [{ id: 'e1', title: 'Dentist', date: MONDAY, startTime: '15:00', endTime: '16:00' }] }),
    )
    expect(plan.blocks.find((b) => b.type === 'event')).toBeUndefined()
  })

  it('splits a fixed commitment around an event inside it', () => {
    const plan = generateDayPlan(
      MONDAY,
      baseInput({
        template: { sleep: { bedtime: '23:00', wakeTime: '07:00' }, meals: [] },
        recurring: [
          {
            id: 'r1',
            title: 'Work',
            category: 'commitment',
            priority: 8,
            scheduleType: 'fixed',
            days: [1, 2, 3, 4, 5],
            startTime: '09:00',
            endTime: '17:00',
          },
        ],
        events: [{ id: 'e1', title: 'Dentist', date: MONDAY, startTime: '13:00', endTime: '14:00' }],
      }),
    )
    const work = plan.blocks.filter((b) => b.refId === 'r1')
    expect(work.length).toBe(2)
    expect(work.some((b) => b.start === '09:00' && b.end === '13:00')).toBe(true)
    expect(work.some((b) => b.start === '14:00' && b.end === '17:00')).toBe(true)
    expect(plan.blocks.find((b) => b.type === 'event' && b.start === '13:00')).toBeDefined()
    expect(noOverlaps(plan.blocks)).toBe(true)
  })
})

describe('planHorizon (multi-day)', () => {
  const refMinutes = (plan: { blocks: ScheduledBlock[] }, id: string) =>
    plan.blocks.filter((b) => b.refId === id).reduce((a, b) => a + minutesOf(b), 0)

  it('carries leftover task work across consecutive days', () => {
    const horizon = planHorizon(
      MONDAY,
      5,
      baseInput({
        budgets: { productiveMinutesPerDay: 120, freeMinutesPerDay: 0 },
        tasks: [task({ id: 'A', title: 'A', estimatedMinutes: 300, remainingMinutes: 300 })],
      }),
    )
    const days = Object.keys(horizon).sort()
    const total = days.reduce((a, iso) => a + refMinutes(horizon[iso], 'A'), 0)
    expect(total).toBe(300) // all the work gets scheduled, no more no less
    expect(refMinutes(horizon[days[0]], 'A')).toBe(120) // capped at the daily budget
    expect(refMinutes(horizon[days[1]], 'A')).toBe(120)
    expect(refMinutes(horizon[days[2]], 'A')).toBe(60)
    expect(refMinutes(horizon[days[3]], 'A')).toBe(0) // exhausted — nothing left to carry
  })

  it('respects a per-day cap while spreading across days', () => {
    const horizon = planHorizon(
      MONDAY,
      6,
      baseInput({
        budgets: { productiveMinutesPerDay: 240, freeMinutesPerDay: 0 },
        tasks: [task({ id: 'A', title: 'A', estimatedMinutes: 300, remainingMinutes: 300, maxPerDayMinutes: 60 })],
      }),
    )
    const days = Object.keys(horizon).sort()
    for (const iso of days) expect(refMinutes(horizon[iso], 'A')).toBeLessThanOrEqual(60)
    expect(days.reduce((a, iso) => a + refMinutes(horizon[iso], 'A'), 0)).toBe(300)
  })

  it('schedules an earlier-deadline task first even at lower priority', () => {
    const horizon = planHorizon(
      MONDAY,
      4,
      baseInput({
        budgets: { productiveMinutesPerDay: 120, freeMinutesPerDay: 0 },
        tasks: [
          task({ id: 'late', title: 'Late', priority: 9, estimatedMinutes: 120, remainingMinutes: 120, deadline: '2026-06-30' }),
          task({ id: 'soon', title: 'Soon', priority: 1, estimatedMinutes: 120, remainingMinutes: 120, deadline: '2026-06-23' }),
        ],
      }),
    )
    const days = Object.keys(horizon).sort()
    expect(refMinutes(horizon[days[0]], 'soon')).toBe(120) // urgent task takes day 1
    expect(refMinutes(horizon[days[0]], 'late')).toBe(0)
  })

  it('does not schedule task work after its deadline', () => {
    // Anchored to the real "today" because the scheduler treats a deadline in the
    // past (relative to the actual current date) as overdue and schedules it ASAP.
    // Using a fixed past date here would make the test a time-bomb.
    const start = isoDate()
    const deadline = addDaysISO(start, 1) // a still-future, 2-day window (today + tomorrow)
    const horizon = planHorizon(
      start,
      6,
      baseInput({
        budgets: { productiveMinutesPerDay: 60, freeMinutesPerDay: 0 },
        // Needs 180 min but only 2 days before the deadline → 120 schedulable.
        tasks: [task({ id: 'A', title: 'A', estimatedMinutes: 180, remainingMinutes: 180, deadline })],
      }),
    )
    for (const [iso, plan] of Object.entries(horizon)) {
      if (iso > deadline) expect(refMinutes(plan, 'A')).toBe(0)
    }
  })
})
