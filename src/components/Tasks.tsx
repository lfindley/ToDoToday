import { useState } from 'react'
import { useStore, type NewTaskInput } from '../store/useStore'
import type { Task } from '../types'
import { Button, Card, Field, inputClass, PriorityBadge, EmptyState } from './ui'
import { displayTime, formatDuration } from '../utils/time'
import { shortDate } from '../utils/date'

interface FormState {
  title: string
  priority: number
  hours: number
  minutes: number
  deadline: string
  maxPerDayMinutes: string
  earliest: string
  latest: string
  notes: string
}

export const blankForm: FormState = {
  title: '',
  priority: 5,
  hours: 1,
  minutes: 0,
  deadline: '',
  maxPerDayMinutes: '',
  earliest: '',
  latest: '',
  notes: '',
}

function taskToForm(t: Task): FormState {
  return {
    title: t.title,
    priority: t.priority,
    hours: Math.floor(t.estimatedMinutes / 60),
    minutes: t.estimatedMinutes % 60,
    deadline: t.deadline ?? '',
    maxPerDayMinutes: t.maxPerDayMinutes ? String(t.maxPerDayMinutes) : '',
    earliest: t.window?.earliest ?? '',
    latest: t.window?.latest ?? '',
    notes: t.notes ?? '',
  }
}

export function formToInput(f: FormState): NewTaskInput {
  return {
    title: f.title,
    priority: f.priority,
    estimatedMinutes: f.hours * 60 + f.minutes,
    maxPerDayMinutes: f.maxPerDayMinutes ? Number(f.maxPerDayMinutes) : undefined,
    deadline: f.deadline || undefined,
    window: { earliest: f.earliest || undefined, latest: f.latest || undefined },
    notes: f.notes || undefined,
  }
}

export function TaskForm({
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
  const valid = f.title.trim().length > 0 && f.hours * 60 + f.minutes > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(f)
      }}
      className="p-4 space-y-3"
    >
      <Field label="Task">
        <input
          className={inputClass}
          placeholder="e.g. Finish project report"
          value={f.title}
          onChange={(e) => set({ title: e.target.value })}
          autoFocus
        />
      </Field>

      <Field label={`Priority — ${f.priority}/10`} hint="10 = highest. Higher-priority tasks are scheduled first.">
        <input
          type="range"
          min={1}
          max={10}
          value={f.priority}
          onChange={(e) => set({ priority: Number(e.target.value) })}
          className="w-full"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Estimated time">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={f.hours}
              onChange={(e) => set({ hours: Math.max(0, Number(e.target.value)) })}
            />
            <span className="text-xs text-slate-500">h</span>
            <input
              type="number"
              min={0}
              max={59}
              step={5}
              className={inputClass}
              value={f.minutes}
              onChange={(e) => set({ minutes: Math.max(0, Math.min(59, Number(e.target.value))) })}
            />
            <span className="text-xs text-slate-500">m</span>
          </div>
        </Field>
        <Field label="Deadline" hint="Optional">
          <input
            type="date"
            className={inputClass}
            value={f.deadline}
            onChange={(e) => set({ deadline: e.target.value })}
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Max per day" hint="Minutes, optional">
          <input
            type="number"
            min={0}
            step={15}
            placeholder="—"
            className={inputClass}
            value={f.maxPerDayMinutes}
            onChange={(e) => set({ maxPerDayMinutes: e.target.value })}
          />
        </Field>
        <Field label="Do after" hint="Optional">
          <input
            type="time"
            className={inputClass}
            value={f.earliest}
            onChange={(e) => set({ earliest: e.target.value })}
          />
        </Field>
        <Field label="Finish by" hint="Optional">
          <input
            type="time"
            className={inputClass}
            value={f.latest}
            onChange={(e) => set({ latest: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Notes" hint="Optional">
        <textarea
          className={inputClass}
          rows={2}
          value={f.notes}
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>

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

export default function Tasks() {
  const tasks = useStore((s) => s.tasks)
  const alerts = useStore((s) => s.alerts)
  const addTask = useStore((s) => s.addTask)
  const updateTask = useStore((s) => s.updateTask)
  const deleteTask = useStore((s) => s.deleteTask)
  const toggleTaskComplete = useStore((s) => s.toggleTaskComplete)
  const fmt = useStore((s) => s.settings.timeFormat) ?? '24h'
  const [editingId, setEditingId] = useState<string | null>(null)

  const infeasibleIds = new Set(
    alerts.filter((a) => a.kind === 'infeasible' && !a.dismissed).map((a) => a.taskId),
  )

  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    const da = a.deadline ?? '9999'
    const db = b.deadline ?? '9999'
    if (da !== db) return da < db ? -1 : 1
    return b.priority - a.priority
  })

  return (
    <div className="space-y-4">
      <Card>
        <div className="px-4 pt-4 font-semibold text-slate-800">Add a task</div>
        <TaskForm
          initial={blankForm}
          submitLabel="Add task"
          onSubmit={(f) => addTask(formToInput(f))}
        />
      </Card>

      <Card className="divide-y divide-slate-100">
        <div className="px-4 py-3 font-semibold text-slate-800">
          Your tasks {tasks.length > 0 && <span className="text-slate-400 font-normal">({tasks.length})</span>}
        </div>
        {sorted.length === 0 && (
          <EmptyState icon="📝" title="No tasks yet">
            Add something above and it'll be scheduled into your day.
          </EmptyState>
        )}
        {sorted.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="bg-slate-50">
              <TaskForm
                initial={taskToForm(t)}
                submitLabel="Save changes"
                onSubmit={(f) => {
                  updateTask(t.id, {
                    title: f.title,
                    priority: f.priority,
                    estimatedMinutes: f.hours * 60 + f.minutes,
                    maxPerDayMinutes: f.maxPerDayMinutes ? Number(f.maxPerDayMinutes) : undefined,
                    deadline: f.deadline || undefined,
                    window: { earliest: f.earliest || undefined, latest: f.latest || undefined },
                    notes: f.notes || undefined,
                  })
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <div key={t.id} className="px-4 py-3 flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-brand-600"
                checked={t.completed}
                onChange={() => toggleTaskComplete(t.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={t.priority} />
                  <span className={`font-medium ${t.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {t.title}
                  </span>
                  {infeasibleIds.has(t.id) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                      ⚠ not enough time
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>⏱ {formatDuration(t.estimatedMinutes)}</span>
                  {!t.completed && t.remainingMinutes !== t.estimatedMinutes && (
                    <span>{formatDuration(t.remainingMinutes)} left</span>
                  )}
                  {t.deadline && <span>📅 due {shortDate(t.deadline)}</span>}
                  {t.maxPerDayMinutes && <span>≤ {formatDuration(t.maxPerDayMinutes)}/day</span>}
                  {t.window?.earliest && <span>after {displayTime(t.window.earliest, fmt)}</span>}
                  {t.window?.latest && <span>by {displayTime(t.window.latest, fmt)}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" onClick={() => setEditingId(t.id)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => deleteTask(t.id)}>
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
