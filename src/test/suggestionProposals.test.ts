import { describe, it, expect } from 'vitest'
import { suggestForGap } from '../engine/suggestionProposals'
import type { Task } from '../types'

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

const SUMMER = new Date(2026, 6, 15) // 15 Jul 2026 — northern summer

describe('suggestForGap', () => {
  it('proposes a task that fits the gap, clamped to the gap', () => {
    const tasks = [task({ id: 't1', title: 'Write report', remainingMinutes: 120 })]
    const props = suggestForGap(60, { tasks, interestKeys: [], date: SUMMER, hemisphere: 'north' })
    const taskProp = props.find((p) => p.kind === 'task')
    expect(taskProp).toBeDefined()
    expect(taskProp!.refId).toBe('t1')
    expect(taskProp!.durationMinutes).toBe(60) // clamped to the 60-min gap
  })

  it('excludes a task when the gap is too small', () => {
    const tasks = [task({ id: 't1', title: 'Write report', remainingMinutes: 120 })]
    const props = suggestForGap(10, { tasks, interestKeys: [], date: SUMMER, hemisphere: 'north' })
    expect(props).toEqual([]) // below MIN_CHUNK, nothing offered
  })

  it('clamps task duration to maxPerDayMinutes and remaining work', () => {
    const tasks = [
      task({ id: 't1', title: 'Study', remainingMinutes: 200, maxPerDayMinutes: 45 }),
      task({ id: 't2', title: 'Nearly done', remainingMinutes: 30, deadline: '2027-01-01' }),
    ]
    const props = suggestForGap(120, { tasks, interestKeys: [], date: SUMMER, hemisphere: 'north' })
    const t1 = props.find((p) => p.refId === 't1')
    const t2 = props.find((p) => p.refId === 't2')
    expect(t1!.durationMinutes).toBe(45) // capped by maxPerDayMinutes
    expect(t2!.durationMinutes).toBe(30) // capped by remaining work
  })

  it('ranks urgent/high-priority tasks first', () => {
    const tasks = [
      task({ id: 'low', title: 'Low', priority: 2 }),
      task({ id: 'urgent', title: 'Urgent', priority: 9, deadline: '2026-07-16' }),
    ]
    const props = suggestForGap(60, { tasks, interestKeys: [], date: SUMMER, hemisphere: 'north' })
    const firstTask = props.find((p) => p.kind === 'task')
    expect(firstTask!.refId).toBe('urgent')
  })

  it('returns activities when interests match the season', () => {
    const props = suggestForGap(60, {
      tasks: [],
      interestKeys: ['reading'],
      date: SUMMER,
      hemisphere: 'north',
    })
    const activities = props.filter((p) => p.kind === 'activity')
    expect(activities.length).toBeGreaterThan(0)
    expect(activities[0].suggestion).toBeTruthy()
    expect(activities[0].durationMinutes).toBe(60)
  })

  it('interleaves a task then an activity near the top', () => {
    const tasks = [task({ id: 't1', title: 'Write report' })]
    const props = suggestForGap(60, {
      tasks,
      interestKeys: ['reading'],
      date: SUMMER,
      hemisphere: 'north',
    })
    expect(props[0].kind).toBe('task')
    expect(props[1].kind).toBe('activity')
  })
})
