import { format } from 'date-fns'
import type { DayPlan } from '../types'
import { useStore } from '../store/useStore'
import { addDaysISO, isoDate, isoToDate } from '../utils/date'
import { plansToICS, exportableBlockCount } from '../utils/icsExport'
import { downloadTextFile } from '../download'
import { Button } from './ui'

function mondayOf(iso: string): string {
  const day = isoToDate(iso).getDay() // 0 Sun … 6 Sat
  return addDaysISO(iso, -((day + 6) % 7))
}

/** Download the plan as an .ics file — today, the current week, or everything planned. */
export default function CalendarExport() {
  const dayPlans = useStore((s) => s.dayPlans)
  const today = isoDate()

  const collect = (isos: string[]): DayPlan[] =>
    isos.map((d) => dayPlans[d]).filter((p): p is DayPlan => !!p)

  const todayPlans = collect([today])

  const weekStart = mondayOf(today)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStart, i))
  const weekPlans = collect(weekDays)
  const weekLabel = `${format(isoToDate(weekStart), 'd MMM')} – ${format(isoToDate(weekDays[6]), 'd MMM yyyy')}`

  const allPlans = collect(Object.keys(dayPlans).sort())

  const download = (plans: DayPlan[], calendarName: string, file: string) => {
    if (exportableBlockCount(plans) === 0) return
    downloadTextFile(file, plansToICS(plans, calendarName), 'text/calendar')
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={exportableBlockCount(todayPlans) === 0}
          onClick={() =>
            download(todayPlans, `ToDoToday — ${format(isoToDate(today), 'EEE d MMM')}`, `todotoday-${today}.ics`)
          }
        >
          Today
        </Button>
        <Button
          variant="outline"
          disabled={exportableBlockCount(weekPlans) === 0}
          onClick={() => download(weekPlans, `ToDoToday — ${weekLabel}`, `todotoday-week-${weekStart}.ics`)}
        >
          This week
        </Button>
        <Button
          variant="outline"
          disabled={exportableBlockCount(allPlans) === 0}
          onClick={() => download(allPlans, 'ToDoToday — all planned days', 'todotoday-all.ics')}
        >
          All planned days
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Downloads a calendar file you can import into Outlook, Apple or Google Calendar.
      </p>
    </div>
  )
}
