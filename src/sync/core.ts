// Pure, framework-free helpers for cross-device sync. No network, no React —
// so the reconciliation rules can be unit-tested in isolation.

import type { PersistedState } from '../store/useStore'

const PERSISTED_KEYS: (keyof PersistedState)[] = [
  'tasks',
  'recurring',
  'events',
  'interests',
  'template',
  'budgets',
  'settings',
  'dayPlans',
  'alerts',
]

/** Extract just the persisted/synced slice from the full store state. */
export function snapshotOf(state: PersistedState): PersistedState {
  const out = {} as PersistedState
  for (const key of PERSISTED_KEYS) {
    ;(out as Record<string, unknown>)[key] = state[key]
  }
  return out
}

/**
 * Stable FNV-1a hash of a snapshot's JSON (object keys sorted, so ordering
 * differences don't matter). Used to tell whether local data changed since the
 * last successful sync, without keeping a full copy of the previous state.
 */
export function hashSnapshot(data: unknown): string {
  const json = JSON.stringify(sortDeep(data))
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16)
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortDeep(obj[k])
        return acc
      }, {})
  }
  return value
}

/** True when a snapshot has no user-entered planner content worth pushing. */
export function isEmptyPlanner(data: Partial<PersistedState> | null | undefined): boolean {
  if (!data) return true
  const len = (a: unknown) => (Array.isArray(a) ? a.length : 0)
  return (
    len(data.tasks) === 0 &&
    len(data.recurring) === 0 &&
    len(data.events) === 0 &&
    len(data.interests) === 0 &&
    Object.keys(data.dayPlans ?? {}).length === 0
  )
}

export type SyncDecision =
  | { type: 'push'; expectedVersion: number } // upload local (first sync, or local changed)
  | { type: 'adoptRemote' } // load the server copy into the store
  | { type: 'conflict'; kind: 'first-signin' | 'remote-newer' } // ask the user
  | { type: 'noop' } // already in sync

export interface SyncInput {
  /** Version we last synced on this device, or null if never synced here. */
  lastSyncedVersion: number | null
  /** Has local data changed since that last sync? */
  localChanged: boolean
  /** Is local data effectively empty (nothing worth keeping)? */
  localEmpty: boolean
  /** Current version on the server (0 = the user has never synced anywhere). */
  serverVersion: number
}

/**
 * Decide what to do when reconciling local state with the server, implementing
 * the chosen policy: on first sign-in adopt local if the server is empty, else
 * ask; otherwise prompt only on a genuine divergence (both sides changed).
 */
export function planSync({
  lastSyncedVersion,
  localChanged,
  localEmpty,
  serverVersion,
}: SyncInput): SyncDecision {
  const syncedBefore = lastSyncedVersion !== null

  if (!syncedBefore) {
    if (serverVersion === 0) return { type: 'push', expectedVersion: 0 } // adopt local
    if (localEmpty) return { type: 'adoptRemote' }
    return { type: 'conflict', kind: 'first-signin' }
  }

  const serverNewer = serverVersion > lastSyncedVersion
  if (!serverNewer) {
    return localChanged ? { type: 'push', expectedVersion: lastSyncedVersion } : { type: 'noop' }
  }
  return localChanged ? { type: 'conflict', kind: 'remote-newer' } : { type: 'adoptRemote' }
}
