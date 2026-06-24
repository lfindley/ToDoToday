import { describe, it, expect } from 'vitest'
import { computeAlerts } from '../engine/alerts'
import type { Task, Budgets } from '../types'

const TODAY = '2026-06-18'
const budgets: Budgets = { productiveMinutesPerDay: 120, freeMinutesPerDay: 60 }

function task(over: Partial<Task> & { id: string }): Task {
  return {
    title: over.title ?? over.id,
    priority: 5,
    estimatedMinutes: over.remainingMinutes ?? 60,
    remainingMinutes: 60,
    completed: false,
    createdAt: '2020-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('alerts — feasibility', () => {
  it('flags a task that cannot be finished by its deadline', () => {
    const alerts = computeAlerts({
      tasks: [task({ id: 't1', title: 'Huge', remainingMinutes: 600, deadline: '2026-06-19' })], // tomorrow → 2 days * 120 = 240 < 600
      budgets,
      todayISO: TODAY,
      existing: [],
    })
    const infeasible = alerts.filter((a) => a.kind === 'infeasible' && a.taskId === 't1')
    expect(infeasible.length).toBe(1)
    expect(infeasible[0].message).toContain('short by')
  })

  it('does not flag a comfortably feasible task', () => {
    const alerts = computeAlerts({
      tasks: [task({ id: 't1', title: 'Small', remainingMinutes: 100, deadline: '2026-06-23' })], // 6 days * 120 = 720 ≥ 100
      budgets,
      todayISO: TODAY,
      existing: [],
    })
    expect(alerts.some((a) => a.kind === 'infeasible')).toBe(false)
  })

  it('accounts for earlier-deadline tasks competing for the same capacity', () => {
    const alerts = computeAlerts({
      tasks: [
        task({ id: 'a', remainingMinutes: 200, deadline: '2026-06-19' }), // uses up tomorrow's capacity
        task({ id: 'b', remainingMinutes: 200, deadline: '2026-06-19' }),
      ],
      budgets,
      todayISO: TODAY,
      existing: [],
    })
    // Combined 400 > capacity 240 by the shared deadline → at least one infeasible.
    expect(alerts.some((a) => a.kind === 'infeasible')).toBe(true)
  })
})

describe('alerts — reminders', () => {
  it('emits D-2 / D-1 / D-0 reminders on the right days', () => {
    const alerts = computeAlerts({
      tasks: [
        task({ id: 'today', deadline: '2026-06-18' }),
        task({ id: 'tomorrow', deadline: '2026-06-19' }),
        task({ id: 'in2', deadline: '2026-06-20' }),
        task({ id: 'far', deadline: '2026-06-30' }),
      ],
      budgets,
      todayISO: TODAY,
      existing: [],
    })
    const kindFor = (id: string) => alerts.filter((a) => a.taskId === id).map((a) => a.kind)
    expect(kindFor('today')).toContain('reminder-today')
    expect(kindFor('tomorrow')).toContain('reminder-1d')
    expect(kindFor('in2')).toContain('reminder-2d')
    expect(alerts.find((a) => a.taskId === 'far' && a.kind.startsWith('reminder'))).toBeUndefined()
  })

  it('ignores completed tasks', () => {
    const alerts = computeAlerts({
      tasks: [task({ id: 'done', deadline: '2026-06-19', completed: true, remainingMinutes: 0 })],
      budgets,
      todayISO: TODAY,
      existing: [],
    })
    expect(alerts.length).toBe(0)
  })

  it('preserves dismissed state across recomputes', () => {
    const first = computeAlerts({
      tasks: [task({ id: 't1', deadline: '2026-06-19' })],
      budgets,
      todayISO: TODAY,
      existing: [],
    })
    const dismissed = first.map((a) => ({ ...a, dismissed: true }))
    const second = computeAlerts({
      tasks: [task({ id: 't1', deadline: '2026-06-19' })],
      budgets,
      todayISO: TODAY,
      existing: dismissed,
    })
    expect(second.every((a) => a.dismissed)).toBe(true)
  })
})
