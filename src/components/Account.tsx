import { useState } from 'react'
import { useAuth, type SyncStatus } from '../store/useAuth'
import { Button, inputClass } from './ui'

// Dot colours for the header (on the brand-coloured bar) and for the dropdown
// panel (on a white background), plus a shared label.
const STATUS: Record<SyncStatus, { headerDot: string; panelDot: string; label: string }> = {
  offline: { headerDot: 'bg-white/40', panelDot: 'bg-slate-300', label: 'Local only' },
  syncing: { headerDot: 'bg-amber-300 animate-pulse', panelDot: 'bg-amber-400 animate-pulse', label: 'Syncing…' },
  saving: { headerDot: 'bg-amber-300 animate-pulse', panelDot: 'bg-amber-400 animate-pulse', label: 'Saving…' },
  idle: { headerDot: 'bg-emerald-300', panelDot: 'bg-emerald-400', label: 'Synced' },
  error: { headerDot: 'bg-red-300', panelDot: 'bg-red-400', label: 'Sync error' },
}

export default function Account() {
  const user = useAuth((s) => s.user)
  const status = useAuth((s) => s.status)
  const login = useAuth((s) => s.login)
  const register = useAuth((s) => s.register)
  const logout = useAuth((s) => s.logout)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const s = STATUS[status]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await (mode === 'login' ? login(email, password) : register(email, password))
      setOpen(false)
      setEmail('')
      setPassword('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-white/90 hover:text-white"
        title={user ? `Signed in as ${user.email}` : 'Sign in to sync'}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${s.headerDot}`} />
        <span className="max-w-[10rem] truncate">{user ? user.email : 'Sign in'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-200 p-4 z-30">
            {user ? (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-slate-500">Signed in as</div>
                  <div className="font-medium truncate">{user.email}</div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`inline-block w-2 h-2 rounded-full ${s.panelDot}`} />
                  {s.label}
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await logout()
                    setOpen(false)
                  }}
                >
                  Sign out
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div className="font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</div>
                <p className="text-xs text-slate-500">
                  Sync your planner across devices. Optional — the app works fully without an account.
                </p>
                <input
                  className={inputClass}
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
                <input
                  className={inputClass}
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                {err && <div className="text-xs text-red-600">{err}</div>}
                <Button type="submit" disabled={busy} className="w-full">
                  {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                </Button>
                <button
                  type="button"
                  className="text-xs text-brand-600 hover:underline"
                  onClick={() => {
                    setMode((m) => (m === 'login' ? 'register' : 'login'))
                    setErr(null)
                  }}
                >
                  {mode === 'login' ? 'No account? Create one' : 'Have an account? Sign in'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  )
}
