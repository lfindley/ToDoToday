import { useAuth } from '../store/useAuth'
import { Button } from './ui'

/** Shown when local and server data diverge — the user picks which copy wins. */
export default function SyncConflictModal() {
  const conflict = useAuth((s) => s.conflict)
  const resolve = useAuth((s) => s.resolveConflict)
  if (!conflict) return null

  const firstSignin = conflict.kind === 'first-signin'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
        <div className="text-lg font-semibold text-slate-800">
          {firstSignin ? 'You already have saved data' : 'Changed on another device'}
        </div>
        <p className="text-sm text-slate-600">
          {firstSignin
            ? 'This device has planner data, and your account already has data saved. Which copy would you like to keep? The other one will be replaced.'
            : 'Your planner was updated on another device since this one last synced. Keep this device’s version or use the other one? Whichever you don’t pick will be replaced.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => resolve('local')} className="flex-1">
            Keep this device
          </Button>
          <Button variant="outline" onClick={() => resolve('remote')} className="flex-1">
            Use the other version
          </Button>
        </div>
      </div>
    </div>
  )
}
