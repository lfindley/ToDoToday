import { useStore } from '../store/useStore'
import type { ColorMode } from '../types'
import { THEMES } from '../data/themes'

const MODES: { value: ColorMode; label: string; icon: string }[] = [
  { value: 'system', label: 'System', icon: '🖥️' },
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
]

/** Light / dark / follow-OS toggle. Writes `settings.colorMode`, applied by App. */
export function ColorModeToggle() {
  const current = useStore((s) => s.settings.colorMode) ?? 'system'
  const setSettings = useStore((s) => s.setSettings)

  return (
    <div className="grid grid-cols-3 gap-2">
      {MODES.map((m) => {
        const active = current === m.value
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => setSettings({ colorMode: m.value })}
            aria-pressed={active}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>{m.icon}</span>
            {m.label}
          </button>
        )
      })}
    </div>
  )
}

/** Accent colour-scheme picker. Writes `settings.theme`, which App applies. */
export default function ThemePicker() {
  const current = useStore((s) => s.settings.theme) ?? 'blue'
  const setSettings = useStore((s) => s.setSettings)

  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map((t) => {
        const active = current === t.name
        return (
          <button
            key={t.name}
            type="button"
            onClick={() => setSettings({ theme: t.name })}
            aria-pressed={active}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500 dark:bg-brand-500/15 dark:text-brand-300'
                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span
              className="h-4 w-4 rounded-full shrink-0 ring-1 ring-black/10"
              style={{ backgroundColor: t.swatch }}
            />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
