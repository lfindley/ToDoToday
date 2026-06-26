import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Hemisphere } from '../types'
import { Button, Card, Field, inputClass } from './ui'
import { INTEREST_CATEGORIES } from '../data/interests'
import { TaskForm, blankForm, formToInput } from './Tasks'
import { RecurringForm, blankFlexible } from './Recurring'
import { displayTime, formatDuration } from '../utils/time'
import { shortDate } from '../utils/date'

const STEPS = ['Welcome', 'Your day', 'Time budget', 'Recurring', 'Tasks', 'Interests'] as const

export default function Onboarding() {
  const [step, setStep] = useState(0)
  const completeOnboarding = useStore((s) => s.completeOnboarding)

  const last = STEPS.length - 1
  const next = () => setStep((s) => Math.min(last, s + 1))
  const back = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="min-h-full bg-slate-50">
      <header className="bg-brand-600 text-white">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🗓️</span>
            <h1 className="font-bold text-lg tracking-tight">ToDoToday</h1>
          </div>
          {step > 0 && (
            <button
              onClick={completeOnboarding}
              className="text-sm text-brand-100 hover:text-white underline-offset-2 hover:underline"
            >
              Skip setup
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl w-full mx-auto px-3 sm:px-4 py-6 space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span>{STEPS[step]}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {step === 0 && <Welcome onStart={next} onSkip={completeOnboarding} />}
        {step === 1 && <DayStep />}
        {step === 2 && <BudgetStep />}
        {step === 3 && <RecurringStep />}
        {step === 4 && <TasksStep />}
        {step === 5 && <InterestsStep />}

        {/* Footer nav (Welcome has its own buttons) */}
        {step > 0 && (
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" onClick={back}>
              ← Back
            </Button>
            {step < last ? (
              <Button onClick={next}>Next →</Button>
            ) : (
              <Button onClick={completeOnboarding}>Finish &amp; build my plan</Button>
            )}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-4">
        Everything is saved locally in this browser — you can change all of this later in Settings.
      </footer>
    </div>
  )
}

function StepCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

function Welcome({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <Card className="p-6 sm:p-8 text-center space-y-4">
      <div className="text-5xl">🗓️</div>
      <h2 className="text-2xl font-bold text-slate-800">Welcome to ToDoToday</h2>
      <p className="text-slate-600 max-w-md mx-auto">
        ToDoToday turns your routine — sleep, meals, commitments and to-dos — into a concrete,
        minute-by-minute plan for each day. Let's set up the essentials. It takes about a minute,
        and you can change anything later.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
        <Button onClick={onStart} className="px-5 py-2.5">
          Get started
        </Button>
        <Button variant="ghost" onClick={onSkip} className="px-5 py-2.5">
          Skip for now
        </Button>
      </div>
    </Card>
  )
}

function DayStep() {
  const template = useStore((s) => s.template)
  const settings = useStore((s) => s.settings)
  const setSleep = useStore((s) => s.setSleep)
  const addMeal = useStore((s) => s.addMeal)
  const updateMeal = useStore((s) => s.updateMeal)
  const removeMeal = useStore((s) => s.removeMeal)
  const setSettings = useStore((s) => s.setSettings)
  const timeFormat = settings.timeFormat ?? '24h'

  return (
    <StepCard
      title="Your day"
      subtitle="When you're awake, when you eat, and how times should look. Everything is scheduled inside your waking hours."
    >
      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Sleep</div>
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
      </div>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Meals</div>
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
        <div className="mt-2">
          <Button variant="outline" onClick={addMeal}>
            + Add meal
          </Button>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">Clock format</div>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: '24h', label: '24-hour', example: '14:00' },
              { value: '12h', label: '12-hour', example: '2:00 PM' },
            ] as const
          ).map((opt) => (
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
      </div>
    </StepCard>
  )
}

function BudgetStep() {
  const budgets = useStore((s) => s.budgets)
  const settings = useStore((s) => s.settings)
  const setBudgets = useStore((s) => s.setBudgets)
  const setSettings = useStore((s) => s.setSettings)
  const hours = (mins: number) => Math.round((mins / 60) * 10) / 10

  return (
    <StepCard
      title="Time budget"
      subtitle="Roughly how a typical day should be split. The planner fills tasks up to your productive budget and free time up to the rest."
    >
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

      <Field
        label={`Buffer between tasks — ${settings.bufferMinutes} min`}
        hint="Breathing room added after task blocks."
      >
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

      <Field label="Hemisphere" hint="Determines which season your free-time suggestions match.">
        <select
          className={inputClass}
          value={settings.hemisphere}
          onChange={(e) => setSettings({ hemisphere: e.target.value as Hemisphere })}
        >
          <option value="north">Northern</option>
          <option value="south">Southern</option>
        </select>
      </Field>
    </StepCard>
  )
}

function RecurringStep() {
  const recurring = useStore((s) => s.recurring)
  const addRecurring = useStore((s) => s.addRecurring)
  const deleteRecurring = useStore((s) => s.deleteRecurring)
  const [formKey, setFormKey] = useState(0)

  return (
    <StepCard
      title="Recurring & commitments"
      subtitle="Anything that repeats — a job or classes (fixed times), or habits like the gym (a few times a week). Optional — you can skip this."
    >
      {recurring.length > 0 && (
        <div className="space-y-1.5">
          {recurring.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="text-lg">{r.scheduleType === 'fixed' ? '📌' : '🔁'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{r.title}</div>
                <div className="text-xs text-slate-500">
                  {r.scheduleType === 'fixed'
                    ? 'Fixed weekly commitment'
                    : `${r.timesPerWeek ?? 0}×/week · ${formatDuration(r.durationMinutes ?? 0)}`}
                </div>
              </div>
              <Button variant="danger" onClick={() => deleteRecurring(r.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200">
        <RecurringForm
          key={formKey}
          initial={blankFlexible}
          submitLabel="+ Add recurring item"
          onSubmit={(f) => {
            addRecurring(f)
            setFormKey((k) => k + 1)
          }}
        />
      </div>
    </StepCard>
  )
}

function TasksStep() {
  const tasks = useStore((s) => s.tasks)
  const addTask = useStore((s) => s.addTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const fmt = useStore((s) => s.settings.timeFormat) ?? '24h'
  const [formKey, setFormKey] = useState(0)

  return (
    <StepCard
      title="Tasks"
      subtitle="One-off things to get done. Add an estimate and an optional deadline, and they'll be spread across your days. Optional — you can skip this."
    >
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 truncate">{t.title}</div>
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                  <span>⏱ {formatDuration(t.estimatedMinutes)}</span>
                  {t.deadline && <span>📅 due {shortDate(t.deadline)}</span>}
                  {t.window?.latest && <span>by {displayTime(t.window.latest, fmt)}</span>}
                </div>
              </div>
              <Button variant="danger" onClick={() => deleteTask(t.id)}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-200">
        <TaskForm
          key={formKey}
          initial={blankForm}
          submitLabel="+ Add task"
          onSubmit={(f) => {
            addTask(formToInput(f))
            setFormKey((k) => k + 1)
          }}
        />
      </div>
    </StepCard>
  )
}

function InterestsStep() {
  const interests = useStore((s) => s.interests)
  const toggleInterest = useStore((s) => s.toggleInterest)
  const addCustomInterest = useStore((s) => s.addCustomInterest)
  const removeInterest = useStore((s) => s.removeInterest)
  const [customInterest, setCustomInterest] = useState('')

  const selectedKeys = new Set(interests.map((i) => i.categoryKey))
  const customInterests = interests.filter(
    (i) => !INTEREST_CATEGORIES.some((c) => c.key === i.categoryKey),
  )

  return (
    <StepCard
      title="Interests"
      subtitle="Pick a few things you enjoy. They're used to suggest free-time activities that suit the season."
    >
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

      <p className="text-sm text-slate-500 pt-1">
        That's everything — hit <span className="font-medium text-slate-700">Finish</span> below and
        we'll build your plan.
      </p>
    </StepCard>
  )
}
