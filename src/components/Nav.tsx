export type View = 'today' | 'week' | 'month' | 'tasks' | 'recurring' | 'settings'

const TABS: { id: View; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '🗓️' },
  { id: 'week', label: 'Week', icon: '📆' },
  { id: 'month', label: 'Month', icon: '📅' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'recurring', label: 'Recurring', icon: '🔁' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function Nav({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-3xl mx-auto px-3 flex gap-1">
        {TABS.map((tab) => {
          const active = view === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
