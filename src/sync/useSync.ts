import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useAuth } from '../store/useAuth'

const DEBOUNCE_MS = 1500

// Guard so the one-time session restore runs only once, even under React
// StrictMode's double-mount (init() rotates the refresh token, so calling it
// twice would invalidate the freshly-issued token).
let initStarted = false

/**
 * Drives cross-device sync from the app shell:
 *  - on load: restore the session and reconcile with the server (once),
 *  - on any store change: debounce, then push the latest snapshot,
 *  - on tab hide: flush pending changes so nothing is lost.
 * Does nothing user-visible when signed out — the app stays local-only.
 */
export function useSync() {
  useEffect(() => {
    if (!initStarted) {
      initStarted = true
      void useAuth.getState().init()
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const schedulePush = () => {
      if (!useAuth.getState().user) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void useAuth.getState().pushNow()
      }, DEBOUNCE_MS)
    }

    const flush = () => {
      if (timer) clearTimeout(timer)
      if (useAuth.getState().user) void useAuth.getState().pushNow()
    }

    const unsubscribe = useStore.subscribe(schedulePush)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timer) clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
