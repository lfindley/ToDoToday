import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function AlertsBell() {
  const alerts = useStore((s) => s.alerts)
  const dismissAlert = useStore((s) => s.dismissAlert)
  const [open, setOpen] = useState(false)

  const active = alerts.filter((a) => !a.dismissed)
  const count = active.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Alerts"
      >
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-xl border border-slate-200 z-30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 font-semibold text-slate-800 text-sm">
              Alerts
            </div>
            {active.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">All clear 🎉</div>
            ) : (
              <div className="max-h-80 overflow-auto divide-y divide-slate-100">
                {active.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-start gap-2">
                    <span className="shrink-0">{a.kind === 'infeasible' ? '⚠️' : '⏰'}</span>
                    <div className="flex-1 text-sm text-slate-700">{a.message}</div>
                    <button
                      onClick={() => dismissAlert(a.id)}
                      className="text-[11px] text-slate-400 hover:text-slate-700 shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
