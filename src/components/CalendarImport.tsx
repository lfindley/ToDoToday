import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import type { CalendarEvent } from '../types'
import { parseICS } from '../utils/ics'
import { shortDate } from '../utils/date'
import { displayTime } from '../utils/time'
import { Button } from './ui'

export default function CalendarImport() {
  const importEvents = useStore((s) => s.importEvents)
  const clearImportedEvents = useStore((s) => s.clearImportedEvents)
  const importedCount = useStore((s) => s.events.filter((e) => e.source === 'import').length)
  const fmt = useStore((s) => s.settings.timeFormat) ?? '24h'

  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<CalendarEvent[] | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [error, setError] = useState<string>('')

  const onFile = async (file: File) => {
    setError('')
    setFileName(file.name)
    try {
      const text = await file.text()
      const events = parseICS(text)
      if (events.length === 0) {
        setPreview(null)
        setError('No appointments found in that file.')
        return
      }
      setPreview(events)
    } catch {
      setPreview(null)
      setError('Could not read that file.')
    }
  }

  const reset = () => {
    setPreview(null)
    setFileName('')
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const confirm = () => {
    if (preview) importEvents(preview)
    reset()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Upload an .ics file exported from Outlook or Apple Calendar. Its appointments
        become anchors the planner schedules around.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".ics,text/calendar"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onFile(file)
        }}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
      />

      {error && <p className="text-xs text-amber-600">{error}</p>}

      {preview && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-medium text-slate-700">
            {preview.length} appointment{preview.length === 1 ? '' : 's'} found
            {fileName && <span className="text-slate-400"> in {fileName}</span>}
          </div>
          <ul className="max-h-44 space-y-1 overflow-y-auto text-xs text-slate-600">
            {preview.slice(0, 12).map((e, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{e.title}</span>
                <span className="whitespace-nowrap text-slate-400">
                  {shortDate(e.date)}
                  {e.allDay ? ' · all day' : ` · ${displayTime(e.startTime, fmt)}–${displayTime(e.endTime, fmt)}`}
                </span>
              </li>
            ))}
            {preview.length > 12 && (
              <li className="text-slate-400">…and {preview.length - 12} more</li>
            )}
          </ul>
          <div className="flex gap-2">
            <Button onClick={confirm}>Import {preview.length}</Button>
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
        <span className="text-xs text-slate-500">
          {importedCount > 0
            ? `${importedCount} imported event${importedCount === 1 ? '' : 's'} currently in your plan.`
            : 'No imported events yet.'}
        </span>
        <Button
          variant="danger"
          onClick={clearImportedEvents}
          disabled={importedCount === 0}
        >
          Clear imported events
        </Button>
      </div>
    </div>
  )
}
