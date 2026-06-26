import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Hemisphere } from '../types'
import { Button, Card, Field, inputClass } from './ui'
import CalendarImport from './CalendarImport'
import CalendarExport from './CalendarExport'
import ThemePicker, { ColorModeToggle } from './ThemePicker'
import { INTEREST_CATEGORIES } from '../data/interests'
import {
  notificationPermission,
  notificationsSupported,
  requestNotificationPermission,
} from '../notifications'

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <div>
        <div className="font-semibold text-slate-800">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {children}
    </Card>
  )
}

export default function Settings() {
  const template = useStore((s) => s.template)
  const budgets = useStore((s) => s.budgets)
  const settings = useStore((s) => s.settings)
  const interests = useStore((s) => s.interests)
  const setSleep = useStore((s) => s.setSleep)
  const addMeal = useStore((s) => s.addMeal)
  const updateMeal = useStore((s) => s.updateMeal)
  const removeMeal = useStore((s) => s.removeMeal)
  const setBudgets = useStore((s) => s.setBudgets)
  const setSettings = useStore((s) => s.setSettings)
  const toggleInterest = useStore((s) => s.toggleInterest)
  const addCustomInterest = useStore((s) => s.addCustomInterest)
  const removeInterest = useStore((s) => s.removeInterest)
  const seedSample = useStore((s) => s.seedSample)
  const resetAll = useStore((s) => s.resetAll)

  const [customInterest, setCustomInterest] = useState('')
  const [permState, setPermState] = useState(notificationPermission())

  const selectedKeys = new Set(interests.map((i) => i.categoryKey))
  const customInterests = interests.filter(
    (i) => !INTEREST_CATEGORIES.some((c) => c.key === i.categoryKey),
  )

  const enableNotifications = async () => {
    const result = await requestNotificationPermission()
    setPermState(result)
    setSettings({ browserNotifications: result === 'granted' })
  }

  const hours = (mins: number) => Math.round((mins / 60) * 10) / 10
  const timeFormat = settings.timeFormat ?? '24h'

  return (
    <div className="space-y-4">
      <Section title="Appearance" subtitle="Choose light or dark, and an accent colour.">
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1">Theme</div>
          <ColorModeToggle />
        </div>
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1">Accent colour</div>
          <ThemePicker />
        </div>
      </Section>

      <Section title="Sleep" subtitle="Your waking window — everything is scheduled between these.">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Wake up">
            <input
              type="time"
              className={inputClass}
              value={template.sleep.wakeTime}
              onChange={(e) => setSleep(template.sleep.bedtime, e.target.value)}
            />
          </Field>
          <Field label="Bedtime">
            <input
              type="time"
              className={inputClass}
              value={template.sleep.bedtime}
              onChange={(e) => setSleep(e.target.value, template.sleep.wakeTime)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Clock format" subtitle="How times are displayed across the app.">
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: '24h', label: '24-hour', example: '14:00' },
            { value: '12h', label: '12-hour', example: '2:00 PM' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSettings({ timeFormat: opt.value })}
              className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                timeFormat === opt.value
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {opt.label}
              <span
                className={`block text-[11px] font-normal ${
                  timeFormat === opt.value ? 'text-brand-100' : 'text-slate-400'
                }`}
              >
                {opt.example}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Meals" subtitle="Fixed anchors placed before tasks.">
        <div className="space-y-2">
          {template.meals.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <input
                className={`${inputClass} flex-1`}
                value={m.name}
                onChange={(e) => updateMeal(m.id, { name: e.target.value })}
              />
              <input
                type="time"
                className={`${inputClass} w-28`}
                value={m.time}
                onChange={(e) => updateMeal(m.id, { time: e.target.value })}
              />
              <input
                type="number"
                min={5}
                step={5}
                className={`${inputClass} w-20`}
                value={m.durationMinutes}
                onChange={(e) => updateMeal(m.id, { durationMinutes: Number(e.target.value) })}
              />
              <span className="text-xs text-slate-400">min</span>
              <Button variant="danger" onClick={() => removeMeal(m.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
        <Button variant="outline" onClick={addMeal}>
          + Add meal
        </Button>
      </Section>

      <Section title="Daily time budget" subtitle="How you want to split a typical day.">
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Productive — ${hours(budgets.productiveMinutesPerDay)}h/day`}>
            <input
              type="number"
              min={0}
              step={0.5}
              className={inputClass}
              value={hours(budgets.productiveMinutesPerDay)}
              onChange={(e) =>
                setBudgets({ productiveMinutesPerDay: Math.round(Number(e.target.value) * 60) })
              }
            />
          </Field>
          <Field label={`Free time — ${hours(budgets.freeMinutesPerDay)}h/day`}>
            <input
              type="number"
              min={0}
              step={0.5}
              className={inputClass}
              value={hours(budgets.freeMinutesPerDay)}
              onChange={(e) =>
                setBudgets({ freeMinutesPerDay: Math.round(Number(e.target.value) * 60) })
              }
            />
          </Field>
        </div>
        <Field label={`Buffer between tasks — ${settings.bufferMinutes} min`} hint="Breathing room added after task blocks.">
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={settings.bufferMinutes}
            onChange={(e) => setSettings({ bufferMinutes: Number(e.target.value) })}
            className="w-full"
          />
        </Field>
      </Section>

      <Section title="Interests" subtitle="Used to suggest free-time activities that suit the season.">
        <div className="flex flex-wrap gap-2">
          {INTEREST_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => toggleInterest(c.key)}
              className={`px-2.5 py-1.5 rounded-full text-sm border ${
                selectedKeys.has(c.key)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>
        {customInterests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {customInterests.map((i) => (
              <span
                key={i.id}
                className="px-2.5 py-1.5 rounded-full text-sm bg-brand-600 text-white inline-flex items-center gap-1"
              >
                {i.label}
                <button onClick={() => removeInterest(i.id)} className="opacity-80 hover:opacity-100">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addCustomInterest(customInterest)
            setCustomInterest('')
          }}
        >
          <input
            className={inputClass}
            placeholder="Add your own interest…"
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>
      </Section>

      <Section title="Season & notifications">
        <Field label="Hemisphere" hint="Determines which season suggestions match.">
          <select
            className={inputClass}
            value={settings.hemisphere}
            onChange={(e) => setSettings({ hemisphere: e.target.value as Hemisphere })}
          >
            <option value="north">Northern</option>
            <option value="south">Southern</option>
          </select>
        </Field>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <div className="text-sm font-medium text-slate-700">Browser notifications</div>
            <div className="text-xs text-slate-500">
              Windows pop-ups for deadline alerts, while the app is open.
            </div>
          </div>
          {!notificationsSupported() ? (
            <span className="text-xs text-slate-400">Not supported</span>
          ) : settings.browserNotifications && permState === 'granted' ? (
            <Button variant="outline" onClick={() => setSettings({ browserNotifications: false })}>
              On — turn off
            </Button>
          ) : (
            <Button onClick={enableNotifications}>Enable</Button>
          )}
        </div>
        {permState === 'denied' && (
          <p className="text-xs text-amber-600">
            Notifications are blocked in your browser settings — in-app alerts still work.
          </p>
        )}
      </Section>

      <Section title="Export calendar" subtitle="Download your plan as an .ics calendar file.">
        <CalendarExport />
      </Section>

      <Section title="Import calendar" subtitle="Bring in appointments from an .ics export.">
        <CalendarImport />
      </Section>

      <Section title="Data">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={seedSample}>
            Load sample data
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm('Clear all tasks, settings and plans? This cannot be undone.')) resetAll()
            }}
          >
            Reset everything
          </Button>
        </div>
        <p className="text-xs text-slate-400">
          Everything is stored locally in this browser. Nothing is sent anywhere.
        </p>
      </Section>
    </div>
  )
}
