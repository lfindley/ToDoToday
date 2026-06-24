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
import AlertsBell from './components/AlertsBell'
import { fireNotification, notificationPermission } from './notifications'

export default function App() {
  const [view, setView] = useState<View>('today')
  const [currentDate, setCurrentDate] = useState(isoDate())
  const alerts = useStore((s) => s.alerts)
  const settings = useStore((s) => s.settings)
  const recomputeAlerts = useStore((s) => s.recomputeAlerts)
  const markAlertNotified = useStore((s) => s.markAlertNotified)
  const replan = useStore((s) => s.replan)

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

  return (
    <div className="min-h-full flex flex-col">
      <div className="sticky top-0 z-20 shadow-sm">
        <header className="bg-brand-600 text-white">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🗓️</span>
              <h1 className="font-bold text-lg tracking-tight">ToDoToday</h1>
            </div>
            <AlertsBell />
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
    </div>
  )
}
