import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as api from '../api/client'
import { ApiError } from '../api/client'
import { useStore, type PersistedState } from './useStore'
import { snapshotOf, hashSnapshot, isEmptyPlanner, planSync } from '../sync/core'

export type SyncStatus = 'offline' | 'syncing' | 'saving' | 'idle' | 'error'

export interface SyncConflict {
  kind: 'first-signin' | 'remote-newer'
  remote: { data: unknown; version: number }
}

interface AuthState {
  user: { id: string; email: string } | null
  accessToken: string | null // in-memory only
  refreshToken: string | null // persisted ("stay logged in")
  lastSyncedVersion: number | null // persisted
  lastSyncedHash: string | null // persisted
  status: SyncStatus
  error: string | null
  conflict: SyncConflict | null

  register: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** On app load: restore the session (if any) and reconcile with the server. */
  init: () => Promise<void>
  /** Push local changes now (called debounced by useSync). No-op if unchanged. */
  pushNow: () => Promise<void>
  resolveConflict: (choice: 'local' | 'remote') => Promise<void>
}

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Sync failed'
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => {
      async function refreshSession(): Promise<void> {
        const rt = get().refreshToken
        if (!rt) throw new Error('Not signed in')
        const session = await api.refresh(rt)
        set({ user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken })
      }

      // Run an API call with a valid access token, refreshing once on a 401.
      async function withAccess<T>(fn: (token: string) => Promise<T>): Promise<T> {
        if (!get().accessToken) await refreshSession()
        const token = get().accessToken
        if (!token) throw new Error('Not signed in')
        try {
          return await fn(token)
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await refreshSession()
            const fresh = get().accessToken
            if (fresh) return await fn(fresh)
          }
          throw e
        }
      }

      // Load the server snapshot into the local store and mark it as synced.
      function applyRemote(data: unknown, version: number): void {
        const slice = (data && typeof data === 'object' ? data : {}) as Partial<PersistedState>
        useStore.getState().hydrate(slice)
        useStore.getState().recomputeAlerts()
        const hash = hashSnapshot(snapshotOf(useStore.getState()))
        set({ lastSyncedVersion: version, lastSyncedHash: hash, status: 'idle', conflict: null })
      }

      async function doPush(expectedVersion: number): Promise<void> {
        const snapshot = snapshotOf(useStore.getState())
        const hash = hashSnapshot(snapshot)
        set({ status: 'saving' })
        const result = await withAccess((t) => api.putPlanner(t, snapshot, expectedVersion))
        if (result.ok) {
          set({ lastSyncedVersion: result.snapshot.version, lastSyncedHash: hash, status: 'idle', conflict: null })
        } else {
          // Someone else wrote in between — ask the user how to resolve.
          set({ conflict: { kind: 'remote-newer', remote: result.conflict }, status: 'idle' })
        }
      }

      async function reconcile(): Promise<void> {
        set({ status: 'syncing', error: null })
        try {
          const server = await withAccess((t) => api.getPlanner(t))
          const snapshot = snapshotOf(useStore.getState())
          const localHash = hashSnapshot(snapshot)
          const { lastSyncedVersion, lastSyncedHash } = get()
          const localChanged =
            lastSyncedHash == null ? !isEmptyPlanner(snapshot) : localHash !== lastSyncedHash

          const decision = planSync({
            lastSyncedVersion,
            localChanged,
            localEmpty: isEmptyPlanner(snapshot),
            serverVersion: server.version,
          })

          switch (decision.type) {
            case 'push':
              await doPush(decision.expectedVersion)
              break
            case 'adoptRemote':
              applyRemote(server.data, server.version)
              break
            case 'conflict':
              set({ conflict: { kind: decision.kind, remote: server }, status: 'idle' })
              break
            case 'noop':
              set({ status: 'idle' })
              break
          }
        } catch (e) {
          set({ status: 'error', error: errMessage(e) })
        }
      }

      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        lastSyncedVersion: null,
        lastSyncedHash: null,
        status: 'offline',
        error: null,
        conflict: null,

        register: async (email, password) => {
          set({ error: null })
          try {
            const session = await api.register(email, password)
            set({ user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken })
          } catch (e) {
            set({ status: 'offline', error: errMessage(e) })
            throw e
          }
          await reconcile()
        },

        login: async (email, password) => {
          set({ error: null })
          try {
            const session = await api.login(email, password)
            set({ user: session.user, accessToken: session.accessToken, refreshToken: session.refreshToken })
          } catch (e) {
            set({ status: 'offline', error: errMessage(e) })
            throw e
          }
          await reconcile()
        },

        logout: async () => {
          const rt = get().refreshToken
          if (rt) {
            try {
              await api.logout(rt)
            } catch {
              /* best-effort */
            }
          }
          // Local-first: keep the planner data in the browser, just sign out.
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            lastSyncedVersion: null,
            lastSyncedHash: null,
            status: 'offline',
            error: null,
            conflict: null,
          })
        },

        init: async () => {
          if (!get().refreshToken) {
            set({ status: 'offline' })
            return
          }
          set({ status: 'syncing' })
          try {
            await refreshSession()
          } catch {
            // Refresh token invalid/expired — drop to local-only, keep data.
            set({
              user: null,
              accessToken: null,
              refreshToken: null,
              lastSyncedVersion: null,
              lastSyncedHash: null,
              status: 'offline',
            })
            return
          }
          await reconcile()
        },

        pushNow: async () => {
          const s = get()
          if (!s.user || s.conflict) return
          const hash = hashSnapshot(snapshotOf(useStore.getState()))
          if (hash === s.lastSyncedHash) return // nothing changed
          try {
            await doPush(s.lastSyncedVersion ?? 0)
          } catch (e) {
            set({ status: 'error', error: errMessage(e) })
          }
        },

        resolveConflict: async (choice) => {
          const c = get().conflict
          if (!c) return
          set({ conflict: null, status: 'syncing', error: null })
          try {
            if (choice === 'remote') {
              applyRemote(c.remote.data, c.remote.version)
            } else {
              // Keep this device's version: overwrite the server at its current version.
              const snapshot = snapshotOf(useStore.getState())
              const hash = hashSnapshot(snapshot)
              const result = await withAccess((t) => api.putPlanner(t, snapshot, c.remote.version))
              if (result.ok) {
                set({ lastSyncedVersion: result.snapshot.version, lastSyncedHash: hash, status: 'idle' })
              } else {
                set({ conflict: { kind: 'remote-newer', remote: result.conflict }, status: 'idle' })
              }
            }
          } catch (e) {
            set({ status: 'error', error: errMessage(e) })
          }
        },
      }
    },
    {
      name: 'todotoday-auth',
      partialize: (s) => ({
        refreshToken: s.refreshToken,
        lastSyncedVersion: s.lastSyncedVersion,
        lastSyncedHash: s.lastSyncedHash,
      }),
    },
  ),
)
