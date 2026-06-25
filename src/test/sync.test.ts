import { describe, it, expect } from 'vitest'
import { planSync, hashSnapshot, isEmptyPlanner } from '../sync/core'

describe('planSync', () => {
  it('first sign-in, empty server → push local up', () => {
    expect(planSync({ lastSyncedVersion: null, localChanged: true, localEmpty: false, serverVersion: 0 })).toEqual({
      type: 'push',
      expectedVersion: 0,
    })
  })

  it('first sign-in, server has data, local empty → adopt remote', () => {
    expect(planSync({ lastSyncedVersion: null, localChanged: false, localEmpty: true, serverVersion: 3 })).toEqual({
      type: 'adoptRemote',
    })
  })

  it('first sign-in, server has data, local has data → conflict', () => {
    expect(planSync({ lastSyncedVersion: null, localChanged: true, localEmpty: false, serverVersion: 3 })).toEqual({
      type: 'conflict',
      kind: 'first-signin',
    })
  })

  it('synced before, server unchanged, local changed → push', () => {
    expect(planSync({ lastSyncedVersion: 5, localChanged: true, localEmpty: false, serverVersion: 5 })).toEqual({
      type: 'push',
      expectedVersion: 5,
    })
  })

  it('synced before, server unchanged, local unchanged → noop', () => {
    expect(planSync({ lastSyncedVersion: 5, localChanged: false, localEmpty: false, serverVersion: 5 })).toEqual({
      type: 'noop',
    })
  })

  it('synced before, server newer, local unchanged → adopt remote', () => {
    expect(planSync({ lastSyncedVersion: 5, localChanged: false, localEmpty: false, serverVersion: 7 })).toEqual({
      type: 'adoptRemote',
    })
  })

  it('synced before, server newer, local changed → conflict', () => {
    expect(planSync({ lastSyncedVersion: 5, localChanged: true, localEmpty: false, serverVersion: 7 })).toEqual({
      type: 'conflict',
      kind: 'remote-newer',
    })
  })
})

describe('hashSnapshot', () => {
  it('is stable regardless of object key order', () => {
    expect(hashSnapshot({ a: 1, b: [2, 3] })).toBe(hashSnapshot({ b: [2, 3], a: 1 }))
  })
  it('changes when content changes', () => {
    expect(hashSnapshot({ a: 1 })).not.toBe(hashSnapshot({ a: 2 }))
  })
})

describe('isEmptyPlanner', () => {
  it('treats null/empty as empty', () => {
    expect(isEmptyPlanner(null)).toBe(true)
    expect(isEmptyPlanner({ tasks: [], recurring: [], events: [], interests: [], dayPlans: {} })).toBe(true)
  })
  it('treats any tasks/plans as non-empty', () => {
    expect(isEmptyPlanner({ tasks: [{ id: 't1' } as never] })).toBe(false)
    expect(isEmptyPlanner({ dayPlans: { '2026-06-24': {} as never } })).toBe(false)
  })
})
