import { useState } from 'react'
import { useStore } from '../store/useStore'
import { addDaysISO, isoDate, isoToDate, prettyDate } from '../utils/date'
import { formatDuration, parseTime } from '../utils/time'
import { seasonForDate, SEASON_EMOJI, SEASON_LABEL } from '../engine/season'
import { suggestActivities } from '../engine/suggestions'
import Timeline from './Timeline'
import { Button, Card, EmptyState, inputClass } from './ui'

function StatBar({ label, used, budget, color }: { label: string; used: number; budget: number; color: string }) {
  const pct = budget > 0 ? Math.min(100, (used / budget) * 100) : 0
  return (
    <div className="flex-1 min-w-[120px]">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400 tabular-nums">
          {formatDuration(used)} / {formatDuration(budget)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Today({
  dateISO,
  setDateISO,
}: {
  dateISO: string
  setDateISO: (iso: string) => void
}) {
  const today = isoDate()
  const dayPlans = useStore((s) => s.dayPlans)
  const replan = useStore((s) => s.replan)
  const addEvent = useStore((s) => s.addEvent)
  const [eventForm, setEventForm] = useState({ open: false, title: '', start: '09:00', end: '10:00' })
  const budgets = useStore((s) => s.budgets)
  const template = useStore((s) => s.template)
  const interests = useStore((s) => s.interests)
  const settings = useStore((s) => s.settings)

  const plan = dayPlans[dateISO]
  const sumBy = (type: string) =>
    plan
      ? plan.blocks
          .filter((b) => b.type === type)
          .reduce((a, b) => a + parseTime(b.end) - parseTime(b.start), 0)
      : 0

  const date = isoToDate(dateISO)
  const season = seasonForDate(date, settings.hemisphere)
  const ideas = suggestActivities(
    interests.map((i) => i.categoryKey),
    date,
    settings.hemisphere,
    5,
  )

  return (
    <div className="space-y-4">
      {/* Date navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setDateISO(addDaysISO(dateISO, -1))}>
          ←
        </Button>
        <div className="text-center">
          <div className="font-semibold text-slate-800">{prettyDate(dateISO)}</div>
          {dateISO !== today && (
            <button onClick={() => setDateISO(today)} className="text-xs text-brand-600 hover:underline">
              jump to today
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => setDateISO(addDaysISO(dateISO, 1))}>
          →
        </Button>
      </div>

      {/* Stats + sleep */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-4">
          <StatBar label="Productive" used={sumBy('task')} budget={budgets.productiveMinutesPerDay} color="bg-sky-500" />
          <StatBar label="Free time" used={sumBy('free')} budget={budgets.freeMinutesPerDay} color="bg-emerald-500" />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            😴 Asleep {template.sleep.bedtime} – {template.sleep.wakeTime}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => replan(undefined, true)} title="Re-plan the week, discarding locked blocks">
              Rebuild
            </Button>
            <Button onClick={() => replan()}>{plan ? 'Re-plan' : 'Generate plan'}</Button>
          </div>
        </div>
        {plan && plan.warnings.length > 0 && (
          <div className="space-y-1">
            {plan.warnings.map((w, i) => (
              <div key={i} className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                ⚠ {w}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add a one-off event */}
      <Card className="p-3">
        {!eventForm.open ? (
          <button
            onClick={() => setEventForm((f) => ({ ...f, open: true }))}
            className="text-sm text-brand-600 font-medium hover:underline"
          >
            ➕ Add an event to this day
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (eventForm.title.trim() && eventForm.start < eventForm.end) {
                addEvent({
                  title: eventForm.title.trim(),
                  date: dateISO,
                  startTime: eventForm.start,
                  endTime: eventForm.end,
                })
                setEventForm({ open: false, title: '', start: '09:00', end: '10:00' })
              }
            }}
            className="space-y-2"
          >
            <input
              className={inputClass}
              placeholder="e.g. Dentist appointment"
              value={eventForm.title}
              onChange={(e) => setEventForm((f) => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                className={`${inputClass} w-32`}
                value={eventForm.start}
                onChange={(e) => setEventForm((f) => ({ ...f, start: e.target.value }))}
              />
              <span className="text-slate-400">–</span>
              <input
                type="time"
                className={`${inputClass} w-32`}
                value={eventForm.end}
                onChange={(e) => setEventForm((f) => ({ ...f, end: e.target.value }))}
              />
              <Button type="submit" disabled={!eventForm.title.trim() || eventForm.start >= eventForm.end}>
                Add
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEventForm({ open: false, title: '', start: '09:00', end: '10:00' })}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Timeline */}
      {plan && plan.blocks.length > 0 ? (
        <Card className="p-3">
          <Timeline plan={plan} dateISO={dateISO} />
        </Card>
      ) : (
        <Card>
          <EmptyState icon="🗓️" title="No plan for this day yet">
            <div className="mt-3">
              <Button onClick={() => replan()}>Generate plan</Button>
            </div>
          </EmptyState>
        </Card>
      )}

      {/* Free-time suggestions */}
      <Card className="p-4">
        <div className="font-semibold text-slate-800 mb-2">
          {SEASON_EMOJI[season]} {SEASON_LABEL[season]} free-time ideas
        </div>
        {interests.length === 0 ? (
          <p className="text-sm text-slate-500">
            Add some interests in <span className="font-medium">Settings</span> to get personalised,
            season-appropriate suggestions here.
          </p>
        ) : ideas.length === 0 ? (
          <p className="text-sm text-slate-500">No matching ideas for this season yet — try adding more interests.</p>
        ) : (
          <ul className="space-y-1.5">
            {ideas.map((idea, i) => (
              <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                <span className="text-emerald-500">•</span>
                {idea}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
