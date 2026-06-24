// Core domain types for ToDoToday.

export type Priority = number // integer 1–10, 10 = highest
export type Category = 'productive' | 'health' | 'personal' | 'commitment'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type Hemisphere = 'north' | 'south'

/** Optional "do after / finish by" bounds within a single day, as "HH:mm". */
export interface TimeWindow {
  earliest?: string // do not start before, e.g. "19:00"
  latest?: string // must finish by, e.g. "11:00"
}

export interface Task {
  id: string
  title: string
  notes?: string
  priority: Priority
  estimatedMinutes: number // total work the task needs
  remainingMinutes: number // decremented as it gets done
  maxPerDayMinutes?: number // cap on time-per-day for this task
  deadline?: string // ISO date (yyyy-MM-dd)
  window?: TimeWindow
  completed: boolean
  createdAt: string // ISO datetime
}

export interface RecurringTask {
  id: string
  title: string
  category: Category
  priority: Priority
  scheduleType: 'flexible' | 'fixed'
  // flexible (e.g. gym 3×/week) — scheduler places it into free gaps:
  timesPerWeek?: number
  durationMinutes?: number
  preferredDays?: number[] // 0–6 (Sun–Sat)
  window?: TimeWindow
  // fixed (e.g. school / job / classes) — immovable weekly anchor:
  days?: number[] // 0–6
  startTime?: string // "09:00"
  endTime?: string // "15:30"
}

export interface Meal {
  id: string
  name: string
  time: string // "08:00"
  durationMinutes: number
}

/** A one-off, dated appointment with a fixed time (e.g. dentist on the 25th). */
export interface CalendarEvent {
  id: string
  title: string
  date: string // ISO date "yyyy-MM-dd"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  notes?: string
}

export interface DayTemplate {
  sleep: { bedtime: string; wakeTime: string } // "23:00" / "07:00"
  meals: Meal[]
}

export interface Budgets {
  productiveMinutesPerDay: number
  freeMinutesPerDay: number
}

export interface Interest {
  id: string
  categoryKey: string
  label: string
}

export type BlockType = 'sleep' | 'meal' | 'task' | 'recurring' | 'free' | 'buffer' | 'event'

export interface ScheduledBlock {
  id: string
  start: string // "HH:mm"
  end: string // "HH:mm"
  type: BlockType
  title: string
  refId?: string // task / recurring id
  suggestion?: string // for free blocks
  locked?: boolean // true once the user drags/edits it
  done?: boolean // task block checked off
}

export interface DayPlan {
  date: string // ISO date
  blocks: ScheduledBlock[]
  generatedAt: string
  warnings: string[]
}

export type AlertKind = 'infeasible' | 'reminder-2d' | 'reminder-1d' | 'reminder-today'

export interface Alert {
  id: string
  taskId: string
  kind: AlertKind
  message: string
  forDate: string // the day the alert pertains to (ISO date)
  createdAt: string
  dismissed: boolean
  notified: boolean // OS toast already shown this session
}

export interface Settings {
  hemisphere: Hemisphere
  bufferMinutes: number // gap inserted after task blocks
  browserNotifications: boolean
}
