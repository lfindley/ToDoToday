import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import { isoDate } from './utils/date'
import Nav, { type View } from './components/Nav'
import Today from './components/Today'
import Week from './components/Week'
import Month from './components/Month'
import Tasks from './components/Tasks'
import Recurring from './components/Recurring'
import Settings from './components/Settings'
import Onboarding from './components/Onboarding'
import AlertsBell from './components/AlertsBell'
import Account from './components/Account'
import SyncConflictModal from './components/SyncConflictModal'
import { useSync } from './sync/useSync'
import { fireNotification, notificationPermission } from './notifications'

// Accounts/sync are hidden unless explicitly enabled. Keep off for a
// frontend-only (local-only) deploy where no backend is running; set
// VITE_ENABLE_ACCOUNTS=true once the backend is deployed (see server/SETUP.md).
const ACCOUNTS_ENABLED = import.meta.env.VITE_ENABLE_ACCOUNTS === 'true'

export default function App() {
  const [view, setView] = useState<View>('week')
  const [currentDate, setCurrentDate] = useState(isoDate())
  const onboarded = useStore((s) => s.onboarded)
  const alerts = useStore((s) => s.alerts)
  const settings = useStore((s) => s.settings)
  const recomputeAlerts = useStore((s) => s.recomputeAlerts)
  const markAlertNotified = useStore((s) => s.markAlertNotified)
  const replan = useStore((s) => s.replan)

  // Restore session + drive cross-device sync (no-op when signed out).
  useSync()

  // Apply the chosen accent scheme by flipping `data-theme` on <html>; the
  // Tailwind `brand` palette reads the matching CSS variables (see index.css).
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme ?? 'blue'
  }, [settings.theme])

  // Apply light/dark via a `dark` class on <html>. In `system` mode, follow the
  // OS preference and keep tracking it live.
  const colorMode = settings.colorMode ?? 'system'
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = colorMode === 'dark' || (colorMode === 'system' && media.matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    if (colorMode === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [colorMode])

  // On load: refresh alerts and make sure the horizon is planned from today.
  useEffect(() => {
    const today = isoDate()
    recomputeAlerts(today)
    if (!useStore.getState().dayPlans[today]) replan(today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fire Windows notifications for new alerts while the app is open.
  useEffect(() => {
    if (!settings.browserNotifications || notificationPermission() !== 'granted') return
    for (const a of alerts) {
      if (a.dismissed || a.notified) continue
      const title = a.kind === 'infeasible' ? '⚠️ Deadline at risk' : '⏰ Upcoming deadline'
      if (fireNotification(title, a.message)) markAlertNotified(a.id)
    }
  }, [alerts, settings.browserNotifications, markAlertNotified])

  const openDay = (iso: string) => {
    if (!useStore.getState().dayPlans[iso]) replan(isoDate())
    setCurrentDate(iso)
    setView('today')
  }

  // First-run startup screen: collect settings, recurring items and tasks before
  // showing the planner. (Existing installs are migrated to onboarded — see useStore.)
  if (!onboarded) return <Onboarding />

  return (
    <div className="min-h-full flex flex-col">
      <div className="sticky top-0 z-20 shadow-sm">
        <header className="bg-gradient-to-r from-brand-600 to-brand-700 text-white">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🗓️</span>
              <h1 className="font-bold text-lg tracking-tight">ToDoToday</h1>
            </div>
            <div className="flex items-center gap-3">
              <AlertsBell />
              {ACCOUNTS_ENABLED && <Account />}
            </div>
          </div>
        </header>
        <Nav view={view} setView={setView} />
      </div>

      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-4 py-4">
        {view === 'today' && <Today dateISO={currentDate} setDateISO={setCurrentDate} />}
        {view === 'week' && <Week onOpenDay={openDay} />}
        {view === 'month' && <Month onOpenDay={openDay} />}
        {view === 'tasks' && <Tasks />}
        {view === 'recurring' && <Recurring />}
        {view === 'settings' && <Settings />}
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        ToDoToday · plans your day, locally in your browser
      </footer>

      <SyncConflictModal />
    </div>
  )
}
