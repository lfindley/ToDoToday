import { useState } from 'react'
import { useStore } from '../store/useStore'
import type { Category, RecurringTask } from '../types'
import { Button, Card, Field, inputClass, EmptyState } from './ui'
import { recurringDays } from '../engine/recurrence'
import { formatDuration } from '../utils/time'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'productive', label: 'Productive' },
  { value: 'health', label: 'Health' },
  { value: 'personal', label: 'Personal' },
  { value: 'commitment', label: 'Commitment' },
]

type FormState = Omit<RecurringTask, 'id'>

const blankFlexible: FormState = {
  title: '',
  category: 'health',
  priority: 5,
  scheduleType: 'flexible',
  timesPerWeek: 3,
  durationMinutes: 60,
  preferredDays: [],
  window: {},
}

const blankFixed: FormState = {
  title: '',
  category: 'commitment',
  priority: 7,
  scheduleType: 'fixed',
  days: [1, 2, 3, 4, 5],
  startTime: '09:00',
  endTime: '17:00',
}

function DayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (d: number) =>
    onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))
  return (
    <div className="flex gap-1 flex-wrap">
      {WEEKDAYS.map((label, d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`w-10 py-1.5 rounded-lg text-xs font-medium border ${
            value.includes(d)
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function RecurringForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormState
  submitLabel: string
  onSubmit: (f: FormState) => void
  onCancel?: () => void
}) {
  const [f, setF] = useState<FormState>(initial)
  const set = (patch: Partial<FormState>) => setF((prev) => ({ ...prev, ...patch }))
  const valid =
    f.title.trim().length > 0 &&
    (f.scheduleType === 'flexible'
      ? (f.timesPerWeek ?? 0) > 0 && (f.durationMinutes ?? 0) > 0
      : (f.days ?? []).length > 0 && !!f.startTime && !!f.endTime)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(f)
      }}
      className="p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => set({ ...blankFlexible, title: f.title, scheduleType: 'flexible' })}
          className={`px-3 py-2 rounded-lg text-sm font-medium border ${
            f.scheduleType === 'flexible'
              ? 'bg-brand-50 border-brand-500 text-brand-700'
              : 'bg-white border-slate-300 text-slate-600'
          }`}
        >
          🔁 Flexible
          <span className="block text-[11px] font-normal text-slate-500">e.g. gym 3×/week</span>
        </button>
        <button
          type="button"
          onClick={() => set({ ...blankFixed, title: f.title, scheduleType: 'fixed' })}
          className={`px-3 py-2 rounded-lg text-sm font-medium border ${
            f.scheduleType === 'fixed'
              ? 'bg-brand-50 border-brand-500 text-brand-700'
              : 'bg-white border-slate-300 text-slate-600'
          }`}
        >
          📌 Fixed
          <span className="block text-[11px] font-normal text-slate-500">e.g. school / job</span>
        </button>
      </div>

      <Field label="Name">
        <input
          className={inputClass}
          placeholder={f.scheduleType === 'fixed' ? 'e.g. Work' : 'e.g. Gym'}
          value={f.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select
            className={inputClass}
            value={f.category}
            onChange={(e) => set({ category: e.target.value as Category })}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Priority — ${f.priority}/10`}>
          <input
            type="range"
            min={1}
            max={10}
            value={f.priority}
            onChange={(e) => set({ priority: Number(e.target.value) })}
            className="w-full mt-2"
          />
        </Field>
      </div>

      {f.scheduleType === 'flexible' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Times per week">
              <input
                type="number"
                min={1}
                max={7}
                className={inputClass}
                value={f.timesPerWeek ?? 0}
                onChange={(e) => set({ timesPerWeek: Number(e.target.value) })}
              />
            </Field>
            <Field label="Duration (min)">
              <input
                type="number"
                min={5}
                step={5}
                className={inputClass}
                value={f.durationMinutes ?? 0}
                onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Do after" hint="Optional">
              <input
                type="time"
                className={inputClass}
                value={f.window?.earliest ?? ''}
                onChange={(e) => set({ window: { ...f.window, earliest: e.target.value || undefined } })}
              />
            </Field>
            <Field label="Finish by" hint="Optional">
              <input
                type="time"
                className={inputClass}
                value={f.window?.latest ?? ''}
                onChange={(e) => set({ window: { ...f.window, latest: e.target.value || undefined } })}
              />
            </Field>
          </div>
          <Field label="Preferred days" hint="Optional — otherwise spread across the week">
            <DayPicker value={f.preferredDays ?? []} onChange={(days) => set({ preferredDays: days })} />
          </Field>
        </>
      ) : (
        <>
          <Field label="Days">
            <DayPicker value={f.days ?? []} onChange={(days) => set({ days })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <input
                type="time"
                className={inputClass}
                value={f.startTime ?? ''}
                onChange={(e) => set({ startTime: e.target.value })}
              />
            </Field>
            <Field label="End time">
              <input
                type="time"
                className={inputClass}
                value={f.endTime ?? ''}
                onChange={(e) => set({ endTime: e.target.value })}
              />
            </Field>
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={!valid}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function summary(r: RecurringTask): string {
  if (r.scheduleType === 'fixed') {
    const days = (r.days ?? []).map((d) => WEEKDAYS[d]).join(', ')
    return `${days} · ${r.startTime}–${r.endTime}`
  }
  const days = recurringDays(r).map((d) => WEEKDAYS[d]).join(', ')
  const win = [r.window?.earliest && `after ${r.window.earliest}`, r.window?.latest && `by ${r.window.latest}`]
    .filter(Boolean)
    .join(', ')
  return `${r.timesPerWeek}×/week · ${formatDuration(r.durationMinutes ?? 0)} · ${days}${win ? ` · ${win}` : ''}`
}

export default function Recurring() {
  const recurring = useStore((s) => s.recurring)
  const addRecurring = useStore((s) => s.addRecurring)
  const updateRecurring = useStore((s) => s.updateRecurring)
  const deleteRecurring = useStore((s) => s.deleteRecurring)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card>
        <div className="px-4 pt-4 font-semibold text-slate-800">Add a recurring item</div>
        <RecurringForm initial={blankFlexible} submitLabel="Add" onSubmit={(f) => addRecurring(f)} />
      </Card>

      <Card className="divide-y divide-slate-100">
        <div className="px-4 py-3 font-semibold text-slate-800">Recurring & commitments</div>
        {recurring.length === 0 && (
          <EmptyState icon="🔁" title="Nothing recurring yet">
            Add a flexible habit (gym) or a fixed commitment (school, job).
          </EmptyState>
        )}
        {recurring.map((r) =>
          editingId === r.id ? (
            <div key={r.id} className="bg-slate-50">
              <RecurringForm
                initial={r}
                submitLabel="Save changes"
                onSubmit={(f) => {
                  updateRecurring(r.id, f)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div key={r.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-lg">{r.scheduleType === 'fixed' ? '📌' : '🔁'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800">{r.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{summary(r)}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" onClick={() => setEditingId(r.id)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => deleteRecurring(r.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ),
        )}
      </Card>
    </div>
  )
}
